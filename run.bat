@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js LTS, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 goto :error
)

call npm run dev -- --open
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Startup failed. Check the message above, then press any key to close.
pause >nul
exit /b 1
