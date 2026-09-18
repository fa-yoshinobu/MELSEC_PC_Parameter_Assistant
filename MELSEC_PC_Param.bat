@echo off
setlocal

cd /d "%~dp0"

py -3 -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py -3"
    goto generate
)
python -c "import sys; sys.exit(sys.version_info < (3, 9))" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto generate
)
if exist "docs\index.html" (
    echo Python 3.9+ not found. Opening the existing docs\index.html instead.
    start "" "%~dp0docs\index.html"
    exit /b 0
)
echo Python 3.9+ was not found and docs\index.html does not exist yet.
echo Install Python 3.9 or later, then run this file again.
pause
exit /b 1

:generate
echo Generating docs\index.html from JSON definitions...
%PYTHON_CMD% "%~dp0build.py"
if errorlevel 1 (
    echo.
    echo Generation failed. Fix the JSON definitions and run again.
    pause
    exit /b 1
)

start "" "%~dp0docs\index.html"
exit /b 0
