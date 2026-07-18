/* msxml_impl.cpp — a self-contained DOM backing the MSXML IXMLDOM* COM interfaces
 * for the ToonTalk WASM port. defs.h typedefs xml_document/xml_node/xml_element to
 * these interfaces and xml.cpp (3900 lines, untouched) calls their methods directly.
 * We implement the interfaces over a small wchar_t DOM + parser, plus the BSTR/VARIANT
 * helpers and CoCreateInstance(CLSID_DOMDocument) the engine uses to mint documents.
 *
 * Scope: the READ path is complete (loadXML/parse, traversal, attributes, text, get_xml).
 * The write path (createElement/appendChild/setAttribute) is implemented too so saving can
 * follow; save-to-file and XPath (selectNodes) are minimal stubs for now.
 *
 * Ownership: the document owns every node (allNodes) and frees them on Release==0. Node
 * AddRef/Release never self-delete (nodes live with their doc). NodeList/NamedNodeMap/
 * ParseError are independently allocated and self-delete on Release==0. */
#include "windows.h"
#include "objbase.h"
#include "msxml.h"
#include <string>
#include <vector>
#include <cstdlib>
#include <cstring>

#ifndef S_OK
#define S_OK 0
#endif
#ifndef S_FALSE
#define S_FALSE 1
#endif
#ifndef E_FAIL
#define E_FAIL ((HRESULT)0x80004005L)
#endif
#ifndef E_NOTIMPL
#define E_NOTIMPL ((HRESULT)0x80004001L)
#endif
#ifndef VARIANT_TRUE
#define VARIANT_TRUE ((VARIANT_BOOL)-1)
#endif
#ifndef VARIANT_FALSE
#define VARIANT_FALSE ((VARIANT_BOOL)0)
#endif

using std::wstring;
using std::vector;

/* ------------------------------------------------------------------ BSTR / VARIANT */
/* BSTR layout: [UINT byteLen][wchars...][L'\0']; the BSTR points at the wchars. */
BSTR SysAllocStringLen(const OLECHAR *psz, UINT len) {
    UINT bytes = len * (UINT)sizeof(OLECHAR);
    unsigned char *raw = (unsigned char *)malloc(sizeof(UINT) + bytes + sizeof(OLECHAR));
    if (!raw) return NULL;
    *(UINT *)raw = bytes;
    OLECHAR *str = (OLECHAR *)(raw + sizeof(UINT));
    if (psz) memcpy(str, psz, bytes); else memset(str, 0, bytes);
    str[len] = 0;
    return str;
}
BSTR SysAllocString(const OLECHAR *psz) {
    if (!psz) return NULL;
    UINT n = 0; while (psz[n]) n++;
    return SysAllocStringLen(psz, n);
}
void SysFreeString(BSTR b) { if (b) free((unsigned char *)b - sizeof(UINT)); }
UINT SysStringLen(BSTR b) { return b ? (*(UINT *)((unsigned char *)b - sizeof(UINT))) / (UINT)sizeof(OLECHAR) : 0; }
UINT SysStringByteLen(BSTR b) { return b ? *(UINT *)((unsigned char *)b - sizeof(UINT)) : 0; }
void VariantInit(VARIANTARG *v) { if (v) { v->vt = VT_EMPTY; v->bstrVal = NULL; } }
HRESULT VariantClear(VARIANTARG *v) {
    if (v) { if (v->vt == VT_BSTR && v->bstrVal) SysFreeString(v->bstrVal); v->vt = VT_EMPTY; v->bstrVal = NULL; }
    return S_OK;
}
static BSTR bstr_of(const wstring &s) { return SysAllocStringLen(s.c_str(), (UINT)s.size()); }

/* ------------------------------------------------------------------ DOM node */
struct DomDocument;

struct DomNode : public IXMLDOMElement {
    DOMNodeType kind;
    wstring name;                 // tag / "#text" / "#comment" / attribute name
    wstring text;                 // value for text/cdata/comment/attribute nodes
    vector<DomNode *> kids;       // child nodes, document order (elements + text + ...)
    vector<DomNode *> attrs;      // attribute nodes (kind==NODE_ATTRIBUTE)
    DomNode *parent;
    DomDocument *owner;
    ULONG rc;

    DomNode(DOMNodeType k, DomDocument *d) : kind(k), parent(NULL), owner(d), rc(1) {}
    virtual ~DomNode() {}

