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

  // DirectSoundCreate(GUID const*, IDirectSound**, IUnknown*) [C++-mangled name]: return a failure
  // HRESULT (!= DS_OK) so initialize_sound() takes its graceful no-sound path instead of deref'ing
  // the unset NULL out-param. Sound isn't needed to boot; DirectSound -> Web Audio comes later.
  _Z17DirectSoundCreatePK5_GUIDPP12IDirectSoundP8IUnknown: function() { return 1; },

  // File I/O: the engine opens data files (the art DATs) via Win16-era OpenFile and reads with
  // _lread/_llseek (already CRT macros). Back OpenFile onto the Emscripten FS (return a real fd);
  // report existence via GetFileAttributesA so existing_file_name() finds the preloaded DATs.
  // Resolve a Windows-style path onto the FS: try it as-is (slashes normalized), then by basename
  // in the preloaded data dirs — the engine's existing_file_name() mangles paths (backslashes,
  // double-prefixing the data dir), so basename resolution finds the DATs regardless.
  $TT_resolvePath__deps: ['$FS'],
  $TT_resolvePath: function(raw) {
    var p = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
    var base = p.split('/').pop();
    var cands = [p, '/toontalk/' + base, '/toontalk/Java/' + base, '/toontalk/pics/' + base,
                 '/toontalk/pics/' + base.toLowerCase(), base];
    for (var i = 0; i < cands.length; i++) { try { FS.stat(cands[i]); return cands[i]; } catch (e) {} }
    return null;
  },
  OpenFile__deps: ['$FS', '$UTF8ToString', '$TT_resolvePath'],
  OpenFile: function(namePtr, ofstruct, style) { if (!namePtr) return -1; var r = TT_resolvePath(UTF8ToString(namePtr)); if (!r) return -1; try { return FS.open(r, 'r').fd; } catch (e) { return -1; } },
  GetFileAttributesA__deps: ['$UTF8ToString', '$TT_resolvePath'],
  GetFileAttributesA: function(namePtr) { if (!namePtr) return 0xFFFFFFFF; return TT_resolvePath(UTF8ToString(namePtr)) ? 0x80 : 0xFFFFFFFF; },

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
  GetClientRect: function(h, r) { HEAP32[r >> 2] = 0; HEAP32[(r >> 2) + 1] = 0; HEAP32[(r >> 2) + 2] = 1024; HEAP32[(r >> 2) + 3] = 768; return 1; },
  GetWindowRect: function(h, r) { HEAP32[r >> 2] = 0; HEAP32[(r >> 2) + 1] = 0; HEAP32[(r >> 2) + 2] = 1024; HEAP32[(r >> 2) + 3] = 768; return 1; },
});
