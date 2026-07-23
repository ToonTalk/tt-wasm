// Node test harness: emscripten's fps=0 main loop uses requestAnimationFrame,
// which node lacks — polyfill it with setTimeout so frames pump headlessly.
// (In the real browser target, the native rAF drives it.)
if (process.env.TT_FLOOR) globalThis.location = { search: "?floor=1" };
// TT_DEMO=<name>: replay a recorded .dmo demo (build/demos/<name>.dmo), same path as ?demo= in the browser
if (process.env.TT_DEMO) globalThis.location = { search: "?demo=" + process.env.TT_DEMO };
if (process.env.TT_COPYROBOTS) globalThis.location = { search: "?floor=1&copyrobots=1" + (process.env.TT_ROBOTPAGE ? "&robotpage=" + process.env.TT_ROBOTPAGE : "") + (process.env.TT_SUBPAGE ? "&subpage=" + process.env.TT_SUBPAGE : "") + (process.env.TT_RUNROBOT ? "&runrobot=1" : "") };
// TT_PADLONG=1: repro for Ken's held-long-pad '?' corruption — long typed pad picked into
// the hand, then the mouse wiggles so the held pad re-renders while moving
if (process.env.TT_PADLONG) globalThis.location = { search: "?floor=1&textpad=1&padlong=1" };
// dump the engine's error file at exit so tt_error_file() complaints are visible
// (TT_dumpErr is installed by shim/pre.js, which runs inside the module scope where FS lives)
process.on('exit', function () {
  try { if (globalThis.TT_dumpErr) globalThis.TT_dumpErr(); } catch (e) {}
});
// TT_MAXSEC=N: self-terminate after N seconds (Windows `timeout` hard-kills node, losing exit hooks)
if (process.env.TT_MAXSEC) setTimeout(function () {
  console.log('[harness] TT_MAXSEC reached — exiting');
  process.exit(0);
}, parseInt(process.env.TT_MAXSEC) * 1000);
// after pick_up (copyrobots hook), simulate the drop click on open floor
if (process.env.TT_COPYROBOTS) setTimeout(function(){
  try { globalThis.TT_mouse_x = (process.env.TT_DROPX ? parseInt(process.env.TT_DROPX) : 200); globalThis.TT_mouse_y = (process.env.TT_DROPY ? parseInt(process.env.TT_DROPY) : 200);
        globalThis.TT_msgq.push({message:0x0201,wParam:0,lParam:0});
        setTimeout(function(){ globalThis.TT_msgq.push({message:0x0202,wParam:0,lParam:0}); console.log('[harness] drop click sent'); }, 1500);
  } catch(e) {} }, 30000);
