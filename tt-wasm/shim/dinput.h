/* DirectInput shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * defs.h includes <dinput.h> under TT_DIRECT_INPUT. The phase-0 target TUs don't
 * touch DirectInput; only input.h/input.cpp (joystick + force feedback) do, and
 * input.h references just DIJOYSTATE and LPDIRECTINPUTEFFECT. We provide the
 * core opaque interfaces + the joystick state struct so the whole project's
 * input layer can compile later. Implemented via the Gamepad API in phase 1. */
#ifndef _DINPUT_SHIM_H_
#define _DINPUT_SHIM_H_

#include <windows.h>
#include <objbase.h>

#ifndef DIRECTINPUT_VERSION
#define DIRECTINPUT_VERSION 0x0700
#endif

/* IFORCE2.h (Immersion) #errors out unless this is defined -- the real dinput.h
 * sets it to advertise that the DirectInput structures are available. */
#ifndef __DINPUT_INCLUDED__
#define __DINPUT_INCLUDED__
#endif

/* common HRESULT-ish returns */
#define DI_OK                0
#define S_OK_DI              0
#define DI_NOTATTACHED       0x00000001
#define DI_BUFFEROVERFLOW    0x00000001
#define DI_PROPNOEFFECT      0x00000001
#define DI_NOEFFECT          0x00000001
#define DI_POLLEDDEVICE      0x00000002
#define DI_DOWNLOADSKIPPED   0x00000003
#define DI_EFFECTRESTARTED   0x00000004
#define DI_TRUNCATED         0x00000008
#define DI_TRUNCATEDANDRESTARTED 0x0000000C
/* These FACILITY_WIN32 HRESULTs have the high bit set (> LONG_MAX). They are
 * compared against / used as `case` labels on an HRESULT (== long), so spell
 * them as (HRESULT) casts to avoid -Wc++11-narrowing on the switch labels. */
#define DIERR_INPUTLOST      ((HRESULT)0x8007001EL)
#define DIERR_NOTACQUIRED    ((HRESULT)0x8007000CL)
#define DIERR_UNSUPPORTED    ((HRESULT)0x80004001L)
#define DIERR_INVALIDPARAM   ((HRESULT)0x80070057L)
#define DIERR_NOTINITIALIZED ((HRESULT)0x80070015L)
#define DIERR_ACQUIRED       ((HRESULT)0x8007000CL)
#define DIERR_MOREDATA       ((HRESULT)0x800700EAL)
#define DIERR_EFFECTPLAYING  ((HRESULT)0x80070016L)
#define DIERR_INCOMPLETEEFFECT ((HRESULT)0x80070019L)
#define DIERR_DEVICENOTREG   ((HRESULT)0x80040154L)

/* SetCooperativeLevel flags */
#define DISCL_EXCLUSIVE      0x00000001
#define DISCL_NONEXCLUSIVE   0x00000002
#define DISCL_FOREGROUND     0x00000004
#define DISCL_BACKGROUND     0x00000008

/* device-type bytes + enum flags */
#define DIDEVTYPE_MOUSE      2
#define DIDEVTYPE_KEYBOARD   3
#define DIDEVTYPE_JOYSTICK   4
#define DIEDFL_ALLDEVICES    0x00000000
#define DIEDFL_ATTACHEDONLY  0x00000001
#define DIEDFL_FORCEFEEDBACK 0x00000100
#define DIENUM_STOP          0
#define DIENUM_CONTINUE      1

/* DIDEVCAPS.dwFlags bits referenced */
#define DIDC_FORCEFEEDBACK   0x00000100

/* effect flags (DIEFFECT.dwFlags) */
#define DIEFF_OBJECTIDS      0x00000001
#define DIEFF_OBJECTOFFSETS  0x00000002
#define DIEFF_CARTESIAN      0x00000010
#define DIEFF_POLAR          0x00000020
#define DIEFF_SPHERICAL      0x00000040

/* effect-parameter selector flags (GetParameters/SetParameters dwFlags) */
#define DIEP_DURATION            0x00000001
#define DIEP_SAMPLEPERIOD        0x00000002
#define DIEP_GAIN                0x00000004
#define DIEP_TRIGGERBUTTON       0x00000008
#define DIEP_TRIGGERREPEATINTERVAL 0x00000010
#define DIEP_AXES                0x00000020
#define DIEP_DIRECTION           0x00000040
#define DIEP_ENVELOPE            0x00000080
#define DIEP_TYPESPECIFICPARAMS  0x00000100
#define DIEP_NODOWNLOAD          0x80000000
#define DIEP_ALLPARAMS           0x000001FF

