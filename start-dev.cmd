@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0.tools\node.exe" (
  echo Local Node.js runtime is missing. Install Node.js LTS, then run npm install and npm run dev.
  exit /b 1
)
set "PATH=%~dp0.tools;%PATH%"
"%~dp0.tools\node.exe" "%~dp0.tools\package\bin\npm-cli.js" run dev -- --port 5173
