@echo off
setlocal

set SCRIPT_DIR=%~dp0
set DIST_PATH=%SCRIPT_DIR%..\dist\cli.mjs
set JS_LAUNCHER=%SCRIPT_DIR%duckhive

if exist "%DIST_PATH%" (
  node "%JS_LAUNCHER%" %*
  exit /b %ERRORLEVEL%
)

echo duckhive: dist\cli.mjs not found. Run: bun run build
exit /b 1
