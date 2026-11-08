@echo off
setlocal
echo ================================================================
echo       STARTING MR LOGIC SCHOOL SYSTEM & EXAMINATION ENGINE       
echo ================================================================

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Using system Node.js...
    node server.js
    goto :eof
)

if exist "C:\Users\JULIUS\AppData\Roaming\Antigravity\bin\agy-node.cmd" (
    echo Using Antigravity Node.js runtime...
    call "C:\Users\JULIUS\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
    goto :eof
)

if exist "C:\Users\JULIUS\AppData\Local\Programs\antigravity\Antigravity.exe" (
    echo Using Electron Node runtime...
    set ELECTRON_RUN_AS_NODE=1
    "C:\Users\JULIUS\AppData\Local\Programs\antigravity\Antigravity.exe" server.js
    goto :eof
)

echo [ERROR] No compatible Node.js runtime found.
pause
