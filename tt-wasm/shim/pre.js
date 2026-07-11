// Keep the engine ticking when the tab is hidden: Chrome stops requestAnimationFrame for
// non-visible tabs, which froze the whole message loop (input queued forever and burst-replayed
// on return). Race each rAF against a 500ms timeout — visible tabs run at full rAF rate (the
// timeout is cleared), hidden tabs pump at the browser's throttled timer rate (~1-2Hz), enough
// to drain input and keep the world's clock moving.
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
  (function () {
    var origRAF = window.requestAnimationFrame.bind(window);
    var origCancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : function () {};
    var timeouts = {};                                  /* rafId -> timeoutId */
    window.requestAnimationFrame = function (cb) {
      var done = false, rafId;
      var fire = function (t) {
        if (done) return; done = true;
        clearTimeout(timeouts[rafId]); delete timeouts[rafId];
        cb(t);
      };
      rafId = origRAF(fire);
      timeouts[rafId] = setTimeout(function () { origCancel(rafId); fire(performance.now()); }, 500);
      return rafId;
    };
    window.cancelAnimationFrame = function (id) {
      clearTimeout(timeouts[id]); delete timeouts[id]; origCancel(id);
    };
  })();
}

// TT_present(pixelsPtr, w, h, palettePtr): called from the DirectDraw shim whenever the
// primary surface changes (Flip / Blt-to-primary). In a browser it paints #ttcanvas —
// 8-bit indices through the PALETTEENTRY LUT (RGB + flags, 4 bytes each) into RGBA
// ImageData, flipping rows (the surface is bottom-up, DIB-style). Headless it just counts.
var TT_ctx = null, TT_img = null, TT_presents = 0;
globalThis.TT_present = function (ptr, w, h, palPtr) {
  TT_presents++;
  if (TT_presents <= 3 || TT_presents % 300 === 0 || !globalThis.__ttDrew) {
    var nz = 0, mx = 0, histTop = {}, N = w * h;
    for (var i = 0; i < N; i++) { var v = HEAPU8[ptr + i]; if (v) { nz++; if (v > mx) mx = v; histTop[v] = (histTop[v] || 0) + 1; } }
    var top = Object.keys(histTop).sort(function (a, b) { return histTop[b] - histTop[a]; }).slice(0, 4)
      .map(function (k) { return k + 'x' + histTop[k]; }).join(',');
    if (nz > 0 && !globalThis.__ttDrew) { globalThis.__ttDrew = 1; console.log('[present] *** FIRST NON-BLANK FRAME at present #' + TT_presents + ' ***'); }
    console.log('[present] #' + TT_presents + ' ' + w + 'x' + h + ' nonzero=' + nz + '/' + N + ' maxIdx=' + mx + ' topIdx=[' + top + ']');
  }
  if (typeof document === 'undefined') return;
  var c = document.getElementById('ttcanvas');
  if (!c) return;
  if (!TT_ctx || c.width !== w || c.height !== h) {
    c.width = w; c.height = h;
    TT_ctx = c.getContext('2d');
    TT_img = TT_ctx.createImageData(w, h);
  }
  var src = HEAPU8, dst = TT_img.data;
  var pal = palPtr ? HEAPU8.subarray(palPtr, palPtr + 1024) : null;
  for (var y = 0; y < h; y++) {
    var srow = ptr + (h - 1 - y) * w, drow = y * w * 4;
    for (var x = 0; x < w; x++) {
      var p = src[srow + x], j = drow + x * 4;
      if (pal) { var k = p * 4; dst[j] = pal[k]; dst[j + 1] = pal[k + 1]; dst[j + 2] = pal[k + 2]; }
      else { dst[j] = p; dst[j + 1] = p; dst[j + 2] = p; }
      dst[j + 3] = 255;
    }
  }
  TT_ctx.putImageData(TT_img, 0, 0);
};

