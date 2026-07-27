// Keep the engine ticking when the tab is hidden: Chrome stops requestAnimationFrame for
// non-visible tabs (and clamps page timers to 1Hz), which froze the whole message loop —
// input queued forever and burst-replayed on return. Dedicated-worker timers are NOT
// throttled, so a tiny worker ticks every 50ms and fires any main-loop callback that rAF
// hasn't serviced within ~100ms. Visible tabs run at full rAF rate; hidden tabs pump at
// ~10fps. A 1s setTimeout remains as a last-resort fallback if Workers are unavailable.
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
  (function () {
    var origRAF = window.requestAnimationFrame.bind(window);
    var origCancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : function () {};
    var pending = null, pendingId = 0, scheduledAt = 0, timeoutId = null;
    var firePending = function () {
      if (!pending) return;
      var cb = pending; pending = null;
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      origCancel(pendingId);
      cb(performance.now());
    };
    try {
      if (typeof Worker !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
        var w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},50);'])));
        w.onmessage = function () {
          if (pending && performance.now() - scheduledAt > 100) firePending();
        };
      }
    } catch (e) {}
    window.requestAnimationFrame = function (cb) {
      pending = cb; scheduledAt = performance.now();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(firePending, 1000);        /* fallback if no worker and no rAF */
      pendingId = origRAF(function (t) {
        if (pending === cb) {
          pending = null;
          if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
          cb(t);
        }
      });
      return pendingId;
    };
    window.cancelAnimationFrame = function (id) {
      if (id === pendingId) { pending = null; if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } }
      origCancel(id);
    };
  })();
}

