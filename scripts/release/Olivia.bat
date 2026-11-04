@echo off
setlocal
cd /d "%~dp0"

rem Olivia ComfyUI launcher (alpha) bootstrap.
rem NOTE: keep this file ASCII-only -- cmd mis-parses multi-byte lines even
rem under chcp 65001. Chinese user-facing text lives in README-FIRST.txt
rem and in the web UI. File must stay CRLF + no BOM.

set PY=python
python --version >nul 2>nul || set PY=py -3
%PY% --version >nul 2>nul || (
  echo [Olivia] Python not found. Please install Python 3.12 or newer:
  echo          https://www.python.org/downloads/
  pause
  exit /b 1
)

%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" || (
  echo [Olivia] Python 3.12+ is required. Current version:
  %PY% --version
  pause
  exit /b 1
)

if exist "server\.venv\Scripts\python.exe" goto :ready

echo [Olivia] First run: creating venv and installing dependencies (1-2 min)...
%PY% -m venv server\.venv || goto :err
"server\.venv\Scripts\python.exe" -m pip install -r server\requirements.txt -q && goto :ready
echo [Olivia] Default index failed, retrying via TUNA mirror...
"server\.venv\Scripts\python.exe" -m pip install -r server\requirements.txt -q -i https://pypi.tuna.tsinghua.edu.cn/simple || goto :err

:ready
echo [Olivia] Starting core -- a browser window will open shortly.
echo [Olivia] Close this window to stop the launcher.
cd server
".venv\Scripts\python.exe" -m olivia_core --serve-web ..\web --open-browser
goto :eof

:err
echo [Olivia] Dependency install failed. Check your network and try again.
pause
exit /b 1
