/* COM / DirectSound / Shell / SAPI GUID constants referenced by the ToonTalk
 * sources. The real Win32 SDK supplies these via uuid.lib / dxguid.lib; we define
 * them here so the wasm link resolves them.
 *
 * IUnknown / DirectSound / ShellLink get their real values. The SAPI 4 text-to-
 * speech GUIDs are placeholders — that COM path is reimplemented with the browser
 * Web Speech API, so the original IDs are never used at runtime. */
#include "windows.h"

#define DEF_GUID(name, a, b, c, d0, d1, d2, d3, d4, d5, d6, d7) \
    extern const GUID name = { a, b, c, { d0, d1, d2, d3, d4, d5, d6, d7 } }

DEF_GUID(IID_IUnknown,     0x00000000, 0x0000, 0x0000, 0xC0, 0, 0, 0, 0, 0, 0, 0x46);
DEF_GUID(IID_IDirectSound, 0x279AFA83, 0x4981, 0x11CE, 0xA5, 0x21, 0x00, 0x20, 0xAF, 0x0B, 0xE5, 0x60);
DEF_GUID(CLSID_ShellLink,  0x00021401, 0x0000, 0x0000, 0xC0, 0, 0, 0, 0, 0, 0, 0x46);
DEF_GUID(IID_IPersistFile, 0x0000010B, 0x0000, 0x0000, 0xC0, 0, 0, 0, 0, 0, 0, 0x46);
DEF_GUID(IID_IShellLinkA,  0x000214EE, 0x0000, 0x0000, 0xC0, 0, 0, 0, 0, 0, 0, 0x46);

/* SAPI 4 / TTS — placeholder GUIDs (reimplemented via Web Speech). */
#define ZERO_GUID(name) extern const GUID name = { 0, 0, 0, { 0, 0, 0, 0, 0, 0, 0, 0 } }
ZERO_GUID(CLSID_AudioDestDirect);
ZERO_GUID(CLSID_MMAudioDest);
ZERO_GUID(CLSID_TTSEnumerator);
ZERO_GUID(IID_IAudioDirect);
ZERO_GUID(IID_IAudioMultiMediaDevice);
ZERO_GUID(IID_ITTSAttributesA);
ZERO_GUID(IID_ITTSBufNotifySink);
ZERO_GUID(IID_ITTSFindW);
ZERO_GUID(IID_ITTSNotifySinkA);
ZERO_GUID(IID_ITTSNotifySinkW);

/* OLE drag-drop (→ HTML5 file drop) + MSXML DOM (→ browser DOMParser) —
 * reimplemented in the browser shim, so placeholder GUIDs. */
ZERO_GUID(IID_IDropTarget);
ZERO_GUID(CLSID_DOMDocument);
ZERO_GUID(IID_IXMLDOMDocument);
ZERO_GUID(IID_IXMLDOMElement);
