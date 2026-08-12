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
      globalThis.TT_loop_alive = performance.now();   /* the engine loop RETURNED (freeze detector) */
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
          globalThis.TT_loop_alive = performance.now();   /* the engine loop RETURNED (freeze detector) */
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
var TT_ctx = null, TT_img = null, TT_img32 = null, TT_presents = 0;
globalThis.TT_presents = 0;         // mirrored so the C++ city-load probe can report frames/element
// Palette expansion runs 480,000 times a frame, so it is worth doing as one 32-bit store per
// pixel instead of four byte stores plus three palette reads. TT_lut holds each palette entry
// pre-swizzled into a packed RGBA word; it is rebuilt only when the palette bytes actually
// change (comparing 1024 bytes to decide is free next to the pixel loop it guards).
var TT_lut = new Uint32Array(256), TT_lutPal = new Uint8Array(1024), TT_lutValid = false;
var TT_little_endian = (function () {
  var b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1;
})();
// Console policy (Ken: "by default only the most important information"): the port's [tt] probes
// and the [present] framebuffer census stay available behind ?log=1 (?debug=1 also works), and
// under node, where the harness greps stdout for them. By default a browser session logs only
// what someone debugging a report would need first: failures, and the one-line load results.
var TT_verbose = (typeof location === 'undefined') ||
                 (typeof process !== 'undefined' && !!process.versions) ||
                 /[?&](log|debug)=1/.test(typeof location !== 'undefined' ? location.search : '');