// TT_DUMPFB=<path.pgm>: at exit, write the last presented frame as binary PGM (palette-index
// grayscale is useless — expand through the palette to a P6 PPM instead for real colors)
if (process.env.TT_DUMPFB) setTimeout(function () {
  var orig2 = globalThis.TT_present;
  globalThis.TT_present = function (ptr, w, h, palPtr) {
    orig2(ptr, w, h, palPtr);
    try {
      var HEAPU8 = globalThis.TT_HEAPU8 ? globalThis.TT_HEAPU8() : null;
      if (!HEAPU8) return;
      globalThis.TT_lastfb = { pix: HEAPU8.slice(ptr, ptr + w * h), pal: HEAPU8.slice(palPtr, palPtr + 1024), w: w, h: h };
    } catch (e) {}
  };
  process.on('exit', function () {
    try {
      var fb = globalThis.TT_lastfb;
      if (!fb) return;
      var rgb = Buffer.alloc(fb.w * fb.h * 3);
      for (var i = 0; i < fb.w * fb.h; i++) {
        var pi = fb.pix[i] * 4;
        rgb[i*3] = fb.pal[pi]; rgb[i*3+1] = fb.pal[pi+1]; rgb[i*3+2] = fb.pal[pi+2];
      }
      var fs2 = require('fs');
      fs2.writeFileSync(process.env.TT_DUMPFB,
        Buffer.concat([Buffer.from('P6\n' + fb.w + ' ' + fb.h + '\n255\n'), rgb]));
      console.log('[harness] framebuffer dumped to ' + process.env.TT_DUMPFB);
    } catch (e) { console.log('[harness] fb dump failed: ' + e); }
  });
}, 1000);
// TT_TRACKRED=1: per-present red-body bbox of the copter (frame-accurate, no tab throttling)
if (process.env.TT_TRACKRED) setTimeout(function () {
  var orig = globalThis.TT_present;
  var out = [];
  globalThis.TT_present = function (ptr, w, h, palPtr) {
    orig(ptr, w, h, palPtr);
    try {
      if (out.length >= 500) return;
      var HEAPU8 = globalThis.TT_HEAPU8 ? globalThis.TT_HEAPU8() : null;
      if (!HEAPU8) return;
      var isred = new Uint8Array(256);
      for (var i = 0; i < 256; i++) {
        if (HEAPU8[palPtr + i*4] > 170 && HEAPU8[palPtr + i*4 + 1] < 100 && HEAPU8[palPtr + i*4 + 2] < 100) isred[i] = 1;
      }
      var col = new Float64Array(w), rowp = new Float64Array(h), c = 0;
      for (var y = 0; y < h; y++) {
        var row = ptr + y*w;
        for (var x = 0; x < w; x++) {
          if (isred[HEAPU8[row + x]]) { col[x]++; rowp[y]++; c++; }
        }
      }
      var best = 0, sad0 = -1;
      var bestY = 0, sadY0 = -1;
      globalThis.TT_colhist = globalThis.TT_colhist || [];
      var hist = globalThis.TT_colhist;
      if (hist.length >= 3 && c > 500) {
        globalThis.TT_prevcol = hist[hist.length - 3][0];
        globalThis.TT_prevrow = hist[hist.length - 3][1];
      } else { globalThis.TT_prevcol = null; }
      hist.push([col, rowp]); if (hist.length > 4) hist.shift();
      if (globalThis.TT_prevcol && c > 500) {
        var pc = globalThis.TT_prevcol, bestSad = Infinity;
        for (var s = -14; s <= 14; s++) {
          var sad = 0;
          for (var x2 = 20; x2 < w - 20; x2++) sad += Math.abs(col[x2] - pc[x2 + s]);
          if (s === 0) sad0 = Math.round(sad);
          if (sad < bestSad) { bestSad = sad; best = s; }
        }
        var pr = globalThis.TT_prevrow, bestSadY = Infinity;
        for (var sy = -14; sy <= 14; sy++) {
          var sady = 0;
          for (var y2 = 20; y2 < h - 20; y2++) sady += Math.abs(rowp[y2] - pr[y2 + sy]);
          if (sy === 0) sadY0 = Math.round(sady);
          if (sady < bestSadY) { bestSadY = sady; bestY = sy; }
        }
      }
      var minx2 = -1; for (var xm = 0; xm < w; xm++) { if (col[xm] > 2) { minx2 = xm; break; } }
      out.push([Date.now() - t0, c, best, bestY, minx2]);
    } catch (e) {}
  };
  // Windows `timeout` hard-kills node (no exit hooks) — self-terminate instead
  setTimeout(function () {
    console.log('[redtrack] ' + out.map(function (r) { return r.join(','); }).join(' | '));
    process.exit(0);
  }, 55000);
}, 4000);
// Touchdown detector for TT_LANDSEA: the engine's LEAVE_HELICOPTER trace goes through
// console.log in node; flag it so the harness releases the 'd' key immediately.
{
  const origLog = console.log;
  console.log = function () {
    try {
      const s = arguments[0];
      if (typeof s === 'string' && s.indexOf('LEAVE_HELICOPTER') >= 0 && !globalThis.TT_landed) {
        globalThis.TT_landed = true;
        origLog.call(console, '[harness] touchdown detected — releasing d');
      }
    } catch (e) {}
    return origLog.apply(console, arguments);
  };
}
let t0 = Date.now();
let frames = 0;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => {
  frames++;
  if (frames % 60 === 0) console.log(`[harness] ${frames} frames pumped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  // Headless auto-descend: after boot, descend until the helicopter lands and hands over to
  // walking. TT_AUTODESCEND=1 holds the LEFT BUTTON (the primary control); TT_AUTODESCEND=d
  // holds the 'd' key (the DOWN_IF_IN_HELICOPTER accelerator) — both must land.
  // TT_PADLONG wiggle: after the pad is in hand, sweep the cursor so the hand carries the
  // pad around (absolute mode tracks the cursor each frame)
  if (process.env.TT_PADLONG && frames >= 200 && frames < 1400) {
    var ang = (frames - 200) * 0.05;
    globalThis.TT_mouse_x = Math.round(400 + 250 * Math.cos(ang));
    globalThis.TT_mouse_y = Math.round(300 + 180 * Math.sin(ang));
    if (frames === 200) console.log('[harness] wiggling held pad');
  }
  // TT_CLIMB=1: hold 'u' (climb) well past max scale — Ken: "flew high and when I reached
  // the limit the helicopter drifted off the top of the screen and the city drifted
  // upwards too"; watch [tt] climb/fnav for unbounded y growth at pinned scale
  if (process.env.TT_CLIMB && frames >= 300 && frames < 3000) {
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if ((frames % 2) === 0 && globalThis.TT_msgq.length < 4)
      globalThis.TT_msgq.push({ message: 0x0102, wParam: 117, lParam: 0 }); // WM_CHAR 'u' autorepeat
    if (frames === 300) console.log('[harness] holding u — climbing');
  }
  // TT_FLYOUT=1: repro for Ken's "ended up over water, no city, couldn't fly": tap-to-fly
  // east repeatedly until far past the city edge, keep tapping, watch fnav + the frame
  if (process.env.TT_FLYOUT && frames >= 300 && frames < 2400) {
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if ((frames % 90) === 0) {
      globalThis.TT_mouse_x = 780; globalThis.TT_mouse_y = 300;
      globalThis.TT_msgq.push({message:0x0201,wParam:0,lParam:0});
      if (frames === 300) console.log('[harness] tapping east repeatedly');
    }
    if ((frames % 90) === 8) globalThis.TT_msgq.push({message:0x0202,wParam:0,lParam:0});
  }
  // TT_LANDSEA=1: after the eastward taps, hold 'd' until touchdown — does landing over the
  // edge water strand the programmer (Ken's "couldn't fly anywhere, helicopter not visible")?
  // Stop the instant LEAVE_HELICOPTER appears: on foot 'd' hits a DIFFERENT accelerator
  // (teleports to the desk) and poisons the repro. Touchdown is detected via the console.log
  // intercept installed below (TT_landed).
  if (process.env.TT_LANDSEA && frames >= 2400 && !globalThis.TT_landed) {
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if ((frames % 2) === 0 && globalThis.TT_msgq.length < 4)
      globalThis.TT_msgq.push({ message: 0x0102, wParam: 100, lParam: 0 }); // WM_CHAR 'd' autorepeat
    if (frames === 2400) console.log('[harness] holding d — descending to land');
  }
  // TT_GRABNEST=<x>,<y>: in the sentence-demo run, walk to the nest, grab the delivered
  // sentence pad off it, then carry it around (repro for Ken's '?' pad)
  if (process.env.TT_GRABNEST) {
    var gxy = process.env.TT_GRABNEST.split(','); var gx = parseInt(gxy[0]) || 430, gy = parseInt(gxy[1]) || 330;
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if (frames === 2200) { globalThis.TT_mouse_x = gx; globalThis.TT_mouse_y = gy; console.log('[harness] moving to nest'); }
    if (frames === 2300) { globalThis.TT_msgq.push({message:0x0201,wParam:0,lParam:0}); }
    if (frames === 2310) { globalThis.TT_msgq.push({message:0x0202,wParam:0,lParam:0}); console.log('[harness] grab click 1'); }
    if (frames === 2500) { globalThis.TT_msgq.push({message:0x0201,wParam:0,lParam:0}); }
    if (frames === 2510) { globalThis.TT_msgq.push({message:0x0202,wParam:0,lParam:0}); console.log('[harness] grab click 2'); }
    if (frames >= 2700 && frames < 3600) {
      var ang2 = (frames - 2700) * 0.04;
      globalThis.TT_mouse_x = Math.round(400 + 230 * Math.cos(ang2));
      globalThis.TT_mouse_y = Math.round(300 + 170 * Math.sin(ang2));
      if (frames === 2700) console.log('[harness] wiggling grabbed sentence');
    }
  }
  if (process.env.TT_AUTODESCEND && frames >= 150 && frames < 1400) {
    globalThis.TT_mouse_x = 400; globalThis.TT_mouse_y = 300;
    globalThis.TT_msgq = globalThis.TT_msgq || [];
    if (process.env.TT_AUTODESCEND === 'd') {
      if ((frames % 2) === 0 && globalThis.TT_msgq.length < 4)
        globalThis.TT_msgq.push({ message: 0x0102, wParam: 100, lParam: 0 }); // WM_CHAR 'd', autorepeat
      if (frames === 150) console.log('[harness] holding "d" — descending');
    } else if (frames === 150) {
      globalThis.TT_msgq.push({ message: 0x0201, wParam: 0, lParam: 0 });    // WM_LBUTTONDOWN, held
      console.log('[harness] holding left button — descending');
    }
  }
  cb(Date.now() - t0);
}, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// emscripten resolves tt.data relative to cwd, so run from build/
const path = require('path');
process.chdir(path.join(__dirname, 'build'));
require(path.join(__dirname, 'build', 'tt.js'));
