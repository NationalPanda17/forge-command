@echo off
rem Double-click this file to play Forge Command on this computer, offline.
rem First run: installs what the game needs (a few minutes). Leave this window open while you play;
rem close it (or press Ctrl+C) to stop.
cd /d "%~dp0"
title Forge Command
echo ==================================================
echo   Forge Command
echo ==================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed yet.
  echo Install it from https://nodejs.org ^(the 'LTS' version^), then double-click this file again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
for /f "usebackq delims=" %%v in (`node -p "process.versions.node.split('.')[0]"`) do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo Your Node.js is too old. Version 20 or newer is needed.
  echo Install the 'LTS' version from https://nodejs.org, then double-click this file again.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)
if not exist node_modules (
  echo First-time setup: installing what the game needs. This can take a few minutes...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo Setup did not finish. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo Building the game...
call npx vite build --logLevel warn
if errorlevel 1 (
  echo.
  echo The build failed. Please report this on the game's GitHub page.
  pause
  exit /b 1
)
echo.
echo Your browser will open at http://localhost:4174 in a moment.
echo Keep this window open while you play. Close it to stop.
echo.
call npx vite preview --port 4174 --open
