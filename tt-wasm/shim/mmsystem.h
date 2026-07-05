/* <mmsystem.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * Multimedia timer / waveform / MCI declarations. ToonTalk's hot path here is
 * timeGetTime() (mapped to performance.now() in phase 1); the wave/MCI types
 * are declared because sound.h / winmain.h reference them. Free functions have
 * no bodies — unresolved at link, fine for phase 0. */
#ifndef _MMSYSTEM_SHIM_H_
#define _MMSYSTEM_SHIM_H_

#include <windows.h>

typedef UINT MMRESULT;
typedef UINT MMVERSION;
typedef UINT_PTR MCIDEVICEID;
typedef DWORD MCIERROR;
typedef UINT_PTR HWAVEOUT_t;
typedef HANDLE HWAVEOUT, HWAVEIN, HMIDIOUT, HMIDIIN, HMMIO;

#define MMSYSERR_NOERROR 0
#define TIMERR_NOERROR   0
#define TIMERR_NOCANDO   97

#ifndef MAKEFOURCC
#define MAKEFOURCC(a, b, c, d) \
    ((DWORD)(BYTE)(a) | ((DWORD)(BYTE)(b) << 8) | \
     ((DWORD)(BYTE)(c) << 16) | ((DWORD)(BYTE)(d) << 24))
#endif

/* --- waveform format (also used by DirectSound buffers) --- */
#ifndef _WAVEFORMATEX_
#define _WAVEFORMATEX_
typedef struct tWAVEFORMATEX {
    WORD  wFormatTag;
    WORD  nChannels;
    DWORD nSamplesPerSec;
    DWORD nAvgBytesPerSec;
    WORD  nBlockAlign;
    WORD  wBitsPerSample;
    WORD  cbSize;
} WAVEFORMATEX, *LPWAVEFORMATEX, *PWAVEFORMATEX;
#endif

#ifndef WAVE_FORMAT_PCM
#define WAVE_FORMAT_PCM 1
#endif

typedef struct waveformat_tag {
    WORD  wFormatTag;
    WORD  nChannels;
    DWORD nSamplesPerSec;
    DWORD nAvgBytesPerSec;
    WORD  nBlockAlign;
} WAVEFORMAT, *LPWAVEFORMAT;

typedef struct pcmwaveformat_tag {
    WAVEFORMAT wf;
    WORD       wBitsPerSample;
} PCMWAVEFORMAT, *LPPCMWAVEFORMAT;

typedef struct wavehdr_tag {
    LPSTR  lpData;
    DWORD  dwBufferLength;
    DWORD  dwBytesRecorded;
    DWORD_PTR dwUser;
    DWORD  dwFlags;
    DWORD  dwLoops;
    struct wavehdr_tag *lpNext;
    DWORD_PTR reserved;
} WAVEHDR, *LPWAVEHDR;

typedef struct timecaps_tag {
    UINT wPeriodMin;
    UINT wPeriodMax;
} TIMECAPS, *LPTIMECAPS;

typedef struct mmtime_tag {
    UINT wType;
    union { DWORD ms; DWORD sample; DWORD cb; DWORD ticks; } u;
} MMTIME, *LPMMTIME;

/* --- MMIO (RIFF chunk) file services used by wave.cpp --- */
typedef DWORD FOURCC;
typedef char *HPSTR;            /* huge pointer to char (just char* on wasm) */
typedef LRESULT (CALLBACK *LPMMIOPROC)(LPSTR lpmmioinfo, UINT uMsg, LPARAM lParam1, LPARAM lParam2);

#ifndef mmioFOURCC
#define mmioFOURCC(c0, c1, c2, c3) MAKEFOURCC(c0, c1, c2, c3)
#endif
#ifndef FOURCC_RIFF
#define FOURCC_RIFF  mmioFOURCC('R', 'I', 'F', 'F')
#define FOURCC_LIST  mmioFOURCC('L', 'I', 'S', 'T')
#endif

typedef struct _MMIOINFO {
    DWORD      dwFlags;
    FOURCC     fccIOProc;
    LPMMIOPROC pIOProc;
    UINT       wErrorRet;
    HANDLE     htask;
    LONG       cchBuffer;
    HPSTR      pchBuffer;
    HPSTR      pchNext;
    HPSTR      pchEndRead;
    HPSTR      pchEndWrite;
    LONG       lBufOffset;
    LONG       lDiskOffset;
    DWORD      adwInfo[3];
    DWORD      dwReserved1, dwReserved2;
    HMMIO      hmmio;
} MMIOINFO, *LPMMIOINFO, *PMMIOINFO;

