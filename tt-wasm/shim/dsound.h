/* DirectSound shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * IMPORTANT: this header deliberately SHADOWS the uppercase source/DSOUND.H
 * (which pulls in <d3dtypes.h> and the full DX5 sound ABI). It is on the
 * -I shim path, which precedes -I source, so `#include <dsound.h>` resolves
 * here. We declare the DirectSound interfaces as opaque COM objects with only
 * the member functions ToonTalk actually calls (Lock/Unlock/Play/Stop/...), so
 * sound_buffer->Method(...) type-checks. Implemented by the Web Audio shim in
 * phase 1. */
#ifndef _DSOUND_SHIM_H_
#define _DSOUND_SHIM_H_

#include <windows.h>
#include <mmsystem.h>   /* WAVEFORMATEX, LPWAVEFORMATEX */
#include <objbase.h>    /* IUnknown, HRESULT, S_OK */

/* --- error / status / capability constants --- */
/* High-bit-set HRESULTs spelled as (HRESULT) casts: winmain.cpp / utils.cpp use
 * them as `case` labels on an HRESULT (== long), which otherwise warns/errors
 * under -Wc++11-narrowing because the bare hex literal is unsigned > LONG_MAX. */
#define DS_OK                  ((HRESULT)0L)
#define DSERR_ALLOCATED        ((HRESULT)0x8878000AL)
#define DSERR_INVALIDPARAM     ((HRESULT)0x80070057L)
#define DSERR_OUTOFMEMORY      ((HRESULT)0x8007000EL)
#define DSERR_UNSUPPORTED      ((HRESULT)0x80004001L)
#define DSERR_NODRIVER         ((HRESULT)0x88780078L)
#define DSERR_BUFFERLOST       ((HRESULT)0x88780096L)
#define DSERR_PRIOLEVELNEEDED  ((HRESULT)0x88780046L)
#define DSERR_INVALIDCALL      ((HRESULT)0x88780032L)
#define DSERR_UNINITIALIZED    ((HRESULT)0x887800AAL)
#define DSERR_NOAGGREGATION    ((HRESULT)0x80040110L)
#define DSERR_BADFORMAT        ((HRESULT)0x88780064L)

#define DSSCL_NORMAL       1
#define DSSCL_PRIORITY     2
#define DSSCL_EXCLUSIVE    3
#define DSSCL_WRITEPRIMARY 4

#define DSBCAPS_PRIMARYBUFFER  0x00000001
#define DSBCAPS_STATIC         0x00000002
#define DSBCAPS_LOCHARDWARE    0x00000004
#define DSBCAPS_LOCSOFTWARE    0x00000008
#define DSBCAPS_CTRLFREQUENCY  0x00000020
#define DSBCAPS_CTRLPAN        0x00000040
#define DSBCAPS_CTRLVOLUME     0x00000080
#define DSBCAPS_CTRLDEFAULT    0x000000E0
#define DSBCAPS_CTRLALL        0x000001E0
#define DSBCAPS_STICKYFOCUS    0x00004000
#define DSBCAPS_GLOBALFOCUS    0x00008000

#define DSBPLAY_LOOPING        0x00000001
#define DSBPLAY_TOEND          0x00000000

#define DSBSTATUS_PLAYING      0x00000001
#define DSBSTATUS_BUFFERLOST   0x00000002
#define DSBSTATUS_LOOPING      0x00000004

#define DSBLOCK_FROMWRITECURSOR 0x00000001
#define DSBLOCK_ENTIREBUFFER    0x00000002

#define DSBVOLUME_MIN  (-10000)
#define DSBVOLUME_MAX  0
#define DSBPAN_LEFT    (-10000)
#define DSBPAN_CENTER  0
#define DSBPAN_RIGHT   10000

/* --- descriptor / caps structs --- */
typedef struct _DSBUFFERDESC {
    DWORD          dwSize;
    DWORD          dwFlags;
    DWORD          dwBufferBytes;
    DWORD          dwReserved;
    LPWAVEFORMATEX lpwfxFormat;
} DSBUFFERDESC, *LPDSBUFFERDESC;
typedef const DSBUFFERDESC *LPCDSBUFFERDESC;

typedef struct _DSBCAPS {
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwBufferBytes;
    DWORD dwUnlockTransferRate;
    DWORD dwPlayCpuOverhead;
} DSBCAPS, *LPDSBCAPS;

typedef struct _DSCAPS {
    DWORD dwSize;
    DWORD dwFlags;
    DWORD dwMinSecondarySampleRate;
    DWORD dwMaxSecondarySampleRate;
    DWORD dwPrimaryBuffers;
} DSCAPS, *LPDSCAPS;

/* --- interfaces (opaque; only the methods ToonTalk calls) --- */
struct IDirectSoundBuffer;
typedef struct IDirectSoundBuffer *LPDIRECTSOUNDBUFFER;

