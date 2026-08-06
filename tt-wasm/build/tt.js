// include: shell.js
// include: minimum_runtime_check.js
(function() {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked(str) {
    str = str.split('-')[0]; // Remove any trailing part from e.g. "12.53.3-alpha"
    var vers = str.split('.').slice(0, 3);
    while(vers.length < 3) vers.push('00');
    vers = vers.map((n, i, arr) => n.padStart(2, '0'));
    return vers.join('');
  }
  // 300000 -> "30.0.0"
  var packedVersionToHumanReadable = n => [n / 10000 | 0, (n / 100 | 0) % 100, n % 100].join('.');

  var TARGET_NOT_SUPPORTED = 2147483647;

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.
  var currentNodeVersion = typeof process !== 'undefined' && process.versions?.node ? humanReadableVersionToPacked(process.versions.node) : TARGET_NOT_SUPPORTED;
  if (currentNodeVersion < 180300) {
    throw new Error(`This emscripten-generated code requires node v${ packedVersionToHumanReadable(180300) } (detected v${packedVersionToHumanReadable(currentNodeVersion)})`);
  }

  var userAgent = typeof navigator !== 'undefined' && navigator.userAgent;
  if (!userAgent) {
    return;
  }

  var currentSafariVersion = userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/) ? humanReadableVersionToPacked(userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentSafariVersion < 150200) {
    throw new Error(`This emscripten-generated code requires Safari v${ packedVersionToHumanReadable(150200) } (detected v${currentSafariVersion})`);
  }

  var currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentFirefoxVersion < 100) {
    throw new Error(`This emscripten-generated code requires Firefox v100 (detected v${currentFirefoxVersion})`);
  }

  var currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentChromeVersion < 95) {
    throw new Error(`This emscripten-generated code requires Chrome v95 (detected v${currentChromeVersion})`);
  }
})();

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: C:\Users\toont\dev\tt-wasm\.tmp\tmp0h9mw4lw.js

  if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
  Module['expectedDataFileDownloads']++;
  (() => {
    // Do not attempt to redownload the virtual filesystem data when in a pthread or a Wasm Worker context.
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker) return;
    var isNode = globalThis.process && globalThis.process.versions && globalThis.process.versions.node && globalThis.process.type != 'renderer';
    async function loadPackage(metadata) {

      var PACKAGE_PATH = '';
      if (typeof window === 'object') {
        PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/');
      } else if (typeof process === 'undefined' && typeof location !== 'undefined') {
        // web worker
        PACKAGE_PATH = encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf('/')) + '/');
      }
      var PACKAGE_NAME = 'build/tt.data';
      var REMOTE_PACKAGE_BASE = 'tt.data';
      var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
      var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];

      async function fetchRemotePackage(packageName, packageSize) {
        if (isNode) {
          var contents = require('fs').readFileSync(packageName);
          return new Uint8Array(contents).buffer;
        }
        if (!Module['dataFileDownloads']) Module['dataFileDownloads'] = {};
        try {
          var response = await fetch(packageName);
        } catch (e) {
          throw new Error(`Network Error: ${packageName}`, {e});
        }
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.url}`);
        }

        const chunks = [];
        const headers = response.headers;
        const total = Number(headers.get('Content-Length') || packageSize);
        let loaded = 0;

        Module['setStatus'] && Module['setStatus']('Downloading data...');
        const reader = response.body.getReader();

        while (1) {
          var {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          Module['dataFileDownloads'][packageName] = {loaded, total};

          let totalLoaded = 0;
          let totalSize = 0;

          for (const download of Object.values(Module['dataFileDownloads'])) {
            totalLoaded += download.loaded;
            totalSize += download.total;
          }

          Module['setStatus'] && Module['setStatus'](`Downloading data... (${totalLoaded}/${totalSize})`);
        }

        const packageData = new Uint8Array(chunks.map((c) => c.length).reduce((a, b) => a + b, 0));
        let offset = 0;
        for (const chunk of chunks) {
          packageData.set(chunk, offset);
          offset += chunk.length;
        }
        return packageData.buffer;
      }

      var fetchPromise;
      var fetched = Module['getPreloadedPackage'] && Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);

      if (!fetched) {
        // Note that we don't use await here because we want to execute the
        // the rest of this function immediately.
        fetchPromise = fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);
      }

    async function runWithFS(Module) {

      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }
Module['FS_createPath']("/", "toontalk", true, true);
Module['FS_createPath']("/toontalk", "Java", true, true);
Module['FS_createPath']("/toontalk", "Puzzles", true, true);
Module['FS_createPath']("/toontalk/Puzzles", "US", true, true);
Module['FS_createPath']("/toontalk", "doc", true, true);
Module['FS_createPath']("/toontalk", "pics", true, true);

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;
        // Reuse the bytearray from the XHR as the source for file reads.
          for (var file of metadata['files']) {
            var name = file['filename'];
            var data = byteArray.subarray(file['start'], file['end']);
            // canOwn this data in the filesystem, it is a slice into the heap that will never change
        Module['FS_createDataFile'](name, null, data, true, true, true);
          }
          Module['removeRunDependency']('datafile_build/tt.data');
      }
      Module['addRunDependency']('datafile_build/tt.data');

      if (!Module['preloadResults']) Module['preloadResults'] = {};

      Module['preloadResults'][PACKAGE_NAME] = {fromCache: false};
      if (!fetched) {
        fetched = await fetchPromise;
      }
      await processPackageData(fetched);

    }
    // Detect whether the module JS file has already been loaded.
    if (Module['FS_createPath']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS); // FS is not initialized yet, wait for it
    }

    }
    loadPackage({"files": [{"filename": "/toontalk/Examples.xml.tt", "start": 0, "end": 12699}, {"filename": "/toontalk/Java/m25.us1", "start": 12699, "end": 115339}, {"filename": "/toontalk/Java/resind.us1", "start": 115339, "end": 1165202}, {"filename": "/toontalk/Puzzles/US/p1.pzl", "start": 1165202, "end": 1166672}, {"filename": "/toontalk/Puzzles/US/p10.pzl", "start": 1166672, "end": 1167951}, {"filename": "/toontalk/Puzzles/US/p11.pzl", "start": 1167951, "end": 1169122}, {"filename": "/toontalk/Puzzles/US/p12.pzl", "start": 1169122, "end": 1170617}, {"filename": "/toontalk/Puzzles/US/p13.pzl", "start": 1170617, "end": 1172847}, {"filename": "/toontalk/Puzzles/US/p14.pzl", "start": 1172847, "end": 1174613}, {"filename": "/toontalk/Puzzles/US/p15.pzl", "start": 1174613, "end": 1178464}, {"filename": "/toontalk/Puzzles/US/p16.pzl", "start": 1178464, "end": 1180075}, {"filename": "/toontalk/Puzzles/US/p17.pzl", "start": 1180075, "end": 1180937}, {"filename": "/toontalk/Puzzles/US/p18.pzl", "start": 1180937, "end": 1180958}, {"filename": "/toontalk/Puzzles/US/p19.pzl", "start": 1180958, "end": 1180979}, {"filename": "/toontalk/Puzzles/US/p2.pzl", "start": 1180979, "end": 1181519}, {"filename": "/toontalk/Puzzles/US/p20.pzl", "start": 1181519, "end": 1181540}, {"filename": "/toontalk/Puzzles/US/p21.pzl", "start": 1181540, "end": 1182664}, {"filename": "/toontalk/Puzzles/US/p22.pzl", "start": 1182664, "end": 1184312}, {"filename": "/toontalk/Puzzles/US/p23.pzl", "start": 1184312, "end": 1187798}, {"filename": "/toontalk/Puzzles/US/p24.pzl", "start": 1187798, "end": 1190235}, {"filename": "/toontalk/Puzzles/US/p25.pzl", "start": 1190235, "end": 1193117}, {"filename": "/toontalk/Puzzles/US/p26.pzl", "start": 1193117, "end": 1194075}, {"filename": "/toontalk/Puzzles/US/p27.pzl", "start": 1194075, "end": 1195278}, {"filename": "/toontalk/Puzzles/US/p28.pzl", "start": 1195278, "end": 1196389}, {"filename": "/toontalk/Puzzles/US/p29.pzl", "start": 1196389, "end": 1196410}, {"filename": "/toontalk/Puzzles/US/p3.pzl", "start": 1196410, "end": 1197525}, {"filename": "/toontalk/Puzzles/US/p30.pzl", "start": 1197525, "end": 1197546}, {"filename": "/toontalk/Puzzles/US/p31.pzl", "start": 1197546, "end": 1198721}, {"filename": "/toontalk/Puzzles/US/p32.pzl", "start": 1198721, "end": 1200258}, {"filename": "/toontalk/Puzzles/US/p33.pzl", "start": 1200258, "end": 1200739}, {"filename": "/toontalk/Puzzles/US/p34.pzl", "start": 1200739, "end": 1201826}, {"filename": "/toontalk/Puzzles/US/p35.pzl", "start": 1201826, "end": 1203412}, {"filename": "/toontalk/Puzzles/US/p36.pzl", "start": 1203412, "end": 1206849}, {"filename": "/toontalk/Puzzles/US/p37.pzl", "start": 1206849, "end": 1208320}, {"filename": "/toontalk/Puzzles/US/p38.pzl", "start": 1208320, "end": 1210323}, {"filename": "/toontalk/Puzzles/US/p39.pzl", "start": 1210323, "end": 1211770}, {"filename": "/toontalk/Puzzles/US/p4.pzl", "start": 1211770, "end": 1212856}, {"filename": "/toontalk/Puzzles/US/p40.pzl", "start": 1212856, "end": 1212877}, {"filename": "/toontalk/Puzzles/US/p41.pzl", "start": 1212877, "end": 1214918}, {"filename": "/toontalk/Puzzles/US/p42.pzl", "start": 1214918, "end": 1216878}, {"filename": "/toontalk/Puzzles/US/p43.pzl", "start": 1216878, "end": 1218204}, {"filename": "/toontalk/Puzzles/US/p44.pzl", "start": 1218204, "end": 1219537}, {"filename": "/toontalk/Puzzles/US/p45.pzl", "start": 1219537, "end": 1221371}, {"filename": "/toontalk/Puzzles/US/p46.pzl", "start": 1221371, "end": 1222119}, {"filename": "/toontalk/Puzzles/US/p47.pzl", "start": 1222119, "end": 1223461}, {"filename": "/toontalk/Puzzles/US/p48.pzl", "start": 1223461, "end": 1224966}, {"filename": "/toontalk/Puzzles/US/p49.pzl", "start": 1224966, "end": 1225734}, {"filename": "/toontalk/Puzzles/US/p5.pzl", "start": 1225734, "end": 1227106}, {"filename": "/toontalk/Puzzles/US/p50.pzl", "start": 1227106, "end": 1228175}, {"filename": "/toontalk/Puzzles/US/p51.pzl", "start": 1228175, "end": 1229484}, {"filename": "/toontalk/Puzzles/US/p52.pzl", "start": 1229484, "end": 1230415}, {"filename": "/toontalk/Puzzles/US/p53.pzl", "start": 1230415, "end": 1231651}, {"filename": "/toontalk/Puzzles/US/p54.pzl", "start": 1231651, "end": 1234026}, {"filename": "/toontalk/Puzzles/US/p55.pzl", "start": 1234026, "end": 1234047}, {"filename": "/toontalk/Puzzles/US/p56.pzl", "start": 1234047, "end": 1234068}, {"filename": "/toontalk/Puzzles/US/p57.pzl", "start": 1234068, "end": 1234089}, {"filename": "/toontalk/Puzzles/US/p58.pzl", "start": 1234089, "end": 1234110}, {"filename": "/toontalk/Puzzles/US/p59.pzl", "start": 1234110, "end": 1234131}, {"filename": "/toontalk/Puzzles/US/p6.pzl", "start": 1234131, "end": 1234919}, {"filename": "/toontalk/Puzzles/US/p60.pzl", "start": 1234919, "end": 1234940}, {"filename": "/toontalk/Puzzles/US/p61.pzl", "start": 1234940, "end": 1236630}, {"filename": "/toontalk/Puzzles/US/p62.pzl", "start": 1236630, "end": 1237925}, {"filename": "/toontalk/Puzzles/US/p63.pzl", "start": 1237925, "end": 1239775}, {"filename": "/toontalk/Puzzles/US/p64.pzl", "start": 1239775, "end": 1241078}, {"filename": "/toontalk/Puzzles/US/p65.pzl", "start": 1241078, "end": 1242686}, {"filename": "/toontalk/Puzzles/US/p66.pzl", "start": 1242686, "end": 1244551}, {"filename": "/toontalk/Puzzles/US/p67.pzl", "start": 1244551, "end": 1246350}, {"filename": "/toontalk/Puzzles/US/p68.pzl", "start": 1246350, "end": 1248182}, {"filename": "/toontalk/Puzzles/US/p69.pzl", "start": 1248182, "end": 1249350}, {"filename": "/toontalk/Puzzles/US/p7.pzl", "start": 1249350, "end": 1250301}, {"filename": "/toontalk/Puzzles/US/p70.pzl", "start": 1250301, "end": 1251635}, {"filename": "/toontalk/Puzzles/US/p71.pzl", "start": 1251635, "end": 1252920}, {"filename": "/toontalk/Puzzles/US/p72.pzl", "start": 1252920, "end": 1253590}, {"filename": "/toontalk/Puzzles/US/p73.pzl", "start": 1253590, "end": 1253962}, {"filename": "/toontalk/Puzzles/US/p74.pzl", "start": 1253962, "end": 1254678}, {"filename": "/toontalk/Puzzles/US/p8.pzl", "start": 1254678, "end": 1255964}, {"filename": "/toontalk/Puzzles/US/p9.pzl", "start": 1255964, "end": 1257567}, {"filename": "/toontalk/doc/back_1.bmp", "start": 1257567, "end": 1266745}, {"filename": "/toontalk/doc/back_n.bmp", "start": 1266745, "end": 1275923}, {"filename": "/toontalk/doc/cursorpt.bmp", "start": 1275923, "end": 1278025}, {"filename": "/toontalk/doc/fd_1.bmp", "start": 1278025, "end": 1287203}, {"filename": "/toontalk/doc/fd_n.bmp", "start": 1287203, "end": 1296381}, {"filename": "/toontalk/doc/pause.bmp", "start": 1296381, "end": 1305559}, {"filename": "/toontalk/doc/play.bmp", "start": 1305559, "end": 1314737}, {"filename": "/toontalk/doc/record.bmp", "start": 1314737, "end": 1323915}, {"filename": "/toontalk/doc/time.bmp", "start": 1323915, "end": 1345057}, {"filename": "/toontalk/m25.us1", "start": 1345057, "end": 1447697}, {"filename": "/toontalk/pics/abmbt2.bmp", "start": 1447697, "end": 1538263}, {"filename": "/toontalk/pics/abmbt3.bmp", "start": 1538263, "end": 1643613}, {"filename": "/toontalk/pics/abmbt4.bmp", "start": 1643613, "end": 1734099}, {"filename": "/toontalk/pics/abmbt5.bmp", "start": 1734099, "end": 1792777}, {"filename": "/toontalk/pics/abmbt6.bmp", "start": 1792777, "end": 1846247}, {"filename": "/toontalk/pics/abmbt7.bmp", "start": 1846247, "end": 1876419}, {"filename": "/toontalk/pics/abmbt8.bmp", "start": 1876419, "end": 1951977}, {"filename": "/toontalk/pics/abmbt9.bmp", "start": 1951977, "end": 2045247}, {"filename": "/toontalk/pics/abomb01.bmp", "start": 2045247, "end": 2196629}, {"filename": "/toontalk/pics/abomb02.bmp", "start": 2196629, "end": 2338155}, {"filename": "/toontalk/pics/abomb03.bmp", "start": 2338155, "end": 2436977}, {"filename": "/toontalk/pics/abomb04.bmp", "start": 2436977, "end": 2493255}, {"filename": "/toontalk/pics/abomb05.bmp", "start": 2493255, "end": 2547901}, {"filename": "/toontalk/pics/abomb06.bmp", "start": 2547901, "end": 2639795}, {"filename": "/toontalk/pics/abomb07.bmp", "start": 2639795, "end": 2686703}, {"filename": "/toontalk/pics/abomb08.bmp", "start": 2686703, "end": 2715733}, {"filename": "/toontalk/pics/al01.bmp", "start": 2715733, "end": 2740743}, {"filename": "/toontalk/pics/al02.bmp", "start": 2740743, "end": 2765753}, {"filename": "/toontalk/pics/al03.bmp", "start": 2765753, "end": 2790763}, {"filename": "/toontalk/pics/al04.bmp", "start": 2790763, "end": 2815773}, {"filename": "/toontalk/pics/al05.bmp", "start": 2815773, "end": 2840783}, {"filename": "/toontalk/pics/al06.bmp", "start": 2840783, "end": 2865793}, {"filename": "/toontalk/pics/al07.bmp", "start": 2865793, "end": 2890803}, {"filename": "/toontalk/pics/al08.bmp", "start": 2890803, "end": 2915813}, {"filename": "/toontalk/pics/al09.bmp", "start": 2915813, "end": 2940575}, {"filename": "/toontalk/pics/al10.bmp", "start": 2940575, "end": 2966229}, {"filename": "/toontalk/pics/al11.bmp", "start": 2966229, "end": 2992011}, {"filename": "/toontalk/pics/al12.bmp", "start": 2992011, "end": 3020593}, {"filename": "/toontalk/pics/al13.bmp", "start": 3020593, "end": 3047783}, {"filename": "/toontalk/pics/al14.bmp", "start": 3047783, "end": 3075601}, {"filename": "/toontalk/pics/al15.bmp", "start": 3075601, "end": 3103279}, {"filename": "/toontalk/pics/al16.bmp", "start": 3103279, "end": 3132149}, {"filename": "/toontalk/pics/al17.bmp", "start": 3132149, "end": 3160587}, {"filename": "/toontalk/pics/al18.bmp", "start": 3160587, "end": 3187505}, {"filename": "/toontalk/pics/al19.bmp", "start": 3187505, "end": 3214559}, {"filename": "/toontalk/pics/al20.bmp", "start": 3214559, "end": 3239445}, {"filename": "/toontalk/pics/alwt01.bmp", "start": 3239445, "end": 3264455}, {"filename": "/toontalk/pics/alwt02.bmp", "start": 3264455, "end": 3289217}, {"filename": "/toontalk/pics/alwt03.bmp", "start": 3289217, "end": 3313607}, {"filename": "/toontalk/pics/alwt04.bmp", "start": 3313607, "end": 3337997}, {"filename": "/toontalk/pics/alwt05.bmp", "start": 3337997, "end": 3362759}, {"filename": "/toontalk/pics/alwt06.bmp", "start": 3362759, "end": 3387769}, {"filename": "/toontalk/pics/alwt07.bmp", "start": 3387769, "end": 3412779}, {"filename": "/toontalk/pics/alwt08.bmp", "start": 3412779, "end": 3437417}, {"filename": "/toontalk/pics/alwt09.bmp", "start": 3437417, "end": 3461931}, {"filename": "/toontalk/pics/alwt10.bmp", "start": 3461931, "end": 3486445}, {"filename": "/toontalk/pics/alwt11.bmp", "start": 3486445, "end": 3511083}, {"filename": "/toontalk/pics/alwt12.bmp", "start": 3511083, "end": 3536093}, {"filename": "/toontalk/pics/alwt13.bmp", "start": 3536093, "end": 3561103}, {"filename": "/toontalk/pics/alwt14.bmp", "start": 3561103, "end": 3586113}, {"filename": "/toontalk/pics/armonly2.bmp", "start": 3586113, "end": 3650911}, {"filename": "/toontalk/pics/backwall.bmp", "start": 3650911, "end": 3687829}, {"filename": "/toontalk/pics/ball.bmp", "start": 3687829, "end": 3692939}, {"filename": "/toontalk/pics/bbmb2.bmp", "start": 3692939, "end": 3747137}, {"filename": "/toontalk/pics/bbmb3.bmp", "start": 3747137, "end": 3802663}, {"filename": "/toontalk/pics/bbmb4.bmp", "start": 3802663, "end": 3856541}, {"filename": "/toontalk/pics/bbmb5.bmp", "start": 3856541, "end": 3914723}, {"filename": "/toontalk/pics/bbmb6.bmp", "start": 3914723, "end": 3966777}, {"filename": "/toontalk/pics/bbmb7.bmp", "start": 3966777, "end": 3996543}, {"filename": "/toontalk/pics/bbmb8.bmp", "start": 3996543, "end": 4070421}, {"filename": "/toontalk/pics/bbmb9.bmp", "start": 4070421, "end": 4166443}, {"filename": "/toontalk/pics/bbmbt2.bmp", "start": 4166443, "end": 4228433}, {"filename": "/toontalk/pics/bbmbt3.bmp", "start": 4228433, "end": 4292431}, {"filename": "/toontalk/pics/bbmbt4.bmp", "start": 4292431, "end": 4354421}, {"filename": "/toontalk/pics/bbmbt5.bmp", "start": 4354421, "end": 4409355}, {"filename": "/toontalk/pics/bbmbt6.bmp", "start": 4409355, "end": 4460545}, {"filename": "/toontalk/pics/bbmbt7.bmp", "start": 4460545, "end": 4490529}, {"filename": "/toontalk/pics/bbmbt8.bmp", "start": 4490529, "end": 4536465}, {"filename": "/toontalk/pics/bbmbt9.bmp", "start": 4536465, "end": 4566417}, {"filename": "/toontalk/pics/bigbubbl.bmp", "start": 4566417, "end": 4874695}, {"filename": "/toontalk/pics/bomb01.bmp", "start": 4874695, "end": 4891217}, {"filename": "/toontalk/pics/bomb02.bmp", "start": 4891217, "end": 4908711}, {"filename": "/toontalk/pics/bomb03.bmp", "start": 4908711, "end": 4925557}, {"filename": "/toontalk/pics/bomb04.bmp", "start": 4925557, "end": 4942187}, {"filename": "/toontalk/pics/bomb05.bmp", "start": 4942187, "end": 4958493}, {"filename": "/toontalk/pics/bomb06.bmp", "start": 4958493, "end": 4969931}, {"filename": "/toontalk/pics/bomb07.bmp", "start": 4969931, "end": 4985589}, {"filename": "/toontalk/pics/bomb08.bmp", "start": 4985589, "end": 5001031}, {"filename": "/toontalk/pics/bomb09.bmp", "start": 5001031, "end": 5016149}, {"filename": "/toontalk/pics/bomb10.bmp", "start": 5016149, "end": 5031699}, {"filename": "/toontalk/pics/bomb11.bmp", "start": 5031699, "end": 5046277}, {"filename": "/toontalk/pics/bomb12.bmp", "start": 5046277, "end": 5062027}, {"filename": "/toontalk/pics/bpjmp00.bmp", "start": 5062027, "end": 5082593}, {"filename": "/toontalk/pics/bpjmp01.bmp", "start": 5082593, "end": 5103719}, {"filename": "/toontalk/pics/bpjmp02.bmp", "start": 5103719, "end": 5123241}, {"filename": "/toontalk/pics/bpjmp03.bmp", "start": 5123241, "end": 5135269}, {"filename": "/toontalk/pics/bpjmp04.bmp", "start": 5135269, "end": 5151323}, {"filename": "/toontalk/pics/bpjmp05.bmp", "start": 5151323, "end": 5172933}, {"filename": "/toontalk/pics/bpjmp06.bmp", "start": 5172933, "end": 5199763}, {"filename": "/toontalk/pics/bpjmp07.bmp", "start": 5199763, "end": 5233433}, {"filename": "/toontalk/pics/bpjmp08.bmp", "start": 5233433, "end": 5267167}, {"filename": "/toontalk/pics/bpjmp09.bmp", "start": 5267167, "end": 5299237}, {"filename": "/toontalk/pics/bpjmp10.bmp", "start": 5299237, "end": 5331055}, {"filename": "/toontalk/pics/bpjmp11.bmp", "start": 5331055, "end": 5358773}, {"filename": "/toontalk/pics/bpjmp12.bmp", "start": 5358773, "end": 5388039}, {"filename": "/toontalk/pics/bpjmp13.bmp", "start": 5388039, "end": 5420701}, {"filename": "/toontalk/pics/bpjmp14.bmp", "start": 5420701, "end": 5451459}, {"filename": "/toontalk/pics/bpjmp15.bmp", "start": 5451459, "end": 5477857}, {"filename": "/toontalk/pics/bpjmp16.bmp", "start": 5477857, "end": 5497835}, {"filename": "/toontalk/pics/bpjmp17.bmp", "start": 5497835, "end": 5519097}, {"filename": "/toontalk/pics/bpjmp18.bmp", "start": 5519097, "end": 5541231}, {"filename": "/toontalk/pics/bpjmp19.bmp", "start": 5541231, "end": 5560453}, {"filename": "/toontalk/pics/bpjmp20.bmp", "start": 5560453, "end": 5581019}, {"filename": "/toontalk/pics/bpsuck01.bmp", "start": 5581019, "end": 5597903}, {"filename": "/toontalk/pics/bpsuck02.bmp", "start": 5597903, "end": 5631841}, {"filename": "/toontalk/pics/bpsuck03.bmp", "start": 5631841, "end": 5669527}, {"filename": "/toontalk/pics/bpsuck04.bmp", "start": 5669527, "end": 5721401}, {"filename": "/toontalk/pics/bpsuck05.bmp", "start": 5721401, "end": 5782659}, {"filename": "/toontalk/pics/bpsuck06.bmp", "start": 5782659, "end": 5851669}, {"filename": "/toontalk/pics/bpsuck07.bmp", "start": 5851669, "end": 5916803}, {"filename": "/toontalk/pics/bpsuck08.bmp", "start": 5916803, "end": 5980305}, {"filename": "/toontalk/pics/bpsuck09.bmp", "start": 5980305, "end": 6004327}, {"filename": "/toontalk/pics/bpsuck10.bmp", "start": 6004327, "end": 6066349}, {"filename": "/toontalk/pics/bpsuck11.bmp", "start": 6066349, "end": 6123171}, {"filename": "/toontalk/pics/bpsuck12.bmp", "start": 6123171, "end": 6174433}, {"filename": "/toontalk/pics/bpsuck13.bmp", "start": 6174433, "end": 6193013}, {"filename": "/toontalk/pics/bpsuck14.bmp", "start": 6193013, "end": 6229451}, {"filename": "/toontalk/pics/bpsuck15.bmp", "start": 6229451, "end": 6271445}, {"filename": "/toontalk/pics/bpsuck16.bmp", "start": 6271445, "end": 6287567}, {"filename": "/toontalk/pics/bpsuck17.bmp", "start": 6287567, "end": 6324837}, {"filename": "/toontalk/pics/bubbl10.bmp", "start": 6324837, "end": 6350165}, {"filename": "/toontalk/pics/cbmb2.bmp", "start": 6350165, "end": 6404363}, {"filename": "/toontalk/pics/cbmb3.bmp", "start": 6404363, "end": 6458561}, {"filename": "/toontalk/pics/cbmb4.bmp", "start": 6458561, "end": 6512759}, {"filename": "/toontalk/pics/cbmb5.bmp", "start": 6512759, "end": 6558189}, {"filename": "/toontalk/pics/cbmb6.bmp", "start": 6558189, "end": 6589819}, {"filename": "/toontalk/pics/cbmb7.bmp", "start": 6589819, "end": 6642721}, {"filename": "/toontalk/pics/cbmb8.bmp", "start": 6642721, "end": 6671041}, {"filename": "/toontalk/pics/cbmb9.bmp", "start": 6671041, "end": 6728495}, {"filename": "/toontalk/pics/cbmbt2.bmp", "start": 6728495, "end": 6783077}, {"filename": "/toontalk/pics/cbmbt3.bmp", "start": 6783077, "end": 6838875}, {"filename": "/toontalk/pics/cbmbt4.bmp", "start": 6838875, "end": 6893457}, {"filename": "/toontalk/pics/cbmbt5.bmp", "start": 6893457, "end": 6942135}, {"filename": "/toontalk/pics/cbmbt6.bmp", "start": 6942135, "end": 6992861}, {"filename": "/toontalk/pics/cbmbt7.bmp", "start": 6992861, "end": 7022787}, {"filename": "/toontalk/pics/cbmbt8.bmp", "start": 7022787, "end": 7098345}, {"filename": "/toontalk/pics/cbmbt9.bmp", "start": 7098345, "end": 7191615}, {"filename": "/toontalk/pics/confusd1.bmp", "start": 7191615, "end": 7217653}, {"filename": "/toontalk/pics/confusd2.bmp", "start": 7217653, "end": 7248171}, {"filename": "/toontalk/pics/confusd3.bmp", "start": 7248171, "end": 7273569}, {"filename": "/toontalk/pics/confusd4.bmp", "start": 7273569, "end": 7287849}, {"filename": "/toontalk/pics/confusd5.bmp", "start": 7287849, "end": 7302403}, {"filename": "/toontalk/pics/confusd6.bmp", "start": 7302403, "end": 7317143}, {"filename": "/toontalk/pics/confusd7.bmp", "start": 7317143, "end": 7350657}, {"filename": "/toontalk/pics/crash.bmp", "start": 7350657, "end": 7658935}, {"filename": "/toontalk/pics/credits.bmp", "start": 7658935, "end": 7967213}, {"filename": "/toontalk/pics/cubby0.bmp", "start": 7967213, "end": 8016835}, {"filename": "/toontalk/pics/cubby1.bmp", "start": 8016835, "end": 8153401}, {"filename": "/toontalk/pics/cubby1l.bmp", "start": 8153401, "end": 8289967}, {"filename": "/toontalk/pics/cubbyb.bmp", "start": 8289967, "end": 8423525}, {"filename": "/toontalk/pics/cubbyr.bmp", "start": 8423525, "end": 8536731}, {"filename": "/toontalk/pics/cubbyrl.bmp", "start": 8536731, "end": 8652273}, {"filename": "/toontalk/pics/dizhr01.bmp", "start": 8652273, "end": 8681671}, {"filename": "/toontalk/pics/dizhr02.bmp", "start": 8681671, "end": 8711069}, {"filename": "/toontalk/pics/dizhr03.bmp", "start": 8711069, "end": 8740467}, {"filename": "/toontalk/pics/dizhr04.bmp", "start": 8740467, "end": 8769865}, {"filename": "/toontalk/pics/dizhr05.bmp", "start": 8769865, "end": 8799263}, {"filename": "/toontalk/pics/dizhr06.bmp", "start": 8799263, "end": 8828661}, {"filename": "/toontalk/pics/dizhr07.bmp", "start": 8828661, "end": 8858059}, {"filename": "/toontalk/pics/dizhr08.bmp", "start": 8858059, "end": 8887457}, {"filename": "/toontalk/pics/dizhr09.bmp", "start": 8887457, "end": 8916855}, {"filename": "/toontalk/pics/dizhr10.bmp", "start": 8916855, "end": 8946373}, {"filename": "/toontalk/pics/dizhr11.bmp", "start": 8946373, "end": 8975771}, {"filename": "/toontalk/pics/dizhr12.bmp", "start": 8975771, "end": 9005169}, {"filename": "/toontalk/pics/dizht01.bmp", "start": 9005169, "end": 9034087}, {"filename": "/toontalk/pics/dizht02.bmp", "start": 9034087, "end": 9054395}, {"filename": "/toontalk/pics/dizht03.bmp", "start": 9054395, "end": 9083197}, {"filename": "/toontalk/pics/dizht04.bmp", "start": 9083197, "end": 9111999}, {"filename": "/toontalk/pics/dizht05.bmp", "start": 9111999, "end": 9140917}, {"filename": "/toontalk/pics/dizht06.bmp", "start": 9140917, "end": 9171035}, {"filename": "/toontalk/pics/dizht07.bmp", "start": 9171035, "end": 9201153}, {"filename": "/toontalk/pics/dizht08.bmp", "start": 9201153, "end": 9232115}, {"filename": "/toontalk/pics/dizht09.bmp", "start": 9232115, "end": 9262829}, {"filename": "/toontalk/pics/dizht10.bmp", "start": 9262829, "end": 9293667}, {"filename": "/toontalk/pics/dizht11.bmp", "start": 9293667, "end": 9324505}, {"filename": "/toontalk/pics/dizht12.bmp", "start": 9324505, "end": 9354623}, {"filename": "/toontalk/pics/dizzy01.bmp", "start": 9354623, "end": 9382221}, {"filename": "/toontalk/pics/dizzy02.bmp", "start": 9382221, "end": 9409819}, {"filename": "/toontalk/pics/dizzy03.bmp", "start": 9409819, "end": 9437417}, {"filename": "/toontalk/pics/dizzy04.bmp", "start": 9437417, "end": 9465255}, {"filename": "/toontalk/pics/dizzy05.bmp", "start": 9465255, "end": 9493213}, {"filename": "/toontalk/pics/dizzy06.bmp", "start": 9493213, "end": 9521291}, {"filename": "/toontalk/pics/dizzy07.bmp", "start": 9521291, "end": 9549249}, {"filename": "/toontalk/pics/dizzy08.bmp", "start": 9549249, "end": 9576847}, {"filename": "/toontalk/pics/dizzy09.bmp", "start": 9576847, "end": 9604445}, {"filename": "/toontalk/pics/dizzy10.bmp", "start": 9604445, "end": 9632043}, {"filename": "/toontalk/pics/dizzy11.bmp", "start": 9632043, "end": 9659641}, {"filename": "/toontalk/pics/dizzy12.bmp", "start": 9659641, "end": 9687239}, {"filename": "/toontalk/pics/dmrph00.bmp", "start": 9687239, "end": 9710637}, {"filename": "/toontalk/pics/dmrph01.bmp", "start": 9710637, "end": 9734283}, {"filename": "/toontalk/pics/dmrph02.bmp", "start": 9734283, "end": 9757681}, {"filename": "/toontalk/pics/dmrph03.bmp", "start": 9757681, "end": 9780831}, {"filename": "/toontalk/pics/dmrph04.bmp", "start": 9780831, "end": 9803733}, {"filename": "/toontalk/pics/dmrph05.bmp", "start": 9803733, "end": 9826635}, {"filename": "/toontalk/pics/dmrph06.bmp", "start": 9826635, "end": 9849537}, {"filename": "/toontalk/pics/dmrph07.bmp", "start": 9849537, "end": 9872439}, {"filename": "/toontalk/pics/dmrph08.bmp", "start": 9872439, "end": 9894845}, {"filename": "/toontalk/pics/dmrph09.bmp", "start": 9894845, "end": 9916507}, {"filename": "/toontalk/pics/dmrph10.bmp", "start": 9916507, "end": 9937673}, {"filename": "/toontalk/pics/dmrph11.bmp", "start": 9937673, "end": 9958839}, {"filename": "/toontalk/pics/dmrph12.bmp", "start": 9958839, "end": 9980749}, {"filename": "/toontalk/pics/dmrph13.bmp", "start": 9980749, "end": 10003651}, {"filename": "/toontalk/pics/dmrph14.bmp", "start": 10003651, "end": 10027545}, {"filename": "/toontalk/pics/dmrph15.bmp", "start": 10027545, "end": 10052431}, {"filename": "/toontalk/pics/dmrph16.bmp", "start": 10052431, "end": 10078557}, {"filename": "/toontalk/pics/dmrph17.bmp", "start": 10078557, "end": 10104683}, {"filename": "/toontalk/pics/ekelunds.bmp", "start": 10104683, "end": 10412961}, {"filename": "/toontalk/pics/etrksid1.bmp", "start": 10412961, "end": 10458103}, {"filename": "/toontalk/pics/etrksid2.bmp", "start": 10458103, "end": 10502381}, {"filename": "/toontalk/pics/etrksid3.bmp", "start": 10502381, "end": 10546947}, {"filename": "/toontalk/pics/etrksid4.bmp", "start": 10546947, "end": 10592089}, {"filename": "/toontalk/pics/etrksid5.bmp", "start": 10592089, "end": 10636655}, {"filename": "/toontalk/pics/etrktop1.bmp", "start": 10636655, "end": 10652133}, {"filename": "/toontalk/pics/etrktop4.bmp", "start": 10652133, "end": 10671451}, {"filename": "/toontalk/pics/etrktop5.bmp", "start": 10671451, "end": 10686929}, {"filename": "/toontalk/pics/expl1.bmp", "start": 10686929, "end": 10692807}, {"filename": "/toontalk/pics/expl2.bmp", "start": 10692807, "end": 10707205}, {"filename": "/toontalk/pics/expl3.bmp", "start": 10707205, "end": 10730987}, {"filename": "/toontalk/pics/expl4.bmp", "start": 10730987, "end": 10744513}, {"filename": "/toontalk/pics/expl5.bmp", "start": 10744513, "end": 10767779}, {"filename": "/toontalk/pics/ffhorz.bmp", "start": 10767779, "end": 10772505}, {"filename": "/toontalk/pics/ffnop.bmp", "start": 10772505, "end": 10803679}, {"filename": "/toontalk/pics/ffplat.bmp", "start": 10803679, "end": 10834853}, {"filename": "/toontalk/pics/ffvert.bmp", "start": 10834853, "end": 10840075}, {"filename": "/toontalk/pics/floora.bmp", "start": 10840075, "end": 11148353}, {"filename": "/toontalk/pics/floorb.bmp", "start": 11148353, "end": 11456631}, {"filename": "/toontalk/pics/floorc.bmp", "start": 11456631, "end": 11764909}, {"filename": "/toontalk/pics/floord.bmp", "start": 11764909, "end": 12073187}, {"filename": "/toontalk/pics/flower.bmp", "start": 12073187, "end": 12081945}, {"filename": "/toontalk/pics/flower2.bmp", "start": 12081945, "end": 12090703}, {"filename": "/toontalk/pics/flower3.bmp", "start": 12090703, "end": 12099461}, {"filename": "/toontalk/pics/flower4.bmp", "start": 12099461, "end": 12108219}, {"filename": "/toontalk/pics/flower5.bmp", "start": 12108219, "end": 12116977}, {"filename": "/toontalk/pics/flowerp.bmp", "start": 12116977, "end": 12125735}, {"filename": "/toontalk/pics/flowerr.bmp", "start": 12125735, "end": 12134493}, {"filename": "/toontalk/pics/fly01.bmp", "start": 12134493, "end": 12169915}, {"filename": "/toontalk/pics/fly02.bmp", "start": 12169915, "end": 12194377}, {"filename": "/toontalk/pics/fly03.bmp", "start": 12194377, "end": 12217431}, {"filename": "/toontalk/pics/fly04.bmp", "start": 12217431, "end": 12249469}, {"filename": "/toontalk/pics/fly05.bmp", "start": 12249469, "end": 12280991}, {"filename": "/toontalk/pics/fly06.bmp", "start": 12280991, "end": 12292147}, {"filename": "/toontalk/pics/fly07.bmp", "start": 12292147, "end": 12325697}, {"filename": "/toontalk/pics/fly08.bmp", "start": 12325697, "end": 12352695}, {"filename": "/toontalk/pics/fly09.bmp", "start": 12352695, "end": 12378025}, {"filename": "/toontalk/pics/fly10.bmp", "start": 12378025, "end": 12401367}, {"filename": "/toontalk/pics/fly11.bmp", "start": 12401367, "end": 12423429}, {"filename": "/toontalk/pics/fly12.bmp", "start": 12423429, "end": 12447555}, {"filename": "/toontalk/pics/fly13.bmp", "start": 12447555, "end": 12481913}, {"filename": "/toontalk/pics/fly14.bmp", "start": 12481913, "end": 12513359}, {"filename": "/toontalk/pics/fly15.bmp", "start": 12513359, "end": 12538357}, {"filename": "/toontalk/pics/fly16.bmp", "start": 12538357, "end": 12567723}, {"filename": "/toontalk/pics/fly17.bmp", "start": 12567723, "end": 12593761}, {"filename": "/toontalk/pics/fly18.bmp", "start": 12593761, "end": 12622711}, {"filename": "/toontalk/pics/fly19.bmp", "start": 12622711, "end": 12654245}, {"filename": "/toontalk/pics/fly20.bmp", "start": 12654245, "end": 12682395}, {"filename": "/toontalk/pics/fly21.bmp", "start": 12682395, "end": 12712473}, {"filename": "/toontalk/pics/fly22.bmp", "start": 12712473, "end": 12726693}, {"filename": "/toontalk/pics/fly23.bmp", "start": 12726693, "end": 12756387}, {"filename": "/toontalk/pics/fly24.bmp", "start": 12756387, "end": 12785297}, {"filename": "/toontalk/pics/fly25.bmp", "start": 12785297, "end": 12799187}, {"filename": "/toontalk/pics/fly26.bmp", "start": 12799187, "end": 12824169}, {"filename": "/toontalk/pics/fly27.bmp", "start": 12824169, "end": 12859151}, {"filename": "/toontalk/pics/fly28.bmp", "start": 12859151, "end": 12899661}, {"filename": "/toontalk/pics/fly29.bmp", "start": 12899661, "end": 12914349}, {"filename": "/toontalk/pics/fly30.bmp", "start": 12914349, "end": 12954955}, {"filename": "/toontalk/pics/fly31.bmp", "start": 12954955, "end": 12986489}, {"filename": "/toontalk/pics/fly32.bmp", "start": 12986489, "end": 13014639}, {"filename": "/toontalk/pics/fly33.bmp", "start": 13014639, "end": 13044717}, {"filename": "/toontalk/pics/fly34.bmp", "start": 13044717, "end": 13058917}, {"filename": "/toontalk/pics/fly35.bmp", "start": 13058917, "end": 13088611}, {"filename": "/toontalk/pics/fly36.bmp", "start": 13088611, "end": 13117913}, {"filename": "/toontalk/pics/fly37.bmp", "start": 13117913, "end": 13152271}, {"filename": "/toontalk/pics/fly38.bmp", "start": 13152271, "end": 13183509}, {"filename": "/toontalk/pics/fly39.bmp", "start": 13183509, "end": 13208507}, {"filename": "/toontalk/pics/fly40.bmp", "start": 13208507, "end": 13237873}, {"filename": "/toontalk/pics/fly41.bmp", "start": 13237873, "end": 13263495}, {"filename": "/toontalk/pics/fly42.bmp", "start": 13263495, "end": 13292445}, {"filename": "/toontalk/pics/fly43.bmp", "start": 13292445, "end": 13306339}, {"filename": "/toontalk/pics/fly44.bmp", "start": 13306339, "end": 13332857}, {"filename": "/toontalk/pics/fly45.bmp", "start": 13332857, "end": 13358187}, {"filename": "/toontalk/pics/fly46.bmp", "start": 13358187, "end": 13381529}, {"filename": "/toontalk/pics/fly47.bmp", "start": 13381529, "end": 13403591}, {"filename": "/toontalk/pics/fly48.bmp", "start": 13403591, "end": 13427717}, {"filename": "/toontalk/pics/flydown1.bmp", "start": 13427717, "end": 13463775}, {"filename": "/toontalk/pics/flydown2.bmp", "start": 13463775, "end": 13497793}, {"filename": "/toontalk/pics/flydown3.bmp", "start": 13497793, "end": 13530151}, {"filename": "/toontalk/pics/flydown4.bmp", "start": 13530151, "end": 13560641}, {"filename": "/toontalk/pics/flydown5.bmp", "start": 13560641, "end": 13582799}, {"filename": "/toontalk/pics/frame.bmp", "start": 13582799, "end": 13627365}, {"filename": "/toontalk/pics/gimme1.bmp", "start": 13627365, "end": 13649387}, {"filename": "/toontalk/pics/gimme2.bmp", "start": 13649387, "end": 13669313}, {"filename": "/toontalk/pics/gimme3.bmp", "start": 13669313, "end": 13689351}, {"filename": "/toontalk/pics/gimme4.bmp", "start": 13689351, "end": 13709453}, {"filename": "/toontalk/pics/gimme5.bmp", "start": 13709453, "end": 13728395}, {"filename": "/toontalk/pics/gimme6.bmp", "start": 13728395, "end": 13748321}, {"filename": "/toontalk/pics/haire01.bmp", "start": 13748321, "end": 13752703}, {"filename": "/toontalk/pics/haire02.bmp", "start": 13752703, "end": 13756417}, {"filename": "/toontalk/pics/haire03.bmp", "start": 13756417, "end": 13760131}, {"filename": "/toontalk/pics/haire04.bmp", "start": 13760131, "end": 13763845}, {"filename": "/toontalk/pics/haire05.bmp", "start": 13763845, "end": 13767559}, {"filename": "/toontalk/pics/haire06.bmp", "start": 13767559, "end": 13771267}, {"filename": "/toontalk/pics/haire07.bmp", "start": 13771267, "end": 13774981}, {"filename": "/toontalk/pics/haire08.bmp", "start": 13774981, "end": 13778695}, {"filename": "/toontalk/pics/hairn01.bmp", "start": 13778695, "end": 13783805}, {"filename": "/toontalk/pics/hairn02.bmp", "start": 13783805, "end": 13788915}, {"filename": "/toontalk/pics/hairn03.bmp", "start": 13788915, "end": 13794025}, {"filename": "/toontalk/pics/hairn04.bmp", "start": 13794025, "end": 13799135}, {"filename": "/toontalk/pics/hairn05.bmp", "start": 13799135, "end": 13804245}, {"filename": "/toontalk/pics/hairn06.bmp", "start": 13804245, "end": 13809355}, {"filename": "/toontalk/pics/hairn07.bmp", "start": 13809355, "end": 13814465}, {"filename": "/toontalk/pics/hairn08.bmp", "start": 13814465, "end": 13819575}, {"filename": "/toontalk/pics/hairne01.bmp", "start": 13819575, "end": 13824253}, {"filename": "/toontalk/pics/hairne02.bmp", "start": 13824253, "end": 13828931}, {"filename": "/toontalk/pics/hairne03.bmp", "start": 13828931, "end": 13833609}, {"filename": "/toontalk/pics/hairne04.bmp", "start": 13833609, "end": 13838287}, {"filename": "/toontalk/pics/hairne05.bmp", "start": 13838287, "end": 13842965}, {"filename": "/toontalk/pics/hairne06.bmp", "start": 13842965, "end": 13847643}, {"filename": "/toontalk/pics/hairne07.bmp", "start": 13847643, "end": 13852321}, {"filename": "/toontalk/pics/hairne08.bmp", "start": 13852321, "end": 13856999}, {"filename": "/toontalk/pics/hairnw01.bmp", "start": 13856999, "end": 13861677}, {"filename": "/toontalk/pics/hairnw02.bmp", "start": 13861677, "end": 13866355}, {"filename": "/toontalk/pics/hairnw03.bmp", "start": 13866355, "end": 13871033}, {"filename": "/toontalk/pics/hairnw04.bmp", "start": 13871033, "end": 13875711}, {"filename": "/toontalk/pics/hairnw05.bmp", "start": 13875711, "end": 13880389}, {"filename": "/toontalk/pics/hairnw06.bmp", "start": 13880389, "end": 13885067}, {"filename": "/toontalk/pics/hairnw07.bmp", "start": 13885067, "end": 13889745}, {"filename": "/toontalk/pics/hairnw08.bmp", "start": 13889745, "end": 13894423}, {"filename": "/toontalk/pics/hairs01.bmp", "start": 13894423, "end": 13899405}, {"filename": "/toontalk/pics/hairs02.bmp", "start": 13899405, "end": 13904451}, {"filename": "/toontalk/pics/hairs03.bmp", "start": 13904451, "end": 13909433}, {"filename": "/toontalk/pics/hairs04.bmp", "start": 13909433, "end": 13914543}, {"filename": "/toontalk/pics/hairs05.bmp", "start": 13914543, "end": 13919525}, {"filename": "/toontalk/pics/hairs06.bmp", "start": 13919525, "end": 13924507}, {"filename": "/toontalk/pics/hairs07.bmp", "start": 13924507, "end": 13929425}, {"filename": "/toontalk/pics/hairs08.bmp", "start": 13929425, "end": 13934343}, {"filename": "/toontalk/pics/hairse01.bmp", "start": 13934343, "end": 13939081}, {"filename": "/toontalk/pics/hairse02.bmp", "start": 13939081, "end": 13943819}, {"filename": "/toontalk/pics/hairse03.bmp", "start": 13943819, "end": 13948557}, {"filename": "/toontalk/pics/hairse04.bmp", "start": 13948557, "end": 13953295}, {"filename": "/toontalk/pics/hairse05.bmp", "start": 13953295, "end": 13958033}, {"filename": "/toontalk/pics/hairse06.bmp", "start": 13958033, "end": 13962771}, {"filename": "/toontalk/pics/hairse07.bmp", "start": 13962771, "end": 13967509}, {"filename": "/toontalk/pics/hairse08.bmp", "start": 13967509, "end": 13972247}, {"filename": "/toontalk/pics/hairsw01.bmp", "start": 13972247, "end": 13976985}, {"filename": "/toontalk/pics/hairsw02.bmp", "start": 13976985, "end": 13981723}, {"filename": "/toontalk/pics/hairsw03.bmp", "start": 13981723, "end": 13986461}, {"filename": "/toontalk/pics/hairsw04.bmp", "start": 13986461, "end": 13991199}, {"filename": "/toontalk/pics/hairsw05.bmp", "start": 13991199, "end": 13995937}, {"filename": "/toontalk/pics/hairsw06.bmp", "start": 13995937, "end": 14000675}, {"filename": "/toontalk/pics/hairsw07.bmp", "start": 14000675, "end": 14005413}, {"filename": "/toontalk/pics/hairsw08.bmp", "start": 14005413, "end": 14010151}, {"filename": "/toontalk/pics/hairw01.bmp", "start": 14010151, "end": 14014533}, {"filename": "/toontalk/pics/hairw02.bmp", "start": 14014533, "end": 14018241}, {"filename": "/toontalk/pics/hairw03.bmp", "start": 14018241, "end": 14021949}, {"filename": "/toontalk/pics/hairw04.bmp", "start": 14021949, "end": 14025657}, {"filename": "/toontalk/pics/hairw05.bmp", "start": 14025657, "end": 14029365}, {"filename": "/toontalk/pics/hairw06.bmp", "start": 14029365, "end": 14033073}, {"filename": "/toontalk/pics/hairw07.bmp", "start": 14033073, "end": 14036781}, {"filename": "/toontalk/pics/hairw08.bmp", "start": 14036781, "end": 14040493}, {"filename": "/toontalk/pics/hand01.bmp", "start": 14040493, "end": 14062953}, {"filename": "/toontalk/pics/hand018.bmp", "start": 14062953, "end": 14098527}, {"filename": "/toontalk/pics/hand019.bmp", "start": 14098527, "end": 14134101}, {"filename": "/toontalk/pics/hand02.bmp", "start": 14134101, "end": 14178427}, {"filename": "/toontalk/pics/hand020.bmp", "start": 14178427, "end": 14214001}, {"filename": "/toontalk/pics/hand03.bmp", "start": 14214001, "end": 14248791}, {"filename": "/toontalk/pics/hand04.bmp", "start": 14248791, "end": 14264587}, {"filename": "/toontalk/pics/hand05.bmp", "start": 14264587, "end": 14291977}, {"filename": "/toontalk/pics/hand06.bmp", "start": 14291977, "end": 14315615}, {"filename": "/toontalk/pics/hand07.bmp", "start": 14315615, "end": 14338501}, {"filename": "/toontalk/pics/hatch01.bmp", "start": 14338501, "end": 14359121}, {"filename": "/toontalk/pics/hatch02.bmp", "start": 14359121, "end": 14379775}, {"filename": "/toontalk/pics/hatch03.bmp", "start": 14379775, "end": 14409557}, {"filename": "/toontalk/pics/hatch04.bmp", "start": 14409557, "end": 14439339}, {"filename": "/toontalk/pics/hatch05.bmp", "start": 14439339, "end": 14460009}, {"filename": "/toontalk/pics/hatch06.bmp", "start": 14460009, "end": 14489791}, {"filename": "/toontalk/pics/hatch07.bmp", "start": 14489791, "end": 14510451}, {"filename": "/toontalk/pics/hatch08.bmp", "start": 14510451, "end": 14540857}, {"filename": "/toontalk/pics/hatch09.bmp", "start": 14540857, "end": 14571263}, {"filename": "/toontalk/pics/hatch10.bmp", "start": 14571263, "end": 14605429}, {"filename": "/toontalk/pics/hatch11.bmp", "start": 14605429, "end": 14629781}, {"filename": "/toontalk/pics/hatch12.bmp", "start": 14629781, "end": 14675259}, {"filename": "/toontalk/pics/hatch13.bmp", "start": 14675259, "end": 14718637}, {"filename": "/toontalk/pics/hatch14.bmp", "start": 14718637, "end": 14749043}, {"filename": "/toontalk/pics/hate01.bmp", "start": 14749043, "end": 14754909}, {"filename": "/toontalk/pics/hate02.bmp", "start": 14754909, "end": 14760775}, {"filename": "/toontalk/pics/hate03.bmp", "start": 14760775, "end": 14766641}, {"filename": "/toontalk/pics/hate04.bmp", "start": 14766641, "end": 14772507}, {"filename": "/toontalk/pics/hate05.bmp", "start": 14772507, "end": 14778373}, {"filename": "/toontalk/pics/hate06.bmp", "start": 14778373, "end": 14784239}, {"filename": "/toontalk/pics/hate07.bmp", "start": 14784239, "end": 14790105}, {"filename": "/toontalk/pics/hate08.bmp", "start": 14790105, "end": 14795719}, {"filename": "/toontalk/pics/hatn01.bmp", "start": 14795719, "end": 14800637}, {"filename": "/toontalk/pics/hatn02.bmp", "start": 14800637, "end": 14805299}, {"filename": "/toontalk/pics/hatn03.bmp", "start": 14805299, "end": 14809961}, {"filename": "/toontalk/pics/hatn04.bmp", "start": 14809961, "end": 14814623}, {"filename": "/toontalk/pics/hatn05.bmp", "start": 14814623, "end": 14819285}, {"filename": "/toontalk/pics/hatn06.bmp", "start": 14819285, "end": 14823947}, {"filename": "/toontalk/pics/hatn07.bmp", "start": 14823947, "end": 14828609}, {"filename": "/toontalk/pics/hatn08.bmp", "start": 14828609, "end": 14833271}, {"filename": "/toontalk/pics/hatne01.bmp", "start": 14833271, "end": 14838381}, {"filename": "/toontalk/pics/hatne02.bmp", "start": 14838381, "end": 14843427}, {"filename": "/toontalk/pics/hatne03.bmp", "start": 14843427, "end": 14848409}, {"filename": "/toontalk/pics/hatne04.bmp", "start": 14848409, "end": 14853327}, {"filename": "/toontalk/pics/hatne05.bmp", "start": 14853327, "end": 14858437}, {"filename": "/toontalk/pics/hatne06.bmp", "start": 14858437, "end": 14863547}, {"filename": "/toontalk/pics/hatne07.bmp", "start": 14863547, "end": 14868657}, {"filename": "/toontalk/pics/hatne08.bmp", "start": 14868657, "end": 14873575}, {"filename": "/toontalk/pics/hatnw01.bmp", "start": 14873575, "end": 14878685}, {"filename": "/toontalk/pics/hatnw02.bmp", "start": 14878685, "end": 14883731}, {"filename": "/toontalk/pics/hatnw03.bmp", "start": 14883731, "end": 14888713}, {"filename": "/toontalk/pics/hatnw04.bmp", "start": 14888713, "end": 14893631}, {"filename": "/toontalk/pics/hatnw05.bmp", "start": 14893631, "end": 14898741}, {"filename": "/toontalk/pics/hatnw06.bmp", "start": 14898741, "end": 14903851}, {"filename": "/toontalk/pics/hatnw07.bmp", "start": 14903851, "end": 14908961}, {"filename": "/toontalk/pics/hatnw08.bmp", "start": 14908961, "end": 14913879}, {"filename": "/toontalk/pics/hats01.bmp", "start": 14913879, "end": 14918857}, {"filename": "/toontalk/pics/hats02.bmp", "start": 14918857, "end": 14923895}, {"filename": "/toontalk/pics/hats03.bmp", "start": 14923895, "end": 14928933}, {"filename": "/toontalk/pics/hats04.bmp", "start": 14928933, "end": 14933851}, {"filename": "/toontalk/pics/hats05.bmp", "start": 14933851, "end": 14938889}, {"filename": "/toontalk/pics/hats06.bmp", "start": 14938889, "end": 14943747}, {"filename": "/toontalk/pics/hats07.bmp", "start": 14943747, "end": 14948785}, {"filename": "/toontalk/pics/hats08.bmp", "start": 14948785, "end": 14953823}, {"filename": "/toontalk/pics/hatse01.bmp", "start": 14953823, "end": 14959457}, {"filename": "/toontalk/pics/hatse02.bmp", "start": 14959457, "end": 14964955}, {"filename": "/toontalk/pics/hatse03.bmp", "start": 14964955, "end": 14970521}, {"filename": "/toontalk/pics/hatse04.bmp", "start": 14970521, "end": 14976155}, {"filename": "/toontalk/pics/hatse05.bmp", "start": 14976155, "end": 14981721}, {"filename": "/toontalk/pics/hatse06.bmp", "start": 14981721, "end": 14987355}, {"filename": "/toontalk/pics/hatse07.bmp", "start": 14987355, "end": 14992989}, {"filename": "/toontalk/pics/hatse08.bmp", "start": 14992989, "end": 14998623}, {"filename": "/toontalk/pics/hatsw01.bmp", "start": 14998623, "end": 15004257}, {"filename": "/toontalk/pics/hatsw02.bmp", "start": 15004257, "end": 15009755}, {"filename": "/toontalk/pics/hatsw03.bmp", "start": 15009755, "end": 15015321}, {"filename": "/toontalk/pics/hatsw04.bmp", "start": 15015321, "end": 15020955}, {"filename": "/toontalk/pics/hatsw05.bmp", "start": 15020955, "end": 15026521}, {"filename": "/toontalk/pics/hatsw06.bmp", "start": 15026521, "end": 15032155}, {"filename": "/toontalk/pics/hatsw07.bmp", "start": 15032155, "end": 15037789}, {"filename": "/toontalk/pics/hatsw08.bmp", "start": 15037789, "end": 15043423}, {"filename": "/toontalk/pics/hatw01.bmp", "start": 15043423, "end": 15049289}, {"filename": "/toontalk/pics/hatw02.bmp", "start": 15049289, "end": 15055155}, {"filename": "/toontalk/pics/hatw03.bmp", "start": 15055155, "end": 15061021}, {"filename": "/toontalk/pics/hatw04.bmp", "start": 15061021, "end": 15066887}, {"filename": "/toontalk/pics/hatw05.bmp", "start": 15066887, "end": 15072753}, {"filename": "/toontalk/pics/hatw06.bmp", "start": 15072753, "end": 15078619}, {"filename": "/toontalk/pics/hatw07.bmp", "start": 15078619, "end": 15084485}, {"filename": "/toontalk/pics/hatw08.bmp", "start": 15084485, "end": 15089003}, {"filename": "/toontalk/pics/heli01.bmp", "start": 15089003, "end": 15158285}, {"filename": "/toontalk/pics/heli02.bmp", "start": 15158285, "end": 15174467}, {"filename": "/toontalk/pics/heli03.bmp", "start": 15174467, "end": 15230817}, {"filename": "/toontalk/pics/heli04.bmp", "start": 15230817, "end": 15282403}, {"filename": "/toontalk/pics/heli05.bmp", "start": 15282403, "end": 15344409}, {"filename": "/toontalk/pics/heli06.bmp", "start": 15344409, "end": 15405135}, {"filename": "/toontalk/pics/heli07.bmp", "start": 15405135, "end": 15419431}, {"filename": "/toontalk/pics/heli08.bmp", "start": 15419431, "end": 15474365}, {"filename": "/toontalk/pics/heli09.bmp", "start": 15474365, "end": 15530823}, {"filename": "/toontalk/pics/heli10.bmp", "start": 15530823, "end": 15582029}, {"filename": "/toontalk/pics/heli11.bmp", "start": 15582029, "end": 15645327}, {"filename": "/toontalk/pics/heli12.bmp", "start": 15645327, "end": 15707057}, {"filename": "/toontalk/pics/heli13.bmp", "start": 15707057, "end": 15775183}, {"filename": "/toontalk/pics/heli14.bmp", "start": 15775183, "end": 15828985}, {"filename": "/toontalk/pics/heli15.bmp", "start": 15828985, "end": 15885335}, {"filename": "/toontalk/pics/heli16.bmp", "start": 15885335, "end": 15936433}, {"filename": "/toontalk/pics/heli17.bmp", "start": 15936433, "end": 15998695}, {"filename": "/toontalk/pics/heli18.bmp", "start": 15998695, "end": 16059421}, {"filename": "/toontalk/pics/heli19.bmp", "start": 16059421, "end": 16127951}, {"filename": "/toontalk/pics/heli20.bmp", "start": 16127951, "end": 16183157}, {"filename": "/toontalk/pics/heli21.bmp", "start": 16183157, "end": 16240467}, {"filename": "/toontalk/pics/heli22.bmp", "start": 16240467, "end": 16300241}, {"filename": "/toontalk/pics/heli23.bmp", "start": 16300241, "end": 16352623}, {"filename": "/toontalk/pics/heli24.bmp", "start": 16352623, "end": 16414421}, {"filename": "/toontalk/pics/helihlm1.bmp", "start": 16414421, "end": 16550795}, {"filename": "/toontalk/pics/helihlm2.bmp", "start": 16550795, "end": 16677713}, {"filename": "/toontalk/pics/helihlm3.bmp", "start": 16677713, "end": 16804887}, {"filename": "/toontalk/pics/helihlm4.bmp", "start": 16804887, "end": 16851993}, {"filename": "/toontalk/pics/helihlm5.bmp", "start": 16851993, "end": 16978911}, {"filename": "/toontalk/pics/helihlm6.bmp", "start": 16978911, "end": 17106085}, {"filename": "/toontalk/pics/helihlm7.bmp", "start": 17106085, "end": 17152511}, {"filename": "/toontalk/pics/hit1.bmp", "start": 17152511, "end": 17189385}, {"filename": "/toontalk/pics/hit2.bmp", "start": 17189385, "end": 17226259}, {"filename": "/toontalk/pics/hit3.bmp", "start": 17226259, "end": 17263133}, {"filename": "/toontalk/pics/hitmiss.bmp", "start": 17263133, "end": 17300007}, {"filename": "/toontalk/pics/hitquery.bmp", "start": 17300007, "end": 17336881}, {"filename": "/toontalk/pics/hose00.bmp", "start": 17336881, "end": 17357447}, {"filename": "/toontalk/pics/hose01.bmp", "start": 17357447, "end": 17378013}, {"filename": "/toontalk/pics/hose02.bmp", "start": 17378013, "end": 17398579}, {"filename": "/toontalk/pics/hose03.bmp", "start": 17398579, "end": 17419841}, {"filename": "/toontalk/pics/hose04.bmp", "start": 17419841, "end": 17443191}, {"filename": "/toontalk/pics/hose05.bmp", "start": 17443191, "end": 17470021}, {"filename": "/toontalk/pics/hose06.bmp", "start": 17470021, "end": 17496851}, {"filename": "/toontalk/pics/hose07.bmp", "start": 17496851, "end": 17525073}, {"filename": "/toontalk/pics/hose08.bmp", "start": 17525073, "end": 17556775}, {"filename": "/toontalk/pics/hose09.bmp", "start": 17556775, "end": 17573481}, {"filename": "/toontalk/pics/hose10.bmp", "start": 17573481, "end": 17610751}, {"filename": "/toontalk/pics/hose11.bmp", "start": 17610751, "end": 17648021}, {"filename": "/toontalk/pics/hose12.bmp", "start": 17648021, "end": 17664801}, {"filename": "/toontalk/pics/hrsit1.bmp", "start": 17664801, "end": 17694771}, {"filename": "/toontalk/pics/hrsit2.bmp", "start": 17694771, "end": 17723929}, {"filename": "/toontalk/pics/hrsit3.bmp", "start": 17723929, "end": 17752367}, {"filename": "/toontalk/pics/hrsit4.bmp", "start": 17752367, "end": 17769397}, {"filename": "/toontalk/pics/hrsit5.bmp", "start": 17769397, "end": 17798219}, {"filename": "/toontalk/pics/hrsit6.bmp", "start": 17798219, "end": 17814289}, {"filename": "/toontalk/pics/hrsit7.bmp", "start": 17814289, "end": 17833895}, {"filename": "/toontalk/pics/hsa01.bmp", "start": 17833895, "end": 17843115}, {"filename": "/toontalk/pics/hsa02.bmp", "start": 17843115, "end": 17867745}, {"filename": "/toontalk/pics/hsa03.bmp", "start": 17867745, "end": 17880249}, {"filename": "/toontalk/pics/hsa04.bmp", "start": 17880249, "end": 17907247}, {"filename": "/toontalk/pics/hsa05.bmp", "start": 17907247, "end": 17944613}, {"filename": "/toontalk/pics/hsa06.bmp", "start": 17944613, "end": 17968569}, {"filename": "/toontalk/pics/hsa07.bmp", "start": 17968569, "end": 18025519}, {"filename": "/toontalk/pics/hsa08.bmp", "start": 18025519, "end": 18078437}, {"filename": "/toontalk/pics/hsa09.bmp", "start": 18078437, "end": 18120915}, {"filename": "/toontalk/pics/hsa10.bmp", "start": 18120915, "end": 18166921}, {"filename": "/toontalk/pics/hsa11.bmp", "start": 18166921, "end": 18216663}, {"filename": "/toontalk/pics/hsa12.bmp", "start": 18216663, "end": 18282421}, {"filename": "/toontalk/pics/hsa13.bmp", "start": 18282421, "end": 18361867}, {"filename": "/toontalk/pics/hsa14.bmp", "start": 18361867, "end": 18430089}, {"filename": "/toontalk/pics/hsa15.bmp", "start": 18430089, "end": 18560815}, {"filename": "/toontalk/pics/hsa16.bmp", "start": 18560815, "end": 18627243}, {"filename": "/toontalk/pics/hsa17.bmp", "start": 18627243, "end": 18726281}, {"filename": "/toontalk/pics/hsa18.bmp", "start": 18726281, "end": 18825103}, {"filename": "/toontalk/pics/hsa19.bmp", "start": 18825103, "end": 18831221}, {"filename": "/toontalk/pics/hsa20.bmp", "start": 18831221, "end": 18837219}, {"filename": "/toontalk/pics/hsatop02.bmp", "start": 18837219, "end": 18868001}, {"filename": "/toontalk/pics/hsatop03.bmp", "start": 18868001, "end": 18941439}, {"filename": "/toontalk/pics/hsatop04.bmp", "start": 18941439, "end": 19002037}, {"filename": "/toontalk/pics/hsatop05.bmp", "start": 19002037, "end": 19081547}, {"filename": "/toontalk/pics/hsatop06.bmp", "start": 19081547, "end": 19139585}, {"filename": "/toontalk/pics/hsatop07.bmp", "start": 19139585, "end": 19218615}, {"filename": "/toontalk/pics/hsatop08.bmp", "start": 19218615, "end": 19301693}, {"filename": "/toontalk/pics/hsatop09.bmp", "start": 19301693, "end": 19402507}, {"filename": "/toontalk/pics/hsatop10.bmp", "start": 19402507, "end": 19509713}, {"filename": "/toontalk/pics/hsatop11.bmp", "start": 19509713, "end": 19607271}, {"filename": "/toontalk/pics/hsatop12.bmp", "start": 19607271, "end": 19707301}, {"filename": "/toontalk/pics/hsatop13.bmp", "start": 19707301, "end": 19796699}, {"filename": "/toontalk/pics/hsatop14.bmp", "start": 19796699, "end": 19888017}, {"filename": "/toontalk/pics/hsatop15.bmp", "start": 19888017, "end": 19979335}, {"filename": "/toontalk/pics/hsatop16.bmp", "start": 19979335, "end": 20070653}, {"filename": "/toontalk/pics/hsatop17.bmp", "start": 20070653, "end": 20161971}, {"filename": "/toontalk/pics/hsatop18.bmp", "start": 20161971, "end": 20253289}, {"filename": "/toontalk/pics/hsatop19.bmp", "start": 20253289, "end": 20344607}, {"filename": "/toontalk/pics/hsatop20.bmp", "start": 20344607, "end": 20435925}, {"filename": "/toontalk/pics/hsb02.bmp", "start": 20435925, "end": 20449547}, {"filename": "/toontalk/pics/hsb03.bmp", "start": 20449547, "end": 20458353}, {"filename": "/toontalk/pics/hsb04.bmp", "start": 20458353, "end": 20476903}, {"filename": "/toontalk/pics/hsb05.bmp", "start": 20476903, "end": 20495453}, {"filename": "/toontalk/pics/hsb06.bmp", "start": 20495453, "end": 20523411}, {"filename": "/toontalk/pics/hsb07.bmp", "start": 20523411, "end": 20537911}, {"filename": "/toontalk/pics/hsb08.bmp", "start": 20537911, "end": 20569669}, {"filename": "/toontalk/pics/hsb09.bmp", "start": 20569669, "end": 20589147}, {"filename": "/toontalk/pics/hsb10.bmp", "start": 20589147, "end": 20615505}, {"filename": "/toontalk/pics/hsb11.bmp", "start": 20615505, "end": 20642297}, {"filename": "/toontalk/pics/hsb12.bmp", "start": 20642297, "end": 20690015}, {"filename": "/toontalk/pics/hsb13.bmp", "start": 20690015, "end": 20738133}, {"filename": "/toontalk/pics/hsb14.bmp", "start": 20738133, "end": 20776045}, {"filename": "/toontalk/pics/hsb15.bmp", "start": 20776045, "end": 20849699}, {"filename": "/toontalk/pics/hsb16.bmp", "start": 20849699, "end": 20912377}, {"filename": "/toontalk/pics/hsb17.bmp", "start": 20912377, "end": 21006127}, {"filename": "/toontalk/pics/hsb18.bmp", "start": 21006127, "end": 21076013}, {"filename": "/toontalk/pics/hsb19.bmp", "start": 21076013, "end": 21136579}, {"filename": "/toontalk/pics/hsb20.bmp", "start": 21136579, "end": 21190777}, {"filename": "/toontalk/pics/hsb21.bmp", "start": 21190777, "end": 21196335}, {"filename": "/toontalk/pics/hsb22.bmp", "start": 21196335, "end": 21201893}, {"filename": "/toontalk/pics/hsbtop02.bmp", "start": 21201893, "end": 21218171}, {"filename": "/toontalk/pics/hsbtop03.bmp", "start": 21218171, "end": 21252177}, {"filename": "/toontalk/pics/hsbtop04.bmp", "start": 21252177, "end": 21293159}, {"filename": "/toontalk/pics/hsbtop05.bmp", "start": 21293159, "end": 21318701}, {"filename": "/toontalk/pics/hsbtop06.bmp", "start": 21318701, "end": 21366699}, {"filename": "/toontalk/pics/hsbtop07.bmp", "start": 21366699, "end": 21416961}, {"filename": "/toontalk/pics/hsbtop08.bmp", "start": 21416961, "end": 21474431}, {"filename": "/toontalk/pics/hsbtop09.bmp", "start": 21474431, "end": 21517045}, {"filename": "/toontalk/pics/hsbtop10.bmp", "start": 21517045, "end": 21576523}, {"filename": "/toontalk/pics/hsbtop11.bmp", "start": 21576523, "end": 21631809}, {"filename": "/toontalk/pics/hsbtop12.bmp", "start": 21631809, "end": 21670643}, {"filename": "/toontalk/pics/hsbtop13.bmp", "start": 21670643, "end": 21719721}, {"filename": "/toontalk/pics/hsbtop14.bmp", "start": 21719721, "end": 21770719}, {"filename": "/toontalk/pics/hsbtop15.bmp", "start": 21770719, "end": 21825797}, {"filename": "/toontalk/pics/hsbtop16.bmp", "start": 21825797, "end": 21868927}, {"filename": "/toontalk/pics/hsbtop17.bmp", "start": 21868927, "end": 21932757}, {"filename": "/toontalk/pics/hsbtop18.bmp", "start": 21932757, "end": 21982075}, {"filename": "/toontalk/pics/hsbtop19.bmp", "start": 21982075, "end": 22044065}, {"filename": "/toontalk/pics/hsbtop20.bmp", "start": 22044065, "end": 22106055}, {"filename": "/toontalk/pics/hsc02.bmp", "start": 22106055, "end": 22120861}, {"filename": "/toontalk/pics/hsc03.bmp", "start": 22120861, "end": 22143891}, {"filename": "/toontalk/pics/hsc04.bmp", "start": 22143891, "end": 22166921}, {"filename": "/toontalk/pics/hsc05.bmp", "start": 22166921, "end": 22203399}, {"filename": "/toontalk/pics/hsc06.bmp", "start": 22203399, "end": 22235261}, {"filename": "/toontalk/pics/hsc07.bmp", "start": 22235261, "end": 22271979}, {"filename": "/toontalk/pics/hsc08.bmp", "start": 22271979, "end": 22309977}, {"filename": "/toontalk/pics/hsc09.bmp", "start": 22309977, "end": 22348543}, {"filename": "/toontalk/pics/hsc10.bmp", "start": 22348543, "end": 22398869}, {"filename": "/toontalk/pics/hsc11.bmp", "start": 22398869, "end": 22453067}, {"filename": "/toontalk/pics/hsc12.bmp", "start": 22453067, "end": 22505105}, {"filename": "/toontalk/pics/hsc13.bmp", "start": 22505105, "end": 22563183}, {"filename": "/toontalk/pics/hsc14.bmp", "start": 22563183, "end": 22623541}, {"filename": "/toontalk/pics/hsc15.bmp", "start": 22623541, "end": 22682219}, {"filename": "/toontalk/pics/hsc16.bmp", "start": 22682219, "end": 22751297}, {"filename": "/toontalk/pics/hsc17.bmp", "start": 22751297, "end": 22813175}, {"filename": "/toontalk/pics/hsc18.bmp", "start": 22813175, "end": 22886973}, {"filename": "/toontalk/pics/hsc19.bmp", "start": 22886973, "end": 22946291}, {"filename": "/toontalk/pics/hsc20.bmp", "start": 22946291, "end": 23000489}, {"filename": "/toontalk/pics/hsc21.bmp", "start": 23000489, "end": 23010207}, {"filename": "/toontalk/pics/hsc22.bmp", "start": 23010207, "end": 23019037}, {"filename": "/toontalk/pics/hsctop02.bmp", "start": 23019037, "end": 23031091}, {"filename": "/toontalk/pics/hsctop03.bmp", "start": 23031091, "end": 23048297}, {"filename": "/toontalk/pics/hsctop04.bmp", "start": 23048297, "end": 23087215}, {"filename": "/toontalk/pics/hsctop05.bmp", "start": 23087215, "end": 23125253}, {"filename": "/toontalk/pics/hsctop06.bmp", "start": 23125253, "end": 23172891}, {"filename": "/toontalk/pics/hsctop07.bmp", "start": 23172891, "end": 23232145}, {"filename": "/toontalk/pics/hsctop08.bmp", "start": 23232145, "end": 23284559}, {"filename": "/toontalk/pics/hsctop09.bmp", "start": 23284559, "end": 23344621}, {"filename": "/toontalk/pics/hsctop10.bmp", "start": 23344621, "end": 23401179}, {"filename": "/toontalk/pics/hsctop11.bmp", "start": 23401179, "end": 23453065}, {"filename": "/toontalk/pics/hsctop12.bmp", "start": 23453065, "end": 23521535}, {"filename": "/toontalk/pics/hsctop13.bmp", "start": 23521535, "end": 23589493}, {"filename": "/toontalk/pics/hsctop14.bmp", "start": 23589493, "end": 23643467}, {"filename": "/toontalk/pics/hsctop15.bmp", "start": 23643467, "end": 23697441}, {"filename": "/toontalk/pics/hsctop16.bmp", "start": 23697441, "end": 23757679}, {"filename": "/toontalk/pics/hsctop17.bmp", "start": 23757679, "end": 23824277}, {"filename": "/toontalk/pics/hsctop18.bmp", "start": 23824277, "end": 23878251}, {"filename": "/toontalk/pics/hsctop19.bmp", "start": 23878251, "end": 23945601}, {"filename": "/toontalk/pics/hsctop20.bmp", "start": 23945601, "end": 23999575}, {"filename": "/toontalk/pics/htsit1.bmp", "start": 23999575, "end": 24030165}, {"filename": "/toontalk/pics/htsit2.bmp", "start": 24030165, "end": 24059683}, {"filename": "/toontalk/pics/htsit3.bmp", "start": 24059683, "end": 24088481}, {"filename": "/toontalk/pics/htsit4.bmp", "start": 24088481, "end": 24113339}, {"filename": "/toontalk/pics/htsit5.bmp", "start": 24113339, "end": 24142705}, {"filename": "/toontalk/pics/htsit6.bmp", "start": 24142705, "end": 24164895}, {"filename": "/toontalk/pics/htsit7.bmp", "start": 24164895, "end": 24183821}, {"filename": "/toontalk/pics/hurt.bmp", "start": 24183821, "end": 24492099}, {"filename": "/toontalk/pics/injral01.bmp", "start": 24492099, "end": 24517109}, {"filename": "/toontalk/pics/injral02.bmp", "start": 24517109, "end": 24542119}, {"filename": "/toontalk/pics/injral03.bmp", "start": 24542119, "end": 24567129}, {"filename": "/toontalk/pics/injral04.bmp", "start": 24567129, "end": 24592263}, {"filename": "/toontalk/pics/injral05.bmp", "start": 24592263, "end": 24617149}, {"filename": "/toontalk/pics/injral06.bmp", "start": 24617149, "end": 24642035}, {"filename": "/toontalk/pics/injral07.bmp", "start": 24642035, "end": 24667045}, {"filename": "/toontalk/pics/injral08.bmp", "start": 24667045, "end": 24692055}, {"filename": "/toontalk/pics/injral09.bmp", "start": 24692055, "end": 24717065}, {"filename": "/toontalk/pics/injral10.bmp", "start": 24717065, "end": 24742075}, {"filename": "/toontalk/pics/injral11.bmp", "start": 24742075, "end": 24767085}, {"filename": "/toontalk/pics/injral12.bmp", "start": 24767085, "end": 24792095}, {"filename": "/toontalk/pics/injral13.bmp", "start": 24792095, "end": 24816981}, {"filename": "/toontalk/pics/injral14.bmp", "start": 24816981, "end": 24842635}, {"filename": "/toontalk/pics/injral15.bmp", "start": 24842635, "end": 24868417}, {"filename": "/toontalk/pics/injral16.bmp", "start": 24868417, "end": 24896999}, {"filename": "/toontalk/pics/injral17.bmp", "start": 24896999, "end": 24924189}, {"filename": "/toontalk/pics/injral18.bmp", "start": 24924189, "end": 24952007}, {"filename": "/toontalk/pics/injral19.bmp", "start": 24952007, "end": 24979685}, {"filename": "/toontalk/pics/injral20.bmp", "start": 24979685, "end": 25008555}, {"filename": "/toontalk/pics/injral21.bmp", "start": 25008555, "end": 25036993}, {"filename": "/toontalk/pics/injral22.bmp", "start": 25036993, "end": 25063911}, {"filename": "/toontalk/pics/injral23.bmp", "start": 25063911, "end": 25090965}, {"filename": "/toontalk/pics/injral24.bmp", "start": 25090965, "end": 25115851}, {"filename": "/toontalk/pics/inrocket.bmp", "start": 25115851, "end": 25424129}, {"filename": "/toontalk/pics/lay01.bmp", "start": 25424129, "end": 25449511}, {"filename": "/toontalk/pics/lay02.bmp", "start": 25449511, "end": 25474501}, {"filename": "/toontalk/pics/lay03.bmp", "start": 25474501, "end": 25499247}, {"filename": "/toontalk/pics/lay04.bmp", "start": 25499247, "end": 25523365}, {"filename": "/toontalk/pics/lay05.bmp", "start": 25523365, "end": 25547483}, {"filename": "/toontalk/pics/lay06.bmp", "start": 25547483, "end": 25570981}, {"filename": "/toontalk/pics/lay07.bmp", "start": 25570981, "end": 25594243}, {"filename": "/toontalk/pics/lay08.bmp", "start": 25594243, "end": 25617129}, {"filename": "/toontalk/pics/lay09.bmp", "start": 25617129, "end": 25640015}, {"filename": "/toontalk/pics/lay10.bmp", "start": 25640015, "end": 25663513}, {"filename": "/toontalk/pics/le1f.bmp", "start": 25663513, "end": 25690943}, {"filename": "/toontalk/pics/le2f.bmp", "start": 25690943, "end": 25715637}, {"filename": "/toontalk/pics/le3f.bmp", "start": 25715637, "end": 25731415}, {"filename": "/toontalk/pics/le4f.bmp", "start": 25731415, "end": 25753409}, {"filename": "/toontalk/pics/le5f.bmp", "start": 25753409, "end": 25781367}, {"filename": "/toontalk/pics/le6f.bmp", "start": 25781367, "end": 25802125}, {"filename": "/toontalk/pics/le7f.bmp", "start": 25802125, "end": 25819999}, {"filename": "/toontalk/pics/le8f.bmp", "start": 25819999, "end": 25846557}, {"filename": "/toontalk/pics/legowand.bmp", "start": 25846557, "end": 25871059}, {"filename": "/toontalk/pics/lftcrnr.bmp", "start": 25871059, "end": 26053257}, {"filename": "/toontalk/pics/lhate02.bmp", "start": 26053257, "end": 26077663}, {"filename": "/toontalk/pics/lhate03.bmp", "start": 26077663, "end": 26098101}, {"filename": "/toontalk/pics/lhatw02.bmp", "start": 26098101, "end": 26122507}, {"filename": "/toontalk/pics/lhatw03.bmp", "start": 26122507, "end": 26142945}, {"filename": "/toontalk/pics/ln1f.bmp", "start": 26142945, "end": 26171575}, {"filename": "/toontalk/pics/ln2f.bmp", "start": 26171575, "end": 26201073}, {"filename": "/toontalk/pics/ln3f.bmp", "start": 26201073, "end": 26229479}, {"filename": "/toontalk/pics/ln4f.bmp", "start": 26229479, "end": 26258745}, {"filename": "/toontalk/pics/ln5f.bmp", "start": 26258745, "end": 26289463}, {"filename": "/toontalk/pics/ln6f.bmp", "start": 26289463, "end": 26318961}, {"filename": "/toontalk/pics/ln7f.bmp", "start": 26318961, "end": 26346695}, {"filename": "/toontalk/pics/ln8f.bmp", "start": 26346695, "end": 26376193}, {"filename": "/toontalk/pics/lne0f.bmp", "start": 26376193, "end": 26406671}, {"filename": "/toontalk/pics/lne1f.bmp", "start": 26406671, "end": 26431173}, {"filename": "/toontalk/pics/lne2f.bmp", "start": 26431173, "end": 26452495}, {"filename": "/toontalk/pics/lne3f.bmp", "start": 26452495, "end": 26474605}, {"filename": "/toontalk/pics/lne4f.bmp", "start": 26474605, "end": 26500331}, {"filename": "/toontalk/pics/lne5f.bmp", "start": 26500331, "end": 26522705}, {"filename": "/toontalk/pics/lne6f.bmp", "start": 26522705, "end": 26544727}, {"filename": "/toontalk/pics/lne7f.bmp", "start": 26544727, "end": 26574845}, {"filename": "/toontalk/pics/lnw0f.bmp", "start": 26574845, "end": 26605323}, {"filename": "/toontalk/pics/lnw1f.bmp", "start": 26605323, "end": 26629825}, {"filename": "/toontalk/pics/lnw2f.bmp", "start": 26629825, "end": 26651147}, {"filename": "/toontalk/pics/lnw3f.bmp", "start": 26651147, "end": 26673257}, {"filename": "/toontalk/pics/lnw4f.bmp", "start": 26673257, "end": 26698983}, {"filename": "/toontalk/pics/lnw5f.bmp", "start": 26698983, "end": 26721357}, {"filename": "/toontalk/pics/lnw6f.bmp", "start": 26721357, "end": 26747499}, {"filename": "/toontalk/pics/lnw7f.bmp", "start": 26747499, "end": 26777617}, {"filename": "/toontalk/pics/ls1f.bmp", "start": 26777617, "end": 26807855}, {"filename": "/toontalk/pics/ls2f.bmp", "start": 26807855, "end": 26838213}, {"filename": "/toontalk/pics/ls3f.bmp", "start": 26838213, "end": 26867595}, {"filename": "/toontalk/pics/ls4f.bmp", "start": 26867595, "end": 26898073}, {"filename": "/toontalk/pics/ls5f.bmp", "start": 26898073, "end": 26926591}, {"filename": "/toontalk/pics/ls6f.bmp", "start": 26926591, "end": 26954997}, {"filename": "/toontalk/pics/ls7f.bmp", "start": 26954997, "end": 26984495}, {"filename": "/toontalk/pics/ls8f.bmp", "start": 26984495, "end": 27016201}, {"filename": "/toontalk/pics/lse1f.bmp", "start": 27016201, "end": 27046199}, {"filename": "/toontalk/pics/lse2f.bmp", "start": 27046199, "end": 27073629}, {"filename": "/toontalk/pics/lse3f.bmp", "start": 27073629, "end": 27100187}, {"filename": "/toontalk/pics/lse4f.bmp", "start": 27100187, "end": 27132017}, {"filename": "/toontalk/pics/lse5f.bmp", "start": 27132017, "end": 27167395}, {"filename": "/toontalk/pics/lse6f.bmp", "start": 27167395, "end": 27198853}, {"filename": "/toontalk/pics/lse7f.bmp", "start": 27198853, "end": 27221403}, {"filename": "/toontalk/pics/lse8f.bmp", "start": 27221403, "end": 27249361}, {"filename": "/toontalk/pics/lsw1f.bmp", "start": 27249361, "end": 27280447}, {"filename": "/toontalk/pics/lsw2f.bmp", "start": 27280447, "end": 27307877}, {"filename": "/toontalk/pics/lsw3f.bmp", "start": 27307877, "end": 27335415}, {"filename": "/toontalk/pics/lsw4f.bmp", "start": 27335415, "end": 27368237}, {"filename": "/toontalk/pics/lsw5f.bmp", "start": 27368237, "end": 27403615}, {"filename": "/toontalk/pics/lsw6f.bmp", "start": 27403615, "end": 27435073}, {"filename": "/toontalk/pics/lsw7f.bmp", "start": 27435073, "end": 27458599}, {"filename": "/toontalk/pics/lsw8f.bmp", "start": 27458599, "end": 27486669}, {"filename": "/toontalk/pics/lw1f.bmp", "start": 27486669, "end": 27514099}, {"filename": "/toontalk/pics/lw2f.bmp", "start": 27514099, "end": 27538793}, {"filename": "/toontalk/pics/lw3f.bmp", "start": 27538793, "end": 27554571}, {"filename": "/toontalk/pics/lw4f.bmp", "start": 27554571, "end": 27576565}, {"filename": "/toontalk/pics/lw5f.bmp", "start": 27576565, "end": 27604635}, {"filename": "/toontalk/pics/lw6f.bmp", "start": 27604635, "end": 27625473}, {"filename": "/toontalk/pics/lw7f.bmp", "start": 27625473, "end": 27643347}, {"filename": "/toontalk/pics/lw8f.bmp", "start": 27643347, "end": 27669905}, {"filename": "/toontalk/pics/mhpwt01.bmp", "start": 27669905, "end": 27707175}, {"filename": "/toontalk/pics/mhpwt02.bmp", "start": 27707175, "end": 27746317}, {"filename": "/toontalk/pics/mhpwt03.bmp", "start": 27746317, "end": 27783587}, {"filename": "/toontalk/pics/mhpwt04.bmp", "start": 27783587, "end": 27820857}, {"filename": "/toontalk/pics/mhpwt05.bmp", "start": 27820857, "end": 27858127}, {"filename": "/toontalk/pics/mhpwt06.bmp", "start": 27858127, "end": 27895397}, {"filename": "/toontalk/pics/miss1.bmp", "start": 27895397, "end": 27932271}, {"filename": "/toontalk/pics/miss2.bmp", "start": 27932271, "end": 27969145}, {"filename": "/toontalk/pics/miss3.bmp", "start": 27969145, "end": 28006019}, {"filename": "/toontalk/pics/mknest01.bmp", "start": 28006019, "end": 28036509}, {"filename": "/toontalk/pics/mknest02.bmp", "start": 28036509, "end": 28055567}, {"filename": "/toontalk/pics/mknest03.bmp", "start": 28055567, "end": 28079765}, {"filename": "/toontalk/pics/mknest04.bmp", "start": 28079765, "end": 28117659}, {"filename": "/toontalk/pics/mknest05.bmp", "start": 28117659, "end": 28150597}, {"filename": "/toontalk/pics/mknest06.bmp", "start": 28150597, "end": 28187067}, {"filename": "/toontalk/pics/mknest07.bmp", "start": 28187067, "end": 28220745}, {"filename": "/toontalk/pics/mknest08.bmp", "start": 28220745, "end": 28254391}, {"filename": "/toontalk/pics/mknest09.bmp", "start": 28254391, "end": 28280409}, {"filename": "/toontalk/pics/mknest10.bmp", "start": 28280409, "end": 28309455}, {"filename": "/toontalk/pics/mknest11.bmp", "start": 28309455, "end": 28328513}, {"filename": "/toontalk/pics/mknest12.bmp", "start": 28328513, "end": 28348315}, {"filename": "/toontalk/pics/mknest13.bmp", "start": 28348315, "end": 28369673}, {"filename": "/toontalk/pics/mknest14.bmp", "start": 28369673, "end": 28402431}, {"filename": "/toontalk/pics/mknest15.bmp", "start": 28402431, "end": 28439573}, {"filename": "/toontalk/pics/mknest16.bmp", "start": 28439573, "end": 28484067}, {"filename": "/toontalk/pics/mknest17.bmp", "start": 28484067, "end": 28543609}, {"filename": "/toontalk/pics/mknest18.bmp", "start": 28543609, "end": 28607407}, {"filename": "/toontalk/pics/mknest19.bmp", "start": 28607407, "end": 28678781}, {"filename": "/toontalk/pics/mknest20.bmp", "start": 28678781, "end": 28758119}, {"filename": "/toontalk/pics/mknest21.bmp", "start": 28758119, "end": 28828101}, {"filename": "/toontalk/pics/mknest22.bmp", "start": 28828101, "end": 28896667}, {"filename": "/toontalk/pics/mknest23.bmp", "start": 28896667, "end": 28964497}, {"filename": "/toontalk/pics/mknest24.bmp", "start": 28964497, "end": 29033063}, {"filename": "/toontalk/pics/mknest25.bmp", "start": 29033063, "end": 29062845}, {"filename": "/toontalk/pics/morp01.bmp", "start": 29062845, "end": 29085003}, {"filename": "/toontalk/pics/morp02.bmp", "start": 29085003, "end": 29106913}, {"filename": "/toontalk/pics/morp03.bmp", "start": 29106913, "end": 29127911}, {"filename": "/toontalk/pics/morp04.bmp", "start": 29127911, "end": 29148909}, {"filename": "/toontalk/pics/morp05.bmp", "start": 29148909, "end": 29169011}, {"filename": "/toontalk/pics/morp06.bmp", "start": 29169011, "end": 29188997}, {"filename": "/toontalk/pics/morp07.bmp", "start": 29188997, "end": 29208219}, {"filename": "/toontalk/pics/morp08.bmp", "start": 29208219, "end": 29226469}, {"filename": "/toontalk/pics/morp09.bmp", "start": 29226469, "end": 29244503}, {"filename": "/toontalk/pics/morp10.bmp", "start": 29244503, "end": 29262429}, {"filename": "/toontalk/pics/morp11.bmp", "start": 29262429, "end": 29280139}, {"filename": "/toontalk/pics/morp12.bmp", "start": 29280139, "end": 29297025}, {"filename": "/toontalk/pics/morp13.bmp", "start": 29297025, "end": 29313911}, {"filename": "/toontalk/pics/mouse01.bmp", "start": 29313911, "end": 29345565}, {"filename": "/toontalk/pics/mouse02.bmp", "start": 29345565, "end": 29376595}, {"filename": "/toontalk/pics/mouse03.bmp", "start": 29376595, "end": 29408177}, {"filename": "/toontalk/pics/mouse04.bmp", "start": 29408177, "end": 29442875}, {"filename": "/toontalk/pics/mouse05.bmp", "start": 29442875, "end": 29470985}, {"filename": "/toontalk/pics/mouse06.bmp", "start": 29470985, "end": 29499443}, {"filename": "/toontalk/pics/mouse07.bmp", "start": 29499443, "end": 29522277}, {"filename": "/toontalk/pics/mouse08.bmp", "start": 29522277, "end": 29552411}, {"filename": "/toontalk/pics/mouse09.bmp", "start": 29552411, "end": 29593013}, {"filename": "/toontalk/pics/mouse10.bmp", "start": 29593013, "end": 29608923}, {"filename": "/toontalk/pics/mouse11.bmp", "start": 29608923, "end": 29626129}, {"filename": "/toontalk/pics/mouse12.bmp", "start": 29626129, "end": 29642467}, {"filename": "/toontalk/pics/mouse13.bmp", "start": 29642467, "end": 29658049}, {"filename": "/toontalk/pics/mouse14.bmp", "start": 29658049, "end": 29683175}, {"filename": "/toontalk/pics/mouse15.bmp", "start": 29683175, "end": 29706653}, {"filename": "/toontalk/pics/mouse16.bmp", "start": 29706653, "end": 29731787}, {"filename": "/toontalk/pics/mouse17.bmp", "start": 29731787, "end": 29755433}, {"filename": "/toontalk/pics/mouse18.bmp", "start": 29755433, "end": 29779611}, {"filename": "/toontalk/pics/mouse19.bmp", "start": 29779611, "end": 29806309}, {"filename": "/toontalk/pics/mouse20.bmp", "start": 29806309, "end": 29834451}, {"filename": "/toontalk/pics/mouse21.bmp", "start": 29834451, "end": 29860689}, {"filename": "/toontalk/pics/mouse22.bmp", "start": 29860689, "end": 29888263}, {"filename": "/toontalk/pics/nbfly01.bmp", "start": 29888263, "end": 29933581}, {"filename": "/toontalk/pics/nbfly02.bmp", "start": 29933581, "end": 29978899}, {"filename": "/toontalk/pics/nbfly03.bmp", "start": 29978899, "end": 30024965}, {"filename": "/toontalk/pics/nbfly04.bmp", "start": 30024965, "end": 30071739}, {"filename": "/toontalk/pics/nbfly05.bmp", "start": 30071739, "end": 30118633}, {"filename": "/toontalk/pics/nbfly06.bmp", "start": 30118633, "end": 30164147}, {"filename": "/toontalk/pics/nbfly07.bmp", "start": 30164147, "end": 30209465}, {"filename": "/toontalk/pics/nbfly08.bmp", "start": 30209465, "end": 30254427}, {"filename": "/toontalk/pics/nbpage1.bmp", "start": 30254427, "end": 30316825}, {"filename": "/toontalk/pics/nbpage2.bmp", "start": 30316825, "end": 30320147}, {"filename": "/toontalk/pics/nbpage3.bmp", "start": 30320147, "end": 30327685}, {"filename": "/toontalk/pics/nbpage4.bmp", "start": 30327685, "end": 30371799}, {"filename": "/toontalk/pics/nbpage5.bmp", "start": 30371799, "end": 30435365}, {"filename": "/toontalk/pics/nbpage6.bmp", "start": 30435365, "end": 30498931}, {"filename": "/toontalk/pics/nbtrans.bmp", "start": 30498931, "end": 30543617}, {"filename": "/toontalk/pics/ninjal01.bmp", "start": 30543617, "end": 30568627}, {"filename": "/toontalk/pics/ninjal02.bmp", "start": 30568627, "end": 30593637}, {"filename": "/toontalk/pics/ninjal03.bmp", "start": 30593637, "end": 30618647}, {"filename": "/toontalk/pics/ninjal04.bmp", "start": 30618647, "end": 30643657}, {"filename": "/toontalk/pics/ninjal05.bmp", "start": 30643657, "end": 30668667}, {"filename": "/toontalk/pics/ninjal06.bmp", "start": 30668667, "end": 30693677}, {"filename": "/toontalk/pics/ninjal07.bmp", "start": 30693677, "end": 30718687}, {"filename": "/toontalk/pics/ninjal08.bmp", "start": 30718687, "end": 30743697}, {"filename": "/toontalk/pics/ninjal09.bmp", "start": 30743697, "end": 30768707}, {"filename": "/toontalk/pics/ninjal10.bmp", "start": 30768707, "end": 30793717}, {"filename": "/toontalk/pics/ninjal11.bmp", "start": 30793717, "end": 30818727}, {"filename": "/toontalk/pics/notepad.bmp", "start": 30818727, "end": 30853549}, {"filename": "/toontalk/pics/ntrksid1.bmp", "start": 30853549, "end": 30869143}, {"filename": "/toontalk/pics/ntrktop1.bmp", "start": 30869143, "end": 30884737}, {"filename": "/toontalk/pics/numbhorz.bmp", "start": 30884737, "end": 30889463}, {"filename": "/toontalk/pics/numbhrz1.bmp", "start": 30889463, "end": 30894189}, {"filename": "/toontalk/pics/numbhrz2.bmp", "start": 30894189, "end": 30898915}, {"filename": "/toontalk/pics/numbhrz3.bmp", "start": 30898915, "end": 30903641}, {"filename": "/toontalk/pics/numbnop.bmp", "start": 30903641, "end": 30934815}, {"filename": "/toontalk/pics/numbplat.bmp", "start": 30934815, "end": 30965989}, {"filename": "/toontalk/pics/numbplt1.bmp", "start": 30965989, "end": 30997163}, {"filename": "/toontalk/pics/numbplt2.bmp", "start": 30997163, "end": 31028337}, {"filename": "/toontalk/pics/numbplt3.bmp", "start": 31028337, "end": 31059511}, {"filename": "/toontalk/pics/numbvert.bmp", "start": 31059511, "end": 31064733}, {"filename": "/toontalk/pics/numbvrt1.bmp", "start": 31064733, "end": 31069955}, {"filename": "/toontalk/pics/numbvrt2.bmp", "start": 31069955, "end": 31075177}, {"filename": "/toontalk/pics/numbvrt3.bmp", "start": 31075177, "end": 31080399}, {"filename": "/toontalk/pics/opening.bmp", "start": 31080399, "end": 31388677}, {"filename": "/toontalk/pics/ophorz.bmp", "start": 31388677, "end": 31393403}, {"filename": "/toontalk/pics/opnop.bmp", "start": 31393403, "end": 31424577}, {"filename": "/toontalk/pics/opvert.bmp", "start": 31424577, "end": 31429799}, {"filename": "/toontalk/pics/paddle.bmp", "start": 31429799, "end": 31441181}, {"filename": "/toontalk/pics/pmrph00.bmp", "start": 31441181, "end": 31458259}, {"filename": "/toontalk/pics/pmrph01.bmp", "start": 31458259, "end": 31475537}, {"filename": "/toontalk/pics/pmrph02.bmp", "start": 31475537, "end": 31492815}, {"filename": "/toontalk/pics/pmrph03.bmp", "start": 31492815, "end": 31510093}, {"filename": "/toontalk/pics/pmrph04.bmp", "start": 31510093, "end": 31527471}, {"filename": "/toontalk/pics/pmrph05.bmp", "start": 31527471, "end": 31545813}, {"filename": "/toontalk/pics/pmrph06.bmp", "start": 31545813, "end": 31564259}, {"filename": "/toontalk/pics/pmrph07.bmp", "start": 31564259, "end": 31582913}, {"filename": "/toontalk/pics/pmrph08.bmp", "start": 31582913, "end": 31601567}, {"filename": "/toontalk/pics/pmrph09.bmp", "start": 31601567, "end": 31620325}, {"filename": "/toontalk/pics/pmrph10.bmp", "start": 31620325, "end": 31639979}, {"filename": "/toontalk/pics/pmrph11.bmp", "start": 31639979, "end": 31660545}, {"filename": "/toontalk/pics/pmrph12.bmp", "start": 31660545, "end": 31681111}, {"filename": "/toontalk/pics/presuck.bmp", "start": 31681111, "end": 31728617}, {"filename": "/toontalk/pics/pump00.bmp", "start": 31728617, "end": 31765887}, {"filename": "/toontalk/pics/pump01.bmp", "start": 31765887, "end": 31812517}, {"filename": "/toontalk/pics/pump02.bmp", "start": 31812517, "end": 31865819}, {"filename": "/toontalk/pics/pump03.bmp", "start": 31865819, "end": 31907901}, {"filename": "/toontalk/pics/pump04.bmp", "start": 31907901, "end": 31937979}, {"filename": "/toontalk/pics/pump05.bmp", "start": 31937979, "end": 31964149}, {"filename": "/toontalk/pics/pump06.bmp", "start": 31964149, "end": 31990811}, {"filename": "/toontalk/pics/pump07.bmp", "start": 31990811, "end": 32019761}, {"filename": "/toontalk/pics/pump08.bmp", "start": 32019761, "end": 32061399}, {"filename": "/toontalk/pics/pump09.bmp", "start": 32061399, "end": 32103453}, {"filename": "/toontalk/pics/pump10.bmp", "start": 32103453, "end": 32139267}, {"filename": "/toontalk/pics/pumpbtn.bmp", "start": 32139267, "end": 32141337}, {"filename": "/toontalk/pics/put1.bmp", "start": 32141337, "end": 32162827}, {"filename": "/toontalk/pics/put2.bmp", "start": 32162827, "end": 32185829}, {"filename": "/toontalk/pics/put3.bmp", "start": 32185829, "end": 32208831}, {"filename": "/toontalk/pics/put4.bmp", "start": 32208831, "end": 32235613}, {"filename": "/toontalk/pics/puthair1.bmp", "start": 32235613, "end": 32258291}, {"filename": "/toontalk/pics/puthair2.bmp", "start": 32258291, "end": 32282569}, {"filename": "/toontalk/pics/puthair3.bmp", "start": 32282569, "end": 32307311}, {"filename": "/toontalk/pics/puthair4.bmp", "start": 32307311, "end": 32336133}, {"filename": "/toontalk/pics/puthat1.bmp", "start": 32336133, "end": 32359027}, {"filename": "/toontalk/pics/puthat2.bmp", "start": 32359027, "end": 32383537}, {"filename": "/toontalk/pics/puthat3.bmp", "start": 32383537, "end": 32408743}, {"filename": "/toontalk/pics/puthat4.bmp", "start": 32408743, "end": 32438109}, {"filename": "/toontalk/pics/rb00.bmp", "start": 32438109, "end": 32455887}, {"filename": "/toontalk/pics/rb01.bmp", "start": 32455887, "end": 32474165}, {"filename": "/toontalk/pics/rb02.bmp", "start": 32474165, "end": 32492343}, {"filename": "/toontalk/pics/rb03.bmp", "start": 32492343, "end": 32511421}, {"filename": "/toontalk/pics/rb04.bmp", "start": 32511421, "end": 32531531}, {"filename": "/toontalk/pics/rb05.bmp", "start": 32531531, "end": 32552481}, {"filename": "/toontalk/pics/rb06.bmp", "start": 32552481, "end": 32574619}, {"filename": "/toontalk/pics/rb07.bmp", "start": 32574619, "end": 32597985}, {"filename": "/toontalk/pics/rb08.bmp", "start": 32597985, "end": 32620903}, {"filename": "/toontalk/pics/rb09.bmp", "start": 32620903, "end": 32643325}, {"filename": "/toontalk/pics/rb10.bmp", "start": 32643325, "end": 32664935}, {"filename": "/toontalk/pics/rb11.bmp", "start": 32664935, "end": 32688453}, {"filename": "/toontalk/pics/rb12.bmp", "start": 32688453, "end": 32712691}, {"filename": "/toontalk/pics/rb13.bmp", "start": 32712691, "end": 32737065}, {"filename": "/toontalk/pics/rb14.bmp", "start": 32737065, "end": 32763487}, {"filename": "/toontalk/pics/rb15.bmp", "start": 32763487, "end": 32789513}, {"filename": "/toontalk/pics/rb16.bmp", "start": 32789513, "end": 32816567}, {"filename": "/toontalk/pics/rb17.bmp", "start": 32816567, "end": 32844573}, {"filename": "/toontalk/pics/rb18.bmp", "start": 32844573, "end": 32872715}, {"filename": "/toontalk/pics/rb19.bmp", "start": 32872715, "end": 32902073}, {"filename": "/toontalk/pics/rb20.bmp", "start": 32902073, "end": 32931991}, {"filename": "/toontalk/pics/rb21.bmp", "start": 32931991, "end": 32962049}, {"filename": "/toontalk/pics/rb22.bmp", "start": 32962049, "end": 32993467}, {"filename": "/toontalk/pics/rb23.bmp", "start": 32993467, "end": 33037601}, {"filename": "/toontalk/pics/rb24.bmp", "start": 33037601, "end": 33079079}, {"filename": "/toontalk/pics/rb25.bmp", "start": 33079079, "end": 33121773}, {"filename": "/toontalk/pics/rb26.bmp", "start": 33121773, "end": 33153487}, {"filename": "/toontalk/pics/rb27.bmp", "start": 33153487, "end": 33183261}, {"filename": "/toontalk/pics/rb28.bmp", "start": 33183261, "end": 33213319}, {"filename": "/toontalk/pics/rb29.bmp", "start": 33213319, "end": 33246717}, {"filename": "/toontalk/pics/rb30.bmp", "start": 33246717, "end": 33280275}, {"filename": "/toontalk/pics/rb31.bmp", "start": 33280275, "end": 33315793}, {"filename": "/toontalk/pics/rb32.bmp", "start": 33315793, "end": 33352151}, {"filename": "/toontalk/pics/rb33.bmp", "start": 33352151, "end": 33385365}, {"filename": "/toontalk/pics/rb34.bmp", "start": 33385365, "end": 33415387}, {"filename": "/toontalk/pics/rb35.bmp", "start": 33415387, "end": 33454865}, {"filename": "/toontalk/pics/rb36.bmp", "start": 33454865, "end": 33485895}, {"filename": "/toontalk/pics/rb37.bmp", "start": 33485895, "end": 33517073}, {"filename": "/toontalk/pics/rb38.bmp", "start": 33517073, "end": 33548251}, {"filename": "/toontalk/pics/rb39.bmp", "start": 33548251, "end": 33580001}, {"filename": "/toontalk/pics/rb40.bmp", "start": 33580001, "end": 33614307}, {"filename": "/toontalk/pics/rb41.bmp", "start": 33614307, "end": 33647457}, {"filename": "/toontalk/pics/rb42.bmp", "start": 33647457, "end": 33689335}, {"filename": "/toontalk/pics/rb43.bmp", "start": 33689335, "end": 33732029}, {"filename": "/toontalk/pics/rb44.bmp", "start": 33732029, "end": 33773811}, {"filename": "/toontalk/pics/rb45.bmp", "start": 33773811, "end": 33815089}, {"filename": "/toontalk/pics/rbwait00.bmp", "start": 33815089, "end": 33844679}, {"filename": "/toontalk/pics/rbwait01.bmp", "start": 33844679, "end": 33874701}, {"filename": "/toontalk/pics/rbwait02.bmp", "start": 33874701, "end": 33904723}, {"filename": "/toontalk/pics/rbwait03.bmp", "start": 33904723, "end": 33933737}, {"filename": "/toontalk/pics/rbwait04.bmp", "start": 33933737, "end": 33963327}, {"filename": "/toontalk/pics/rbwait05.bmp", "start": 33963327, "end": 33993349}, {"filename": "/toontalk/pics/rbwait06.bmp", "start": 33993349, "end": 34025783}, {"filename": "/toontalk/pics/rbwait07.bmp", "start": 34025783, "end": 34057125}, {"filename": "/toontalk/pics/rbwait08.bmp", "start": 34057125, "end": 34086715}, {"filename": "/toontalk/pics/rbwait09.bmp", "start": 34086715, "end": 34116737}, {"filename": "/toontalk/pics/rbwait10.bmp", "start": 34116737, "end": 34146759}, {"filename": "/toontalk/pics/rbwait11.bmp", "start": 34146759, "end": 34175773}, {"filename": "/toontalk/pics/rescue.bmp", "start": 34175773, "end": 34484051}, {"filename": "/toontalk/pics/rockbrok.bmp", "start": 34484051, "end": 34602401}, {"filename": "/toontalk/pics/rockdr2.bmp", "start": 34602401, "end": 34613079}, {"filename": "/toontalk/pics/rockdr3.bmp", "start": 34613079, "end": 34623757}, {"filename": "/toontalk/pics/rooma.bmp", "start": 34623757, "end": 34932035}, {"filename": "/toontalk/pics/roomb.bmp", "start": 34932035, "end": 35240313}, {"filename": "/toontalk/pics/roomc.bmp", "start": 35240313, "end": 35548591}, {"filename": "/toontalk/pics/roomdoor.bmp", "start": 35548591, "end": 35570117}, {"filename": "/toontalk/pics/rtcrnr.bmp", "start": 35570117, "end": 35752315}, {"filename": "/toontalk/pics/scale01.bmp", "start": 35752315, "end": 35764677}, {"filename": "/toontalk/pics/scale02.bmp", "start": 35764677, "end": 35776675}, {"filename": "/toontalk/pics/scale03.bmp", "start": 35776675, "end": 35788673}, {"filename": "/toontalk/pics/scale04.bmp", "start": 35788673, "end": 35800671}, {"filename": "/toontalk/pics/scale05.bmp", "start": 35800671, "end": 35812669}, {"filename": "/toontalk/pics/sinking.bmp", "start": 35812669, "end": 36120947}, {"filename": "/toontalk/pics/sit1.bmp", "start": 36120947, "end": 36149553}, {"filename": "/toontalk/pics/sit2.bmp", "start": 36149553, "end": 36177511}, {"filename": "/toontalk/pics/sit3.bmp", "start": 36177511, "end": 36203909}, {"filename": "/toontalk/pics/sit4.bmp", "start": 36203909, "end": 36226911}, {"filename": "/toontalk/pics/sit5.bmp", "start": 36226911, "end": 36254449}, {"filename": "/toontalk/pics/sit6.bmp", "start": 36254449, "end": 36275183}, {"filename": "/toontalk/pics/sit7.bmp", "start": 36275183, "end": 36293097}, {"filename": "/toontalk/pics/sndhorz.bmp", "start": 36293097, "end": 36297823}, {"filename": "/toontalk/pics/sndnop.bmp", "start": 36297823, "end": 36328997}, {"filename": "/toontalk/pics/sndplat.bmp", "start": 36328997, "end": 36360171}, {"filename": "/toontalk/pics/sndvert.bmp", "start": 36360171, "end": 36365393}, {"filename": "/toontalk/pics/stbe01.bmp", "start": 36365393, "end": 36378303}, {"filename": "/toontalk/pics/stbe02.bmp", "start": 36378303, "end": 36391261}, {"filename": "/toontalk/pics/stbe03.bmp", "start": 36391261, "end": 36402427}, {"filename": "/toontalk/pics/stbe04.bmp", "start": 36402427, "end": 36415453}, {"filename": "/toontalk/pics/stbn01.bmp", "start": 36415453, "end": 36425571}, {"filename": "/toontalk/pics/stbn02.bmp", "start": 36425571, "end": 36435369}, {"filename": "/toontalk/pics/stbn03.bmp", "start": 36435369, "end": 36445007}, {"filename": "/toontalk/pics/stbn04.bmp", "start": 36445007, "end": 36454565}, {"filename": "/toontalk/pics/stbne01.bmp", "start": 36454565, "end": 36467739}, {"filename": "/toontalk/pics/stbne02.bmp", "start": 36467739, "end": 36480049}, {"filename": "/toontalk/pics/stbne03.bmp", "start": 36480049, "end": 36492727}, {"filename": "/toontalk/pics/stbne04.bmp", "start": 36492727, "end": 36506101}, {"filename": "/toontalk/pics/stbnw01.bmp", "start": 36506101, "end": 36521771}, {"filename": "/toontalk/pics/stbnw02.bmp", "start": 36521771, "end": 36538293}, {"filename": "/toontalk/pics/stbnw03.bmp", "start": 36538293, "end": 36553291}, {"filename": "/toontalk/pics/stbnw04.bmp", "start": 36553291, "end": 36567473}, {"filename": "/toontalk/pics/stbs01.bmp", "start": 36567473, "end": 36576951}, {"filename": "/toontalk/pics/stbs02.bmp", "start": 36576951, "end": 36586669}, {"filename": "/toontalk/pics/stbs03.bmp", "start": 36586669, "end": 36596387}, {"filename": "/toontalk/pics/stbs04.bmp", "start": 36596387, "end": 36605945}, {"filename": "/toontalk/pics/stbse01.bmp", "start": 36605945, "end": 36621615}, {"filename": "/toontalk/pics/stbse02.bmp", "start": 36621615, "end": 36637789}, {"filename": "/toontalk/pics/stbse03.bmp", "start": 36637789, "end": 36651075}, {"filename": "/toontalk/pics/stbse04.bmp", "start": 36651075, "end": 36665033}, {"filename": "/toontalk/pics/stbsw01.bmp", "start": 36665033, "end": 36679311}, {"filename": "/toontalk/pics/stbsw02.bmp", "start": 36679311, "end": 36693729}, {"filename": "/toontalk/pics/stbsw03.bmp", "start": 36693729, "end": 36709315}, {"filename": "/toontalk/pics/stbsw04.bmp", "start": 36709315, "end": 36725369}, {"filename": "/toontalk/pics/stbw01.bmp", "start": 36725369, "end": 36739167}, {"filename": "/toontalk/pics/stbw02.bmp", "start": 36739167, "end": 36756205}, {"filename": "/toontalk/pics/stbw03.bmp", "start": 36756205, "end": 36770723}, {"filename": "/toontalk/pics/stbw04.bmp", "start": 36770723, "end": 36786393}, {"filename": "/toontalk/pics/strksid1.bmp", "start": 36786393, "end": 36801987}, {"filename": "/toontalk/pics/strktop1.bmp", "start": 36801987, "end": 36817581}, {"filename": "/toontalk/pics/suck0.bmp", "start": 36817581, "end": 36843211}, {"filename": "/toontalk/pics/suck1.bmp", "start": 36843211, "end": 36868985}, {"filename": "/toontalk/pics/suck2.bmp", "start": 36868985, "end": 36895151}, {"filename": "/toontalk/pics/suck3.bmp", "start": 36895151, "end": 36922853}, {"filename": "/toontalk/pics/suck4.bmp", "start": 36922853, "end": 36951491}, {"filename": "/toontalk/pics/suck5.bmp", "start": 36951491, "end": 36977265}, {"filename": "/toontalk/pics/suck6.bmp", "start": 36977265, "end": 37002895}, {"filename": "/toontalk/pics/suck7.bmp", "start": 37002895, "end": 37028525}, {"filename": "/toontalk/pics/switchon.bmp", "start": 37028525, "end": 37066035}, {"filename": "/toontalk/pics/swtchoff.bmp", "start": 37066035, "end": 37103545}, {"filename": "/toontalk/pics/tbe001.bmp", "start": 37103545, "end": 37235183}, {"filename": "/toontalk/pics/tbe002.bmp", "start": 37235183, "end": 37357109}, {"filename": "/toontalk/pics/tbe003.bmp", "start": 37357109, "end": 37481099}, {"filename": "/toontalk/pics/tbe004.bmp", "start": 37481099, "end": 37623617}, {"filename": "/toontalk/pics/tbe005.bmp", "start": 37623617, "end": 37753495}, {"filename": "/toontalk/pics/tbmrph01.bmp", "start": 37753495, "end": 37941941}, {"filename": "/toontalk/pics/tbmrph02.bmp", "start": 37941941, "end": 38139259}, {"filename": "/toontalk/pics/tbmrph03.bmp", "start": 38139259, "end": 38342737}, {"filename": "/toontalk/pics/tbmrph04.bmp", "start": 38342737, "end": 38527735}, {"filename": "/toontalk/pics/tbmrph05.bmp", "start": 38527735, "end": 38721533}, {"filename": "/toontalk/pics/tbmrph06.bmp", "start": 38721533, "end": 38908347}, {"filename": "/toontalk/pics/tbmrph07.bmp", "start": 38908347, "end": 39096905}, {"filename": "/toontalk/pics/tbmrph08.bmp", "start": 39096905, "end": 39281103}, {"filename": "/toontalk/pics/tbmrph09.bmp", "start": 39281103, "end": 39464429}, {"filename": "/toontalk/pics/tbmrph10.bmp", "start": 39464429, "end": 39645219}, {"filename": "/toontalk/pics/tbmrph11.bmp", "start": 39645219, "end": 39823489}, {"filename": "/toontalk/pics/tbmrph12.bmp", "start": 39823489, "end": 40000823}, {"filename": "/toontalk/pics/tbmrph13.bmp", "start": 40000823, "end": 40177293}, {"filename": "/toontalk/pics/tbmrph14.bmp", "start": 40177293, "end": 40353763}, {"filename": "/toontalk/pics/tbmrph15.bmp", "start": 40353763, "end": 40530113}, {"filename": "/toontalk/pics/tbmrph16.bmp", "start": 40530113, "end": 40706463}, {"filename": "/toontalk/pics/tbn01.bmp", "start": 40706463, "end": 40815781}, {"filename": "/toontalk/pics/tbn02.bmp", "start": 40815781, "end": 40930379}, {"filename": "/toontalk/pics/tbn03.bmp", "start": 40930379, "end": 41032833}, {"filename": "/toontalk/pics/tbn04.bmp", "start": 41032833, "end": 41148487}, {"filename": "/toontalk/pics/tbn05.bmp", "start": 41148487, "end": 41171517}, {"filename": "/toontalk/pics/tbne01.bmp", "start": 41171517, "end": 41320435}, {"filename": "/toontalk/pics/tbne02.bmp", "start": 41320435, "end": 41466505}, {"filename": "/toontalk/pics/tbne03.bmp", "start": 41466505, "end": 41604479}, {"filename": "/toontalk/pics/tbne04.bmp", "start": 41604479, "end": 41766309}, {"filename": "/toontalk/pics/tbne05.bmp", "start": 41766309, "end": 41926363}, {"filename": "/toontalk/pics/tbnw01.bmp", "start": 41926363, "end": 42092177}, {"filename": "/toontalk/pics/tbnw02.bmp", "start": 42092177, "end": 42253431}, {"filename": "/toontalk/pics/tbnw03.bmp", "start": 42253431, "end": 42396493}, {"filename": "/toontalk/pics/tbnw04.bmp", "start": 42396493, "end": 42528291}, {"filename": "/toontalk/pics/tbnw05.bmp", "start": 42528291, "end": 42682025}, {"filename": "/toontalk/pics/tbopen1.bmp", "start": 42682025, "end": 42790839}, {"filename": "/toontalk/pics/tbopen2.bmp", "start": 42790839, "end": 42912685}, {"filename": "/toontalk/pics/tbopen3.bmp", "start": 42912685, "end": 43049899}, {"filename": "/toontalk/pics/tbopen4.bmp", "start": 43049899, "end": 43220601}, {"filename": "/toontalk/pics/tbopen5.bmp", "start": 43220601, "end": 43413487}, {"filename": "/toontalk/pics/tbs001.bmp", "start": 43413487, "end": 43519013}, {"filename": "/toontalk/pics/tbs002.bmp", "start": 43519013, "end": 43617371}, {"filename": "/toontalk/pics/tbs003.bmp", "start": 43617371, "end": 43711633}, {"filename": "/toontalk/pics/tbs004.bmp", "start": 43711633, "end": 43808975}, {"filename": "/toontalk/pics/tbs005.bmp", "start": 43808975, "end": 43906821}, {"filename": "/toontalk/pics/tbse001.bmp", "start": 43906821, "end": 44056003}, {"filename": "/toontalk/pics/tbse002.bmp", "start": 44056003, "end": 44178873}, {"filename": "/toontalk/pics/tbse003.bmp", "start": 44178873, "end": 44290815}, {"filename": "/toontalk/pics/tbse004.bmp", "start": 44290815, "end": 44405293}, {"filename": "/toontalk/pics/tbse005.bmp", "start": 44405293, "end": 44534723}, {"filename": "/toontalk/pics/tbsw001.bmp", "start": 44534723, "end": 44668641}, {"filename": "/toontalk/pics/tbsw002.bmp", "start": 44668641, "end": 44805439}, {"filename": "/toontalk/pics/tbsw003.bmp", "start": 44805439, "end": 44939661}, {"filename": "/toontalk/pics/tbsw004.bmp", "start": 44939661, "end": 45076779}, {"filename": "/toontalk/pics/tbsw005.bmp", "start": 45076779, "end": 45203569}, {"filename": "/toontalk/pics/tbw01.bmp", "start": 45203569, "end": 45341735}, {"filename": "/toontalk/pics/tbw02.bmp", "start": 45341735, "end": 45466653}, {"filename": "/toontalk/pics/tbw03.bmp", "start": 45466653, "end": 45587851}, {"filename": "/toontalk/pics/tbw04.bmp", "start": 45587851, "end": 45704385}, {"filename": "/toontalk/pics/tbw05.bmp", "start": 45704385, "end": 45823543}, {"filename": "/toontalk/pics/texthorz.bmp", "start": 45823543, "end": 45828269}, {"filename": "/toontalk/pics/texthrz1.bmp", "start": 45828269, "end": 45832995}, {"filename": "/toontalk/pics/texthrz2.bmp", "start": 45832995, "end": 45837721}, {"filename": "/toontalk/pics/texthrz3.bmp", "start": 45837721, "end": 45842447}, {"filename": "/toontalk/pics/textnop.bmp", "start": 45842447, "end": 45873621}, {"filename": "/toontalk/pics/textplat.bmp", "start": 45873621, "end": 45904795}, {"filename": "/toontalk/pics/textplt1.bmp", "start": 45904795, "end": 45935969}, {"filename": "/toontalk/pics/textplt2.bmp", "start": 45935969, "end": 45967143}, {"filename": "/toontalk/pics/textplt3.bmp", "start": 45967143, "end": 45998317}, {"filename": "/toontalk/pics/textvert.bmp", "start": 45998317, "end": 46003539}, {"filename": "/toontalk/pics/textvrt1.bmp", "start": 46003539, "end": 46008761}, {"filename": "/toontalk/pics/textvrt2.bmp", "start": 46008761, "end": 46013983}, {"filename": "/toontalk/pics/textvrt3.bmp", "start": 46013983, "end": 46019205}, {"filename": "/toontalk/pics/tlite01.bmp", "start": 46019205, "end": 46039843}, {"filename": "/toontalk/pics/tlite02.bmp", "start": 46039843, "end": 46060481}, {"filename": "/toontalk/pics/tlite03.bmp", "start": 46060481, "end": 46081119}, {"filename": "/toontalk/pics/tlkbal8.bmp", "start": 46081119, "end": 46213165}, {"filename": "/toontalk/pics/tree01.bmp", "start": 46213165, "end": 46315883}, {"filename": "/toontalk/pics/tree02.bmp", "start": 46315883, "end": 46418601}, {"filename": "/toontalk/pics/tree03.bmp", "start": 46418601, "end": 46521319}, {"filename": "/toontalk/pics/tree04.bmp", "start": 46521319, "end": 46624037}, {"filename": "/toontalk/pics/tree05.bmp", "start": 46624037, "end": 46726755}, {"filename": "/toontalk/pics/treenfce.bmp", "start": 46726755, "end": 46829473}, {"filename": "/toontalk/pics/trkinsd1.bmp", "start": 46829473, "end": 46866511}, {"filename": "/toontalk/pics/trkinsd2.bmp", "start": 46866511, "end": 46903549}, {"filename": "/toontalk/pics/trkinsd3.bmp", "start": 46903549, "end": 46940587}, {"filename": "/toontalk/pics/trkinsd4.bmp", "start": 46940587, "end": 46977873}, {"filename": "/toontalk/pics/trkside1.bmp", "start": 46977873, "end": 47023015}, {"filename": "/toontalk/pics/trkside2.bmp", "start": 47023015, "end": 47067293}, {"filename": "/toontalk/pics/trkside3.bmp", "start": 47067293, "end": 47111859}, {"filename": "/toontalk/pics/trkside4.bmp", "start": 47111859, "end": 47157001}, {"filename": "/toontalk/pics/trkside5.bmp", "start": 47157001, "end": 47201567}, {"filename": "/toontalk/pics/trktop1.bmp", "start": 47201567, "end": 47217045}, {"filename": "/toontalk/pics/trktop4.bmp", "start": 47217045, "end": 47236363}, {"filename": "/toontalk/pics/trktop5.bmp", "start": 47236363, "end": 47251841}, {"filename": "/toontalk/pics/usewand1.bmp", "start": 47251841, "end": 47337735}, {"filename": "/toontalk/pics/usewand2.bmp", "start": 47337735, "end": 47422717}, {"filename": "/toontalk/pics/usewand3.bmp", "start": 47422717, "end": 47507975}, {"filename": "/toontalk/pics/usewand4.bmp", "start": 47507975, "end": 47590933}, {"filename": "/toontalk/pics/usewand5.bmp", "start": 47590933, "end": 47672747}, {"filename": "/toontalk/pics/usewand6.bmp", "start": 47672747, "end": 47754321}, {"filename": "/toontalk/pics/usewand7.bmp", "start": 47754321, "end": 47836135}, {"filename": "/toontalk/pics/usewand8.bmp", "start": 47836135, "end": 47921853}, {"filename": "/toontalk/pics/usewand9.bmp", "start": 47921853, "end": 48008203}, {"filename": "/toontalk/pics/vacbtn.bmp", "start": 48008203, "end": 48010249}, {"filename": "/toontalk/pics/wall.bmp", "start": 48010249, "end": 48097175}, {"filename": "/toontalk/pics/wand01.bmp", "start": 48097175, "end": 48128453}, {"filename": "/toontalk/pics/wand02.bmp", "start": 48128453, "end": 48188499}, {"filename": "/toontalk/pics/wand03.bmp", "start": 48188499, "end": 48248545}, {"filename": "/toontalk/pics/wand04.bmp", "start": 48248545, "end": 48305711}, {"filename": "/toontalk/pics/wand05.bmp", "start": 48305711, "end": 48365613}, {"filename": "/toontalk/pics/wand06.bmp", "start": 48365613, "end": 48437923}, {"filename": "/toontalk/pics/wand07.bmp", "start": 48437923, "end": 48524693}, {"filename": "/toontalk/pics/wand08.bmp", "start": 48524693, "end": 48619011}, {"filename": "/toontalk/pics/wand09.bmp", "start": 48619011, "end": 48717769}, {"filename": "/toontalk/pics/wand10.bmp", "start": 48717769, "end": 48804875}, {"filename": "/toontalk/pics/wand11.bmp", "start": 48804875, "end": 48899969}, {"filename": "/toontalk/pics/wand12.bmp", "start": 48899969, "end": 48988855}, {"filename": "/toontalk/pics/wand13.bmp", "start": 48988855, "end": 49077485}, {"filename": "/toontalk/pics/wand14.bmp", "start": 49077485, "end": 49164443}, {"filename": "/toontalk/pics/wandbtn.bmp", "start": 49164443, "end": 49165969}, {"filename": "/toontalk/pics/we1f.bmp", "start": 49165969, "end": 49186999}, {"filename": "/toontalk/pics/we2f.bmp", "start": 49186999, "end": 49207853}, {"filename": "/toontalk/pics/we3f.bmp", "start": 49207853, "end": 49226371}, {"filename": "/toontalk/pics/we4f.bmp", "start": 49226371, "end": 49245161}, {"filename": "/toontalk/pics/we5f.bmp", "start": 49245161, "end": 49264607}, {"filename": "/toontalk/pics/we6f.bmp", "start": 49264607, "end": 49285677}, {"filename": "/toontalk/pics/we7f.bmp", "start": 49285677, "end": 49305907}, {"filename": "/toontalk/pics/we8f.bmp", "start": 49305907, "end": 49325385}, {"filename": "/toontalk/pics/whitepad.bmp", "start": 49325385, "end": 49415679}, {"filename": "/toontalk/pics/wire.bmp", "start": 49415679, "end": 49457557}, {"filename": "/toontalk/pics/wn1f.bmp", "start": 49457557, "end": 49471915}, {"filename": "/toontalk/pics/wn2f.bmp", "start": 49471915, "end": 49484873}, {"filename": "/toontalk/pics/wn3f.bmp", "start": 49484873, "end": 49498263}, {"filename": "/toontalk/pics/wn4f.bmp", "start": 49498263, "end": 49512301}, {"filename": "/toontalk/pics/wn5f.bmp", "start": 49512301, "end": 49526659}, {"filename": "/toontalk/pics/wn6f.bmp", "start": 49526659, "end": 49540777}, {"filename": "/toontalk/pics/wn7f.bmp", "start": 49540777, "end": 49553855}, {"filename": "/toontalk/pics/wn8f.bmp", "start": 49553855, "end": 49567549}, {"filename": "/toontalk/pics/ws1f.bmp", "start": 49567549, "end": 49577987}, {"filename": "/toontalk/pics/ws2f.bmp", "start": 49577987, "end": 49588869}, {"filename": "/toontalk/pics/ws3f.bmp", "start": 49588869, "end": 49599307}, {"filename": "/toontalk/pics/ws4f.bmp", "start": 49599307, "end": 49609961}, {"filename": "/toontalk/pics/ws5f.bmp", "start": 49609961, "end": 49621147}, {"filename": "/toontalk/pics/ws6f.bmp", "start": 49621147, "end": 49631585}, {"filename": "/toontalk/pics/ws7f.bmp", "start": 49631585, "end": 49643583}, {"filename": "/toontalk/pics/ws8f.bmp", "start": 49643583, "end": 49654617}, {"filename": "/toontalk/pics/ww1f.bmp", "start": 49654617, "end": 49675647}, {"filename": "/toontalk/pics/ww2f.bmp", "start": 49675647, "end": 49696309}, {"filename": "/toontalk/pics/ww3f.bmp", "start": 49696309, "end": 49714827}, {"filename": "/toontalk/pics/ww4f.bmp", "start": 49714827, "end": 49733617}, {"filename": "/toontalk/pics/ww5f.bmp", "start": 49733617, "end": 49752899}, {"filename": "/toontalk/pics/ww6f.bmp", "start": 49752899, "end": 49773801}, {"filename": "/toontalk/pics/ww7f.bmp", "start": 49773801, "end": 49794031}, {"filename": "/toontalk/pics/ww8f.bmp", "start": 49794031, "end": 49813509}, {"filename": "/toontalk/resind.us1", "start": 49813509, "end": 50863372}], "remote_package_size": 50863372});

  })();

// end include: C:\Users\toont\dev\tt-wasm\.tmp\tmp0h9mw4lw.js
// include: C:\Users\toont\dev\tt-wasm\.tmp\tmpd628afme.js

    // All the pre-js content up to here must remain later on, we need to run
    // it.
    if ((typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER) || (typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD) || (typeof ENVIRONMENT_IS_AUDIO_WORKLET != 'undefined' && ENVIRONMENT_IS_AUDIO_WORKLET)) Module['preRun'] = [];
    var necessaryPreJSTasks = Module['preRun'].slice();
  // end include: C:\Users\toont\dev\tt-wasm\.tmp\tmpd628afme.js
// include: shim/pre.js
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
Module['postRun'] = Module['postRun'] || [];
Module['postRun'].push(function () {
  if (Module['_em_set_mouse_mode']) {
    Module['_em_set_mouse_mode'](document.pointerLockElement ? 0 : 1);
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
      ['demo', 'puzzle', 'segment', 'launcher', 'floor', 'cb'].forEach(function (k) {
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
    if (editableTarget(e)) return;
    delete globalThis.TT_keys[e.keyCode]; post(0x0101, e.keyCode, 0);
  });
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
    // Retake the pointer lock the chooser released, but only for the choices that go back to
    // playing (1 = Back to Demo / Resume, 5 = Take Control). Leaving the demo wants an ordinary
    // cursor. This runs inside the button's click handler, which is the user gesture the browser
    // requires before granting the lock again.
    if (document.fullscreenElement && (n === 1 || n === 5)) {
      var c = document.getElementById('ttcanvas');
      if (c && c.requestPointerLock && document.pointerLockElement !== c) {
        try { var p = c.requestPointerLock(); if (p && p['catch']) p['catch'](function () {}); }
        catch (e) {}
      }
    }
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
// end include: shim/pre.js
// include: C:\Users\toont\dev\tt-wasm\.tmp\tmp_c75m64l.js

    if (!Module['preRun']) throw 'Module.preRun should exist because file support used it; did a pre-js delete it?';
    necessaryPreJSTasks.forEach((task) => {
      if (Module['preRun'].indexOf(task) < 0) throw 'All preRun tasks that exist before user pre-js code should remain after; did you replace Module or modify Module.preRun?';
    });
  // end include: C:\Users\toont\dev\tt-wasm\.tmp\tmp_c75m64l.js


var programArgs = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = globalThis.document?.currentScript?.src;

if (typeof __filename != 'undefined') { // Node
  _scriptName = __filename;
} else
if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  const isNode = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
  if (!isNode) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('node:fs');

  scriptDirectory = __dirname + '/';

// include: node_shell_read.js
readBinary = (filename) => {
  // We need to re-wrap `file://` strings to URLs.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename);
  assert(Buffer.isBuffer(ret));
  return ret;
};

readAsync = async (filename, binary = true) => {
  // See the comment in the `readBinary` function.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename, binary ? undefined : 'utf8');
  assert(binary ? Buffer.isBuffer(ret) : typeof ret == 'string');
  return ret;
};
// end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  programArgs = process.argv.slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

} else
if (ENVIRONMENT_IS_SHELL) {

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL('.', _scriptName).href; // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  {
// include: web_or_worker_shell_read.js
if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = async (url) => {
    // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
    // See https://github.com/github/fetch/pull/92#issuecomment-140665932
    // Cordova or Electron apps are typically loaded from a file:// url.
    // So use XHR on webview if URL is a file URL.
    if (isFileURI(url)) {
      return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            resolve(xhr.response);
            return;
          }
          reject(xhr.status);
        };
        xhr.onerror = reject;
        xhr.send(null);
      });
    }
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
      return response.arrayBuffer();
    }
    throw new Error(response.status + ' : ' + response.url);
  };
// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = console.log.bind(console);
var err = console.error.bind(console);


var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(!ENVIRONMENT_IS_SHELL, 'shell environment detected but not enabled at build time (add `shell` to `-sENVIRONMENT` to enable)');

// end include: shell.js

// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;

if (!globalThis.WebAssembly) {
  err('no native wasm support detected');
}

// Wasm globals

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');

// include: runtime_common.js
// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = 0x02135467;checkInt32(0x02135467);
  HEAPU32[(((max)+(4))>>2)] = 0x89BACDFE;checkInt32(0x89BACDFE);
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;checkInt32(1668509029);
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = HEAPU32[((max)>>2)];
  var cookie2 = HEAPU32[(((max)+(4))>>2)];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true; // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != 'undefined') return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) abort('Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)');
})();

function consumedModuleProp(prop) {
  var value = Module[prop];
  var msg = `Attempt to modify \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`;
  if (Array.isArray(value)) {
    value = new Proxy(value, {
      set(target, key, val) {
        abort(msg);
        return false;
      },
      defineProperty(target, key, descriptor) {
        abort(msg);
        return false;
      },
      deleteProperty(target, key) {
        abort(msg);
        return false;
      }
    });
  }
  Object.defineProperty(Module, prop, {
    configurable: true,
    get() { return value; },
    set() {
      abort(msg);
    }
  });
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);

}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_preloadFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

/**
 * Intercept access to a symbols in the global symbol.  This enables us to give
 * informative warnings/errors when folks attempt to use symbols they did not
 * include in their build, or no symbols that no longer exist.
 *
 * We don't define this in MODULARIZE mode since in that mode emscripten symbols
 * are never placed in the global scope.
 */
function hookGlobalSymbolAccess(sym, func) {
  if (!Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is no longer defined by emscripten. ${msg}`);
  });
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith('_')) {
      librarySymbol = '$' + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
    }
    warnOnce(msg);
  });

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}

var MAX_UINT8  = (2 **  8) - 1;
var MAX_UINT16 = (2 ** 16) - 1;
var MAX_UINT32 = (2 ** 32) - 1;
var MAX_UINT53 = (2 ** 53) - 1;
var MAX_UINT64 = (2 ** 64) - 1;

var MIN_INT8  = - (2 ** ( 8 - 1));
var MIN_INT16 = - (2 ** (16 - 1));
var MIN_INT32 = - (2 ** (32 - 1));
var MIN_INT53 = - (2 ** (53 - 1));
var MIN_INT64 = - (2 ** (64 - 1));

function checkInt(value, bits, min, max) {
  assert(Number.isInteger(Number(value)), `attempt to write non-integer (${value}) into integer heap`);
  assert(value <= max, `value (${value}) too large to write as ${bits}-bit value`);
  assert(value >= min, `value (${value}) too small to write as ${bits}-bit value`);
}

var checkInt1 = (value) => checkInt(value, 1, 1);
var checkInt8 = (value) => checkInt(value, 8, MIN_INT8, MAX_UINT8);
var checkInt16 = (value) => checkInt(value, 16, MIN_INT16, MAX_UINT16);
var checkInt32 = (value) => checkInt(value, 32, MIN_INT32, MAX_UINT32);
var checkInt53 = (value) => checkInt(value, 53, MIN_INT53, MAX_UINT53);
var checkInt64 = (value) => checkInt(value, 64, MIN_INT64, MAX_UINT64);

// end include: runtime_debug.js
// Memory management

var runtimeInitialized = false;



function updateMemoryViews() {
  var b = wasmMemory.buffer;
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(globalThis.Int32Array && globalThis.Float64Array && Int32Array.prototype.subarray && Int32Array.prototype.set,
       'JS engine does not provide full typed array support');

function preRun() {
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  consumedModuleProp('preRun');
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
  // End ATPRERUNS hooks
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  setStackLimits();

  checkStackCookie();

  // Begin ATINITS hooks
  if (!Module['noFSInit'] && !FS.initialized) FS.init();
TTY.init();
  // End ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // Begin ATPOSTCTORS hooks
  FS.ignorePermissions = false;
  // End ATPOSTCTORS hooks
}

function preMain() {
  checkStackCookie();
  // No ATMAINS hooks
}

function postRun() {
  checkStackCookie();
   // PThreads reuse the runtime from the main thread.

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  consumedModuleProp('postRun');

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
  // End ATPOSTRUNS hooks
}

/**
 * @param {string|number=} what
 */
function abort(what) {
  Module['onAbort']?.(what);

  what = `Aborted(${what})`;
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  // See above, in the meantime, we resort to wasm code for trapping.
  //
  // In case abort() is called before the module is initialized, wasmExports
  // and its exported '__trap' function is not available, in which case we throw
  // a RuntimeError.
  //
  // We trap instead of throwing RuntimeError to prevent infinite-looping in
  // Wasm EH code (because RuntimeError is considered as a foreign exception and
  // caught by 'catch_all'), but in case throwing RuntimeError is fine because
  // the module has not even been instantiated, even less running.
  if (runtimeInitialized) {
    ___trap();
  }
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile('tt.wasm');
}

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally advisable since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw 'both async and sync fetching of the wasm failed';
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {
      // Fall back to getBinarySync below;
    }
  }

  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(`warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      && !isFileURI(binaryFile)
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      && !ENVIRONMENT_IS_NODE
     ) {
    try {
      var response = fetch(binaryFile, { credentials: 'same-origin' });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err('falling back to ArrayBuffer instantiation');
      // fall back of instantiateArrayBuffer below
    };
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;

    assignWasmExports(wasmExports);

    updateMemoryViews();

    return wasmExports;
  }

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result['instance']);
  }

  var info = getWasmImports();

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module['instantiateWasm']) {
    return new Promise((resolve, reject) => {
      try {
        Module['instantiateWasm'](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      } catch(e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        reject(e);
      }
    });
  }

  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js

// Begin JS library code


  class ExitStatus {
      name = 'ExitStatus';
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }

  /** @type {!Int16Array} */
  var HEAP16;

  /** @type {!Int32Array} */
  var HEAP32;

  /** not-@type {!BigInt64Array} */
  var HEAP64;

  /** @type {!Int8Array} */
  var HEAP8;

  /** @type {!Float32Array} */
  var HEAPF32;

  /** @type {!Float64Array} */
  var HEAPF64;

  /** @type {!Uint16Array} */
  var HEAPU16;

  /** @type {!Uint32Array} */
  var HEAPU32;

  /** not-@type {!BigUint64Array} */
  var HEAPU64;

  /** @type {!Uint8Array} */
  var HEAPU8;

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);

  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);


  
    /**
   * @param {number} ptr
   * @param {string} type
   */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[ptr];
      case 'i8': return HEAP8[ptr];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP64[((ptr)>>3)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  var noExitRuntime = true;

  function ptrToString(ptr) {
      assert(typeof ptr === 'number', `ptrToString expects a number, got ${typeof ptr}`);
      // Convert to 32-bit unsigned value
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    }

  var setStackLimits = () => {
      var stackLow = _emscripten_stack_get_base();
      var stackHigh = _emscripten_stack_get_end();
      ___set_stack_limits(stackLow, stackHigh);
    };

  
    /**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[ptr] = value;checkInt8(value); break;
      case 'i8': HEAP8[ptr] = value;checkInt8(value); break;
      case 'i16': HEAP16[((ptr)>>1)] = value;checkInt16(value); break;
      case 'i32': HEAP32[((ptr)>>2)] = value;checkInt32(value); break;
      case 'i64': HEAP64[((ptr)>>3)] = BigInt(value);checkInt64(value); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }

  var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  

  function _AnsiLowerA(){ return 0; }

  function _AnsiUpperA(ptr) {
      for (var i = ptr; HEAPU8[i]; i++) {
        var c = HEAPU8[i];
        if (c >= 97 && c <= 122) HEAPU8[i] = c - 32;              /* a-z */
        else if (c >= 0xE0 && c <= 0xFE && c !== 0xF7) HEAPU8[i] = c - 32;  /* à-þ minus ÷ */
      }
      return ptr;
    }

  function _BeginPaint(){ return 0; }

  function _ClientToScreen(hwnd, ptr) { return 1; }

  function _ClipCursor(){ return 0; }

  function _CloseClipboard(){ return 0; }

  var initRandomFill = () => {
      // This block is not needed on v19+ since crypto.getRandomValues is builtin
      if (ENVIRONMENT_IS_NODE) {
        var nodeCrypto = require('node:crypto');
        return (view) => (nodeCrypto.randomFillSync(view), 0);
      }
  
      return (view) => (crypto.getRandomValues(view), 0);
    };
  var randomFill = (view) => (randomFill = initRandomFill())(view);
  
  var PATH = {
  isAbs:(path) => path.charAt(0) === '/',
  splitPath:(filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
  normalizeArray:(parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },
  normalize:(path) => {
        var isAbsolute = PATH.isAbs(path),
            trailingSlash = path.slice(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter((p) => !!p), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },
  dirname:(path) => {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.slice(0, -1);
        }
        return root + dir;
      },
  basename:(path) => path && path.match(/([^\/]+|\/)\/*$/)[1],
join:(...paths) => PATH.normalize(paths.join('/')),
join2:(l, r) => PATH.normalize(l + '/' + r),
};


var PATH_FS = {
resolve:(...args) => {
      var resolvedPath = '',
        resolvedAbsolute = false;
      for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? args[i] : FS.cwd();
        // Skip empty and invalid entries
        if (typeof path != 'string') {
          throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
          return ''; // an invalid portion invalidates the whole thing
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = PATH.isAbs(path);
      }
      // At this point the path should be resolved to a full absolute path, but
      // handle relative paths to be safe (might happen when process.cwd() fails)
      resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter((p) => !!p), !resolvedAbsolute).join('/');
      return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
    },
relative:(from, to) => {
      from = PATH_FS.resolve(from).slice(1);
      to = PATH_FS.resolve(to).slice(1);
      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== '') break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== '') break;
        }
        if (start > end) return [];
        return arr.slice(start, end - start + 1);
      }
      var fromParts = trim(from.split('/'));
      var toParts = trim(to.split('/'));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join('/');
    },
};


var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();

var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
    var maxIdx = idx + maxBytesToRead;
    if (ignoreNul) return maxIdx;
    // TextDecoder needs to know the byte length in advance, it doesn't stop on
    // null terminator by itself.
    // As a tiny code save trick, compare idx against maxIdx using a negation,
    // so that maxBytesToRead=undefined/NaN means Infinity.
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
    return idx;
  };


  /**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  
      var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce(`Invalid UTF-8 leading byte ${ptrToString(u0)} encountered when deserializing a UTF-8 string in wasm memory to a JS string!`);
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
  var FS_stdin_getChar_buffer = [];
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.codePointAt(i);
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce(`Invalid Unicode code point ${ptrToString(u)} encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).`);
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
          // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
          // We need to manually skip over the second code unit for correct iteration.
          i++;
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  /** @type {function(string, boolean=, number=)} */
  var intArrayFromString = (stringy, dontAddNull, length) => {
      var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    };
  var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          // we will read data by chunks of BUFSIZE
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
  
          // For some reason we must suppress a closure warning here, even though
          // fd definitely exists on process.stdin, and is even the proper way to
          // get the fd of stdin,
          // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
          // This started to happen after moving this logic out of library_tty.js,
          // so it is related to the surrounding code in some unclear manner.
          /** @suppress {missingProperties} */
          var fd = process.stdin.fd;
  
          try {
            bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an
            // exception, but on other OSes, reading EOF returns 0. Uniformize
            // behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          }
        } else
        if (globalThis.window?.prompt) {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else
        {}
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };
  var TTY = {
  ttys:[],
  init() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process.stdin.setEncoding('utf8');
        // }
      },
  shutdown() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process.stdin.pause();
        // }
      },
  register(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },
  stream_ops:{
  open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
  close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty);
        },
  fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
  read(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.atime = Date.now();
          }
          return bytesRead;
        },
  write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.mtime = stream.node.ctime = Date.now();
          }
          return i;
        },
  },
  default_tty_ops:{
  get_char(tty) {
          return FS_stdin_getChar();
        },
  put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            out(UTF8ArrayToString(tty.output));
            tty.output = [];
          }
        },
  ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00,
              0x12, 0x0f, 0x17, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]
          };
        },
  ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0;
        },
  ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
  },
  default_tty1_ops:{
  put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          }
        },
  },
  };
  
  
  var mmapAlloc = (size) => {
      abort('internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported');
    };
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16895, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // not supported
          throw new FS.ErrnoError(63);
        }
        MEMFS.ops_table ||= {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek
            }
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync
            }
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink
            },
            stream: {}
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: FS.chrdev_stream_ops
          }
        };
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          // The actual number of bytes used in the typed array, as opposed to
          // contents.length which gives the whole capacity.
          node.usedBytes = 0;
          // The byte data of the file is stored in a typed array.
          // Note: typed arrays are not resizable like normal JS arrays are, so
          // there is a small penalty involved for appending file writes that
          // continuously grow a file similar to std::vector capacity vs used.
          node.contents = MEMFS.emptyFileContents ??= new Uint8Array(0);
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.atime = node.mtime = node.ctime = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.atime = parent.mtime = parent.ctime = node.atime;
        }
        return node;
      },
  getFileDataAsTypedArray(node) {
        assert(FS.isFile(node.mode), 'getFileDataAsTypedArray called on non-file');
        return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
      },
  expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents.length;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very
        // small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for
        // large sizes, do a much more conservative size*1.125 increase to avoid
        // overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = MEMFS.getFileDataAsTypedArray(node);
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        node.contents.set(oldContents);
      },
  resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        var oldContents = node.contents;
        node.contents = new Uint8Array(newSize); // Allocate new storage.
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
        node.usedBytes = newSize;
      },
  node_ops:{
  getattr(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.atime);
          attr.mtime = new Date(node.mtime);
          attr.ctime = new Date(node.ctime);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          for (const key of ["mode", "atime", "mtime", "ctime"]) {
            if (attr[key] != null) {
              node[key] = attr[key];
            }
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw new FS.ErrnoError(44);
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {}
          if (new_node) {
            if (FS.isDir(old_node.mode)) {
              // if we're overwriting a directory at new_name, make sure it's empty.
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
            FS.hashRemoveNode(new_node);
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          new_dir.contents[new_name] = old_node;
          old_node.name = new_name;
          new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  readdir(node) {
          return ['.', '..', ...Object.keys(node.contents)];
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 0o777 | 40960, 0);
          node.link = oldpath;
          return node;
        },
  readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
  },
  stream_ops:{
  read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          buffer.set(contents.subarray(position, position + size), offset);
          return size;
        },
  write(stream, buffer, offset, length, position, canOwn) {
          assert(buffer.subarray, 'FS.write expects a TypedArray');
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.mtime = node.ctime = Date.now();
  
          if (canOwn) {
            assert(position === 0, 'canOwn must imply no weird position inside the file');
            node.contents = buffer.subarray(offset, offset + length);
            node.usedBytes = length;
          } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
            node.contents = buffer.slice(offset, offset + length);
            node.usedBytes = length;
          } else {
            MEMFS.expandFileStorage(node, position+length);
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
            node.usedBytes = Math.max(node.usedBytes, position + length);
          }
          return length;
        },
  llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            if (contents) {
              // Try to avoid unnecessary slices.
              if (position > 0 || position + length < contents.length) {
                if (contents.subarray) {
                  contents = contents.subarray(position, position + length);
                } else {
                  contents = Array.prototype.slice.call(contents, position, position + length);
                }
              }
              HEAP8.set(contents, ptr);
            }
          }
          return { ptr, allocated };
        },
  msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        },
  },
  };
  
  var FS_modeStringToFlags = (str) => {
      if (typeof str != 'string') return str;
      var flagModes = {
        'r': 0,
        'r+': 2,
        'w': 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        'a': 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };
  
  var FS_fileDataToTypedArray = (data) => {
      if (typeof data == 'string') {
        data = intArrayFromString(data, true);
      }
      if (!data.subarray) {
        data = new Uint8Array(data);
      }
      return data;
    };
  
  var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };
  
  
  
  
  var IDBFS = {
  dbs:{
  },
  indexedDB:() => {
        assert(typeof indexedDB != 'undefined', 'IDBFS used, but indexedDB not supported');
        return indexedDB;
      },
  DB_VERSION:21,
  DB_STORE_NAME:"FILE_DATA",
  queuePersist:(mount) => {
        function onPersistComplete() {
          if (mount.idbPersistState === 'again') startPersist(); // If a new sync request has appeared in between, kick off a new sync
          else {
            mount.idbPersistState = 0; // Otherwise reset sync state back to idle to wait for a new sync later
            IDBFS.onAutoPersistStateChanged?.(false);
          }
        }
        function startPersist() {
          mount.idbPersistState = 'idb'; // Mark that we are currently running a sync operation
          IDBFS.onAutoPersistStateChanged?.(true);
          IDBFS.syncfs(mount, /*populate:*/false, onPersistComplete);
        }
  
        if (!mount.idbPersistState) {
          // Programs typically write/copy/move multiple files in the in-memory
          // filesystem within a single app frame, so when a filesystem sync
          // command is triggered, do not start it immediately, but only after
          // the current frame is finished. This way all the modified files
          // inside the main loop tick will be batched up to the same sync.
          mount.idbPersistState = setTimeout(startPersist, 0);
        } else if (mount.idbPersistState === 'idb') {
          // There is an active IndexedDB sync operation in-flight, but we now
          // have accumulated more files to sync. We should therefore queue up
          // a new sync after the current one finishes so that all writes
          // will be properly persisted.
          mount.idbPersistState = 'again';
        }
      },
  mount:(mount) => {
        // reuse core MEMFS functionality
        var mnt = MEMFS.mount(mount);
        // If the automatic IDBFS persistence option has been selected, then automatically persist
        // all modifications to the filesystem as they occur.
        if (mount?.opts?.autoPersist) {
          mount.idbPersistState = 0; // IndexedDB sync starts in idle state
          var memfs_node_ops = mnt.node_ops;
          mnt.node_ops = {...mnt.node_ops}; // Clone node_ops to inject write tracking
          mnt.node_ops.mknod = (parent, name, mode, dev) => {
            var node = memfs_node_ops.mknod(parent, name, mode, dev);
            // Propagate injected node_ops to the newly created child node
            node.node_ops = mnt.node_ops;
            // Remember for each IDBFS node which IDBFS mount point they came from so we know which mount to persist on modification.
            node.idbfs_mount = mnt.mount;
            // Remember original MEMFS stream_ops for this node
            node.memfs_stream_ops = node.stream_ops;
            // Clone stream_ops to inject write tracking
            node.stream_ops = {...node.stream_ops};
  
            // Track all file writes
            node.stream_ops.write = (stream, buffer, offset, length, position, canOwn) => {
              // This file has been modified, we must persist IndexedDB when this file closes
              stream.node.isModified = true;
              return node.memfs_stream_ops.write(stream, buffer, offset, length, position, canOwn);
            };
  
            // Persist IndexedDB on file close
            node.stream_ops.close = (stream) => {
              var n = stream.node;
              if (n.isModified) {
                IDBFS.queuePersist(n.idbfs_mount);
                n.isModified = false;
              }
              if (n.memfs_stream_ops.close) return n.memfs_stream_ops.close(stream);
            };
  
            // Persist the node we just created to IndexedDB
            IDBFS.queuePersist(mnt.mount);
  
            return node;
          };
          // Also kick off persisting the filesystem on other operations that modify the filesystem.
          mnt.node_ops.rmdir   = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.rmdir(...args));
          mnt.node_ops.symlink = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.symlink(...args));
          mnt.node_ops.unlink  = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.unlink(...args));
          mnt.node_ops.rename  = (...args) => (IDBFS.queuePersist(mnt.mount), memfs_node_ops.rename(...args));
        }
        return mnt;
      },
  syncfs:(mount, populate, callback) => {
        IDBFS.getLocalSet(mount, (err, local) => {
          if (err) return callback(err);
  
          IDBFS.getRemoteSet(mount, (err, remote) => {
            if (err) return callback(err);
  
            var src = populate ? remote : local;
            var dst = populate ? local : remote;
  
            IDBFS.reconcile(src, dst, callback);
          });
        });
      },
  quit:() => {
        for (var value of Object.values(IDBFS.dbs)) {
          value.close()
        }
        IDBFS.dbs = {};
      },
  getDB:(name, callback) => {
        // check the cache first
        var db = IDBFS.dbs[name];
        if (db) {
          return callback(null, db);
        }
  
        var req;
        try {
          req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
        } catch (e) {
          return callback(e);
        }
        if (!req) {
          return callback("Unable to connect to IndexedDB");
        }
        req.onupgradeneeded = (e) => {
          var db = /** @type {IDBDatabase} */ (e.target.result);
          var transaction = e.target.transaction;
  
          var fileStore;
  
          if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
          } else {
            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
          }
  
          if (!fileStore.indexNames.contains('timestamp')) {
            fileStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        req.onsuccess = () => {
          db = /** @type {IDBDatabase} */ (req.result);
  
          // add to the cache
          IDBFS.dbs[name] = db;
          callback(null, db);
        };
        req.onerror = (e) => {
          callback(e.target.error);
          e.preventDefault();
        };
      },
  getLocalSet:(mount, callback) => {
        var entries = {};
  
        function isRealDir(p) {
          return p !== '.' && p !== '..';
        };
        function toAbsolute(root) {
          return (p) => PATH.join2(root, p);
        };
  
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  
        while (check.length) {
          var path = check.pop();
          var stat;
  
          try {
            stat = FS.lstat(path);
          } catch (e) {
            return callback(e);
          }
  
          if (FS.isDir(stat.mode)) {
            check.push(...FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
          }
  
          entries[path] = { 'timestamp': stat.mtime };
        }
  
        return callback(null, { type: 'local', entries: entries });
      },
  getRemoteSet:(mount, callback) => {
        var entries = {};
  
        IDBFS.getDB(mount.mountpoint, (err, db) => {
          if (err) return callback(err);
  
          try {
            var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readonly');
            transaction.onerror = (e) => {
              callback(e.target.error);
              e.preventDefault();
            };
  
            var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
            var index = store.index('timestamp');
  
            index.openKeyCursor().onsuccess = (event) => {
              var cursor = event.target.result;
  
              if (!cursor) {
                return callback(null, { type: 'remote', db, entries });
              }
  
              entries[cursor.primaryKey] = { 'timestamp': cursor.key };
  
              cursor.continue();
            };
          } catch (e) {
            return callback(e);
          }
        });
      },
  loadLocalEntry:(path, callback) => {
        var stat, node;
  
        try {
          var lookup = FS.lookupPath(path);
          node = lookup.node;
          stat = FS.lstat(path);
        } catch (e) {
          return callback(e);
        }
  
        if (FS.isDir(stat.mode)) {
          return callback(null, { 'timestamp': stat.mtime, 'mode': stat.mode });
        } else if (FS.isLink(stat.mode)) {
          return callback(null, { 'timestamp': stat.mtime, 'mode': stat.mode, 'link': node.link, });
        } else if (FS.isFile(stat.mode)) {
          // Performance consideration: storing a normal JavaScript array to a IndexedDB is much slower than storing a typed array.
          // Therefore always convert the file contents to a typed array first before writing the data to IndexedDB.
          node.contents = MEMFS.getFileDataAsTypedArray(node);
          return callback(null, { 'timestamp': stat.mtime, 'mode': stat.mode, 'contents': node.contents });
        } else {
          return callback(new Error('node type not supported'));
        }
      },
  storeLocalEntry:(path, entry, callback) => {
        try {
          if (FS.isDir(entry['mode'])) {
            FS.mkdirTree(path, entry['mode']);
          } else if (FS.isLink(entry['mode'])) {
            FS.symlink(entry['link'], path);
          } else if (FS.isFile(entry['mode'])) {
            FS.writeFile(path, entry['contents'], { canOwn: true });
          } else {
            return callback(new Error('node type not supported'));
          }
  
          FS.chmod(path, entry['mode']);
          FS.utime(path, entry['timestamp'], entry['timestamp']);
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },
  removeLocalEntry:(path, callback) => {
        try {
          var stat = FS.lstat(path);
  
          if (FS.isDir(stat.mode)) {
            FS.rmdir(path);
          } else {
            FS.unlink(path);
          }
        } catch (e) {
          return callback(e);
        }
  
        callback(null);
      },
  loadRemoteEntry:(store, path, callback) => {
        var req = store.get(path);
        req.onsuccess = (event) => callback(null, event.target.result);
        req.onerror = (e) => {
          callback(e.target.error);
          e.preventDefault();
        };
      },
  storeRemoteEntry:(store, path, entry, callback) => {
        try {
          var req = store.put(entry, path);
        } catch (e) {
          callback(e);
          return;
        }
        req.onsuccess = (event) => callback();
        req.onerror = (e) => {
          callback(e.target.error);
          e.preventDefault();
        };
      },
  removeRemoteEntry:(store, path, callback) => {
        var req = store.delete(path);
        req.onsuccess = (event) => callback();
        req.onerror = (e) => {
          callback(e.target.error);
          e.preventDefault();
        };
      },
  reconcile:(src, dst, callback) => {
        var total = 0;
  
        var create = [];
        for (var [key, e] of Object.entries(src.entries)) {
          var e2 = dst.entries[key];
          if (!e2 || e['timestamp'].getTime() != e2['timestamp'].getTime()) {
            create.push(key);
            total++;
          }
        }
  
        var remove = [];
        for (var key of Object.keys(dst.entries)) {
          if (!src.entries[key]) {
            remove.push(key);
            total++;
          }
        }
  
        if (!total) {
          return callback(null);
        }
  
        var errored = false;
        var db = src.type === 'remote' ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], 'readwrite');
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  
        function done(err) {
          if (err && !errored) {
            errored = true;
            return callback(err);
          }
        };
  
        // transaction may abort if (for example) there is a QuotaExceededError
        transaction.onerror = transaction.onabort = (e) => {
          done(e.target.error);
          e.preventDefault();
        };
  
        transaction.oncomplete = (e) => {
          if (!errored) {
            callback(null);
          }
        };
  
        // sort paths in ascending order so directory entries are created
        // before the files inside them
        for (const path of create.sort()) {
          if (dst.type === 'local') {
            IDBFS.loadRemoteEntry(store, path, (err, entry) => {
              if (err) return done(err);
              IDBFS.storeLocalEntry(path, entry, done);
            });
          } else {
            IDBFS.loadLocalEntry(path, (err, entry) => {
              if (err) return done(err);
              IDBFS.storeRemoteEntry(store, path, entry, done);
            });
          }
        }
  
        // sort paths in descending order so files are deleted before their
        // parent directories
        for (var path of remove.sort().reverse()) {
          if (dst.type === 'local') {
            IDBFS.removeLocalEntry(path, done);
          } else {
            IDBFS.removeRemoteEntry(store, path, done);
          }
        }
      },
  };
  
  
  
    /**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
    };
  
  var strError = (errno) => UTF8ToString(_strerror(errno));
  
  var ERRNO_CODES = {
      'EPERM': 63,
      'ENOENT': 44,
      'ESRCH': 71,
      'EINTR': 27,
      'EIO': 29,
      'ENXIO': 60,
      'E2BIG': 1,
      'ENOEXEC': 45,
      'EBADF': 8,
      'ECHILD': 12,
      'EAGAIN': 6,
      'EWOULDBLOCK': 6,
      'ENOMEM': 48,
      'EACCES': 2,
      'EFAULT': 21,
      'ENOTBLK': 105,
      'EBUSY': 10,
      'EEXIST': 20,
      'EXDEV': 75,
      'ENODEV': 43,
      'ENOTDIR': 54,
      'EISDIR': 31,
      'EINVAL': 28,
      'ENFILE': 41,
      'EMFILE': 33,
      'ENOTTY': 59,
      'ETXTBSY': 74,
      'EFBIG': 22,
      'ENOSPC': 51,
      'ESPIPE': 70,
      'EROFS': 69,
      'EMLINK': 34,
      'EPIPE': 64,
      'EDOM': 18,
      'ERANGE': 68,
      'ENOMSG': 49,
      'EIDRM': 24,
      'ECHRNG': 106,
      'EL2NSYNC': 156,
      'EL3HLT': 107,
      'EL3RST': 108,
      'ELNRNG': 109,
      'EUNATCH': 110,
      'ENOCSI': 111,
      'EL2HLT': 112,
      'EDEADLK': 16,
      'ENOLCK': 46,
      'EBADE': 113,
      'EBADR': 114,
      'EXFULL': 115,
      'ENOANO': 104,
      'EBADRQC': 103,
      'EBADSLT': 102,
      'EDEADLOCK': 16,
      'EBFONT': 101,
      'ENOSTR': 100,
      'ENODATA': 116,
      'ETIME': 117,
      'ENOSR': 118,
      'ENONET': 119,
      'ENOPKG': 120,
      'EREMOTE': 121,
      'ENOLINK': 47,
      'EADV': 122,
      'ESRMNT': 123,
      'ECOMM': 124,
      'EPROTO': 65,
      'EMULTIHOP': 36,
      'EDOTDOT': 125,
      'EBADMSG': 9,
      'ENOTUNIQ': 126,
      'EBADFD': 127,
      'EREMCHG': 128,
      'ELIBACC': 129,
      'ELIBBAD': 130,
      'ELIBSCN': 131,
      'ELIBMAX': 132,
      'ELIBEXEC': 133,
      'ENOSYS': 52,
      'ENOTEMPTY': 55,
      'ENAMETOOLONG': 37,
      'ELOOP': 32,
      'EOPNOTSUPP': 138,
      'EPFNOSUPPORT': 139,
      'ECONNRESET': 15,
      'ENOBUFS': 42,
      'EAFNOSUPPORT': 5,
      'EPROTOTYPE': 67,
      'ENOTSOCK': 57,
      'ENOPROTOOPT': 50,
      'ESHUTDOWN': 140,
      'ECONNREFUSED': 14,
      'EADDRINUSE': 3,
      'ECONNABORTED': 13,
      'ENETUNREACH': 40,
      'ENETDOWN': 38,
      'ETIMEDOUT': 73,
      'EHOSTDOWN': 142,
      'EHOSTUNREACH': 23,
      'EINPROGRESS': 26,
      'EALREADY': 7,
      'EDESTADDRREQ': 17,
      'EMSGSIZE': 35,
      'EPROTONOSUPPORT': 66,
      'ESOCKTNOSUPPORT': 137,
      'EADDRNOTAVAIL': 4,
      'ENETRESET': 39,
      'EISCONN': 30,
      'ENOTCONN': 53,
      'ETOOMANYREFS': 141,
      'EUSERS': 136,
      'EDQUOT': 19,
      'ESTALE': 72,
      'ENOTSUP': 138,
      'ENOMEDIUM': 148,
      'EILSEQ': 25,
      'EOVERFLOW': 61,
      'ECANCELED': 11,
      'ENOTRECOVERABLE': 56,
      'EOWNERDEAD': 62,
      'ESTRPIPE': 135,
    };
  
  var asyncLoad = async (url) => {
      var arrayBuffer = await readAsync(url);
      assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
      return new Uint8Array(arrayBuffer);
    };
  
  
  var FS_createDataFile = (...args) => FS.createDataFile(...args);
  
  var getUniqueRunDependency = (id) => {
      var orig = id;
      while (1) {
        if (!runDependencyTracking[id]) return id;
        id = orig + Math.random();
      }
    };
  
  var runDependencies = 0;
  
  
  var dependenciesFulfilled = null;
  
  var runDependencyTracking = {
  };
  
  var runDependencyWatcher = null;
  var removeRunDependency = (id) => {
      runDependencies--;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'removeRunDependency requires an ID');
      assert(runDependencyTracking[id]);
      delete runDependencyTracking[id];
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback(); // can add another dependenciesFulfilled
        }
      }
    };
  
  
  var addRunDependency = (id) => {
      runDependencies++;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'addRunDependency requires an ID')
      assert(!runDependencyTracking[id]);
      runDependencyTracking[id] = 1;
      if (runDependencyWatcher === null && globalThis.setInterval) {
        // Check for missing dependencies every few seconds
        runDependencyWatcher = setInterval(() => {
          if (ABORT) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null;
            return;
          }
          var shown = false;
          for (var dep in runDependencyTracking) {
            if (!shown) {
              shown = true;
              err('still waiting on run dependencies:');
            }
            err(`dependency: ${dep}`);
          }
          if (shown) {
            err('(end of list)');
          }
        }, 10000);
        // Prevent this timer from keeping the runtime alive if nothing
        // else is.
        runDependencyWatcher.unref?.()
      }
    };
  
  
  var preloadPlugins = [];
  var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      for (var plugin of preloadPlugins) {
        if (plugin['canHandle'](fullname)) {
          assert(plugin['handle'].constructor.name === 'AsyncFunction', 'Filesystem plugin handlers must be async functions (See #24914)')
          return plugin['handle'](byteArray, fullname);
        }
      }
      // If no plugin handled this file then return the original/unmodified
      // byteArray.
      return byteArray;
    };
  var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      addRunDependency(dep);
  
      try {
        var byteArray = url;
        if (typeof url == 'string') {
          byteArray = await asyncLoad(url);
        }
  
        byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
        preFinish?.();
        if (!dontCreateFile) {
          FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
        }
      } finally {
        removeRunDependency(dep);
      }
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
    };
  var FS = {
  root:null,
  mounts:[],
  devices:{
  },
  streams:[],
  nextInode:1,
  nameTable:null,
  currentPath:"/",
  initialized:false,
  ignorePermissions:true,
  filesystems:null,
  syncFSRequests:0,
  ErrnoError:class extends Error {
        name = 'ErrnoError';
        // We set the `name` property to be able to identify `FS.ErrnoError`
        // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
        // - when using PROXYFS, an error can come from an underlying FS
        // as different FS objects have their own FS.ErrnoError each,
        // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
        // we'll use the reliable test `err.name == "ErrnoError"` instead
        constructor(errno) {
          super(runtimeInitialized ? strError(errno) : '');
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break;
            }
          }
        }
      },
  FSStream:class {
        shared = {};
        get object() {
          return this.node;
        }
        set object(val) {
          this.node = val;
        }
        get isRead() {
          return (this.flags & 2097155) !== 1;
        }
        get isWrite() {
          return (this.flags & 2097155) !== 0;
        }
        get isAppend() {
          return (this.flags & 1024);
        }
        get flags() {
          return this.shared.flags;
        }
        set flags(val) {
          this.shared.flags = val;
        }
        get position() {
          return this.shared.position;
        }
        set position(val) {
          this.shared.position = val;
        }
      },
  FSNode:class {
        node_ops = {};
        stream_ops = {};
        readMode = 292 | 73;
        writeMode = 146;
        mounted = null;
        constructor(parent, name, mode, rdev) {
          if (!parent) {
            parent = this;  // root node sets parent to itself
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.rdev = rdev;
          this.atime = this.mtime = this.ctime = Date.now();
        }
        get read() {
          return (this.mode & this.readMode) === this.readMode;
        }
        set read(val) {
          val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
        }
        get write() {
          return (this.mode & this.writeMode) === this.writeMode;
        }
        set write(val) {
          val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
        }
        get isFolder() {
          return FS.isDir(this.mode);
        }
        get isDevice() {
          return FS.isChrdev(this.mode);
        }
      },
  lookupPath(path, opts = {}) {
        if (!path) {
          throw new FS.ErrnoError(44);
        }
        opts.follow_mount ??= true
  
        if (!PATH.isAbs(path)) {
          path = FS.cwd() + '/' + path;
        }
  
        // limit max consecutive symlinks to SYMLOOP_MAX.
        linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
          // split the absolute path
          var parts = path.split('/').filter((p) => !!p);
  
          // start at the root
          var current = FS.root;
          var current_path = '/';
  
          for (var i = 0; i < parts.length; i++) {
            var islast = (i === parts.length-1);
            if (islast && opts.parent) {
              // stop resolving
              break;
            }
  
            if (parts[i] === '.') {
              continue;
            }
  
            if (parts[i] === '..') {
              current_path = PATH.dirname(current_path);
              if (FS.isRoot(current)) {
                path = current_path + '/' + parts.slice(i + 1).join('/');
                // We're making progress here, don't let many consecutive ..'s
                // lead to ELOOP
                nlinks--;
                continue linkloop;
              } else {
                current = current.parent;
              }
              continue;
            }
  
            current_path = PATH.join2(current_path, parts[i]);
            try {
              current = FS.lookupNode(current, parts[i]);
            } catch (e) {
              // if noent_okay is true, suppress a ENOENT in the last component
              // and return an object with an undefined node. This is needed for
              // resolving symlinks in the path when creating a file.
              if ((e?.errno === 44) && islast && opts.noent_okay) {
                return { path: current_path };
              }
              throw e;
            }
  
            // jump to the mount's root node if this is a mountpoint
            if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
              current = current.mounted.root;
            }
  
            // by default, lookupPath will not follow a symlink if it is the final path component.
            // setting opts.follow = true will override this behavior.
            if (FS.isLink(current.mode) && (!islast || opts.follow)) {
              if (!current.node_ops.readlink) {
                throw new FS.ErrnoError(52);
              }
              var link = current.node_ops.readlink(current);
              if (!PATH.isAbs(link)) {
                link = PATH.dirname(current_path) + '/' + link;
              }
              path = link + '/' + parts.slice(i + 1).join('/');
              continue linkloop;
            }
          }
          return { path: current_path, node: current };
        }
        throw new FS.ErrnoError(32);
      },
  getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? `${mount}/${path}` : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
  hashName(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
  hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
  hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
  lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },
  createNode(parent, name, mode, rdev) {
        assert(typeof parent == 'object')
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },
  destroyNode(node) {
        FS.hashRemoveNode(node);
      },
  isRoot(node) {
        return node === node.parent;
      },
  isMountpoint(node) {
        return !!node.mounted;
      },
  isFile(mode) {
        return (mode & 61440) === 32768;
      },
  isDir(mode) {
        return (mode & 61440) === 16384;
      },
  isLink(mode) {
        return (mode & 61440) === 40960;
      },
  isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
  isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
  isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
  isSocket(mode) {
        return (mode & 49152) === 49152;
      },
  flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },
  nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        }
        if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        }
        if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
  mayLookup(dir) {
        if (!FS.isDir(dir.mode)) return 54;
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        if (!FS.isDir(dir.mode)) {
          return 54;
        }
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },
  mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else if (FS.isDir(node.mode)) {
          return 31;
        }
        return 0;
      },
  mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        }
        var mode = FS.flagsToPermissionString(flags);
        if (FS.isDir(node.mode)) {
          // opening for write
          // TODO: check for O_SEARCH? (== search for dir only)
          if (mode !== 'r' || (flags & (512 | 64))) {
            return 31;
          }
        }
        return FS.nodePermissions(node, mode);
      },
  checkOpExists(op, err) {
        if (!op) {
          throw new FS.ErrnoError(err);
        }
        return op;
      },
  MAX_OPEN_FDS:4096,
  nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
  getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
  getStream:(fd) => FS.streams[fd],
  createStream(stream, fd = -1) {
        assert(fd >= -1);
  
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
  closeStream(fd) {
        FS.streams[fd] = null;
      },
  dupStream(origStream, fd = -1) {
        var stream = FS.createStream(origStream, fd);
        stream.stream_ops?.dup?.(stream);
        return stream;
      },
  doSetAttr(stream, node, attr) {
        var setattr = stream?.stream_ops.setattr;
        var arg = setattr ? stream : node;
        setattr ??= node.node_ops.setattr;
        FS.checkOpExists(setattr, 63)
        try {
          setattr(arg, attr);
        } catch (e) {
          if (e instanceof RangeError) {
            throw new FS.ErrnoError(22);
          }
          throw e;
        }
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          stream.stream_ops.open?.(stream);
        },
  llseek() {
          throw new FS.ErrnoError(70);
        },
  },
  major:(dev) => ((dev) >> 8),
  minor:(dev) => ((dev) & 0xff),
  makedev:(ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },
  getDevice:(dev) => FS.devices[dev],
  getMounts(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push(...m.mounts);
        }
  
        return mounts;
      },
  syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        for (var mount of mounts) {
          if (mount.type.syncfs) {
            mount.type.syncfs(mount, populate, done);
          } else {
            done(null);
          }
        }
      },
  mount(type, opts, mountpoint) {
        if (typeof type == 'string') {
          // The filesystem was not included, and instead we have an error
          // message stored in the variable.
          throw type;
        }
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type,
          opts,
          mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },
  unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        for (var [hash, current] of Object.entries(FS.nameTable)) {
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        }
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },
  lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
  mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name) {
          throw new FS.ErrnoError(28);
        }
        if (name === '.' || name === '..') {
          throw new FS.ErrnoError(20);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
  statfs(path) {
        return FS.statfsNode(FS.lookupPath(path, {follow: true}).node);
      },
  statfsStream(stream) {
        // We keep a separate statfsStream function because noderawfs overrides
        // it. In noderawfs, stream.node is sometimes null. Instead, we need to
        // look at stream.path.
        return FS.statfsNode(stream.node);
      },
  statfsNode(node) {
        // NOTE: None of the defaults here are true. We're just returning safe and
        //       sane values. Currently nodefs and rawfs replace these defaults,
        //       other file systems leave them alone.
        var rtn = {
          bsize: 4096,
          frsize: 4096,
          blocks: 1e6,
          bfree: 5e5,
          bavail: 5e5,
          files: FS.nextInode,
          ffree: FS.nextInode - 1,
          fsid: 42,
          flags: 2,
          namelen: 255,
        };
  
        if (node.node_ops.statfs) {
          Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
        }
        return rtn;
      },
  create(path, mode = 0o666) {
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode = 0o777) {
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var dir of dirs) {
          if (!dir) continue;
          if (d || PATH.isAbs(path)) d += '/';
          d += dir;
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },
  mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode;
          mode = 0o666;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
  symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
  rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existent directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
          // update old node (we do this here to avoid each backend
          // needing to)
          old_node.parent = new_dir;
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },
  rmdir(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
  readdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
        return readdir(node);
      },
  unlink(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
  readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return link.node_ops.readlink(link);
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
        return getattr(node);
      },
  fstat(fd) {
        var stream = FS.getStreamChecked(fd);
        var node = stream.node;
        var getattr = stream.stream_ops.getattr;
        var arg = getattr ? stream : node;
        getattr ??= node.node_ops.getattr;
        FS.checkOpExists(getattr, 63)
        return getattr(arg);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  doChmod(stream, node, mode, dontFollow) {
        FS.doSetAttr(stream, node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          ctime: Date.now(),
          dontFollow
        });
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChmod(null, node, mode, dontFollow);
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.doChmod(stream, stream.node, mode, false);
      },
  doChown(stream, node, dontFollow) {
        FS.doSetAttr(stream, node, {
          timestamp: Date.now(),
          dontFollow
          // we ignore the uid / gid for now
        });
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChown(null, node, dontFollow);
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.doChown(stream, stream.node, false);
      },
  doTruncate(stream, node, len) {
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.doSetAttr(stream, node, {
          size: len,
          timestamp: Date.now()
        });
      },
  truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doTruncate(null, node, len);
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if (len < 0 || (stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.doTruncate(stream, stream.node, len);
      },
  utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        var setattr = FS.checkOpExists(node.node_ops.setattr, 63);
        setattr(node, {
          atime: atime,
          mtime: mtime
        });
      },
  open(path, flags, mode = 0o666) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = FS_modeStringToFlags(flags);
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        var isDirPath;
        if (typeof path == 'object') {
          node = path;
        } else {
          isDirPath = path.endsWith("/");
          // noent_okay makes it so that if the final component of the path
          // doesn't exist, lookupPath returns `node: undefined`. `path` will be
          // updated to point to the target of all symlinks.
          var lookup = FS.lookupPath(path, {
            follow: !(flags & 131072),
            noent_okay: true
          });
          node = lookup.node;
          path = lookup.path;
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else if (isDirPath) {
            throw new FS.ErrnoError(31);
          } else {
            // node doesn't exist, try to create it
            // Ignore the permission bits here to ensure we can `open` this new
            // file below. We use chmod below to apply the permissions once the
            // file is open.
            node = FS.mknod(path, mode | 0o777, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512) && !created) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        });
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (created) {
          FS.chmod(node, mode & 0o777);
        }
        return stream;
      },
  close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
  isClosed(stream) {
        return stream.fd === null;
      },
  llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
  read(stream, buffer, offset, length, position) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
  write(stream, buffer, offset, length, position, canOwn) {
        assert(offset >= 0);
        assert(buffer.subarray, 'FS.write expects a TypedArray');
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
  mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        if (!length) {
          throw new FS.ErrnoError(28);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
  msync(stream, buffer, offset, length, mmapFlags) {
        assert(offset >= 0);
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
  ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
  readFile(path, opts = {}) {
        opts.flags = opts.flags ?? 0;
        opts.encoding = opts.encoding ?? 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          abort(`Invalid encoding type "${opts.encoding}"`);
        }
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          buf = UTF8ArrayToString(buf);
        }
        FS.close(stream);
        return buf;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags ?? 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        data = FS_fileDataToTypedArray(data);
        FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        FS.close(stream);
      },
  cwd:() => FS.currentPath,
  chdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
  createDefaultDirectories() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },
  createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
          llseek: () => 0,
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024), randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomFill(randomBuffer);
            randomLeft = randomBuffer.byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice('/dev', 'random', randomByte);
        FS.createDevice('/dev', 'urandom', randomByte);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },
  createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount() {
            var node = FS.createNode(proc_self, 'fd', 16895, 73);
            node.stream_ops = {
              llseek: MEMFS.stream_ops.llseek,
            };
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                  id: fd + 1,
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              },
              readdir() {
                return Array.from(FS.streams.entries())
                  .filter(([k, v]) => v)
                  .map(([k, v]) => k.toString());
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams(input, output, error) {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (input) {
          FS.createDevice('/dev', 'stdin', input);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (output) {
          FS.createDevice('/dev', 'stdout', null, output);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (error) {
          FS.createDevice('/dev', 'stderr', null, error);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
        assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
        assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
        assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
      },
  staticInit() {
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
          'IDBFS': IDBFS,
        };
      },
  init(input, output, error) {
        assert(!FS.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.initialized = true;
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        input ??= Module['stdin'];
        output ??= Module['stdout'];
        error ??= Module['stderr'];
  
        FS.createStandardStreams(input, output, error);
      },
  quit() {
        FS.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var stream of FS.streams) {
          if (stream) {
            FS.close(stream);
          }
        }
      },
  findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
  analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },
  createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            if (e.errno != 20) throw e;
          }
          parent = current;
        }
        return current;
      },
  createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          data = FS_fileDataToTypedArray(data);
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        FS.createDevice.major ??= 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output?.buffer?.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.atime = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.mtime = stream.node.ctime = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (globalThis.XMLHttpRequest) {
          abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else { // Command-line.
          try {
            obj.contents = readBinary(obj.url);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array).
        // Actual getting is abstracted away for eventual reuse.
        class LazyUint8Array {
          lengthKnown = false;
          chunks = []; // Loaded chunks. Index is the chunk number
          get(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = (idx / this.chunkSize)|0;
            return this.getter(chunkNum)[chunkOffset];
          }
          setDataGetter(getter) {
            this.getter = getter;
          }
          cacheLength() {
            // Find length
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
            var chunkSize = 1024*1024; // Chunk size in bytes
  
            if (!hasByteServing) chunkSize = datalength;
  
            // Function to get a range from the remote URL.
            var doXHR = (from, to) => {
              if (from > to) abort(`invalid range (${from}, ${to}) or no bytes requested!`);
              if (to > datalength-1) abort(`only ${datalength} bytes available! programmer error!`);
  
              // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
              var xhr = new XMLHttpRequest();
              xhr.open('GET', url, false);
              if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
              // Some hints to the browser that we want binary data.
              xhr.responseType = 'arraybuffer';
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
              }
  
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort("Couldn't load " + url + ". Status: " + xhr.status);
              if (xhr.response !== undefined) {
                return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
              }
              return intArrayFromString(xhr.responseText ?? '', true);
            };
            var lazyArray = this;
            lazyArray.setDataGetter((chunkNum) => {
              var start = chunkNum * chunkSize;
              var end = (chunkNum+1) * chunkSize - 1; // including this byte
              end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
                lazyArray.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') abort('doXHR failed!');
              return lazyArray.chunks[chunkNum];
            });
  
            if (usesGzip || !datalength) {
              // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
              chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out("LazyFiles on gzip forces download of the whole file when length is accessed");
            }
  
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          }
          get length() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          }
          get chunkSize() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          }
        }
  
        if (globalThis.XMLHttpRequest) {
          if (!ENVIRONMENT_IS_WORKER) abort('Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc');
          var lazyArray = new LazyUint8Array();
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        for (const [key, fn] of Object.entries(node.stream_ops)) {
          stream_ops[key] = (...args) => {
            FS.forceLoadFile(node);
            return fn(...args);
          };
        }
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position)
        };
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        };
        node.stream_ops = stream_ops;
        return node;
      },
  };
  function _CloseHandle(fh) { try { if (fh >= 3 && FS.streams[fh]) FS.close(FS.streams[fh]); } catch (e) {} return 1; }

  function _CloseWindow(){ return 0; }

  function _CoBuildVersion(){ return 0; }

  function _CopyFileA(){ return 0; }

  function _CreateDialogParamA(){ return 0; }

  
  
  function _CreateDirectoryA(namePtr, sa) {
      if (!namePtr) return 0;
      var path = UTF8ToString(namePtr).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
      if (!path) return 0;
      var parts = path.split('/'), sofar = '', made = 0;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] === '') { sofar = ''; continue; }        // leading slash: stay absolute
        sofar += '/' + parts[i];
        try { FS.mkdir(sofar); made = 1; }
        catch (e) { if (e && e.errno !== undefined && e.code !== 'EEXIST') { /* keep trying deeper */ } }
      }
      return made;   // Win32: non-zero on success, and "already exists" is not a failure we report
    }

  
  
  function TT_resolvePath(raw) {
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
    }
  
  function _CreateFileA(namePtr, access, share, sa, disp, flags, tmpl) {
      if (!namePtr) return -1;
      var raw = UTF8ToString(namePtr), write = (access & 0x40000000) !== 0;
      var path = write ? raw.replace(/\\/g, '/').replace(/\/+/g, '/') : TT_resolvePath(raw);
      if (!path) return -1;
      try { return FS.open(path, write ? 'w' : 'r').fd; } catch (e) { return -1; }
    }

  var TT_palettes = {
  next:1,
  map:{
  },
  };
  function _CreatePalette(logpal) {
      var n = HEAPU16[(logpal >> 1) + 1]; if (n > 256) n = 256;
      var bytes = new Uint8Array(1024);
      if (n > 0) bytes.set(HEAPU8.subarray(logpal + 4, logpal + 4 + n * 4));
      var h = TT_palettes.next++;
      TT_palettes.map[h] = bytes;
      return h;
    }

  function _CreateWindowExA() { return 1; }

  function _CryptAcquireContextA(){ return 0; }

  function _CryptCreateHash(){ return 0; }

  function _CryptDestroyHash(){ return 0; }

  function _CryptGetHashParam(){ return 0; }

  function _CryptHashData(){ return 0; }

  function _CryptReleaseContext(){ return 0; }

  function _DefWindowProcA() { return 0; }

  function _DeleteFileA(){ return 0; }

  function _DestroyWindow(){ return 0; }

  function _DialogBoxParamA(){ return 0; }

  function _DispatchMessageA(msgPtr) {
      if (!msgPtr) return 0;
      var b = msgPtr >> 2;
      if (Module['_tt_dispatch_to_wndproc']) Module['_tt_dispatch_to_wndproc'](HEAP32[b + 1], HEAP32[b + 2], HEAP32[b + 3]);
      return 0;
    }

  function _EmptyClipboard(){ return 0; }

  function _EndDialog(){ return 0; }

  function _EndPaint(){ return 0; }

  function _FileTimeToSystemTime(ftPtr, stPtr) {
      if (!ftPtr || !stPtr) return 0;
      var lo = HEAPU32[ftPtr >> 2], hi = HEAPU32[(ftPtr >> 2) + 1];
      var d = new Date((hi * 4294967296 + lo) / 10000 - 11644473600000);
      if (isNaN(d.getTime())) return 0;
      var w = stPtr >> 1;
      HEAPU16[w] = d.getUTCFullYear();   HEAPU16[w + 1] = d.getUTCMonth() + 1;
      HEAPU16[w + 2] = d.getUTCDay();    HEAPU16[w + 3] = d.getUTCDate();
      HEAPU16[w + 4] = d.getUTCHours();  HEAPU16[w + 5] = d.getUTCMinutes();
      HEAPU16[w + 6] = d.getUTCSeconds();HEAPU16[w + 7] = d.getUTCMilliseconds();
      return 1;
    }

  function _FindClose(){ return 0; }

  function _FindFirstFileA(){ return 0; }

  function _FindNextFileA(){ return 0; }

  function _FindResourceA(){ return 0; }

  function _FindWindowA(){ return 0; }

  function _FormatMessageA(){ return 0; }

  function _FreeLibrary() { return 1; }

  function _FreeResource(){ return 0; }

  function _GetAsyncKeyState(vk) {
      var k = globalThis.TT_keys;
      return (k && k[vk]) ? -32768 : 0;
    }

  function _GetClipboardData(){ return 0; }

  function _GetCurrentProcess(){ return 0; }

  function _GetCurrentProcessId(){ return 0; }

  function _GetCurrentThreadId(){ return 0; }

  function _GetCursorPos(ptr) {
      if (ptr) { HEAP32[ptr >> 2] = (globalThis.TT_mouse_x | 0); HEAP32[(ptr >> 2) + 1] = (globalThis.TT_mouse_y | 0); }
      return 1;
    }

  function _GetDC() { return 1; }

  function _GetDIBits(){ return 0; }

  function _GetDateFormatA(locale, flags, stPtr, fmtPtr, outPtr, cch) {
      if (!stPtr) return 0;
      var w = stPtr >> 1;
      var d = new Date(HEAPU16[w], HEAPU16[w + 1] - 1, HEAPU16[w + 3]);
      var DATE_LONGDATE = 0x2;
      var s;
      try {
        s = (flags & DATE_LONGDATE)
          ? d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : d.toLocaleDateString();
      } catch (e) { s = d.toDateString(); }
      var n = lengthBytesUTF8(s) + 1;
      if (!outPtr || cch === 0) return n;
      if (cch < n) return 0;
      stringToUTF8(s, outPtr, cch);
      return n;
    }

  function _GetDeviceCaps(hdc, index) {
      switch (index) { case 12: return 8; case 38: return 0x100; case 104: return 256;
                       case 24: return 20; case 8: return 1024; case 10: return 768;
                       case 14: return 1; default: return 0; }
    }

  function _GetDlgItemTextA(){ return 0; }

  
  
  
  function _GetFileAttributesA(namePtr) {
      if (!namePtr) return 0xFFFFFFFF;
      var r = TT_resolvePath(UTF8ToString(namePtr));
      if (!r) return 0xFFFFFFFF;
      /* FILE_ATTRIBUTE_DIRECTORY matters: set_tt_default_file_name compares == 0x10 to accept the
     * DefaultUser directory (Users/PlaygroundBookX with the retail BOK pages). */
      try { if (FS.isDir(FS.stat(r).mode)) return 0x10; } catch (e) {}
      return 0x80;
    }

  function _GetFileSize(fh, hiPtr) { var s = FS.streams[fh], sz = 0; if (s) { try { sz = FS.stat(s.path).size; } catch (e) {} } if (hiPtr) HEAP32[hiPtr >> 2] = 0; return sz >>> 0; }

  function _GetFocus(){ return 0; }

  function _GetLastError(){ return 0; }

  function _GetLocalTime(){ return 0; }

  function _GetMessageA(msgPtr, hwnd, minF, maxF) {
      var q = globalThis.TT_msgq, b = msgPtr >> 2;
      if (q && q.length) { var e = q.shift(); if (msgPtr) { HEAP32[b] = 0; HEAP32[b + 1] = e.message; HEAP32[b + 2] = e.wParam; HEAP32[b + 3] = e.lParam | 0; } return 1; }
      if (msgPtr) { HEAP32[b + 1] = 0; } // WM_NULL — keep the (rare) paused GetMessage loop alive, never WM_QUIT
      return 1;
    }

  function _GetModuleFileNameA(mod, buf, len) { var s = '/toontalk/tt.exe', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; }

  function _GetModuleHandleA() { return 1; }

  function _GetNearestPaletteIndex(){ return 0; }

  function _GetObjectA(){ return 0; }

  function _GetPaletteEntries(hpal, start, count, out) {
      var b = TT_palettes.map[hpal];
      if (!b || !out) return 0;
      if (start + count > 256) count = 256 - start;
      if (count <= 0) return 0;
      HEAPU8.set(b.subarray(start * 4, (start + count) * 4), out);
      return count;
    }

  function TT_readIniValue(fname, section, key) {
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
    }
  
  
  function _GetPrivateProfileIntA(section, key, def, file) {
      var v = TT_readIniValue(file ? UTF8ToString(file) : '', section ? UTF8ToString(section) : '', key ? UTF8ToString(key) : '');
      if (v === null) return def;
      var n = parseInt(v, 10); return isNaN(n) ? def : n;
    }

  
  function TT_writeCStr(buf, maxLen, s) {
      var n = 0;
      if (buf && maxLen > 0) { for (; n < s.length && n < maxLen - 1; n++) HEAPU8[buf + n] = s.charCodeAt(n) & 0xff; HEAPU8[buf + n] = 0; }
      return n;
    }
  
  
  function _GetPrivateProfileStringA(section, key, def, buf, size, file) {
      var v = TT_readIniValue(file ? UTF8ToString(file) : '', section ? UTF8ToString(section) : '', key ? UTF8ToString(key) : '');
      if (v === null) v = def ? UTF8ToString(def) : '';
      return TT_writeCStr(buf, size, v);
    }

  function _GetProcAddress(){ return 0; }

  function _GetProcessHeap(){ return 0; }

  function _GetShortPathNameA(){ return 0; }

  function _GetSystemMetrics(i) { return i === 0 ? 1024 : (i === 1 ? 768 : 0); }

  var TT_sysStatics = {
  0:[0,0,0],
  1:[128,0,0],
  2:[0,128,0],
  3:[128,128,0],
  4:[0,0,128],
  5:[128,0,128],
  6:[0,128,128],
  7:[192,192,192],
  8:[192,220,192],
  9:[166,202,240],
  246:[255,251,240],
  247:[160,160,164],
  248:[128,128,128],
  249:[255,0,0],
  250:[0,255,0],
  251:[255,255,0],
  252:[0,0,255],
  253:[255,0,255],
  254:[0,255,255],
  255:[255,255,255],
  };
  function _GetSystemPaletteEntries(hdc, start, count, lppe) {
      if (!lppe) return 0;
      for (var i = 0; i < count && start + i < 256; i++) {
        var idx = start + i, rgb = TT_sysStatics[idx] || [0, 0, 0];
        HEAPU8[lppe + i*4] = rgb[0]; HEAPU8[lppe + i*4 + 1] = rgb[1];
        HEAPU8[lppe + i*4 + 2] = rgb[2]; HEAPU8[lppe + i*4 + 3] = 0;
      }
      return Math.min(count, 256 - start);
    }

  function _GetSystemPaletteUse() { return 1; }

  function _GetTabbedTextExtentW(){ return 0; }

  function _GetTempPathA(len, buf) { var s = '/tmp/', i = 0; for (; i < s.length && i < len - 1; i++) HEAPU8[buf + i] = s.charCodeAt(i); HEAPU8[buf + i] = 0; return i; }

  function _GetTimeFormatA(locale, flags, stPtr, fmtPtr, outPtr, cch) {
      if (!stPtr) return 0;
      var w = stPtr >> 1;
      var d = new Date(2000, 0, 1, HEAPU16[w + 4], HEAPU16[w + 5], HEAPU16[w + 6]);
      var s;
      try { s = d.toLocaleTimeString(); } catch (e) { s = d.toTimeString(); }
      var n = lengthBytesUTF8(s) + 1;
      if (!outPtr || cch === 0) return n;
      if (cch < n) return 0;
      stringToUTF8(s, outPtr, cch);
      return n;
    }

  function _GetTimeZoneInformation(){ return 0; }

  function _GetVersionExA(info) {
      if (info) { HEAP32[(info >> 2) + 1] = 5; HEAP32[(info >> 2) + 2] = 1;
                  HEAP32[(info >> 2) + 3] = 2600; HEAP32[(info >> 2) + 4] = 2; }
      return 1;
    }

  function _GetWindowLongA(){ return 0; }

  function _GetWindowRect(h, r) { HEAP32[r >> 2] = 0; HEAP32[(r >> 2) + 1] = 0; HEAP32[(r >> 2) + 2] = 1024; HEAP32[(r >> 2) + 3] = 768; return 1; }

  function _GlobalAlloc(flags, size) { size = size || 1; var p = _malloc(size); if (p && (flags & 0x40)) HEAPU8.fill(0, p, p + size); return p; }

  function _GlobalFree(p) { if (p) _free(p); return 0; }

  function _GlobalLock(p) { return p; }

  function _GlobalMemoryStatus(ptr) {
      var MB256 = 256 * 1024 * 1024;
      HEAP32[(ptr >> 2) + 1] = 25;      /* dwMemoryLoad */
      HEAP32[(ptr >> 2) + 2] = MB256;   /* dwTotalPhys */
      HEAP32[(ptr >> 2) + 3] = MB256;   /* dwAvailPhys */
      HEAP32[(ptr >> 2) + 4] = MB256;   /* dwTotalPageFile */
      HEAP32[(ptr >> 2) + 5] = MB256;   /* dwAvailPageFile */
      HEAP32[(ptr >> 2) + 6] = MB256;   /* dwTotalVirtual */
      HEAP32[(ptr >> 2) + 7] = MB256;   /* dwAvailVirtual */
      return 1;
    }

  function _GlobalReAlloc(p, size, flags) { return _realloc(p, size || 1); }

  function _GlobalSize(){ return 0; }

  function _GlobalUnlock(p) { return 1; }

  function _HeapAlloc(){ return 0; }

  function _HeapFree(){ return 0; }

  function _ImmGetCompositionStringA(){ return 0; }

  function _ImmGetContext(){ return 0; }

  function _ImmReleaseContext(){ return 0; }

  function TT_isAlpha(c) {
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return 1;      /* A-Z a-z */
      if (c >= 0xC0 && c <= 0xFF && c !== 0xD7 && c !== 0xF7) return 1; /* À-ÿ minus × ÷ */
      if (c === 0x83 || c === 0x8A || c === 0x8C || c === 0x8E ||       /* ƒ Š Œ Ž */
          c === 0x9A || c === 0x9C || c === 0x9E || c === 0x9F) return 1; /* š œ ž Ÿ */
      return 0;
    }
  function _IsCharAlphaA(c) { return TT_isAlpha(c & 0xFF); }

  function _IsCharAlphaNumericA(c) { c &= 0xFF; return (c >= 48 && c <= 57) ? 1 : TT_isAlpha(c); }

  function _IsCharAlphaW(c) { return c > 255 ? 1 : TT_isAlpha(c); }

  function _IsCharUpperA(){ return 0; }

  function _IsClipboardFormatAvailable(){ return 0; }

  function _IsIconic(){ return 0; }

  function _LoadCursorA() { return 1; }

  function _LoadIconA() { return 1; }

  function _LoadLibraryA() { return 1; }

  function _LoadResource(){ return 0; }

  var TT_RES_STRINGS = {
  1:"Tooly from side",
  2:"Tooly from above",
  3:"a person walking",
  4:"a wire",
  5:"a helicopter flying",
  6:"a picture frame",
  7:"a helicopter landing",
  8:"a person sitting",
  9:"the tall house from above",
  10:"the tall house from side",
  11:"the door of the tall house",
  12:"the door of the big house",
  13:"a number pad",
  14:"a scale",
  15:"Dusty",
  16:"Pumpy",
  17:"a magic wand",
  18:"a thought bubble",
  19:"a robot",
  20:"a nest",
  21:"a bird",
  22:"a bomb",
  23:"a notebook",
  24:"a box",
  25:"a mouse with a hammer",
  26:"an arm",
  27:"a hand",
  28:"a hand holding a magic wand",
  29:"a bike pump button",
  30:"a head with hair",
  31:"a head with a hat",
  32:"a vacuum button",
  33:"a switch",
  34:"a person with a hat sitting",
  35:"a person with hair sitting",
  36:"the big house from side",
  37:"the big house from above",
  38:"the wide house from side",
  39:"the wide house from above",
  40:"the door to the wide house",
  41:"Marty",
  42:"a truck inside a house",
  43:"a truck from above",
  44:"a truck from side",
  45:"a talk balloon",
  46:"a magic wand button",
  47:"a text pad",
  48:"a notebook page turning",
  49:"a dizzy person",
  50:"a dizzy person with hair",
  51:"a dizzy person with a hat",
  52:"an explosion",
  53:"a door to a broken rocket",
  54:"the hit or miss cartoon",
  55:"a ball",
  56:"a paddle",
  57:"a person walking",
  58:"a flower",
  59:"a tree",
  60:"a traffic light",
  61:"a rectangle",
  62:"a picture from a file",
  63:"a rocket",
  64:"wall of a room",
  65:"left corner of a room",
  66:"right corner of a room",
  67:"a wall",
  68:"door from inside a room",
  69:"a background",
  129:"the robot's hand",
  130:"your hand",
  132:"the robot is",
  134:"you are",
  135:"Page",
  136:"contains ",
  161:"a text pad with anything on it",
  162:"a blank text pad",
  163:"a pad with the text",
  164:"on it",
  165:"nothing",
  166:"a robot that doesn't have a thought",
  167:"first",
  168:"second",
  169:"third",
  170:"fourth",
  171:"fifth",
  172:"sixth",
  173:"You are pointing to ",
  174:"You are holding ",
  175:"Under ",
  176:" is ",
  178:"the right mouse button",
  193:"The egg in the nest will hatch when you set the nest down. ",
  195:"You can take ",
  196:"things",
  197:" out of her nest by hand or by using Dusty the Vacuum. ",
  198:"You can put a rectangular thing in her nest by dropping it there. ",
  199:"I usually let the bird do this instead. ",
  200:"I've said all I know about nests. ",
  201:"I use birds and nests when I want robots in different houses to work together. ",
  202:"If you want me to repeat all I know about nests, then press F1 twice while pointing to a nest. ",
  203:"I'll tell you more about birds if you press F1 twice while pointing to a bird. ",
  209:"If you give the bird something rectangular, she'll take it to her nest. ",
  210:"If you want her to carry other things, put them in a box and give her the box. ",
  211:"I've told you all that I know about birds. ",
  212:"If you want me to repeat all I know about birds, then press F1 twice while pointing to a bird. ",
  213:"I'll tell you more about nests if you press F1 twice while pointing to a nest. ",
  215:" on top",
  216:"the bird was given something containing her nest",
  225:"You can blow up this house by clicking on ",
  226:"When holding a bomb inside a house, you can blow up the house by clicking on ",
  227:"You and your tools will make it out OK, and Dusty will suck up everything left on the floor. ",
  228:"You can set it down safely by clicking on ",
  229:"You can train this robot to blow up the house he's in by clicking on ",
  230:"When training a robot that has picked up a bomb, you can have him blow up the house he's in by clicking on ",
  231:"This will end the robot's training. ",
  232:"I always put a robot trained to use a bomb into the notebook before testing it. ",
  233:"I've told you all I know about bombs. ",
  234:"If you want me to repeat all I've told you about bombs, just push F1 twice. ",
  241:"he tried to put something in a box that can't be put in boxes",
  242:"If a robot has a blank box in his thought bubble, then he'll be happy to work on any box no matter how many holes it has. ",
  244:"It is a blank box which can match any box. ",
  245:"You can put something in an empty hole of a box by letting go of it over the hole. ",
  246:"You can take something out of a hole with ",
  247:" or with Dusty. ",
  248:"It will wiggle when it's ready. ",
  249:"You can combine two boxes by dropping one on the side of another. ",
  250:"You can change the number of holes by pressing a number from 0 to 9. ",
  251:"If you want a box with more than 9 holes drop one on the side of another. ",
  252:"If you press '+' a hole will be added. ",
  253:"If you press '-' (minus) the hole on the right will be removed. ",
  254:"You can use the keyboard to change the number of holes while you are holding a box. ",
  255:"You can add a label to a hole by pointing just below it and typing. ",
  256:"I've told you all that I know about boxes. ",
  257:"If you want me to repeat all I've told you about boxes, then press F1 twice while pointing to a box. ",
  258:"any box",
  259:"a box with ",
  260:"one hole",
  261:" holes",
  264:"hole labeled with ",
  266:"hole contains ",
  273:"And",
  289:"move to",
  293:"grab a magic wand",
  295:"use the magic wand on",
  297:"grab a bike pump",
  299:"release the magic wand",
  301:"pick up",
  303:"drop",
  304:" on the floor",
  305:"drop",
  306:" on",
  307:"drop",
  308:" just left of",
  309:"drop",
  310:" just right of",
  311:"use Pumpy",
  312:" for",
  313:"grab a copy of Dusty",
  315:"use Dusty to vacuum",
  317:"run Dusty in reverse to restore",
  319:"release Dusty",
  321:"push",
  323:"release the nest and watch a bird hatch",
  325:"give",
  326:" to the bird",
  327:"drop",
  328:" into the truck",
  329:"blow up the house he's in",
  331:"use",
  335:"add",
  337:"push",
  339:"pick up",
  341:"switch to working on",
  343:"use the magic wand on",
  345:"use Dusty to vacuum",
  347:"use",
  349:"drop Pumpy",
  353:"his box",
  355:"the magic wand",
  356:"Dusty",
  357:"the stack of numbers",
  358:"the stack of text",
  359:"the stack of boxes",
  360:"the stack of nests",
  361:"the stack of trucks",
  362:"the main notebook",
  363:"the stack of robots",
  364:"the stack of scales",
  365:"the stack of bombs",
  366:"what he is holding",
  367:"Pumpy",
  369:" which is",
  370:"a number",
  371:"a text pad",
  372:"a box",
  373:"a nest",
  374:"a truck",
  376:"a robot",
  377:"a scale",
  378:"a bomb",
  379:" the last thing he made or found",
  401:"Bye!",
  402:"So long. ",
  403:"See you. ",
  404:"Good. ",
  405:"OK. ",
  406:"Right. ",
  407:"OK, here's all I know about ",
  408:"You can sit down by clicking any mouse button. You can get up again by pressing the 'Escape' button (labeled 'Esc' in the upper corner of your keyboard). ",
  409:"I'll stay around to help you. If I bother you, just push the F1 button and I'll go. ",
  410:"If I'm gone, then F1 will call me back. ",
  411:"Did you know that you can get up from the floor by pushing the 'Escape' button? ",
  412:"Try it sometime. ",
  413:"When you are done, just press the 'Escape' key to return to the floor. ",
  414:"Did you know that animations in progress will finish if you press F7? ",
  415:"That even includes my talking! ",
  416:"If you ever want to pause ToonTalk, just push the Pause button. ",
  418:"If you want me to tell you all I can about something, then get rid of me by pressing F1, point to or grab what you want, and push F1 again. ",
  419:"Hi",
  420:"Howdy",
  421:"Hello",
  422:"Hi there",
  423:"Greetings",
  424:"Hello there",
  425:"Marty here. ",
  433:"Bammer the Mouse had troubles with her hammer",
  450:"the number would get too large for the computer",
  451:"the number would get too small for the computer",
  452:"the number would get too big or small for the computer",
  466:"a remote control for ",
  467:"any number",
  468:"a blank number pad",
  469:"the number ",
  470:"something which will multiply by ",
  471:"something which will divide by ",
  472:" and just keep the remainder",
  473:"something which will change the number it is dropped on to ",
  474:"something which will OR the bits of the number underneath with ",
  475:"something which will AND the bits of the number underneath with ",
  476:"something which will EXCLUSIVE OR the bits of the number underneath with ",
  477:"the operation ",
  478:"You can use blank number pads inside of thought bubbles, so the robot will be happy with any number on a pad. ",
  480:"A blank number means it is any number. ",
  481:"You can add two numbers by dropping one on another. ",
  482:"You can type a number. ",
  484:"You can also type a number while holding a number. ",
  486:"You can remove digits by pushing the 'Backspace' key. ",
  487:"If you remove the last digit you'll get 0. ",
  488:"You can change ",
  489:" into ",
  490:" by pushing the minus key (right of 0). ",
  491:"Then, if you drop ",
  492:" on another number, you'll be subtracting by ",
  493:"You can multiply by ",
  494:" by pushing the x key. ",
  495:"Then you just drop it on the number you want to multiply by ",
  496:"The X and * keys work just as well. ",
  497:"You can divide by ",
  498:" by pushing the / key (lower right corner). ",
  499:"Then you just drop it on another number. ",
  500:"The remainder is ignored. ",
  501:"Since the number is zero, the division won't work. ",
  502:"To get the remainder (and ignore the dividend) use the % key (shift 5). ",
  504:"To get the remainder of dividing by ",
  505:" type % (push shift and 5). ",
  506:"Then you just drop it on the other number. ",
  507:"Here's a really advanced thing. ",
  508:"You can treat a number like a bunch of bits that are either 0 or 1. ",
  509:"This number is ",
  510:"Here's what you can do. ",
  511:"~ for complement. | for OR. & for AND.",
  512:"Don't worry if you don't know what these are. Just try them. ",
  513:"I've told you all that I know about numbers. ",
  514:"If you want me to tell you again all I know about numbers, then press F1 twice while pointing to a number. ",
  561:"You can flip to the next page by pushing the '+' or space button. ",
  562:"You can flip to the previous page by pushing the '-' (minus) button. ",
  563:"Since it's on the first page,",
  564:"If the notebook is on the first page,",
  565:" pushing the '-' (minus) button will turn to the last page. ",
  566:"You can flip to a page by typing the page number. ",
  567:"You can store anything you make on a blank page. ",
  568:"Just drop something on a blank page and it'll turn into a huge stack of copies. ",
  569:"Anything you add to a notebook will be there even if you restart the computer. ",
  570:"Dusty can remove things you no longer want. ",
  571:"Why not turn to a blank page and try it? ",
  572:"Dusty can remove things from a notebook. ",
  573:"You can call him by pressing the F2 button. ",
  574:"If you remove a page by mistake, Dusty can spit it out and you can put it back. ",
  575:"I usually use the left pages for text or pictures that describe the right side. ",
  576:"Just drop some text or a picture there. ",
  577:"You can quickly find a page by dropping the same text or picture later. ",
  578:" is blank so you can drop something there. ",
  579:"A neat way of coming back to page ",
  580:" is by dropping ",
  581:" on the notebook. ",
  582:"You can flip to a page with something on it and try it. ",
  583:"You can flip to a page with text on it by dropping a pad with the same text on the notebook. ",
  584:"If you drop text, you usually don't need to type the whole thing. ",
  585:"Only enough to find the page. ",
  586:"You can also flip to a page by dropping a number pad on a page with something on it. ",
  587:"When you press the F4 button, your notebook will fly to you. ",
  588:"I've told you all that I know about notebooks. ",
  589:"If you want me to repeat all I know about notebooks, then press F1 twice while pointing to a notebook. ",
  590:"a notebook",
  591:"It stores everything including other notebooks",
  592:"This notebook is full of pictures",
  593:"This notebook is full of useful sensors and remote controls",
  594:"It is full of sample programs",
  595:"It is stored in the file ",
  596:" pages",
  597:"It contains remote controls for ",
  598:"Blank\rNotebook",
  599:"This notebook lives in the tool box. Any changes you make to it will remain even if you turn off the computer",
  609:"Pictures",
  610:"Sensors",
  625:"Rectangle",
  626:"Ball",
  627:"Paddle",
  628:"Person\rWalk",
  629:"Person\rDizzy",
  630:"Person\rDizzy",
  631:"Person\rDizzy",
  632:"Person\rSit",
  633:"Person\rSit",
  634:"Person\rSit",
  635:"Toolbox",
  636:"Helicopter",
  637:"Landing",
  638:"Explosion",
  639:"Bomb",
  640:"House\rSide",
  641:"House\rTop",
  642:"House\rSide",
  643:"House\rTop",
  644:"House\rSide",
  645:"House\rTop",
  646:"Robot",
  647:"Nest",
  648:"Bird",
  649:"Mouse",
  650:"Vacuum",
  651:"Pump",
  652:"Wand",
  653:"Martian",
  654:"Rocket",
  655:"Truck",
  656:"Truck",
  657:"Truck",
  658:"Bubble",
  659:"Balloon",
  660:"Button",
  661:"Pad",
  662:"Notebook",
  663:"Frame",
  664:"Arm",
  665:"Hand",
  666:"Hand",
  667:"Switch",
  668:"Wire",
  669:"Flower",
  670:"Tree",
  671:"Traffic\rLight",
  672:"Oval",
  673:"Rounded\rRectangle",
  674:"Line\rup",
  675:"Line\rdown",
  676:"Hollow\rOval",
  677:"Hollow\rRounded\rRectangle",
  678:"Dotted\rLine Up",
  679:"Dotted\rLine Down",
  680:"Hollow\rRectangle",
  693:" pictures on top",
  694:" with one picture on top",
  698:"on the back",
  701:"a flipping picture",
  702:"the flip side of ",
  704:"Blank pictures are useful inside of thought bubbles. ",
  705:"The robot with a blank picture in his thought bubble will be happy with any picture in the same hole in his box. ",
  706:"Did you know that you can combine two pictures by dropping one picture on another? ",
  709:"You can remove a picture from a picture by using Dusty the Vacuum. ",
  710:"You can call Dusty to you by pressing the F2 button. ",
  711:"This picture is really ",
  712:"You can switch between them ",
  713:"Some pictures can be changed ",
  714:"by pressing the '+' or '-' (minus) button when selected or held. ",
  715:" movies",
  716:"This picture is a colored geometric shape. ",
  717:"Some pictures are colored geometric shapes. ",
  718:"You can change the color by pushing the '+' or '-' key. ",
  719:"Pumpy the Bike Pump can grow, shrink, and stretch pictures. ",
  720:"You can call for him by pressing the F3 button. ",
  721:"You can give this a toss by pressing ",
  722:"You can toss a picture by pressing ",
  725:"You can flip a picture over by pressing ",
  727:" when you are holding a picture. ",
  728:"You can flip a picture back over by pressing ",
  729:" again",
  730:" when you are holding a flipped picture. ",
  734:"Robots can work on the back of pictures. ",
  735:"Just drop them on the back. And boxes for them to work on too. ",
  736:"The robots will start working when you flip the picture back over and drop it. ",
  737:"That's how I make \"smart\" pictures that can bounce, explode, grow, or whatever I program them to do. ",
  738:"You can remove things from the back of a picture with your hand or with Dusty. ",
  739:"I've told you all that I know about pictures. ",
  740:"If you want me to repeat all I've told you about pictures, then press F1 twice while pointing to a picture. ",
  741:"you can't change a scale by clicking mouse buttons",
  786:"You can grab",
  787:"by clicking",
  789:"You can drop",
  801:"the text is already empty",
  802:"the text is too long",
  804:"Blank text pads are useful inside of thought bubbles. ",
  805:"The robot with a blank text pad in his thought bubble will be happy with any text on a pad in the same hole in his box. ",
  806:"You can add letters to that text pad by typing a letter. ",
  807:"You can also add letters while ",
  808:" holding a text pad. ",
  809:"You can remove letters by pushing the 'Backspace' key. ",
  810:"You can make the text go on another line by pressing the 'Enter' key. ",
  811:"You can combine two text pads by dropping one on another. ",
  812:"If you drop a number on this, it'll be added to the last letter. ",
  813:"For example, if you drop ",
  814:" onto this, you will get '",
  815:"'. ",
  816:"If you drop a number on a text pad, it'll be added to the last letter. ",
  817:"For example, dropping 2 on ABC will result in ABE. ",
  818:"I've told you all that I know about text pads. ",
  819:"If you want me to tell you again all I know about text pads, then press F1 twice while pointing to a text pad. ",
  820:"the number is bigger than the number of letters on the text pad",
  833:"empty thought bubble",
  834:"thought bubble containing ",
  851:"Pumpy the Bike Pump",
  852:"Pumpy",
  853:"Pumpy can make things big or small, tall or short, and wide or thin. ",
  854:"If you hold down ",
  855:"Pumpy will make",
  868:"If you ever want Pumpy to jump into ",
  869:" just call him by pressing the F3 button. ",
  870:"He'll really hurry if you push F3 twice. ",
  871:"I've told you all I can about Pumpy. ",
  872:"I'll tell you all I've told you about Pumpy over again if you press F1 twice while holding Pumpy. ",
  873:"Dusty the Vacuum",
  874:"Dusty",
  875:"Dusty can restore ",
  876:"the last thing sucked up",
  877:"if you click on",
  878:" ",
  879:"Dusty will erase ",
  880:"something under his nose",
  881:"if you click on",
  882:"If, while holding him, you click on ",
  883:" Dusty will suck up ",
  885:"what's under him. ",
  890:"If you ever want Dusty to come and run into ",
  891:" just push the F2 button. ",
  892:"If you push F2 twice he'll come really fast. ",
  893:"I've told you all I know about Dusty. ",
  894:"I sometimes use him to move things between houses. ",
  895:"If you want me to tell you all about Dusty over again, just press F1 twice. ",
  896:"You can copy ",
  897:"what is under the tip of the wand",
  898:" by clicking on ",
  899:"You can set down ",
  900:"what you copy",
  901:" by clicking on",
  902:"A second click will set the wand down. ",
  903:"If you ever want the magic wand to float into ",
  904:" just call it by pressing the F5 button. ",
  905:"It'll really hurry if you push F5 twice. ",
  906:"That's about all I can tell you about magic wands. ",
  907:"If you want me to repeat all I've told you about wands, just push F1 twice. ",
  913:"After you load up a truck with a robot and box for him to work on, the truck's crew will drive off and build a new house. ",
  914:"If you drop a robot or a team of robots on the truck, they'll be put on the floor of the new house. ",
  915:"If you drop a box on the truck, it'll be put on the floor of the new house. ",
  916:"If you drop a picture of a house on the truck, then the truck's crew will build a house that looks like that. You can find pictures of houses in the notebook on page 2 of the main notebook. ",
  917:"If you drop an Avenue number or Street number on the truck, the truck's crew will build a house as close to that address as they can. If you don't give them an address they'll build it as near by as possible. ",
  918:"You can find the address of the house you're in, in the notebook on page 4 of your notebook. An address will change if you drop a number on it. ",
  919:"If you drop a robot or line of robots on the truck, the crew will put the robots on the floor of the new house and give them the box from the truck. ",
  920:"You can take stuff out of a truck by hand or with Dusty's help. ",
  921:"I've told you all I that I know about trucks. ",
  922:"If you want me to repeat all I've told you about trucks, then press F1 twice while pointing to a truck. ",
  929:"(c) 1992-2007. Ken Kahn. All rights reserved.",
  931:"To use Dusty move his mouth over something. ",
  932:"Examples",
  933:"... I've said enough",
  945:"a scale tipped to the left",
  946:"a scale tipped to the right",
  947:"a balanced scale",
  948:"a tottering scale",
  949:"Scales can be used to compare things. ",
  950:"To try it out connect three boxes together. Then put a scale in the middle hole. ",
  951:"Drop numbers in the holes next to the scale and watch how the scale tilts. ",
  952:"It works to compare text too. ",
  953:"If a scale is tottering, you can change which way the scale tilts by pressing the space button. ",
  961:"Here's what I do when I want to teach a robot something. ",
  962:"I start by giving him the kind of box I want him to work on. ",
  963:"The robot will then imagine a world with just that box and Tooly the Toolbox and friends in it. ",
  964:"I then make the robot do whatever I want him to do. Like change the box or load up a truck. ",
  965:"When I'm done, I press the 'Escape' button and the robot can now repeat what I taught him. ",
  966:"This robot will only accept ",
  967:"A robot will only accept a box if it matches his thoughts. ",
  968:"You can make him less fussy by using Dusty to remove things from his thought bubble. ",
  969:"Anything in his thoughts has to be in the box before he'll work on it. ",
  970:"But if his thought bubble is missing anything, then he'll be happy with anything in the same place in the box. ",
  971:"I usually try out a robot after training him. ",
  972:"Just drop a box on him that he'll like and watch him go. ",
  973:"If you want to stop him, just grab him. Or to stop all robots press F8. ",
  974:"After I've tested a robot, I usually save him by dropping him in a notebook. ",
  975:"Often I want lots of robots working for me. ",
  976:"It would get too messy to have them all running around on the floor. ",
  977:"So I send them off to brand new houses by dropping them in trucks. ",
  978:"Robots are pretty stupid. ",
  979:"They can only think about one thing. ",
  980:"They can only do the one thing you trained them to do. ",
  981:"Luckily a TEAM of robots can do pretty much anything. ",
  982:"If I drop a robot on another robot, he'll get in line behind the other. ",
  983:"If a robot doesn't like a box he's been given, then he'll give it to the robot behind him. ",
  984:"The first robot in line to like a box will work on it. ",
  985:"And when he's done, he'll give it back to the first robot in line. He'll give it to himself if he's working alone. ",
  986:"If you look in your notebook on page 6, you'll find a notebook full of robot teams I've trained. ",
  987:"That's pretty much all that I can think of to tell you about robots. ",
  988:"If you want me to repeat all I know about robots, press F1 twice while pointing to a robot. ",
  993:"a robot busy doing what he was trained to do",
  994:"a robot on the back of a picture. He is waiting for the picture to be flipped back over",
  995:"a robot waiting for another robot to finish",
  996:"He has been trained to",
  997:"a robot waiting for something to appear in",
  998:" his box",
  999:"Then he will ",
  1002:"There are more robots, but I've said enough. ",
  1009:"It didn't work because ",
  1010:"The robot stopped because ",
  1011:"A robot somewhere named",
  1025:"Helicopter",
  1026:"Bird\rHatch",
  1027:"Bird\rFly",
  1028:"Truck\rEngine",
  1029:"Magic",
  1030:"Be Whop",
  1031:"Be Yaw",
  1032:"Spiral\rIn",
  1033:"Spiral\rOut",
  1034:"Book\rDrop",
  1035:"Door\rCreak",
  1036:"Vacuum",
  1037:"Explosion",
  1038:"Hand\rPump",
  1039:"Ouch",
  1040:"Plop",
  1041:"Pop",
  1042:"Indoors\rstep",
  1043:"Typing",
  1044:"Traffic\rsounds",
  1045:"Page\rTurning",
  1047:"Neat\rEffect",
  1048:"Truck\rDrive",
  1049:"Bike\rBell",
  1050:"Boing",
  1053:"Calculating",
  1054:"Lots Of\rSilly Sounds",
  1055:"Whit",
  1056:"Deflating",
  1057:"Door",
  1061:"Outdoors\rstep",
  1062:"Glass\rHigh",
  1063:"Glass\rLow",
  1067:"Shutdown",
  1068:"Spit",
  1069:"Switch",
  1070:"Teleport",
  1072:"Twing",
  1083:"you can't add pictures to the backside of a picture",
  1084:"you can't add that to the backside of a picture",
  1085:"he had problems finding something",
  1086:"he tried to release something he wasn't holding",
  1087:"he had problems releasing something",
  1088:"a robot without a thought bubble",
  1089:"a robot who wants ",
  1090:"If given a box like that he will ",
  1091:"Otherwise, he'll give the box to the robot behind him in line. ",
  1099:"This number is a remote control for ",
  1100:"The number is a color numbered from 0 to 255. ",
  1101:"The number selects which picture is displayed. ",
  1102:"The number is",
  1103:"If you change the number, then ",
  1104:" will change accordingly. ",
  1105:"You can change remote controls just like ordinary numbers. ",
  1106:"This number is a sensor for ",
  1107:"You can't change it like ordinary numbers. ",
  1108:"When I want it to stop changing, I usually drop it on a 0. ",
  1109:"This movie shows whether ",
  1110:" is colliding with something else. ",
  1111:"This is a picture of what ",
  1112:" is colliding with. It is black if there is no collision. ",
  1113:"Since ",
  1114:" is flipped, you'll have to flip it back to try this out. ",
  1131:"what he just copied",
  1133:"what he's holding",
  1147:"the distance from the left side",
  1148:"the distance from the bottom side",
  1149:"the speed towards the right",
  1150:"the speed towards the top",
  1151:"the width",
  1152:"the height",
  1153:"which picture or color is shown",
  1154:"the detector which shows a simple cartoon of either a collision or a miss. You can turn a collision into a miss by pointing to the detector and pressing +",
  1155:"the display of what is colliding with this picture",
  1156:"the answer to the question \"Has my animation stopped?\"",
  1157:"the answer to the question \"Am I being held?\"",
  1158:"the answer to the question \"Am I wiggling because a hand is pointing to me?\"",
  1159:"the answer to the question \"Was I just dropped?\"",
  1160:"the left/right movement collision detector",
  1161:"the up/down movement collision detector",
  1162:"the looks",
  1163:"the visibility",
  1164:"the answer to the question \"What pictures are stuck on top of me?\"",
  1165:"the answer to the question \"What picture am I stuck on top of, and what picture is that stuck on, and so on?\"",
  1168:"whether the mouse's left button was just clicked",
  1169:"whether the mouse's middle button was just clicked",
  1170:"whether the mouse's right button was just clicked",
  1171:"whether the mouse's left button is down",
  1172:"whether the mouse's middle button is down",
  1173:"whether the mouse's right button is down",
  1174:"the key just pressed",
  1175:"the last key pressed",
  1176:"whether the shift key is down",
  1177:"whether the control key is down",
  1178:"whether your hand is hidden",
  1179:"the clipboard for pasting stuff to and from other programs",
  1180:"which avenue (runs north/south) this house is on",
  1181:"which street (runs east/west) this house is on",
  1182:"whether sound effects are on",
  1183:"the size of letters in my talk balloons (100 is normal)",
  1184:"how long I say something before changing what's in my talk balloon (100 is normal)",
  1185:"how talkative I am",
  1186:"whether you have a hat, long hair or are bald",
  1187:"the window size",
  1188:"the speed things happen in ToonTalk (100 is normal)",
  1189:"the size of the city",
  1190:"the number of milliseconds, if possible, each animation frame should take",
  1191:"whether the right and middle button have special meanings when on the floor",
  1192:"which serial port a HyperBot controller is connected to",
  1193:"the letter style used in my talk balloons",
  1194:"a place to drop a file name or URL to turn it into a ToonTalk object or picture",
  1195:"a place to drop the file name of a sound to hear it",
  1197:"whether I speak, show word balloons, or both",
  1198:"the speed the computer's mouse is moving to the right",
  1199:"the speed the computer's mouse is moving to the top",
  1200:"the number of milliseconds (one thousandths of a second) since last frame",
  1201:"a random number between 0 and 999",
  1202:"a place to drop text for Media Control Interface",
  1203:"a place to drop text to hear it spoken",
  1204:"adding and removing decoration to the wall",
  1205:"adding and removing decoration to the front of the house",
  1206:"adding and removing decoration to the roof",
  1207:"what language ToonTalk is using",
  1211:"the amount a joystick is moved to the left or right",
  1212:"the amount a joystick is moved to the top or bottom",
  1213:"the amount a joystick is moved forward or backward (this is often the throttle control) or zero if it doesn't sense this",
  1214:"the amount a joystick is rotated left/right, or zero if it doesn't sense rotation",
  1215:"the amount a joystick is rotated up/down, or zero if it doesn't sense rotation",
  1216:"the amount a joystick is rotated forward/backward, or zero if it doesn't sense rotation",
  1217:"the answer to the question \"Was button number",
  1218:"just clicked?\"",
  1219:"the answer to the question \"Is button number",
  1220:"down?\"",
  1221:"of joystick number",
  1233:"Right",
  1234:"Up",
  1235:"Right Speed",
  1236:"Up Speed",
  1237:"Width",
  1238:"Height",
  1239:"Picture #",
  1240:"Collide?",
  1241:"Touching Who?",
  1242:"Finished?",
  1243:"Held?",
  1244:"Selected?",
  1245:"Dropped?",
  1246:"Right Collide?",
  1247:"Up Collide?",
  1248:"Looks",
  1249:"Visible?",
  1250:"Parts",
  1251:"Containers",
  1254:"Left click",
  1255:"Middle click",
  1256:"Right click",
  1257:"Left down",
  1258:"Middle down",
  1259:"Right down",
  1260:"Key",
  1261:"Last Key",
  1262:"Shift down",
  1263:"Control down",
  1264:"Hand?",
  1265:"Clipboard",
  1266:"Avenue",
  1267:"Street",
  1268:"Sound?",
  1269:"Letter size",
  1270:"Talk speed",
  1271:"Marty talk",
  1272:"Your head",
  1273:"Window size",
  1274:"ToonTalk speed",
  1275:"City size",
  1276:"Frame duration",
  1277:"Mouse buttons",
  1278:"Serial port",
  1279:"Marty's font",
  1280:"Object in",
  1281:"Sound in",
  1283:"Marty Talks",
  1284:"Mouse right",
  1285:"Mouse up",
  1286:"Timer",
  1287:"Random",
  1288:"MCI",
  1289:"Speech",
  1290:"Room",
  1291:"House",
  1292:"Roof",
  1293:"Language",
  1297:"X Speed",
  1298:"Y Speed",
  1299:"Z Speed",
  1300:"X Axis",
  1301:"Y Axis",
  1302:"Z Axis",
  1351:"an empty nest",
  1352:"a nest covered with ",
  1353:"and",
  1354:"Warning: a bird tried to remove a stack from an empty nest. ",
  1355:"a nest with an egg in it",
  1356:"the stack of nests won't accept anything",
  1357:"the nest won't accept anything",
  1358:"the bird is too busy to accept anything",
  1359:"the bird only accepts things that are rectangular",
  1361:"the bird's nest is inside a vacuum",
  1362:"the bird's nest is inside a thought bubble",
  1363:"A bird wants to fly to her nest but she can't find it. ",
  1364:"A bird tried to return to a box hole but it's not empty. ",
  1365:"the box did not accept something dropped on it",
  1366:"Ignored dropping a box into box since there is already a box inside a box inside a box inside a box and so on. ",
  1367:"only a blank box can accept text or numbers",
  1368:"Oh boy! Somehow trying to put a box into itself",
  1369:"robot thought he would have a box to add to another box but has something else instead",
  1370:"If you drop a number or text on a blank box, the box will expand the text to have one letter per hole. ",
  1371:"You can use Dusty, the vacuum, to make a blank box. ",
  1372:"you can't add to the box's label",
  1373:"something wrong with ToonTalk. It is trying to figure out size of something in a box hole that is empty",
  1374:"something is wrong. ToonTalk was looking for a hole that a box doesn't have",
  1375:"something is wrong with ToonTalk because it tried to remove something from a box that isn't in a box",
  1376:"A box label in a notebook cannot be longer than 255 characters. ",
  1377:"Something wrong with a description of a box. ",
  1378:"ToonTalk problem. ToonTalk just tried to add something to a background that it was already part of. ",
  1380:"Problem with ToonTalk since it tried to remove the last part of something that didn't have any parts left. ",
  1381:"bombs don't accept anything",
  1383:"ToonTalk had troubles reading a notebook file. A robot in the notebook has lost his training. ",
  1384:"... Ah, sorry but I'm having troubles figuring out what this robot does. ",
  1385:"do nothing",
  1386:"use Dusty to erase",
  1387:"use the magic wand, while holding the control button down, on",
  1388:" while pointing to",
  1389:" after moving to",
  1390:" to the label of",
  1398:"what's on",
  1399:"what's in",
  1400:"page",
  1402:"couldn't find something he was going to pick up. ",
  1403:"couldn't find a nest he was going to pick up. ",
  1404:"couldn't find the place he was going to do something. ",
  1405:"was trained to give a bird something and now the bird isn't where he expected. He'll try to keep going anyway. ",
  1406:"Robot expected a box and found something else instead. ",
  1407:"ToonTalk confused! It couldn't find something. Sorry. ",
  1410:"was going to use something but it has been vacuumed up!",
  1411:"was going to put something into something but it has been vacuumed. ",
  1412:"was going to put something into something but it is not in the room any more. ",
  1413:"expected to find something in a notebook and didn't. ",
  1414:"expected to find a box or filled nest and didn't",
  1415:"Robot can't remember more than 254 holes. Sorry. ",
  1416:"empty text pad",
  1417:"You are now in the robot's thought bubble. ",
  1418:"You can train the robot by showing him what to do. ",
  1419:"To test the robot, just give him a box like the one in his thought bubble. ",
  1421:"any mouse button",
  1422:"the left mouse button",
  1423:"the middle mouse button",
  1424:"the right button while holding down the control button (labeled 'Ctrl')",
  1425:"any mouse button while holding down the control button (labeled 'Ctrl')",
  1426:"You managed to destroy all the houses, so I built some more. ",
  1427:"Something wrong inside ToonTalk. Houses may be missing. ",
  1428:"Command line problem. Expecting an even number of items, not ",
  1429:" items. Ignoring the command line. ",
  1430:"Command line has -h ",
  1431:" and it can only be -h 0 (bald), -h 1 (hair), or -h 2 (hat). ",
  1432:" is wrong number of mouse buttons. 1, 2, or 3 is OK. ",
  1433:"Command line has unrecognized option: ",
  1434:"I didn't get your name so for now I'll call you",
  1435:"Despite these troubles getting started do you want to continue?",
  1436:"ToonTalk has been running so long, it is resetting its internal clock. ",
  1437:"Sorry, ran out of memory. You'll have to restart. ",
  1438:"Memory low. Recycling 20% of memory used to speed things up. ",
  1439:"Memory low. Recycling last part of memory used to speed things up. ",
  1440:"If you ever want to stop all the robots just push F8 to cut off the power. ",
  1441:"Pushing it again will start them up again. ",
  1442:"Same thing with moving pictures and movies. ",
  1443:"Uh, excuse me. ",
  1444:"Umm, sorry to interrupt. ",
  1445:"Uh, sorry. ",
  1446:"A robot on the back of a picture named",
  1447:"A robot on the floor named",
  1448:"Bammer the Mouse didn't come out because ",
  1449:"the truck didn't drive away to build a house because ",
  1450:"the stack of numbers would not accept something",
  1451:"the number did not accept something",
  1452:"the number underneath the box is negative",
  1453:"the number underneath the box is larger than the number of holes",
  1454:"you can only drop numbers on numbers, text pads, or notebooks",
  1455:"the number on top is blank",
  1456:"you can't divide by zero",
  1457:"which has been combined with",
  1458:",",
  1459:"while holding down the shift button",
  1460:"If you drop something on a blank number, it will be converted to a number if possible. ",
  1461:"If you type '=' and then drop this on another number, it'll become",
  1462:"You can use Dusty, the vacuum, to make a blank number. ",
  1463:"If you press",
  1464:"while holding a number, it will flip over. ",
  1465:"Pressing it again will flip it back. ",
  1466:"Sensor had a problem doing arithmetic because ",
  1467:"The number that made trouble was removed. ",
  1468:"minus",
  1469:"a sensor",
  1470:"a remote control",
  1471:"for",
  1472:"And it was combined with",
  1473:"sensor is underneath",
  1474:"can't change the value of a sensor",
  1475:"NoName",
  1476:"and save anything you do under that name. ",
  1477:"bald",
  1478:"long hair",
  1479:"hat",
  1480:"no mouse\rshortcuts",
  1481:"right button\rshortcut",
  1482:"middle & right\rbuttons shortcuts",
  1483:"Full Screen",
  1484:"is colliding on the side with something. ",
  1485:"is colliding with the top or bottom of something else. ",
  1486:"If you change the appearance of this picture, then ",
  1487:"will change the same way. ",
  1488:"This is for controlling whether",
  1489:"is visible, partly visible, or invisible. ",
  1490:"Typing '+' or '-' (minus) will change between them. ",
  1491:"This tells us whether the animation of",
  1492:"is finished. ",
  1493:"This shows whether your hand is visible. ",
  1494:"The '+' button while pointing to it will switch it on and off. ",
  1495:"This shows whether ToonTalk sound effects will be made. ",
  1496:"This changes what the middle and right mouse buttons do when you are on the floor. ",
  1497:"You can make the right mouse button be a shortcut for shift and click. ",
  1498:"And you can make the middle button be a shortcut for control and click. ",
  1499:"This text pad is",
  1500:"This is",
  1501:"You can turn a collision into a miss by pointing to the detector and pressing +. ",
  1502:"This one is full of sounds",
  1503:"This one is full of system options",
  1504:"containing",
  1505:"The notebook is in Dusty the vacuum. Dusty can spit it out. ",
  1506:"Warning: file",
  1507:"could not be opened. ",
  1508:"Sorry, but you can't train a robot to change the main notebook. ",
  1509:"Since you are a temporary user, you can't save this in the main notebook. ",
  1511:"the page of a notebook did not accept something",
  1512:"a notebook did not accept something",
  1513:"Sounds",
  1514:"Options",
  1515:"Outlet",
  1516:"Inlet",
  1517:"count",
  1518:"Sound",
  1519:"Sorry, but I think that the file",
  1520:"is not a notebook file. ",
  1521:"Sorry, but trying to load a notebook that was created with a later version of ToonTalk! ",
  1522:"This version can't read",
  1523:".  Maybe you should get a newer version. ",
  1524:"ToonTalk mixed up. Sorry. ",
  1525:"Warning: ToonTalk is having troubles re-making something that had been saved. Sorry.",
  1526:"Something wrong with ToonTalk or else a file containing a picture is bad. ",
  1527:"a remote control for another's looks",
  1528:"which is invisible",
  1529:"which is partly visible",
  1530:"is just a notebook",
  1531:"are",
  1532:"with",
  1533:"You can change the appearance of a blank picture by dropping another picture on top. ",
  1534:"Or a number or text pad. ",
  1535:"Dusty, the vacuum, can make a blank picture. ",
  1536:"A notebook full of remote controls for the picture will fly out. ",
  1537:"you can't flip over this kind of remote control",
  1538:"Ignored drop on picture since there are too many pictures with pictures. ",
  1539:"scales can't be added to a picture",
  1540:"the backside of a picture can't be added to the front side of a picture",
  1541:"the picture would not accept something",
  1542:"Here's how you can use a scale to compare text. ",
  1543:"First connect three boxes together. Put some words in the first and third holes. ",
  1544:"And a scale in the middle hole. ",
  1545:"Here's how you can use a scale to compare numbers. ",
  1546:"First connect three boxes together. Put some numbers in the first and third holes. ",
  1547:"the remote control for how something looks can't accept that item",
  1548:"the picture being dropped is waiting for Bammer the Mouse",
  1549:"the picture underneath is already waiting for Bammer the Mouse",
  1550:"the picture being dropped is a remote control",
  1551:"Sorry, this won't take effect until next time you start ToonTalk. ",
  1552:"ToonTalk confused and lost track of what the programmer is doing. ",
  1553:"You just turned off the power and stopped all robots. Pressing F8 again will start them up again. ",
  1554:"Your hand is now hidden. To see it again just press F9 again. ",
  1555:"Only able to open serial ports 1 and 2. ",
  1556:"Trouble opening serial port. ",
  1557:"Serial port problems. ",
  1558:"Couldn't find a HyperBot controller connected to the computer's serial port. ",
  1559:"Trouble sending things out on serial port. ",
  1561:"a robot stopped because the power is off. F8 will turn on the power and start him up again",
  1562:"a hole",
  1563:"And there are",
  1564:"robots in front of him",
  1565:"And there is one robot in front of him",
  1566:"robots behind him",
  1567:"And there is one robot behind him",
  1568:"a robot lost track of stuff",
  1569:"Something wrong with file storing a robot in a notebook. Maybe the robot is lost. Sorry. ",
  1570:"Troubles loading a robot in notebook. Sorry but it's lost. ",
  1571:"Sorry, but I'm having troubles figuring out what these robots do. ",
  1572:"Uhm, excuse me but",
  1573:"Sorry, but you can't train robots to give boxes to other robots. Put the robot and box in a truck instead.",
  1574:"Sorry, but robots can't train robots. ",
  1575:"Ah, sorry but robots are really fussy. They only take boxes. ",
  1576:"Luckily you can put things in boxes. ",
  1577:"ToonTalk can't keep track of so many things on the screen and it's lost track of some. Sorry. ",
  1578:"ToonTalk has lost track of some things so they aren't displayed. Sorry. ",
  1579:"Oh nuts! ToonTalk is broken. It is trying to destroy something twice. ",
  1580:"Something is wrong with ToonTalk. It tried to use something after destroying it. ",
  1581:"Something is wrong with ToonTalk. It tried to destroy something that is still on the floor. ",
  1582:"ToonTalk has something wrong with it. It tried to destroy a part of something. ",
  1583:"Sorry, you seem to have an old or bad data file. ",
  1584:"ToonTalk got mixed up and tried to pick an animation loop that didn't exist. ",
  1585:"a robot named",
  1589:"ToonTalk is confused and trying to free some cache memory that it shouldn't. ",
  1590:"ToonTalk is confused because it cached something needlessly. ",
  1591:"Nuts, ToonTalk is broken and trying to destroy a picture twice. ",
  1592:"Sorry, I can't seem to find the file ",
  1593:"Sorry, but the file",
  1594:"is damaged or missing. You'll have to re-install. ",
  1595:"Sorry, can't find the file I need called RESIND. ",
  1596:"Sorry, but the RESIND file has been damaged. Please re-install. ",
  1597:"Memory is low, so sounds are being reloaded rather than cached. ToonTalk may run slower. ",
  1598:"ToonTalk is mixed up and thought something had parts and then couldn't find them. ",
  1599:"Something might end up the wrong size or place. Sorry. ",
  1600:"You can make something into text by dropping it on a blank text pad. ",
  1601:"Backspace will remove an empty line. ",
  1604:"ToonTalk's sounds can be found on page 8 of your notebook. There are sensors on page 4 of your notebook for making your own sounds. ",
  1605:"the blank text pad didn't accept something",
  1606:"the item on top is blank",
  1607:"you can only add text or numbers to text",
  1608:"text got to be too long",
  1609:"it",
  1610:"You can make that sound by pressing ",
  1612:"then",
  1614:"Pumpy is in Dusty the Vacuum. Dusty can spit him out. ",
  1615:"some things can't be erased",
  1616:"If you want Dusty to spit out stuff he's sucked up, then press 'R'. ",
  1617:"Dusty is in another vacuum. That vacuum can spit him out. ",
  1618:"The magic wand is in Dusty the Vacuum. Dusty can spit it out. ",
  1620:"then it will copy and restore erased things to the way they were before. ",
  1621:"Tooly did not accept something",
  1622:"the truck already has robots in it",
  1623:"the truck already has a box in it",
  1624:"all you can put in a truck is a box, robots, an address, a notebook, a text pad, or a picture of a house",
  1625:"something was dropped into the truck that wasn't a robot, box, address, notebook, text pad, or picture of a house",
  1626:"the city is completely full of houses",
  1627:"Video mode not supported. Perhaps your -v n entry is wrong. ",
  1628:"Some problem getting into full screen mode. Sorry. ",
  1629:"Warning some problem with full screen mode. ",
  1630:"ToonTalk",
  1632:"ToonTalk will probably run much better if you run it in full-screen mode or if you change Windows to run with 256 colors. ",
  1635:"Something went wrong trying to create a dialog box to ask your name. ",
  1636:"There are lots of things about ToonTalk that you can change. ",
  1637:"Like how you look or how fast I talk. Even how much I talk! ",
  1638:"To change things just try the things in the notebook of options on page 10 of your notebook. ",
  1639:"Sorry, but the high resolution mode of ToonTalk is only available when running the 32-bit version of ToonTalk. ",
  1640:"Sorry, but the video mode",
  1641:"is not available. Default value used. ",
  1642:"If you insert the ToonTalk CD-ROM now, ToonTalk will be able to continue. ",
  1643:"If you insert the ToonTalk CD-ROM now, you will be able to hear the narration for this demo. ",
  1644:"what is on top of",
  1646:"This robot will work once. Then he'll stop because you are training him to put his box in the truck.  After the truck drives off he'll never see it again. ",
  1647:"the scale does not accept anything dropped on it",
  1648:"   This is the result of saving a ToonTalk object. You can include",
  1649:"this in files, email, or whatever. To decode it just use any program",
  1650:"that can copy this to the Windows clipboard. For example, you can use",
  1651:"The following is ",
  1652:"   What follows is in a special code and was produced by ",
  1653:"ToonTalk 3 (version 3.191)",
  1654:"8!@%!(%",
  1655:"This is the end of the code for the ToonTalk object. ",
  1656:"It is time to get a new version of ToonTalk. (Visit www.toontalk.com.) ",
  1657:" to change",
  1658:"You can break a box into two pieces by dropping it on a number. One piece will have the number of holes of the number and the other what is left over. ",
  1659:"for example",
  1660:"which originally was",
  1661:"thought he would find a robot in the truck and there wasn't one there. ",
  1670:"the robot in the truck",
  1671:"the box in the truck",
  1672:"the picture of a house in the truck",
  1673:"the Avenue number in the truck",
  1674:"the Street number in the truck",
  1675:"something in the truck",
  1679:"This is a sensor which shows which avenue (runs north to south) that this house is on. ",
  1680:"You can change it by dropping numbers on it. ",
  1681:"If you drop one of these into a truck, then the crew in the truck will build a house on the nearest free lot on this avenue. ",
  1682:"This is a sensor which shows which street (runs east to west) that this house is on. ",
  1683:"If you drop one of these into a truck then the crew in the truck will build a house on the nearest free lot on this street. ",
  1684:"You can find out how many holes a box has by dropping it on a blank number pad. You can make a number pad blank by using Dusty the Vacuum. ",
  1687:"Robots can keep track of only so many things. This one has gotten confused since there are too many things. ",
  1688:"left",
  1689:"right",
  1690:"couldn't find page in notebook",
  1691:"Sorry. An error occurred after sending the following to the Windows Media Control Interface: ",
  1692:"couldn't find the place he was going to drop something",
  1693:"Unable to open file called",
  1694:"in",
  1695:"Warning",
  1696:"bytes",
  1699:"Something destroyed twice.",
  1700:"Improper Sprite file: ",
  1701:"Improper Sprite file version:",
  1702:" version is ",
  1703:"Bad image count in ",
  1704:"Unexpected end of sprite file: ",
  1705:"Sprite files do not support format: ",
  1706:"Background index too big ",
  1707:" ms to display the followers of ",
  1708:" and was cached.",
  1709:" ms to display -- ",
  1710:"an action stopped because ",
  1711:"ToonTalk confused trying to make something a part of two things.",
  1712:"Warning: something became a part of something else while still on the floor. Problem fixed.",
  1713:"ToonTalk confused!  It thought something was a part of something and it wasn't.",
  1714:" was cached and removed from ",
  1715:" which was cached without followers.",
  1716:"Warning: something given a new background while it still is on the old one.",
  1717:"Sorry but ToonTalk has a part which doesn't know what it is a part of. ",
  1718:"Animating to variable goal at ",
  1719:"Animating to goal ",
  1722:"Index was ",
  1723:" and original cycle value was ",
  1724:" current duration is ",
  1725:"Skipped index from ",
  1726:"Should not be skipping so many images. ",
  1727:" and used instead ",
  1728:" (frame=",
  1729:" and has become ",
  1730:"Cycle duration is ",
  1731:" and cycle value is ",
  1732:"Scaling and drawing ",
  1733:" bytes long image #",
  1738:"ToonTalk has problems trying to find a free cache entry.",
  1739:"Free some cache failed so didn't cache image #",
  1740:"Bad candidate cache entry: ",
  1741:" not ok to cache since animation in progress",
  1742:"Damaged file: resind.dat status code = ",
  1743:"Mismatch in number of brushes in resind file",
  1745:"INTEGER",
  1746:"EXPANDER",
  1747:"VACUUM",
  1748:"COPIER",
  1749:"THOUGHT_BUBBLE",
  1750:"ROBOT",
  1751:"NEST",
  1752:"BIRD",
  1753:"TRUCK",
  1754:"PROGRAM_PAD",
  1755:"CUBBY",
  1756:"TOOLBOX",
  1757:"PICTURE",
  1758:"BOMB",
  1759:"TEXT",
  1760:"REMOTE_PICTURE",
  1761:"LAST_MANIPULABLE",
  1762:"PICTURE_INSIDES",
  1763:"PROGRAMMER",
  1764:"DOOR",
  1765:"OPEN_DOOR",
  1766:"HOUSE_ABOVE",
  1767:"HOUSE",
  1768:"HELICOPTER",
  1769:"ROBOT_IN_TRAINING",
  1770:"PROGRAMMER_ARM",
  1771:"MOUSE_WITH_HAMMER",
  1772:"TALK_BALLOON",
  1773:"MARTIAN",
  1774:"BLANK_INTEGER",
  1775:"ERROR_INTEGER",
  1776:"BLANK_CUBBY",
  1777:"LABELED_CUBBY",
  1778:"BLANK_PICTURE",
  1779:"BLANK_TEXT",
  1780:"PICTURE_WITH_INSIDES",
  1781:"REMOTE_INTEGER",
  1782:"GLOBAL_REMOTE_INTEGER",
  1783:"PICTURE_SCALE",
  1784:"REMOTE_APPEARANCE",
  1785:"PICTURE_WITH_INDIRECTION",
  1786:"USER_PICTURE",
  1787:"WHOLE_FLOOR",
  1788:"WHOLE_CITY",
  1789:"ROBOT_WITH_TOOL",
  1790:"ROBOT_WITH_TRAINING_COUNTER",
  1791:"TOOL_BUTTON",
  1792:"WHOLE_HOUSE",
  1793:"VARIABLE_WIDTH_TEXT",
  1794:"SOUND",
  1795:"REMOTE_TEXT_PICTURE",
  1796:"BLANK_SOUND",
  1797:"GLOBAL_USER_REMOTE",
  1798:"USER_SOUND",
  1799:"SPEECH_SOUND",
  1800:"MCI_SOUND",
  1801:"BUILT_IN_SOUND",
  1802:"BLANK_USER_SOUND",
  1803:"BLANK_SPEECH_SOUND",
  1804:"BLANK_MCI_SOUND",
  1805:"BLANK_BUILT_IN_SOUND",
  1806:"BLANK_USER_PICTURE",
  1807:"GLOBAL_JOYSTICK0_REMOTE_INTEGER",
  1808:"GLOBAL_JOYSTICK1_REMOTE_INTEGER",
  1809:"GLOBAL_JOYSTICK2_REMOTE_INTEGER",
  1810:"GLOBAL_JOYSTICK3_REMOTE_INTEGER",
  1811:"GLOBAL_JOYSTICK4_REMOTE_INTEGER",
  1812:"GLOBAL_JOYSTICK5_REMOTE_INTEGER",
  1813:"GLOBAL_JOYSTICK6_REMOTE_INTEGER",
  1814:"GLOBAL_JOYSTICK7_REMOTE_INTEGER",
  1815:"GLOBAL_JOYSTICK8_REMOTE_INTEGER",
  1816:"GLOBAL_JOYSTICK9_REMOTE_INTEGER",
  1817:"GLOBAL_JOYSTICK10_REMOTE_INTEGER",
  1818:"GLOBAL_JOYSTICK11_REMOTE_INTEGER",
  1819:"GLOBAL_JOYSTICK12_REMOTE_INTEGER",
  1820:"GLOBAL_JOYSTICK13_REMOTE_INTEGER",
  1821:"GLOBAL_JOYSTICK14_REMOTE_INTEGER",
  1822:"GLOBAL_JOYSTICK15_REMOTE_INTEGER",
  1823:"GLOBAL_JOYSTICK16_REMOTE_INTEGER",
  1824:"GLOBAL_JOYSTICK17_REMOTE_INTEGER",
  1825:"GLOBAL_JOYSTICK18_REMOTE_INTEGER",
  1826:"GLOBAL_JOYSTICK19_REMOTE_INTEGER",
  1827:"GLOBAL_JOYSTICK20_REMOTE_INTEGER",
  1828:"GLOBAL_JOYSTICK21_REMOTE_INTEGER",
  1829:"GLOBAL_JOYSTICK22_REMOTE_INTEGER",
  1830:"GLOBAL_JOYSTICK23_REMOTE_INTEGER",
  1831:"GLOBAL_JOYSTICK24_REMOTE_INTEGER",
  1832:"GLOBAL_JOYSTICK25_REMOTE_INTEGER",
  1833:"GLOBAL_JOYSTICK26_REMOTE_INTEGER",
  1834:"GLOBAL_JOYSTICK27_REMOTE_INTEGER",
  1835:"GLOBAL_JOYSTICK28_REMOTE_INTEGER",
  1836:"GLOBAL_JOYSTICK29_REMOTE_INTEGER",
  1837:"GLOBAL_JOYSTICK30_REMOTE_INTEGER",
  1838:"GLOBAL_JOYSTICK31_REMOTE_INTEGER",
  1839:"GLOBAL_HYPERBOT_REMOTE_INTEGER",
  1840:"th",
  1841:"st",
  1842:"nd",
  1843:"rd",
  1844:"th",
  1845:"th",
  1846:"th",
  1847:"th",
  1848:"th",
  1849:"th",
  2051:"of the picture",
  2052:"it'll switch to the next value. ",
  2053:"it'll switch to the previous value. ",
  2054:"If you pick it up and press",
  2055:"or +",
  2056:"or just",
  2059:"the number underneath is about to be smashed by another mouse",
  2060:"can't flip this over. You can vacuum out the object and flip it over",
  2061:"can't flip this over. All you can do is drop a file name on it. ",
  2062:"Avenue",
  2063:"Street",
  2064:"ToonTalk had troubles finding a file named",
  2065:"Had some problems reading the file",
  2066:"This is for playing your own sound effects and music. ",
  2067:"This is for loading files into ToonTalk. ",
  2068:"I'm sorry but the 16 bit version of ToonTalk can't deal with pictures bigger than the screen. ",
  2069:"Sorry, ToonTalk had troubles reading the sound file",
  2070:"Remember that if you send this to someone on another computer, you should also send them the file",
  2071:"This is the result of saving everything in a room. ",
  2072:"which contains",
  2073:"who is holding",
  2074:"who can only remember",
  2075:"actions",
  2076:"Just drop the name of a WAVE or MIDI file on it and it'll play until finished or vacuumed up. ",
  2077:"Step",
  2078:"Steps",
  2079:"which has enough magic for",
  2080:"use",
  2081:"uses",
  2082:"Oh boy. Something is wrong with the puzzle file. Sorry. ",
  2083:"Great. The computer and clock are working now. Thanks. I think I can finish the rest on my own. ",
  2084:"I know I sound like a broken record but here I go again. ",
  2085:"Sorry about repeating myself but I don't know what else to say. ",
  2086:"I wish I knew how to help you. All I can think of is what I said last time. ",
  2087:"Nope.",
  2088:"So you aren't born yet? ",
  2089:"Amazing! I didn't know that",
  2090:"year old Earth children were so smart. ",
  2091:"Boy,",
  2092:"years old. You sure are old! ",
  2093:"Inside a computer",
  2094:"See if you can make that number. ",
  2095:"We need",
  2096:"we need",
  2097:"Sit down in the other house and get",
  2098:"Walk through the door of the other house and then press a mouse button. ",
  2099:"You can pick something up by clicking the mouse button while pointing to it. ",
  2100:"While holding",
  2101:"press 'Escape' to stand up and come back here. ",
  2102:"Sorry. We don't need",
  2103:"Something is missing from the box. ",
  2104:"Or it's in the wrong place. ",
  2105:"Nope. ",
  2106:"That's not it. ",
  2107:"Sorry, that's not what we need. ",
  2108:"Something's wrong with that. ",
  2109:"Try again. ",
  2110:"Let's do it again. ",
  2111:"Just drop a file name or URL and then vacuum up and spit out the result. ",
  2112:"Sorry, but you can't change a picture's notebook. It is just for remote controls and sensors. ",
  2113:"Zizzle Island was a nice place before disaster struck. It's starting to sink!",
  2114:"Marty the Martian just happens to be flying by. He rescues everyone. ",
  2115:"He moves almost all of the houses off the island but then he gets engine trouble and crashes. ",
  2116:"Marty the rescuer needs to be rescued. You volunteer to parachute down to help him. ",
  2117:"Hi. I'm Marty. ",
  2118:"You must be",
  2119:"I'm glad to see you again. I remember where we were. ",
  2120:"Thanks for coming back. Let's get back to fixing the ship. ",
  2121:"It's great to see you again. Let's see, where were we? ",
  2122:"Sorry, that's too wide to see all at once. ",
  2123:"Sorry, that's so narrow I can't see the letters. ",
  2134:"Good job",
  2135:"Nice",
  2136:"Good going",
  2137:"Great",
  2138:"Good",
  2139:"Well done",
  2140:"BTWLSNG",
  2141:"SRE",
  2142:"COS",
  2143:"bigger",
  2144:"taller",
  2145:"wider",
  2146:"smaller",
  2147:"shorter",
  2148:"narrower",
  2149:"a good size",
  2150:"suck things up",
  2151:"spit out things he has sucked up",
  2152:"erase things from the surface to make things blank",
  2153:"copy things",
  2154:"copy things, and if they are blank, restore them to the way they used to be",
  2155:"copy itself",
  2156:"who can",
  2157:"that can",
  2158:"You can change",
  2159:"to do something different if you click on the button. ",
  2160:"You can also change",
  2161:"to do something different if you press the '+' or '-' (minus) button. ",
  2162:"You can pick what",
  2163:"will do by typing one of these letters:",
  2164:"I've told you all that I know about buttons. ",
  2165:"If you want me to repeat all I know about buttons, then press F1 twice while pointing to a button. ",
  2166:"I'll tell you more about",
  2169:"make things",
  2170:"You can change Pumpy so he makes things smaller, or taller, or fatter by pushing the button on his chest. ",
  2171:"You can change Pumpy by pressing one of these keys",
  2172:"'B' for big, 'T' for tall, 'W' for wide, 'L' for little, 'S' for short, 'N' for narrow, and 'G' for a good size. ",
  2173:"whatever is under the end of his hose",
  2175:"You can change Dusty so he spits things out or just sucks things off the top of things by pushing the button on his nose. ",
  2176:"You can change Dusty by pressing 'S' for sucking, 'E' for erasing, and 'R' for reverse (spitting out). ",
  2177:"You can change the Magic Wand so it copies itself or copies things and restores them by pushing the button on its tip. ",
  2178:"You can change the Magic Wand by pressing 'C' for copy, 'O' for copy and restore original, and 'S' for copy self. ",
  2182:"You can get me to say the next thing by pressing the 'PageDown' button. ",
  2183:"And pressing PageUp will get me to repeat the last thing I said. ",
  2184:"Here's what I just said. ",
  2185:"I'll just repeat myself. ",
  2186:"I'll say it again. ",
  2187:"Something wrong with demo log. Stopping replay. ",
  2188:"ToonTalk had troubles copying temporary files to ",
  2189:". Maybe there isn't enough free disk space. ",
  2190:"ToonTalk will run off the CD-ROM. It may be slow. ",
  2191:"Animation by Greg Savoia, Kim Tempest, and Brian Anderson. Voices by Jane Barrier and David Kahn.",
  2192:"Everything else by Ken Kahn. Special thanks to Markus, David, and Mary. ",
  2193:"US",
  2194:"SPK",
  2195:"January",
  2196:"February",
  2197:"March",
  2198:"April",
  2199:"May",
  2200:"June",
  2201:"July",
  2202:"August",
  2203:"September",
  2204:"October",
  2205:"November",
  2206:"December",
  2207:"Sorry, I don't know any month called",
  2208:"I never heard of a date like",
  2209:"Let's see. Today is",
  2210:"Thanks",
  2211:"and you were born",
  2212:"so you are",
  2213:"years and",
  2214:"days old",
  2215:"today",
  2216:"Or",
  2217:"Wow, it's your birthday. Happy Birthday! ",
  2218:"I hope you had a really happy birthday. ",
  2219:"Neat! Your birthday is coming really soon. Hope you have a good one. ",
  2220:"If you want me to help you come over here. ",
  2221:"You can start over again by picking up the bomb and pressing the space bar. ",
  2223:"You need to put the nest in the box. ",
  2224:"Sorry, but we need all 7 days on the nest, not just",
  2225:"Sorry, but we need at least 5 numbers on the nest, not just",
  2226:"Sorry but none of the numbers should be changing. ",
  2227:"Sorry but all the numbers have to be more than 0. ",
  2228:"Hmmm, last time the number was",
  2229:"after waiting about 8 seconds.  And now the number is",
  2230:"after waiting 14 seconds. ",
  2231:"My sensors aren't showing a new house built by the crew in the truck. Sorry. ",
  2232:"the Magic Wand is out of magic",
  2233:"on",
  2234:"English",
  2235:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  2236:"abcdefghijklmnopqrstuvwxyz",
  2237:"Hi there! Want to play with ToonTalk now?",
  2238:"Do you want to play a game, see movies, or build something with ToonTalk?",
  2239:"Well, we have lots of demos. Just pick one. ",
  2240:"Good, but to continue we're going to have to install ToonTalk. OK?",
  2241:"When you left last time there was more I wanted to tell you. ",
  2242:"That was what I was trying to say earlier. ",
  2243:"When I have more to say you'll see \"...\" at the bottom. ",
  2244:"Sorry to be fussy, but the order of things in the holes has to be just right. ",
  2245:"bigger than",
  2246:"Sorry, but we need 2, 3, 4, 5, 6, and so on on the nest. ",
  2247:"the left page of",
  2248:"the right page of",
  2249:"any picture",
  2250:"a picture of",
  2251:"pictures of",
  2252:"the picture of",
  2253:"it",
  2260:"a movie of",
  2261:"movies of",
  2262:"the movie of",
  2263:"it",
  2270:"a blank picture of",
  2271:"blank pictures of",
  2272:"the blank picture of",
  2273:"it",
  2280:"the",
  2281:"thing on the back is ",
  2282:"the",
  2283:"to last thing he made or found",
  2284:"the",
  2285:"thing he made or found",
  2286:"the",
  2287:"page of",
  2288:"the",
  2289:"hole of",
  2290:"the",
  2291:"thing on top is ",
  2292:"the",
  2293:"robot wants ",
  2294:" pictures",
  2300:"a stack of ",
  2301:"stacks of ",
  2302:"the stack of ",
  2303:"it",
  2400:"SEE ALL",
  2401:"SEE SOME",
  2402:"SEE NOTHING",
  2403:"SE ALLT",
  2404:"SE LITE",
  2405:"INTE SE NÅGONTING",
  2406:"VER TUDO",
  2407:"VER PARTE",
  2408:"NÃO VER",
  2409:"Alles Sehen",
  2410:"Einiges Sehen",
  2411:"Nichts Sehen",
  2424:"SEE ALL",
  2425:"SEE SOME",
  2426:"SEE NOTHING",
  2427:"VER TUDO",
  2428:"VER PARTE",
  2429:"NÃO VER",
  2550:"yes",
  2551:"no",
  2552:"ja",
  2553:"nej",
  2554:"sim",
  2555:"não",
  2556:"Ja",
  2557:"Nein",
  2566:"yes",
  2567:"no",
  2568:"sim",
  2569:"não",
  2600:"Home",
  2601:"End",
  2602:"Page up",
  2603:"Page down",
  2604:"Left arrow",
  2605:"Right arrow",
  2606:"Up arrow",
  2607:"Down arrow",
  2608:"Delete",
  2609:"Insert",
  2610:"Backspace key",
  2611:"Enter",
  2612:"Escape",
  2613:"Some key",
  2614:"Special key",
  2615:"Control-a",
  2616:"Hem",
  2617:"Slut",
  2618:"Page up",
  2619:"Page down",
  2620:"Pil vänster",
  2621:"Pil höger",
  2622:"Pil upp",
  2623:"Pil ner",
  2624:"Delete",
  2625:"Insert",
  2626:"Sudd-tangenten",
  2627:"Enter",
  2628:"Escape",
  2629:"Någon tangent",
  2630:"Speciell tangent",
  2631:"Kontroll-a",
  2632:"Home",
  2633:"End",
  2634:"Page up",
  2635:"Page down",
  2636:"Seta para a esquerda",
  2637:"Seta para a direita ",
  2638:"Seta para cima",
  2639:"Seta para baixo",
  2640:"Delete",
  2641:"Insert",
  2642:"Backspace",
  2643:"Enter",
  2644:"Escape",
  2645:"Alguma tecla",
  2646:"Tecla especial",
  2647:"Control-A",
  2648:"Home",
  2649:"Ende",
  2650:"Seite nach oben",
  2651:"Seite nach unten",
  2652:"Pfeil links",
  2653:"Pfeil rechts",
  2654:"Pfeil oben",
  2655:"Pfeil unten",
  2656:"Löschen",
  2657:"Einfügen",
  2658:"Zurück",
  2659:"Eingabe",
  2660:"Esc",
  2661:"Eine Taste",
  2662:"Spezial-Taste",
  2663:"Strg-a",
  2728:"Home",
  2729:"End",
  2730:"Page up",
  2731:"Page down",
  2732:"Left arrow",
  2733:"Right arrow",
  2734:"Up arrow",
  2735:"Down arrow",
  2736:"Delete",
  2737:"Insert",
  2738:"Backspace key",
  2739:"Enter",
  2740:"Escape",
  2741:"Some key",
  2742:"Special key",
  2743:"Control-a",
  2744:"Home",
  2745:"End",
  2746:"Page up",
  2747:"Page down",
  2748:"Seta para a esquerda",
  2749:"Seta para a direita ",
  2750:"Seta para cima",
  2751:"Seta para baixo",
  2752:"Delete",
  2753:"Insert",
  2754:"Backspace",
  2755:"Enter",
  2756:"Escape",
  2757:"Alguma tecla",
  2758:"Tecla especial",
  2759:"Control-A",
  3010:"a number",
  3011:"numbers",
  3012:"the number",
  3013:"it",
  3020:"Pumpy the Bike Pump",
  3021:"Pumpy the Bike Pump",
  3022:"Pumpy the Bike Pump",
  3023:"him",
  3030:"Dusty the Vacuum",
  3031:"Dusty the Vacuum",
  3032:"Dusty the Vacuum",
  3033:"him",
  3040:"a magic wand",
  3041:"magic wands",
  3042:"the magic wand",
  3043:"it",
  3050:"a thought bubble",
  3051:"thought bubbles",
  3052:"the thought bubble",
  3053:"it",
  3060:"a robot",
  3061:"robots",
  3062:"the robot",
  3063:"him",
  3070:"a nest",
  3071:"nests",
  3072:"the nest",
  3073:"it",
  3080:"a bird",
  3081:"birds",
  3082:"the bird",
  3083:"her",
  3090:"a truck",
  3091:"trucks",
  3092:"the truck",
  3093:"it",
  3100:"a notebook",
  3101:"notebooks",
  3102:"the notebook",
  3103:"it",
  3110:"a box",
  3111:"boxes",
  3112:"the box",
  3113:"it",
  3120:"Tooly the Toolbox",
  3121:"Tooly the Toolbox",
  3122:"Tooly the Toolbox",
  3123:"him",
  3130:"a picture",
  3131:"pictures",
  3132:"the picture",
  3133:"it",
  3140:"a bomb",
  3141:"bombs",
  3142:"the bomb",
  3143:"it",
  3150:"a text pad",
  3151:"text pads",
  3152:"the text pad",
  3153:"it",
  3160:"a remote control",
  3161:"remote controls",
  3162:"the remote control",
  3163:"it",
  3220:"roof decoration",
  3300:"a blank number pad",
  3301:"blank number pads",
  3302:"the blank number pad",
  3303:"it",
  3320:"a blank box",
  3330:"a box",
  3331:"boxes",
  3332:"the box",
  3333:"it",
  3340:"a blank picture",
  3341:"blank pictures",
  3342:"the blank picture",
  3343:"it",
  3350:"a blank text pad",
  3351:"blank text pads",
  3352:"the blank text pad",
  3353:"it",
  3360:"a picture",
  3361:"pictures",
  3362:"the picture",
  3363:"it",
  3370:"a sensor with a number display",
  3371:"sensors with a number display",
  3372:"the sensor with a number display",
  3373:"it",
  3380:"a sensor with a number display",
  3381:"sensors with a number display",
  3382:"the sensor with a number display",
  3383:"it",
  3390:"a scale",
  3391:"scales",
  3392:"the scale",
  3393:"it",
  3400:"a remote control for how something looks",
  3401:"remote controls for how things look",
  3402:"the remote control for how something looks",
  3403:"it",
  3410:"a picture of something",
  3411:"pictures of things",
  3412:"the picture of something",
  3413:"it",
  3420:"a picture from a user file",
  3421:"pictures from user files",
  3422:"the picture from a user file",
  3423:"it",
  3470:"a button",
  3471:"buttons",
  3472:"the button",
  3473:"it",
  3490:"a text pad",
  3491:"text pads",
  3492:"the text pad",
  3493:"it",
  3500:"a sound",
  3501:"sounds",
  3502:"the sound",
  3503:"it",
  3510:"a remote control",
  3511:"remote controls",
  3512:"the remote control",
  3513:"it",
  3520:"a blank robot",
  3521:"blank robots",
  3522:"the blank robot",
  3523:"him",
  3530:"a force feedback effect",
  3531:"force feedback effects",
  3532:"the force feedback effect",
  3533:"it",
  3600:"It is better to take sounds from the sounds notebook. If you type the name of a sound and you send this to someone in another country it might not work.",
  3601:"any sound",
  3602:"an erased built in sound",
  3604:"Oh boy! Trying to make something a part of itself!",
  3605:"Problem loading an image",
  3606:"Image size wrong.",
  3607:"Negative savings for stretch cache: ",
  3608:" ms to stretch and ",
  3609:" ms to blit the result",
  3610:"The original size is ",
  3611:" and the new size is ",
  3612:" ms saved by putting stretching image in cache ",
  3613:" bytes for result -- index ",
  3614:" ms to create cached surface ",
  3615:"(compressed)",
  3616:"Caching sound #",
  3617:" using cache #",
  3618:" size is ",
  3619:"'s priority was ",
  3620:" and is now ",
  3622:" ok to cache:",
  3623:" Invalidation cost = ",
  3624:"; clean run average = ",
  3625:"; display cost = ",
  3627:"Damaged file: ",
  3628:"Problems initializing brushes.",
  3629:"TTObject",
  3630:"temp",
  3631:"hand",
  3632:"pickUp",
  3633:"TTNothing",
  3634:"setHole",
  3635:"TTBird",
  3636:"setNest",
  3637:"copy",
  3638:"TTVacuum",
  3639:"vacuum",
  3640:"suckUp",
  3641:"spitOut",
  3642:"holeGets",
  3643:"gets",
  3644:"sideGets",
  3645:"false",
  3646:"true",
  3647:"old_given",
  3648:"given",
  3649:"becomes",
  3650:" // This robot has finished and will give the box to the first robot to try again.",
  3651:"return this;",
  3652:"null",
  3653:"keyboard",
  3654:" // bomb set off",
  3655:"throw new TTBombExplosion();",
  3656:"// This Java file was automatically generated by ToonTalk for",
  3657:"public class",
  3658:"public void initialize() {",
  3659:"extends TTApplet {",
  3660:"box",
  3661:"notebook",
  3662:"TTNotebook",
  3663:"TT.NOTEBOOK",
  3664:"TTTeam",
  3665:"TTRobot",
  3666:"team",
  3667:"robot",
  3668:"Robot",
  3669:"next_robot",
  3670:"setNextRobot",
  3671:"start",
  3672:"<title>ToonTalk",
  3673:"</title>",
  3674:"Robot Team #",
  3675:"<hr>",
  3676:"<applet code=",
  3677:"width=",
  3678:"</applet>",
  3679:"<a href=",
  3680:"> See the Java source.</a>",
  3681:"class",
  3682:"extends TTRobot {",
  3683:"wants",
  3684:"static final",
  3685:"TTBox",
  3686:"(TTNotebook n) {",
  3687:"n",
  3688:"public TTObject gets(TTObject given) throws TTException {",
  3689:"return null;",
  3690:"if (!",
  3691:"matches",
  3692:"TT.BLANK_BOX",
  3693:"hole",
  3694:"TT.BLANK_TEXT",
  3695:"TTText",
  3696:"TTNotebook",
  3697:"setPage",
  3698:"page",
  3699:"TT.MAGIC_WAND",
  3700:"TTNest",
  3701:"nest",
  3702:"item_on_nest",
  3703:"putOnNest",
  3704:"TTScale",
  3705:"TT.BLANK_NUMBER",
  3706:"TTNumber",
  3707:" // This robot has finished and will see if the box still matches his thoughts and try again.",
  3708:"import ap.toontalk.*;",
  3709:"erased",
  3710:"erase",
  3711:" public static void main(String args[]) {",
  3712:"  new TTFrame().begin(new ",
  3713:"());",
  3714:"setStartingTeam",
  3715:"picture",
  3716:"language",
  3717:"TTPicture",
  3718:"operations",
  3719:"TT.NOTHING",
  3720:"TTRemoteInteger",
  3721:"TT.GLOBAL_REMOTE",
  3722:"TT.X_REMOTE",
  3723:"TT.Y_REMOTE",
  3724:"TT.X_SPEED_REMOTE",
  3725:"TT.Y_SPEED_REMOTE",
  3726:"TT.WIDTH_REMOTE",
  3727:"TT.HEIGHT_REMOTE",
  3728:"TT.PARAMETER_REMOTE",
  3729:"TT.HIT_OR_MISS_REMOTE",
  3730:"TT.COLLIDEE_REMOTE",
  3731:"TT.END_OF_ANIMATION_REMOTE",
  3732:"TT.GRASPED_REMOTE",
  3733:"TT.SELECTED_REMOTE",
  3734:"TT.RELEASED_REMOTE",
  3735:"TT.X_HIT_OR_MISS_REMOTE",
  3736:"TT.Y_HIT_OR_MISS_REMOTE",
  3737:"TT.APPEARANCE_REMOTE",
  3738:"TT.VISIBLE_REMOTE",
  3739:"TT.CHILDREN_REMOTE",
  3740:"TT.ANCESTORS_REMOTE",
  3743:"TT.MOUSE_LEFT_BUTTON_REMOTE",
  3744:"TT.MOUSE_MIDDLE_BUTTON_REMOTE",
  3745:"TT.MOUSE_RIGHT_BUTTON_REMOTE",
  3746:"TT.MOUSE_LEFT_BUTTON_DOWN_REMOTE",
  3747:"TT.MOUSE_MIDDLE_BUTTON_DOWN_REMOTE",
  3748:"TT.MOUSE_RIGHT_BUTTON_DOWN_REMOTE",
  3749:"TT.KEYBOARD_BUTTON_REMOTE",
  3750:"TT.LAST_KEYSTROKE_REMOTE",
  3751:"TT.SHIFT_DOWN_REMOTE",
  3752:"TT.CONTROL_DOWN_REMOTE",
  3753:"TT.HAND_VISIBLE_REMOTE",
  3754:"TT.CLIPBOARD_REMOTE",
  3755:"TT.AVENUE_REMOTE",
  3756:"TT.STREET_REMOTE",
  3757:"TT.SOUND_ON_REMOTE",
  3758:"TT.LETTER_SIZE_REMOTE",
  3759:"TT.READING_SPEED_REMOTE",
  3760:"TT.MARTIAN_ADVICE_LEVEL_REMOTE",
  3761:"TT.PROGRAMMER_HEAD_REMOTE",
  3762:"TT.SCREEN_SIZE_REMOTE",
  3763:"TT.SYSTEM_SPEED_REMOTE",
  3764:"TT.CITY_SIZE_REMOTE",
  3765:"TT.SYSTEM_SLEEP_REMOTE",
  3766:"TT.MOUSE_BUTTONS_REMOTE",
  3767:"TT.LEGO_SERIAL_PORT_REMOTE",
  3768:"TT.MARTIAN_FONT_REMOTE",
  3769:"TT.FILE_TO_PICTURE_REMOTE",
  3770:"TT.FILE_TO_SOUND_REMOTE",
  3771:"TT.FILE_TO_MOVIE_REMOTE",
  3772:"TT.MARTIAN_SPEAK_REMOTE",
  3773:"TT.MOUSE_SPEED_X_REMOTE",
  3774:"TT.MOUSE_SPEED_Y_REMOTE",
  3775:"TT.CLOCK_REMOTE",
  3776:"TT.RANDOM_REMOTE",
  3777:"TT.NO_IDENTIFIER_GIVEN",
  3778:"setPicture",
  3779:"displayThis",
  3780:"setControlee",
  3800:"addPicture",
  3801:"TTBMPPicture",
  3802:"TTGIFPicture",
  3803:"addTeam",
  3804:"Make a nest for a bird without one.",
  3805:"answer_count",
  3806:"answer_count++",
  3807:"answer",
  3808:"displayed_box",
  3809:"TTRemotePicture",
  3810:"TTSound",
  3811:"use",
  3812:"TT.BLANK_SOUND",
  3813:"TTIndirectPicture",
  3814:"TT.BLANK_PICTURE",
  3815:"TTRemoteLooks",
  3816:"We just made ",
  3817:"height=",
  3818:"<param",
  3819:"name=",
  3820:"pictureWidth",
  3821:"pictureHeight",
  3822:"<p>You need a browser that can run Java to see this.  The latest browsers from Microsoft or Netscape should work fine.</p>",
  3823:"value=",
  3824:"setWants",
  3825:"// If given a box that matches the box in his thought bubble (called \"wants\"),",
  3826:"// this robot will do the following:",
  3827:"archive=",
  3828:"cabbase",
  3829:"runInNewWindow",
  3830:"getLocalRemotesNotebook",
  3831:"getPicturesNotebook",
  3832:"getSensorsNotebook",
  3833:"getSoundsNotebook",
  3834:"getOptionsNotebook",
  3850:"TTRectangle",
  3851:"TTOval",
  3852:"TTRoundedRectangle",
  3853:"TTLineUp",
  3854:"TTLineDown",
  3855:"TTHollowOval",
  3856:"TTRoundedHollowRectangle",
  3857:"TTDottedLineUp",
  3858:"TTDottedLineDown",
  3859:"TTHollowRectangle",
  3860:"TTImageCyclePicture",
  3863:"// The following sets things up for showing a movie of",
  3864:"TT.IMAGE_CYCLES",
  3865:"TTImageCycles",
  3866:"addImage",
  3867:"initialize",
  3868:"TTTruck",
  3900:"given",
  3901:"hand",
  3902:"copier",
  3903:"vacuum",
  3904:"new TTNumber(1)",
  3905:"new TTText(\"A\")",
  3906:"new TTBox(1)",
  3907:"new TTNest()",
  3908:"new TTTruck(this)",
  3909:"notebook",
  3910:"new TTRobot()",
  3911:"new TTScale('?')",
  3912:"TT.BOMB",
  3913:"hand",
  3914:"new TTExpander()",
  3915:"get",
  3917:"TT.REMOTE_PICTURE_NO_APPEARANCE",
  3918:".getState()",
  3919:"TTVacuum.SUCK_STATE",
  4000:"USMarty2",
  4001:"speak",
  4002:"word balloons",
  4003:"speak and balloons",
  4004:"Sorry, but I can speak only if you are running the 32 bit version of ToonTalk.",
  4005:"Translating Martian to Earth languages isn't always so easy. My translation machine sometimes makes me sound kind of funny. I hope you can understand me anyway. ",
  4006:"If something is on the clipboard of Windows, then you'll see it here.  You can use Dusty to vacuum it off and spit it out again. ",
  4007:"If the clipboard is empty, then the remote control will look black.  You can drop something on the remote control to put it on the clipboard. ",
  4008:"Boy, am I glad to see you!",
  4009:"Sorry, but the 16 bit version of ToonTalk can only read pictures with 256 colors. ",
  4010:"You can turn him on and off while holding him by pressing the space bar. ",
  4011:"You can turn him on and off while holding him by pressing the space bar. ",
  4012:"You can turn it on and off while holding it by pressing the space bar. ",
  4013:" if you pick it up. ",
  4014:" if you pick him up. ",
  4015:" if you pick him up. ",
  4016:"the",
  4017:"hole inside",
  4018:"less than",
  4019:"This can't be a correct time. The time can't include a number like",
  4020:"I see you are",
  4021:"seconds old.",
  4022:"I mean",
  4023:"No, it's",
  4024:"I wonder how many seconds until you are",
  4025:"Could you please go next door and figure it out for me?",
  4026:"Maybe you should do something special in",
  4027:"to celebrate being",
  4028:"million seconds old. ",
  4030:"You have done all the available puzzles. Want to start over again?",
  4031:"Good. Let's wait for the bird to bring the message. ",
  4032:"I'm giving up on that bird. We've waited long enough. ",
  4033:"Sorry, but the nest should be empty. ",
  4034:"Sorry, but the number should be changing faster. ",
  4035:"Sorry, but the number should be changing slower. ",
  4036:"Sorry, but the number should be changing. ",
  4037:"The number of robots on the back should be",
  4038:"days",
  4039:"hours",
  4040:"day",
  4041:"hour",
  4042:"minutes",
  4043:"Age of\r",
  4044:"New puzzles might have been added to the ToonTalk web page. See www.toontalk.com. ",
  4045:"We need the number that was on the floor. ",
  4046:"The number should have grown to over a thousand by now. ",
  4047:"If you press the Pause button while holding a robot, a picture, or a truck and then select \"Come back later\", then a copy of what you are holding will appear in Windows as a Java applet in your Web browser. ",
  4048:"Joystick ",
  4049:"Force\rFeedback\rJoystick ",
  4050:"a rectangle",
  4051:"an oval",
  4052:"a rounded rectangle",
  4053:"a line going up",
  4054:"a line going down",
  4055:"a hollow oval",
  4056:"a rounded hollow rectangle",
  4057:"a dotted line going up",
  4058:"a dotted line going down",
  4059:"a hollow rectangle",
  4060:"Touch\rSensitive\rMouse",
  4100:"Duration",
  4101:"Strength",
  4102:"Direction",
  4109:"of the force feedback effect named",
  4110:"the duration (in thousandths of a second)",
  4111:"the strength (100 is full-strength)",
  4112:"the direction in degrees",
  4120:"Foreign\rBird",
  4121:"a bird who flies outside of ToonTalk",
  4122:"You should give the bird a box with 2 holes. The first hole should be the name of a ToonTalk extension. The second hole should contain a bird who will be given a box with a new bird.",
  4123:"This bird takes Read and Write messages to a file named ",
  4125:"A bird took something to the ToonTalk file extension, but it wasn't a proper message. ",
  4126:"File messages should be boxes with 3 holes whose third hole contains a bird who receives replies. For reading, the first hole should contain \"Read\" and the second the number of letters to read. ",
  4127:"For writing, the first hole should contain \"Write\" and the second the text pad to add to the file. ",
  4128:"Messages for this bird should be boxes with 3 holes. The first hole should contain \"Open\", \"Create File\", or \"Open Serial Port\". ",
  4129:"In the second hole there should be a file name. The third hole should contain a bird. This bird will receive another bird for reading and writing from the file. ",
  4130:"Read ToonTalk help for more information. ",
  4131:"This bird takes messages to create or open files. ",
  4132:"Had troubles opening the file named ",
  4133:"A bird took something to a Windows file, but it wasn't a proper message. ",
  4200:"Sorry, but a box can't have too many holes. See www.toontalk.com/English/ttini.htm to learn how to change this. ",
  5001:"START_EVENT",
  5002:"SELECT_STACK_ITEM",
  5003:"NEW_ITEM",
  5004:"GRASP_COPIER",
  5005:"COPIER_APPLY",
  5006:"GRASP_EXPANDER",
  5007:"RELEASE_COPIER",
  5008:"GRASP_ITEM",
  5009:"RELEASE_ITEM",
  5010:"RELEASE_ITEM_ON",
  5011:"RELEASE_ITEM_LEFT_OF",
  5012:"RELEASE_ITEM_RIGHT_OF",
  5013:"EXPANDER_APPLY",
  5014:"GRASP_VACUUM",
  5015:"VACUUM_APPLY",
  5016:"VACUUM_APPLY_RESTORE",
  5017:"RELEASE_VACUUM",
  5018:"KEYBOARD_CHARACTER",
  5019:"HATCH_BIRD",
  5020:"GIVE_BIRD_ITEM",
  5021:"DROP_ITEM_IN_TRUCK",
  5022:"DESTROY_HOUSE",
  5023:"APPLY_GRASPED_ITEM",
  5024:"LAST_EVENT",
  5025:"LABEL_CHARACTER",
  5026:"KEYBOARD_CHARACTER_AND_SELECT",
  5027:"GRASP_NEST",
  5028:"NEW_MAIN_CUBBY",
  5029:"COPIER_APPLY_NEST",
  5030:"VACUUM_APPLY_NEST",
  5031:"APPLY_GRASPED_NEST",
  5032:"RELEASE_EXPANDER",
  5033:"SERIAL_NUMBER",
  5034:"1",
  5035:"it",
  5036:"new",
  5037:"first new",
  5038:"newest",
  5039:"to last",
  5040:"the",
  5041:"Something is wrong with a part of a city file describing what's on the floor of a house.",
  5042:"Something is wrong with a part of a city file describing what's on the wall inside a house.",
  5043:"could not be saved\rbecause it has too much stuff in it.",
  5044:"There are more than 1000 items on a nest that is being saved. Some items will be lost.",
  5045:"Too many nests being saved in notebook. Can't save more than 255 at one time -- sorry.",
  5046:"This serial port interface is not supported in the 32-bit version of ToonTalk. ",
  5100:"UST",
  5101:"Oh boy! I can't make the next puzzle since it needs stuff from earlier puzzles.  Is it OK if I send you back",
  5102:"aeiou",
  5103:"bcdfghjklmnprstvwxz",
  5104:"puzzles?",
  5105:"Maybe you need to re-install ToonTalk. ",
  5106:"This version of ToonTalk will stop working in",
  5107:"days.",
  5108:"4!@%!(%A(A!C#B!C!C!C+A!C!C!C<A,CNA!C*D!C!C!C#C!C+C!C'C!C(A!C8D{A#C!C+A!C",
  5109:"!C!C<A,CNA!C*D!C!C!C#C!CAC!C#C!C'CTAiAmAeArA!C%A(D!C!C!C+A!C,C!C!C'CLAoA",
  5110:"oAkAsA!C'A!C!C<A$C&B!C&B!C!C!C!C!C!C!C!C!C!C!C!C!C&CAC!C#C!C'CTAiAmAeArA",
  5111:"!C%A(D!C!C!C+A\"C,C!C!C'CLAoAoAkAsA!C!C\"C!C!C!C+A\"CAC5B D#C!C\"C D!C$C#C D",
  5112:"!C%C!C!C D!C*C!C\"C D!C'C#C D!C8C D!C!C!C!C!C!C!C!C-C&C!C.C#C=B!C=B!C!C!C",
  5113:"!C!C!C8B|A#C!C+A!C'A!C!C<A$C&B!C&B!C!C!C!C!C!C\"C!C!C!C+A!C!ChB$C!C!C+A!C",
  5114:"!C!C!C!C!C!C!C!C&C+C!C'C!C!CYBkB!C!C+A\"C-C%C!C.C#C=B!C=B!C!C!C!C!C!ChB$C",
  5115:"!C!C+A\"C!C\"C!C!C!C+A\"C!C\"C!C!C!C+A\"C!ChB$C!C!C+A\"CAC6B D#C!C#C D!C$C#C D",
  5116:"!C%C!C%C D!C*C!C$C D!C%C!C&C D!C*C!C#C D!C'C#C D!C8C D!C!C!C!C!C!C!C!C..",
  5117:" cum kaka kike rape dago fag nad fuc fuk god sod nig jap wog fok kum jew tit wop git sex sux fux lez pube dike puke ",
  5118:"Hi. It has been a while since you last ran ToonTalk. Is it OK if Marty suggests things you have already done, but might have forgotten about?",
  5121:"Would you like to learn about the command line options now?",
  5123:"clean",
  5124:"clean but on top of dirty",
  5125:"clean but at least one follower dirty",
  5126:"moved",
  5127:"dirty",
  5128:"dirty but completely obscured",
  5130:"Scaled to ",
  5131:"milliseconds",
  5132:" (rectangular) ",
  5133:" with size ",
  5134:" whose speedup is 1/",
  5135:" and savings is ",
  5136:"Cached image #",
  5137:" at cache #",
  5138:"Caching image #",
  5139:" using cache #",
  5140:" size is ",
  5141:" for sound #",
  5142:"times",
  5143:"Windows Notepad or WordPad program. Select all of the text",
  5144:"and then use the Copy command in the Edit menu. Then it will appear",
  5145:"in the ToonTalk remote control for the clipboard. You can find the",
  5146:"clipboard remote control on page 30 of the Sensor notebook. Just use",
  5147:"thing with invalid type (Sorry, something went wrong describing something - it might still work fine.)",
  5148:"NONE_GIVEN",
  5149:"Sorry, something went wrong replaying a demo log. Please report this problem to Support@ToonTalk.com.",
  5150:"Sorry, but this is a trial version of ToonTalk, so changes to your notebook will be lost when you quit ToonTalk.",
  5151:"Sorry, the Trial Version can't save cities.",
  5152:"Dusty to vacuum it off the clipboard. Control-v is a shortcut for pasting. ",
  5153:"To learn more visit www.toontalk.com.",
  5154:"StartToonTalkEncoding:",
  5155:"You can sit down by clicking any mouse button. You can get up again by pressing the 'Escape' button. ",
  5198:"first output of the HyperBot controller",
  5199:"second output of the HyperBot controller",
  5200:"third output of the HyperBot controller",
  5201:"fourth output of the HyperBot controller",
  5202:"fifth output of the HyperBot controller",
  5203:"sixth output of the HyperBot controller",
  5204:"seventh output of the HyperBot controller",
  5205:"eighth output of the HyperBot controller",
  5206:"first input of the HyperBot controller (is 1 if the sensor is on)",
  5207:"second input of the HyperBot controller (is 1 if the sensor is on)",
  5208:"third input of the HyperBot controller (is 1 if the sensor is on)",
  5209:"fourth input of the HyperBot controller (is 1 if the sensor is on)",
  5210:"fifth input of the HyperBot controller (is 1 if the sensor is on)",
  5211:"sixth input of the HyperBot controller (is 1 if the sensor is on)",
  5212:"seventh input of the HyperBot controller (is 1 if the sensor is on)",
  5213:"eight input of the HyperBot controller (is 1 if the sensor is on)",
  5214:"number of times the first input of the HyperBot controller has been on since the previous frame",
  5215:"number of times the second input of the HyperBot controller has been on since the previous frame",
  5216:"number of times the third input of the HyperBot controller has been on since the previous frame",
  5217:"number of times the fourth input of the HyperBot controller has been on since the previous frame",
  5218:"number of times the fifth input of the HyperBot controller has been on since the previous frame",
  5219:"number of times the sixth input of the HyperBot controller has been on since the previous frame",
  5220:"number of times the seventh input of the HyperBot controller has been on since the previous frame",
  5221:"number of times the eighth input of the HyperBot controller has been on since the previous frame",
  5222:"ToonTalk is about to generate a Java applet of what you are holding in your hand.\rIf all goes well, in a minute your browser should be showing it. ",
  5223:"The last time ToonTalk ran it did not exit properly. Would you like some advice on what to do?",
  5224:"The last time ToonTalk ran it did not exit properly. Would you like some advice?",
  5225:"ToonTalk ran very slowly. Would like some advice about how to get it to run faster?",
  5226:"You can set options so that ToonTalk will run with sharper images. Want to learn more about it?",
  5227:"Your joystick sent the helicopter to the edge. If this is a mistake, you'll need to calibrate your joystick. Do you want to learn how to do that?",
  5228:"ToonTalk had some troubles using the DirectX game extensions to Windows. Want to see what you can do about this?",
  5229:"Windows is telling me that the mouse has moved more than is possible. This happens when running ToonTalk on a Mac that is running Windows. Sorry. Try using the arrow keys instead.",
  5232:"The demo couldn't complete as it was supposed to. Do you want to learn how to fix this?",
  5233:"Sorry, this beta or trial version is too old. Do you want to learn how to get a new one? ",
  5234:"Would you like to read some hints?",
  5235:"Would you like to see some hints for how to deal with robots in puzzles?",
  5236:"A ToonTalk extension is needed, but it has not been installed. Would you like to learn how to install extensions? ",
  5237:"Text-to-speech engine failed to start properly. Do you want to know what you can do to fix this?",
  5238:"Sorry, but this trial version does not generate Java applets.",
  5239:"ToonTalk had some troubles using the DirectX Media extensions to Windows to load pictures. Do you want to see what you can do about this?",
  5240:"Sorry, but something went wrong in compiling the Java applet. Do you want to read about what to do about this?",
  5241:"Working with big numbers can be so slow that ToonTalk freezes for a few seconds or minutes. Do you want to read more about this?",
  5242:"Time travel seems to be making ToonTalk freeze now and then. Do you want to read about how you can avoid this?",
  5250:"dispdib",
  5251:"abnormal",
  5252:"tooslow",
  5253:"highres",
  5254:"joycalib",
  5255:"directx",
  5256:"badmouse",
  5257:"abnormal",
  5258:"badinstl",
  5259:"baddemo",
  5260:"trialovr",
  5261:"puzzle1",
  5262:"robotpuz",
  5263:"extendin",
  5264:"ttselect",
  5266:"dxmedia",
  5267:"javaprob",
  5268:"slownumb",
  5269:"slowtime",
  5277:"Sorry. Something went wrong trying to launch a web browser like Netscape Navigator or Microsoft Internet Explorer.",
  5278:" City saved.",
  5279:"saved on",
  5280:"MAIN_CUBBY",
  5281:" ",
  5282:"A_COPIER",
  5283:"A_VACUUM",
  5284:"INTEGER_STACK",
  5285:"TEXT_STACK",
  5286:"CUBBY_STACK",
  5287:"NEST_STACK",
  5288:"TRUCK_STACK",
  5289:"PROGRAM_PADS",
  5290:"ROBOT_STACK",
  5291:"SCALE_STACK",
  5292:"BOMB_STACK",
  5293:"ITEM_HELD",
  5294:"AN_EXPANDER",
  5300:"FunctionKeys",
  5301:"NumberTyping",
  5302:"TextTyping",
  5303:"Flipping",
  5304:"GraspingNonEstentials",
  5305:"ResetOnSolution",
  5306:"BringInVacuumWhenRobotFails",
  5307:"UserPuzzle",
  5308:"RobotsAreLostWhenSolved",
  5309:"SavedRobotsNotAdded",
  5310:"GoodSolutionsPosted",
  5311:"HandEmptyAfterPosting",
  5400:"helicopt",
  5401:"sparrow2",
  5402:"pigeon2",
  5403:"hot_rod2",
  5404:"angels_f",
  5405:"b_wop",
  5406:"electric",
  5407:"spiralin",
  5408:"out_spir",
  5409:"book_dro",
  5410:"door_cr4",
  5411:"dustbus2",
  5412:"exp2",
  5413:"hand_pum",
  5414:"ouch",
  5415:"plop",
  5416:"pop",
  5417:"ins_step",
  5418:"type",
  5419:"traf2",
  5420:"turning1",
  5421:" ",
  5422:"neat_eff",
  5423:"drive",
  5424:"bellbike",
  5425:"boing3",
  5426:" ",
  5427:" ",
  5428:"calc",
  5429:"comedy1",
  5430:"comedy2",
  5431:"deflatin",
  5432:"door1",
  5433:" ",
  5434:" ",
  5435:" ",
  5436:"fstep33",
  5437:"glass_hi",
  5438:"glass_lo",
  5439:" ",
  5440:" ",
  5441:" ",
  5442:"shutdown",
  5443:"spit1",
  5444:"switch",
  5445:"teleport",
  5447:"twingy",
  5501:"Problem decoding a picture.",
  5502:"Puzzle reading floor items but has found the wrong token.",
  5503:"Puzzle part too long.",
  5504:"No equal sign after keyword in puzzle file.",
  5505:"Can't find a picture to connect remote controls to in a puzzle.",
  5506:"Force Feedback not available",
  5507:"Too much to convert to pass to Windows",
  5508:"Something wrong with type string ",
  5509:" from Windows.",
  5510:"Something went wrong playing a sound.",
  5511:"Memory low.  Recycling last ",
  5512:"% of memory used to speed things up.",
  5513:"This installation is missing some sounds and pictures needed for making Java applets. Sorry.",
  5514:"Problems finding the Java media file ",
  5515:"Problems copying the Java media file ",
  5516:"Problems finding the name of java file # ",
  5517:"Too many things to dump!",
  5518:"A robot has lost track of things. It didn't expect to have to keep track of this many things.",
  5519:"expected to keep track of only",
  5520:"Couldn't find encoding of goal in puzzle.",
  5521:"Puzzle contained a non-robot after the goal. Section ignored.",
  5522:"Non picture on top of picture added to back instead.",
  5523:"TT",
  5524:"T16",
  5525:"dll",
  5526:"[SB]",
  5527:"[H]",
  5528:"TnTkS001",
  5529:"Problem in replay: event counter token missing in log.",
  5530:"Boolean event token expected.",
  5531:"dmo",
  5532:"Demos",
  5535:"FileExtensions",
  5536:"Sorry. Some sensors just don't work in Java. The following sensor will be inactive in Java: ",
  5537:"Defaults",
  5538:"LastChanged",
  5539:"SubtitlesSuffix",
  5540:"Unable to open output log file ",
  5541:"TTDMO000",
  5542:".wav",
  5543:"Users",
  5544:"Loading, please wait.",
  5545:"JavaFileSuffix",
  5546:"This installation of ToonTalk is missing the low resolution graphics data file. Click on 'Set Options' to switch to 640x480 or higher or contact support@toontalk.com.",
  5547:"JavaCompiler",
  5548:"jump",
  5549:"exe",
  5550:"javashow.bat",
  5551:"call ",
  5552:" -O -classpath ",
  5553:"system",
  5554:"zip",
  5555:"java",
  5558:"RunAppletInNewWindow",
  5559:".class ",
  5560:"archive",
  5562:"HTMLExtra",
  5563:"cabbase",
  5564:"ShellIsPROGMAN",
  5567:"Java compiler problem.  Error code = ",
  5568:" running ",
  5569:"open",
  5570:"TextToSpeechMode",
  5571:"Versions",
  5572:"TextToSpeech",
  5573:"Problem starting text to speech engine. Marty will just use talk balloons.",
  5574:"If you click on 'Set Options' and turn off speech you will not see this message again.",
  5575:"Can't shut down OLE.",
  5576:"DataFileSuffix",
  5577:" status = ",
  5578:"resind.",
  5579:"usr",
  5580:"MainDir",
  5581:"CDROMdir",
  5582:"TempDir",
  5583:"GenerateLogs",
  5584:"AutoDemoSubtitle",
  5585:"PreviousStartToonTalkCommandLine",
  5586:"Directories",
  5587:"TeamNameCounter",
  5588:"RobotCounter",
  5589:"NarrationFileSuffix",
  5590:" Oj du0081Ejag kan tyvu00e4rr inte komma ihu00e5g vad jag skulle su00e4ga. ",
  5591:" Oh, es tut mir leid. Ich habe vergessen, was ich sagen wollte. ",
  5592:" Ahh, sorry I can't remember what I was going to say... ",
  5593:"Warning: couldn't find string #",
  5594:"Language",
  5595:"American",
  5596:"English",
  5597:"CDROMDemoFiles",
  5598:"doc",
  5599:"htm",
  5600:"open",
  5601:"start ",
  5602:"Switches",
  5603:"ToonTalkStarted",
  5604:"ToonTalk.ini",
  5605:"User",
  5606:"PreviousName",
  5607:"Full screen mode not available for this version of Windows NT.",
  5608:"NoTempDirWarningGiven",
  5609:"FullScreenModeStarted",
  5610:"LogNameCounter",
  5611:"InstallationDefaults",
  5612:"DispDIBNotPossible",
  5613:"CDROMFiles",
  5614:"EnglishIsAmerican",
  5615:"AutoDemoMaxIdle",
  5616:"JoystickDeadZone",
  5617:"TurnOffJoystickAutoCenter",
  5618:"SubtitlesSpeed",
  5619:"GenerateRobotNames",
  5620:"MaximumNumberOfHoles",
  5621:"DefaultUser",
  5622:"StringLibraryDll32",
  5623:"StringLibraryDll16",
  5624:"ToonTalk",
  5625:"Det u00e4r nu00e5got fel med ToonTalk. Vill du ha hju00e4lp att hitta felet?",
  5626:"Something is wrong with ToonTalk. Do you want help trouble shooting?",
  5627:"Sorry, couldn't load a DLL resource file. If restarting Windows doesn't fix this, then re-install ToonTalk. If the problem persists report it to support@toontalk.com.",
  5628:"If you insert the ToonTalk CD-ROM and wait a few seconds, ToonTalk will be able to continue.",
  5629:"Warning: could not open the file: ",
  5630:"Oh boy, Windows just reported an error -- who knows what'll happen now.",
  5631:"Failed to create a font object.",
  5632:"Creating new font without deleting old one.",
  5633:"Selecting a font while old font is still selected.",
  5634:"Some problems putting text on screen.",
  5635:" is a file that is smaller than it should be.\\rPerhaps part of the file was lost during downloading.\\rPlease re-install.",
  5636:"ClippingDir",
  5637:" is an invalid video mode.",
  5638:"TT32.DLL",
  5639:"TT16.DLL",
  5640:"British",
  5641:"Swedish",
  5642:"Portuguese",
  5643:"PortugueseIsBrazilian",
  5644:"German",
  5645:"Turkish",
  5646:"Japanese",
  5647:"Italian",
  5652:"Too many temporary files.",
  5663:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-",
  5664:"Bad clipboard character is: ",
  5665:"GeneralTextToSpeechEngine",
  5666:"Java\\\\Pictures\\\\M25",
  5667:"Java\\\\Pictures\\\\M22",
  5668:"Java\\\\Sounds",
  5669:"Java\\\\",
  5670:" from ",
  5671:".txt",
  5672:"Robot's events missing a START_EVENT or else never expected to reference arguments.",
  5673:"duhupffd",
  5674:"duhupffd",
  5675:" ",
  5676:" ",
  5677:"TnTkD000",
  5678:"is not a good ToonTalk demo log file.",
  5679:"The demo file will only run in later versions of ToonTalk. Please upgrade your system. Visit www.toontalk.com.",
  5680:" Ah, desculpe... esqueci o que ia falar...",
  5681:" Ahh, nu00e3o sei o que ia dizer... ",
  5682:"the robot gave a robot something it wouldn't accept",
  5683:" ",
  5684:". ",
  5685:",",
  5686:"? ",
  5687:"! ",
  5688:"There was a problem reading a file from the Internet.",
  5689:" Do you want ToonTalk to stop trying to find files on the Internet?",
  5690:"ToonTalk no longer using the mouse - Press Control-F8 to start using it again.",
  5691:"1",
  5700:"floora",
  5701:"rooma",
  5702:"roomb",
  5703:"roomc",
  5704:"bigbubbl",
  5705:"sinking",
  5706:"crash",
  5707:"hurt",
  5708:"rescue",
  5709:"inrocket",
  5710:"opening",
  5711:"floorb",
  5712:"floorc",
  5713:"credits",
  5714:"floord",
  5720:"A robot is typing space to a picture that wasn't stopped. Space no longer changes a picture. Should I change such robots so they type '+' instead?",
  5721:"A robot is typing space to a remote control that wasn't stopped. Space no longer changes it. Should I change such robots so they type '+' instead?",
  5722:"Robots will be updated the first time they run. You'll need to save the updated robots to avoid being asked again about this in your next session.",
  5723:"Do you want to see your log file?",
  5724:"Sorry but an internal error occurred while starting ToonTalk. Strange things may happen.",
  5725:"Sorry but an internal error has occurred. Strange things may happen.",
  5726:"An internal error occurred while shutting down.",
  5728:" Do you want ToonTalk to try to keep going anyway?",
  5729:"Sorry but an internal error occurred while loading a city. Strange things may happen.",
  5730:"Sorry but an internal error occurred while loading a page of a notebook. It is probably lost.",
  5731:"Sorry but an internal error occurred while loading something. It is probably lost.",
  5732:"ToonTalk is loading a nest that works over a network. But this version of ToonTalk can't deal with the network. Network stuff ignored. Visit www.toontalk.com for information on how to upgrade.",
  5733:"Sorry something went wrong while saving a city. City not saved.",
  5734:"Sorry, an error occurred while saving things for time travel. Time travel might not work right for this user name.",
  5735:"GO",
  5736:"This is the result of saving a house.",
  5737:"This is the result of saving a city.",
  5738:"Sorry, this version of ToonTalk can't run this demo. Try versions earlier than 2.0.",
  5739:"This computer can't run at a screen resolution of ",
  5740:"Default resolution lowered to ",
  5741:"Please start ToonTalk again.",
  5742:"Can't drop the remote control for the looks of a flipped picture on a blank picture.",
  5743:"Loading a networked nest that was created on a computer with a different Internet address. Saved birds won't be able to find this nest.",
  5744:"A robot vacuumed up his box.",
  5745:"ToonTalk can't find an IP address for this machine. Long-distance birds won't work unless you quit, connect to the Internet, and try again.",
  5746:"ToonTalk is loading a foreign bird that uses an extension to ToonTalk (a DLL).",
  5747:"A robot is about to use a foreign bird that uses an extension to ToonTalk (a DLL).",
  5748:"Is it OK to load",
  5749:" ",
  5750:"TT3191",
  5751:"ToonTalk was installed to run",
  5752:"Do you want to update it to run instead the version you are running now?",
  5754:"VER22.DLL",
  5755:"A DLL from an unknown or untrusted source might do damage and so might a robot from an untrusted source using a trusted DLL.",
  5756:"This demo needs a different version of ToonTalk to run correctly. This version isn't installed but is contained in the demo file. You should ONLY proceed if you trust the person who supplied this file. Do you want to continue?",
  5757:"ToonTalk cannot write to the folder",
  5758:"Some user provided pictures and sounds may be lost.",
  5759:"You can provide a different directory by setting MediaDir in the Directories section of the toontalk.ini file.",
  5760:"ToonTalk will attempt to continue but it probably will not be able to save your work.",
  5761:"ToonTalk is unable to read the file",
  5762:"ToonTalk will attempt to continue but some things (pictures or sounds) may be missing.",
  5763:"ToonTalk is unable to write to the file",
  5764:"Perhaps the folder is full and you need to delete some files or maybe you don't have permission to write to that file or folder.",
  5765:"The Windows error code number is",
  5766:"and is described by Windows as follows:",
  6000:"From\rLeft\rSide",
  6001:"From\rBottom",
  6002:"Speed\rto\rRight",
  6003:"Speed\rto\rTop",
  6004:"Width",
  6005:"Height",
  6006:"Which\rPicture",
  6007:"Colliding?",
  6008:"Touching\rWho?",
  6009:"Animation\rFinished?",
  6010:"Held\rin\rHand?",
  6011:"Selected?",
  6012:"Just\rDropped?",
  6013:"Left\rRight\rhit?",
  6014:"Up\rDown\rhit?",
  6015:"Looks",
  6016:"Visible?",
  6017:"Parts",
  6018:"Containers",
  6021:"Mouse's\rLeft\rButton\rClicked",
  6022:"Mouse's\rMiddle\rButton\rClicked",
  6023:"Mouse's\rRight\rButton\rClicked",
  6024:"Mouse's\rLeft\rButton\rDown",
  6025:"Mouse's\rMiddle\rButton\rDown",
  6026:"Mouse's\rRight\rButton\rDown",
  6027:"Key\rJust\rPressed",
  6028:"Last\rKeystroke",
  6029:"Shift\rButton\rDown",
  6030:"Control\rButton\rDown",
  6031:"Hand\rVisible?",
  6032:"To and from\rother\rPrograms",
  6033:"My\rAddress",
  6034:"My\rAddress",
  6035:"Sound\rOn?",
  6036:"Marty's\rLetters\rSize",
  6037:"Marty's\rTalking\rSpeed",
  6038:"Marty's\rTalk\rLevel",
  6039:"Your\rHead's\rLooks",
  6040:"Window\rSize",
  6041:"Speed of\rToonTalk",
  6042:"City\rSize",
  6043:"Frame\rDuration",
  6044:"Mouse\rButton\rUse",
  6045:"Serial\rPort",
  6046:"Marty's\rFont",
  6047:"File to\rObject",
  6048:"File to\rSound",
  6050:"How\rMarty\rTalks",
  6051:"Mouse's\rRight\rSpeed",
  6052:"Mouse's\rUp\rSpeed",
  6053:"Milli-\rseconds\rsince\rLast\rFrame",
  6054:"Number\rbetween\r0 and 999",
  6055:"Media\rControl\rInterface",
  6056:"Text to\rSpeech",
  6057:"Wall\rDecoration",
  6058:"House\rDecoration",
  6059:"Roof\rDecoration",
  6060:"Language\rUsed",
  6064:"Joystick\rX Speed",
  6065:"Joystick\rY Speed",
  6066:"Joystick\rZ Speed",
  6067:"Joystick\rX Axis",
  6068:"Joystick\rY Axis",
  6069:"Joystick\rZ Axis",
  6070:"Joystick\rButtons\rClicked",
  6071:"Joystick\rButtons\rDown",
  6100:"This is for sending commands to Microsoft Windows Media Control Interface (MCI). ",
  6101:"Just drop the text you want to send to it. ",
  6102:"This is for speaking the text. ",
  6103:"This only works with the 32-bit version of ToonTalk. ",
  6104:"Just drop the text you want to hear on it. ",
  6105:"On top of it is",
  6106:"the space bar",
  6107:"the second joystick button",
  6108:"or",
  6110:"nothing will stick to the side of a blank box",
  6111:"The smallest number you can give for the city size is -255.  This makes a 255 by 255 city and because it is negative the city is randomly filled with houses. ",
  6112:"The biggest a city can be is 255 blocks by 255 blocks. ",
  6113:"seventh",
  6114:"eighth",
  6115:"ninth",
  6116:"tenth",
  6117:"eleventh",
  6118:"twelfth",
  6119:"thirteenth",
  6120:"stopped because",
  6121:"bombs only work inside of houses or on the back of a picture",
  6122:"trucks drive away only if they are inside of a house or on the back of a picture",
  6123:"birds only start flying from inside of a house or on the back of a picture",
  6124:"robots only start working when inside of a house or on the back of a picture",
  6125:"has a box that doesn't match his thought bubble and there is no robot he can give it to. ",
  6126:"You'll find a little present at the end of the notebook on page 4 of your notebook (in \"Free Play\"). ",
  6127:"was going to put something into something but it's been vacuumed away",
  6128:"Sorry, but a Java applet of something that has foreign birds in it probably won't work.",
  6129:"A bird took something to Windows, but Windows didn't know what to do with it. ",
  6132:"and it has the label",
  6133:"This tells us what pictures are stuck on top of",
  6134:"This tells us what pictures",
  6135:"is stuck on top of",
  6136:"labeled by",
  6137:"If you give me something, I'll talk about it whenever I'm talking about",
  6138:"Here's a copy of",
  6139:"It goes with",
  6140:"OK",
  6141:"I'll remember that",
  6142:"goes with",
  6143:"trillion",
  6144:"trillion",
  6145:"billion",
  6146:"billion",
  6147:"million",
  6148:"million",
  6149:"thousand",
  6150:"thousand",
  6151:"hundred",
  6152:"hundred",
  6153:"My Box",
  6154:"that reminds me of",
  6155:" ",
  6156:"something",
  6201:" ",
  6202:" ",
  6203:" ",
  6204:" ",
  6205:" ",
  6206:" ",
  6207:" ",
  6208:" ",
  6209:" ",
  6210:" ",
  6211:" ",
  6212:" ",
  6213:" ",
  6214:" ",
  6215:" ",
  6216:" ",
  6217:" ",
  6218:" ",
  6219:" ",
  6220:" ",
  6221:" ",
  6223:" ",
  6225:" ",
  6226:" ",
  6227:" ",
  6228:" ",
  6229:" ",
  6230:" ",
  6231:" ",
  6233:" ",
  6234:" ",
  6235:" ",
  6236:" ",
  6237:" ",
  6238:" ",
  6239:" ",
  6240:" ",
  6241:" ",
  6242:" ",
  6243:" ",
  6244:" ",
  6245:" ",
  6246:" ",
  6247:" ",
  6248:" ",
  6249:" ",
  6250:" ",
  6251:" ",
  6252:"any robot",
  6253:"any force effect",
  6254:"an erased force effect",
  6255:"You can feel that effect by pressing ",
  6256:" ",
  6257:"You can find more force effects in the notebook near the end of the sensor notebook.",
  6258:"Tooly won't come since he is in Dusty the Vacuum. Use Dusty to spit him out. ",
  6259:"speak and subtitles",
  6261:" ",
  6262:" ",
  6263:" ",
  6264:" ",
  6265:" ",
  6266:" ",
  6267:" ",
  6268:" ",
  6269:" ",
  6271:" ",
  6272:" ",
  6273:" ",
  6274:" ",
  6275:" ",
  6277:"subtitles",
  6282:" ",
  6293:"Warning. Strange things may happen when you put something on the back of the remote control for its looks.",
  6294:"Integer Part",
  6295:"Fraction Part",
  6296:"Numerator",
  6297:"Denominator",
  6298:"Sine",
  6299:"Cosine",
  6300:"Tangent",
  6301:"Arc Sine",
  6302:"Arc Cosine",
  6303:"Arc Tangent",
  6304:"add",
  6305:"raise what it is dropped on to the power of",
  6306:"leave the integer part",
  6307:"leave the fractional part",
  6308:"leave the numerator",
  6309:"leave the denominator",
  6310:"take the sine",
  6311:"take the cosine",
  6312:"take the tangent",
  6313:"take the arc sine",
  6314:"take the arc cosine",
  6315:"take the arc tangent",
  6316:"subtract",
  6317:"complement the bits",
  6318:"Bitwise XOR",
  6319:"Bitwise AND",
  6320:"Bitwise OR",
  6321:"something which will",
  6322:" ",
  6323:"multiply by",
  6324:"divide by",
  6325:"change the number it is dropped on to",
  6326:"OR the bits of the number underneath with",
  6327:"AND the bits of the number underneath with",
  6328:"will EXCLUSIVE OR the bits of the number underneath with",
  6329:"Fraction",
  6330:"Integer and\rProper Fraction",
  6331:"Exact Decimal\ror Fraction",
  6332:"Exact Decimal\ror Integer and\rProper Fraction",
  6333:"Numbers and\rFunctions",
  6334:"couldn't do the arithmetic",
  6335:"Natural Log",
  6336:"Log Base 10",
  6337:"compute the natural log",
  6338:"compute the log in base 10",
  6339:"two numbers",
  6340:" ",
  6341:" ",
  6342:"multiply",
  6343:" ",
  6344:"divide",
  6345:" ",
  6346:"OR the bits of",
  6347:" ",
  6348:"AND the bits of",
  6349:" ",
  6350:"EXCLUSIVE OR the bits of",
  6351:" ",
  6352:"raise one number to the power of another",
  6353:"make one number equal to another",
  6400:" ",
  6401:"saved",
  6402:"quadrillion",
  6403:"quadrillion",
  6404:"quintillion",
  6405:"quintillion",
  6406:"sextillion",
  6407:"sextillion",
  6408:"septillion",
  6409:"septillion",
  6410:"octillion",
  6411:"octillion",
  6412:"nonillion",
  6413:"nonillion",
  6414:"llion",
  6415:"llion",
  6416:"over",
  6417:"digits",
  6418:"a negative integer",
  6419:"an integer",
  6420:"the integer",
  6421:"the approximate number",
  6422:"a negative rational number",
  6423:"a rational number",
  6424:"the rational number",
  6425:"Unable to display",
  6426:"digits.",
  6427:"The number itself should be fine. ToonTalk can display it in a base that is a power of 2.",
  6428:"Unable to display this number because it has too many digits.",
  6429:"Press the Esc button to interrupt.",
  6430:"objects loaded.",
  6431:"bytes read from URL.",
  6432:" ",
  6433:" ",
  6434:"a thought bubble received something other than a box",
  6435:"Please wait. ToonTalk is setting up network connections for a long-distance bird.",
  6436:"fkeys_en.jpg",
  6437:"computing a number requires more than 10% of the computer's free memory.                             ",
  6438:"ToonTalk can't make imaginary numbers",
  6439:"Sorry, this is a version of ToonTalk only for running programs. New programs can only be created in the full version.",
  6440:"Run_only_version",
  };
  
  function _LoadStringA(hInst, id, buf, maxLen) {
      var s = TT_RES_STRINGS[id];
      if (s === undefined) {
        // surface the gap: the engine falls back to "sorry I can't remember" (IDC_NO_SUCH_STRING)
        var miss = (globalThis.TT_missingStrings = globalThis.TT_missingStrings || []);
        if (miss.length < 200) { miss.push(id); console.log('[tt] resmiss: ' + id); }
      }
      return TT_writeCStr(buf, maxLen, s === undefined ? '' : s);
    }

  function _LocalFree(p) { if (p) _free(p); return 0; }

  function _LockResource(){ return 0; }

  function _MessageBoxA(){ return 0; }

  function _MoveFileA(){ return 0; }

  function _MoveWindow(){ return 0; }

  function _MultiByteToWideChar(cp, flags, src, srcLen, dst, dstLen) {
      if (!src) return 0;
      var n = srcLen;
      if (n < 0) { n = 0; while (HEAPU8[src + n]) n++; n++; }
      if (!dst || dstLen === 0) return n;
      var m = Math.min(n, dstLen);
      for (var i = 0; i < m; i++) HEAP32[(dst >> 2) + i] = HEAPU8[src + i];
      return m;
    }

  function _OpenClipboard(){ return 0; }

  
  
  
  function _OpenFile(namePtr, ofstruct, style) { if (!namePtr) return -1; var r = TT_resolvePath(UTF8ToString(namePtr)); if (!r) return -1; try { return FS.open(r, 'r').fd; } catch (e) { return -1; } }

  function _OpenIcon(){ return 0; }

  function _PeekMessageA(msgPtr, hwnd, minF, maxF, remove) {
      var q = globalThis.TT_msgq; if (!q || !q.length) return 0;
      var idx = -1;
      for (var i = 0; i < q.length; i++) { var m = q[i].message; if ((minF === 0 && maxF === 0) || (m >= minF && m <= maxF)) { idx = i; break; } }
      if (idx < 0) return 0;
      var e = q[idx];
      if (msgPtr) { var b = msgPtr >> 2; HEAP32[b] = 0; HEAP32[b + 1] = e.message; HEAP32[b + 2] = e.wParam; HEAP32[b + 3] = e.lParam | 0; HEAP32[b + 4] = 0; HEAP32[b + 5] = (globalThis.TT_mouse_x | 0); HEAP32[b + 6] = (globalThis.TT_mouse_y | 0); }
      if (remove & 1) q.splice(idx, 1);
      return 1;
    }

  function _PostMessageA(){ return 0; }

  function _PostQuitMessage(){ return 0; }

  function _ReadFile(fh, buf, toRead, nReadPtr, ovl) {
      var s = FS.streams[fh]; var n = 0;
      if (s) { try { n = FS.read(s, HEAPU8, buf, toRead); } catch (e) { n = 0; } }
      if (nReadPtr) HEAP32[nReadPtr >> 2] = n;
      return s ? 1 : 0;
    }

  function _RedrawWindow(){ return 0; }

  function _RegisterClassA() { return 1; }

  function _ReleaseCapture(){ return 0; }

  function _ReleaseDC(){ return 0; }

  
  
  function _RemoveDirectoryA(namePtr) {
      if (!namePtr) return 0;
      var path = UTF8ToString(namePtr).replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
      try { FS.rmdir(path); return 1; } catch (e) { return 0; }
    }

  function _ScreenToClient(hwnd, ptr) { return 1; }

  function _SendMessageA(){ return 0; }

  function _SetActiveWindow(){ return 0; }

  function _SetCapture(){ return 0; }

  function _SetClipboardData(){ return 0; }

  function _SetCursor(){ return 0; }

  function _SetCursorPos(x, y) { globalThis.TT_mouse_x = x; globalThis.TT_mouse_y = y; return 1; }

  function _SetDlgItemTextA(){ return 0; }

  function _SetErrorMode(){ return 0; }

  function _SetFilePointer(fh, dist, hiPtr, method) { var s = FS.streams[fh]; if (!s) return 0xFFFFFFFF; try { FS.llseek(s, dist, method); } catch (e) {} return s.position >>> 0; }

  function _SetFocus(){ return 0; }

  function _SetForegroundWindow(){ return 0; }

  function _SetMessageQueue(){ return 0; }

  function _SetSystemPaletteUse(){ return 0; }

  function _SetUnhandledExceptionFilter(){ return 0; }

  function _SetWindowLongA(){ return 0; }

  function _SetWindowPos(){ return 0; }

  function _SetWindowTextA(){ return 0; }

  function _ShowCursor(){ return 0; }

  function _ShowWindow(){ return 0; }

  function _SizeofResource(){ return 0; }

  function _Sleep(){ return 0; }

  function _SystemParametersInfoA(){ return 0; }

  function _SystemTimeToFileTime(){ return 0; }

  function _SystemTimeToTzSpecificLocalTime(tzPtr, utcPtr, localPtr) {
      if (!utcPtr || !localPtr) return 0;
      var u = utcPtr >> 1;
      var d = new Date(Date.UTC(HEAPU16[u], HEAPU16[u + 1] - 1, HEAPU16[u + 3],
                                HEAPU16[u + 4], HEAPU16[u + 5], HEAPU16[u + 6], HEAPU16[u + 7]));
      if (isNaN(d.getTime())) return 0;
      var w = localPtr >> 1;
      HEAPU16[w] = d.getFullYear();      HEAPU16[w + 1] = d.getMonth() + 1;
      HEAPU16[w + 2] = d.getDay();       HEAPU16[w + 3] = d.getDate();
      HEAPU16[w + 4] = d.getHours();     HEAPU16[w + 5] = d.getMinutes();
      HEAPU16[w + 6] = d.getSeconds();   HEAPU16[w + 7] = d.getMilliseconds();
      return 1;
    }

  function _TranslateMessage(msgPtr) { return 0; }

  function _UnlockResource(){ return 0; }

  function _UpdateWindow(){ return 0; }

  function _WideCharToMultiByte(cp, flags, src, srcLen, dst, dstLen, defc, used) {
      if (!src) return 0;
      var n = srcLen;
      if (n < 0) { n = 0; while (HEAP32[(src >> 2) + n]) n++; n++; }
      if (!dst || dstLen === 0) return n;
      var m = Math.min(n, dstLen);
      for (var i = 0; i < m; i++) { var c = HEAP32[(src >> 2) + i]; HEAPU8[dst + i] = c < 256 ? c : 63; }
      return m;
    }

  function _WriteFile(){ return 0; }

  function _WritePrivateProfileStringA() { return 1; }

  function __Z10DragFinishPv(){ return 0; }

  function __Z10PlaySoundAPKcPvm(){ return 0; }

  function __Z10UuidCreateP5_GUID(){ return 0; }

  function __Z11timeGetTimev() { return ((typeof performance !== 'undefined') ? performance.now() : Date.now()) >>> 0; }

  function __Z13InternetOpenAPKcmS0_S0_m(){ return 0; }

  function __Z13OleInitializePv(){ return 0; }

  function __Z13ShellExecuteAPvPKcS1_S1_S1_i(){ return 0; }

  function __Z13UuidToStringAP5_GUIDPPh(){ return 0; }

  function __Z14DragQueryFileAPvjPcj(){ return 0; }

  function __Z14DragQueryPointPvP8tagPOINT(){ return 0; }

  function __Z14RevokeDragDropPv(){ return 0; }

  function __Z14RpcStringFreeAPPh(){ return 0; }

  function __Z14destroy_playerP13IDirectPlay4Am(){ return 0; }

  function __Z14mciSendStringAPKcPcjPv(){ return 0; }

  function __Z15DragAcceptFilesPvi(){ return 0; }

  function __Z15UuidFromStringAPhP5_GUID(){ return 0; }

  function __Z15timeBeginPeriodj(){ return 0; }

  function __Z16CreateURLMonikerP8IMonikerPKwPS0_(){ return 0; }

  function __Z16InternetOpenUrlAPvPKcS1_mmm(){ return 0; }

  function __Z16InternetReadFilePvS_mPm(){ return 0; }

  function __Z16RegisterDragDropPvP11IDropTarget(){ return 0; }

  function __Z16ReleaseStgMediumP12tagSTGMEDIUM(){ return 0; }

  function __Z16get_IP_addressesP13IDirectPlay4AmRh(){ return 0; }

  function __Z16receive_messagesv(){ return 0; }

  function __Z18mciGetErrorStringAmPcj(){ return 0; }

  function __Z18message_queue_sizeP13IDirectPlay4A(){ return 0; }

  function __Z19InternetCloseHandlePv(){ return 0; }

  function __Z19release_direct_playv(){ return 0; }

  function __Z20CommitUrlCacheEntryAPKcS0_9_FILETIMES1_mPhmS0_S0_(){ return 0; }

  function __Z20CreateUrlCacheEntryAPKcmS0_Pcm(){ return 0; }

  function __Z20send_network_messageP13IDirectPlay4AmP5_GUIDPhiP4Nest(){ return 0; }

  function __Z21SetUrlCacheEntryInfoAPKcP27_INTERNET_CACHE_ENTRY_INFOAm(){ return 0; }

  function __Z22FindNextUrlCacheEntryAPvP27_INTERNET_CACHE_ENTRY_INFOAPm(){ return 0; }

  function __Z22IP_addresses_of_playerPhmRi(){ return 0; }

  function __Z22initialize_direct_playv(){ return 0; }

  function __Z23FindFirstUrlCacheEntryAPKcP27_INTERNET_CACHE_ENTRY_INFOAPm(){ return 0; }

  function __Z25create_direct_play_objectPc(){ return 0; }

  function __Z26RetrieveUrlCacheEntryFileAPKcP27_INTERNET_CACHE_ENTRY_INFOAPmm(){ return 0; }

  function __Z26join_a_direct_play_sessionP13IDirectPlay4AP5_GUIDP4Nest(){ return 0; }

  function __Z26release_direct_play_objectP13IDirectPlay4A(){ return 0; }

  function __Z28InternetGetLastResponseInfoAPmPcS_(){ return 0; }

  function __Z30host_a_new_direct_play_sessionP13IDirectPlay4AP5_GUIDP4NestPc(){ return 0; }

  function __ZN11CImmProject12CreateEffectEPKcP9CImmMouse(){ return 0; }

  function __ZN11CImmProject8OpenFileEPKcP9CImmMouse(){ return 0; }

  function __ZN11CImmProjectC1Ev(){ return 0; }

  function __ZN11CImmProjectD1Ev(){ return 0; }

  function __ZN16CImmSimpleEffect11GetDurationERm(){ return 0; }

  function __ZN16CImmSimpleEffect12GetDirectionERl(){ return 0; }

  function __ZN16CImmSimpleEffect21ChangeBaseParamsPolarElmP12IMM_ENVELOPElmmmm(){ return 0; }

  function __ZN16CImmSimpleEffect7GetGainERm(){ return 0; }

  function __ZN18CImmCompoundEffect18GetContainedEffectEl(){ return 0; }

  function __ZN18CImmCompoundEffect27GetNumberOfContainedEffectsEv(){ return 0; }

  function __ZN18CImmCompoundEffect4StopEv(){ return 0; }

  function __ZN18CImmCompoundEffect5StartEv(){ return 0; }

  function __ZN7Gdiplus14GdiplusStartupEPmPKNS_19GdiplusStartupInputEPNS_20GdiplusStartupOutputE(){ return 0; }

  function __ZN7Gdiplus15GdiplusShutdownEm(){ return 0; }

  function __ZN7Gdiplus16GetImageEncodersEjjPNS_14ImageCodecInfoE(){ return 0; }

  function __ZN7Gdiplus20GetImageEncodersSizeEPjS0_(){ return 0; }

  function __ZN7Gdiplus5Image4SaveEPKwPK5_GUIDPKNS_17EncoderParametersE(){ return 0; }

  function __ZN7Gdiplus5Image8GetWidthEv(){ return 0; }

  function __ZN7Gdiplus5Image9GetHeightEv(){ return 0; }

  function __ZN7Gdiplus6Bitmap10GetPaletteEPNS_12ColorPaletteEi(){ return 0; }

  function __ZN7Gdiplus6Bitmap10SetPaletteEPKNS_12ColorPaletteE(){ return 0; }

  function __ZN7Gdiplus6Bitmap10UnlockBitsEPNS_10BitmapDataE(){ return 0; }

  function __ZN7Gdiplus6Bitmap14GetPaletteSizeEv(){ return 0; }

  function __ZN7Gdiplus6Bitmap8GetFlagsEv(){ return 0; }

  function __ZN7Gdiplus6Bitmap8GetPixelEiiPNS_5ColorE(){ return 0; }

  function __ZN7Gdiplus6Bitmap8LockBitsEPKNS_4RectEjiPNS_10BitmapDataE(){ return 0; }

  function __ZN7Gdiplus6Bitmap8SetPixelEiiRKNS_5ColorE(){ return 0; }

  function __ZN7Gdiplus6BitmapC1EPKwi(){ return 0; }

  function __ZN7Gdiplus6BitmapC1Eiii(){ return 0; }

  function __ZN9CImmMouse10InitializeEPvS0_(){ return 0; }

  function __ZN9CImmMouse22UsesWin32MouseServicesEi(){ return 0; }

  function __ZN9CImmMouseC1Ev(){ return 0; }

  function __ZNK7Gdiplus5Image13GetLastStatusEv(){ return 0; }

  var ___assert_fail = (condition, filename, line, func) =>
      abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);

  
  
  var ___handle_stack_overflow = (requested) => {
      var base = _emscripten_stack_get_base();
      var end = _emscripten_stack_get_end();
      abort(`stack overflow (Attempt to set SP to ${ptrToString(requested)}` +
            `, with stack limits [${ptrToString(end)} - ${ptrToString(base)}` +
            ']). If you require more stack space build with -sSTACK_SIZE=<bytes>');
    };

  var syscallGetVarargI = () => {
      assert(SYSCALLS.varargs != undefined);
      // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
      var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
      SYSCALLS.varargs += 4;
      return ret;
    };
  var syscallGetVarargP = syscallGetVarargI;
  
  
  
  
  var SYSCALLS = {
  currentUmask:18,
  calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return dir + '/' + path;
      },
  writeStat(buf, stat) {
        HEAPU32[((buf)>>2)] = stat.dev;checkInt32(stat.dev);
        HEAPU32[(((buf)+(4))>>2)] = stat.mode;checkInt32(stat.mode);
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;checkInt32(stat.nlink);
        HEAPU32[(((buf)+(12))>>2)] = stat.uid;checkInt32(stat.uid);
        HEAPU32[(((buf)+(16))>>2)] = stat.gid;checkInt32(stat.gid);
        HEAPU32[(((buf)+(20))>>2)] = stat.rdev;checkInt32(stat.rdev);
        HEAP64[(((buf)+(24))>>3)] = BigInt(stat.size);checkInt64(stat.size);
        HEAP32[(((buf)+(32))>>2)] = 4096;checkInt32(4096);
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;checkInt32(stat.blocks);
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        HEAP64[(((buf)+(40))>>3)] = BigInt(Math.floor(atime / 1000));checkInt64(Math.floor(atime / 1000));
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000 * 1000;checkInt32((atime % 1000) * 1000 * 1000);
        HEAP64[(((buf)+(56))>>3)] = BigInt(Math.floor(mtime / 1000));checkInt64(Math.floor(mtime / 1000));
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000 * 1000;checkInt32((mtime % 1000) * 1000 * 1000);
        HEAP64[(((buf)+(72))>>3)] = BigInt(Math.floor(ctime / 1000));checkInt64(Math.floor(ctime / 1000));
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000 * 1000;checkInt32((ctime % 1000) * 1000 * 1000);
        HEAP64[(((buf)+(88))>>3)] = BigInt(stat.ino);checkInt64(stat.ino);
        return 0;
      },
  writeStatFs(buf, stats) {
        HEAPU32[(((buf)+(4))>>2)] = stats.bsize;checkInt32(stats.bsize);
        HEAPU32[(((buf)+(60))>>2)] = stats.bsize;checkInt32(stats.bsize);
        HEAP64[(((buf)+(8))>>3)] = BigInt(stats.blocks);checkInt64(stats.blocks);
        HEAP64[(((buf)+(16))>>3)] = BigInt(stats.bfree);checkInt64(stats.bfree);
        HEAP64[(((buf)+(24))>>3)] = BigInt(stats.bavail);checkInt64(stats.bavail);
        HEAP64[(((buf)+(32))>>3)] = BigInt(stats.files);checkInt64(stats.files);
        HEAP64[(((buf)+(40))>>3)] = BigInt(stats.ffree);checkInt64(stats.ffree);
        HEAPU32[(((buf)+(48))>>2)] = stats.fsid;checkInt32(stats.fsid);
        HEAPU32[(((buf)+(64))>>2)] = stats.flags;checkInt32(stats.flags);  // ST_NOSUID
        HEAPU32[(((buf)+(56))>>2)] = stats.namelen;checkInt32(stats.namelen);
      },
  doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0;
        }
        var buffer = HEAPU8.subarray(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = syscallGetVarargI();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.dupStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = syscallGetVarargI();
          var mask = 289792;
          stream.flags = (stream.flags & ~mask) | (arg & mask);
          return 0;
        }
        case 12: {
          var arg = syscallGetVarargP();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;checkInt16(2);
          return 0;
        }
        case 13:
        case 14:
          // Pretend that the locking is successful. These are process-level locks,
          // and Emscripten programs are a single process. If we supported linking a
          // filesystem between programs, we'd need to do more here.
          // See https://github.com/emscripten-core/emscripten/issues/23697
          return 0;
      }
      return -28;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_fstat64(fd, buf) {
  try {
  
      return SYSCALLS.writeStat(buf, FS.fstat(fd));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8 requires a third parameter that specifies the length of the output buffer');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  function ___syscall_getdents64(fd, dirp, count) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd)
      stream.getdents ||= FS.readdir(stream.path);
  
      var struct_size = 280;
      var pos = 0;
      var off = FS.llseek(stream, 0, 1);
  
      var startIdx = Math.floor(off / struct_size);
      var endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count/struct_size))
      for (var idx = startIdx; idx < endIdx; idx++) {
        var id;
        var type;
        var name = stream.getdents[idx];
        if (name === '.') {
          id = stream.node.id;
          type = 4;
        }
        else if (name === '..') {
          var lookup = FS.lookupPath(stream.path, { parent: true });
          id = lookup.node.id;
          type = 4;
        }
        else {
          var child;
          try {
            child = FS.lookupNode(stream.node, name);
          } catch (e) {
            // If the entry is not a directory, file, or symlink, nodefs
            // lookupNode will raise EINVAL. Skip these and continue.
            if (e?.errno === 28) {
              continue;
            }
            throw e;
          }
          id = child.id;
          type = FS.isChrdev(child.mode) ? 2 : // character device.
                 FS.isDir(child.mode) ? 4 :    // directory
                 FS.isLink(child.mode) ? 10 :   // symbolic link.
                 8;                            // regular file.
        }
        assert(id);
        HEAP64[((dirp + pos)>>3)] = BigInt(id);checkInt64(id);
        HEAP64[(((dirp + pos)+(8))>>3)] = BigInt((idx + 1) * struct_size);checkInt64((idx + 1) * struct_size);
        HEAP16[(((dirp + pos)+(16))>>1)] = 280;checkInt16(280);
        HEAP8[(dirp + pos)+(18)] = type;checkInt8(type);
        stringToUTF8(name, dirp + pos + 19, 256);
        pos += struct_size;
      }
      FS.llseek(stream, idx * struct_size, 0);
      return pos;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  
  function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21505: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcgets) {
            var termios = stream.tty.ops.ioctl_tcgets(stream);
            var argp = syscallGetVarargP();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;checkInt32(termios.c_iflag || 0);
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;checkInt32(termios.c_oflag || 0);
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;checkInt32(termios.c_cflag || 0);
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;checkInt32(termios.c_lflag || 0);
            for (var i = 0; i < 32; i++) {
              HEAP8[(argp + i)+(17)] = termios.c_cc[i] || 0;checkInt8(termios.c_cc[i] || 0);
            }
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcsets) {
            var argp = syscallGetVarargP();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(argp + i)+(17)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = syscallGetVarargP();
          HEAP32[((argp)>>2)] = 0;checkInt32(0);
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21537:
        case 21531: {
          var argp = syscallGetVarargP();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = syscallGetVarargP();
            HEAP16[((argp)>>1)] = winsize[0];checkInt16(winsize[0]);
            HEAP16[(((argp)+(2))>>1)] = winsize[1];checkInt16(winsize[1]);
          }
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        case 21515: {
          if (!stream.tty) return -59;
          return 0;
        }
        default: return -28; // not supported
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_lstat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.writeStat(buf, FS.lstat(path));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_mkdirat(dirfd, path, mode) {
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      mode &= ~SYSCALLS.currentUmask;
      FS.mkdir(path, mode, 0);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_newfstatat(dirfd, path, buf, flags) {
  try {
  
      path = SYSCALLS.getStr(path);
      var nofollow = flags & 256;
      var allowEmpty = flags & 4096;
      flags = flags & (~6400);
      assert(!flags, `unknown flags in __syscall_newfstatat: ${flags}`);
      path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
      return SYSCALLS.writeStat(buf, nofollow ? FS.lstat(path) : FS.stat(path));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  
  function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      var mode = varargs ? syscallGetVarargI() : 0;
      if (flags & 64) {
        mode &= ~SYSCALLS.currentUmask;
      }
      return FS.open(path, flags, mode).fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_rmdir(path) {
  try {
  
      path = SYSCALLS.getStr(path);
      FS.rmdir(path);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_stat64(path, buf) {
  try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.writeStat(buf, FS.stat(path));
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  function ___syscall_unlinkat(dirfd, path, flags) {
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      if (!flags) {
        FS.unlink(path);
      } else if (flags === 512) {
        FS.rmdir(path);
      } else {
        return -28;
      }
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  var getCppExceptionTag = () => ___cpp_exception;
  
  
  var getCppExceptionThrownObjectFromWebAssemblyException = (ex) => {
      // In Wasm EH, the value extracted from WebAssembly.Exception is a pointer
      // to the unwind header. Convert it to the actual thrown value.
      var unwind_header = ex.getArg(getCppExceptionTag(), 0);
      return ___thrown_object_from_unwind_exception(unwind_header);
    };
  
  
  
  var stackSave = () => _emscripten_stack_get_current();
  
  var stackRestore = (val) => __emscripten_stack_restore(val);
  
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  
  var getExceptionMessageCommon = (ptr) => {
      var sp = stackSave();
      var type_addr_addr = stackAlloc(4);
      var message_addr_addr = stackAlloc(4);
      ___get_exception_message(ptr, type_addr_addr, message_addr_addr);
      var type_addr = HEAPU32[((type_addr_addr)>>2)];
      var message_addr = HEAPU32[((message_addr_addr)>>2)];
      var type = UTF8ToString(type_addr);
      _free(type_addr);
      var message;
      if (message_addr) {
        message = UTF8ToString(message_addr);
        _free(message_addr);
      }
      stackRestore(sp);
      return [type, message];
    };
  var getExceptionMessage = (ex) => {
      var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
      return getExceptionMessageCommon(ptr);
    };
  
  
  var decrementExceptionRefcount = (ex) => {
      var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
      ___cxa_decrement_exception_refcount(ptr);
    };
  
  
  var incrementExceptionRefcount = (ex) => {
      var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
      ___cxa_increment_exception_refcount(ptr);
    };
  var ___throw_exception_with_stack_trace = (ex) => {
      var e = new WebAssembly.Exception(getCppExceptionTag(), [ex], {traceStack: true});
      e.message = getExceptionMessage(e);
      throw e;
    };

  var __abort_js = () =>
      abort('native code called abort()');

  var isLeapYear = (year) => year%4 === 0 && (year%100 !== 0 || year%400 === 0);
  
  var MONTH_DAYS_LEAP_CUMULATIVE = [0,31,60,91,121,152,182,213,244,274,305,335];
  
  var MONTH_DAYS_REGULAR_CUMULATIVE = [0,31,59,90,120,151,181,212,243,273,304,334];
  var ydayFromDate = (date) => {
      var leap = isLeapYear(date.getFullYear());
      var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
      var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1; // -1 since it's days since Jan 1
  
      return yday;
    };
  
  var INT53_MAX = 9007199254740992;
  
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);
  function __localtime_js(time, tmPtr) {
    time = bigintToI53Checked(time);
  
  
      var date = new Date(time*1000);
      HEAP32[((tmPtr)>>2)] = date.getSeconds();checkInt32(date.getSeconds());
      HEAP32[(((tmPtr)+(4))>>2)] = date.getMinutes();checkInt32(date.getMinutes());
      HEAP32[(((tmPtr)+(8))>>2)] = date.getHours();checkInt32(date.getHours());
      HEAP32[(((tmPtr)+(12))>>2)] = date.getDate();checkInt32(date.getDate());
      HEAP32[(((tmPtr)+(16))>>2)] = date.getMonth();checkInt32(date.getMonth());
      HEAP32[(((tmPtr)+(20))>>2)] = date.getFullYear()-1900;checkInt32(date.getFullYear()-1900);
      HEAP32[(((tmPtr)+(24))>>2)] = date.getDay();checkInt32(date.getDay());
  
      var yday = ydayFromDate(date)|0;
      HEAP32[(((tmPtr)+(28))>>2)] = yday;checkInt32(yday);
      HEAP32[(((tmPtr)+(36))>>2)] = -(date.getTimezoneOffset() * 60);checkInt32(-(date.getTimezoneOffset() * 60));
  
      // Attention: DST is in December in South, and some regions don't have DST at all.
      var start = new Date(date.getFullYear(), 0, 1);
      var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
      var winterOffset = start.getTimezoneOffset();
      var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset))|0;
      HEAP32[(((tmPtr)+(32))>>2)] = dst;checkInt32(dst);
    ;
  }

  function __set_new_handler(){ return 0; }

  
  var __tzset_js = (timezone, daylight, std_name, dst_name) => {
      // TODO: Use (malleable) environment variables instead of system settings.
      var currentYear = new Date().getFullYear();
      var winter = new Date(currentYear, 0, 1);
      var summer = new Date(currentYear, 6, 1);
      var winterOffset = winter.getTimezoneOffset();
      var summerOffset = summer.getTimezoneOffset();
  
      // Local standard timezone offset. Local standard time is not adjusted for
      // daylight savings.  This code uses the fact that getTimezoneOffset returns
      // a greater value during Standard Time versus Daylight Saving Time (DST).
      // Thus it determines the expected output during Standard Time, and it
      // compares whether the output of the given date the same (Standard) or less
      // (DST).
      var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  
      // timezone is specified as seconds west of UTC ("The external variable
      // `timezone` shall be set to the difference, in seconds, between
      // Coordinated Universal Time (UTC) and local standard time."), the same
      // as returned by stdTimezoneOffset.
      // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
      HEAPU32[((timezone)>>2)] = stdTimezoneOffset * 60;
  
      HEAP32[((daylight)>>2)] = Number(winterOffset != summerOffset);checkInt32(Number(winterOffset != summerOffset));
  
      var extractZone = (timezoneOffset) => {
        // Why inverse sign?
        // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
        var sign = timezoneOffset >= 0 ? "-" : "+";
  
        var absOffset = Math.abs(timezoneOffset)
        var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
        var minutes = String(absOffset % 60).padStart(2, "0");
  
        return `UTC${sign}${hours}${minutes}`;
      }
  
      var winterName = extractZone(winterOffset);
      var summerName = extractZone(summerOffset);
      assert(winterName);
      assert(summerName);
      assert(lengthBytesUTF8(winterName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${winterName})`);
      assert(lengthBytesUTF8(summerName) <= 16, `timezone name truncated to fit in TZNAME_MAX (${summerName})`);
      if (summerOffset < winterOffset) {
        // Northern hemisphere
        stringToUTF8(winterName, std_name, 17);
        stringToUTF8(summerName, dst_name, 17);
      } else {
        stringToUTF8(winterName, dst_name, 17);
        stringToUTF8(summerName, std_name, 17);
      }
    };

  var readEmAsmArgsArray = [];
  var readEmAsmArgs = (sigPtr, buf) => {
      // Nobody should have mutated _readEmAsmArgsArray underneath us to be something else than an array.
      assert(Array.isArray(readEmAsmArgsArray));
      // The input buffer is allocated on the stack, so it must be stack-aligned.
      assert(buf % 16 == 0);
      readEmAsmArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while (ch = HEAPU8[sigPtr++]) {
        var chr = String.fromCharCode(ch);
        var validChars = ['d', 'f', 'i', 'p'];
        // In WASM_BIGINT mode we support passing i64 values as bigint.
        validChars.push('j');
        assert(validChars.includes(chr), `Invalid character ${ch}("${chr}") in readEmAsmArgs! Use only [${validChars}], and do not specify "v" for void return argument.`);
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = (ch != 105);
        wide &= (ch != 112);
        buf += wide && (buf % 8) ? 4 : 0;
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112 ? HEAPU32[((buf)>>2)] :
          ch == 106 ? HEAP64[((buf)>>3)] :
          ch == 105 ?
            HEAP32[((buf)>>2)] :
            HEAPF64[((buf)>>3)]
        );
        buf += wide ? 8 : 4;
      }
      return readEmAsmArgsArray;
    };
  var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf);
      assert(ASM_CONSTS.hasOwnProperty(code), `No EM_ASM constant found at address ${code}.  The loaded WebAssembly file is likely out of sync with the generated JavaScript.`);
      return ASM_CONSTS[code](...args);
    };
  var _emscripten_asm_const_int = (code, sigPtr, argbuf) => {
      return runEmAsmFunction(code, sigPtr, argbuf);
    };

  
  var _emscripten_set_main_loop_timing = (mode, value) => {
      MainLoop.timingMode = mode;
      MainLoop.timingValue = value;
  
      if (!MainLoop.func) {
        err('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (!MainLoop.running) {
        
        MainLoop.running = true;
      }
      if (mode == 0) {
        MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(MainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
      } else if (mode == 1) {
        MainLoop.scheduler = function MainLoop_scheduler_rAF() {
          MainLoop.requestAnimationFrame(MainLoop.runner);
        };
      } else {
        assert(mode == 2);
        if (!MainLoop.setImmediate) {
          if (globalThis.scheduler) {
            // Some modern browsers implement scheduler.postTask, but not all.
            MainLoop.setImmediate = scheduler.postTask.bind(scheduler);
          } else if (globalThis.setImmediate) {
            MainLoop.setImmediate = setImmediate;
          } else {
            // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
            var setImmediates = [];
            var emscriptenMainLoopMessageId = 'setimmediate';
            /** @param {Event} event */
            var MainLoop_setImmediate_messageHandler = (event) => {
              if (event.data === emscriptenMainLoopMessageId) {
                event.stopPropagation();
                setImmediates.shift()();
              }
            };
            addEventListener("message", MainLoop_setImmediate_messageHandler, true);
            MainLoop.setImmediate = /** @type{function(function(): ?, ...?): number} */((func) => {
              setImmediates.push(func);
              if (ENVIRONMENT_IS_WORKER) {
                // The postMessge API in a Worker, sends message to the main
                // thread and does not support the `targetOrigin` (*) argument.
                postMessage(emscriptenMainLoopMessageId);
              } else {
                postMessage(emscriptenMainLoopMessageId, '*');
              }
            });
          }
        }
        MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
          MainLoop.setImmediate(MainLoop.runner);
        };
      }
      return 0;
    };
  
  var _emscripten_get_now = () => performance.now();
  
  
  var runtimeKeepaliveCounter = 0;
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  var _proc_exit = (code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        Module['onExit']?.(code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    };
  
  
  /** @param {boolean|number=} implicit */
  var exitJS = (status, implicit) => {
      EXITSTATUS = status;
  
      checkUnflushedContent();
  
      // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
      if (keepRuntimeAlive() && !implicit) {
        var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
        err(msg);
      }
  
      _proc_exit(status);
    };
  var _exit = exitJS;
  
  var handleException = (e) => {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS;
      }
      checkStackCookie();
      if (e instanceof WebAssembly.RuntimeError) {
        if (_emscripten_stack_get_current() <= 0) {
          err('Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 16777216)');
        }
      }
      quit_(1, e);
    };
  
  var maybeExit = () => {
      if (!keepRuntimeAlive()) {
        try {
          _exit(EXITSTATUS);
        } catch (e) {
          handleException(e);
        }
      }
    };
  
    /**
   * @param {number=} arg
   * @param {boolean=} noSetTiming
   */
  var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
      assert(!MainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once')
      MainLoop.func = iterFunc;
      MainLoop.arg = arg;
  
      var thisMainLoopId = MainLoop.currentlyRunningMainloop;
      function checkIsRunning() {
        if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
          
          maybeExit();
          return false;
        }
        return true;
      }
  
      // We create the loop runner here but it is not actually running until
      // _emscripten_set_main_loop_timing is called (which might happen at a
      // later time).  This member signifies that the current runner has not
      // yet been started so that we can call runtimeKeepalivePush when it
      // gets its timing set for the first time.
      MainLoop.running = false;
      MainLoop.runner = function MainLoop_runner() {
        if (ABORT) return;
        if (MainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = MainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (MainLoop.remainingBlockers) {
            var remaining = MainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              MainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              MainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          MainLoop.updateStatus();
  
          // catches pause/resume main loop from blocker execution
          if (!checkIsRunning()) return;
  
          setTimeout(MainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (!checkIsRunning()) return;
  
        // Implement very basic swap interval control
        MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
        if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          MainLoop.scheduler();
          return;
        } else if (MainLoop.timingMode == 0) {
          MainLoop.tickStartTime = _emscripten_get_now();
          if (Module['ctx']) {
            warnOnce('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          }
        }
  
        MainLoop.runIter(iterFunc);
  
        // catch pauses from the main loop itself
        if (!checkIsRunning()) return;
  
        MainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps > 0) {
          _emscripten_set_main_loop_timing(0, 1000.0 / fps);
        } else {
          // Do rAF by rendering each frame (no decimating)
          _emscripten_set_main_loop_timing(1, 1);
        }
  
        MainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'unwind';
      }
    };
  
  
  var callUserCallback = (func) => {
      if (ABORT) {
        err('user callback triggered after runtime exited or application aborted.  Ignoring.');
        return;
      }
      try {
        return func();
      } catch (e) {
        handleException(e);
      } finally {
        maybeExit();
      }
    };
  
  var MainLoop = {
  running:false,
  scheduler:null,
  currentlyRunningMainloop:0,
  func:null,
  arg:0,
  timingMode:0,
  timingValue:0,
  currentFrameNumber:0,
  queue:[],
  preMainLoop:[],
  postMainLoop:[],
  pause() {
        MainLoop.scheduler = null;
        // Incrementing this signals the previous main loop that it's now become old, and it must return.
        MainLoop.currentlyRunningMainloop++;
      },
  resume() {
        MainLoop.currentlyRunningMainloop++;
        var timingMode = MainLoop.timingMode;
        var timingValue = MainLoop.timingValue;
        var func = MainLoop.func;
        MainLoop.func = null;
        // do not set timing and call scheduler, we will do it on the next lines
        setMainLoop(func, 0, false, MainLoop.arg, true);
        _emscripten_set_main_loop_timing(timingMode, timingValue);
        MainLoop.scheduler();
      },
  updateStatus() {
        if (Module['setStatus']) {
          var message = Module['statusMessage'] || 'Please wait...';
          var remaining = MainLoop.remainingBlockers ?? 0;
          var expected = MainLoop.expectedBlockers ?? 0;
          if (remaining) {
            if (remaining < expected) {
              Module['setStatus'](`{message} ({expected - remaining}/{expected})`);
            } else {
              Module['setStatus'](message);
            }
          } else {
            Module['setStatus']('');
          }
        }
      },
  init() {
        Module['preMainLoop'] && MainLoop.preMainLoop.push(Module['preMainLoop']);
        Module['postMainLoop'] && MainLoop.postMainLoop.push(Module['postMainLoop']);
      },
  runIter(func) {
        if (ABORT) return;
        for (var pre of MainLoop.preMainLoop) {
          if (pre() === false) {
            return; // |return false| skips a frame
          }
        }
        callUserCallback(func);
        for (var post of MainLoop.postMainLoop) {
          post();
        }
        checkStackCookie();
      },
  nextRAF:0,
  fakeRequestAnimationFrame(func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (MainLoop.nextRAF === 0) {
          MainLoop.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= MainLoop.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            MainLoop.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(MainLoop.nextRAF - now, 0);
        setTimeout(func, delay);
      },
  requestAnimationFrame(func) {
        if (globalThis.requestAnimationFrame) {
          requestAnimationFrame(func);
        } else {
          MainLoop.fakeRequestAnimationFrame(func);
        }
      },
  };
  var _emscripten_cancel_main_loop = () => {
      MainLoop.pause();
      MainLoop.func = null;
    };

  var _emscripten_date_now = () => Date.now();


  
  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var alignMemory = (size, alignment) => {
      assert(alignment, 'alignment argument is required');
      return Math.ceil(size / alignment) * alignment;
    };
  
  var growMemory = (size) => {
      var oldHeapSize = wasmMemory.buffer.byteLength;
      var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    };
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var t0 = _emscripten_get_now();
        var replacement = growMemory(newSize);
        var t1 = _emscripten_get_now();
        dbg(`Heap resize call from ${oldSize} to ${newSize} took ${(t1 - t0)} msecs. Success: ${!!replacement}`);
        if (replacement) {
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  
  var wasmTableMirror = [];
  
  
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        /** @suppress {checkTypes} */
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      /** @suppress {checkTypes} */
      assert(wasmTable.get(funcPtr) == func, 'table mirror is out of date');
      return func;
    };
  var _emscripten_set_main_loop = (func, fps, simulateInfiniteLoop) => {
      var iterFunc = getWasmTableEntry(func);
      setMainLoop(iterFunc, fps, simulateInfiniteLoop);
    };

  var ENV = {
  };
  
  var getExecutableName = () => thisProgram;
  var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        // Default values.
        var lang = (globalThis.navigator?.language ?? 'C').replace('-', '_') + '.UTF-8';
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          'LANG': lang,
          '_': getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          // x is a key in ENV; if ENV[x] is undefined, that means it was
          // explicitly set to be so. We allow user code to do that to
          // force variables with default values to remain unset.
          if (ENV[x] === undefined) delete env[x];
          else env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(`${x}=${env[x]}`);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    };
  
  var _environ_get = (__environ, environ_buf) => {
      var bufSize = 0;
      var envp = 0;
      for (var string of getEnvStrings()) {
        var ptr = environ_buf + bufSize;
        HEAPU32[(((__environ)+(envp))>>2)] = ptr;
        bufSize += stringToUTF8(string, ptr, Infinity) + 1;
        envp += 4;
      }
      return 0;
    };

  
  var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
      var strings = getEnvStrings();
      HEAPU32[((penviron_count)>>2)] = strings.length;checkInt32(strings.length);
      var bufSize = 0;
      for (var string of strings) {
        bufSize += lengthBytesUTF8(string) + 1;
      }
      HEAPU32[((penviron_buf_size)>>2)] = bufSize;checkInt32(bufSize);
      return 0;
    };


  function _fd_close(fd) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  /** @param {number=} offset */
  var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.read(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break; // nothing more to read
        if (typeof offset != 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_read(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doReadv(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;checkInt32(num);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
  
  
  try {
  
      if (isNaN(offset)) return 22;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      HEAP64[((newOffset)>>3)] = BigInt(stream.position);checkInt64(stream.position);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  /** @param {number=} offset */
  var doWritev = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        var curr = FS.write(stream, HEAP8, ptr, len, offset);
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) {
          // No more space to write.
          break;
        }
        if (typeof offset != 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  function _fd_write(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doWritev(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;checkInt32(num);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  function _mmioAdvance(){ return 0; }

  function _mmioAscend(){ return 0; }

  function _mmioClose(){ return 0; }

  function _mmioDescend(){ return 0; }

  function _mmioGetInfo(){ return 0; }

  function _mmioOpenA(){ return 0; }

  function _mmioRead(){ return 0; }

  function _mmioSeek(){ return 0; }

  function _mmioSetInfo(){ return 0; }




  var FS_createPath = (...args) => FS.createPath(...args);



  var FS_unlink = (...args) => FS.unlink(...args);

  var FS_createLazyFile = (...args) => FS.createLazyFile(...args);

  var FS_createDevice = (...args) => FS.createDevice(...args);



  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.preloadFile = FS_preloadFile;
  FS.staticInit();;

      Module['requestAnimationFrame'] = MainLoop.requestAnimationFrame;
      Module['pauseMainLoop'] = MainLoop.pause;
      Module['resumeMainLoop'] = MainLoop.resume;
      MainLoop.init();;
// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];
if (Module['preloadPlugins']) preloadPlugins = Module['preloadPlugins'];
if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
  // End ATMODULES hooks

  checkIncomingModuleAPI();

  if (Module['arguments']) programArgs = Module['arguments'];
  if (Module['thisProgram']) thisProgram = Module['thisProgram'];

  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['read'] == 'undefined', 'Module.read option was removed');
  assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
  assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
  assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
  assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
  assert(typeof Module['ENVIRONMENT'] == 'undefined', 'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
  assert(typeof Module['STACK_SIZE'] == 'undefined', 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module['wasmMemory'] == 'undefined', 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
  assert(typeof Module['INITIAL_MEMORY'] == 'undefined', 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

  if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
      Module['preInit'].shift()();
    }
  }
  consumedModuleProp('preInit');
}

// Begin runtime exports
  Module['addRunDependency'] = addRunDependency;
  Module['removeRunDependency'] = removeRunDependency;
  Module['FS_preloadFile'] = FS_preloadFile;
  Module['FS_unlink'] = FS_unlink;
  Module['FS_createPath'] = FS_createPath;
  Module['FS_createDevice'] = FS_createDevice;
  Module['FS_createDataFile'] = FS_createDataFile;
  Module['FS_createLazyFile'] = FS_createLazyFile;
  var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertI32PairToI53Checked',
  'convertU32PairToI53',
  'getTempRet0',
  'setTempRet0',
  'createNamedFunction',
  'zeroMemory',
  'withStackSave',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'runMainThreadEmAsm',
  'jstoi_q',
  'autoResumeAudioContext',
  'getDynCaller',
  'dynCall',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'asmjsMangle',
  'HandleAllocator',
  'addOnInit',
  'addOnPostCtor',
  'addOnPreMain',
  'addOnExit',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'ccall',
  'cwrap',
  'convertJsFunctionToWasm',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'addFunction',
  'removeFunction',
  'intArrayToString',
  'AsciiToString',
  'stringToAscii',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'stringToNewUTF8',
  'stringToUTF8OnStack',
  'writeArrayToMemory',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'getCallstack',
  'convertPCtoSourceLocation',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'safeSetTimeout',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'addPromise',
  'idsToPromises',
  'makePromiseCallback',
  'Browser_asyncPrepareDataCounter',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'toTypedArrayIndex',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'webgl_enable_EXT_polygon_offset_clamp',
  'webgl_enable_EXT_clip_control',
  'webgl_enable_WEBGL_polygon_mode',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetProgramUniformLocation',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'ALLOC_NORMAL',
  'ALLOC_STACK',
  'allocate',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'demangle',
  'stackTrace',
  'getNativeTypeSize',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

  var unexportedSymbols = [
  'run',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmExports',
  'writeStackCookie',
  'checkStackCookie',
  'INT53_MAX',
  'INT53_MIN',
  'bigintToI53Checked',
  'HEAP8',
  'HEAPU8',
  'HEAP16',
  'HEAPU16',
  'HEAP32',
  'HEAPU32',
  'HEAPF32',
  'HEAPF64',
  'HEAP64',
  'HEAPU64',
  'stackSave',
  'stackRestore',
  'stackAlloc',
  'ptrToString',
  'exitJS',
  'getHeapMax',
  'growMemory',
  'ENV',
  'setStackLimits',
  'ERRNO_CODES',
  'strError',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'readEmAsmArgs',
  'runEmAsmFunction',
  'getExecutableName',
  'handleException',
  'keepRuntimeAlive',
  'callUserCallback',
  'maybeExit',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'wasmTable',
  'wasmMemory',
  'getUniqueRunDependency',
  'noExitRuntime',
  'addOnPreRun',
  'addOnPostRun',
  'freeTableIndexes',
  'functionsInTableMap',
  'setValue',
  'getValue',
  'PATH',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'UTF8ToString',
  'stringToUTF8Array',
  'stringToUTF8',
  'lengthBytesUTF8',
  'intArrayFromString',
  'UTF16Decoder',
  'JSEvents',
  'specialHTMLTargets',
  'findCanvasEventTarget',
  'currentFullscreenStrategy',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'getEnvStrings',
  'doReadv',
  'doWritev',
  'initRandomFill',
  'randomFill',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'getExceptionMessageCommon',
  'getCppExceptionTag',
  'getCppExceptionThrownObjectFromWebAssemblyException',
  'incrementUncaughtExceptionCount',
  'decrementUncaughtExceptionCount',
  'incrementExceptionRefcount',
  'decrementExceptionRefcount',
  'getExceptionMessage',
  'Browser',
  'requestFullscreen',
  'requestFullScreen',
  'setCanvasSize',
  'getUserMedia',
  'createContext',
  'getPreloadedImageData__data',
  'wget',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'isLeapYear',
  'ydayFromDate',
  'SYSCALLS',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_fileDataToTypedArray',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS_readFile',
  'FS',
  'FS_root',
  'FS_mounts',
  'FS_devices',
  'FS_streams',
  'FS_nextInode',
  'FS_nameTable',
  'FS_currentPath',
  'FS_initialized',
  'FS_ignorePermissions',
  'FS_filesystems',
  'FS_syncFSRequests',
  'FS_lookupPath',
  'FS_getPath',
  'FS_hashName',
  'FS_hashAddNode',
  'FS_hashRemoveNode',
  'FS_lookupNode',
  'FS_createNode',
  'FS_destroyNode',
  'FS_isRoot',
  'FS_isMountpoint',
  'FS_isFile',
  'FS_isDir',
  'FS_isLink',
  'FS_isChrdev',
  'FS_isBlkdev',
  'FS_isFIFO',
  'FS_isSocket',
  'FS_flagsToPermissionString',
  'FS_nodePermissions',
  'FS_mayLookup',
  'FS_mayCreate',
  'FS_mayDelete',
  'FS_mayOpen',
  'FS_checkOpExists',
  'FS_nextfd',
  'FS_getStreamChecked',
  'FS_getStream',
  'FS_createStream',
  'FS_closeStream',
  'FS_dupStream',
  'FS_doSetAttr',
  'FS_chrdev_stream_ops',
  'FS_major',
  'FS_minor',
  'FS_makedev',
  'FS_registerDevice',
  'FS_getDevice',
  'FS_getMounts',
  'FS_syncfs',
  'FS_mount',
  'FS_unmount',
  'FS_lookup',
  'FS_mknod',
  'FS_statfs',
  'FS_statfsStream',
  'FS_statfsNode',
  'FS_create',
  'FS_mkdir',
  'FS_mkdev',
  'FS_symlink',
  'FS_rename',
  'FS_rmdir',
  'FS_readdir',
  'FS_readlink',
  'FS_stat',
  'FS_fstat',
  'FS_lstat',
  'FS_doChmod',
  'FS_chmod',
  'FS_lchmod',
  'FS_fchmod',
  'FS_doChown',
  'FS_chown',
  'FS_lchown',
  'FS_fchown',
  'FS_doTruncate',
  'FS_truncate',
  'FS_ftruncate',
  'FS_utime',
  'FS_open',
  'FS_close',
  'FS_isClosed',
  'FS_llseek',
  'FS_read',
  'FS_write',
  'FS_mmap',
  'FS_msync',
  'FS_ioctl',
  'FS_writeFile',
  'FS_cwd',
  'FS_chdir',
  'FS_createDefaultDirectories',
  'FS_createDefaultDevices',
  'FS_createSpecialDirectories',
  'FS_createStandardStreams',
  'FS_staticInit',
  'FS_init',
  'FS_quit',
  'FS_findObject',
  'FS_analyzePath',
  'FS_createFile',
  'FS_forceLoadFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'print',
  'printErr',
  'jstoi_s',
  'TT_isAlpha',
  'TT_writeCStr',
  'TT_readIniValue',
  'TT_resolvePath',
  'TT_sysStatics',
  'TT_palettes',
  'TT_RES_STRINGS',
  'IDBFS',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

  // End runtime exports
  // Begin JS library exports
  // End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
  ignoredModuleProp('logReadFiles');
  ignoredModuleProp('loadSplitModule');
  ignoredModuleProp('onMalloc');
  ignoredModuleProp('onRealloc');
  ignoredModuleProp('onFree');
  ignoredModuleProp('onSbrkGrow');
  ignoredModuleProp('onCOSCacheHit');
  ignoredModuleProp('onCOSCacheMiss');
  ignoredModuleProp('onCOSStore');
}
var ASM_CONSTS = {
  17072924: ($0, $1) => { if (globalThis.TT_engineFailed) globalThis.TT_engineFailed(UTF8ToString($0), UTF8ToString($1)); },  
 17073024: ($0, $1, $2, $3) => { if (typeof TT_present === 'function') TT_present($0, $1, $2, $3); },  
 17073094: ($0) => { var s = (typeof TT_cmdline === 'string') ? TT_cmdline : ''; if (s) stringToUTF8(s, $0, 1023); },  
 17073192: () => { globalThis.TT_replayOver = true; },  
 17073229: () => { return (typeof location !== 'undefined' && location.search.indexOf('wand=1') >= 0) ? 1 : 0; },  
 17073325: () => { return (typeof location !== 'undefined' && location.search.indexOf('textpad=1') >= 0) ? 1 : 0; },  
 17073424: () => { return (typeof location !== 'undefined' && location.search.indexOf('padlong=1') >= 0) ? 1 : 0; },  
 17073523: () => { return (typeof location !== 'undefined' && location.search.indexOf('copyrobots=1') >= 0) ? 1 : 0; },  
 17073625: () => { var m = (typeof location !== 'undefined') ? location.search.match(new RegExp('robotpage=([0-9]+)')) : null; return m ? parseInt(m[1]) : 2; },  
 17073768: () => { return (typeof location !== 'undefined' && location.search.indexOf('runrobot=1') >= 0) ? 1 : 0; },  
 17073868: () => { var m = (typeof location !== 'undefined') ? location.search.match(new RegExp('subpage=([0-9]+)')) : null; return m ? parseInt(m[1]) : 0; },  
 17074009: () => { if (globalThis.TT_persistSave) globalThis.TT_persistSave('history'); },  
 17074082: () => { return (typeof location !== 'undefined' && /[?&]probes=1/.test(location.search)) ? 1 : 0; },  
 17074176: () => { return (typeof location !== 'undefined' && /[?&]floor=1/.test(location.search)) ? 1 : 0; },  
 17074269: () => { if (globalThis.TT_leaveDemo) globalThis.TT_leaveDemo(); },  
 17074329: ($0) => { if (globalThis.TT_demoPause) globalThis.TT_demoPause($0); }
};
function tt_ds_play(id,pcm,bytes,channels,rate,bits,loop,playing_flag) { try { var DS = Module.TT_ds || (Module.TT_ds = { ctx: null, srcs: {}, gains: {}, vols: {} }); if (!DS.ctx) { var AC = (typeof AudioContext !== 'undefined') ? AudioContext : (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null; if (!AC) return; DS.ctx = new AC(); } if (DS.ctx.state === 'suspended' && globalThis.TT_volume !== 0) { try { DS.ctx.resume(); } catch (e) {} } if (DS.srcs[id]) { var prev = DS.srcs[id]; try { prev.onended = null; } catch (e) {} try { prev.stop(); } catch (e) {} try { prev.disconnect(); } catch (e) {} delete DS.srcs[id]; } var bytesPerSample = bits >>> 3; var frames = (bytes / (bytesPerSample * channels)) | 0; if (frames <= 0) return; var ab = DS.ctx.createBuffer(channels, frames, rate); for (var ch = 0; ch < channels; ch++) { var out = ab.getChannelData(ch); if (bits === 8) { for (var i = 0; i < frames; i++) out[i] = (HEAPU8[pcm + i * channels + ch] - 128) / 128; } else { for (var j = 0; j < frames; j++) { var lo = HEAPU8[pcm + (j * channels + ch) * 2]; var hi = HEAPU8[pcm + (j * channels + ch) * 2 + 1]; var v = (hi << 8) | lo; if (v >= 0x8000) v -= 0x10000; out[j] = v / 32768; } } } var gain = DS.gains[id]; if (!DS.master) { DS.master = DS.ctx.createGain(); DS.master.gain.value = (globalThis.TT_volume !== undefined) ? globalThis.TT_volume : 1; DS.master.connect(DS.ctx.destination); } if (!DS.bus) { DS.bus = DS.ctx.createGain(); DS.bus.connect(DS.master); try { DS.probe = DS.ctx.createAnalyser(); DS.probe.fftSize = 1024; DS.bus.connect(DS.probe); } catch (e) {} } if (!gain) { gain = DS.ctx.createGain(); gain.connect(DS.bus); DS.gains[id] = gain; } gain.gain.value = (DS.vols[id] !== undefined) ? DS.vols[id] : 1; var src = DS.ctx.createBufferSource(); src.buffer = ab; src.loop = !!loop; src.connect(gain); if (loop) { DS.loopLog = (DS.loopLog || 0) + 1; if (DS.loopLog <= 12) { var m = '[tt] loopsnd: START buffer=' + id + ' ' + (frames / rate).toFixed(2) + 's'; (globalThis.TT_log = globalThis.TT_log || []).push(m); console.log(m); } } if (!loop) src.onended = function () { HEAP8[playing_flag] = 0; delete DS.srcs[id]; }; HEAP8[playing_flag] = 1; if (!DS.flags) DS.flags = {}; DS.flags[id] = playing_flag; DS.srcs[id] = src; if (!DS.all) DS.all = []; var ent = { id: id, src: src, ended: false }; try { src.addEventListener('ended', function () { ent.ended = true; }); } catch (e) {} DS.all.push(ent); if (DS.all.length > 64) DS.all.splice(0, DS.all.length - 64); src.start(); } catch (e) { } }
function tt_ds_stop(id,playing_flag) { var DS = Module.TT_ds; if (DS && DS.srcs[id]) { if (DS.srcs[id].loop && (DS.loopLog || 0) <= 12) { var m2 = '[tt] loopsnd: STOP buffer=' + id; (globalThis.TT_log = globalThis.TT_log || []).push(m2); console.log(m2); } var s0 = DS.srcs[id]; try { s0.onended = null; } catch (e) {} try { s0.stop(); } catch (e) {} try { s0.disconnect(); } catch (e) {} delete DS.srcs[id]; } HEAP8[playing_flag] = 0; }
function tt_ds_stop_all() { var DS = Module.TT_ds; if (!DS || !DS.srcs) return; for (var k in DS.srcs) { var s = DS.srcs[k]; try { s.onended = null; } catch (e) {} try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} delete DS.srcs[k]; } if (DS.all) { for (var i = 0; i < DS.all.length; i++) DS.all[i].dead = true; } }
function tt_ds_stop_effects() { var DS = Module.TT_ds; if (!DS || !DS.srcs) return; for (var k in DS.srcs) { if (k === '0') continue; try { DS.srcs[k].onended = null; DS.srcs[k].stop(); } catch (e) {} delete DS.srcs[k]; } }
function tt_ds_stop_looping() { var DS = Module.TT_ds; if (!DS || !DS.srcs) return 0; var n = 0; for (var k in DS.srcs) { if (!DS.srcs[k].loop) continue; n++; try { DS.srcs[k].onended = null; DS.srcs[k].stop(); } catch (e) {} delete DS.srcs[k]; } return n; }
function tt_ds_reconcile() { var DS = Module.TT_ds; if (!DS || !DS.srcs || !DS.flags) return 0; var stopped = 0; var kill = function (s) { try { s.onended = null; } catch (e) {} try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} }; for (var k in DS.srcs) { var flag = DS.flags[k]; if (flag === undefined) continue; if (HEAP8[flag] !== 0) continue; kill(DS.srcs[k]); delete DS.srcs[k]; stopped++; } if (DS.all) { for (var i = DS.all.length - 1; i >= 0; i--) { var e = DS.all[i]; if (e.dead || e.ended) continue; if (DS.srcs[e.id] === e.src) continue; var f = DS.flags[e.id]; if (f !== undefined && HEAP8[f] !== 0) continue; kill(e.src); e.dead = true; DS.rescued = (DS.rescued || []); DS.rescued.push(e.id); stopped++; } } return stopped; }
function tt_ds_ghost_level() { var DS = Module.TT_ds; if (!DS || !DS.probe || !DS.ctx || DS.ctx.state !== 'running') return 0; for (var k in DS.srcs) return 0; if (DS.all) { for (var i = 0; i < DS.all.length; i++) { var e = DS.all[i]; if (!e.dead && !e.ended) return 0; } } var b = new Float32Array(DS.probe.fftSize); DS.probe.getFloatTimeDomainData(b); var t = 0; for (var j = 0; j < b.length; j++) t += b[j] * b[j]; var rms = Math.sqrt(t / b.length); return (rms > 0.0005) ? Math.round(rms * 10000) : 0; }
function tt_ds_last_rescued() { var DS = Module.TT_ds; if (!DS || !DS.rescued || !DS.rescued.length) return -1; return DS.rescued[DS.rescued.length - 1]; }
function tt_ds_volume(id,gain) { var DS = Module.TT_ds || (Module.TT_ds = { ctx: null, srcs: {}, gains: {}, vols: {} }); DS.vols[id] = gain; if (DS.gains[id]) DS.gains[id].gain.value = gain; }
function tt_ds_free(id) { var DS = Module.TT_ds; if (!DS) return; if (DS.srcs[id]) { var sf = DS.srcs[id]; try { sf.onended = null; } catch (e) {} try { sf.stop(); } catch (e) {} try { sf.disconnect(); } catch (e) {} delete DS.srcs[id]; } if (DS.gains[id]) { try { DS.gains[id].disconnect(); } catch (e) {} delete DS.gains[id]; } delete DS.vols[id]; }
function tt_text_hwidth(text,len,cell_h,cell_w,fixed) { try { if (len <= 0) return 0; var s = ''; for (var i = 0; i < len; i++) s += String.fromCharCode(HEAPU16[(text >> 1) + i]); var g = Module.TT_txt; if (!g) { g = Module.TT_txt = {}; g.cv = document.createElement('canvas'); g.cx = g.cv.getContext('2d', { willReadFrequently: true }); g.avg = {}; } var cx = g.cx, px = cell_h; var fam = fixed ? '"Courier New", "Consolas", monospace' : '"Arial", "Helvetica", "Liberation Sans", sans-serif'; cx.font = 'bold ' + px + 'px ' + fam; var natural = cx.measureText(s).width; var sx = 1; if (cell_w > 0) { var k = px + (fixed ? 'f' : 'p'); var a = g.avg[k]; if (!a) { a = cx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').width / 52; if (!(a > 0)) a = px * 0.55; g.avg[k] = a; } sx = cell_w / a; } return Math.ceil(natural * sx); } catch (e) { return len * (cell_w > 0 ? cell_w : cell_h); } }
function tt_text_raster(text,len,cell_h,cell_w,out,out_w,out_h,fixed) { try { if (len <= 0 || out_w <= 0 || out_h <= 0) return 0; var s = ''; for (var i = 0; i < len; i++) s += String.fromCharCode(HEAPU16[(text >> 1) + i]); var g = Module.TT_txt; if (!g) { g = Module.TT_txt = {}; g.cv = document.createElement('canvas'); g.cx = g.cv.getContext('2d', { willReadFrequently: true }); g.avg = {}; } if (g.cv.width < out_w || g.cv.height < out_h) { g.cv.width = Math.max(g.cv.width, out_w); g.cv.height = Math.max(g.cv.height, out_h); } var cx = g.cx; var fam = fixed ? '"Courier New", "Consolas", monospace' : '"Arial", "Helvetica", "Liberation Sans", sans-serif'; var px = cell_h; cx.font = 'bold ' + px + 'px ' + fam; var m = cx.measureText(s); var asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent; if (!(asc > 0)) asc = px * 0.75; if (!(desc >= 0)) desc = px * 0.25; if (asc + desc > cell_h && asc + desc > 0) { px = Math.max(1, Math.floor(px * cell_h / (asc + desc))); cx.font = 'bold ' + px + 'px ' + fam; m = cx.measureText(s); asc = m.actualBoundingBoxAscent; if (!(asc > 0)) asc = px * 0.75; desc = m.actualBoundingBoxDescent; if (!(desc >= 0)) desc = px * 0.25; } if (!(m.width > 0)) return 0; var sx = 1; if (cell_w > 0) { var k2 = px + (fixed ? 'f' : 'p'); var a = g.avg[k2]; if (!a) { a = cx.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').width / 52; if (!(a > 0)) a = px * 0.55; g.avg[k2] = a; } sx = cell_w / a; } var base = cell_h / 2 + (asc - desc) / 2; if (base - asc < 0) base = asc; if (base + desc > cell_h) base = cell_h - desc; var originX = 0; if (len === 1 && cell_w > 0) { var inkL = m.actualBoundingBoxLeft, inkR = m.actualBoundingBoxRight; if (!isFinite(inkL) || !isFinite(inkR)) { inkL = 0; inkR = m.width; } originX = cell_w / (2 * sx) - (inkR - inkL) / 2; } cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, out_w, out_h); cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic'; cx.setTransform(sx, 0, 0, 1, 0, 0); cx.fillText(s, originX, base); cx.setTransform(1, 0, 0, 1, 0, 0); var img = cx.getImageData(0, 0, out_w, out_h).data; for (var k = 0, n = out_w * out_h; k < n; k++) HEAPU8[out + k] = img[k * 4 + 3]; return 1; } catch (e) { return 0; } }
function tt_tts_speak(utf8,id,replaying_now) { try { if (typeof speechSynthesis === 'undefined') return 0; if (globalThis.TT_ttsOff === undefined) { globalThis.TT_ttsOff = (typeof location !== 'undefined' && /[?&]tts=0/.test(location.search)) ? 1 : 0; } if (globalThis.TT_ttsOff) return 0; var s = UTF8ToString(utf8); if (!s || !s.length) return 0; var u = new SpeechSynthesisUtterance(s); if (!globalThis.TT_martyVoice) { var vs = speechSynthesis.getVoices() || []; for (var i = 0; i < vs.length; i++) { var n = (vs[i].name || '').toLowerCase(); if ((vs[i].lang || '').indexOf('en') === 0 && (n.indexOf('male') >= 0 || n.indexOf('david') >= 0 || n.indexOf('mark') >= 0 || n.indexOf('george') >= 0 || n.indexOf('daniel') >= 0)) { globalThis.TT_martyVoice = vs[i]; break; } } } if (globalThis.TT_martyVoice) u.voice = globalThis.TT_martyVoice; u.pitch = 1.3; u.rate = 1.0; u.volume = (globalThis.TT_volume !== undefined) ? globalThis.TT_volume : 1; if (!replaying_now) { u.onend = function () { if (Module['_tt_tts_finished']) Module['_tt_tts_finished'](id); }; } speechSynthesis.speak(u); return 1; } catch (e) { return 0; } }

// Imports from the Wasm binary.
var _fflush = makeInvalidEarlyAccess('_fflush');
var _free = makeInvalidEarlyAccess('_free');
var _malloc = makeInvalidEarlyAccess('_malloc');
var _main = Module['_main'] = makeInvalidEarlyAccess('_main');
var _realloc = makeInvalidEarlyAccess('_realloc');
var _tt_dev_open_rocket_door = Module['_tt_dev_open_rocket_door'] = makeInvalidEarlyAccess('_tt_dev_open_rocket_door');
var _tt_dev_time_label = Module['_tt_dev_time_label'] = makeInvalidEarlyAccess('_tt_dev_time_label');
var _tt_dev_time_travel_button = Module['_tt_dev_time_travel_button'] = makeInvalidEarlyAccess('_tt_dev_time_travel_button');
var _tt_finish_time_travel_archive = Module['_tt_finish_time_travel_archive'] = makeInvalidEarlyAccess('_tt_finish_time_travel_archive');
var _em_set_mouse_mode = Module['_em_set_mouse_mode'] = makeInvalidEarlyAccess('_em_set_mouse_mode');
var _em_on_floor = Module['_em_on_floor'] = makeInvalidEarlyAccess('_em_on_floor');
var _tt_dev_tts_size = Module['_tt_dev_tts_size'] = makeInvalidEarlyAccess('_tt_dev_tts_size');
var _tt_dev_tts_drop_erased = Module['_tt_dev_tts_drop_erased'] = makeInvalidEarlyAccess('_tt_dev_tts_drop_erased');
var _tt_dev_tts_probe = Module['_tt_dev_tts_probe'] = makeInvalidEarlyAccess('_tt_dev_tts_probe');
var _tt_tts_finished = Module['_tt_tts_finished'] = makeInvalidEarlyAccess('_tt_tts_finished');
var _tt_dispatch_to_wndproc = Module['_tt_dispatch_to_wndproc'] = makeInvalidEarlyAccess('_tt_dispatch_to_wndproc');
var _tt_save_city = Module['_tt_save_city'] = makeInvalidEarlyAccess('_tt_save_city');
var _tt_demo_pause_choice = Module['_tt_demo_pause_choice'] = makeInvalidEarlyAccess('_tt_demo_pause_choice');
var _tt_dev_xml_bench = Module['_tt_dev_xml_bench'] = makeInvalidEarlyAccess('_tt_dev_xml_bench');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _strerror = makeInvalidEarlyAccess('_strerror');
var ___trap = makeInvalidEarlyAccess('___trap');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var ___cxa_decrement_exception_refcount = makeInvalidEarlyAccess('___cxa_decrement_exception_refcount');
var ___cxa_increment_exception_refcount = makeInvalidEarlyAccess('___cxa_increment_exception_refcount');
var ___thrown_object_from_unwind_exception = makeInvalidEarlyAccess('___thrown_object_from_unwind_exception');
var ___get_exception_message = makeInvalidEarlyAccess('___get_exception_message');
var ___set_stack_limits = Module['___set_stack_limits'] = makeInvalidEarlyAccess('___set_stack_limits');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var ___cpp_exception = makeInvalidEarlyAccess('___cpp_exception');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');
var wasmTable = makeInvalidEarlyAccess('wasmTable');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['main'] != 'undefined', 'missing Wasm export: main');
  assert(typeof wasmExports['realloc'] != 'undefined', 'missing Wasm export: realloc');
  assert(typeof wasmExports['tt_dev_open_rocket_door'] != 'undefined', 'missing Wasm export: tt_dev_open_rocket_door');
  assert(typeof wasmExports['tt_dev_time_label'] != 'undefined', 'missing Wasm export: tt_dev_time_label');
  assert(typeof wasmExports['tt_dev_time_travel_button'] != 'undefined', 'missing Wasm export: tt_dev_time_travel_button');
  assert(typeof wasmExports['tt_finish_time_travel_archive'] != 'undefined', 'missing Wasm export: tt_finish_time_travel_archive');
  assert(typeof wasmExports['em_set_mouse_mode'] != 'undefined', 'missing Wasm export: em_set_mouse_mode');
  assert(typeof wasmExports['em_on_floor'] != 'undefined', 'missing Wasm export: em_on_floor');
  assert(typeof wasmExports['tt_dev_tts_size'] != 'undefined', 'missing Wasm export: tt_dev_tts_size');
  assert(typeof wasmExports['tt_dev_tts_drop_erased'] != 'undefined', 'missing Wasm export: tt_dev_tts_drop_erased');
  assert(typeof wasmExports['tt_dev_tts_probe'] != 'undefined', 'missing Wasm export: tt_dev_tts_probe');
  assert(typeof wasmExports['tt_tts_finished'] != 'undefined', 'missing Wasm export: tt_tts_finished');
  assert(typeof wasmExports['tt_dispatch_to_wndproc'] != 'undefined', 'missing Wasm export: tt_dispatch_to_wndproc');
  assert(typeof wasmExports['tt_save_city'] != 'undefined', 'missing Wasm export: tt_save_city');
  assert(typeof wasmExports['tt_demo_pause_choice'] != 'undefined', 'missing Wasm export: tt_demo_pause_choice');
  assert(typeof wasmExports['tt_dev_xml_bench'] != 'undefined', 'missing Wasm export: tt_dev_xml_bench');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['__trap'] != 'undefined', 'missing Wasm export: __trap');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['__cxa_decrement_exception_refcount'] != 'undefined', 'missing Wasm export: __cxa_decrement_exception_refcount');
  assert(typeof wasmExports['__cxa_increment_exception_refcount'] != 'undefined', 'missing Wasm export: __cxa_increment_exception_refcount');
  assert(typeof wasmExports['__thrown_object_from_unwind_exception'] != 'undefined', 'missing Wasm export: __thrown_object_from_unwind_exception');
  assert(typeof wasmExports['__get_exception_message'] != 'undefined', 'missing Wasm export: __get_exception_message');
  assert(typeof wasmExports['__set_stack_limits'] != 'undefined', 'missing Wasm export: __set_stack_limits');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  assert(typeof wasmExports['__cpp_exception'] != 'undefined', 'missing Wasm export: __cpp_exception');
  _fflush = createExportWrapper('fflush', 1);
  _free = createExportWrapper('free', 1);
  _malloc = createExportWrapper('malloc', 1);
  _main = Module['_main'] = createExportWrapper('main', 2);
  _realloc = createExportWrapper('realloc', 2);
  _tt_dev_open_rocket_door = Module['_tt_dev_open_rocket_door'] = createExportWrapper('tt_dev_open_rocket_door', 0);
  _tt_dev_time_label = Module['_tt_dev_time_label'] = createExportWrapper('tt_dev_time_label', 0);
  _tt_dev_time_travel_button = Module['_tt_dev_time_travel_button'] = createExportWrapper('tt_dev_time_travel_button', 1);
  _tt_finish_time_travel_archive = Module['_tt_finish_time_travel_archive'] = createExportWrapper('tt_finish_time_travel_archive', 0);
  _em_set_mouse_mode = Module['_em_set_mouse_mode'] = createExportWrapper('em_set_mouse_mode', 1);
  _em_on_floor = Module['_em_on_floor'] = createExportWrapper('em_on_floor', 0);
  _tt_dev_tts_size = Module['_tt_dev_tts_size'] = createExportWrapper('tt_dev_tts_size', 0);
  _tt_dev_tts_drop_erased = Module['_tt_dev_tts_drop_erased'] = createExportWrapper('tt_dev_tts_drop_erased', 0);
  _tt_dev_tts_probe = Module['_tt_dev_tts_probe'] = createExportWrapper('tt_dev_tts_probe', 1);
  _tt_tts_finished = Module['_tt_tts_finished'] = createExportWrapper('tt_tts_finished', 1);
  _tt_dispatch_to_wndproc = Module['_tt_dispatch_to_wndproc'] = createExportWrapper('tt_dispatch_to_wndproc', 3);
  _tt_save_city = Module['_tt_save_city'] = createExportWrapper('tt_save_city', 0);
  _tt_demo_pause_choice = Module['_tt_demo_pause_choice'] = createExportWrapper('tt_demo_pause_choice', 1);
  _tt_dev_xml_bench = Module['_tt_dev_xml_bench'] = createExportWrapper('tt_dev_xml_bench', 1);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _strerror = createExportWrapper('strerror', 1);
  ___trap = wasmExports['__trap'];
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  ___cxa_decrement_exception_refcount = createExportWrapper('__cxa_decrement_exception_refcount', 1);
  ___cxa_increment_exception_refcount = createExportWrapper('__cxa_increment_exception_refcount', 1);
  ___thrown_object_from_unwind_exception = createExportWrapper('__thrown_object_from_unwind_exception', 1);
  ___get_exception_message = createExportWrapper('__get_exception_message', 3);
  ___set_stack_limits = Module['___set_stack_limits'] = createExportWrapper('__set_stack_limits', 2);
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmTable = wasmExports['__indirect_function_table'];
  ___cpp_exception = wasmExports['__cpp_exception'];
}

var wasmImports = {
  /** @export */
  AnsiLowerA: _AnsiLowerA,
  /** @export */
  AnsiUpperA: _AnsiUpperA,
  /** @export */
  BeginPaint: _BeginPaint,
  /** @export */
  ClientToScreen: _ClientToScreen,
  /** @export */
  ClipCursor: _ClipCursor,
  /** @export */
  CloseClipboard: _CloseClipboard,
  /** @export */
  CloseHandle: _CloseHandle,
  /** @export */
  CloseWindow: _CloseWindow,
  /** @export */
  CoBuildVersion: _CoBuildVersion,
  /** @export */
  CopyFileA: _CopyFileA,
  /** @export */
  CreateDialogParamA: _CreateDialogParamA,
  /** @export */
  CreateDirectoryA: _CreateDirectoryA,
  /** @export */
  CreateFileA: _CreateFileA,
  /** @export */
  CreatePalette: _CreatePalette,
  /** @export */
  CreateWindowExA: _CreateWindowExA,
  /** @export */
  CryptAcquireContextA: _CryptAcquireContextA,
  /** @export */
  CryptCreateHash: _CryptCreateHash,
  /** @export */
  CryptDestroyHash: _CryptDestroyHash,
  /** @export */
  CryptGetHashParam: _CryptGetHashParam,
  /** @export */
  CryptHashData: _CryptHashData,
  /** @export */
  CryptReleaseContext: _CryptReleaseContext,
  /** @export */
  DefWindowProcA: _DefWindowProcA,
  /** @export */
  DeleteFileA: _DeleteFileA,
  /** @export */
  DestroyWindow: _DestroyWindow,
  /** @export */
  DialogBoxParamA: _DialogBoxParamA,
  /** @export */
  DispatchMessageA: _DispatchMessageA,
  /** @export */
  EmptyClipboard: _EmptyClipboard,
  /** @export */
  EndDialog: _EndDialog,
  /** @export */
  EndPaint: _EndPaint,
  /** @export */
  FileTimeToSystemTime: _FileTimeToSystemTime,
  /** @export */
  FindClose: _FindClose,
  /** @export */
  FindFirstFileA: _FindFirstFileA,
  /** @export */
  FindNextFileA: _FindNextFileA,
  /** @export */
  FindResourceA: _FindResourceA,
  /** @export */
  FindWindowA: _FindWindowA,
  /** @export */
  FormatMessageA: _FormatMessageA,
  /** @export */
  FreeLibrary: _FreeLibrary,
  /** @export */
  FreeResource: _FreeResource,
  /** @export */
  GetAsyncKeyState: _GetAsyncKeyState,
  /** @export */
  GetClipboardData: _GetClipboardData,
  /** @export */
  GetCurrentProcess: _GetCurrentProcess,
  /** @export */
  GetCurrentProcessId: _GetCurrentProcessId,
  /** @export */
  GetCurrentThreadId: _GetCurrentThreadId,
  /** @export */
  GetCursorPos: _GetCursorPos,
  /** @export */
  GetDC: _GetDC,
  /** @export */
  GetDIBits: _GetDIBits,
  /** @export */
  GetDateFormatA: _GetDateFormatA,
  /** @export */
  GetDeviceCaps: _GetDeviceCaps,
  /** @export */
  GetDlgItemTextA: _GetDlgItemTextA,
  /** @export */
  GetFileAttributesA: _GetFileAttributesA,
  /** @export */
  GetFileSize: _GetFileSize,
  /** @export */
  GetFocus: _GetFocus,
  /** @export */
  GetLastError: _GetLastError,
  /** @export */
  GetLocalTime: _GetLocalTime,
  /** @export */
  GetMessageA: _GetMessageA,
  /** @export */
  GetModuleFileNameA: _GetModuleFileNameA,
  /** @export */
  GetModuleHandleA: _GetModuleHandleA,
  /** @export */
  GetNearestPaletteIndex: _GetNearestPaletteIndex,
  /** @export */
  GetObjectA: _GetObjectA,
  /** @export */
  GetPaletteEntries: _GetPaletteEntries,
  /** @export */
  GetPrivateProfileIntA: _GetPrivateProfileIntA,
  /** @export */
  GetPrivateProfileStringA: _GetPrivateProfileStringA,
  /** @export */
  GetProcAddress: _GetProcAddress,
  /** @export */
  GetProcessHeap: _GetProcessHeap,
  /** @export */
  GetShortPathNameA: _GetShortPathNameA,
  /** @export */
  GetSystemMetrics: _GetSystemMetrics,
  /** @export */
  GetSystemPaletteEntries: _GetSystemPaletteEntries,
  /** @export */
  GetSystemPaletteUse: _GetSystemPaletteUse,
  /** @export */
  GetTabbedTextExtentW: _GetTabbedTextExtentW,
  /** @export */
  GetTempPathA: _GetTempPathA,
  /** @export */
  GetTimeFormatA: _GetTimeFormatA,
  /** @export */
  GetTimeZoneInformation: _GetTimeZoneInformation,
  /** @export */
  GetVersionExA: _GetVersionExA,
  /** @export */
  GetWindowLongA: _GetWindowLongA,
  /** @export */
  GetWindowRect: _GetWindowRect,
  /** @export */
  GlobalAlloc: _GlobalAlloc,
  /** @export */
  GlobalFree: _GlobalFree,
  /** @export */
  GlobalLock: _GlobalLock,
  /** @export */
  GlobalMemoryStatus: _GlobalMemoryStatus,
  /** @export */
  GlobalReAlloc: _GlobalReAlloc,
  /** @export */
  GlobalSize: _GlobalSize,
  /** @export */
  GlobalUnlock: _GlobalUnlock,
  /** @export */
  HeapAlloc: _HeapAlloc,
  /** @export */
  HeapFree: _HeapFree,
  /** @export */
  ImmGetCompositionStringA: _ImmGetCompositionStringA,
  /** @export */
  ImmGetContext: _ImmGetContext,
  /** @export */
  ImmReleaseContext: _ImmReleaseContext,
  /** @export */
  IsCharAlphaA: _IsCharAlphaA,
  /** @export */
  IsCharAlphaNumericA: _IsCharAlphaNumericA,
  /** @export */
  IsCharAlphaW: _IsCharAlphaW,
  /** @export */
  IsCharUpperA: _IsCharUpperA,
  /** @export */
  IsClipboardFormatAvailable: _IsClipboardFormatAvailable,
  /** @export */
  IsIconic: _IsIconic,
  /** @export */
  LoadCursorA: _LoadCursorA,
  /** @export */
  LoadIconA: _LoadIconA,
  /** @export */
  LoadLibraryA: _LoadLibraryA,
  /** @export */
  LoadResource: _LoadResource,
  /** @export */
  LoadStringA: _LoadStringA,
  /** @export */
  LocalFree: _LocalFree,
  /** @export */
  LockResource: _LockResource,
  /** @export */
  MessageBoxA: _MessageBoxA,
  /** @export */
  MoveFileA: _MoveFileA,
  /** @export */
  MoveWindow: _MoveWindow,
  /** @export */
  MultiByteToWideChar: _MultiByteToWideChar,
  /** @export */
  OpenClipboard: _OpenClipboard,
  /** @export */
  OpenFile: _OpenFile,
  /** @export */
  OpenIcon: _OpenIcon,
  /** @export */
  PeekMessageA: _PeekMessageA,
  /** @export */
  PostMessageA: _PostMessageA,
  /** @export */
  PostQuitMessage: _PostQuitMessage,
  /** @export */
  ReadFile: _ReadFile,
  /** @export */
  RedrawWindow: _RedrawWindow,
  /** @export */
  RegisterClassA: _RegisterClassA,
  /** @export */
  ReleaseCapture: _ReleaseCapture,
  /** @export */
  ReleaseDC: _ReleaseDC,
  /** @export */
  RemoveDirectoryA: _RemoveDirectoryA,
  /** @export */
  ScreenToClient: _ScreenToClient,
  /** @export */
  SendMessageA: _SendMessageA,
  /** @export */
  SetActiveWindow: _SetActiveWindow,
  /** @export */
  SetCapture: _SetCapture,
  /** @export */
  SetClipboardData: _SetClipboardData,
  /** @export */
  SetCursor: _SetCursor,
  /** @export */
  SetCursorPos: _SetCursorPos,
  /** @export */
  SetDlgItemTextA: _SetDlgItemTextA,
  /** @export */
  SetErrorMode: _SetErrorMode,
  /** @export */
  SetFilePointer: _SetFilePointer,
  /** @export */
  SetFocus: _SetFocus,
  /** @export */
  SetForegroundWindow: _SetForegroundWindow,
  /** @export */
  SetMessageQueue: _SetMessageQueue,
  /** @export */
  SetSystemPaletteUse: _SetSystemPaletteUse,
  /** @export */
  SetUnhandledExceptionFilter: _SetUnhandledExceptionFilter,
  /** @export */
  SetWindowLongA: _SetWindowLongA,
  /** @export */
  SetWindowPos: _SetWindowPos,
  /** @export */
  SetWindowTextA: _SetWindowTextA,
  /** @export */
  ShowCursor: _ShowCursor,
  /** @export */
  ShowWindow: _ShowWindow,
  /** @export */
  SizeofResource: _SizeofResource,
  /** @export */
  Sleep: _Sleep,
  /** @export */
  SystemParametersInfoA: _SystemParametersInfoA,
  /** @export */
  SystemTimeToFileTime: _SystemTimeToFileTime,
  /** @export */
  SystemTimeToTzSpecificLocalTime: _SystemTimeToTzSpecificLocalTime,
  /** @export */
  TranslateMessage: _TranslateMessage,
  /** @export */
  UnlockResource: _UnlockResource,
  /** @export */
  UpdateWindow: _UpdateWindow,
  /** @export */
  WideCharToMultiByte: _WideCharToMultiByte,
  /** @export */
  WriteFile: _WriteFile,
  /** @export */
  WritePrivateProfileStringA: _WritePrivateProfileStringA,
  /** @export */
  _Z10DragFinishPv: __Z10DragFinishPv,
  /** @export */
  _Z10PlaySoundAPKcPvm: __Z10PlaySoundAPKcPvm,
  /** @export */
  _Z10UuidCreateP5_GUID: __Z10UuidCreateP5_GUID,
  /** @export */
  _Z11timeGetTimev: __Z11timeGetTimev,
  /** @export */
  _Z13InternetOpenAPKcmS0_S0_m: __Z13InternetOpenAPKcmS0_S0_m,
  /** @export */
  _Z13OleInitializePv: __Z13OleInitializePv,
  /** @export */
  _Z13ShellExecuteAPvPKcS1_S1_S1_i: __Z13ShellExecuteAPvPKcS1_S1_S1_i,
  /** @export */
  _Z13UuidToStringAP5_GUIDPPh: __Z13UuidToStringAP5_GUIDPPh,
  /** @export */
  _Z14DragQueryFileAPvjPcj: __Z14DragQueryFileAPvjPcj,
  /** @export */
  _Z14DragQueryPointPvP8tagPOINT: __Z14DragQueryPointPvP8tagPOINT,
  /** @export */
  _Z14RevokeDragDropPv: __Z14RevokeDragDropPv,
  /** @export */
  _Z14RpcStringFreeAPPh: __Z14RpcStringFreeAPPh,
  /** @export */
  _Z14destroy_playerP13IDirectPlay4Am: __Z14destroy_playerP13IDirectPlay4Am,
  /** @export */
  _Z14mciSendStringAPKcPcjPv: __Z14mciSendStringAPKcPcjPv,
  /** @export */
  _Z15DragAcceptFilesPvi: __Z15DragAcceptFilesPvi,
  /** @export */
  _Z15UuidFromStringAPhP5_GUID: __Z15UuidFromStringAPhP5_GUID,
  /** @export */
  _Z15timeBeginPeriodj: __Z15timeBeginPeriodj,
  /** @export */
  _Z16CreateURLMonikerP8IMonikerPKwPS0_: __Z16CreateURLMonikerP8IMonikerPKwPS0_,
  /** @export */
  _Z16InternetOpenUrlAPvPKcS1_mmm: __Z16InternetOpenUrlAPvPKcS1_mmm,
  /** @export */
  _Z16InternetReadFilePvS_mPm: __Z16InternetReadFilePvS_mPm,
  /** @export */
  _Z16RegisterDragDropPvP11IDropTarget: __Z16RegisterDragDropPvP11IDropTarget,
  /** @export */
  _Z16ReleaseStgMediumP12tagSTGMEDIUM: __Z16ReleaseStgMediumP12tagSTGMEDIUM,
  /** @export */
  _Z16get_IP_addressesP13IDirectPlay4AmRh: __Z16get_IP_addressesP13IDirectPlay4AmRh,
  /** @export */
  _Z16receive_messagesv: __Z16receive_messagesv,
  /** @export */
  _Z18mciGetErrorStringAmPcj: __Z18mciGetErrorStringAmPcj,
  /** @export */
  _Z18message_queue_sizeP13IDirectPlay4A: __Z18message_queue_sizeP13IDirectPlay4A,
  /** @export */
  _Z19InternetCloseHandlePv: __Z19InternetCloseHandlePv,
  /** @export */
  _Z19release_direct_playv: __Z19release_direct_playv,
  /** @export */
  _Z20CommitUrlCacheEntryAPKcS0_9_FILETIMES1_mPhmS0_S0_: __Z20CommitUrlCacheEntryAPKcS0_9_FILETIMES1_mPhmS0_S0_,
  /** @export */
  _Z20CreateUrlCacheEntryAPKcmS0_Pcm: __Z20CreateUrlCacheEntryAPKcmS0_Pcm,
  /** @export */
  _Z20send_network_messageP13IDirectPlay4AmP5_GUIDPhiP4Nest: __Z20send_network_messageP13IDirectPlay4AmP5_GUIDPhiP4Nest,
  /** @export */
  _Z21SetUrlCacheEntryInfoAPKcP27_INTERNET_CACHE_ENTRY_INFOAm: __Z21SetUrlCacheEntryInfoAPKcP27_INTERNET_CACHE_ENTRY_INFOAm,
  /** @export */
  _Z22FindNextUrlCacheEntryAPvP27_INTERNET_CACHE_ENTRY_INFOAPm: __Z22FindNextUrlCacheEntryAPvP27_INTERNET_CACHE_ENTRY_INFOAPm,
  /** @export */
  _Z22IP_addresses_of_playerPhmRi: __Z22IP_addresses_of_playerPhmRi,
  /** @export */
  _Z22initialize_direct_playv: __Z22initialize_direct_playv,
  /** @export */
  _Z23FindFirstUrlCacheEntryAPKcP27_INTERNET_CACHE_ENTRY_INFOAPm: __Z23FindFirstUrlCacheEntryAPKcP27_INTERNET_CACHE_ENTRY_INFOAPm,
  /** @export */
  _Z25create_direct_play_objectPc: __Z25create_direct_play_objectPc,
  /** @export */
  _Z26RetrieveUrlCacheEntryFileAPKcP27_INTERNET_CACHE_ENTRY_INFOAPmm: __Z26RetrieveUrlCacheEntryFileAPKcP27_INTERNET_CACHE_ENTRY_INFOAPmm,
  /** @export */
  _Z26join_a_direct_play_sessionP13IDirectPlay4AP5_GUIDP4Nest: __Z26join_a_direct_play_sessionP13IDirectPlay4AP5_GUIDP4Nest,
  /** @export */
  _Z26release_direct_play_objectP13IDirectPlay4A: __Z26release_direct_play_objectP13IDirectPlay4A,
  /** @export */
  _Z28InternetGetLastResponseInfoAPmPcS_: __Z28InternetGetLastResponseInfoAPmPcS_,
  /** @export */
  _Z30host_a_new_direct_play_sessionP13IDirectPlay4AP5_GUIDP4NestPc: __Z30host_a_new_direct_play_sessionP13IDirectPlay4AP5_GUIDP4NestPc,
  /** @export */
  _ZN11CImmProject12CreateEffectEPKcP9CImmMouse: __ZN11CImmProject12CreateEffectEPKcP9CImmMouse,
  /** @export */
  _ZN11CImmProject8OpenFileEPKcP9CImmMouse: __ZN11CImmProject8OpenFileEPKcP9CImmMouse,
  /** @export */
  _ZN11CImmProjectC1Ev: __ZN11CImmProjectC1Ev,
  /** @export */
  _ZN11CImmProjectD1Ev: __ZN11CImmProjectD1Ev,
  /** @export */
  _ZN16CImmSimpleEffect11GetDurationERm: __ZN16CImmSimpleEffect11GetDurationERm,
  /** @export */
  _ZN16CImmSimpleEffect12GetDirectionERl: __ZN16CImmSimpleEffect12GetDirectionERl,
  /** @export */
  _ZN16CImmSimpleEffect21ChangeBaseParamsPolarElmP12IMM_ENVELOPElmmmm: __ZN16CImmSimpleEffect21ChangeBaseParamsPolarElmP12IMM_ENVELOPElmmmm,
  /** @export */
  _ZN16CImmSimpleEffect7GetGainERm: __ZN16CImmSimpleEffect7GetGainERm,
  /** @export */
  _ZN18CImmCompoundEffect18GetContainedEffectEl: __ZN18CImmCompoundEffect18GetContainedEffectEl,
  /** @export */
  _ZN18CImmCompoundEffect27GetNumberOfContainedEffectsEv: __ZN18CImmCompoundEffect27GetNumberOfContainedEffectsEv,
  /** @export */
  _ZN18CImmCompoundEffect4StopEv: __ZN18CImmCompoundEffect4StopEv,
  /** @export */
  _ZN18CImmCompoundEffect5StartEv: __ZN18CImmCompoundEffect5StartEv,
  /** @export */
  _ZN7Gdiplus14GdiplusStartupEPmPKNS_19GdiplusStartupInputEPNS_20GdiplusStartupOutputE: __ZN7Gdiplus14GdiplusStartupEPmPKNS_19GdiplusStartupInputEPNS_20GdiplusStartupOutputE,
  /** @export */
  _ZN7Gdiplus15GdiplusShutdownEm: __ZN7Gdiplus15GdiplusShutdownEm,
  /** @export */
  _ZN7Gdiplus16GetImageEncodersEjjPNS_14ImageCodecInfoE: __ZN7Gdiplus16GetImageEncodersEjjPNS_14ImageCodecInfoE,
  /** @export */
  _ZN7Gdiplus20GetImageEncodersSizeEPjS0_: __ZN7Gdiplus20GetImageEncodersSizeEPjS0_,
  /** @export */
  _ZN7Gdiplus5Image4SaveEPKwPK5_GUIDPKNS_17EncoderParametersE: __ZN7Gdiplus5Image4SaveEPKwPK5_GUIDPKNS_17EncoderParametersE,
  /** @export */
  _ZN7Gdiplus5Image8GetWidthEv: __ZN7Gdiplus5Image8GetWidthEv,
  /** @export */
  _ZN7Gdiplus5Image9GetHeightEv: __ZN7Gdiplus5Image9GetHeightEv,
  /** @export */
  _ZN7Gdiplus6Bitmap10GetPaletteEPNS_12ColorPaletteEi: __ZN7Gdiplus6Bitmap10GetPaletteEPNS_12ColorPaletteEi,
  /** @export */
  _ZN7Gdiplus6Bitmap10SetPaletteEPKNS_12ColorPaletteE: __ZN7Gdiplus6Bitmap10SetPaletteEPKNS_12ColorPaletteE,
  /** @export */
  _ZN7Gdiplus6Bitmap10UnlockBitsEPNS_10BitmapDataE: __ZN7Gdiplus6Bitmap10UnlockBitsEPNS_10BitmapDataE,
  /** @export */
  _ZN7Gdiplus6Bitmap14GetPaletteSizeEv: __ZN7Gdiplus6Bitmap14GetPaletteSizeEv,
  /** @export */
  _ZN7Gdiplus6Bitmap8GetFlagsEv: __ZN7Gdiplus6Bitmap8GetFlagsEv,
  /** @export */
  _ZN7Gdiplus6Bitmap8GetPixelEiiPNS_5ColorE: __ZN7Gdiplus6Bitmap8GetPixelEiiPNS_5ColorE,
  /** @export */
  _ZN7Gdiplus6Bitmap8LockBitsEPKNS_4RectEjiPNS_10BitmapDataE: __ZN7Gdiplus6Bitmap8LockBitsEPKNS_4RectEjiPNS_10BitmapDataE,
  /** @export */
  _ZN7Gdiplus6Bitmap8SetPixelEiiRKNS_5ColorE: __ZN7Gdiplus6Bitmap8SetPixelEiiRKNS_5ColorE,
  /** @export */
  _ZN7Gdiplus6BitmapC1EPKwi: __ZN7Gdiplus6BitmapC1EPKwi,
  /** @export */
  _ZN7Gdiplus6BitmapC1Eiii: __ZN7Gdiplus6BitmapC1Eiii,
  /** @export */
  _ZN9CImmMouse10InitializeEPvS0_: __ZN9CImmMouse10InitializeEPvS0_,
  /** @export */
  _ZN9CImmMouse22UsesWin32MouseServicesEi: __ZN9CImmMouse22UsesWin32MouseServicesEi,
  /** @export */
  _ZN9CImmMouseC1Ev: __ZN9CImmMouseC1Ev,
  /** @export */
  _ZNK7Gdiplus5Image13GetLastStatusEv: __ZNK7Gdiplus5Image13GetLastStatusEv,
  /** @export */
  __assert_fail: ___assert_fail,
  /** @export */
  __handle_stack_overflow: ___handle_stack_overflow,
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_fstat64: ___syscall_fstat64,
  /** @export */
  __syscall_getdents64: ___syscall_getdents64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_lstat64: ___syscall_lstat64,
  /** @export */
  __syscall_mkdirat: ___syscall_mkdirat,
  /** @export */
  __syscall_newfstatat: ___syscall_newfstatat,
  /** @export */
  __syscall_openat: ___syscall_openat,
  /** @export */
  __syscall_rmdir: ___syscall_rmdir,
  /** @export */
  __syscall_stat64: ___syscall_stat64,
  /** @export */
  __syscall_unlinkat: ___syscall_unlinkat,
  /** @export */
  __throw_exception_with_stack_trace: ___throw_exception_with_stack_trace,
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  _localtime_js: __localtime_js,
  /** @export */
  _set_new_handler: __set_new_handler,
  /** @export */
  _tzset_js: __tzset_js,
  /** @export */
  emscripten_asm_const_int: _emscripten_asm_const_int,
  /** @export */
  emscripten_cancel_main_loop: _emscripten_cancel_main_loop,
  /** @export */
  emscripten_date_now: _emscripten_date_now,
  /** @export */
  emscripten_get_now: _emscripten_get_now,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  emscripten_set_main_loop: _emscripten_set_main_loop,
  /** @export */
  environ_get: _environ_get,
  /** @export */
  environ_sizes_get: _environ_sizes_get,
  /** @export */
  exit: _exit,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write,
  /** @export */
  mmioAdvance: _mmioAdvance,
  /** @export */
  mmioAscend: _mmioAscend,
  /** @export */
  mmioClose: _mmioClose,
  /** @export */
  mmioDescend: _mmioDescend,
  /** @export */
  mmioGetInfo: _mmioGetInfo,
  /** @export */
  mmioOpenA: _mmioOpenA,
  /** @export */
  mmioRead: _mmioRead,
  /** @export */
  mmioSeek: _mmioSeek,
  /** @export */
  mmioSetInfo: _mmioSetInfo,
  /** @export */
  tt_ds_free,
  /** @export */
  tt_ds_ghost_level,
  /** @export */
  tt_ds_last_rescued,
  /** @export */
  tt_ds_play,
  /** @export */
  tt_ds_reconcile,
  /** @export */
  tt_ds_stop,
  /** @export */
  tt_ds_stop_all,
  /** @export */
  tt_ds_stop_effects,
  /** @export */
  tt_ds_stop_looping,
  /** @export */
  tt_ds_volume,
  /** @export */
  tt_text_hwidth,
  /** @export */
  tt_text_raster,
  /** @export */
  tt_tts_speak
};


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var calledRun;

function callMain() {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(typeof onPreRuns === 'undefined' || onPreRuns.length == 0, 'cannot call main when preRun functions remain to be called');

  var entryFunction = _main;

  var argc = 0;
  var argv = 0;

  try {

    var ret = entryFunction(argc, argv);

    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

async function run() {
  assert(!calledRun);
  calledRun = true;

  stackCheckInit();

  preRun();

  if (runDependencies > 0) {
    await new Promise((resolve) => dependenciesFulfilled = resolve);
  }

  var setStatus = Module['setStatus'];
  if (setStatus) {
    setStatus('Running...');
    // Yield to the event loop to allow the browser to paint "Running..."
    await new Promise((resolve) => setTimeout(resolve, 1));
    // Then we want to clear the status text, but only after the rest of this function runs.
    setTimeout(setStatus, 1, '');
  }

  if (ABORT) return;

  initRuntime();

  preMain();

  Module['onRuntimeInitialized']?.();
  consumedModuleProp('onRuntimeInitialized');

  var noInitialRun = Module['noInitialRun'] || false;
  if (!noInitialRun) callMain();

  postRun();

  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    for (var name of ['stdout', 'stderr']) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty?.output?.length) {
        has = true;
      }
    }
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

var wasmExports;

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm().then(() => run());

// end include: postamble.js