// TT_present(pixelsPtr, w, h, palettePtr): called from the DirectDraw shim whenever the
// primary surface changes (Flip / Blt-to-primary). In a browser it paints #ttcanvas —
// 8-bit indices through the PALETTEENTRY LUT (RGB + flags, 4 bytes each) into RGBA
// ImageData, flipping rows (the surface is bottom-up, DIB-style). Headless it just counts.
var TT_ctx = null, TT_img = null, TT_presents = 0;
globalThis.TT_present_times = [];   // ring of recent present timestamps (for the ?fps=1 overlay)
globalThis.TT_present = function (ptr, w, h, palPtr) {
  TT_presents++;
  if (typeof performance !== 'undefined') {
    var pt = globalThis.TT_present_times;
    pt.push(performance.now());
    if (pt.length > 120) pt.shift();
  }
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
  // Surface memory is TOP-DOWN (row 0 = top scanline), matching what the engine's TT_DIRECTX
  // build expects of DirectDraw surfaces (blt_to_back_surface pre-flips its y-up marks into
  // top-down rects). Present rows straight. A bottom-up present here mirrored every sprite's
  // PLACEMENT about the horizontal midline (landing copter rose from the ground, parked copter
  // sat at the top on grass) while GDI content compensated via its own flip.
  for (var y = 0; y < h; y++) {
    var srow = ptr + y * w, drow = y * w * 4;
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
(function attachMouse() {
  if (typeof document === 'undefined') return;
  var c = document.getElementById('ttcanvas');
  if (!c) { setTimeout(attachMouse, 100); return; }
  var post = function (message, wParam, lParam) {
    if (globalThis.TT_pauseOverlay) return;   // the demo-pause chooser is modal: the game sees no input
    var q = globalThis.TT_msgq;
    q.push({ message: message, wParam: wParam | 0, lParam: lParam | 0 });
    // If the loop isn't draining (hidden/throttled tab), drop the oldest — replaying a backlog
    // of stale clicks/keys when the tab becomes visible again is worse than losing them.
    while (q.length > 32) q.shift();
  };
  // The port runs ToonTalk's native ABSOLUTE mouse mode (AbsoluteMouseMode=1 in the INI below):
  // the OS cursor stays visible and TT_mouse is simply its canvas position, CSS-scale aware.
  // No Pointer Lock — relative mode's per-frame re-centring can't be done honestly on the web.
  // The mapping accounts for letterboxing (fullscreen uses object-fit: contain, so the element
  // box can be wider/taller than the 4:3 content): scale by the CONTENT rect, not the element.
  c.addEventListener('mousemove', function (e) {
    var r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var scale = Math.min(r.width / c.width, r.height / c.height);
    if (document.pointerLockElement === c) {
      // relative mode (fullscreen): accumulate raw movement; the engine measures the delta
      // from the client centre each cycle and re-centres via SetCursorPos — the original's
      // full-screen tracking loop, closed through pointer lock.
      globalThis.TT_mouse_x = Math.max(0, Math.min(c.width - 1, globalThis.TT_mouse_x + e.movementX / scale));
      globalThis.TT_mouse_y = Math.max(0, Math.min(c.height - 1, globalThis.TT_mouse_y + e.movementY / scale));
      return;
    }
    var ox = r.left + (r.width - c.width * scale) / 2;
    var oy = r.top + (r.height - c.height * scale) / 2;
    globalThis.TT_mouse_x = Math.max(0, Math.min(c.width - 1, Math.round((e.clientX - ox) / scale)));
    globalThis.TT_mouse_y = Math.max(0, Math.min(c.height - 1, Math.round((e.clientY - oy) / scale)));
  });
  // A user gesture is required before Web Audio may start: resume the shim's AudioContext
  // (created by dsound_impl on the first Play) on any click/key/touch anywhere on the page.
  // Looping sounds (helicopter) re-Play each engine cycle, so once resumed they are heard.
  var resumeAudio = function () {
    var DS = (typeof Module !== 'undefined') && Module.TT_ds;
    if (DS && DS.ctx && DS.ctx.state === 'suspended') { try { DS.ctx.resume(); } catch (e) {} }
  };
  ['pointerdown', 'mousedown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, resumeAudio, true);
  });
  // Buttons -> WM_[LR]BUTTONDOWN/UP (position is read separately via GetCursorPos).
  // During .dmo replay the engine treats ANY button as pause/resume (original feature),
  // but the browser also needs one click as the Web-Audio gesture — swallow that first
  // click (audio only) so starting the sound doesn't silently pause the demo.
  // Lazy: TT_cmdline is assigned by the ?demo= block BELOW this attach function, so the
  // flag must be read at click time, not at attach time.
  var demoReplay = function () {
    return globalThis.TT_cmdline && globalThis.TT_cmdline.indexOf('-I ') === 0;
  };
  var firstClickSwallowed = false;
  c.addEventListener('mousedown', function (e) {
    e.preventDefault(); if (c.focus) c.focus(); resumeAudio();
    if (firstClickSwallowed === 'down') firstClickSwallowed = true; // released off-canvas: abandon the pair
    if (demoReplay() && !firstClickSwallowed) { firstClickSwallowed = 'down'; return; }
    post(e.button === 2 ? 0x0204 : 0x0201, 0, 0);
  });
  c.addEventListener('mouseup', function (e) {
    e.preventDefault();
    if (firstClickSwallowed === 'down') { firstClickSwallowed = true; return; } // matching up
    post(e.button === 2 ? 0x0205 : 0x0202, 0, 0);
  });
  c.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // let right-click be a game button
  // Keys -> WM_KEYDOWN (virtual key) + WM_CHAR (character) so both engine paths see input.
  // Held keys autorepeat in the browser, which is exactly what continuous descent ('d') needs.
  // TT_keys[vk] mirrors the physical key state for the engine's POLLED input (GetAsyncKeyState:
  // read_arrow_keys drives walking; shift/control tests) — e.keyCode is VK-compatible for the
  // keys the engine polls (arrows 37-40, shift 16, control 17).
  if (c.tabIndex < 0) c.tabIndex = 0;
  globalThis.TT_keys = {};
  // vk -> the character code the engine expects (constant.h: BACKSPACE=8 TAB=9 RETURN=13 ESCAPE=27)
  var TT_charKeys = { 8: 8, 9: 9, 13: 13, 27: 27 };
  window.addEventListener('keydown', function (e) {
    resumeAudio();
    globalThis.TT_keys[e.keyCode] = 1;
    if (!e.repeat) post(0x0100, e.keyCode, 0);
    else post(0x0100, e.keyCode, 0x40000000);   // bit 30: previous key state (autorepeat)
    if (e.key && e.key.length === 1) post(0x0102, e.key.charCodeAt(0), 0);
    // Control keys the engine reads as CHARACTERS (constant.h standard_keyboard): their
    // e.key is a word ("Backspace"), not a character, so the length-1 test above skips them.
    // Backspace = page BACK in a notebook (pad.cpp: '-' or BACKSPACE -> go_back_a_page) and
    // deletes text in pads; Tab/Return/Escape are read the same way elsewhere.
    else if (TT_charKeys[e.keyCode]) post(0x0102, TT_charKeys[e.keyCode], 0);
    // The game owns these keys — stop the browser's defaults:
    // arrows (page scroll), space (page scroll; runs tools/games), and F1-F12 (browser help /
    // find / RELOAD on F5 / fullscreen / devtools — ToonTalk maps them: F1 Marty, F2 Dusty,
    // F3 Pumpy, F4 Notebook, F5 Wand, F6 Tooly, F7 hurry up, F8 robots, F9 hide hand,
    // F10 hide this, F11 no Bammer, F12 toss).
    // Backspace (history-back in some browsers) and Tab (moves focus off the canvas) are
    // ToonTalk keys too: Backspace pages a notebook backwards, Tab is read as a character.
    if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 32 ||
        e.keyCode === 8 || e.keyCode === 9 ||
        (e.keyCode >= 112 && e.keyCode <= 123)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { delete globalThis.TT_keys[e.keyCode]; post(0x0101, e.keyCode, 0); });
  window.addEventListener('blur', function () { globalThis.TT_keys = {}; });   // don't strand held keys
})();

// ------------------------------------------------------------- demo pause chooser
// Any key or mouse button during a .dmo replay pauses the demo and asks what to do next
// (winmain.cpp:8137 for keys, :1308 for buttons -> toggle_pause -> ask_continue_or_quit). The
// original shows the DEMO_PAUSED_DIALOG resource (ttus.rc): "Back to Demo" / "Take Control" /
// "Leave Demo", left to right, with Back to Demo as the default button. Neither DialogBoxA nor
// show_html_dialog_named_in_ini_file can work in wasm, and nothing may block the browser's main
// thread, so ask_continue_or_quit calls TT_demoPause() and returns while ToonTalk stays paused;
// the click answers back through _tt_demo_pause_choice using the button numbers the engine's own
// switch already understands (1 back, 5 take control, 3 leave).
(function () {
  if (typeof document === 'undefined') return;
  var box = null;
  var answer = function (n) {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    globalThis.TT_pauseOverlay = false;
    if (typeof Module !== 'undefined' && Module['_tt_demo_pause_choice']) Module['_tt_demo_pause_choice'](n);
  };
  globalThis.TT_demoPause = function () {
    if (box) return;                        // a second Esc must not stack a second chooser
    globalThis.TT_pauseOverlay = true;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
      'background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;' +
      'font:13px "MS Sans Serif",Tahoma,sans-serif';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#d4d0c8;border:2px outset #f6f6f6;color:#000;min-width:330px';
    var caption = document.createElement('div');
    caption.textContent = 'ToonTalk Demo Paused';
    caption.style.cssText = 'background:#000080;color:#fff;font-weight:bold;padding:3px 6px';
    var text = document.createElement('div');
    text.textContent = 'ToonTalk demo has been stopped.';
    text.style.cssText = 'padding:20px 16px;text-align:center';
    var row = document.createElement('div');
    row.style.cssText = 'padding:0 12px 14px;display:flex;gap:10px;justify-content:center';
    [['Back to Demo', 1], ['Take Control', 5], ['Leave Demo', 3]].forEach(function (b, i) {
      var el = document.createElement('button');
      el.textContent = b[0];
      el.style.cssText = 'font:inherit;padding:4px 10px;min-width:96px;cursor:pointer';
      el.onclick = function () { answer(b[1]); };
      row.appendChild(el);
      if (i === 0) setTimeout(function () { try { el.focus(); } catch (e) {} }, 0);  // DEFPUSHBUTTON
    });
    panel.appendChild(caption); panel.appendChild(text); panel.appendChild(row);
    box.appendChild(panel);
    // In fullscreen only the fullscreen element's subtree is painted, so hang the chooser there.
    (document.fullscreenElement || document.body).appendChild(box);
    // Closing the dialog (SC_CLOSE) is "Back to Demo" in the original's handler.
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); answer(1); }
    });
  };
  // "Leave Demo": the original either reloads the pre-demo city or quits ToonTalk. Quitting a tab
  // leaves a dead canvas, so the port drops the ?demo= parameter and comes back up in free play.
  globalThis.TT_leaveDemo = function () {
    try {
      var u = new URL(location.href);
      u.searchParams.delete('demo');
      u.searchParams.set('cb', String(Date.now() % 100000));
      location.href = u.toString();
    } catch (e) { location.reload(); }
  };
})();

