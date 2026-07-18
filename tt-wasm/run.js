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
