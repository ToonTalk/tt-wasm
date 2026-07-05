/* DirectPlay shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * defs.h includes <dplay.h> under TT_DIRECT_PLAY. bird.h (in the phase-0
 * closure) references DPID and LPDIRECTPLAY4A for ToonTalk's networked "nests".
 * We declare the opaque interface + player-id type. The real networking is a
 * phase-1 concern (WebSocket/WebRTC); for now these only need to type-check. */
#ifndef _DPLAY_SHIM_H_
#define _DPLAY_SHIM_H_

#include <windows.h>
#include <objbase.h>

typedef DWORD DPID, *LPDPID;

#define DPID_SYSMSG      0
#define DPID_ALLPLAYERS  0
#define DPID_SERVERPLAYER 1

/* Session / name descriptors (opaque-ish; fields rarely poked). */
typedef struct {
    DWORD dwSize, dwFlags;
    GUID  guidInstance, guidApplication;
    DWORD dwMaxPlayers, dwCurrentPlayers;
    union { LPWSTR lpszSessionName; LPSTR lpszSessionNameA; };
    union { LPWSTR lpszPassword;    LPSTR lpszPasswordA;    };
    DWORD_PTR dwReserved1, dwReserved2;
    DWORD_PTR dwUser1, dwUser2, dwUser3, dwUser4;
} DPSESSIONDESC2, *LPDPSESSIONDESC2;

typedef struct {
    DWORD dwSize, dwFlags;
    union { LPWSTR lpszShortName; LPSTR lpszShortNameA; };
    union { LPWSTR lpszLongName;  LPSTR lpszLongNameA;  };
} DPNAME, *LPDPNAME;

/* --- opaque interface (IDirectPlay4A is what bird.h pins to) --- */
struct IDirectPlay4A;
typedef struct IDirectPlay4A *LPDIRECTPLAY4A;
typedef struct IDirectPlay4A *LPDIRECTPLAY4;
typedef struct IDirectPlay4A *LPDIRECTPLAY;

struct IDirectPlay4A : public IUnknown {
    virtual HRESULT CreatePlayer(LPDPID lpidPlayer, LPDPNAME lpPlayerName, HANDLE hEvent, LPVOID lpData, DWORD dwDataSize, DWORD dwFlags) = 0;
    virtual HRESULT DestroyPlayer(DPID idPlayer) = 0;
    virtual HRESULT Send(DPID idFrom, DPID idTo, DWORD dwFlags, LPVOID lpData, DWORD dwDataSize) = 0;
    virtual HRESULT Receive(LPDPID lpidFrom, LPDPID lpidTo, DWORD dwFlags, LPVOID lpData, LPDWORD lpdwDataSize) = 0;
    virtual HRESULT GetPlayerName(DPID idPlayer, LPVOID lpData, LPDWORD lpdwDataSize) = 0;
    virtual HRESULT Close() = 0;
};

HRESULT DirectPlayCreate(GUID *lpGUID, LPDIRECTPLAY *lplpDP, IUnknown *pUnk);

#endif /* _DPLAY_SHIM_H_ */
