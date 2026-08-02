@echo off
rem Serve the WASM build over HTTP and open it.
rem
rem file:///.../build/tt.html cannot work: the page boots by fetch()ing tt.wasm and
rem tt.data, and browsers refuse fetch() on the file: scheme (opaque origin). On top of
rem that WebAssembly.instantiateStreaming needs an application/wasm MIME type, which
rem file:// cannot declare, and the .dmo demos are pulled at runtime from demos/<name>.dmo.
rem So the module never instantiates and you get a black canvas.
rem
rem Close this window to stop the server.

cd /d "%~dp0build"

start "" /min python -m http.server 8231
timeout /t 1 /nobreak >nul
start "" "http://localhost:8231/tt.html"

echo ToonTalk is being served at http://localhost:8231/tt.html
echo.
echo   Play a recorded demo:  http://localhost:8231/tt.html?demo=intro_v2
echo   Other demos are the file names in build\demos without the .dmo
echo.
echo After a rebuild, reload with Ctrl+F5 so the browser re-reads tt.html itself.
echo Closing this window leaves the server running in its own minimised window.
echo.
pause
