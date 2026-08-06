/* mmio_impl.cpp — the multimedia file I/O the WAV loader runs on.
 *
 * Ken: "the sound effects don't work (the ToonTalk ones do work)." ToonTalk's own effects come
 * from the .us1 resources by another route; a USER sound is a .wav in the private media directory,
 * loaded by WaveSound::make_sound -> load_sound_from_file -> DSLoadSoundFromFile (dsutil.cpp) ->
 * WaveLoadFile (wave.cpp), which parses the RIFF with the Windows multimedia I/O API. All of
 * mmioOpen/Descend/Read/Ascend/Close/Seek/GetInfo/SetInfo/Advance were zero-stubs, so WaveLoadFile
 * failed before a buffer was ever created and every user sound was silent.
 *
 * Implemented over the Emscripten filesystem rather than bypassing wave.cpp, so the engine's own
 * parser stays untouched and every other mmio caller is fixed at the same time. The files are
 * small (the Playground's 143 WAVs are ~30KB each), so each handle simply holds the whole file in
 * memory -- which also makes the engine's buffered-read path trivial: GetInfo hands it the entire
 * file as one buffer, so its pchNext/pchEndRead loop never has to call mmioAdvance at all. */
#include "windows.h"
#include "mmsystem.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {

struct MmioFile {
    unsigned char *data;
    long len;
    long pos;
};

unsigned long rd32le(const unsigned char *p) {
    return (unsigned long)p[0] | ((unsigned long)p[1] << 8) |
           ((unsigned long)p[2] << 16) | ((unsigned long)p[3] << 24);
}

/* RIFF and LIST carry a form type after the size, so their data starts 12 bytes in, not 8. */
bool is_container(FOURCC id) {
    return id == FOURCC_RIFF || id == FOURCC_LIST;
}

} // namespace

extern "C" {

HMMIO mmioOpenA(LPSTR pszFileName, LPMMIOINFO pmmioinfo, DWORD fdwOpen) {
    if (pmmioinfo) pmmioinfo->wErrorRet = 0;
    if (!pszFileName) return NULL;
    if (fdwOpen & (MMIO_WRITE | MMIO_READWRITE | MMIO_CREATE)) return NULL;  /* read-only shim */
    /* the engine hands over Windows-style paths; '\' is an ordinary character here */
    char path[600];
    size_t n = 0;
    for (const char *s = pszFileName; *s && n < sizeof(path) - 1; s++) {
        path[n++] = (*s == '\\') ? '/' : *s;
    }
    path[n] = 0;
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (len <= 0) { fclose(f); return NULL; }
    unsigned char *buf = (unsigned char *)malloc((size_t)len);
    if (!buf) { fclose(f); return NULL; }
    size_t got = fread(buf, 1, (size_t)len, f);
    fclose(f);
    if (got != (size_t)len) { free(buf); return NULL; }
    MmioFile *m = (MmioFile *)malloc(sizeof(MmioFile));
    if (!m) { free(buf); return NULL; }
    m->data = buf; m->len = len; m->pos = 0;
    return (HMMIO)m;
}

MMRESULT mmioClose(HMMIO hmmio, UINT) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m) return 1;
    free(m->data);
    free(m);
    return 0;
}

LONG mmioRead(HMMIO hmmio, HPSTR pch, LONG cch) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pch || cch <= 0) return -1;
    long avail = m->len - m->pos;
    if (avail <= 0) return 0;
    long take = (cch < avail) ? cch : avail;
    memcpy(pch, m->data + m->pos, (size_t)take);
    m->pos += take;
    return take;
}

LONG mmioSeek(HMMIO hmmio, LONG lOffset, int iOrigin) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m) return -1;
    long np = (iOrigin == SEEK_CUR) ? m->pos + lOffset
            : (iOrigin == SEEK_END) ? m->len + lOffset
                                    : lOffset;
    if (np < 0 || np > m->len) return -1;
    m->pos = np;
    return np;
}

/* The whole file IS the buffer, so the caller's read loop walks it directly and never needs
 * mmioAdvance; SetInfo just adopts wherever pchNext ended up. */