typedef struct _MMCKINFO {
    FOURCC ckid;
    DWORD  cksize;
    FOURCC fccType;
    DWORD  dwDataOffset;
    DWORD  dwFlags;
} MMCKINFO, *LPMMCKINFO;

/* mmioOpen / mmioDescend / mmioAscend dwFlags */
#ifndef MMIO_READ
#define MMIO_READ        0x00000000
#define MMIO_WRITE       0x00000001
#define MMIO_READWRITE   0x00000002
#define MMIO_CREATE      0x00001000
#define MMIO_ALLOCBUF    0x00010000
#define MMIO_CREATERIFF  0x00000020
#define MMIO_FINDCHUNK   0x00000010
#define MMIO_FINDRIFF    0x00000020
#define MMIO_FINDLIST    0x00000040
#define MMIO_DIRTY       0x10000000
#endif

#ifdef __cplusplus
extern "C" {
#endif
HMMIO mmioOpenA(LPSTR pszFileName, LPMMIOINFO pmmioinfo, DWORD fdwOpen);
MMRESULT mmioClose(HMMIO hmmio, UINT fuClose);
LONG   mmioRead(HMMIO hmmio, HPSTR pch, LONG cch);
LONG   mmioWrite(HMMIO hmmio, const char *pch, LONG cch);
LONG   mmioSeek(HMMIO hmmio, LONG lOffset, int iOrigin);
MMRESULT mmioGetInfo(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT fuInfo);
MMRESULT mmioSetInfo(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT fuInfo);
MMRESULT mmioAdvance(HMMIO hmmio, LPMMIOINFO pmmioinfo, UINT fuAdvance);
MMRESULT mmioDescend(HMMIO hmmio, LPMMCKINFO pmmcki, const MMCKINFO *pmmckiParent, UINT fuDescend);
MMRESULT mmioAscend(HMMIO hmmio, LPMMCKINFO pmmcki, UINT fuAscend);
MMRESULT mmioCreateChunk(HMMIO hmmio, LPMMCKINFO pmmcki, UINT fuCreate);
#ifdef __cplusplus
}
#endif
#ifndef mmioOpen
#define mmioOpen mmioOpenA
#endif

/* sndPlaySound / PlaySound flags */
#define SND_SYNC        0x0000
#define SND_ASYNC       0x0001
#define SND_NODEFAULT   0x0002
#define SND_MEMORY      0x0004
#define SND_LOOP        0x0008
#define SND_NOSTOP      0x0010
#define SND_FILENAME    0x00020000
#define SND_RESOURCE    0x00040004

/* --- multimedia timer (the only hot one for phase 0) --- */
DWORD    timeGetTime(void);
MMRESULT timeBeginPeriod(UINT uPeriod);
MMRESULT timeEndPeriod(UINT uPeriod);
MMRESULT timeGetDevCaps(LPTIMECAPS ptc, UINT cbtc);

/* --- simple sound playback --- */
BOOL sndPlaySoundA(LPCSTR pszSound, UINT fuSound);
BOOL PlaySoundA(LPCSTR pszSound, HMODULE hmod, DWORD fdwSound);
#define sndPlaySound sndPlaySoundA
#define PlaySound    PlaySoundA

/* --- MCI string interface --- */
MCIERROR mciSendStringA(LPCSTR cmd, LPSTR ret, UINT cchReturn, HWND hwndCallback);
BOOL     mciGetErrorStringA(MCIERROR mcierr, LPSTR pszText, UINT cchText);
#define mciSendString     mciSendStringA
#define mciGetErrorString mciGetErrorStringA

/* WAVE_MAPPER: the "let the system pick a device" pseudo-id (speak.cpp selects it
 * for the SAPI audio output). */
#ifndef WAVE_MAPPER
#define WAVE_MAPPER  ((UINT)-1)
#endif

/* --- waveform output (declared for completeness; rarely called) --- */
MMRESULT waveOutGetNumDevs(void);
MMRESULT waveOutOpen(HWAVEOUT *phwo, UINT uDeviceID, LPWAVEFORMATEX pwfx,
                     DWORD_PTR dwCallback, DWORD_PTR dwInstance, DWORD fdwOpen);
MMRESULT waveOutClose(HWAVEOUT hwo);
MMRESULT waveOutWrite(HWAVEOUT hwo, LPWAVEHDR pwh, UINT cbwh);

#endif /* _MMSYSTEM_SHIM_H_ */
