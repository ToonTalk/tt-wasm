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
    looping = (flags & DSBPLAY_LOOPING) ? 1 : 0;
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
