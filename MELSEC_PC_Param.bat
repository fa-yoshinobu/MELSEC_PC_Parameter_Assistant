@echo off
setlocal

cd /d "%~dp0"

where dotnet >nul 2>&1
if errorlevel 1 (
    echo .NET SDK was not found.
    echo Install .NET 10 SDK, then run this file again.
    pause
    exit /b 1
)

echo Starting MELSEC Device Capacity Checker...
echo URL: http://localhost:5179
echo Press Ctrl+C in this window to stop the application.
echo.

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 120; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:5179' -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process 'http://localhost:5179'; break } catch { Start-Sleep -Seconds 1 } }"
dotnet run --project "%~dp0MelsecParam.App\MelsecParam.App.csproj" --urls "http://localhost:5179"

set "APP_EXIT_CODE=%ERRORLEVEL%"
if not "%APP_EXIT_CODE%"=="0" (
    echo.
    echo Application stopped with error code %APP_EXIT_CODE%.
    pause
)

exit /b %APP_EXIT_CODE%
