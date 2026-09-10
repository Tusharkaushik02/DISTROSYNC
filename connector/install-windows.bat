@echo off
title DistroSync Tally Connector Setup
echo ===================================================
echo     DistroSync Tally Connector - Setup Helper
echo ===================================================
echo.

if not exist "%~dp0dist\tally-connector.exe" (
    echo [!] tally-connector.exe not found in dist/
    echo Building executable now...
    npm run build:exe
)

echo.
echo Starting DistroSync Tally Connector...
start "" "%~dp0dist\tally-connector.exe"

echo.
echo Connector is starting!
echo A browser window will open shortly at http://localhost:9123
echo Enter your pairing code from your DistroSync web dashboard.
echo.
pause
