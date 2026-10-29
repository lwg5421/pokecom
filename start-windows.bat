@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [Monster Nest] Node.js is not installed.
  echo  Install the "LTS" version from https://nodejs.org and run this file again.
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo  [Monster Nest] First run: installing. This takes 1-3 minutes...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
start "" "node_modules\electron\dist\electron.exe" .
exit /b 0
