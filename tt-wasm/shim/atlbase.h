/* Minimal ATL shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * stdafx.h does `#include <atlbase.h>` + `#include <atlcom.h>` + `using
 * namespace ATL;`. ATL itself is enormous and Windows-only, but ToonTalk barely
 * uses it (only xml.cpp / dragdrop.h reference CComPtr/CComBSTR, and neither is
 * in the phase-0 target set). So this header just establishes the COM
 * foundation and a couple of smart-pointer stubs inside namespace ATL. Grow only
 * if a compiled TU actually needs an ATL symbol. */
#ifndef _ATLBASE_SHIM_H_
#define _ATLBASE_SHIM_H_

#include <objbase.h>
#include <msxml.h>   /* the IXMLDOM* family ToonTalk's defs.h typedefs */

namespace ATL {

/* CComPtr<T>: ref-counted COM smart pointer. Only the surface ToonTalk uses. */
template <class T>
class CComPtr {
public:
    T *p;
    CComPtr() : p(0) {}
    CComPtr(T *lp) : p(lp) {}
    ~CComPtr() {}
    operator T *() const { return p; }
    T *operator->() const { return p; }
    T **operator&() { return &p; }
    T *operator=(T *lp) { p = lp; return p; }
    bool operator!() const { return p == 0; }
    void Release() {}
};

/* CComBSTR: owning BSTR wrapper. */
class CComBSTR {
public:
    BSTR m_str;
    CComBSTR() : m_str(0) {}
    CComBSTR(const OLECHAR *psz) : m_str(0) {}
    ~CComBSTR() {}
    operator BSTR() const { return m_str; }
    BSTR *operator&() { return &m_str; }
};

/* CComVariant: owning VARIANT wrapper. xml.cpp builds these from scalars and
 * strings to pass as DOM attribute values (setAttribute takes a VARIANT). */
#ifndef VT_EMPTY
#define VT_EMPTY 0
#define VT_NULL  1
#define VT_I2    2
#define VT_I4    3
#define VT_R4    4
#define VT_R8    5
#define VT_BSTR  8
#define VT_BOOL  11
#define VT_I8    20
#endif
class CComVariant : public VARIANT {
public:
    CComVariant()                 { vt = VT_EMPTY; }
    CComVariant(int v)            { vt = VT_I4;  lVal = v; }
    CComVariant(long v)           { vt = VT_I4;  lVal = v; }
    CComVariant(short v)          { vt = VT_I2;  iVal = v; }
    CComVariant(double v)         { vt = VT_R8;  dblVal = v; }
    CComVariant(float v)          { vt = VT_R4;  fltVal = v; }
    CComVariant(long long v)      { vt = VT_I8;  lVal = (long) v; }
    CComVariant(const char *)     { vt = VT_BSTR; bstrVal = 0; }
    CComVariant(const wchar_t *)  { vt = VT_BSTR; bstrVal = 0; }
    CComVariant(const VARIANT &v) { *(VARIANT *)this = v; }
    ~CComVariant() {}
    HRESULT Clear() { vt = VT_EMPTY; return S_OK; }
};

/* CComModule: the global _Module object stdafx-style code declares. */
class CComModule {
public:
    HRESULT Init(void *, HINSTANCE, const GUID * = 0) { return S_OK; }
    void Term() {}
};

/* CSimpleArray<T>: ATL's tiny dynamic array (atlsimpcoll.h). dragdrop.h stores
 * its accepted FORMATETCs in one. Minimal growing-vector implementation. */
template <class T>
class CSimpleArray {
public:
    T   *m_aT;
    int  m_nSize, m_nAllocSize;
    CSimpleArray() : m_aT(0), m_nSize(0), m_nAllocSize(0) {}
    ~CSimpleArray() { delete[] m_aT; }
    int GetSize() const { return m_nSize; }
    BOOL Add(const T &t) {
        if (m_nSize == m_nAllocSize) {
            int n = m_nAllocSize == 0 ? 4 : m_nAllocSize * 2;
            T *p = new T[n];
            for (int i = 0; i < m_nSize; ++i) p[i] = m_aT[i];
            delete[] m_aT; m_aT = p; m_nAllocSize = n;
        }
        m_aT[m_nSize++] = t;
        return TRUE;
    }
    T &operator[](int n) { return m_aT[n]; }
    const T &operator[](int n) const { return m_aT[n]; }
    T *GetData() const { return m_aT; }
    void RemoveAll() { m_nSize = 0; }
};

} /* namespace ATL */

/* ToonTalk's dragdrop.h uses CSimpleArray unqualified and is included without an
 * active `using namespace ATL` in several TUs (only stdafx.h opens that
 * namespace). Hoist the name to global scope so the header parses everywhere. */
using ATL::CSimpleArray;

/* MSVC COM-support smart wrappers (normally <comutil.h>/<comdef.h>, pulled in by
 * #import). xml.cpp builds a _bstr_t from an error BSTR and a _variant_t from a
 * file-path string to hand to IXMLDOMDocument::save(VARIANT). Global scope (that
 * is where the real types live). Minimal: only the ctors/conversions used. */
#ifndef _BSTR_T_DEFINED
#define _BSTR_T_DEFINED
class _bstr_t {
public:
    BSTR m_str;
    _bstr_t() : m_str(0) {}
    _bstr_t(BSTR s) : m_str(s) {}
    _bstr_t(const char *) : m_str(0) {}
    _bstr_t(const wchar_t *) : m_str(0) {}
    ~_bstr_t() {}
    operator const wchar_t *() const { return (const wchar_t *) m_str; }
    operator BSTR() const { return m_str; }
    /* _bstr_t also yields a narrow copy in MSVC (operator char*); xml.cpp casts
     * (char*)bstrErr to log the parse-error text. The real narrow conversion is a
     * code-page translation done in phase 1; for compile-only just reinterpret
     * the handle (callers only NULL-check + stream it). */
    operator char *() const { return (char *) m_str; }
    operator const char *() const { return (const char *) m_str; }
};
#endif
#ifndef _VARIANT_T_DEFINED
#define _VARIANT_T_DEFINED
class _variant_t : public VARIANT {
public:
    _variant_t()                 { vt = VT_EMPTY; }
    _variant_t(const VARIANT &v) { *(VARIANT *)this = v; }
    _variant_t(int v)            { vt = VT_I4;   lVal = v; }
    _variant_t(long v)           { vt = VT_I4;   lVal = v; }
    _variant_t(bool v)           { vt = VT_BOOL; boolVal = v ? -1 : 0; }
    _variant_t(double v)         { vt = VT_R8;   dblVal = v; }
    _variant_t(const char *)     { vt = VT_BSTR; bstrVal = 0; }
    _variant_t(const wchar_t *)  { vt = VT_BSTR; bstrVal = 0; }
    ~_variant_t() {}
};
#endif

#endif /* _ATLBASE_SHIM_H_ */
