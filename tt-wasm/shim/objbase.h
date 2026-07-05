/* COM foundation shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * The real build gets IUnknown/BSTR/VARIANT/HRESULT etc. from the Win32 SDK
 * (objbase.h, oaidl.h, wtypes.h) pulled in transitively by <atlbase.h> and the
 * #import of msxml4.dll. None of that exists under emcc, so this header supplies
 * just enough of the COM ABI for the ToonTalk headers to type-check. No bodies —
 * the COM free functions are unresolved externals (fine for phase 0). */
#ifndef _OBJBASE_SHIM_H_
#define _OBJBASE_SHIM_H_

#include <windows.h>   /* HRESULT, DWORD, GUID, BYTE, ... */
#include <wchar.h>     /* wchar_t helpers */

/* --- wide/auto string + variant scalar types --- */
typedef wchar_t WCHAR, OLECHAR;
typedef WCHAR *BSTR, *LPOLESTR, *PWCHAR, *PWSTR_OLE;
typedef const WCHAR *LPCOLESTR;
typedef short VARIANT_BOOL;
typedef double DATE;
typedef long DISPID;
typedef unsigned short VARTYPE;
#ifndef VARIANT_TRUE
#define VARIANT_TRUE  ((VARIANT_BOOL)-1)
#define VARIANT_FALSE ((VARIANT_BOOL)0)
#endif

/* HRESULT helpers the code uses for success/failure checks. */
#ifndef S_OK
#define S_OK    ((HRESULT)0L)
#define S_FALSE ((HRESULT)1L)
#define E_FAIL  ((HRESULT)0x80004005L)
#define E_NOINTERFACE ((HRESULT)0x80004002L)
#define E_OUTOFMEMORY ((HRESULT)0x8007000EL)
#define E_INVALIDARG  ((HRESULT)0x80070057L)
#define E_POINTER     ((HRESULT)0x80004003L)
#define E_NOTIMPL     ((HRESULT)0x80004001L)
#endif
#ifndef SUCCEEDED
#define SUCCEEDED(hr) (((HRESULT)(hr)) >= 0)
#define FAILED(hr)    (((HRESULT)(hr)) < 0)
#endif

/* HRESULT/SCODE construction (winerror.h). speech.h builds the SAPI TTSERR_* /
 * SRERR_* codes via MAKE_SCODE(SEVERITY_ERROR, FACILITY_SPEECH, x). */
#ifndef MAKE_HRESULT
#define SEVERITY_SUCCESS  0
#define SEVERITY_ERROR    1
#define FACILITY_NULL     0
#define FACILITY_RPC      1
#define FACILITY_ITF      4
#define FACILITY_WIN32    7
#define FACILITY_WINDOWS  8
#define MAKE_HRESULT(sev, fac, code) \
    ((HRESULT)(((unsigned long)(sev) << 31) | ((unsigned long)(fac) << 16) | ((unsigned long)(code))))
#define MAKE_SCODE(sev, fac, code)   MAKE_HRESULT(sev, fac, code)
#define HRESULT_CODE(hr)     ((hr) & 0xFFFF)
#define HRESULT_FACILITY(hr) (((hr) >> 16) & 0x1fff)
#define HRESULT_SEVERITY(hr) (((hr) >> 31) & 0x1)
#endif

/* COM calling-convention macros are no-ops on wasm. */
#define STDMETHODCALLTYPE
#define STDMETHODIMP        HRESULT
#define STDMETHODIMP_(t)    t
#define STDMETHOD(m)        virtual HRESULT m
#define STDMETHOD_(t, m)    virtual t m
#define PURE                = 0
#define THIS_
#define THIS
#define DECLARE_INTERFACE(i)            struct i
#define DECLARE_INTERFACE_(i, base)     struct i : public base
#ifndef interface
#define interface struct
#endif

/* The IID/REFIID machinery already lives in windows.h (GUID, REFIID...). */
typedef GUID IID_t;

/* --- IUnknown: root of every COM interface --- */
struct IUnknown {
    virtual HRESULT QueryInterface(REFIID riid, void **ppv) = 0;
    virtual ULONG   AddRef() = 0;
    virtual ULONG   Release() = 0;
};
typedef IUnknown *LPUNKNOWN;