/* effect "type" bits + accessor macro (DIEFFECTINFO.dwEffType). */
#define DIEFT_ALL            0x00000000
#define DIEFT_CONSTANTFORCE  1
#define DIEFT_RAMPFORCE      2
#define DIEFT_PERIODIC       3
#define DIEFT_CONDITION      4
#define DIEFT_CUSTOMFORCE    5
#define DIEFT_HARDWARE       6
#define DIEFT_GETTYPE(n)     ((BYTE)(n))

/* Start() flags + trigger sentinel + nominal scale + time unit. */
#define DIES_SOLO            0x00000001
#define DIES_NODOWNLOAD      0x80000000
#define DIEB_NOTRIGGER       0xFFFFFFFF
#define DIEB_NOTRIGGER_      0xFFFFFFFF
#define DI_FFNOMINALMAX      10000
#define DI_SECONDS           1000000
#define DI_DEGREES           100
#define INFINITE_DI          0xFFFFFFFF

/* property-header "how"/object addressing. */
#define DIPH_DEVICE          0
#define DIPH_BYOFFSET        1
#define DIPH_BYID            2
#define DIPH_BYUSAGE         3

/* autocenter property data values */
#define DIPROPAUTOCENTER_OFF 0
#define DIPROPAUTOCENTER_ON  1

/* DIMOUSESTATE / DIJOYSTATE field byte-offsets (DIJOFS_*). */
#define DIJOFS_X        0
#define DIJOFS_Y        4
#define DIJOFS_Z        8
#define DIJOFS_RX       12
#define DIJOFS_RY       16
#define DIJOFS_RZ       20
#define DIJOFS_BUTTON(n) (offsetof(DIJOYSTATE, rgbButtons) + (n))
#define DIJOFS_BUTTON0  (DIJOFS_BUTTON(0))

/* DIPROP_* property GUIDs. The real headers make these MAKEDIPROP(n) casts to a
 * const GUID*; SetProperty/GetProperty below take a const GUID* to match. */
#define MAKEDIPROP(n)   ((const GUID *)(ULONG_PTR)(n))
#define DIPROP_BUFFERSIZE   MAKEDIPROP(1)
#define DIPROP_AXISMODE     MAKEDIPROP(2)
#define DIPROP_RANGE        MAKEDIPROP(4)
#define DIPROP_DEADZONE     MAKEDIPROP(5)
#define DIPROP_SATURATION   MAKEDIPROP(6)
#define DIPROP_FFGAIN       MAKEDIPROP(7)
#define DIPROP_AUTOCENTER   MAKEDIPROP(8)

/* joystick state (DInput "c_dfDIJoystick" layout) */
typedef struct DIJOYSTATE {
    LONG  lX, lY, lZ;
    LONG  lRx, lRy, lRz;
    LONG  rglSlider[2];
    DWORD rgdwPOV[4];
    BYTE  rgbButtons[32];
} DIJOYSTATE, *LPDIJOYSTATE;

typedef struct DIJOYSTATE2 {
    LONG  lX, lY, lZ, lRx, lRy, lRz;
    LONG  rglSlider[2];
    DWORD rgdwPOV[4];
    BYTE  rgbButtons[128];
    LONG  lVX, lVY, lVZ, lVRx, lVRy, lVRz;
    LONG  rglVSlider[2];
    LONG  lAX, lAY, lAZ, lARx, lARy, lARz;
    LONG  rglASlider[2];
    LONG  lFX, lFY, lFZ, lFRx, lFRy, lFRz;
    LONG  rglFSlider[2];
} DIJOYSTATE2, *LPDIJOYSTATE2;

typedef struct DIDEVCAPS {
    DWORD dwSize, dwFlags, dwDevType;
    DWORD dwAxes, dwButtons, dwPOVs;
    DWORD dwFFSamplePeriod, dwFFMinTimeResolution;
    DWORD dwFirmwareRevision, dwHardwareRevision, dwFFDriverVersion;
} DIDEVCAPS, *LPDIDEVCAPS;

/* mouse state (DInput "c_dfDIMouse" layout) */
typedef struct DIMOUSESTATE {
    LONG lX, lY, lZ;
    BYTE rgbButtons[4];
} DIMOUSESTATE, *LPDIMOUSESTATE;