globalThis.TT_verbose = TT_verbose;
(function quietStdout() {
  if (TT_verbose) return;
  var important = /error|fail|abort|warn|missing|denied|cannot|corrupt/i;
  var keep = /^\[tt\] (loadfile:|ttfile:|user:|engine)/;   // ttfile: not ttfiles:
  var quiet = function (text) {
    if (typeof text !== 'string') return false;
    if (text.lastIndexOf('[present] ', 0) === 0) return text.indexOf('***') < 0;
    if (text.lastIndexOf('[tt] ', 0) !== 0) return false;
    return !keep.test(text) && !important.test(text);
  };
  // printf from the engine and the port probes
  Module['print'] = function (text) { if (!quiet(text)) console.log(text); };
  // ...but half the probes call console.log directly (persist, lock, loopsnd, the zip layer),
  // so the same policy has to sit on console.log itself. Page-level scripts in the OUTER
  // document are unaffected -- this runs in the game page only.
  var realLog = console.log.bind(console);
  console.log = function () {
    if (arguments.length === 1 && quiet(arguments[0])) return;
    realLog.apply(null, arguments);
  };
  // stderr: emscripten's run-dependency reporter prints its whole list on an interval while
  // the opening dialog waits for a name -- minutes of "still waiting on run dependencies:
  // dependency: tt-launcher" that mean nothing is wrong. Real errors pass untouched.
  var realErr = (Module['printErr'] || console.error).bind(console);
  Module['printErr'] = function (text) {
    if (typeof text === 'string' &&
        /^(still waiting on run dependencies|dependency: |\(end of list\)|memory growth|Heap resize call from|warning: \d+ FS\.syncfs)/.test(text)) return;
    realErr(text);
  };
})();
globalThis.TT_present_times = [];   // ring of recent present timestamps (for the ?fps=1 overlay)
globalThis.TT_present = function (ptr, w, h, palPtr) {
  TT_presents++;
  globalThis.TT_presents = TT_presents;
  // When the user first sees anything. The whole of #51 is the gap between page load and this.
  if (TT_presents === 1 && typeof performance !== 'undefined') {
    globalThis.TT_firstFrameMs = Math.round(performance.now());
  }
  if (typeof performance !== 'undefined') {
    var pt = globalThis.TT_present_times;
    pt.push(performance.now());
    if (pt.length > 120) pt.shift();
  }
  // The pixel census costs a pass over the whole framebuffer; once the first non-blank frame
  // has been seen it is only worth paying for when someone is watching (?log=1).
  if (!globalThis.__ttDrew || (TT_verbose && (TT_presents <= 3 || TT_presents % 300 === 0))) {
    var nz = 0, mx = 0, histTop = {}, N = w * h;
    for (var i = 0; i < N; i++) { var v = HEAPU8[ptr + i]; if (v) { nz++; if (v > mx) mx = v; histTop[v] = (histTop[v] || 0) + 1; } }
    var top = Object.keys(histTop).sort(function (a, b) { return histTop[b] - histTop[a]; }).slice(0, 4)
      .map(function (k) { return k + 'x' + histTop[k]; }).join(',');
    if (nz > 0 && !globalThis.__ttDrew) { globalThis.__ttDrew = 1; console.log('[present] *** FIRST NON-BLANK FRAME at present #' + TT_presents + ' ***'); }
    if (TT_verbose) console.log('[present] #' + TT_presents + ' ' + w + 'x' + h + ' nonzero=' + nz + '/' + N + ' maxIdx=' + mx + ' topIdx=[' + top + ']');
  }
  if (typeof document === 'undefined') return;
  var c = document.getElementById('ttcanvas');
  if (!c) return;
  if (!TT_ctx || c.width !== w || c.height !== h) {
    c.width = w; c.height = h;
    TT_ctx = c.getContext('2d');
    TT_img = TT_ctx.createImageData(w, h);
    TT_img32 = new Uint32Array(TT_img.data.buffer);
  }
  var src = HEAPU8, dst = TT_img.data;
  var pal = palPtr ? HEAPU8.subarray(palPtr, palPtr + 1024) : null;
  if (TT_little_endian) {
    // refresh the lookup table if the palette moved or changed under us
    var stale = !TT_lutValid;
    if (!stale && pal) { for (var q = 0; q < 1024; q += 4) if (TT_lutPal[q] !== pal[q] ||
        TT_lutPal[q + 1] !== pal[q + 1] || TT_lutPal[q + 2] !== pal[q + 2]) { stale = true; break; } }
    else if (!pal) stale = !TT_lutValid;
    if (stale) {
      for (var e = 0; e < 256; e++) {
        var k4 = e * 4;
        var r = pal ? pal[k4] : e, g = pal ? pal[k4 + 1] : e, bl = pal ? pal[k4 + 2] : e;
        TT_lut[e] = (255 << 24) | (bl << 16) | (g << 8) | r;   // packed RGBA, little-endian
      }
      if (pal) TT_lutPal.set(pal);
      TT_lutValid = true;
    }
    var d32 = TT_img32, lut = TT_lut, N32 = w * h;
    for (var i32 = 0; i32 < N32; i32++) d32[i32] = lut[src[ptr + i32]];
    TT_ctx.putImageData(TT_img, 0, 0);
    return;
  }
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

// Tell the engine which mouse mode it is actually in, once, at startup.
// tt_mouse_mode defaults to RELATIVE_MOUSE_MODE (globals.cpp:729) and the only thing that ever
// changed it was tt.html's pointerlockchange handler -- so with no pointer lock there is no event,
// and the engine stays in RELATIVE mode while pre.js feeds ABSOLUTE cursor positions. It then
// reads each position as a delta from the client centre, gets the SAME non-zero delta every frame,
// and walks the hand steadily that way until it jams against the edge. That is Ken's "at the end
// of the DMO the avatar's hand moves off to the upper right corner until it can move no more":
// demo replay deliberately never takes the lock (wantLock() excludes it), so no event ever fires;
// during the demo the replay overwrites the hand from the log and hides it, and the moment the log
// runs out the drift is exposed.
// Hand the mouse back to the user in the browser-friendly ABSOLUTE mode. Called from postRun for a
// normal launch, and from log.cpp when a .dmo replay finishes (em_set_mouse_mode ignores calls made
// while replaying() is true, so the end-of-replay call is deferred a tick to land after the engine
// has left the replay state).
globalThis.TT_setMouseModeForUser = function () {
  setTimeout(function () {
    try {
      if (Module['_em_set_mouse_mode']) {
        Module['_em_set_mouse_mode']((typeof document !== 'undefined' && document.pointerLockElement) ? 0 : 1);
      }
    } catch (e) {}
  }, 0);
};
Module['postRun'] = Module['postRun'] || [];
Module['postRun'].push(function () {
  // ...but NOT while a .dmo is about to replay. postRun runs before the replay is under way, and
  // demo replay never takes the lock (above), so this passed 1 = ABSOLUTE and latched it for the
  // whole demo -- em_set_mouse_mode then refuses to correct it because replaying() is true. In
  // absolute mode a recorded click means "walk to where I am pointing" instead of "sit down", so
  // pong act 2 walked past the chair and sat 9s late (Ken #55: "5 seconds of useless walking when
  // the player should be sitting"). The INI already sets AbsoluteMouseMode=0 for a -I launch; leave
  // that alone and let TT_setMouseModeForUser() below switch to absolute when the replay ends.
  if (Module['_em_set_mouse_mode'] &&
      !(globalThis.TT_cmdline && globalThis.TT_cmdline.indexOf('-I ') === 0)) {
    Module['_em_set_mouse_mode']((typeof document !== 'undefined' && document.pointerLockElement) ? 0 : 1);
  }
  // Take the "what to run" parameters back out of the address bar once startup has read them.
  // The opening screen reloads with ?demo=<name> (or ?puzzle=N) because the engine needs its
  // command line before main() runs -- but leaving that in the URL means Reload silently re-runs
  // the demo instead of returning to the opening screen, which is not how the page behaved before
  // the launcher existed (Ken: "a refresh behaves differently than before they were added").
  // Typing such a URL still works; it just does not survive a refresh. Dev toggles (?probes,
  // ?tts, ?pointerlock) are deliberately left alone so they persist across reloads.
  try {
    if (typeof history !== 'undefined' && history.replaceState && location.search) {
      var u = new URL(location.href);
      ['demo', 'puzzle', 'segment', 'launcher', 'floor', 'cb', 'user'].forEach(function (k) {
        u.searchParams['delete'](k);
      });
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  } catch (e) {}
});
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
  // Keep the engine's idea of the mouse mode equal to the REAL pointer-lock state, checked on
  // every move rather than only at startup and on pointerlockchange. Ken: after standing up, in a
  // window, the room could only be left with the arrow keys -- the mouse did nothing -- while
  // full screen was fine. That is the signature of the engine sitting in RELATIVE mode with no
  // lock to feed it: it reads each absolute position as a delta from the client centre, gets the
  // same non-zero delta forever, and the hand jams against an edge. Whatever loses the sync (Esc
  // to stand up drops the lock, and Chrome refuses to re-grant it for a while afterwards), this
  // closes the whole class: two integers compared per move, and _em_set_mouse_mode called only
  // when the answer actually changes.
  var lastMouseMode = -1;
  var syncMouseMode = function () {
    // Not before the runtime is up: calling an exported function early ABORTS the module
    // ("native function called before runtime initialization"), and a mouse moved across the
    // canvas while the engine is still loading is an ordinary thing to do. calledRun is
    // Emscripten's own "run() has finished" flag.
    if (!Module['calledRun'] || !Module['_em_set_mouse_mode']) return;
    // While the engine replays or the time-travel panel is up, the MODE belongs to the engine
    // too: the recording carries its own mode timeline (userparams + the engine's own flips on
    // entering/leaving time travel), and this sync -- fired by the first real mouse movement --
    // overrode it once per state change and even recentred the virtual cursor. One silent flip,
    // different divergence every run: Ken's persona missed the door a different way each time
    // while the same file replayed perfectly in a pane nobody's mouse was over. Reset the cache
    // so the first movement AFTER the engine lets go re-syncs from scratch.
    if (globalThis.TT_engineReplaying || globalThis.TT_timeTravelActive) { lastMouseMode = -1; return; }
    var mode = (document.pointerLockElement === c) ? 0 : 1;
    if (mode === lastMouseMode) return;
    lastMouseMode = mode;
    try { Module['_em_set_mouse_mode'](mode); } catch (e) { return; }
    // Entering relative mode with a stale absolute position would hand the engine one large
    // bogus delta; start from the centre, which is what the original re-centred to each frame.
    if (mode === 0) { globalThis.TT_mouse_x = (c.width / 2) | 0; globalThis.TT_mouse_y = (c.height / 2) | 0; }
  };
  c.addEventListener('mousemove', function (e) {
    syncMouseMode();
    // While the engine is replaying (a demo or time travel playback) it OWNS the cursor: on
    // Windows the recorded stream warps the real cursor via SetCursorPos and those positions
    // rule; the browser cannot move the physical cursor, so the user's hand resting on the
    // time-travel panel would overwrite the replayed warps here and every replayed click/walk
    // landed offset -- Ken's persona walking into the wall beside the door. Saved DMOs replayed
    // fine only because nobody moves the mouse in a headless pane. Panel clicks are unaffected:
    // mousedown carries its own coordinates in the message. Live tracking resumes the moment
    // the engine stops replaying (TT_engineReplaying, published from the main cycle).
    // ...but NOT while the time-travel panel is up. Freezing the feed also freezes the cursor the
    // ENGINE draws, so Ken saw two arrows: the white OS one he was aiming with, and a green one
    // stranded wherever it was when he pressed Play -- "when the white arrow was moved to the
    // leftmost button the click did nothing". The user has to be able to aim at the panel while a
    // segment plays. Note the divergence this guard was added for is now known to have been the
    // mouse MODE (053a3f6/870aeee), not live cursor movement, so this may be safe to drop
    // entirely -- narrowing it first, since the panel case is the one that demonstrably hurts.
    if (globalThis.TT_engineReplaying && !globalThis.TT_timeTravelActive) return;
    // While the Marty chat is open the cursor belongs to the CHAT: in absolute mode the
    // hand follows the cursor, so reaching for the panel dragged the hand to the wall
    // beside it (Ken: "the hand moves off to a wall"). Freeze the position feed; the
    // mode sync above stays live so lock changes remain honest.
    if (globalThis.TT_chatFreeze) return;
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
  // WINDOWED TRACKING keeps the pointer-lock capture: everything TRACKS the mouse, windowed as
  // well as full screen, which is what the original did -- re-centring the cursor every frame
  // (winmain.cpp SetCursorPos(client_center)) -- and what Ken expects. Removing it gave plain
  // absolute point-and-click and he said so at once: "in window mode there is no mouse tracking
  // movement (you need to point to where to go)". The web can only close that loop with Pointer
  // Lock, so ask for it on the first click. Not during a demo: there a click means pause, and
  // capturing the mouse would be wrong.
  //
  // The cost of the capture is that Escape belongs to the BROWSER: pressing it releases the lock
  // and the key is never delivered, so windowed play needed Esc twice where full screen (which
  // has Keyboard Lock) needs one. That is repaired below by forwarding the swallowed Escape to
  // the engine when a windowed lock is lost -- restoring the original's single press rather than
  // giving up the tracking to get it.
  // ?pointerlock=0 turns the windowed capture off and goes back to plain absolute tracking.
  var lockAllowed = !(typeof location !== 'undefined' && /[?&]pointerlock=0/.test(location.search));
  var wantLock = function () {
    // demoReplay() and not the raw command line: after "Take Control" the command line still
    // says -I <demo>, but the demo is over and the user is playing — they need the mouse.
    return lockAllowed && !document.fullscreenElement &&
           document.pointerLockElement !== c && !demoReplay();
  };
  var mouseHeld = {};                 // button -> true, so a hidden tab can release what is down
  // Take the capture back on ANY user gesture -- keys included, not just clicks.
  //
  // Ken, on why clicking could never be the answer: "After standing up a mouse click will cause
  // sitting down so no way to do this." Every click in the room means something to the game, so
  // there is no spare one to spend on re-locking; the two cases where clicking did work (inside
  // the rocket, and getting into the helicopter) are the ones where a click is harmless -- and he
  // had to reach them with the ARROW KEYS first. Keydown is a user gesture too, and Chrome will
  // grant a lock from one, so the keys he is already pressing can take it back with no click and
  // nothing spent in the game.
  //
  // Ask with OPTIONS: requestPointerLock() with no argument returns undefined in Chrome and
  // reports failure only through the document's pointerlockerror event, so a version that hung
  // its logging off the return value reported nothing at all.
  // After a rejection, stop asking until the next MOUSE gesture. A held arrow key auto-repeats
  // keydown, and each repeat asked again -- in a browser that refuses keydown-initiated locks
  // that is a rejection storm, two log lines per repeat, for as long as the walk lasts (Ken's
  // console: ~60 in a row). A mousedown is the one gesture every browser accepts, so it clears
  // the backoff.
  var lockDenied = false;
  var takeLock = function () {
    // The original RELEASES the mouse for the whole of time travel (log.cpp time_travel():
    // tt_mouse_acquired = (tt_time_travel == TIME_TRAVEL_OFF), OS cursor shown) so the cursor
    // could reach anything. Mirror that: while time travel is active, never take the capture --
    // otherwise a paused session traps the cursor in the canvas and the "Save this session"
    // button below it is unreachable (Ken). time_travel() publishes the flag and also drops any
    // capture already held when time travel starts.
    if (globalThis.TT_timeTravelActive) return;
    if (lockDenied) return;
    if (!wantLock() || !c.requestPointerLock) return;
    try {
      var p = c.requestPointerLock({ unadjustedMovement: false });
      if (p && p.then) {
        p.then(function () { lockDenied = false; }, function (err) {
          lockDenied = true;
          if (globalThis.TT_verbose) console.log('[tt] lock: windowed request rejected: ' + (err && err.name));
        });
      }
    } catch (err) { if (globalThis.TT_verbose) console.log('[tt] lock: windowed request threw: ' + err); }
  };
  c.addEventListener('mousedown', function (e) {
    e.preventDefault(); if (c.focus) c.focus(); resumeAudio();
    lockDenied = false;          // a mouse gesture: every browser grants locks from these
    takeLock();
    if (firstClickSwallowed === 'down') firstClickSwallowed = true; // released off-canvas: abandon the pair
    if (demoReplay() && !firstClickSwallowed) { firstClickSwallowed = 'down'; return; }
    mouseHeld[e.button] = true;
    post(e.button === 2 ? 0x0204 : 0x0201, 0, 0);
  });
  c.addEventListener('mouseup', function (e) {
    e.preventDefault();
    delete mouseHeld[e.button];
    if (firstClickSwallowed === 'down') { firstClickSwallowed = true; return; } // matching up
    post(e.button === 2 ? 0x0205 : 0x0202, 0, 0);
  });
  // Ken: "If the tab isn't visible then don't move the avatar or its hand." Leaving a tab or
  // window delivers no keyup and no mouseup, so whatever was held stays held: TT_keys keeps
  // reporting the key to the engine's polled input (read_arrow_keys walks, 'd' descends) and the
  // engine never sees the button release, so the avatar carries on in the background and the
  // player returns to find it somewhere else. Release everything the moment the page goes away.
  // Mouse position needs no handling -- no events arrive, so it simply stops where it was.
  var releaseHeldInput = function () {
    Object.keys(mouseHeld).forEach(function (b) { post(b === '2' ? 0x0205 : 0x0202, 0, 0); });
    mouseHeld = {};
    globalThis.TT_keys = {};
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseHeldInput(); });
  globalThis.addEventListener('blur', releaseHeldInput);   // another window took focus
  // Escape, windowed. The capture means the browser takes the first Esc to release pointer lock
  // and never delivers the key, so the engine saw nothing and the user had to press twice -- once
  // for the browser, once for ToonTalk. Full screen does not have this problem because Keyboard
  // Lock hands Escape to us. Here we get the release as an event instead, so forward the press
  // the browser ate: the user pressed Escape once and meant it once.
  // Only when the lock is lost WINDOWED. Leaving full screen also drops the lock, and there the
  // key was already delivered -- forwarding again would act on one press twice.
  // The other half of the same lesson: failures arrive HERE, as an event, not as a rejected
  // promise. Say so, and try once more after Chrome's post-Escape cooldown -- the retry that used
  // to hang off a return value that was never a promise, so it never ran.
  document.addEventListener('pointerlockerror', function () {
    if (globalThis.TT_verbose) console.log('[tt] lock: pointerlockerror (windowed=' + (!document.fullscreenElement) + ')');
    // NO automatic retry. Chrome requires a user gesture to re-lock after an Escape exit, and a
    // setTimeout has none -- so a timed retry cannot succeed, and each failed attempt renews the
    // penalty period rather than waiting it out. That is why adding one made this worse instead
    // of better: Ken saw the error and the tracking never came back. Every mousedown asks anyway,
    // so the next real click is the retry, and it carries the activation this one lacked.
  });
  // Say so when the mouse needs taking back. Escape releases the capture and the browser will
  // only return it on a user gesture -- and in the room no CLICK is free, since every click there
  // means something to the game (it sits you back down). A key works and costs nothing, but there
  // is no way for a player to know that, so tell them, and stop telling them the moment it is
  // true again. Windowed only: full screen holds Escape through Keyboard Lock and never loses the
  // capture, which is worth saying in the same breath so it does not read as a fault.
  var lockHint = null;
  var showLockHint = function (show) {
    if (show && !lockHint) {
      lockHint = document.createElement('div');
      // An ARROW key specifically. Any key does take the capture back, but on the floor almost
      // any key also SITS YOU DOWN (the help text says as much: "right-click, or any key, to sit
      // down at your desk"), so "press any key" sent Ken straight back into the chair he had just
      // got out of. Arrow keys walk, which costs nothing, and they are what you reach for anyway.
      lockHint.textContent = 'Press an arrow key to steer with the mouse again — not needed in full screen';
      lockHint.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;' +
        'background:rgba(20,20,32,.92);color:#e8e8f2;font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;' +
        'padding:7px 14px;border:1px solid #44445a;border-radius:6px;z-index:9999;pointer-events:none';
      (document.getElementById('fsbox') || document.body).appendChild(lockHint);
    } else if (!show && lockHint) {
      if (lockHint.parentNode) lockHint.parentNode.removeChild(lockHint);
      lockHint = null;
    }
  };
  var hadLock = false;
  document.addEventListener('pointerlockchange', function () {
    var locked = (document.pointerLockElement === c);
    if (hadLock && !locked && !document.fullscreenElement &&
        // ...but NOT when the lock was released DELIBERATELY: time_travel() drops it so the
        // cursor can reach the page (the original releases the mouse for all of time travel),
        // and the paused chooser drops it so its buttons are clickable. Forwarding the synthetic
        // Esc in those cases fed the engine a key the user never pressed -- pressing Pause built
        // the time-travel panel and this instantly buried it under the "ToonTalk has been
        // stopped" chooser (Ken: "it is no longer clear how to get the time travel interface").
        // ...and not when the Marty chat released it on purpose (Ctrl+M): forwarding the
        // synthetic Esc made the persona STAND UP whenever the chat opened windowed (Ken).
        !globalThis.TT_timeTravelActive && !globalThis.TT_pauseOverlay &&
        !globalThis.TT_chatUnlock) {
      post(0x0100, 27, 0);        // WM_KEYDOWN VK_ESCAPE
      post(0x0102, 27, 0);        // WM_CHAR, for the engine paths that read characters
      showLockHint(true);
    }
    if (!locked) globalThis.TT_chatUnlock = false;   // one unlock consumed the exemption
    if (locked) showLockHint(false);
    hadLock = locked;
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
  // Typing into a page form field (the opening screen's name box) is not game input: without this
  // the game swallowed every keystroke typed there, and preventDefault below made Backspace (and
  // Space, and the arrows) dead in the field -- Ken: "backspace didn't work when entering my user
  // name". The browser's own editing behaviour is exactly what is wanted in that case.
  var editableTarget = function (e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable === true;
  };
  window.addEventListener('keydown', function (e) {
    if (editableTarget(e)) return;
    resumeAudio();
    // A key is a user gesture, so it can take the capture back where a click cannot -- after
    // standing up, every click means something to the game (it sits you down again), and the
    // arrow keys are what you reach for anyway. Not on Escape: that is the key that just gave
    // the lock away, and asking inside Chrome's post-Escape penalty only renews it.
    if (e.keyCode !== 27) takeLock();
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
  window.addEventListener('keyup', function (e) {
    // No editableTarget guard on the UP. A keyDOWN aimed at a text box (the Marty chat, the
    // launcher's name field) is rightly kept from the game -- but swallowing the matching UP
    // strands the key DOWN engine-side: Ctrl+M focuses the chat input, the Ctrl release then
    // landed in the input and was skipped, and with Ctrl stuck held the game seemed to ignore
    // the mouse until Alt-Tab's blur handler cleared everything (Ken). An up for a key whose
    // down the engine never saw is harmless.
    delete globalThis.TT_keys[e.keyCode]; post(0x0101, e.keyCode, 0);
  });
  window.addEventListener('blur', function () { globalThis.TT_keys = {}; });   // don't strand held keys
  // The Pause/Break key is the original's door into time travel -- and many laptop
  // keyboards no longer have one. Synthesize it: the page's Time travel button and
  // Ctrl+Z (time travel IS ToonTalk's undo) both come through here.
  globalThis.TT_pressPause = function () {
    post(0x0100, 19, 0);   // WM_KEYDOWN VK_PAUSE
    post(0x0101, 19, 0);   // WM_KEYUP
  };
  window.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    if ((e.key || '').toLowerCase() !== 'z') return;
    if (editableTarget(e)) return;   // Ctrl+Z in a text box stays text undo
    // Capture phase + stopImmediatePropagation: the game's own handlers must not also
    // see a 'z' (it would type into a held pad), and the browser has no default to run.
    e.preventDefault(); e.stopImmediatePropagation();
    globalThis.TT_pressPause();
  }, true);
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
    // Retake the pointer lock the chooser released, but only for the choices that go back to
    // playing (1 = Back to Demo / Resume, 5 = Take Control). Leaving the demo wants an ordinary
    // cursor. This runs inside the button's click handler, which is the user gesture the browser
    // requires before granting the lock again.
    if (n === 1 || n === 5) {
      var c = document.getElementById('ttcanvas');
      if (document.fullscreenElement) {
        if (c && c.requestPointerLock && document.pointerLockElement !== c) {
          try { var p = c.requestPointerLock(); if (p && p['catch']) p['catch'](function () {}); }
          catch (e) {}
        }
      } else if (globalThis.TT_fullScreenIntent && globalThis.TT_enterFullScreen) {
        // Escape can drop full screen as well as pausing, and this used to check ONLY for still
        // being in full screen -- so "Back to ToonTalk" came back windowed with no lock and no
        // tracking (Ken). The user asked for full screen and never asked to leave it, so put them
        // back; TT_enterFullScreen takes the pointer and keyboard locks with it. This runs inside
        // the button's click, which is the gesture both requests need.
        try { globalThis.TT_enterFullScreen(); } catch (e) {}
      } else if (c && c.requestPointerLock && document.pointerLockElement !== c) {
        // Plain windowed play: the chooser released the capture, so take it back or the mouse
        // comes back as point-and-click instead of tracking.
        try { var p2 = c.requestPointerLock(); if (p2 && p2['catch']) p2['catch'](function () {}); }
        catch (e) {}
      }
    }
    if (typeof Module !== 'undefined' && Module['_tt_demo_pause_choice']) Module['_tt_demo_pause_choice'](n);
  };
  // The enhanced page's Marty chat: after "Ask Marty (stays paused)" hid the chooser, a click
  // on the game means "back to playing" -- let that click answer the hidden chooser directly
  // (it is also the user gesture the pointer-lock retake inside answer() needs).
  globalThis.TT_pauseAnswer = answer;
  // Hide the chooser WITHOUT answering the engine (it stays paused). Used by the enhanced
  // page's Marty chat so a player can ask a question mid-pause and come back to this dialog;
  // call TT_demoPause(TT_pauseKind) afterwards to put the chooser back up.
  globalThis.TT_pauseHide = function () {
    if (!box) return;
    if (box.parentNode) box.parentNode.removeChild(box);
    box = null;
    globalThis.TT_pauseOverlay = false;
  };
  globalThis.TT_demoPause = function (duringDemo) {
    if (box) return;                        // a second Esc must not stack a second chooser
    duringDemo = (duringDemo === undefined) ? 1 : duringDemo;
    globalThis.TT_pauseKind = duringDemo;
    globalThis.TT_pauseOverlay = true;
    box = document.createElement('div');
    box.id = 'ttpause';
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
    // Out of a demo the original's PAUSED_DIALOG (ttus.rc:58-62) reads "Back to ToonTalk",
    // "Come back later", "Leave ToonTalk" and, on its own row, "Save Everything". "Come back
    // later" minimises the window, which means nothing for a browser tab, so it is left out;
    // the other three are the original's own wording. Save is handled below rather than through
    // a choice, so the chooser stays up and reports, as the original's does.
    (duringDemo ? [['Back to Demo', 1], ['Take Control', 5], ['Leave Demo', 3]]
                : [['Back to ToonTalk', 1], ['Leave ToonTalk', 3]]).forEach(function (b, i) {
      var el = document.createElement('button');
      el.textContent = b[0];
      el.style.cssText = 'font:inherit;padding:4px 10px;min-width:96px;cursor:pointer';
      el.onclick = function () { answer(b[1]); };
      row.appendChild(el);
      if (i === 0) setTimeout(function () { try { el.focus(); } catch (e) {} }, 0);  // DEFPUSHBUTTON
    });
    panel.appendChild(caption); panel.appendChild(text); panel.appendChild(row);
    // Ken: once in full screen you couldn't LEAVE it -- Esc lands here (keyboard lock eats the
    // browser's own exit) and none of the original's three choices mentions full screen. Offer
    // it explicitly. Clearing TT_fullScreenIntent matters: answer(1) would otherwise honour the
    // stored intent and put full screen straight back.
    var fsRow = document.createElement('div');
    fsRow.style.cssText = 'padding:0 12px 14px;text-align:center';
    var fsBtn = document.createElement('button');
    fsBtn.style.cssText = 'font:inherit;padding:4px 10px;width:100%;cursor:pointer';
    if (document.fullscreenElement) {
      fsBtn.textContent = 'Back to ToonTalk in a window';
      fsBtn.onclick = function () {
        globalThis.TT_fullScreenIntent = false;
        try { if (document.exitFullscreen) document.exitFullscreen(); } catch (e) {}
        answer(1);
      };
    } else {
      // ...and the mirror image (Ken): paused in a WINDOW, the page's own Full screen
      // button sits under this modal's backdrop, so full screen was unreachable from
      // here. Setting the intent is enough -- answer(1) honours it via
      // TT_enterFullScreen(), inside this click, which is the gesture the browser needs.
      fsBtn.textContent = 'Back to ToonTalk in full screen';
      fsBtn.onclick = function () {
        globalThis.TT_fullScreenIntent = true;
        answer(1);
      };
    }
    fsRow.appendChild(fsBtn);
    panel.appendChild(fsRow);
    // "Save Everything" -- its own full-width row in the original, and it does NOT dismiss:
    // ask_continue_or_quit's case 4 saves, reports, and leaves you still paused.
    if (!duringDemo) {
      var saveRow = document.createElement('div');
      saveRow.style.cssText = 'padding:0 12px 14px;text-align:center';
      var saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save Everything';
      saveBtn.style.cssText = 'font:inherit;padding:4px 10px;width:100%;cursor:pointer';
      var saveNote = document.createElement('div');
      saveNote.style.cssText = 'padding:6px 12px 0;text-align:center;font-size:11px';
      saveBtn.onclick = function () {
        var ok = false;
        try { ok = !!(Module['_tt_save_city'] && Module['_tt_save_city']()); } catch (e) {}
        // The city lands in the user's own folder, which is the IDBFS mount, so push it to
        // browser storage now rather than hoping the pagehide sync wins the race.
        if (ok) { try { FS.syncfs(false, function () {}); } catch (e) {} }
        saveNote.textContent = ok ? 'City saved.' : 'Could not save the city.';
      };
      saveRow.appendChild(saveBtn);
      panel.appendChild(saveRow);
      panel.appendChild(saveNote);
      // "Save this session" -- Ken's request: the page's own button sits UNDER this modal's
      // backdrop, so while the chooser is up it can be seen but not clicked. The session
      // recording is the time-travel archive, which is exactly what this dialog's moment is
      // about, so offer it here. Like Save Everything it reports and does NOT dismiss.
      if (window.TT_recording && window.TT_saveDemo) {
        var demoRow = document.createElement('div');
        demoRow.style.cssText = 'padding:8px 12px 14px;text-align:center';
        var demoBtn = document.createElement('button');
        demoBtn.textContent = 'Save this session as a demo';
        demoBtn.style.cssText = 'font:inherit;padding:4px 10px;width:100%;cursor:pointer';
        demoBtn.onclick = function () {
          var ok = false;
          try { ok = !!window.TT_saveDemo(); } catch (e) {}
          saveNote.textContent = ok ? 'Session saved as toontalk-session.dmo (check your downloads).'
                                    : 'Nothing recorded yet — play for a few seconds first.';
        };
        demoRow.appendChild(demoBtn);
        panel.appendChild(demoRow);
      }
      // Taking work away as files, and bringing it back. Ken's design: "when holding
      // something and hitting Esc an option could be to save the object to disk". These are
      // the engine's own save paths (ask_continue_or_quit's cases 7 and 4) with the result
      // downloaded instead of left in a My Documents the browser does not have. Like the
      // rows above they report and do NOT dismiss.
      var fileRow = document.createElement('div');
      fileRow.style.cssText = 'padding:8px 12px 14px;display:flex;flex-direction:column;gap:6px';
      var mkBtn = function (label, onclick) {
        var b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:inherit;padding:4px 10px;width:100%;cursor:pointer';
        b.onclick = onclick;
        fileRow.appendChild(b);
        return b;
      };
      var askName = function (what, dflt) {
        var n = prompt('Save ' + what + ' as:', dflt);
        return (n === null) ? null : (n.replace(/[^A-Za-z0-9 _.-]/g, '') || dflt);
      };
      mkBtn('Save what I am holding to a file…', function () {
        var n = askName('what you are holding', 'my ToonTalk object');
        if (n === null) return;
        var ok = false;
        try { ok = !!globalThis.TT_saveHeld(n); } catch (e) {}
        saveNote.textContent = ok ? 'Saved ' + n + '.tt — check your downloads.'
          : 'Nothing saved. Are you holding something? (Pick it up first, then press Esc.)';
      });
      mkBtn('Save this city to a file…', function () {
        var n = askName('this city', 'my ToonTalk city');
        if (n === null) return;
        var ok = false;
        try { ok = !!globalThis.TT_saveCityFile(n); } catch (e) {}
        saveNote.textContent = ok ? 'Saved ' + n + '.xml.cty — check your downloads.'
                                  : 'Could not save this city.';
      });
      mkBtn('Open a ToonTalk file from my computer…', function () {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.tt,.cty';
        input.onchange = function () {
          var f = input.files && input.files[0];
          if (!f) return;
          globalThis.TT_loadUserFile(f).then(function (r) {
            saveNote.textContent = r === 2
              ? f.name + ' loaded — it has replaced the world. Choose Back to ToonTalk.'
              : r === 1 ? f.name + ' has arrived on the floor — choose Back to ToonTalk.'
                        : 'Could not read ' + f.name + '. Is it a ToonTalk .tt or .cty file?';
          });
        };
        input.click();
      });
      panel.appendChild(fileRow);
    }
    box.appendChild(panel);
    // In fullscreen only the fullscreen element's subtree is painted, so hang the chooser there.
    (document.fullscreenElement || document.body).appendChild(box);
    // ...and give the cursor back. While the canvas holds the pointer lock the OS cursor is hidden
    // and every click is delivered to the locked element, so in full screen the three buttons
    // cannot be reached at all (Ken: "I couldn't choose between the 3 options since weren't
    // selectable by the browser's cursor. When I tabbed out and then back I was able to select an
    // option" -- tabbing away is what dropped the lock). The chooser is modal, so nothing wants
    // the lock while it is up; answer() takes it back for the choices that resume play.
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
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

// ?user=<name> opens one of the saved users that shipped with the retail product -- the Playground
// city (Users/Playground2001X) and its notebook (Users/PlaygroundBookX). link.sh mirrors them to
// build/users/<name>/ with a manifest; they are fetched into the place the engine looks for a
// user, <My Documents>\ToonTalk\<name>\ (utils.cpp:9673 builds exactly that), before main() runs.
// Held back with a run dependency because the engine reads the city during startup.
(function setUpUser() {
  if (typeof location === 'undefined') return;
  var m = location.search.match(/[?&]user=([A-Za-z0-9_]+)/);
  if (!m) return;
  var name = m[1];
  globalThis.TT_cmdline = (globalThis.TT_cmdline ? globalThis.TT_cmdline + ' ' : '') + '-n ' + name;
  Module['preRun'] = Module['preRun'] || [];
  Module['preRun'].push(function () {
    addRunDependency('tt-user');
    var dir = '/toontalk/My Documents/ToonTalk/' + name;
    var stage = function () {
    try { FS.mkdirTree(dir); } catch (e) {}
    fetch('users/' + name + '/manifest.json')
      .then(function (r) { if (!r.ok) throw new Error('no manifest'); return r.json(); })
      .then(function (list) {
        return Promise.all(list.map(function (f) {
          return fetch('users/' + name + '/' + f)
            .then(function (r) { return r.arrayBuffer(); })
            .then(function (buf) { FS.writeFile(dir + '/' + f, new Uint8Array(buf)); });
        })).then(function () {
          console.log('[tt] user: staged ' + list.length + ' files for ' + name);
        });
      })
      .catch(function (e) { console.warn('[tt] user: ' + name + ' — ' + e.message); })
      .then(function () { removeRunDependency('tt-user'); });
    };
    if (globalThis.TT_persistLoaded) {
      stage();
    } else {
      globalThis.TT_afterPersist = globalThis.TT_afterPersist || [];
      globalThis.TT_afterPersist.push(stage);
    }
  });
})();

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

// ?puzzle=N — start a NAMED puzzle, the counterpart of ?demo= for the mission game. Note this is
// the engine's "-puzzle" switch, not "-next_puzzle": -next_puzzle only turns the mission game on
// and leaves the file to resume_puzzles(), which always starts at the counter (p1). Only -puzzle
// names a file directly (utils.cpp:10940: a positive number becomes "p<N>", looked up under
// Puzzles), so it is the only way to reach a particular puzzle.
(function setUpPuzzle() {
  if (typeof location === 'undefined') return;
  var m = location.search.match(/[?&]puzzle=(\d+)/);
  if (!m) return;
  globalThis.TT_cmdline = (globalThis.TT_cmdline ? globalThis.TT_cmdline + ' ' : '') +
                          '-puzzle ' + m[1];
})();

// Does a file exist in the engine's filesystem? The opening screen uses this to avoid offering a
// choice that cannot work: the mission game needs Puzzles/US/p1.pzl, and without it the engine
// aborts before its first frame. Returns false rather than throwing while the packaged data is
// still being mounted, so callers should poll.
globalThis.TT_hasFile = function (path) {
  try { return !!(typeof FS !== 'undefined' && FS.analyzePath(path).exists); } catch (e) { return false; }
};

// The opening screen — Starttt.exe's job. In the original that was a SEPARATE PROGRAM: it put up
// its HTML dialogs, and all they did was hand back a command line for it to launch ToonTalk.exe
// with (Starttt.cpp, interpret_command_line). Reproducing that split here is not just fidelity, it
// is the only shape that works: without Asyncify nothing may block the browser's main thread
// waiting for a click, so the engine cannot ask mid-startup the way ask_what_name() does natively.
// Holding main() back with a run dependency asks BEFORE the engine starts, which is exactly when
// the original asked.
//
// Skipped when the page already says what to run (?demo=), when ?launcher=0 asks for the old
// straight-to-city behaviour, and when the page has no launcher at all.
(function gateOnLauncher() {
  if (typeof location === 'undefined') return;
  if (/[?&]demo=/.test(location.search)) return;
  if (/[?&]launcher=0/.test(location.search)) return;
  if (/[?&]puzzle=/.test(location.search)) return;   // the page has already said what to run
  if (/[?&]user=/.test(location.search)) return;     // ?user= already supplies -n <name>
  // ?floor=1 goes straight to the bootstrap floor and builds no launcher UI, so nothing would
  // ever call TT_showLauncher to release the dependency below -- the runtime sat forever on
  // "still waiting on run dependencies: tt-launcher" and the engine never started. This list has
  // to match buildLauncher's early-return list in tt.html exactly; it did not.
  if (/[?&]floor=1/.test(location.search)) return;
  Module['preRun'] = Module['preRun'] || [];
  Module['preRun'].push(function () {
    if (typeof globalThis.TT_showLauncher !== 'function') return;
    addRunDependency('tt-launcher');
    globalThis.TT_showLauncher(function (cmdline) {
      // Replaces rather than appends: the launcher supplies its own -time_travel_enabled, the
      // way askname.htm's return value did.
      globalThis.TT_cmdline = cmdline || '';
      removeRunDependency('tt-launcher');
    });
  });
})();

// Append (never prepend — the demo-replay tests check for a leading "-I ") the switch that turns
// recording off unless it was asked for. Must run after setUpDemo, which assigns TT_cmdline.
(function applyTimeTravelSwitch() {
  if (globalThis.TT_recording) return;
  // A .dmo IS a time-travel archive and the replay drives itself through tt_time_travel; turning
  // time travel off here left demogate reporting tt_enabled=0 and the segment jump never ran.
  if (typeof location !== 'undefined' && /[?&]demo=/.test(location.search)) return;
  // ?floor=1 skips the launcher, so nothing supplies the "-time_travel_enabled 1" the launcher's
  // (default-checked) box would -- it fell through to 0 here and time travel silently stopped
  // replaying, jumping straight from one checkpoint to the next exactly as the comment above
  // describes (Ken: "it jump from one checkpoint to the next - no replay"). It is a test harness
  // for the real thing, so it gets the launcher's default rather than the memory-saving one.
  if (typeof location !== 'undefined' && /[?&]floor=1/.test(location.search)) {
    globalThis.TT_cmdline = (globalThis.TT_cmdline ? globalThis.TT_cmdline + ' ' : '') +
                            '-time_travel_enabled 1';
    return;
  }
  globalThis.TT_cmdline = (globalThis.TT_cmdline ? globalThis.TT_cmdline + ' ' : '') +
                          '-time_travel_enabled 0';
})();

// FREEZE DETECTOR. A hang in the wasm main loop is otherwise indistinguishable from "the app
// stopped" (Ken: dropping "Abc" on an erased text-to-speech sensor froze it) -- and once frozen,
// nothing can be asked of the page. Presents happen every frame while the engine runs, so if the
// tab is visible, the engine has started, no modal overlay is up, and NO present has happened for
// 10 seconds, dump the last engine trace lines to the console automatically. The tail names the
// last thing the engine did before the hang.
(function freezeDetector() {
  if (typeof window === 'undefined') return;
  var fired = false;
  setInterval(function () {
    if (fired) return;
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    if (globalThis.TT_pauseOverlay) return;
    // liveness = "the engine loop RETURNED", not "a frame was presented": a paused engine
    // presents nothing but still cycles, and must not read as frozen.
    var alive = globalThis.TT_loop_alive;
    if (!alive) return;                          // engine not started (or headless)
    if (performance.now() - alive < 10000) return;
    fired = true;
    var tail = (window.TT_log || []).slice(-30);
    console.error('[tt] FROZEN: no frame presented for 10s. Last engine lines before the hang:');
    tail.forEach(function (l) { console.error('  ' + l); });
  }, 2500);
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
      // Tap the BUS, not the master: the master carries the volume setting, so with the slider at
      // zero its output is silent whatever is playing and the number answers nothing.
      if (DS.bus) DS.bus.connect(globalThis.__ttAn);
      else if (DS.master) DS.master.connect(globalThis.__ttAn);
    } catch (e) {}
  }
  var rms = 'n/a';
  try {
    var b = new Float32Array(globalThis.__ttAn.fftSize);
    globalThis.__ttAn.getFloatTimeDomainData(b);
    var t = 0; for (var i = 0; i < b.length; i++) t += b[i] * b[i];
    rms = Math.sqrt(t / b.length).toFixed(4);
  } catch (e) {}
  // A suspended context processes nothing, so a zero here means "not measured", NOT "silent".
  // Say so rather than printing a number that reads like evidence — setting the volume to zero
  // suspends the context, which is exactly when someone is most likely to be checking.
  if (DS.ctx.state !== 'running') rms += ' (NOT MEASURED — context ' + DS.ctx.state + '; use TT_audioProbe())';
  var live = Object.keys(DS.srcs).map(function (k) {
    var s = DS.srcs[k];
    return k + (s.loop ? ' LOOPING' : '') + ' ' + (s.buffer ? s.buffer.duration.toFixed(2) + 's' : '?') +
           ' gain=' + (DS.gains[k] ? DS.gains[k].gain.value.toFixed(2) : 'none');
  });
  // Sources the shim no longer tracks but which have never reported 'ended' — the state that made
  // the rotor outlive its helicopter. Listed separately because a source can be missing from
  // DS.srcs and still be connected to the speakers.
  var lost = (DS.all || []).filter(function (e) {
    return !e.ended && !e.dead && DS.srcs[e.id] !== e.src;
  }).map(function (e) { return e.id + (e.src.loop ? ' LOOPING' : ''); });
  return 'ctx=' + DS.ctx.state + ' master=' + (DS.master ? DS.master.gain.value.toFixed(2) : 'none') +
         ' volume=' + globalThis.TT_volume + ' rmsBeforeVolume=' + rms +
         ' | live sources: ' + (live.length ? live.join(' ; ') : 'NONE') +
         ' | untracked-and-unfinished: ' + (lost.length ? lost.join(' ; ') : 'NONE') +
         ' | gains held: ' + Object.keys(DS.gains).join(',');
};

// TT_audioProbe(): is anything actually generating sound RIGHT NOW, whatever the volume is set to?
// TT_audioReport() cannot answer that at volume zero — the context is suspended, so nothing is
// processed and the level reads zero no matter what. This resumes the context briefly, measures at
// the bus (upstream of the volume control, so the reading is of the sound itself rather than of the
// setting), then puts everything back exactly as it was. Nothing becomes audible: the master gain
// is held at zero for the duration. Returns a promise — call it as: await TT_audioProbe()
globalThis.TT_audioProbe = function () {
  var DS = (typeof Module !== 'undefined') && Module.TT_ds;
  if (!DS || !DS.ctx) return Promise.resolve('no audio started yet');
  var wasSuspended = DS.ctx.state !== 'running';
  var heldMaster = DS.master ? DS.master.gain.value : null;
  if (DS.master) DS.master.gain.value = 0;          // stay silent while we listen
  var restore = function () {
    if (DS.master && heldMaster !== null) DS.master.gain.value = heldMaster;
    if (wasSuspended) { try { DS.ctx.suspend(); } catch (e) {} }
  };
  return Promise.resolve(wasSuspended ? DS.ctx.resume() : null).then(function () {
    globalThis.TT_audioReport();                    // ensures the analyser exists and is wired
    return new Promise(function (done) { setTimeout(done, 300); });
  }).then(function () {
    var peak = 0, rms = 0;
    try {
      var b = new Float32Array(globalThis.__ttAn.fftSize);
      globalThis.__ttAn.getFloatTimeDomainData(b);
      var t = 0;
      for (var i = 0; i < b.length; i++) { t += b[i] * b[i]; if (Math.abs(b[i]) > peak) peak = Math.abs(b[i]); }
      rms = Math.sqrt(t / b.length);
    } catch (e) {}
    restore();
    return 'SOUND BEING GENERATED: ' + (rms > 0.0005 ? 'YES' : 'no') +
           ' (rms=' + rms.toFixed(4) + ' peak=' + peak.toFixed(4) + ', measured upstream of the ' +
           'volume control with the volume forced to silence) | ' + globalThis.TT_audioReport();
  }).catch(function (e) { restore(); return 'probe failed: ' + e; });
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
  if (!globalThis.TT_recording) {
    console.warn('[tt] save: not recording — tick "I want to be able to travel in time" on the ' +
                 'opening screen (or add ?timetravel=1 when skipping the launcher)');
    return false;
  }
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

// PERSISTENCE. The engine keeps everything about a user under <My Documents>/ToonTalk/<name>/:
// the history of what Marty has already explained (<name>.usr, written by dump_history —
// utils.cpp:466), the notebook and its pages, and any time-travel archive. All of that lived in a
// filesystem that is built fresh on every load, so nothing survived a reload and Marty greeted
// every session as the first (Ken: "Marty should remember what he has told the user").
//
// Mount that directory on IndexedDB instead. The demo temp cache is a SIBLING inside the same
// parent — extracted segments and 6MB demos — and has no business in browser storage, so a plain
// in-memory filesystem is mounted back over it once the persisted data is in.
Module['preRun'] = Module['preRun'] || [];
Module['preRun'].push(function () {
  var ROOT = '/toontalk/My Documents/ToonTalk';
  var CACHE = ROOT + '/Temporary File Cache';
  var overlayCache = function () {
    try { FS.mkdirTree(CACHE); } catch (e) {}
    try { FS.mount(MEMFS, {}, CACHE); } catch (e) { console.warn('[tt] persist: temp cache stays persistent — ' + e.message); }
  };
  try {
    if (typeof IDBFS === 'undefined') { console.warn('[tt] persist: IDBFS not linked; user data will not survive a reload'); return; }
    // The node harness has no indexedDB: IDBFS's syncfs ABORTS the whole runtime there
    // (Aborted() poisons every later wasm call — boot died right after "persist:" and the
    // harness sat pumping a dead module). Skip persistence, keep the boot.
    if (typeof indexedDB === 'undefined') {
      console.warn('[tt] persist: no indexedDB (node harness) — skipping persistence');
      overlayCache();
      globalThis.TT_persistLoaded = true;
      (globalThis.TT_afterPersist || []).forEach(function (f) { try { f(); } catch (e) {} });
      globalThis.TT_afterPersist = [];
      globalThis.TT_persistReady = true;
      return;
    }
    FS.mkdirTree(ROOT);
    FS.mount(IDBFS, {}, ROOT);
    addRunDependency('tt-persist-load');
    FS.syncfs(true, function (err) {                 // true = load what is already stored
      if (err) console.warn('[tt] persist: load failed — ' + err);
      overlayCache();
      // Anything that writes into this tree has to wait for the mount and this load, or IDBFS
      // simply replaces what it wrote (that is what swallowed the staged Playground files).
      globalThis.TT_persistLoaded = true;
      (globalThis.TT_afterPersist || []).forEach(function (f) { try { f(); } catch (e) {} });
      globalThis.TT_afterPersist = [];
      var names = [];
      try { names = FS.readdir(ROOT).filter(function (n) { return n !== '.' && n !== '..'; }); } catch (e) {}
      console.log('[tt] persist: loaded, ' + ROOT + ' holds [' + names.join(', ') + ']');
      globalThis.TT_persistReady = true;
      removeRunDependency('tt-persist-load');
    });
  } catch (e) {
    console.warn('[tt] persist: ' + e.message);
    overlayCache();
  }
});

// Write the user's data back. Called on a timer and whenever the page is hidden or closed —
// syncfs is asynchronous, so a save started at pagehide may not finish, which is why it also runs
// periodically rather than only on the way out.
globalThis.TT_persistSave = function (why) {
  if (!globalThis.TT_persistReady) return false;
  try {
    FS.syncfs(false, function (err) {
      if (err) console.warn('[tt] persist: save failed — ' + err);
      else if (why) console.log('[tt] persist: saved (' + why + ')');
    });
    return true;
  } catch (e) { return false; }
};
if (typeof window !== 'undefined') {
  setInterval(function () { globalThis.TT_persistSave(); }, 10000);
  window.addEventListener('pagehide', function () { globalThis.TT_persistSave('pagehide'); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') globalThis.TT_persistSave('hidden');
  });
}

// Runs before the engine starts: drop a ToonTalk.ini into the Emscripten FS so the config/
// directory subsystem (ini_entry -> GetPrivateProfileString) finds real values instead of NULL.
// Paths are placeholders under /toontalk/ for now (asset wiring comes later); what matters for
// boot is that [Directories] MainDir etc. are non-empty so set_directory_names doesn't crash.
// Is this boot running a MISSION? Two switches can say so and they differ:
//   -puzzle <n>       names a specific puzzle file (what ?puzzle=N sends)
//   -next_puzzle <n>  turns the mission game on -- and "-next_puzzle 0" is FREE PLAY, which is
//                     exactly what starttt.htm's Free Play button sends, so here the number
//                     matters rather than the presence of the switch.
function ttIsPuzzle() {
  var c = globalThis.TT_cmdline || '';
  if (/(^|\s)-puzzle\s+\S+/.test(c)) return true;
  var m = /-next_puzzle\s+(\d+)/.exec(c);
  return !!(m && Number(m[1]) > 0);
}

Module['preRun'] = Module['preRun'] || [];
Module['preRun'].push(function () {
  var ini = [
    '[Switches]',
    // The rest of the original's [Switches], carried across with ITS values. The retail ini has 41
    // keys and the port was synthesising 13; the same comparison already turned up three real
    // divergences (Pumpy, Dusty, GoodSizes below) and the missing-language bug, because a key the
    // port omits falls back to whatever globals.cpp happens to default to, which is not always
    // what the shipped product runs with. Omitted deliberately: the joystick, DispDIB, shell,
    // crash-directory, applet and installer keys, which have no meaning in a browser.
    'ClipboardTextMayBeUnicode=0',       // CF_TEXT vs CF_UNICODETEXT in the clipboard sensor
    'ShowMouseCursor=0',
    'ExclusiveMouseOK=0',
    'DontScrollOnFloor=0',
    'SensorsChangeAtDropNotWhenBammed=0',
    'SpeakToolButtons=1',
    'SubtitlesSpeed=100',
    'DisplayAvailableSubtitlesInDemos=1',
    'ColorSelectionFeedback=1',
    'MovementSelectionFeedback=2',
    'MaximumItemsInDusty=100',
    'KeepAllTimeTravelSegments=0',
    'MaximumNumberOfTimeLines=10',
    'IncludeMediaInTimeTravelArchives=0',
    'SaveInXML=1',
    'InstallCompleted=1',
    'GenerateLogs=0',
    'GenerateRobotNames=1',
    'MaximumNumberOfHoles=2048',
    'RobotCounter=50',
    // Ken: "Pumpy when used with the right press keeps pumping for a short while after releasing
    // the right button", and against the original "it stops pumpy very soon after releasing".
    // tt_expander_usage_maximum defaults to -1, meaning NO maximum (globals.cpp:784), which makes
    // Expander::used_once_per_click() permanently false, so used_enough() is never true and
    // turn_off() is never reached -- the pump runs on for as long as anything sits under the hose.
    // The value below is not invented: it is what the original's own toontalk.ini carries, in all
    // three copies on this machine (C:\Windows, Documents\ToonTalk, and the VirtualStore).
    'MillisecondsPumpyUsedPerClick=500',
    // Dusty has the same divergence, found by the same comparison: tt_vacuum_used_once_per_click
    // defaults to FALSE (globals.cpp:783) and the original's ini sets DustyUsedOncePerClick=1.
    // The flag is read inverted -- "if (is_on() && !tt_vacuum_used_once_per_click)" at
    // tools.cpp:1939 -- so the port's vacuum STAYS ON where the original's is once per click.
    'DustyUsedOncePerClick=1',
    // Sizing: tt_good_sizes_adjust_to_screen_size defaults to FALSE (globals.cpp:566) and the read
    // is INVERTED -- utils.cpp:12097 does "= !ini_int(...)" -- so the original's own value of 0
    // sets it TRUE while the port, setting nothing, left it FALSE. Candidate for Ken's stretched
    // synthetic shapes ("the circle and square are not stretched" in the original), since
    // draw_synthetic_shape just fills whatever box the sizing path hands it.
    'GoodSizesAreAFixedPercentageOfScreen=0',
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
    // The titles run in both modes (for a mission they also carry the four back-story screens),
    // but at the browser's pace, not the CD-ROM's: the engine's five seconds per screen -- and
    // the TEN it sets itself for the mission story -- are a long sit in a tab (Ken: "10 seconds
    // is too long - 3 seconds is ok"). A click still moves on immediately. The puzzle
    // constructor's own 10-second override yields to this value in the wasm build
    // (Programmer_Titles_Flying::Programmer_Titles_Flying).
    'DelayBetweenTitles=3',
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
    // BOTH spellings, and the numbered one is the one that matters. winmain.cpp resolves the
    // language by first reading [Defaults] Language (the language the user picked, = 1 below) and
    // then looking up "Language" + that number here -- so with only 'Language=' present the read
    // returned NULL, tt_language fell through to UNKNOWN_LANGUAGE (13), and every string indexed
    // BY LANGUAGE missed. That is what made the Hand Visible?, Shift? and Control? sensors read
    // "Ahh, sorry I can't remember what I was going to say...": their text is
    // SC(IDS_YES + 2*(language-AMERICAN)), which at language 13 asks for id 2574 and gets the
    // engine's no-such-string apology -- a long sentence, hence Ken's pad running off the screen.
    'Language1=American',
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
  // The player's situation (location, hand, pocket) as UTF-8 text — the Marty AI page and
  // the node harness both read it through this accessor since Module/UTF8ToString live in
  // module scope. Empty string until the runtime is up.
  globalThis.TT_martyContext = function () {
    try {
      // TT_loop_alive is stamped by the running main loop — a reliable "runtime is up"
      // signal in both the browser and the node harness (Module['calledRun'] is not:
      // it stays unset under node's require()).
      if (!globalThis.TT_loop_alive || !Module['_tt_marty_context']) return '';
      return UTF8ToString(Module['_tt_marty_context']()) || '';
    } catch (e) { return ''; }
  };
  // Put one of the Infinity activity's ToonTalk files into the world that is already running,
  // for the activities page's "load what this activity needs" buttons. `name` is the full file
  // name, extension included -- resort_infinity.xml.cty is a CITY, not an object. Returns 0 if
  // the engine is not up yet or the load failed, 1 for an object (now pending for the hand),
  // 2 for a city (the world was replaced) -- so the caller can say what actually happened.
  globalThis.TT_loadMaterial = function (name) {
    try {
      if (!globalThis.TT_loop_alive || !Module['_tt_load_pending_file']) return 0;
      globalThis.TT_pendingLoad = name;
      return Module['_tt_load_pending_file']() | 0;
    } catch (e) { return 0; }
  };
  // ---- taking your work away, and bringing it back ------------------------------------
  // ToonTalk has always been able to write what you are holding, or the whole city, to a
  // file; natively they land in My Documents. A browser tab has no My Documents, so the
  // engine writes into /toontalk/save and these hand the bytes to the browser as a download.
  // Reading one back needs no new engine code at all: it is the same sprite_from_file_name
  // the double-click path uses, pointed at a file we wrote into /toontalk/loaded.
  var download = function (path, suggested) {
    var bytes;
    try { bytes = FS.readFile(path); } catch (e) { return false; }
    // slice() so the Blob owns its own copy: FS.readFile hands back a view on the wasm heap,
    // which can be detached by a memory growth before the download finishes.
    var blob = new Blob([bytes.slice().buffer], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = suggested;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
    return true;
  };
  // Write the file and return where it landed, or null. Separate from the download so the
  // node harness -- which has no document to download into, and cannot see Module from
  // outside this scope -- can test the engine half on its own.
  globalThis.TT_writeSave = function (kind, name) {
    var fn = (kind === 'city') ? '_tt_save_city_to_file' : '_tt_save_in_hand';
    try {
      if (!globalThis.TT_loop_alive || !Module[fn]) return null;
      globalThis.TT_saveName = (name || 'ToonTalk').replace(/[^A-Za-z0-9 _.-]/g, '') || 'ToonTalk';
      globalThis.TT_savedPath = null;
      if (!Module[fn]()) return null;
      return globalThis.TT_savedPath || null;
    } catch (e) { return null; }
  };
  var saveThrough = function (kind, name, fallbackExt) {
    var p = globalThis.TT_writeSave(kind, name);
    if (!p) return false;
    return download(p, p.split('/').pop() || (globalThis.TT_saveName + fallbackExt));
  };
  // What you are holding, as a .tt file. Returns false if your hand is empty.
  globalThis.TT_saveHeld = function (name) { return saveThrough('held', name, '.tt'); };
  // The whole city, as a .xml.cty file.
  globalThis.TT_saveCityFile = function (name) { return saveThrough('city', name, '.xml.cty'); };
  // A file the player picked from their own disk: write it where the engine can see it, then
  // load it exactly as a double-clicked .tt is loaded. Objects arrive on the floor; a city
  // replaces the world. Returns a promise for 0 (failed) / 1 (object) / 2 (city).
  globalThis.TT_loadUserFile = function (file) {
    return new Promise(function (resolve) {
      if (!file) return resolve(0);
      var reader = new FileReader();
      reader.onerror = function () { resolve(0); };
      reader.onload = function () {
        try {
          FS.mkdirTree('/toontalk/loaded');
          var safe = file.name.replace(/[^A-Za-z0-9_.-]/g, '_');
          var path = '/toontalk/loaded/' + safe;
          FS.writeFile(path, new Uint8Array(reader.result));
          globalThis.TT_pendingLoad = path;
          resolve(Module['_tt_load_pending_file'] ? (Module['_tt_load_pending_file']() | 0) : 0);
        } catch (e) { console.log('[tt] loadfile: ' + e); resolve(0); }
      };
      reader.readAsArrayBuffer(file);
    });
  };
  // Harness helper: how big is a file in the engine's filesystem (FS is module-scoped).
  globalThis.TT_fileSize = function (path) {
    try { return FS.readFile(path).length; } catch (e) { return -1; }
  };
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