MMRESULT mmioGetInfo(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pmmioinfo) return 1;
    memset(pmmioinfo, 0, sizeof(*pmmioinfo));
    pmmioinfo->hmmio = hmmio;
    pmmioinfo->cchBuffer = m->len;
    pmmioinfo->pchBuffer = (HPSTR)m->data;
    pmmioinfo->pchNext = (HPSTR)(m->data + m->pos);
    pmmioinfo->pchEndRead = (HPSTR)(m->data + m->len);
    pmmioinfo->pchEndWrite = (HPSTR)(m->data + m->len);
    pmmioinfo->lBufOffset = 0;
    pmmioinfo->lDiskOffset = m->pos;
    return 0;
}

MMRESULT mmioSetInfo(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pmmioinfo) return 1;
    if (pmmioinfo->pchNext) {
        long np = (long)((unsigned char *)pmmioinfo->pchNext - m->data);
        if (np >= 0 && np <= m->len) m->pos = np;
    }
    return 0;
}

MMRESULT mmioAdvance(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT) {
    /* Only reached at end of buffer, which here means end of file: report no more data by
     * leaving pchNext == pchEndRead, exactly the condition the caller then tests. */
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pmmioinfo) return 1;
    pmmioinfo->pchNext = (HPSTR)(m->data + m->len);
    pmmioinfo->pchEndRead = (HPSTR)(m->data + m->len);
    return 0;
}

MMRESULT mmioDescend(HMMIO hmmio, LPMMCKINFO pmmcki, const MMCKINFO *pmmckiParent, UINT fuDescend) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pmmcki) return 1;
    long limit = m->len;
    if (pmmckiParent) {
        long pend = (long)pmmckiParent->dwDataOffset + (long)pmmckiParent->cksize;
        if (pend < limit) limit = pend;
        /* first sub-chunk: past the form type if the parent is a container */
        long pstart = (long)pmmckiParent->dwDataOffset + (is_container(pmmckiParent->ckid) ? 4 : 0);
        if (m->pos < pstart) m->pos = pstart;
    }
    FOURCC want_id = 0, want_type = 0;
    if (fuDescend & MMIO_FINDCHUNK) want_id = pmmcki->ckid;
    else if (fuDescend & (MMIO_FINDRIFF | MMIO_FINDLIST)) {
        want_id = (fuDescend & MMIO_FINDLIST) ? FOURCC_LIST : FOURCC_RIFF;
        want_type = pmmcki->fccType;
    }
    while (m->pos + 8 <= limit) {
        const unsigned char *p = m->data + m->pos;
        FOURCC id = (FOURCC)rd32le(p);
        DWORD size = (DWORD)rd32le(p + 4);
        FOURCC type = 0;
        if (is_container(id) && m->pos + 12 <= limit) type = (FOURCC)rd32le(p + 8);
        bool match = true;
        if (want_id && id != want_id) match = false;
        if (match && want_type && type != want_type) match = false;
        if (match) {
            pmmcki->ckid = id;
            pmmcki->cksize = size;
            pmmcki->fccType = type;
            /* dwDataOffset is chunk+8 even for RIFF/LIST -- it points AT the form type, which is
             * counted in cksize (so dwDataOffset + cksize lands exactly at the chunk's end). The
             * seek position, though, is left just PAST the form type. WaveStartDataRead depends on
             * both halves: it restarts its scan at pckInRIFF->dwDataOffset + sizeof(FOURCC). */
            pmmcki->dwDataOffset = (DWORD)(m->pos + 8);
            pmmcki->dwFlags = 0;
            m->pos += is_container(id) ? 12 : 8;
            return 0;
        }
        if (!want_id && !want_type) return 1;          /* plain descend already handled above */
        long step = (long)size + 8;
        if (step & 1) step++;                          /* RIFF chunks are word aligned */
        if (step <= 0) return 1;
        m->pos += step;
    }
    return 1;                                          /* MMIOERR_CHUNKNOTFOUND */
}

MMRESULT mmioAscend(HMMIO hmmio, LPMMCKINFO pmmcki, UINT) {
    MmioFile *m = (MmioFile *)hmmio;
    if (!m || !pmmcki) return 1;
    long end = (long)pmmcki->dwDataOffset + (long)pmmcki->cksize;
    if (end & 1) end++;                                /* skip the pad byte */
    if (end > m->len) end = m->len;
    m->pos = end;
    return 0;
}

MMRESULT mmioCreateChunk(HMMIO, LPMMCKINFO, UINT) { return 1; }   /* read-only shim */
LONG mmioWrite(HMMIO, const char *, LONG) { return -1; }

} // extern "C"
