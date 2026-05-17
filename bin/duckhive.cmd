@echo off
setlocal

set SCRIPT_DIR=%~dp0
set DIST_PATH=%SCRIPT_DIR%..\dist\cli.mjs
set JS_LAUNCHER=%SCRIPT_DIR%duckhive

if not exist "%DIST_PATH%" goto missing_dist

node "%JS_LAUNCHER%" %*
exit /b %ERRORLEVEL%

:missing_dist
echo duckhive: dist\cli.mjs not found. Run: bun run build
exit /b 1
