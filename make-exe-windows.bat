@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Install the LTS version from https://nodejs.org first.
  start "" https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" call npm install --no-audit --no-fund
echo.
echo  [Monster Nest] Building the installer. This takes a few minutes...
echo.
call npm run build:win
echo.
echo  Done! Look in the "dist" folder for MonsterNest-Setup-1.0.0.exe
start "" "%~dp0dist"
pause
