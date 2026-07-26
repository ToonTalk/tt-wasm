/* dsound_impl.cpp — DirectSound over Web Audio.
 *
 * The engine's TT_DIRECTX sound path (utils.cpp play_sound / dsutil.cpp) is:
 *   DirectSoundCreate -> SetCooperativeLevel -> per sound:
 *   DSParseWaveResource (WAV bytes live inside resind.us1) -> CreateSoundBuffer
 *   -> Lock/CopyMemory/Unlock (DSFillSoundBuffer) -> Play(0,0,loop?) / Stop / SetVolume
 *   / GetStatus (BUFFERLOST check) / GetCurrentPosition (speech sequencing) / Release.
 *
 * Buffers keep a malloc'd PCM store C++-side; Play hands the bytes + format to JS,
 * which builds an AudioBuffer (8-bit unsigned / 16-bit signed LE, mono or stereo)
 * and starts a source through a per-buffer GainNode. The AudioContext starts
 * suspended until a user gesture; pre.js resumes it on first mousedown/keydown.
 * Buffers are never "lost" (DSBSTATUS_BUFFERLOST never reported).
 */
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <emscripten.h>
#include "windows.h"
#include "dsound.h"

namespace {

int next_buffer_id = 1;

/* JS registry + helpers. ended-flag: JS clears HEAP8[playing_ptr] when a
 * non-looping source finishes, so GetStatus reflects real completion. */
EM_JS(void, tt_ds_play, (int id, const void *pcm, int bytes, int channels, int rate, int bits, int loop, char *playing_flag), {
  try {
    var DS = Module.TT_ds || (Module.TT_ds = { ctx: null, srcs: {}, gains: {}, vols: {} });
    if (!DS.ctx) {
      var AC = (typeof AudioContext !== 'undefined') ? AudioContext
             : (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null;
      if (!AC) return;
      DS.ctx = new AC();
    }
    if (DS.ctx.state === 'suspended') { try { DS.ctx.resume(); } catch (e) {} }
    if (DS.srcs[id]) { try { DS.srcs[id].onended = null; DS.srcs[id].stop(); } catch (e) {} delete DS.srcs[id]; }
    var bytesPerSample = bits >>> 3;
    var frames = (bytes / (bytesPerSample * channels)) | 0;
    if (frames <= 0) return;
    var ab = DS.ctx.createBuffer(channels, frames, rate);
    for (var ch = 0; ch < channels; ch++) {
      var out = ab.getChannelData(ch);
      if (bits === 8) {
        for (var i = 0; i < frames; i++) out[i] = (HEAPU8[pcm + i * channels + ch] - 128) / 128;
      } else {
        for (var j = 0; j < frames; j++) {
          var lo = HEAPU8[pcm + (j * channels + ch) * 2];
          var hi = HEAPU8[pcm + (j * channels + ch) * 2 + 1];
          var v = (hi << 8) | lo; if (v >= 0x8000) v -= 0x10000;
          out[j] = v / 32768;
        }
      }
    }
    var gain = DS.gains[id];
    if (!gain) { gain = DS.ctx.createGain(); gain.connect(DS.ctx.destination); DS.gains[id] = gain; }
    gain.gain.value = (DS.vols[id] !== undefined) ? DS.vols[id] : 1;
    var src = DS.ctx.createBufferSource();
    src.buffer = ab; src.loop = !!loop; src.connect(gain);
    if (!loop) src.onended = function () { HEAP8[playing_flag] = 0; delete DS.srcs[id]; };
    HEAP8[playing_flag] = 1;
    DS.srcs[id] = src;
    src.start();
  } catch (e) { /* no audio available — stay silent */ }
});

EM_JS(void, tt_ds_stop, (int id, char *playing_flag), {
  var DS = Module.TT_ds;
  if (DS && DS.srcs[id]) { try { DS.srcs[id].onended = null; DS.srcs[id].stop(); } catch (e) {} delete DS.srcs[id]; }
  HEAP8[playing_flag] = 0;
});

EM_JS(void, tt_ds_volume, (int id, double gain), {
  var DS = Module.TT_ds || (Module.TT_ds = { ctx: null, srcs: {}, gains: {}, vols: {} });
  DS.vols[id] = gain;
  if (DS.gains[id]) DS.gains[id].gain.value = gain;
});

EM_JS(void, tt_ds_free, (int id), {
  var DS = Module.TT_ds;
  if (!DS) return;
  if (DS.srcs[id]) { try { DS.srcs[id].onended = null; DS.srcs[id].stop(); } catch (e) {} delete DS.srcs[id]; }
  if (DS.gains[id]) { try { DS.gains[id].disconnect(); } catch (e) {} delete DS.gains[id]; }
  delete DS.vols[id];
});

struct TTSoundBuffer : public IDirectSoundBuffer {
  ULONG refs;
  int id;
  unsigned char *store;
  DWORD size;
  WAVEFORMATEX fmt;      /* copied at create time — desc->lpwfxFormat points into freed WAV bytes */
  char playing;          /* cleared by JS onended for non-looping sounds */
  char looping;

  TTSoundBuffer(const DSBUFFERDESC *desc)
    : refs(1), id(next_buffer_id++), store(NULL), size(0), playing(0), looping(0) {
    memset(&fmt, 0, sizeof fmt);
    if (desc != NULL) {
      size = desc->dwBufferBytes;
      if (desc->lpwfxFormat != NULL) fmt = *desc->lpwfxFormat;
    }
    if (fmt.nChannels == 0) fmt.nChannels = 1;
    if (fmt.nSamplesPerSec == 0) fmt.nSamplesPerSec = 22050;
    if (fmt.wBitsPerSample == 0) fmt.wBitsPerSample = 8;
    store = (unsigned char *) calloc(size ? size : 1, 1);
  }
  ~TTSoundBuffer() { tt_ds_free(id); free(store); }

  /* IUnknown */
  HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; refs++; return S_OK; }
  ULONG AddRef() { return ++refs; }
  ULONG Release() { if (--refs == 0) { delete this; return 0; } return refs; }

  /* IDirectSoundBuffer */
  HRESULT GetCaps(LPDSBCAPS) { return DS_OK; }
  HRESULT GetCurrentPosition(LPDWORD play_cursor, LPDWORD write_cursor) {
    /* DirectSound's play cursor rests at 0 when the buffer isn't playing;
     * sound_buffer_playing() tests cursor > 0 */
    DWORD pos = playing ? (size / 2) : 0;
    if (play_cursor) *play_cursor = pos;
    if (write_cursor) *write_cursor = pos;
    return DS_OK;
  }
  HRESULT GetFormat(LPWAVEFORMATEX pwfx, DWORD alloc, LPDWORD written) {
    if (pwfx && alloc >= sizeof(WAVEFORMATEX)) *pwfx = fmt;
    if (written) *written = sizeof(WAVEFORMATEX);
    return DS_OK;
  }
  HRESULT GetVolume(LPLONG v) { if (v) *v = 0; return DS_OK; }
  HRESULT GetPan(LPLONG p) { if (p) *p = 0; return DS_OK; }
  HRESULT GetFrequency(LPDWORD f) { if (f) *f = fmt.nSamplesPerSec; return DS_OK; }
  HRESULT GetStatus(LPDWORD st) {
    if (st) *st = playing ? (DSBSTATUS_PLAYING | (looping ? DSBSTATUS_LOOPING : 0)) : 0;
    return DS_OK;
  }
  HRESULT Initialize(IDirectSound *, LPCDSBUFFERDESC) { return DS_OK; }
  HRESULT Lock(DWORD offset, DWORD bytes, LPVOID *p1, LPDWORD n1, LPVOID *p2, LPDWORD n2, DWORD) {
    if (offset > size) offset = size;
    if (bytes > size - offset) bytes = size - offset;
    if (p1) *p1 = store + offset;
    if (n1) *n1 = bytes;
    if (p2) *p2 = NULL;
    if (n2) *n2 = 0;
    return DS_OK;
  }
  HRESULT Play(DWORD, DWORD, DWORD flags) {
    int want_loop = (flags & DSBPLAY_LOOPING) ? 1 : 0;
    /* DirectSound: Play on a buffer that is already playing is a no-op -- it keeps going from
     * where it is. The engine leans on that for repeating sounds: SndObjPlay hands the same
     * single buffer back every cycle while the helicopter flies (dsutil.cpp:327, and
     * SndObjGetFreeBuffer does not rotate when iAlloc == 1), so restarting the Web Audio source
     * each time replayed the first few milliseconds forever -- Ken: "the helicopter sounds got
     * stuck on repeat". Ignoring the redundant Play also stops us re-decoding the PCM per cycle. */
    if (playing && want_loop == looping) return DS_OK;
    looping = want_loop;
    tt_ds_play(id, store, (int) size, fmt.nChannels, (int) fmt.nSamplesPerSec,
               fmt.wBitsPerSample, looping, &playing);
    return DS_OK;
  }
  HRESULT SetCurrentPosition(DWORD) { return DS_OK; }
  HRESULT SetFormat(LPWAVEFORMATEX f) { if (f) fmt = *f; return DS_OK; }
  HRESULT SetVolume(LONG hundredths_db) {
    /* DirectSound volume: 0 = full, -10000 = silence, in 1/100 dB attenuation */
    double gain = hundredths_db <= -10000 ? 0.0 : pow(10.0, hundredths_db / 2000.0);
    tt_ds_volume(id, gain);
    return DS_OK;
  }
  HRESULT SetPan(LONG) { return DS_OK; }
  HRESULT SetFrequency(DWORD f) { if (f) fmt.nSamplesPerSec = f; return DS_OK; }
  HRESULT Stop() { tt_ds_stop(id, &playing); return DS_OK; }
  HRESULT Unlock(LPVOID, DWORD, LPVOID, DWORD) { return DS_OK; }
  HRESULT Restore() { return DS_OK; }
};

struct TTDirectSound : public IDirectSound {
  ULONG refs;
  TTDirectSound() : refs(1) {}

