@echo off
setlocal
cd /d "%~dp0"
title Mayflower Studios - Stripe Setup

echo.
echo ============================================================
echo   Mayflower Studios - One-Time Stripe Setup
echo ============================================================
echo.
echo This window will stay open if anything goes wrong.
echo.

if not exist "%~dp0SETUP-STRIPE-ONCE.ps1" (
  echo ERROR: SETUP-STRIPE-ONCE.ps1 was not found.
  echo Keep this .bat file inside the extracted Mayflower website folder.
  goto :FAILED_BEFORE_START
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows PowerShell could not be found on this computer.
  goto :FAILED_BEFORE_START
)

echo Starting PowerShell setup...
echo Firebase CLI will be updated automatically if needed.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0SETUP-STRIPE-ONCE.ps1"
set "SETUP_EXIT=%ERRORLEVEL%"

echo.
if "%SETUP_EXIT%"=="0" (
  echo ============================================================
  echo   Setup script finished successfully.
  echo ============================================================
) else (
  echo ============================================================
  echo   SETUP STOPPED WITH ERROR CODE %SETUP_EXIT%
  echo ============================================================
  echo.
  echo The actual error should be visible above this message.
  echo Take a screenshot of this window and send it to me if needed.
)
echo.
echo Press any key to close this window.
pause >nul
exit /b %SETUP_EXIT%

:FAILED_BEFORE_START
echo.
echo The setup never started. The error is shown above.
echo Take a screenshot of this window and send it to me.
echo.
echo Press any key to close this window.
pause >nul
exit /b 1