/* --- OLE structured-storage interfaces (opaque; SAPI speech.h references the
 *     pointer types in serialize/register method signatures) --- */
struct IStream;
struct IStorage;
typedef IStream  *LPSTREAM;
typedef IStorage *LPSTORAGE;

/* --- VARIANT (only the members ToonTalk touches; opaque-ish union) --- */
struct tagVARIANT {
    VARTYPE vt;
    WORD wReserved1, wReserved2, wReserved3;
    union {
        long          lVal;
        int           intVal;
        BYTE          bVal;
        short         iVal;
        float         fltVal;
        double        dblVal;
        VARIANT_BOOL  boolVal;
        HRESULT       scode;
        BSTR          bstrVal;
        IUnknown     *punkVal;
        void         *byref;
    };
};
typedef struct tagVARIANT VARIANT, VARIANTARG, *LPVARIANT;

/* VARENUM variant-type tags (clickme.cpp / common.cpp / xml.cpp switch on vt).
 * Subset of the wtypes.h enum. */
#ifndef VT_EMPTY
#define VT_EMPTY    0
#define VT_NULL     1
#define VT_I2       2
#define VT_I4       3
#define VT_R4       4
#define VT_R8       5
#define VT_BSTR     8
#define VT_DISPATCH 9
#define VT_ERROR    10
#define VT_BOOL     11
#define VT_VARIANT  12
#define VT_UNKNOWN  13
#define VT_I1       16
#define VT_UI1      17
#define VT_UI2      18
#define VT_UI4      19
#define VT_I8       20
#define VT_UI8      21
#define VT_INT      22
#define VT_UINT     23
#endif

/* --- IDispatch (base of the IXMLDOM* automation interfaces) --- */
struct IDispatch : public IUnknown {
    virtual HRESULT GetTypeInfoCount(UINT *pctinfo) = 0;
    virtual HRESULT GetTypeInfo(UINT it, LCID lcid, void **ppti) = 0;
    virtual HRESULT GetIDsOfNames(REFIID riid, LPOLESTR *names, UINT c, LCID lcid, DISPID *ids) = 0;
    virtual HRESULT Invoke(DISPID id, REFIID riid, LCID lcid, WORD flags,
                           void *params, VARIANT *result, void *exc, UINT *err) = 0;
};

/* --- COM free functions (bodies linked later / unresolved in phase 0) --- */
typedef enum tagCLSCTX { CLSCTX_INPROC_SERVER = 1, CLSCTX_INPROC_HANDLER = 2,
                         CLSCTX_LOCAL_SERVER = 4, CLSCTX_ALL = 23 } CLSCTX;

HRESULT CoInitialize(LPVOID pvReserved);
HRESULT CoInitializeEx(LPVOID pvReserved, DWORD dwCoInit);
void    CoUninitialize(void);
HRESULT CoCreateInstance(REFCLSID rclsid, LPUNKNOWN pUnkOuter, DWORD dwClsContext,
                         REFIID riid, LPVOID *ppv);

/* BSTR allocation helpers. */
BSTR    SysAllocString(const OLECHAR *psz);
BSTR    SysAllocStringLen(const OLECHAR *psz, UINT len);
void    SysFreeString(BSTR bstr);
UINT    SysStringLen(BSTR bstr);
UINT    SysStringByteLen(BSTR bstr); /* xml.cpp measures a returned BSTR in bytes */

/* VARIANT helpers. */
void    VariantInit(VARIANTARG *pvarg);
HRESULT VariantClear(VARIANTARG *pvarg);

/* ---------------------------------------------------------------------------
 * OLE uniform-data-transfer / drag-drop (normally <objidl.h> + <ole2.h>, pulled
 * in transitively by <shlobj.h>). dragdrop.h subclasses IDropTarget. Opaque /
 * minimal -- compile-only; bodies unresolved in phase 0 (HTML5 drag-drop later).
 * ------------------------------------------------------------------------- */
typedef WORD CLIPFORMAT;

typedef struct tagDVTARGETDEVICE {
    DWORD tdSize;
    WORD  tdDriverNameOffset, tdDeviceNameOffset, tdPortNameOffset, tdExtDevmodeOffset;
    BYTE  tdData[1];
} DVTARGETDEVICE;

