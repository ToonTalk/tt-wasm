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
    if (globalThis.TT_volume === 0) return;   // the user muted it; a click is not a request to unmute
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
    // Only while a demo is actually PLAYING. Once it ends the engine hands over the time-travel
    // controls, and swallowing a click there costs the user their first press on a button --
    // they have to click twice with no indication why. TT_replayOver is set by the end-of-demo
    // watcher below.
    return globalThis.TT_cmdline && globalThis.TT_cmdline.indexOf('-I ') === 0
           && !globalThis.TT_replayOver;
  };
  var firstClickSwallowed = false;
  // WINDOWED TRACKING. The engine's absolute mode places the hand at the cursor, which is only as
  // fine as the canvas is big: in a panel 800x600 renders at ~360px, so one mouse pixel becomes
  // 2.2 hand pixels and the hand lurches (Ken: full screen "reacts well to mouse movements but it
  // doesn't work in a panel"). Full screen feels right because it is near 1:1 AND accumulates raw
  // movement through pointer lock -- which is also what the original did windowed, re-centring the
  // cursor every frame (winmain.cpp SetCursorPos(client_center)). The web can only close that loop
  // with Pointer Lock, so ask for it on the first click. Not during a demo: there a click means
  // pause, and capturing the mouse would be wrong.
  // ?pointerlock=0 turns the windowed capture off and goes back to plain absolute tracking.
  // Ken reports the mouse going unresponsive after training a robot or standing up, which this
  // capture is the prime suspect for — an escape hatch while that is investigated.
  var lockAllowed = !(typeof location !== 'undefined' && /[?&]pointerlock=0/.test(location.search));
  var wantLock = function () {
    // demoReplay() and not the raw command line: after "Take Control" the command line still
    // says -I <demo>, but the demo is over and the user is playing — they need the mouse.
    return lockAllowed && !document.fullscreenElement &&
           document.pointerLockElement !== c && !demoReplay();
  };
  c.addEventListener('mousedown', function (e) {
    e.preventDefault(); if (c.focus) c.focus(); resumeAudio();
    if (wantLock() && c.requestPointerLock) {
      // Chrome rejects a lock requested too soon after the user escaped the last one; that is
      // fine, the next click gets it.
      try { var p = c.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (err) {}
    }
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
  globalThis.TT_demoPause = function (duringDemo) {
    if (box) return;                        // a second Esc must not stack a second chooser
    duringDemo = (duringDemo === undefined) ? 1 : duringDemo;
    globalThis.TT_pauseOverlay = true;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
      'background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;' +
      'font:13px "MS Sans Serif",Tahoma,sans-serif';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#d4d0c8;border:2px outset #f6f6f6;color:#000;min-width:330px';
    var caption = document.createElement('div');
    caption.textContent = duringDemo ? 'ToonTalk Demo Paused' : 'ToonTalk Paused';
    caption.style.cssText = 'background:#000080;color:#fff;font-weight:bold;padding:3px 6px';
    var text = document.createElement('div');
    text.textContent = duringDemo ? 'ToonTalk demo has been stopped.' : 'ToonTalk has been stopped.';
    text.style.cssText = 'padding:20px 16px;text-align:center';
    var row = document.createElement('div');
    row.style.cssText = 'padding:0 12px 14px;display:flex;gap:10px;justify-content:center';
    // Out of a demo there is nothing to go "back" to and no demo to take control OF: the only
    // meaningful choices are carry on or leave. Same button numbers either way — 1 resumes.
    (duringDemo ? [['Back to Demo', 1], ['Take Control', 5], ['Leave Demo', 3]]
                : [['Resume', 1], ['Leave ToonTalk', 3]]).forEach(function (b, i) {
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
// ?timetravel=1 records free play so you can rewind it, and offers it as a .dmo to save.
// Off by default: recording writes a full city snapshot every 10 seconds into the in-memory
// filesystem, which in a browser tab is memory the user did not ask to spend. -time_travel_enabled
// is the engine's own switch (utils.cpp:11018); demos ignore this since a replay sets its own
// time-travel state.
globalThis.TT_recording = false;
(function setUpTimeTravel() {
  if (typeof location === 'undefined') return;
  globalThis.TT_recording = /[?&]timetravel=1/.test(location.search) && !/[?&]demo=/.test(location.search);
})();

globalThis.TT_cmdline = '';
(function setUpDemo() {
  if (typeof location === 'undefined') return;
  var m = location.search.match(/[?&]demo=([A-Za-z0-9_]+)/);
  if (!m) return;
  var name = m[1];
  globalThis.TT_cmdline = '-I ' + name;
  // ?segment=N starts the replay at log segment N (the engine's own -segment option,
  // utils.cpp:10831). A demo is dozens of segments — explode2 has 48 — so this is the only
  // practical way to test what happens at the END of a demo without watching all of it.
  var seg = location.search.match(/[?&]segment=(\d+)/);
  if (seg) globalThis.TT_cmdline += ' -segment ' + seg[1];
  Module['preRun'] = Module['preRun'] || [];
  Module['preRun'].push(function () {
    // A .dmo the user opened from their own machine lives in IndexedDB (see TT_playLocalDemo).
    // Reading it is asynchronous, so hold the runtime back with a run dependency rather than
    // letting main() start without the file.
    if (name === 'picked') {
      addRunDependency('tt-picked-demo');
      var done = function (bytes, base) {
        try {
          if (bytes && bytes.length) {
            if (!base) base = 'picked';
            try { FS.mkdir('/toontalk'); } catch (e) {}
            try { FS.mkdir('/toontalk/Demos'); } catch (e) {}
            FS.writeFile('/toontalk/Demos/' + base + '.dmo', bytes);
            // Point the engine at the file under its own name, so <name>.ust resolves.
            globalThis.TT_cmdline = globalThis.TT_cmdline.replace(/^-I \S+/, '-I ' + base);
            console.log('[tt] demo: staged ' + base + '.dmo (' + bytes.length + ' bytes)');
          } else {
            console.warn('[tt] demo: nothing stored for the picked demo');
            globalThis.TT_cmdline = '';
          }
        } catch (e) {
          console.warn('[tt] demo: could not stage the picked demo — ' + e.message);
          globalThis.TT_cmdline = '';
        }
        removeRunDependency('tt-picked-demo');
      };
      try {
        var open = indexedDB.open('toontalk', 1);
        open.onupgradeneeded = function () { open.result.createObjectStore('files'); };
        open.onsuccess = function () {
          var db = open.result;
          try {
            var get = db.transaction('files', 'readonly').objectStore('files').get('pickedDemo');
            get.onsuccess = function () {
              var v = get.result; db.close();
              if (v && v.bytes) done(new Uint8Array(v.bytes), v.name);   /* {name, bytes} */
              else if (v) done(new Uint8Array(v), null);                 /* bytes stored by an older build */
              else done(null, null);
            };
            get.onerror = function () { db.close(); done(null, null); };
          } catch (e) { db.close(); done(null, null); }
        };
        open.onerror = function () { done(null, null); };
      } catch (e) { done(null, null); }
      return;
    }
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

// Append (never prepend — the demo-replay tests check for a leading "-I ") the switch that turns
// recording off unless it was asked for. Must run after setUpDemo, which assigns TT_cmdline.
(function applyTimeTravelSwitch() {
  if (globalThis.TT_recording) return;
  // A .dmo IS a time-travel archive and the replay drives itself through tt_time_travel; turning
  // time travel off here left demogate reporting tt_enabled=0 and the segment jump never ran.
  if (typeof location !== 'undefined' && /[?&]demo=/.test(location.search)) return;
  globalThis.TT_cmdline = (globalThis.TT_cmdline ? globalThis.TT_cmdline + ' ' : '') +
                          '-time_travel_enabled 0';
})();

// Master volume, 0..1. Drives the one gain node every sound passes through (dsound_impl.cpp) and
// the loudness of Marty's synthesised speech, which speechSynthesis caps at 1.0 and which is
// otherwise quieter than the recorded narration.
// Do NOT clobber: tt.html restores the saved setting into TT_volume from its inline script, which
// runs BEFORE tt.js loads this file. Assigning 1 unconditionally threw that away, so a page
// reloaded with the slider at minimum came back up silent-looking but at full volume — the
// helicopter kept droning with the control showing zero (Ken).
if (globalThis.TT_volume === undefined) globalThis.TT_volume = 1;
globalThis.TT_setVolume = function (v) {
  v = Math.max(0, Math.min(1, Number(v)));
  globalThis.TT_volume = v;
  try {
    var DS = Module.TT_ds;
    if (DS && DS.master) DS.master.gain.value = v;
    // Belt and braces at the ends of the range. A looping effect (the helicopter) is started once
    // and runs for minutes, so anything that ever let one bypass the master would keep sounding
    // with the control at zero — which is what Ken reported. Suspending the context cannot be
    // bypassed by any node, so zero is silent whatever the graph looks like.
    if (DS && DS.ctx) {
      if (v === 0) { if (DS.ctx.state === 'running') DS.ctx.suspend(); }
      else if (DS.ctx.state === 'suspended') { DS.ctx.resume(); }
    }
  } catch (e) {}
  return v;
};

// TT_audioReport(): what is making noise RIGHT NOW. Run it from the console at the moment a sound
// is wrong and paste the result — it turns "I can still hear the helicopter" into something
// checkable. Reports every live source with its length and whether it loops, the gain each one
// carries, the master setting, and the measured signal level at the master's output, so a sound
// that is playing with no source registered (or a registered source that is silent) is obvious.
globalThis.TT_audioReport = function () {
  var DS = (typeof Module !== 'undefined') && Module.TT_ds;
  if (!DS || !DS.ctx) return 'no audio started yet';
  if (!DS.__an) { try { DS.__an = DS.ctx.createGain(); } catch (e) {} }
  if (!globalThis.__ttAn) {
    try {
      globalThis.__ttAn = DS.ctx.createAnalyser();
      globalThis.__ttAn.fftSize = 2048;
      if (DS.master) DS.master.connect(globalThis.__ttAn);
    } catch (e) {}
  }
  var rms = 'n/a';
  try {
    var b = new Float32Array(globalThis.__ttAn.fftSize);
    globalThis.__ttAn.getFloatTimeDomainData(b);
    var t = 0; for (var i = 0; i < b.length; i++) t += b[i] * b[i];
    rms = Math.sqrt(t / b.length).toFixed(4);
  } catch (e) {}
  var live = Object.keys(DS.srcs).map(function (k) {
    var s = DS.srcs[k];
    return k + (s.loop ? ' LOOPING' : '') + ' ' + (s.buffer ? s.buffer.duration.toFixed(2) + 's' : '?') +
           ' gain=' + (DS.gains[k] ? DS.gains[k].gain.value.toFixed(2) : 'none');
  });
  return 'ctx=' + DS.ctx.state + ' master=' + (DS.master ? DS.master.gain.value.toFixed(2) : 'none') +
         ' volume=' + globalThis.TT_volume + ' rmsAtMaster=' + rms +
         ' | live sources: ' + (live.length ? live.join(' ; ') : 'NONE') +
         ' | gains held: ' + Object.keys(DS.gains).join(',');
};

// Play a .dmo the user picked off their own machine. ?demo=<name> can only name a file the SERVER
// has (it is fetched as demos/<name>.dmo), and a browser cannot open an arbitrary local path — so
// a session saved from this page needs a file picker to get back in.
globalThis.TT_playLocalDemo = function (file) {
  if (!file) return false;
  var reader = new FileReader();
  reader.onerror = function () { alert('Could not read that file.'); };
  reader.onload = function () {
    var bytes = new Uint8Array(reader.result);
    // The engine opens the demo during initialization, so this needs a fresh boot — and a reload
    // wipes the in-memory filesystem, so the bytes have to be parked somewhere that survives it.
    // IndexedDB, not sessionStorage: the shipped demos run to several MB and blew the ~5MB string
    // quota (Ken hit this picking the first Pong demo).
    var fail = function (why) {
      console.warn('[tt] demo: could not stage ' + file.name + ' — ' + why);
      alert('Could not open that file: ' + why);
    };
    try {
      var open = indexedDB.open('toontalk', 1);
      open.onupgradeneeded = function () { open.result.createObjectStore('files'); };
      open.onerror = function () { fail('this browser would not open local storage'); };
      open.onsuccess = function () {
        var db = open.result;
        try {
          var tx = db.transaction('files', 'readwrite');
          // Keep the ORIGINAL base name with the bytes. The narration/subtitle script inside a
          // .dmo is named after the demo (<name>.ust, log.cpp:309), so staging every picked file
          // as "picked.dmo" made that lookup ask for picked.ust and find nothing — the demo
          // played silently with no subtitles (Ken: "pongact1 worked but there was no narration").
          var base = String(file.name).replace(/^.*[\\\/]/, '').replace(/\.[^.]*$/, '')
                                      .replace(/[^A-Za-z0-9_]/g, '_');
          if (!base) base = 'picked';
          tx.objectStore('files').put({ name: base, bytes: bytes }, 'pickedDemo');
          tx.oncomplete = function () {
            db.close();
            console.log('[tt] demo: parked ' + file.name + ' (' + bytes.length + ' bytes) — reloading');
            location.search = '?demo=picked';
          };
          tx.onerror = function () { db.close(); fail(tx.error ? tx.error.message : 'storage error'); };
        } catch (e) { db.close(); fail(e.message); }
      };
    } catch (e) { fail(e.message); }
  };
  reader.readAsArrayBuffer(file);
  return true;
};

// Save the recorded session as a .dmo. Asks the engine to bring the archive up to date first --
// the segment in progress is not in it until it is closed — then hands the bytes to the browser
// as a download. Exposed on the page so the button in tt.html (and the console) can call it.
globalThis.TT_saveDemo = function () {
  if (!globalThis.TT_recording) { console.warn('[tt] save: not recording — reload with ?timetravel=1'); return false; }
  var pathPtr = Module['_tt_finish_time_travel_archive'] && Module['_tt_finish_time_travel_archive']();
  if (!pathPtr) { console.warn('[tt] save: no time-travel archive yet'); return false; }
  var path = UTF8ToString(pathPtr).replace(/\\/g, '/').replace(/\/+/g, '/');
  var bytes;
  try { bytes = FS.readFile(path); }
  catch (e) { console.warn('[tt] save: cannot read ' + path + ' — ' + e.message); return false; }
  var blob = new Blob([bytes], {type: 'application/octet-stream'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'toontalk-session.dmo';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  console.log('[tt] save: ' + path + ' (' + bytes.length + ' bytes)');
  return true;
};

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
    // tt_exit_at_end_of_log defaults to TRUE (globals.cpp:604) and nothing was overriding it, so
    // reaching the end of a demo QUIT instead of handing over the time-travel controls: one_tt_cycle
    // returns FALSE the moment replaying() goes false (Main.cpp:1293), and stop_replay takes its
    // set_user_wants_to_quit branch rather than setting tt_time_travel_after_display_updated
    // (log.cpp:1224-1239 — the comment there is explicit that the point is "at the end of a demo
    // rather than begin recording you get the time travel buttons"). Ken: "when a demo ends there
    // isn't a way to get the time travel interface to go back in time." A browser tab is not a
    // kiosk that should exit, so turn the option off — it is the engine's own switch, read at
    // log.cpp:1918.
    'ExitWhenDemoEnds=0',
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
  // Windows file names are case-INSENSITIVE and the engine relies on it: swap2's narration script
  // asks for "us\s01.wav" while the archive stores the member as "US/s01.wav", so the demo played
  // with subtitles but no voice (Ken). MEMFS is case-sensitive, so when an exact path is missing,
  // walk it component by component and accept a unique case-insensitive match — which is what the
  // engine would have got on the platform it was written for. Only on the miss path, so correctly
  // cased lookups cost nothing.
  var ttCaseFix = function (p) {
    if (typeof p !== 'string' || p.charAt(0) !== '/') return p;
    var parts = p.split('/'), cur = '';
    for (var i = 1; i < parts.length; i++) {
      var want = parts[i];
      if (want === '') continue;
      var trial = cur + '/' + want;
      var ok = false;
      try { FS.lookupPath(trial); ok = true; } catch (e) {}
      if (!ok) {
        var names = [];
        try { names = FS.readdir(cur === '' ? '/' : cur); } catch (e) { return p; }
        var lower = want.toLowerCase(), hit = null, many = false;
        for (var j = 0; j < names.length; j++) {
          if (names[j].toLowerCase() === lower) { if (hit === null) hit = names[j]; else many = true; }
        }
        if (hit === null || many) return p;    // no match, or ambiguous: leave it alone
        trial = cur + '/' + hit;
      }
      cur = trial;
    }
    return cur;
  };
  var ttPath = function (path) {
    var p = ttNorm(path);
    if (typeof p !== 'string') return p;
    try { FS.lookupPath(p); return p; } catch (e) {}
    return ttCaseFix(p);
  };
  var origOpen = FS.open;
  FS.open = function (path, flags, mode) {
    // only rescue reads; a create/write must use the name it was given
    var writing = (typeof flags === 'string') ? /[wa+]/.test(flags) : !!(flags & 3);
    return origOpen.call(FS, writing ? ttNorm(path) : ttPath(path), flags, mode);
  };
  var origStat = FS.stat;
  FS.stat = function (path, dontFollow) { return origStat.call(FS, ttPath(path), dontFollow); };
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