/* --- device-property structures --- */
typedef struct DIPROPHEADER {
    DWORD dwSize, dwHeaderSize, dwObj, dwHow;
} DIPROPHEADER, *LPDIPROPHEADER;
typedef const DIPROPHEADER *LPCDIPROPHEADER;

typedef struct DIPROPDWORD {
    DIPROPHEADER diph;
    DWORD        dwData;
} DIPROPDWORD, *LPDIPROPDWORD;

typedef struct DIPROPRANGE {
    DIPROPHEADER diph;
    LONG         lMin, lMax;
} DIPROPRANGE, *LPDIPROPRANGE;

/* --- force-feedback effect structures --- */
typedef struct DIENVELOPE {
    DWORD dwSize;
    DWORD dwAttackLevel, dwAttackTime;
    DWORD dwFadeLevel, dwFadeTime;
} DIENVELOPE, *LPDIENVELOPE;

typedef struct DICONSTANTFORCE {
    LONG lMagnitude;
} DICONSTANTFORCE, *LPDICONSTANTFORCE;

typedef struct DIRAMPFORCE {
    LONG lStart, lEnd;
} DIRAMPFORCE, *LPDIRAMPFORCE;

typedef struct DIPERIODIC {
    DWORD dwMagnitude;
    LONG  lOffset;
    DWORD dwPhase;
    DWORD dwPeriod;
} DIPERIODIC, *LPDIPERIODIC;

typedef struct DICONDITION {
    LONG  lOffset;
    LONG  lPositiveCoefficient, lNegativeCoefficient;
    DWORD dwPositiveSaturation, dwNegativeSaturation;
    LONG  lDeadBand;
} DICONDITION, *LPDICONDITION;

typedef struct DICUSTOMFORCE {
    DWORD cChannels, dwSamplePeriod, cSamples;
    LONG *rglForceData;
} DICUSTOMFORCE, *LPDICUSTOMFORCE;

typedef struct DIEFFECT {
    DWORD  dwSize;
    DWORD  dwFlags;
    DWORD  dwDuration;
    DWORD  dwSamplePeriod;
    DWORD  dwGain;
    DWORD  dwTriggerButton;
    DWORD  dwTriggerRepeatInterval;
    DWORD  cAxes;
    LPDWORD rgdwAxes;
    LPLONG  rglDirection;
    LPDIENVELOPE lpEnvelope;
    DWORD  cbTypeSpecificParams;
    LPVOID lpvTypeSpecificParams;
    DWORD  dwStartDelay;
} DIEFFECT, *LPDIEFFECT;
typedef const DIEFFECT *LPCDIEFFECT;

typedef struct DIEFFECTINFOA {
    DWORD dwSize;
    GUID  guid;
    DWORD dwEffType;
    DWORD dwStaticParams, dwDynamicParams;
    CHAR  tszName[MAX_PATH];
} DIEFFECTINFOA, *LPDIEFFECTINFOA;
typedef DIEFFECTINFOA DIEFFECTINFO, *LPDIEFFECTINFO;

typedef struct DIDEVICEINSTANCEA {
    DWORD dwSize;
    GUID  guidInstance, guidProduct;
    DWORD dwDevType;
    CHAR  tszInstanceName[MAX_PATH];
    CHAR  tszProductName[MAX_PATH];
    GUID  guidFFDriver;
    WORD  wUsagePage, wUsage;
} DIDEVICEINSTANCEA, *LPDIDEVICEINSTANCEA;
typedef DIDEVICEINSTANCEA DIDEVICEINSTANCE, *LPDIDEVICEINSTANCE;
typedef const DIDEVICEINSTANCEA *LPCDIDEVICEINSTANCEA, *LPCDIDEVICEINSTANCE;

typedef struct DIDEVICEOBJECTINSTANCEA {
    DWORD dwSize;
    GUID  guidType;
    DWORD dwOfs, dwType, dwFlags;
    CHAR  tszName[MAX_PATH];
} DIDEVICEOBJECTINSTANCEA, *LPDIDEVICEOBJECTINSTANCEA;

/* device data format (c_dfDIJoystick / c_dfDIMouse are exported by dinput.lib). */
typedef struct DIOBJECTDATAFORMAT { const GUID *pguid; DWORD dwOfs, dwType, dwFlags; } DIOBJECTDATAFORMAT, *LPDIOBJECTDATAFORMAT;
typedef struct DIDATAFORMAT {
    DWORD dwSize, dwObjSize, dwFlags, dwDataSize, dwNumObjs;
    LPDIOBJECTDATAFORMAT rgodf;
} DIDATAFORMAT, *LPDIDATAFORMAT;
extern const DIDATAFORMAT c_dfDIMouse;
extern const DIDATAFORMAT c_dfDIJoystick;
extern const DIDATAFORMAT c_dfDIJoystick2;