// Mouse tracking for GetCursorPos (overrides.js). The engine polls the absolute cursor each
// cycle (DirectInput is off), expecting engine screen pixels. Map the canvas mouse position
// (accounting for CSS scaling) into TT_mouse_x/y. Default to centre until the first move.
globalThis.TT_mouse_x = 400; globalThis.TT_mouse_y = 300;
globalThis.TT_msgq = globalThis.TT_msgq || [];
globalThis.TT_pointer_locked = false;
(function attachMouse() {
  if (typeof document === 'undefined') return;
  var c = document.getElementById('ttcanvas');
  if (!c) { setTimeout(attachMouse, 100); return; }
  var post = function (message, wParam, lParam) {
    var q = globalThis.TT_msgq;
    q.push({ message: message, wParam: wParam | 0, lParam: lParam | 0 });
    // If the loop isn't draining (hidden/throttled tab), drop the oldest — replaying a backlog
    // of stale clicks/keys when the tab becomes visible again is worse than losing them.
    while (q.length > 32) q.shift();
  };
  document.addEventListener('pointerlockchange', function () { globalThis.TT_pointer_locked = (document.pointerLockElement === c); });
  c.addEventListener('mousemove', function (e) {
    if (globalThis.TT_pointer_locked) {
      // RELATIVE_MOUSE_MODE: accumulate raw movement from the last SetCursorPos re-centre; the
      // engine reads (cursor - centre) = this movement each frame, then re-centres. No clamp — it
      // resets every frame and the engine dampens big deltas. Y is inverted because the engine's
      // delta_y = client_center_y - cursor.y (winmain.cpp:1406), so mouse-down must lower cursor.y.
      globalThis.TT_mouse_x += (e.movementX || 0);
      globalThis.TT_mouse_y -= (e.movementY || 0);
    } else {
      // Not locked (aerial/menus): absolute canvas position, CSS-scale aware.
      var r = c.getBoundingClientRect();
      var sx = r.width ? c.width / r.width : 1, sy = r.height ? c.height / r.height : 1;
      globalThis.TT_mouse_x = Math.max(0, Math.min(c.width - 1, Math.round((e.clientX - r.left) * sx)));
      globalThis.TT_mouse_y = Math.max(0, Math.min(c.height - 1, Math.round((e.clientY - r.top) * sy)));
    }
  });
  // A click engages Pointer Lock (requires a real user gesture) so the mouse drives the hand as a
  // relative device — the natural browser equivalent of ToonTalk warping the cursor each frame —
  // and is itself a game button. Esc releases the lock. Buttons -> WM_[LR]BUTTONDOWN/UP.
  c.addEventListener('mousedown', function (e) {
    e.preventDefault(); if (c.focus) c.focus();
    if (!globalThis.TT_pointer_locked && c.requestPointerLock) {
      // returns a promise in modern Chrome — a bare try/catch misses async rejections
      // (e.g. WrongDocumentError when the tab isn't visible / gesture is not accepted)
      try { var pl = c.requestPointerLock(); if (pl && pl.catch) pl.catch(function () {}); } catch (_) {}
    }
    post(e.button === 2 ? 0x0204 : 0x0201, 0, 0);
  });
  c.addEventListener('mouseup', function (e) { e.preventDefault(); post(e.button === 2 ? 0x0205 : 0x0202, 0, 0); });
  c.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // let right-click be a game button
  // Keys -> WM_KEYDOWN (virtual key) + WM_CHAR (character) so both engine paths see input.
  if (c.tabIndex < 0) c.tabIndex = 0;
  window.addEventListener('keydown', function (e) { post(0x0100, e.keyCode, 0); if (e.key && e.key.length === 1) post(0x0102, e.key.charCodeAt(0), 0); });
})();

// Runs before the engine starts: drop a ToonTalk.ini into the Emscripten FS so the config/
// directory subsystem (ini_entry -> GetPrivateProfileString) finds real values instead of NULL.
// Paths are placeholders under /toontalk/ for now (asset wiring comes later); what matters for
// boot is that [Directories] MainDir etc. are non-empty so set_directory_names doesn't crash.
Module['preRun'] = Module['preRun'] || [];
Module['preRun'].push(function () {
  var ini = [
    '[Switches]',
    'InstallCompleted=1',
    'GenerateLogs=0',
    'GenerateRobotNames=1',
    'MaximumNumberOfHoles=2048',
    'RobotCounter=50',
    'DelayBetweenTitles=0',
    '',
    '[Directories]',
    'MainDir=/toontalk/',
    'TempDir=/toontalk/temp/',
    'BuiltinPictureDir=/toontalk/pics/',
    'PictureDir=/toontalk/pictures/',
    'ClippingDir=/toontalk/clippings/',
    'MediaDir=/toontalk/media/',
    '',
    '[Versions]',
    'Language=American',
    'EnglishIsAmerican=1',
    '32Bit=1',
    '640x480=1',
    '',
    '[Executables]',
    'StringLibraryDll32=',
    'StartToonTalk=StartTT',
    'ToonTalk32=TT',
    '',
    '[FileExtensions]',
    // Built-in sprite images (al01, houseas, ...) ship as loose BMPs in the picture dir;
    // compute_full_file_name appends this extension to the bare image name -> .../al01.bmp,
    // which routes retrieve_image down the DibOpenFile path. Without it the name has no
    // extension, file_is_BMP is false, and no pixels load.
    'MissingBuiltinPictureFileExtension=bmp',
    '',
    '[Defaults]',
    'Version=3',
    'WindowSize=1',
    'MouseButtons=1',
    'SoundOn=1',
    'KindOfUser=1',
    'Language=1',
    '',
    '[User]',
    'PreviousName=Kid',
    ''
  ].join('\n');
  try { FS.mkdir('/toontalk'); } catch (e) {}
  try { FS.writeFile('/toontalk/ToonTalk.ini', ini); } catch (e) {}
  try { FS.writeFile('/ToonTalk.ini', ini); } catch (e) {}
  // Dummy string-DLL files so load_string_library's existence check (local_file_exists ->
  // CreateFile, common.cpp:132) passes. The strings themselves come from resstrings.js and
  // LoadLibrary is faked to a non-null handle; only the file's *existence* is load-bearing.
  // Country code is empty at load time so it tries "<cc>VER22.DLL" then "US"+"VER22.DLL" (warn=TRUE).
  var stub = new Uint8Array([0x4D, 0x5A]); // "MZ" — content irrelevant, presence is what matters
  ['VER22.DLL', 'USVER22.DLL'].forEach(function (n) { try { FS.writeFile('/toontalk/' + n, stub); } catch (e) {} });
});