    int index_in_parent();
    void gather_text(wstring &out);
    void serialize(wstring &out);
    DomNode *find_attr(const wstring &nm);

    /* IUnknown */
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = (IXMLDOMElement *)this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { return rc ? --rc : 0; }   /* doc owns nodes; never self-delete */
    /* IDispatch (unused by the engine) */
    HRESULT GetTypeInfoCount(UINT *) { return E_NOTIMPL; }
    HRESULT GetTypeInfo(UINT, LCID, void **) { return E_NOTIMPL; }
    HRESULT GetIDsOfNames(REFIID, LPOLESTR *, UINT, LCID, DISPID *) { return E_NOTIMPL; }
    HRESULT Invoke(DISPID, REFIID, LCID, WORD, void *, VARIANT *, void *, UINT *) { return E_NOTIMPL; }
    /* IXMLDOMNode */
    HRESULT get_nodeName(BSTR *n) { *n = bstr_of(name); return S_OK; }
    HRESULT get_nodeValue(VARIANT *v);
    HRESULT put_nodeValue(VARIANT v);
    HRESULT get_nodeType(DOMNodeType *t) { *t = kind; return S_OK; }
    HRESULT get_parentNode(IXMLDOMNode **p) { *p = parent; if (parent) parent->AddRef(); return parent ? S_OK : S_FALSE; }
    HRESULT get_childNodes(IXMLDOMNodeList **list);
    HRESULT get_firstChild(IXMLDOMNode **c);
    HRESULT get_lastChild(IXMLDOMNode **c);
    HRESULT get_previousSibling(IXMLDOMNode **c);
    HRESULT get_nextSibling(IXMLDOMNode **c);
    HRESULT get_attributes(IXMLDOMNamedNodeMap **m);
    HRESULT insertBefore(IXMLDOMNode *, VARIANT, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT replaceChild(IXMLDOMNode *, IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT removeChild(IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT appendChild(IXMLDOMNode *newChild, IXMLDOMNode **out);
    HRESULT hasChildNodes(VARIANT_BOOL *b) { *b = kids.empty() ? VARIANT_FALSE : VARIANT_TRUE; return S_OK; }
    HRESULT get_ownerDocument(IXMLDOMDocument **d);
    HRESULT cloneNode(VARIANT_BOOL deep, IXMLDOMNode **out);
    HRESULT get_text(BSTR *t) { wstring s; gather_text(s); *t = bstr_of(s); return S_OK; }
    HRESULT put_text(BSTR t) { text = t ? wstring(t) : wstring(); return S_OK; }
    HRESULT get_xml(BSTR *x) { wstring s; serialize(s); *x = bstr_of(s); return S_OK; }
    HRESULT selectSingleNode(BSTR, IXMLDOMNode **r) { *r = NULL; return S_FALSE; }
    HRESULT selectNodes(BSTR, IXMLDOMNodeList **r);
    HRESULT get_nodeTypedValue(VARIANT *v) { return get_nodeValue(v); }
    /* IXMLDOMElement */
    HRESULT get_tagName(BSTR *t) { *t = bstr_of(name); return S_OK; }
    HRESULT getAttribute(BSTR nm, VARIANT *val);
    HRESULT setAttribute(BSTR nm, VARIANT val);
    HRESULT removeAttribute(BSTR nm);
    HRESULT getAttributeNode(BSTR, IXMLDOMNode **a) { *a = NULL; return S_FALSE; }
    HRESULT setAttributeNode(IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT getElementsByTagName(BSTR tagName, IXMLDOMNodeList **resultList);
    HRESULT normalize() { return S_OK; }
};

/* --------------------------------------------------------------- collections */
struct DomNodeList : public IXMLDOMNodeList {
    vector<DomNode *> items; size_t iter; ULONG rc;
    DomNodeList() : iter(0), rc(1) {}
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = (IXMLDOMNodeList *)this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }
    HRESULT GetTypeInfoCount(UINT *) { return E_NOTIMPL; }
    HRESULT GetTypeInfo(UINT, LCID, void **) { return E_NOTIMPL; }
    HRESULT GetIDsOfNames(REFIID, LPOLESTR *, UINT, LCID, DISPID *) { return E_NOTIMPL; }
    HRESULT Invoke(DISPID, REFIID, LCID, WORD, void *, VARIANT *, void *, UINT *) { return E_NOTIMPL; }
    HRESULT get_item(long i, IXMLDOMNode **n) { if (i < 0 || (size_t)i >= items.size()) { *n = NULL; return S_FALSE; } *n = items[i]; items[i]->AddRef(); return S_OK; }
    HRESULT get_length(long *n) { *n = (long)items.size(); return S_OK; }
    HRESULT nextNode(IXMLDOMNode **n) { if (iter >= items.size()) { *n = NULL; return S_FALSE; } *n = items[iter]; items[iter]->AddRef(); iter++; return S_OK; }
    HRESULT reset() { iter = 0; return S_OK; }
};

struct DomNamedNodeMap : public IXMLDOMNamedNodeMap {
    vector<DomNode *> items; size_t iter; ULONG rc;
    DomNamedNodeMap() : iter(0), rc(1) {}
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = (IXMLDOMNamedNodeMap *)this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }
    HRESULT GetTypeInfoCount(UINT *) { return E_NOTIMPL; }
    HRESULT GetTypeInfo(UINT, LCID, void **) { return E_NOTIMPL; }
    HRESULT GetIDsOfNames(REFIID, LPOLESTR *, UINT, LCID, DISPID *) { return E_NOTIMPL; }
    HRESULT Invoke(DISPID, REFIID, LCID, WORD, void *, VARIANT *, void *, UINT *) { return E_NOTIMPL; }
    HRESULT getNamedItem(BSTR nm, IXMLDOMNode **n) {
        wstring want = nm ? wstring(nm) : wstring();
        for (size_t i = 0; i < items.size(); i++) if (items[i]->name == want) { *n = items[i]; items[i]->AddRef(); return S_OK; }
        *n = NULL; return S_FALSE;
    }
    HRESULT setNamedItem(IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT removeNamedItem(BSTR, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT get_item(long i, IXMLDOMNode **n) { if (i < 0 || (size_t)i >= items.size()) { *n = NULL; return S_FALSE; } *n = items[i]; items[i]->AddRef(); return S_OK; }
    HRESULT get_length(long *n) { *n = (long)items.size(); return S_OK; }
    HRESULT nextNode(IXMLDOMNode **n) { if (iter >= items.size()) { *n = NULL; return S_FALSE; } *n = items[iter]; items[iter]->AddRef(); iter++; return S_OK; }
    HRESULT reset() { iter = 0; return S_OK; }
};

struct DomParseError : public IXMLDOMParseError {
    long code; ULONG rc;
    DomParseError() : code(0), rc(1) {}
    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = (IXMLDOMParseError *)this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() { if (rc && --rc == 0) { delete this; return 0; } return rc; }
    HRESULT GetTypeInfoCount(UINT *) { return E_NOTIMPL; }
    HRESULT GetTypeInfo(UINT, LCID, void **) { return E_NOTIMPL; }
    HRESULT GetIDsOfNames(REFIID, LPOLESTR *, UINT, LCID, DISPID *) { return E_NOTIMPL; }
    HRESULT Invoke(DISPID, REFIID, LCID, WORD, void *, VARIANT *, void *, UINT *) { return E_NOTIMPL; }
    HRESULT get_errorCode(long *e) { *e = code; return S_OK; }
    HRESULT get_url(BSTR *s) { *s = NULL; return S_OK; }
    HRESULT get_reason(BSTR *s) { *s = bstr_of(L""); return S_OK; }
    HRESULT get_srcText(BSTR *s) { *s = bstr_of(L""); return S_OK; }
    HRESULT get_line(long *n) { *n = 0; return S_OK; }
    HRESULT get_linepos(long *n) { *n = 0; return S_OK; }
    HRESULT get_filepos(long *n) { *n = 0; return S_OK; }
};

/* --------------------------------------------------------------- document */
struct DomDocument : public IXMLDOMDocument {
    DomNode *root;                 /* documentElement */
    vector<DomNode *> all;         /* every node ever minted, for teardown */
    DomParseError *err;
    ULONG rc;

    DomDocument() : root(NULL), rc(1) { err = new DomParseError(); }
    DomNode *mint(DOMNodeType k) { DomNode *n = new DomNode(k, this); all.push_back(n); return n; }

    HRESULT QueryInterface(REFIID, void **ppv) { *ppv = (IXMLDOMDocument *)this; AddRef(); return S_OK; }
    ULONG   AddRef() { return ++rc; }
    ULONG   Release() {
        if (rc && --rc == 0) {
            for (size_t i = 0; i < all.size(); i++) delete all[i];
            if (err) err->Release();
            delete this; return 0;
        }
        return rc;
    }
    HRESULT GetTypeInfoCount(UINT *) { return E_NOTIMPL; }
    HRESULT GetTypeInfo(UINT, LCID, void **) { return E_NOTIMPL; }
    HRESULT GetIDsOfNames(REFIID, LPOLESTR *, UINT, LCID, DISPID *) { return E_NOTIMPL; }
    HRESULT Invoke(DISPID, REFIID, LCID, WORD, void *, VARIANT *, void *, UINT *) { return E_NOTIMPL; }
    /* IXMLDOMNode face of the document */
    HRESULT get_nodeName(BSTR *n) { *n = bstr_of(L"#document"); return S_OK; }
    HRESULT get_nodeValue(VARIANT *v) { VariantInit(v); v->vt = VT_NULL; return S_FALSE; }
    HRESULT put_nodeValue(VARIANT) { return E_FAIL; }
    HRESULT get_nodeType(DOMNodeType *t) { *t = NODE_DOCUMENT; return S_OK; }
    HRESULT get_parentNode(IXMLDOMNode **p) { *p = NULL; return S_FALSE; }
    HRESULT get_childNodes(IXMLDOMNodeList **list) { DomNodeList *l = new DomNodeList(); if (root) l->items.push_back(root); *list = l; return S_OK; }
    HRESULT get_firstChild(IXMLDOMNode **c) { *c = root; if (root) root->AddRef(); return root ? S_OK : S_FALSE; }
    HRESULT get_lastChild(IXMLDOMNode **c) { *c = root; if (root) root->AddRef(); return root ? S_OK : S_FALSE; }
    HRESULT get_previousSibling(IXMLDOMNode **c) { *c = NULL; return S_FALSE; }
    HRESULT get_nextSibling(IXMLDOMNode **c) { *c = NULL; return S_FALSE; }
    HRESULT get_attributes(IXMLDOMNamedNodeMap **m) { *m = NULL; return S_FALSE; }
    HRESULT insertBefore(IXMLDOMNode *, VARIANT, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT replaceChild(IXMLDOMNode *, IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT removeChild(IXMLDOMNode *, IXMLDOMNode **) { return E_NOTIMPL; }
    HRESULT appendChild(IXMLDOMNode *newChild, IXMLDOMNode **out) {
        DomNode *n = (DomNode *)newChild; root = n; if (n) n->parent = NULL;
        if (out) { *out = newChild; if (newChild) newChild->AddRef(); }
        return S_OK;
    }
    HRESULT hasChildNodes(VARIANT_BOOL *b) { *b = root ? VARIANT_TRUE : VARIANT_FALSE; return S_OK; }
    HRESULT get_ownerDocument(IXMLDOMDocument **d) { *d = NULL; return S_FALSE; }
    HRESULT cloneNode(VARIANT_BOOL, IXMLDOMNode **out) { *out = NULL; return E_NOTIMPL; }
    HRESULT get_text(BSTR *t) { wstring s; if (root) root->gather_text(s); *t = bstr_of(s); return S_OK; }
    HRESULT put_text(BSTR) { return E_FAIL; }
    HRESULT get_xml(BSTR *x) { wstring s; if (root) root->serialize(s); *x = bstr_of(s); return S_OK; }
    HRESULT selectSingleNode(BSTR, IXMLDOMNode **r) { *r = NULL; return S_FALSE; }
    HRESULT selectNodes(BSTR q, IXMLDOMNodeList **r) { if (root) return root->selectNodes(q, r); DomNodeList *l = new DomNodeList(); *r = l; return S_FALSE; }
    HRESULT get_nodeTypedValue(VARIANT *v) { VariantInit(v); v->vt = VT_NULL; return S_FALSE; }
    /* IXMLDOMDocument */
    HRESULT get_documentElement(IXMLDOMElement **e) { *e = root; if (root) root->AddRef(); return root ? S_OK : S_FALSE; }
    HRESULT createElement(BSTR tag, IXMLDOMElement **e) { DomNode *n = mint(NODE_ELEMENT); if (tag) n->name = tag; *e = n; return S_OK; }
    HRESULT createDocumentFragment(IXMLDOMNode **f) { *f = mint(NODE_DOCUMENT_FRAGMENT); return S_OK; }
    HRESULT createTextNode(BSTR data, IXMLDOMText **t) { DomNode *n = mint(NODE_TEXT); n->name = L"#text"; if (data) n->text = data; *t = (IXMLDOMText *)n; return S_OK; }
    HRESULT createComment(BSTR data, IXMLDOMComment **c) { DomNode *n = mint(NODE_COMMENT); n->name = L"#comment"; if (data) n->text = data; *c = (IXMLDOMComment *)n; return S_OK; }
    HRESULT createCDATASection(BSTR data, IXMLDOMCDATASection **cd) { DomNode *n = mint(NODE_CDATA_SECTION); n->name = L"#cdata-section"; if (data) n->text = data; *cd = (IXMLDOMCDATASection *)n; return S_OK; }
    HRESULT createProcessingInstruction(BSTR target, BSTR data, IXMLDOMProcessingInstruction **pi) { DomNode *n = mint(NODE_PROCESSING_INSTRUCTION); if (target) n->name = target; if (data) n->text = data; *pi = (IXMLDOMProcessingInstruction *)n; return S_OK; }
    HRESULT createAttribute(BSTR nm, IXMLDOMAttribute **a) { DomNode *n = mint(NODE_ATTRIBUTE); if (nm) n->name = nm; *a = (IXMLDOMAttribute *)n; return S_OK; }
    HRESULT getElementsByTagName(BSTR tagName, IXMLDOMNodeList **resultList) { if (root) return root->getElementsByTagName(tagName, resultList); *resultList = new DomNodeList(); return S_OK; }
    HRESULT get_parseError(IXMLDOMParseError **e) { *e = err; if (err) err->AddRef(); return S_OK; }
    HRESULT load(VARIANT, VARIANT_BOOL *ok) { if (ok) *ok = VARIANT_FALSE; return S_FALSE; }
    HRESULT loadXML(BSTR xml, VARIANT_BOOL *ok);
    HRESULT save(VARIANT) { return S_OK; }
};

/* --------------------------------------------------------------- DomNode bodies needing DomDocument */
int DomNode::index_in_parent() {
    if (!parent) return -1;
    for (size_t i = 0; i < parent->kids.size(); i++) if (parent->kids[i] == this) return (int)i;
    return -1;
}
void DomNode::gather_text(wstring &out) {
    if (kind == NODE_TEXT || kind == NODE_CDATA_SECTION) out += text;
    for (size_t i = 0; i < kids.size(); i++) kids[i]->gather_text(out);
}
DomNode *DomNode::find_attr(const wstring &nm) {
    for (size_t i = 0; i < attrs.size(); i++) if (attrs[i]->name == nm) return attrs[i];
    return NULL;
}
static void append_escaped(wstring &out, const wstring &s) {
    for (size_t i = 0; i < s.size(); i++) {
        wchar_t c = s[i];
        if (c == L'&') out += L"&amp;"; else if (c == L'<') out += L"&lt;";
        else if (c == L'>') out += L"&gt;"; else if (c == L'"') out += L"&quot;";
        else out += c;
    }
}
void DomNode::serialize(wstring &out) {
    if (kind == NODE_TEXT) { append_escaped(out, text); return; }
    if (kind == NODE_CDATA_SECTION) { out += L"<![CDATA["; out += text; out += L"]]>"; return; }
    if (kind == NODE_COMMENT) { out += L"<!--"; out += text; out += L"-->"; return; }
    if (kind == NODE_ELEMENT) {
        out += L"<"; out += name;
        for (size_t i = 0; i < attrs.size(); i++) { out += L" "; out += attrs[i]->name; out += L"=\""; append_escaped(out, attrs[i]->text); out += L"\""; }
        if (kids.empty()) { out += L"/>"; return; }
        out += L">";
        for (size_t i = 0; i < kids.size(); i++) kids[i]->serialize(out);
        out += L"</"; out += name; out += L">";
        return;
    }
    for (size_t i = 0; i < kids.size(); i++) kids[i]->serialize(out);
}
HRESULT DomNode::get_nodeValue(VARIANT *v) {
    VariantInit(v);
    if (kind == NODE_TEXT || kind == NODE_CDATA_SECTION || kind == NODE_COMMENT || kind == NODE_ATTRIBUTE) {
        v->vt = VT_BSTR; v->bstrVal = bstr_of(text); return S_OK;
    }
    v->vt = VT_NULL; return S_FALSE;
}
HRESULT DomNode::put_nodeValue(VARIANT v) { if (v.vt == VT_BSTR && v.bstrVal) text = v.bstrVal; return S_OK; }
HRESULT DomNode::get_childNodes(IXMLDOMNodeList **list) { DomNodeList *l = new DomNodeList(); l->items = kids; *list = l; return S_OK; }
HRESULT DomNode::get_firstChild(IXMLDOMNode **c) { if (kids.empty()) { *c = NULL; return S_FALSE; } *c = kids[0]; kids[0]->AddRef(); return S_OK; }
HRESULT DomNode::get_lastChild(IXMLDOMNode **c) { if (kids.empty()) { *c = NULL; return S_FALSE; } *c = kids.back(); kids.back()->AddRef(); return S_OK; }
HRESULT DomNode::get_previousSibling(IXMLDOMNode **c) { int i = index_in_parent(); if (i <= 0) { *c = NULL; return S_FALSE; } *c = parent->kids[i - 1]; parent->kids[i - 1]->AddRef(); return S_OK; }
HRESULT DomNode::get_nextSibling(IXMLDOMNode **c) { int i = index_in_parent(); if (i < 0 || (size_t)(i + 1) >= parent->kids.size()) { *c = NULL; return S_FALSE; } *c = parent->kids[i + 1]; parent->kids[i + 1]->AddRef(); return S_OK; }
HRESULT DomNode::get_attributes(IXMLDOMNamedNodeMap **m) { DomNamedNodeMap *map = new DomNamedNodeMap(); map->items = attrs; *m = map; return S_OK; }
/* deep copy within the same document; attributes are always cloned fully (with their #text
 * value child), matching MSXML. The engine's save path relies on this: XMLPage::top_level_xml
 * does xml_node_to_element(xml_clone_node(XML)) and ignores the HRESULT — the old E_NOTIMPL
 * stub handed back NULL and the next QueryInterface trapped (Ken's take-a-robot-out freeze). */
static DomNode *tt_clone_node(DomNode *n, DomDocument *doc, bool deep) {
    DomNode *c = doc->mint(n->kind);
    c->name = n->name; c->text = n->text;
    for (size_t i = 0; i < n->attrs.size(); i++) { DomNode *a = tt_clone_node(n->attrs[i], doc, true); a->parent = c; c->attrs.push_back(a); }
    if (deep) for (size_t i = 0; i < n->kids.size(); i++) { DomNode *k = tt_clone_node(n->kids[i], doc, true); k->parent = c; c->kids.push_back(k); }
    return c;
}
HRESULT DomNode::cloneNode(VARIANT_BOOL deep, IXMLDOMNode **out) {
    *out = tt_clone_node(this, owner, deep == VARIANT_TRUE);
    return S_OK;
}
HRESULT DomNode::appendChild(IXMLDOMNode *newChild, IXMLDOMNode **out) {
    DomNode *n = (DomNode *)newChild; if (n) { n->parent = this; kids.push_back(n); }
    if (out) { *out = newChild; if (newChild) newChild->AddRef(); }
    return S_OK;
}
HRESULT DomNode::get_ownerDocument(IXMLDOMDocument **d) { *d = (IXMLDOMDocument *)owner; if (owner) owner->AddRef(); return S_OK; }
HRESULT DomNode::getAttribute(BSTR nm, VARIANT *val) {
    VariantInit(val);
    DomNode *a = find_attr(nm ? wstring(nm) : wstring());
    if (a) { val->vt = VT_BSTR; val->bstrVal = bstr_of(a->text); return S_OK; }
    val->vt = VT_NULL; return S_FALSE;
}
HRESULT DomNode::setAttribute(BSTR nm, VARIANT val) {
    wstring key = nm ? wstring(nm) : wstring();
    wstring v = (val.vt == VT_BSTR && val.bstrVal) ? wstring(val.bstrVal) : wstring();
    DomNode *a = find_attr(key);
    if (!a) { a = owner->mint(NODE_ATTRIBUTE); a->name = key; a->parent = this; attrs.push_back(a); }
    a->text = v;
    /* keep the #text child (see parser note) in sync with the value */
    if (a->kids.empty()) { DomNode *at = owner->mint(NODE_TEXT); at->name = L"#text"; at->parent = a; a->kids.push_back(at); }
    a->kids[0]->text = v;
    return S_OK;
}
HRESULT DomNode::removeAttribute(BSTR nm) {
    wstring key = nm ? wstring(nm) : wstring();
    for (size_t i = 0; i < attrs.size(); i++) if (attrs[i]->name == key) { attrs.erase(attrs.begin() + i); return S_OK; }
    return S_FALSE;
}
static void collect_by_tag(DomNode *n, const wstring &tag, vector<DomNode *> &out) {
    for (size_t i = 0; i < n->kids.size(); i++) {
        DomNode *c = n->kids[i];
        if (c->kind == NODE_ELEMENT && (tag == L"*" || c->name == tag)) out.push_back(c);
        collect_by_tag(c, tag, out);
    }
}
HRESULT DomNode::getElementsByTagName(BSTR tagName, IXMLDOMNodeList **resultList) {
    DomNodeList *l = new DomNodeList();
    collect_by_tag(this, tagName ? wstring(tagName) : wstring(L"*"), l->items);
    *resultList = l; return S_OK;
}
HRESULT DomNode::selectNodes(BSTR query, IXMLDOMNodeList **r) {
    /* minimal: treat the query as a descendant tag name (covers the common ".//tag" / "tag" uses) */
    DomNodeList *l = new DomNodeList();
    if (query) { wstring q(query); size_t slash = q.find_last_of(L'/'); wstring tag = slash == wstring::npos ? q : q.substr(slash + 1); if (!tag.empty()) collect_by_tag(this, tag, l->items); }
    *r = l; return l->items.empty() ? S_FALSE : S_OK;
}

/* --------------------------------------------------------------- the parser */
namespace {
struct Parser {
    const wchar_t *p, *end;
    DomDocument *doc;
    Parser(const wchar_t *s, size_t n, DomDocument *d) : p(s), end(s + n), doc(d) {}

    bool eof() { return p >= end; }
    void skip_ws() { while (p < end && (*p == L' ' || *p == L'\t' || *p == L'\r' || *p == L'\n')) p++; }
    bool starts(const wchar_t *s) { const wchar_t *q = p; while (*s) { if (q >= end || *q != *s) return false; q++; s++; } return true; }

    void append_entity(wstring &out) {           /* p points just past '&' */
        if (starts(L"amp;")) { out += L'&'; p += 4; return; }
        if (starts(L"lt;"))  { out += L'<'; p += 3; return; }
        if (starts(L"gt;"))  { out += L'>'; p += 3; return; }
        if (starts(L"quot;")){ out += L'"'; p += 5; return; }
        if (starts(L"apos;")){ out += L'\''; p += 5; return; }
        if (p < end && *p == L'#') {              /* numeric */
            p++; long code = 0; int base = 10;
            if (p < end && (*p == L'x' || *p == L'X')) { base = 16; p++; }
            while (p < end && *p != L';') {
                wchar_t c = *p++;
                if (c >= L'0' && c <= L'9') code = code * base + (c - L'0');
                else if (base == 16 && c >= L'a' && c <= L'f') code = code * 16 + (c - L'a' + 10);
                else if (base == 16 && c >= L'A' && c <= L'F') code = code * 16 + (c - L'A' + 10);
            }
            if (p < end && *p == L';') p++;
            out += (wchar_t)code; return;
        }
        out += L'&';                              /* not a recognized entity */
    }
    wstring read_name() { wstring n; while (p < end && *p != L' ' && *p != L'\t' && *p != L'\r' && *p != L'\n' && *p != L'>' && *p != L'/' && *p != L'=') n += *p++; return n; }
    void read_quoted(wstring &out) {              /* p at the opening quote */
        wchar_t q = *p++; while (p < end && *p != q) { if (*p == L'&') { p++; append_entity(out); } else out += *p++; }
        if (p < end) p++;                          /* closing quote */
    }

    /* parse the children of an element (or the top level); stops at </ or eof */
    void parse_children(DomNode *parentNode) {
        wstring textbuf;
        while (p < end) {
            if (*p == L'<') {
                if (!textbuf.empty()) { DomNode *t = doc->mint(NODE_TEXT); t->name = L"#text"; t->text = textbuf; t->parent = parentNode; parentNode->kids.push_back(t); textbuf.clear(); }
                if (starts(L"</")) return;                                   /* caller consumes end tag */
                if (starts(L"<!--")) { p += 4; while (p < end && !starts(L"-->")) p++; if (p < end) p += 3; continue; }
                if (starts(L"<![CDATA[")) { p += 9; wstring cd; while (p < end && !starts(L"]]>")) cd += *p++; if (p < end) p += 3; DomNode *c = doc->mint(NODE_CDATA_SECTION); c->name = L"#cdata-section"; c->text = cd; c->parent = parentNode; parentNode->kids.push_back(c); continue; }
                if (starts(L"<?")) { p += 2; while (p < end && !starts(L"?>")) p++; if (p < end) p += 2; continue; }
                if (starts(L"<!")) { p += 2; while (p < end && *p != L'>') p++; if (p < end) p++; continue; }
                p++;                                                        /* consume '<' */
                DomNode *el = parse_element_body();
                if (el) { el->parent = parentNode; parentNode->kids.push_back(el); }
            } else if (*p == L'&') { p++; append_entity(textbuf); }
            else textbuf += *p++;
        }
        if (!textbuf.empty()) { DomNode *t = doc->mint(NODE_TEXT); t->name = L"#text"; t->text = textbuf; t->parent = parentNode; parentNode->kids.push_back(t); }
    }

    /* p is just past '<'; read tag name, attributes, then children + end tag */
    DomNode *parse_element_body() {
        DomNode *el = doc->mint(NODE_ELEMENT);
        el->name = read_name();
        while (p < end) {
            skip_ws();
            if (p >= end) break;
            if (*p == L'/') { p++; if (p < end && *p == L'>') p++; return el; }   /* self-closing */
            if (*p == L'>') { p++; break; }                                       /* open tag done */
            wstring an = read_name(); skip_ws();
            wstring av;
            if (p < end && *p == L'=') { p++; skip_ws(); if (p < end && (*p == L'"' || *p == L'\'')) read_quoted(av); }
            DomNode *a = doc->mint(NODE_ATTRIBUTE); a->name = an; a->text = av; a->parent = el; el->attrs.push_back(a);
            /* MSXML models an attribute's value as a #text CHILD of the attribute node, and the
             * engine reads values that way (xml_get_attribute_int -> first_node_that_is_text).
             * Without this child every attribute read silently returned the caller's default. */
            DomNode *at = doc->mint(NODE_TEXT); at->name = L"#text"; at->text = av; at->parent = a; a->kids.push_back(at);
        }
        parse_children(el);                                                       /* fills until </ */
        if (starts(L"</")) { p += 2; read_name(); skip_ws(); if (p < end && *p == L'>') p++; }
        return el;
    }

    DomNode *parse_document() {
        skip_ws();
        while (p < end && *p == L'<') {
            if (starts(L"<?")) { p += 2; while (p < end && !starts(L"?>")) p++; if (p < end) p += 2; skip_ws(); continue; }
            if (starts(L"<!--")) { p += 4; while (p < end && !starts(L"-->")) p++; if (p < end) p += 3; skip_ws(); continue; }
            if (starts(L"<!")) { p += 2; while (p < end && *p != L'>') p++; if (p < end) p++; skip_ws(); continue; }
            p++; return parse_element_body();
        }
        return NULL;
    }
};
} /* namespace */

HRESULT DomDocument::loadXML(BSTR xml, VARIANT_BOOL *ok) {
    /* clear any prior tree */
    for (size_t i = 0; i < all.size(); i++) delete all[i];
    all.clear(); root = NULL;
    err->code = 0;
    size_t n = xml ? SysStringLen(xml) : 0;
    if (n == 0) { if (ok) *ok = VARIANT_FALSE; err->code = 1; return S_OK; }
    Parser parser(xml, n, this);
    root = parser.parse_document();
    if (root) { if (ok) *ok = VARIANT_TRUE; return S_OK; }
    err->code = 1; if (ok) *ok = VARIANT_FALSE; return S_OK;
}

/* --------------------------------------------------------------- CoCreateInstance */
HRESULT CoCreateInstance(REFCLSID rclsid, LPUNKNOWN, DWORD, REFIID, LPVOID *ppv) {
    if (!ppv) return E_FAIL;
    if (rclsid == CLSID_DOMDocument) { *ppv = (IXMLDOMDocument *)(new DomDocument()); return S_OK; }
    *ppv = NULL; return E_FAIL;   /* REGDB_E_CLASSNOTREG-ish; unknown component */
}