// ?demo=<name> plays one of ToonTalk's recorded .dmo demos (Demos/US in the retail install).
// The demos are NOT baked into tt.data — they total ~36MB — so fetch the one asked for and
// write it into the FS before the engine starts, then hand the engine its own command-line
// switch "-I <name>" (replay reproducing the original timing; utils.cpp interpret_command_line).
globalThis.TT_cmdline = '';
(function setUpDemo() {
  if (typeof location === 'undefined') return;
  var m = location.search.match(/[?&]demo=([A-Za-z0-9_]+)/);
  if (!m) return;
  var name = m[1];
  globalThis.TT_cmdline = '-I ' + name;
  Module['preRun'] = Module['preRun'] || [];
  Module['preRun'].push(function () {
    // Synchronous XHR: preRun must finish before main(), and the engine opens the demo
    // during initialization. (Blocking here only delays our own start-up.)
    try {
      var bytes;
      if (typeof XMLHttpRequest !== 'undefined') {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'demos/' + name + '.dmo', false);
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
        xhr.send(null);
        if (xhr.status !== 200 && xhr.status !== 0) throw new Error('HTTP ' + xhr.status);
        var s = xhr.responseText;
        bytes = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
      } else {   // node harness (run.js): read it straight off disk
        bytes = new Uint8Array(require('fs').readFileSync('demos/' + name + '.dmo'));
      }
      try { FS.mkdir('/toontalk'); } catch (e) {}
      try { FS.mkdir('/toontalk/Demos'); } catch (e) {}
      FS.writeFile('/toontalk/Demos/' + name + '.dmo', bytes);
      console.log('[tt] demo: staged ' + name + '.dmo (' + bytes.length + ' bytes)');
    } catch (e) {
      console.warn('[tt] demo: could not fetch ' + name + '.dmo — ' + e.message);
      globalThis.TT_cmdline = '';
    }
  });
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
    // Skip title-screen dwell for normal boots; during .dmo replay keep the engine's
    // default pacing so the recorded titles read at the intended speed.
    (globalThis.TT_cmdline && globalThis.TT_cmdline.indexOf('-I ') === 0 ? '' : 'DelayBetweenTitles=0'),
    // A browser is an absolute pointing device: use ToonTalk's native absolute-mouse mode
    // (built for pens/tablets) everywhere. Relative mode needs per-frame cursor re-centring,
    // which the web can only fake with Pointer Lock — and without the lock the cursor offset
    // acts as a stuck joystick (the helicopter drifted/climbed on its own and could never land).
    // EXCEPT during .dmo replay: the recordings were made and replayed under the original's
    // default RELATIVE mode (AbsoluteMouseMode is not a log-recorded option), and replay
    // interprets the recorded cursor stream through the CURRENT mode — forcing absolute made
    // the avatar wander and sit on the grass instead of entering the house (Ken 2026-07-24).
    'AbsoluteMouseMode=' + (globalThis.TT_cmdline && globalThis.TT_cmdline.indexOf('-I ') === 0 ? '0' : '1'),
    '',
    '[Directories]',
    'MainDir=/toontalk/',
    'TempDir=/toontalk/temp/',
    'BuiltinPictureDir=/toontalk/pics/',
    'PictureDir=/toontalk/pictures/',
    'ClippingDir=/toontalk/clippings/',
    'MediaDir=/toontalk/media/',
    // The retail installer writes this (Starttt.cpp:955) and the engine relies on it: the
    // time-travel buttons and the emulated pointing cursor are UserPictures asked for by BARE
    // name (log.cpp:4037, :4049), and existing_file_name only finds a bare name in the user
    // directory or on this search path. Without the entry every one of them failed name
    // resolution (retrieve_image -> compute_full_file_name FALSE), which is why the buttons
    // existed but had no image and pointing_cursor stayed NULL. '?' expands to MainDir
    // (utils.cpp:3340), matching how the installer writes it.
    'FileSearchPath=?doc',
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
    // 2 = the retail "turn tools on and off by clicking the right mouse button" option
    // (mousebut.htm). virtual_right_button() returns FALSE for non-sensor uses when the
    // count is < 2, which silently disabled right-click-uses-held-tool. Browser mice
    // always have 2+ buttons.
    'MouseButtons=2',
    'SoundOn=1',
    'KindOfUser=1',
    'Language=1',
    '',
    '[User]',
    'PreviousName=Kid',
    // Like retail: DefaultUser empty. The default-resource notebook builds its own pages, and the
    // page-6 "Examples" nested notebook (file name "6") loads <MainDir>Examples.xml.tt — a PKZIP
    // with the sample robots (Doubler, Builder, ...) — through the dunzip shim (pad.cpp ~4518).
    'DefaultUser=',
    ''
  ].join('\n');
  try { FS.mkdir('/toontalk'); } catch (e) {}
  try { FS.writeFile('/toontalk/ToonTalk.ini', ini); } catch (e) {}
  try { FS.writeFile('/ToonTalk.ini', ini); } catch (e) {}
  // The engine builds Windows-style paths ("/toontalk/Users\X\file", sometimes with MainDir
  // prefixed twice because "/"-leading paths don't look absolute to its is_absolute check).
  // The Win32 shims (CreateFile & co) normalize via TT_resolvePath, but plain C/C++ i/o
  // (ifstream in document_from_file, fopen in dunzip) hits the FS directly — so normalize
  // once here, at FS.open itself: backslashes -> slashes, collapse "//", and if MainDir got
  // doubled keep the LAST "/toontalk/" occurrence.
  var ttNorm = function (path) {
    if (typeof path !== 'string' || (path.indexOf('\\') < 0 && path.indexOf('//') < 0)) return path;
    var p = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    // The engine sometimes prefixes MainDir to a path that is ALREADY absolute ("/toontalk/" +
    // "/toontalk/pics/x" -> "/toontalk/toontalk/pics/x" once "//" collapses). Undo exactly that
    // doubling — and only that. An earlier version searched for the LAST "/toontalk/" anywhere,
    // which silently truncated legitimate paths containing the word again further along: the
    // engine extracts demo segments to "/toontalk/My Documents\ToonTalk\Temporary File Cache\",
    // so every extracted log became unopenable and .dmo replay skipped all 48 segments.
    while (/^\/toontalk\/toontalk\//i.test(p)) p = '/' + p.slice(10);
    // MainDir prepended to a Windows absolute path ("/toontalk/C:/.../toontalk/pics/x").
    if (/^\/toontalk\/[a-z]:\//i.test(p)) {
      var ix = p.toLowerCase().lastIndexOf('/toontalk/');
      if (ix > 0) p = p.slice(ix);
    }
    return p;
  };
  var origOpen = FS.open;
  FS.open = function (path, flags, mode) { return origOpen.call(FS, ttNorm(path), flags, mode); };
  var origStat = FS.stat;
  FS.stat = function (path, dontFollow) { return origStat.call(FS, ttNorm(path), dontFollow); };
  // Dummy string-DLL files so load_string_library's existence check (local_file_exists ->
  // CreateFile, common.cpp:132) passes. The strings themselves come from resstrings.js and
  // LoadLibrary is faked to a non-null handle; only the file's *existence* is load-bearing.
  // Country code is empty at load time so it tries "<cc>VER22.DLL" then "US"+"VER22.DLL" (warn=TRUE).
  var stub = new Uint8Array([0x4D, 0x5A]); // "MZ" — content irrelevant, presence is what matters
  ['VER22.DLL', 'USVER22.DLL'].forEach(function (n) { try { FS.writeFile('/toontalk/' + n, stub); } catch (e) {} });
  // Harness helper: heap accessor for run.js-side samplers (HEAPU8 lives in module scope,
  // invisible to the requiring script in Node).
  globalThis.TT_HEAPU8 = function () { return HEAPU8; };
  // Harness helper: dump the engine's tt_error_file() output (a .txt in the temp/main dir) to
  // the console — the engine's own complaints (robot failures etc.) land there, not on stdout.
  globalThis.TT_dumpErr = function () {
    var dirs = ['/toontalk/temp', '/toontalk', '/'];
    for (var d = 0; d < dirs.length; d++) {
      var names; try { names = FS.readdir(dirs[d]); } catch (e) { continue; }
      for (var i = 0; i < names.length; i++) {
        if (/\.txt$/i.test(names[i])) {
          try {
            var bytes = FS.readFile(dirs[d] + '/' + names[i]);
            var txt = ''; for (var k = Math.max(0, bytes.length - 4000); k < bytes.length; k++) txt += String.fromCharCode(bytes[k]);
            if (txt.replace(/\s/g, '').length) console.log('[errfile ' + dirs[d] + '/' + names[i] + '] ' + txt);
          } catch (e) {}
        }
      }
    }
  };
});
