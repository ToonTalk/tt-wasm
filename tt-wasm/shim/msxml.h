/* MSXML (DOM) interface shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * defs.h typedefs xml_document/xml_node/xml_element/... to these IXMLDOM*
 * interfaces (when TT_XML=1). In the real build they came from `#import
 * "msxml4.dll"` in xml.cpp; clang/emcc has no #import, so this header supplies
 * the IXMLDOM* COM interfaces directly.
 *
 * xml.cpp calls the raw interface methods (node->get_nodeType(...),
 * document->loadXML(...), element->setAttribute(...), ...), so unlike phase-0's
 * other COM shims these interfaces carry their full (pure-virtual) method set,
 * with the canonical MSXML signatures. Bodies are unresolved externals -- the
 * DOM is reimplemented over a real XML parser in phase 1. Signatures were
 * reconstructed from the call sites in src/xml.cpp. */
#ifndef _MSXML_SHIM_H_
#define _MSXML_SHIM_H_

#include <objbase.h>

/* node-type enumeration (DOMNodeType). xml.cpp compares against NODE_ELEMENT etc. */
typedef enum tagDOMNodeType {
    NODE_INVALID                = 0,
    NODE_ELEMENT                = 1,
    NODE_ATTRIBUTE              = 2,
    NODE_TEXT                   = 3,
    NODE_CDATA_SECTION          = 4,
    NODE_ENTITY_REFERENCE       = 5,
    NODE_ENTITY                 = 6,
    NODE_PROCESSING_INSTRUCTION = 7,
    NODE_COMMENT                = 8,
    NODE_DOCUMENT               = 9,
    NODE_DOCUMENT_TYPE          = 10,
    NODE_DOCUMENT_FRAGMENT      = 11,
    NODE_NOTATION               = 12
} DOMNodeType;

struct IXMLDOMNode;
struct IXMLDOMNodeList;
struct IXMLDOMNamedNodeMap;
struct IXMLDOMDocument;
struct IXMLDOMElement;
struct IXMLDOMParseError;

typedef IXMLDOMNode         *LPXMLDOMNODE;
typedef IXMLDOMDocument     *LPXMLDOMDOCUMENT;
typedef IXMLDOMElement      *LPXMLDOMELEMENT;

/* --- IXMLDOMNode: the base of the DOM hierarchy --- */
struct IXMLDOMNode : public IDispatch {
    virtual HRESULT get_nodeName(BSTR *name) = 0;
    virtual HRESULT get_nodeValue(VARIANT *value) = 0;
    virtual HRESULT put_nodeValue(VARIANT value) = 0;
    virtual HRESULT get_nodeType(DOMNodeType *type) = 0;
    virtual HRESULT get_parentNode(IXMLDOMNode **parent) = 0;
    virtual HRESULT get_childNodes(IXMLDOMNodeList **childList) = 0;
    virtual HRESULT get_firstChild(IXMLDOMNode **firstChild) = 0;
    virtual HRESULT get_lastChild(IXMLDOMNode **lastChild) = 0;
    virtual HRESULT get_previousSibling(IXMLDOMNode **previousSibling) = 0;
    virtual HRESULT get_nextSibling(IXMLDOMNode **nextSibling) = 0;
    virtual HRESULT get_attributes(IXMLDOMNamedNodeMap **attributeMap) = 0;
    virtual HRESULT insertBefore(IXMLDOMNode *newChild, VARIANT refChild, IXMLDOMNode **outNewChild) = 0;
    virtual HRESULT replaceChild(IXMLDOMNode *newChild, IXMLDOMNode *oldChild, IXMLDOMNode **outOldChild) = 0;
    virtual HRESULT removeChild(IXMLDOMNode *childNode, IXMLDOMNode **oldChild) = 0;
    virtual HRESULT appendChild(IXMLDOMNode *newChild, IXMLDOMNode **outNewChild) = 0;
    virtual HRESULT hasChildNodes(VARIANT_BOOL *hasChild) = 0;
    virtual HRESULT get_ownerDocument(IXMLDOMDocument **DOMDocument) = 0;
    virtual HRESULT cloneNode(VARIANT_BOOL deep, IXMLDOMNode **cloneRoot) = 0;
    virtual HRESULT get_text(BSTR *text) = 0;
    virtual HRESULT put_text(BSTR text) = 0;
    virtual HRESULT get_xml(BSTR *xmlString) = 0;
    virtual HRESULT selectSingleNode(BSTR queryString, IXMLDOMNode **resultNode) = 0;
    virtual HRESULT selectNodes(BSTR queryString, IXMLDOMNodeList **resultList) = 0;
    virtual HRESULT get_nodeTypedValue(VARIANT *typedValue) = 0;
};