typedef struct tagFORMATETC {
    CLIPFORMAT      cfFormat;
    DVTARGETDEVICE *ptd;
    DWORD           dwAspect;
    LONG            lindex;
    DWORD           tymed;
} FORMATETC, *LPFORMATETC;

typedef struct tagSTGMEDIUM {
    DWORD tymed;
    union {
        HBITMAP        hBitmap;
        void          *hMetaFilePict;
        void          *hEnhMetaFile;
        HGLOBAL        hGlobal;
        LPOLESTR       lpszFileName;
        IStream       *pstm;
        IStorage      *pstg;
    };  /* anonymous: dragdrop.cpp accesses medium.hGlobal directly */
    IUnknown *pUnkForRelease;
} STGMEDIUM, *LPSTGMEDIUM;

/* STGM_* storage access modes (IPersistFile::Load in utils.cpp). */
#ifndef STGM_READ
#define STGM_READ          0x00000000L
#define STGM_WRITE         0x00000001L
#define STGM_READWRITE     0x00000002L
#define STGM_SHARE_DENY_NONE  0x00000040L
#define STGM_SHARE_EXCLUSIVE  0x00000010L
#define STGM_CREATE        0x00001000L
#endif

/* TYMED storage-medium flags + DVASPECT. */
#ifndef TYMED_HGLOBAL
#define TYMED_HGLOBAL   1
#define TYMED_FILE      2
#define TYMED_ISTREAM   4
#define TYMED_ISTORAGE  8
#define TYMED_NULL      0
#endif
#ifndef DVASPECT_CONTENT
#define DVASPECT_CONTENT   1
#define DVASPECT_THUMBNAIL 2
#define DVASPECT_ICON      4
#define DVASPECT_DOCPRINT  8
#endif
/* DROPEFFECT_* (DragEnter/Drop pdwEffect). */
#ifndef DROPEFFECT_NONE
#define DROPEFFECT_NONE   0
#define DROPEFFECT_COPY   1
#define DROPEFFECT_MOVE   2
#define DROPEFFECT_LINK   4
#define DROPEFFECT_SCROLL 0x80000000
#endif

struct IEnumFORMATETC;

struct IDataObject : public IUnknown {
    virtual HRESULT GetData(FORMATETC *pformatetcIn, STGMEDIUM *pmedium) = 0;
    virtual HRESULT GetDataHere(FORMATETC *pformatetc, STGMEDIUM *pmedium) = 0;
    virtual HRESULT QueryGetData(FORMATETC *pformatetc) = 0;
    virtual HRESULT GetCanonicalFormatEtc(FORMATETC *pformatectIn, FORMATETC *pformatetcOut) = 0;
    virtual HRESULT SetData(FORMATETC *pformatetc, STGMEDIUM *pmedium, BOOL fRelease) = 0;
    virtual HRESULT EnumFormatEtc(DWORD dwDirection, IEnumFORMATETC **ppenumFormatEtc) = 0;
    virtual HRESULT DAdvise(FORMATETC *pformatetc, DWORD advf, void *pAdvSink, DWORD *pdwConnection) = 0;
    virtual HRESULT DUnadvise(DWORD dwConnection) = 0;
    virtual HRESULT EnumDAdvise(void **ppenumAdvise) = 0;
};

struct IDropTarget : public IUnknown {
    virtual HRESULT DragEnter(IDataObject *pDataObj, DWORD grfKeyState, POINTL pt, DWORD *pdwEffect) = 0;
    virtual HRESULT DragOver(DWORD grfKeyState, POINTL pt, DWORD *pdwEffect) = 0;
    virtual HRESULT DragLeave(void) = 0;
    virtual HRESULT Drop(IDataObject *pDataObj, DWORD grfKeyState, POINTL pt, DWORD *pdwEffect) = 0;
};

struct IDropSource : public IUnknown {
    virtual HRESULT QueryContinueDrag(BOOL fEscapePressed, DWORD grfKeyState) = 0;
    virtual HRESULT GiveFeedback(DWORD dwEffect) = 0;
};

