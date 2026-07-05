/* ifc.h -- Immersion "FoundationClasses" (IFC) shim for the ToonTalk WASM port.
 *
 * This is a STUB for the proprietary third-party Immersion TouchSense C++ SDK
 * header (CImmMouse / CImmProject / CImmCompoundEffect / CImmSimpleEffect),
 * which is not redistributable and not present in the source tree. input.cpp's
 * touch-sensitive-mouse force-feedback path drives these classes.
 *
 * Phase-0 contract: declarations only so the input layer COMPILES. The member
 * bodies are unresolved externals -- the whole force-feedback feature is
 * non-core (mouse/keyboard/joystick reading does not depend on it) and is not
 * wired up on the web. The classes are concrete (input.cpp does `new CImmMouse`)
 * with declared-but-undefined methods, so no behaviour is implied here.
 *
 * Signatures reconstructed from the call sites in src/input.cpp. */
#ifndef _IFC_SHIM_H_
#define _IFC_SHIM_H_

#include <windows.h>

#ifndef __DINPUT_INCLUDED__
#include <dinput.h>
#endif

/* "don't change this parameter" sentinels passed to ChangeBaseParamsPolar. */
#ifndef IMM_EFFECT_DONT_CHANGE
#define IMM_EFFECT_DONT_CHANGE      ((DWORD)0x7FFFFFFF)
#define IMM_EFFECT_DONT_CHANGE_PTR  ((void *)-1)
#endif

/* IFC envelope (opaque; only the pointer type LPIMM_ENVELOPE is referenced). */
struct IMM_ENVELOPE;
typedef struct IMM_ENVELOPE *LPIMM_ENVELOPE;

/* A single force-feedback effect within a compound effect. */
class CImmSimpleEffect {
public:
    CImmSimpleEffect();
    virtual ~CImmSimpleEffect();
    BOOL ChangeBaseParamsPolar(LONG lDirection, DWORD dwDuration, LPIMM_ENVELOPE lpEnvelope,
                               LONG lOffset, DWORD dwGain, DWORD dwAttackTime,
                               DWORD dwFadeTime, DWORD dwReserved);
    BOOL GetDirection(long &value);
    BOOL GetDuration(DWORD &value);
    BOOL GetGain(DWORD &value);
};
typedef CImmSimpleEffect *GENERIC_EFFECT_PTR;

/* A named, possibly multi-component effect created from a project. */
class CImmCompoundEffect {
public:
    CImmCompoundEffect();
    virtual ~CImmCompoundEffect();
    HRESULT Start();
    HRESULT Stop();
    long GetNumberOfContainedEffects();
    GENERIC_EFFECT_PTR GetContainedEffect(long index);
    HRESULT GetEffectGuid(GUID *pguid);
};

/* The touch-sensitive mouse device object. */
class CImmMouse {
public:
    CImmMouse();
    virtual ~CImmMouse();
    BOOL Initialize(HINSTANCE hInstance, HWND hWnd);
    void UsesWin32MouseServices(BOOL bUse);
};

/* A loaded ".ifr" effects project. */
class CImmProject {
public:
    CImmProject();
    virtual ~CImmProject();
    BOOL OpenFile(LPCSTR pFileName, CImmMouse *pDevice);
    CImmCompoundEffect *CreateEffect(LPCSTR pName, CImmMouse *pDevice);
};

#endif /* _IFC_SHIM_H_ */