/* --- collections --- */
struct IXMLDOMNodeList : public IDispatch {
    virtual HRESULT get_item(long index, IXMLDOMNode **listItem) = 0;
    virtual HRESULT get_length(long *listLength) = 0;
    virtual HRESULT nextNode(IXMLDOMNode **nextItem) = 0;
    virtual HRESULT reset(void) = 0;
};

struct IXMLDOMNamedNodeMap : public IDispatch {
    virtual HRESULT getNamedItem(BSTR name, IXMLDOMNode **namedItem) = 0;
    virtual HRESULT setNamedItem(IXMLDOMNode *newItem, IXMLDOMNode **nameItem) = 0;
    virtual HRESULT removeNamedItem(BSTR name, IXMLDOMNode **namedItem) = 0;
    virtual HRESULT get_item(long index, IXMLDOMNode **listItem) = 0;
    virtual HRESULT get_length(long *listLength) = 0;
    virtual HRESULT nextNode(IXMLDOMNode **nextItem) = 0;
    virtual HRESULT reset(void) = 0;
};

/* --- typed node subclasses (extra members beyond IXMLDOMNode) --- */
struct IXMLDOMElement : public IXMLDOMNode {
    virtual HRESULT get_tagName(BSTR *tagName) = 0;
    virtual HRESULT getAttribute(BSTR name, VARIANT *attributeValue) = 0;
    virtual HRESULT setAttribute(BSTR name, VARIANT attributeValue) = 0;
    virtual HRESULT removeAttribute(BSTR name) = 0;
    virtual HRESULT getAttributeNode(BSTR name, IXMLDOMNode **attributeNode) = 0;
    virtual HRESULT setAttributeNode(IXMLDOMNode *DOMAttribute, IXMLDOMNode **attributeNode) = 0;
    virtual HRESULT getElementsByTagName(BSTR tagName, IXMLDOMNodeList **resultList) = 0;
    virtual HRESULT normalize(void) = 0;
};

struct IXMLDOMAttribute          : public IXMLDOMNode {};
struct IXMLDOMText               : public IXMLDOMNode {};
struct IXMLDOMCDATASection       : public IXMLDOMText {};
struct IXMLDOMComment            : public IXMLDOMNode {};
struct IXMLDOMProcessingInstruction : public IXMLDOMNode {};

/* --- parse error info (document->get_parseError) --- */
struct IXMLDOMParseError : public IDispatch {
    virtual HRESULT get_errorCode(long *errorCode) = 0;
    virtual HRESULT get_url(BSTR *urlString) = 0;
    virtual HRESULT get_reason(BSTR *reasonString) = 0;
    virtual HRESULT get_srcText(BSTR *sourceString) = 0;
    virtual HRESULT get_line(long *lineNumber) = 0;
    virtual HRESULT get_linepos(long *linePosition) = 0;
    virtual HRESULT get_filepos(long *filePosition) = 0;
};

/* --- the document (factory + load/save) --- */
struct IXMLDOMDocument : public IXMLDOMNode {
    virtual HRESULT get_documentElement(IXMLDOMElement **DOMElement) = 0;
    virtual HRESULT createElement(BSTR tagName, IXMLDOMElement **element) = 0;
    virtual HRESULT createDocumentFragment(IXMLDOMNode **docFrag) = 0;
    virtual HRESULT createTextNode(BSTR data, IXMLDOMText **text) = 0;
    virtual HRESULT createComment(BSTR data, IXMLDOMComment **comment) = 0;
    virtual HRESULT createCDATASection(BSTR data, IXMLDOMCDATASection **cdata) = 0;
    virtual HRESULT createProcessingInstruction(BSTR target, BSTR data, IXMLDOMProcessingInstruction **pi) = 0;
    virtual HRESULT createAttribute(BSTR name, IXMLDOMAttribute **attribute) = 0;
    virtual HRESULT getElementsByTagName(BSTR tagName, IXMLDOMNodeList **resultList) = 0;
    virtual HRESULT get_parseError(IXMLDOMParseError **errorObj) = 0;
    virtual HRESULT load(VARIANT xmlSource, VARIANT_BOOL *isSuccessful) = 0;
    virtual HRESULT loadXML(BSTR bstrXML, VARIANT_BOOL *isSuccessful) = 0;
    virtual HRESULT save(VARIANT destination) = 0;
};
struct IXMLDOMDocument2 : public IXMLDOMDocument {};

/* CLSID / IID the CoCreateInstance(CLSID_DOMDocument, ..., IID_IXMLDOMDocument)
 * call references (real GUIDs from msxml; declared, defined at link). */
extern const GUID CLSID_DOMDocument;
extern const GUID CLSID_DOMDocument40;
extern const GUID IID_IXMLDOMDocument;
extern const GUID IID_IXMLDOMElement;
extern const GUID IID_IXMLDOMNode;

#endif /* _MSXML_SHIM_H_ */