/* enumeration callback prototypes */
typedef BOOL (CALLBACK *LPDIENUMDEVICESCALLBACKA)(const DIDEVICEINSTANCEA *, LPVOID);
typedef BOOL (CALLBACK *LPDIENUMEFFECTSCALLBACKA)(const DIEFFECTINFOA *, LPVOID);
typedef BOOL (CALLBACK *LPDIENUMDEVICEOBJECTSCALLBACKA)(const DIDEVICEOBJECTINSTANCEA *, LPVOID);
typedef LPDIENUMEFFECTSCALLBACKA LPDIENUMEFFECTSCALLBACK;
typedef LPDIENUMDEVICESCALLBACKA LPDIENUMDEVICESCALLBACK;

/* --- opaque interfaces --- */
struct IDirectInputEffect;
typedef struct IDirectInputEffect *LPDIRECTINPUTEFFECT;
struct IDirectInputEffect : public IUnknown {
    virtual HRESULT GetEffectGuid(GUID *pguid) = 0;
    virtual HRESULT GetParameters(LPDIEFFECT peff, DWORD dwFlags) = 0;
    virtual HRESULT SetParameters(LPCDIEFFECT peff, DWORD dwFlags) = 0;
    virtual HRESULT Start(DWORD dwIterations, DWORD dwFlags) = 0;
    virtual HRESULT Stop() = 0;
    virtual HRESULT Download() = 0;
    virtual HRESULT Unload() = 0;
};

struct IDirectInputDevice2A;
typedef struct IDirectInputDevice2A *LPDIRECTINPUTDEVICE2A;
typedef struct IDirectInputDevice2A *LPDIRECTINPUTDEVICE;
struct IDirectInputDevice2A : public IUnknown {
    virtual HRESULT Acquire() = 0;
    virtual HRESULT Unacquire() = 0;
    virtual HRESULT GetDeviceState(DWORD cbData, LPVOID lpvData) = 0;
    virtual HRESULT SetDataFormat(const DIDATAFORMAT *lpdf) = 0;
    virtual HRESULT SetCooperativeLevel(HWND hwnd, DWORD dwFlags) = 0;
    virtual HRESULT GetCapabilities(LPDIDEVCAPS lpDIDevCaps) = 0;
    virtual HRESULT SetProperty(const GUID *rguidProp, LPCDIPROPHEADER pdiph) = 0;
    virtual HRESULT GetProperty(const GUID *rguidProp, LPDIPROPHEADER pdiph) = 0;
    virtual HRESULT EnumObjects(LPDIENUMDEVICEOBJECTSCALLBACKA cb, LPVOID pvRef, DWORD dwFlags) = 0;
    virtual HRESULT CreateEffect(REFGUID rguid, LPCDIEFFECT lpeff, LPDIRECTINPUTEFFECT *ppdeff, IUnknown *punkOuter) = 0;
    virtual HRESULT EnumEffects(LPDIENUMEFFECTSCALLBACKA cb, LPVOID pvRef, DWORD dwEffType) = 0;
    virtual HRESULT GetEffectInfo(LPDIEFFECTINFOA pdei, REFGUID rguid) = 0;
    virtual HRESULT Poll() = 0;
};

struct IDirectInputA;
typedef struct IDirectInputA *LPDIRECTINPUTA;
typedef struct IDirectInputA *LPDIRECTINPUT;
struct IDirectInputA : public IUnknown {
    virtual HRESULT CreateDevice(REFGUID rguid, LPDIRECTINPUTDEVICE *lplpDirectInputDevice, IUnknown *pUnkOuter) = 0;
    virtual HRESULT EnumDevices(DWORD dwDevType, LPDIENUMDEVICESCALLBACKA lpCallback, LPVOID pvRef, DWORD dwFlags) = 0;
};

HRESULT DirectInputCreateA(HINSTANCE hinst, DWORD dwVersion, LPDIRECTINPUT *lplpDirectInput, IUnknown *punkOuter);
#define DirectInputCreate DirectInputCreateA

#endif /* _DINPUT_SHIM_H_ */