  HRESULT QueryInterface(REFIID, void **ppv) { *ppv = this; refs++; return S_OK; }
  ULONG AddRef() { return ++refs; }
  ULONG Release() { if (refs > 1) return --refs; return 0; }   /* singleton-ish; engine re-creates freely */

  HRESULT CreateSoundBuffer(LPCDSBUFFERDESC desc, LPDIRECTSOUNDBUFFER *out, IUnknown *) {
    if (out == NULL) return 1;
    *out = new TTSoundBuffer(desc);
    return DS_OK;
  }
  HRESULT GetCaps(LPDSCAPS) { return DS_OK; }
  HRESULT DuplicateSoundBuffer(LPDIRECTSOUNDBUFFER, LPDIRECTSOUNDBUFFER *out) {
    if (out) *out = NULL;
    return 1;
  }
  HRESULT SetCooperativeLevel(HWND, DWORD) { return DS_OK; }
  HRESULT Compact() { return DS_OK; }
  HRESULT Initialize(const GUID *) { return DS_OK; }
};

TTDirectSound *the_direct_sound = NULL;

} // namespace

HRESULT DirectSoundCreate(const GUID *, LPDIRECTSOUND *ppDS, IUnknown *) {
  if (ppDS == NULL) return 1;
  if (the_direct_sound == NULL) the_direct_sound = new TTDirectSound();
  the_direct_sound->AddRef();
  *ppDS = the_direct_sound;
  return DS_OK;
}

