// Node test harness: emscripten's fps=0 main loop uses requestAnimationFrame,
// which node lacks — polyfill it with setTimeout so frames pump headlessly.
// (In the real browser target, the native rAF drives it.)
if (process.env.TT_FLOOR) globalThis.location = { search: "?floor=1" };
if (process.env.TT_COPYROBOTS) globalThis.location = { search: "?floor=1&copyrobots=1" + (process.env.TT_ROBOTPAGE ? "&robotpage=" + process.env.TT_ROBOTPAGE : "") + (process.env.TT_RUNROBOT ? "&runrobot=1" : "") };
// dump the engine's error file at exit so tt_error_file() complaints are visible
// (TT_dumpErr is installed by shim/pre.js, which runs inside the module scope where FS lives)
process.on('exit', function () {
  try { if (globalThis.TT_dumpErr) globalThis.TT_dumpErr(); } catch (e) {}
});
// after pick_up (copyrobots hook), simulate the drop click on open floor
if (process.env.TT_COPYROBOTS) setTimeout(function(){
  try { globalThis.TT_mouse_x = (process.env.TT_DROPX ? parseInt(process.env.TT_DROPX) : 200); globalThis.TT_mouse_y = (process.env.TT_DROPY ? parseInt(process.env.TT_DROPY) : 200);
        globalThis.TT_msgq.push({message:0x0201,wParam:0,lParam:0});
        setTimeout(function(){ globalThis.TT_msgq.push({message:0x0202,wParam:0,lParam:0}); console.log('[harness] drop click sent'); }, 1500);
  } catch(e) {} }, 30000);
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
let t0 = Date.now();
let frames = 0;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => {
  frames++;
  if (frames % 60 === 0) console.log(`[harness] ${frames} frames pumped (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  // Headless auto-descend: after boot, descend until the helicopter lands and hands over to
  // walking. TT_AUTODESCEND=1 holds the LEFT BUTTON (the primary control); TT_AUTODESCEND=d
  // holds the 'd' key (the DOWN_IF_IN_HELICOPTER accelerator) — both must land.
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
