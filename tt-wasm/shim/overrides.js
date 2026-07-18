// Functional Win32 stubs the startup path needs — overriding the bare () => 0
// entries in stubs.js. (Keys are the unmangled extern-C import names. Buffer-out
// functions MUST write to the out pointer; creation functions must return a
// non-NULL handle so the engine's success checks pass.)
addToLibrary({
  // --- path / string buffer fillers ---
  GetTempPathA: function(len, buf) { var s = '/tmp/', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; },
  GetModuleFileNameA: function(mod, buf, len) { var s = '/toontalk/tt.exe', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; },
  GetCurrentDirectoryA: function(len, buf) { var s = '/toontalk', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; },
  GetWindowsDirectoryA: function(buf, len) { var s = '/windows', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; },

  // Resource strings: serve the real ToonTalk STRINGTABLE (shim/resstrings.js, generated from the
  // .rc files) by numeric id. LoadString is the funnel for every C()/S()/SC() accessor; unknown
  // ids return "" (null-terminated) so callers that strlen the result stay safe.
  // Memory status: the engine sizes its image cache from GlobalMemoryStatus (25% of
  // min(TotalPhys, AvailPageFile) in compute_memory_available). The zero-stub left the struct
  // untouched -> cache budget 0 -> the FIRST image load tried to evict from an EMPTY cache and
  // my_random2(max_cache_index==0) trapped on %0. Report a healthy fixed 256MB everywhere.
  GlobalMemoryStatus: function(ptr) {
    var MB256 = 256 * 1024 * 1024;
    HEAP32[(ptr >> 2) + 1] = 25;      /* dwMemoryLoad */
    HEAP32[(ptr >> 2) + 2] = MB256;   /* dwTotalPhys */
    HEAP32[(ptr >> 2) + 3] = MB256;   /* dwAvailPhys */
    HEAP32[(ptr >> 2) + 4] = MB256;   /* dwTotalPageFile */
    HEAP32[(ptr >> 2) + 5] = MB256;   /* dwAvailPageFile */
    HEAP32[(ptr >> 2) + 6] = MB256;   /* dwTotalVirtual */
    HEAP32[(ptr >> 2) + 7] = MB256;   /* dwAvailVirtual */
    return 1;
  },

  // Narrow<->wide conversion. The zero-stubs here made EVERY set_text()-style narrow->wide
  // conversion return length 0, so all engine-created labels/pads displayed as EMPTY (the BOK
  // notebook's "Pictures"/"Sensors" pads, Marty's text, ... — "no digits or characters").
  // ToonTalk strings are Windows-1252/ASCII, so byte <-> code-unit 1:1 is faithful. wchar_t is
  // 4 bytes under Emscripten -> HEAP32. Windows semantics: srcLen==-1 processes through the NUL
  // and the returned count INCLUDES it; dstLen==0 is a size query.
  MultiByteToWideChar: function(cp, flags, src, srcLen, dst, dstLen) {
    if (!src) return 0;
    var n = srcLen;
    if (n < 0) { n = 0; while (HEAPU8[src + n]) n++; n++; }
    if (!dst || dstLen === 0) return n;
    var m = Math.min(n, dstLen);
    for (var i = 0; i < m; i++) HEAP32[(dst >> 2) + i] = HEAPU8[src + i];
    return m;
  },
  WideCharToMultiByte: function(cp, flags, src, srcLen, dst, dstLen, defc, used) {
    if (!src) return 0;
    var n = srcLen;
    if (n < 0) { n = 0; while (HEAP32[(src >> 2) + n]) n++; n++; }
    if (!dst || dstLen === 0) return n;
    var m = Math.min(n, dstLen);
    for (var i = 0; i < m; i++) { var c = HEAP32[(src >> 2) + i]; HEAPU8[dst + i] = c < 256 ? c : 63; }
    return m;
  },

  // Key state for the engine's POLLED input: read_arrow_keys (walking!) and the shift/control
  // checks poll GetAsyncKeyState every cycle. pre.js maintains TT_keys[vk] from real
  // keydown/keyup. High bit set (negative short) = currently down, matching `< 0` tests.
  GetAsyncKeyState: function(vk) {
    var k = globalThis.TT_keys;
    return (k && k[vk]) ? -32768 : 0;
  },
  GetKeyState: function(vk) {
    var k = globalThis.TT_keys;
    return (k && k[vk]) ? -32768 : 0;
  },

  // Character classification (Windows-1252). The zero-stubs classified EVERY char as
  // non-alphanumeric, so copy_alphanumerics() stripped the whole DefaultUser name from the INI
  // ("PlaygroundBookX" -> "") and no user notebook files could ever resolve. IsCharAlphaW's
  // zero-stub also broke number.cpp's shrink-digits gate (!IsCharAlphaW let letters through).
  $TT_isAlpha: function(c) {
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return 1;      /* A-Z a-z */
    if (c >= 0xC0 && c <= 0xFF && c !== 0xD7 && c !== 0xF7) return 1; /* À-ÿ minus × ÷ */
    if (c === 0x83 || c === 0x8A || c === 0x8C || c === 0x8E ||       /* ƒ Š Œ Ž */
        c === 0x9A || c === 0x9C || c === 0x9E || c === 0x9F) return 1; /* š œ ž Ÿ */
    return 0;
  },
  IsCharAlphaA__deps: ['$TT_isAlpha'],
  IsCharAlphaA: function(c) { return TT_isAlpha(c & 0xFF); },
  IsCharAlphaW__deps: ['$TT_isAlpha'],
  IsCharAlphaW: function(c) { return c > 255 ? 1 : TT_isAlpha(c); },
  IsCharAlphaNumericA__deps: ['$TT_isAlpha'],
  IsCharAlphaNumericA: function(c) { c &= 0xFF; return (c >= 48 && c <= 57) ? 1 : TT_isAlpha(c); },
  IsCharAlphaNumericW__deps: ['$TT_isAlpha'],
  IsCharAlphaNumericW: function(c) { return (c >= 48 && c <= 57) ? 1 : (c > 255 ? 1 : TT_isAlpha(c)); },

  LoadStringA__deps: ['$TT_RES_STRINGS', '$TT_writeCStr'],
  LoadStringA: function(hInst, id, buf, maxLen) {
    var s = TT_RES_STRINGS[id];
    return TT_writeCStr(buf, maxLen, s === undefined ? '' : s);
  },

  // INI reads -> a real ToonTalk.ini in the FS (written by shim/pre.js). The engine derives every
  // directory path from [Directories]; without this each dir is NULL and append_strings() (whose
  // NULL guards are commented out) does _tcslen(NULL) -> segfault.
  GetPrivateProfileStringA__deps: ['$TT_readIniValue', '$TT_writeCStr', '$UTF8ToString'],
  GetPrivateProfileStringA: function(section, key, def, buf, size, file) {
    var v = TT_readIniValue(file ? UTF8ToString(file) : '', section ? UTF8ToString(section) : '', key ? UTF8ToString(key) : '');
    if (v === null) v = def ? UTF8ToString(def) : '';
    return TT_writeCStr(buf, size, v);
  },
  GetPrivateProfileIntA__deps: ['$TT_readIniValue', '$UTF8ToString'],
  GetPrivateProfileIntA: function(section, key, def, file) {
    var v = TT_readIniValue(file ? UTF8ToString(file) : '', section ? UTF8ToString(section) : '', key ? UTF8ToString(key) : '');
    if (v === null) return def;
    var n = parseInt(v, 10); return isNaN(n) ? def : n;
  },
  WritePrivateProfileStringA: function() { return 1; },

  // --- JS-only helper library symbols (not wasm imports) ---
  $TT_writeCStr: function(buf, maxLen, s) {
    var n = 0;
    if (buf && maxLen > 0) { for (; n < s.length && n < maxLen - 1; n++) HEAPU8[buf + n] = s.charCodeAt(n) & 0xff; HEAPU8[buf + n] = 0; }
    return n;
  },
  $TT_readIniValue__deps: ['$FS'],
  $TT_readIniValue: function(fname, section, key) {
    var content = null, base = fname.split(/[\/\\]/).pop(), tries = [fname, '/toontalk/' + base, '/' + base];
    for (var t = 0; t < tries.length && content === null; t++) {
      try { content = FS.readFile(tries[t], { encoding: 'utf8' }); } catch (e) { content = null; }
    }
    if (content === null) return null;
    section = (section || '').toLowerCase(); key = (key || '').toLowerCase();
    var lines = content.split(/\r?\n/), cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line[0] === ';' || line[0] === '#') continue;
      if (line[0] === '[') { var e = line.indexOf(']'); cur = e > 0 ? line.slice(1, e).toLowerCase() : null; continue; }
      if (cur === section) {
        var eq = line.indexOf('=');
        if (eq > 0 && line.slice(0, eq).trim().toLowerCase() === key) return line.slice(eq + 1).trim();
      }
    }
    return null;
  },

  // Win32 heap (GlobalAlloc/LocalAlloc family) -> wasm malloc/free. ttfile.cpp's copy_string and
  // many engine sites allocate via GlobalAlloc; the 0-stub returned NULL and the next write hit
  // address 0. GMEM_ZEROINIT / LMEM_ZEROINIT = 0x40. Handles are fixed pointers (Lock = identity).
  GlobalAlloc__deps: ['malloc'],
  GlobalAlloc: function(flags, size) { size = size || 1; var p = _malloc(size); if (p && (flags & 0x40)) HEAPU8.fill(0, p, p + size); return p; },
  GlobalReAlloc__deps: ['realloc'],
  GlobalReAlloc: function(p, size, flags) { return _realloc(p, size || 1); },
  GlobalFree__deps: ['free'],
  GlobalFree: function(p) { if (p) _free(p); return 0; },
  GlobalLock: function(p) { return p; },
  GlobalUnlock: function(p) { return 1; },
  LocalAlloc__deps: ['malloc'],
  LocalAlloc: function(flags, size) { size = size || 1; var p = _malloc(size); if (p && (flags & 0x40)) HEAPU8.fill(0, p, p + size); return p; },
  LocalReAlloc__deps: ['realloc'],
  LocalReAlloc: function(p, size, flags) { return _realloc(p, size || 1); },
  LocalFree__deps: ['free'],
  LocalFree: function(p) { if (p) _free(p); return 0; },
  LocalLock: function(p) { return p; },
  LocalUnlock: function(p) { return 1; },

  // DLLs don't exist in WASM. Return a non-NULL fake module handle so the engine's load_library()
  // succeeds (the UI string DLL is unnecessary -- LoadStringA serves resstrings.js regardless of
  // module). Without this, load_library(...,warn=TRUE) for the missing string DLL -> tt_exit_failure
  // -> exit(1). GetProcAddress stays 0 (handled per-call as those needs arise).
  LoadLibraryA: function() { return 1; },
  LoadLibraryW: function() { return 1; },
  LoadLibraryExA: function() { return 1; },
  LoadLibraryExW: function() { return 1; },
  FreeLibrary: function() { return 1; },

  // (DirectSoundCreate is now a real wasm-side implementation: shim/dsound_impl.cpp over Web Audio.)

  // File I/O: the engine opens data files (the art DATs) via Win16-era OpenFile and reads with
  // _lread/_llseek (already CRT macros). Back OpenFile onto the Emscripten FS (return a real fd);
  // report existence via GetFileAttributesA so existing_file_name() finds the preloaded DATs.
  // Resolve a Windows-style path onto the FS: try it as-is (slashes normalized), then by basename
  // in the preloaded data dirs — the engine's existing_file_name() mangles paths (backslashes,
  // double-prefixing the data dir), so basename resolution finds the DATs regardless.
  $TT_resolvePath__deps: ['$FS'],
  $TT_resolvePath: function(raw) {
    var p = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (p.length > 1) p = p.replace(/\/$/, '');   // directory names arrive with a trailing slash
    var cands = [p];
    // Use the LAST occurrence: the engine's is_absolute check doesn't recognise "/"-leading
    // paths, so it re-prefixes MainDir onto already-absolute ones ("/toontalk/toontalk/Users/...").
    var ix = p.toLowerCase().lastIndexOf('/toontalk/');
    if (ix > 0) cands.push(p.slice(ix));          // "C:/.../toontalk/x" -> "/toontalk/x"
    var base = p.split('/').pop();
    cands.push('/toontalk/' + base, '/toontalk/Java/' + base, '/toontalk/pics/' + base,
               '/toontalk/pics/' + base.toLowerCase(), base);
    for (var i = 0; i < cands.length; i++) { try { FS.stat(cands[i]); return cands[i]; } catch (e) {} }
    if (!TT_resolvePath.n) TT_resolvePath.n = 0;
    if (p.indexOf('Playground') >= 0 && TT_resolvePath.n < 60) { TT_resolvePath.n++; console.log('[tt] probe-miss: ' + raw); }
    return null;
  },
  OpenFile__deps: ['$FS', '$UTF8ToString', '$TT_resolvePath'],
  OpenFile: function(namePtr, ofstruct, style) { if (!namePtr) return -1; var r = TT_resolvePath(UTF8ToString(namePtr)); if (!r) return -1; try { return FS.open(r, 'r').fd; } catch (e) { return -1; } },
  GetFileAttributesA__deps: ['$UTF8ToString', '$TT_resolvePath', '$FS'],
  GetFileAttributesA: function(namePtr) {
    if (!namePtr) return 0xFFFFFFFF;
    var r = TT_resolvePath(UTF8ToString(namePtr));
    if (!r) return 0xFFFFFFFF;
    /* FILE_ATTRIBUTE_DIRECTORY matters: set_tt_default_file_name compares == 0x10 to accept the
     * DefaultUser directory (Users/PlaygroundBookX with the retail BOK pages). */
    try { if (FS.isDir(FS.stat(r).mode)) return 0x10; } catch (e) {}
    return 0x80;
  },

  // Mouse position. DirectInput failed to init (tt_using_direct_input=FALSE), so the engine polls
  // the absolute cursor via GetCursorPos each cycle (winmain.cpp:1358). pre.js's canvas mousemove
  // handler keeps TT_mouse_x/y in engine screen pixels (0..w, 0..h); write them into the POINT.
  GetCursorPos: function(ptr) {
    if (ptr) { HEAP32[ptr >> 2] = (globalThis.TT_mouse_x | 0); HEAP32[(ptr >> 2) + 1] = (globalThis.TT_mouse_y | 0); }
    return 1;
  },
  // RELATIVE_MOUSE_MODE reads the delta (cursor - client_center) each frame then warps the cursor
  // back to centre via SetCursorPos so the next delta is measured fresh. In the browser we emulate
  // that warp: reset the virtual cursor to (x,y). Under Pointer Lock, pre.js accumulates movementX/Y
  // from this reset point, so the per-frame delta is exactly the mouse movement — the hand tracks.
  SetCursorPos: function(x, y) { globalThis.TT_mouse_x = x; globalThis.TT_mouse_y = y; return 1; },
  // Our window IS the canvas (origin 0,0), so screen<->client is identity (leave POINT unchanged).
  ScreenToClient: function(hwnd, ptr) { return 1; },
  ClientToScreen: function(hwnd, ptr) { return 1; },

  // Windows message pump. pre.js's DOM handlers push mouse-button/key events onto TT_msgq;
  // the engine's loop (winmain.cpp:1291) PeekMessages them and DispatchMessage routes each to
  // MainWindow::WndProc via the tt_dispatch_to_wndproc bridge. MSG = {hwnd,message,wParam,
  // lParam,time,pt.x,pt.y} (7 dwords, offsets 0..24). Mouse position comes from GetCursorPos,
  // so button messages need only the type.
  PeekMessageA: function(msgPtr, hwnd, minF, maxF, remove) {
    var q = globalThis.TT_msgq; if (!q || !q.length) return 0;
    var idx = -1;
    for (var i = 0; i < q.length; i++) { var m = q[i].message; if ((minF === 0 && maxF === 0) || (m >= minF && m <= maxF)) { idx = i; break; } }
    if (idx < 0) return 0;
    var e = q[idx];
    if (msgPtr) { var b = msgPtr >> 2; HEAP32[b] = 0; HEAP32[b + 1] = e.message; HEAP32[b + 2] = e.wParam; HEAP32[b + 3] = e.lParam | 0; HEAP32[b + 4] = 0; HEAP32[b + 5] = (globalThis.TT_mouse_x | 0); HEAP32[b + 6] = (globalThis.TT_mouse_y | 0); }
    if (remove & 1) q.splice(idx, 1);
    return 1;
  },
  GetMessageA: function(msgPtr, hwnd, minF, maxF) {
    var q = globalThis.TT_msgq, b = msgPtr >> 2;
    if (q && q.length) { var e = q.shift(); if (msgPtr) { HEAP32[b] = 0; HEAP32[b + 1] = e.message; HEAP32[b + 2] = e.wParam; HEAP32[b + 3] = e.lParam | 0; } return 1; }
    if (msgPtr) { HEAP32[b + 1] = 0; } // WM_NULL — keep the (rare) paused GetMessage loop alive, never WM_QUIT
    return 1;
  },
  TranslateMessage: function(msgPtr) { return 0; }, // keys are posted as WM_CHAR directly
  DispatchMessageA: function(msgPtr) {
    if (!msgPtr) return 0;
    var b = msgPtr >> 2;
    if (Module['_tt_dispatch_to_wndproc']) Module['_tt_dispatch_to_wndproc'](HEAP32[b + 1], HEAP32[b + 2], HEAP32[b + 3]);
    return 0;
  },

  // Modern Win32 file API over the Emscripten FS. The BMP loader (DibOpenFile/DibReadBitmapInfo,
  // wingutil.cpp) reads sprite pixels with CreateFile/ReadFile/CloseHandle — distinct from the
  // OpenFile/_lread path used for the DATs — so these were stubbed and every sprite came up blank.
  // Handle value = the FS fd; INVALID_HANDLE_VALUE = -1. GENERIC_WRITE=0x40000000.
  CreateFileA__deps: ['$FS', '$UTF8ToString', '$TT_resolvePath'],
  CreateFileA: function(namePtr, access, share, sa, disp, flags, tmpl) {
    if (!namePtr) return -1;
    var raw = UTF8ToString(namePtr), write = (access & 0x40000000) !== 0;
    var path = write ? raw.replace(/\\/g, '/').replace(/\/+/g, '/') : TT_resolvePath(raw);
    if (!path) return -1;
    try { return FS.open(path, write ? 'w' : 'r').fd; } catch (e) { return -1; }
  },
  ReadFile__deps: ['$FS'],
  ReadFile: function(fh, buf, toRead, nReadPtr, ovl) {
    var s = FS.streams[fh]; var n = 0;
    if (s) { try { n = FS.read(s, HEAPU8, buf, toRead); } catch (e) { n = 0; } }
    if (nReadPtr) HEAP32[nReadPtr >> 2] = n;
    return s ? 1 : 0;
  },
  CloseHandle__deps: ['$FS'],
  CloseHandle: function(fh) { try { if (fh >= 3 && FS.streams[fh]) FS.close(FS.streams[fh]); } catch (e) {} return 1; },
  GetFileSize__deps: ['$FS'],
  GetFileSize: function(fh, hiPtr) { var s = FS.streams[fh], sz = 0; if (s) { try { sz = FS.stat(s.path).size; } catch (e) {} } if (hiPtr) HEAP32[hiPtr >> 2] = 0; return sz >>> 0; },
  SetFilePointer__deps: ['$FS'],
  SetFilePointer: function(fh, dist, hiPtr, method) { var s = FS.streams[fh]; if (!s) return 0xFFFFFFFF; try { FS.llseek(s, dist, method); } catch (e) {} return s.position >>> 0; },

  // --- non-NULL handles so window/GDI creation "succeeds" ---
  GetModuleHandleA: function() { return 1; },
  GetModuleHandleW: function() { return 1; },
  RegisterClassA: function() { return 1; },
  RegisterClassExA: function() { return 1; },
  CreateWindowExA: function() { return 1; },
  CreateWindowA: function() { return 1; },
  GetDC: function() { return 1; },
  GetWindowDC: function() { return 1; },
  GetDesktopWindow: function() { return 1; },
  LoadIconA: function() { return 1; },
  LoadCursorA: function() { return 1; },
  LoadImageA: function() { return 1; },
  // CreateCompatibleDC / GetStockObject / CreateSolidBrush now live in shim/gdi_impl.cpp (real GDI).
  DefWindowProcA: function() { return 0; },
  CoInitialize: function() { return 0; },
  CoInitializeEx: function() { return 0; },

  // Device caps: the engine derives tt_bits_per_pixel from BITSPIXEL — the 0-stub made it 0,
  // zeroing all pixel math (tt_bytes_per_pixel=0). Report an 8-bit 1024x768 palettized display
  // to match the 8-bit DAT artwork. Indices: HORZRES=8 VERTRES=10 BITSPIXEL=12 PLANES=14
  // NUMCOLORS=24 RASTERCAPS=38 (RC_PALETTE=0x100) SIZEPALETTE=104.
  GetDeviceCaps: function(hdc, index) {
    switch (index) { case 12: return 8; case 38: return 0x100; case 104: return 256;
                     case 24: return 256; case 8: return 1024; case 10: return 768;
                     case 14: return 1; default: return 0; }
  },
  // windows95()/windows_2000_or_above() read this struct; the 0-stub left it as stack garbage.
  // Report NT 5.1 (platform=2) so the GDI+-off/8-bit-forcing Win95 branch never triggers.
  GetVersionExA: function(info) {
    if (info) { HEAP32[(info >> 2) + 1] = 5; HEAP32[(info >> 2) + 2] = 1;
                HEAP32[(info >> 2) + 3] = 2600; HEAP32[(info >> 2) + 4] = 2; }
    return 1;
  },
  // timeGetTime() [C++-mangled]: the engine's entire time base. The 0-stub froze it — title
  // screens never advanced (timer never elapsed) and every animation delta was 0. Monotonic ms.
  _Z11timeGetTimev: function() { return ((typeof performance !== 'undefined') ? performance.now() : Date.now()) >>> 0; },
  // GDI palettes, for real: CreateIdentityPalette builds a LOGPALETTE from the DAT's RGBQUADs
  // and the engine reads it back via GetPaletteEntries to seed the DirectDraw palette — the old
  // ()=>1 stub made those colors stack garbage. Store entries per handle (PALETTEENTRY = 4 bytes).
  CreatePalette__deps: ['$TT_palettes'],
  CreatePalette: function(logpal) {
    var n = HEAPU16[(logpal >> 1) + 1]; if (n > 256) n = 256;
    var bytes = new Uint8Array(1024);
    if (n > 0) bytes.set(HEAPU8.subarray(logpal + 4, logpal + 4 + n * 4));
    var h = TT_palettes.next++;
    TT_palettes.map[h] = bytes;
    return h;
  },
  GetPaletteEntries__deps: ['$TT_palettes'],
  GetPaletteEntries: function(hpal, start, count, out) {
    var b = TT_palettes.map[hpal];
    if (!b || !out) return 0;
    if (start + count > 256) count = 256 - start;
    if (count <= 0) return 0;
    HEAPU8.set(b.subarray(start * 4, (start + count) * 4), out);
    return count;
  },
  // SYSPAL_NOSTATIC: no reserved system colors in a browser, so CreateIdentityPalette's
  // clean all-256-from-the-artwork branch runs instead of the static-color merge.
  GetSystemPaletteUse: function() { return 2; },
  $TT_palettes: { next: 1, map: {} },

  // --- screen metrics + client rect (the engine sizes its window from these) ---
  GetSystemMetrics: function(i) { return i === 0 ? 1024 : (i === 1 ? 768 : 0); },
  GetClientRect: function(h, r) { HEAP32[r >> 2] = 0; HEAP32[(r >> 2) + 1] = 0; HEAP32[(r >> 2) + 2] = 800; HEAP32[(r >> 2) + 3] = 600; return 1; }, // must match tt_screen 800x600 — mixed coordinate spaces corrupt absolute-mouse math
  GetWindowRect: function(h, r) { HEAP32[r >> 2] = 0; HEAP32[(r >> 2) + 1] = 0; HEAP32[(r >> 2) + 2] = 1024; HEAP32[(r >> 2) + 3] = 768; return 1; },
});