/* ------------------------------------------------------------------------- *
 * sndPlaySound — the winmm single-channel player. The engine uses it for the
 * demo NARRATION (play_sound_file: Pat's US/sNN.wav extracted from the .dmo
 * archive) and for play_sound_bytes (in-memory WAV). It is entirely separate
 * from the DirectSound buffer path, so the effects shim above never covered
 * it — "sound effects are heard but not narration" (Ken 2026-07-26). Parses
 * a PCM WAV (file or SND_MEMORY) and routes it through the same Web Audio
 * player on reserved channel id 0; a new play (or NULL) replaces the
 * previous, matching winmm semantics.                                        */

namespace {

char snd_channel_playing = 0;

const unsigned char *wav_find_chunk(const unsigned char *p, long len,
                                    const char *id, long &size_out) {
  long i = 12; /* past RIFF....WAVE */
  while (i + 8 <= len) {
    long sz = (long) (p[i+4] | (p[i+5] << 8) | ((unsigned long) p[i+6] << 16) | ((unsigned long) p[i+7] << 24));
    if (memcmp(p + i, id, 4) == 0) { size_out = sz; return p + i + 8; }
    i += 8 + sz + (sz & 1);
  }
  return NULL;
}

BOOL snd_play_wav_bytes(const unsigned char *wav, long len) {
  if (len < 44 || memcmp(wav, "RIFF", 4) != 0 || memcmp(wav + 8, "WAVE", 4) != 0) return FALSE;
  long fmt_size = 0, data_size = 0;
  const unsigned char *fmt = wav_find_chunk(wav, len, "fmt ", fmt_size);
  const unsigned char *data = wav_find_chunk(wav, len, "data", data_size);
  if (fmt == NULL || data == NULL || fmt_size < 16) return FALSE;
  int tag      = fmt[0] | (fmt[1] << 8);
  int channels = fmt[2] | (fmt[3] << 8);
  long rate    = (long) (fmt[4] | (fmt[5] << 8) | ((unsigned long) fmt[6] << 16) | ((unsigned long) fmt[7] << 24));
  int bits     = fmt[14] | (fmt[15] << 8);
  if (tag != 1 /* PCM */ || channels < 1 || channels > 2 || (bits != 8 && bits != 16)) return FALSE;
  if (data + data_size > wav + len) data_size = (long) (wav + len - data);
  tt_ds_stop(0, &snd_channel_playing);
  snd_channel_playing = 1;
  /* tt_ds_play copies the PCM into the AudioBuffer synchronously, so the
     caller's storage need not outlive this call */
  tt_ds_play(0, data, (int) data_size, channels, (int) rate, bits, 0, &snd_channel_playing);
  return TRUE;
}

} // namespace

