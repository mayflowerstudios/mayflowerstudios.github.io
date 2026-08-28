@echo off
setlocal
cd /d "%~dp0"
title Mayflower Studios - Resume Stripe Setup

echo This resumes the Stripe setup from the Functions deployment.
echo It will NOT ask for your Stripe key again.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESUME-STRIPE-SETUP.ps1"
set "ERR=%ERRORLEVEL%"

echo.
if not "%ERR%"=="0" (
  echo The resume setup returned error code %ERR%.
  echo The window will stay open so you can read the error.
) else (
  echo Resume setup finished successfully.
)
echo.
pause
exit /b %ERR%