/* OLE drag-drop free functions + registration (ole32.dll). */
HRESULT RegisterDragDrop(HWND hwnd, IDropTarget *pDropTarget);
HRESULT RevokeDragDrop(HWND hwnd);
HRESULT OleInitialize(LPVOID pvReserved);
void    OleUninitialize(void);
HRESULT DoDragDrop(IDataObject *pDataObj, IDropSource *pDropSource, DWORD dwOKEffects, DWORD *pdwEffect);
void    ReleaseStgMedium(LPSTGMEDIUM pmedium); /* dragdrop.cpp frees the dropped medium */

/* clipboard format registration (drag-drop queries CF_HDROP etc.). */
UINT RegisterClipboardFormatA(LPCSTR lpszFormat);
#ifndef RegisterClipboardFormat
#define RegisterClipboardFormat RegisterClipboardFormatA
#endif
#ifndef CF_TEXT
#define CF_TEXT  1
#define CF_BITMAP 2
#define CF_HDROP 15
#endif

/* ---------------------------------------------------------------------------
 * Interface IDs / class IDs the ToonTalk COM call sites reference by name
 * (CoCreateInstance / QueryInterface / RegisterDragDrop). In the SDK each is an
 * `extern const GUID` defined in a *_i.c / *guid.lib that the #import or
 * uuid.lib supplies. Compile-only here: declare them all; they remain
 * unresolved externals at phase-0 link. Grouped by the header that "owns" them
 * but declared here so every COM TU sees them regardless of include order.
 * ------------------------------------------------------------------------- */
#ifdef __cplusplus
extern "C" {
#endif
/* core COM */
extern const GUID IID_IUnknown;
extern const GUID IID_IDispatch;
extern const GUID IID_IClassFactory;
extern const GUID IID_IDataObject;
extern const GUID IID_IDropTarget;
extern const GUID IID_IDropSource;
/* OLE drag-drop helper (shell) */
extern const GUID CLSID_DragDropHelper;
extern const GUID IID_IDropTargetHelper;
/* DirectInput */
extern const GUID IID_IDirectInputDevice2;
extern const GUID IID_IDirectInputDevice2A;
extern const GUID GUID_SysMouse;
extern const GUID GUID_SysKeyboard;
extern const GUID GUID_Joystick;
extern const GUID GUID_XAxis, GUID_YAxis, GUID_ZAxis;
extern const GUID GUID_RxAxis, GUID_RyAxis, GUID_RzAxis;
extern const GUID GUID_Slider, GUID_Button, GUID_POV;
extern const GUID GUID_ConstantForce, GUID_RampForce, GUID_Square, GUID_Sine,
                  GUID_Triangle, GUID_SawtoothUp, GUID_SawtoothDown, GUID_Spring,
                  GUID_Damper, GUID_Inertia, GUID_Friction, GUID_CustomForce;
/* DirectSound */
extern const GUID IID_IDirectSound;
extern const GUID IID_IDirectSoundBuffer;
extern const GUID IID_IDirectSound3DBuffer;
extern const GUID IID_IDirectSound3DListener;
/* DirectDraw */
extern const GUID IID_IDirectDraw2;
extern const GUID IID_IDirectDraw7;
extern const GUID IID_IDirectDrawSurface;
extern const GUID IID_IDirectDrawSurface2;
/* DirectX transform / surface (picture effects, optional) */
extern const GUID CLSID_DXTransformFactory;
extern const GUID CLSID_DXTransformFactoryDirect;
extern const GUID IID_IDXSurface;
extern const GUID IID_IDXSurfaceFactory;
/* DirectShow audio (speak.cpp text-to-speech output) */
extern const GUID CLSID_AudioDestDirect;
extern const GUID CLSID_MMAudioDest;
extern const GUID IID_IAudioDirect;
extern const GUID IID_IAudioMultiMediaDevice;
/* Microsoft SAPI4 text-to-speech */
extern const GUID CLSID_TTSEnumerator;
extern const GUID IID_ITTSAttributes;
extern const GUID IID_ITTSBufNotifySink;
extern const GUID IID_ITTSBufNotifySinkW;
extern const GUID IID_ITTSEnumW;
extern const GUID IID_ITTSFindW;
extern const GUID IID_ITTSNotifySink;
extern const GUID IID_ITTSNotifySinkW;
/* MSXML legacy parse-error interface */
extern const GUID IID_IXMLError;
#ifdef __cplusplus
}
#endif

#endif /* _OBJBASE_SHIM_H_ */