struct IDirectSoundBuffer : public IUnknown {
    virtual HRESULT GetCaps(LPDSBCAPS pDSBufferCaps) = 0;
    virtual HRESULT GetCurrentPosition(LPDWORD pdwCurrentPlayCursor, LPDWORD pdwCurrentWriteCursor) = 0;
    virtual HRESULT GetFormat(LPWAVEFORMATEX pwfx, DWORD dwSizeAllocated, LPDWORD pdwSizeWritten) = 0;
    virtual HRESULT GetVolume(LPLONG plVolume) = 0;
    virtual HRESULT GetPan(LPLONG plPan) = 0;
    virtual HRESULT GetFrequency(LPDWORD pdwFrequency) = 0;
    virtual HRESULT GetStatus(LPDWORD pdwStatus) = 0;
    virtual HRESULT Initialize(struct IDirectSound *pDirectSound, LPCDSBUFFERDESC pcDSBufferDesc) = 0;
    virtual HRESULT Lock(DWORD dwOffset, DWORD dwBytes,
                         LPVOID *ppvAudioPtr1, LPDWORD pdwAudioBytes1,
                         LPVOID *ppvAudioPtr2, LPDWORD pdwAudioBytes2, DWORD dwFlags) = 0;
    virtual HRESULT Play(DWORD dwReserved1, DWORD dwPriority, DWORD dwFlags) = 0;
    virtual HRESULT SetCurrentPosition(DWORD dwNewPosition) = 0;
    virtual HRESULT SetFormat(LPWAVEFORMATEX pcfxFormat) = 0;
    virtual HRESULT SetVolume(LONG lVolume) = 0;
    virtual HRESULT SetPan(LONG lPan) = 0;
    virtual HRESULT SetFrequency(DWORD dwFrequency) = 0;
    virtual HRESULT Stop() = 0;
    virtual HRESULT Unlock(LPVOID pvAudioPtr1, DWORD dwAudioBytes1,
                           LPVOID pvAudioPtr2, DWORD dwAudioBytes2) = 0;
    virtual HRESULT Restore() = 0;
};

struct IDirectSound;
typedef struct IDirectSound *LPDIRECTSOUND;

struct IDirectSound : public IUnknown {
    virtual HRESULT CreateSoundBuffer(LPCDSBUFFERDESC pcDSBufferDesc,
                                      LPDIRECTSOUNDBUFFER *ppDSBuffer, IUnknown *pUnkOuter) = 0;
    virtual HRESULT GetCaps(LPDSCAPS pDSCaps) = 0;
    virtual HRESULT DuplicateSoundBuffer(LPDIRECTSOUNDBUFFER pDSBufferOriginal,
                                         LPDIRECTSOUNDBUFFER *ppDSBufferDuplicate) = 0;
    virtual HRESULT SetCooperativeLevel(HWND hwnd, DWORD dwLevel) = 0;
    virtual HRESULT Compact() = 0;
    virtual HRESULT Initialize(const GUID *pcGuidDevice) = 0;
};

/* DirectSoundCreate: classic creation entry point. */
HRESULT DirectSoundCreate(const GUID *pcGuidDevice, LPDIRECTSOUND *ppDS, IUnknown *pUnkOuter);

/* C-style COM-helper macros (the SDK defines these for C callers; dsutil.cpp
 * was written against them, e.g. IDirectSound_CreateSoundBuffer(p,...)). They
 * forward straight to the C++ method, which is identical on this ABI. */
#define IDirectSound_CreateSoundBuffer(p, a, b, c)    ((p)->CreateSoundBuffer((a), (b), (c)))
#define IDirectSound_GetCaps(p, a)                    ((p)->GetCaps(a))
#define IDirectSound_DuplicateSoundBuffer(p, a, b)    ((p)->DuplicateSoundBuffer((a), (b)))
#define IDirectSound_SetCooperativeLevel(p, a, b)     ((p)->SetCooperativeLevel((a), (b)))
#define IDirectSound_Compact(p)                       ((p)->Compact())
#define IDirectSound_Initialize(p, a)                 ((p)->Initialize(a))
#define IDirectSound_AddRef(p)                        ((p)->AddRef())
#define IDirectSound_Release(p)                       ((p)->Release())

#define IDirectSoundBuffer_GetCaps(p, a)              ((p)->GetCaps(a))
#define IDirectSoundBuffer_GetCurrentPosition(p, a, b) ((p)->GetCurrentPosition((a), (b)))
#define IDirectSoundBuffer_GetStatus(p, a)            ((p)->GetStatus(a))
#define IDirectSoundBuffer_Lock(p, a, b, c, d, e, f, g) ((p)->Lock((a), (b), (c), (d), (e), (f), (g)))
#define IDirectSoundBuffer_Play(p, a, b, c)           ((p)->Play((a), (b), (c)))
#define IDirectSoundBuffer_SetCurrentPosition(p, a)   ((p)->SetCurrentPosition(a))
#define IDirectSoundBuffer_SetFormat(p, a)            ((p)->SetFormat(a))
#define IDirectSoundBuffer_SetVolume(p, a)            ((p)->SetVolume(a))
#define IDirectSoundBuffer_SetPan(p, a)               ((p)->SetPan(a))
#define IDirectSoundBuffer_SetFrequency(p, a)         ((p)->SetFrequency(a))
#define IDirectSoundBuffer_Stop(p)                    ((p)->Stop())
#define IDirectSoundBuffer_Unlock(p, a, b, c, d)      ((p)->Unlock((a), (b), (c), (d)))
#define IDirectSoundBuffer_Restore(p)                 ((p)->Restore())
#define IDirectSoundBuffer_AddRef(p)                  ((p)->AddRef())
#define IDirectSoundBuffer_Release(p)                 ((p)->Release())

#endif /* _DSOUND_SHIM_H_ */