BOOL sndPlaySoundA(LPCSTR pszSound, UINT fuSound) {
  if (pszSound == NULL) { /* winmm: stop whatever is playing */
    tt_ds_stop(0, &snd_channel_playing);
    return TRUE;
  }
  if (fuSound & 0x0004 /* SND_MEMORY */) {
    const unsigned char *wav = (const unsigned char *) pszSound;
    long len = 8 + (long) (wav[4] | (wav[5] << 8) | ((unsigned long) wav[6] << 16) | ((unsigned long) wav[7] << 24));
    return snd_play_wav_bytes(wav, len);
  }
  /* file mode: MEMFS wants forward slashes */
  char path[512];
  int i = 0;
  for (; pszSound[i] && i < 511; i++) path[i] = (pszSound[i] == '\\') ? '/' : pszSound[i];
  path[i] = 0;
  FILE *f = fopen(path, "rb");
  if (!f) {
    printf("[tt] sndplay: cannot open '%s'\n", path); fflush(stdout);
    return FALSE;
  }
  fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
  unsigned char *buf = (unsigned char *) malloc(len > 0 ? len : 1);
  if (!buf) { fclose(f); return FALSE; }
  long got = (long) fread(buf, 1, len, f);
  fclose(f);
  BOOL ok = snd_play_wav_bytes(buf, got);
  if (!ok) { printf("[tt] sndplay: bad/unsupported wav '%s' (%ld bytes)\n", path, got); fflush(stdout); }
  free(buf);
  return ok;
}
