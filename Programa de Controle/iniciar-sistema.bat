@echo off
cd /d "%~dp0"

set "PYTHON_BUNDLED=C:\Users\Deron\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%PYTHON_BUNDLED%" (
  start "Controle Amazon" "%PYTHON_BUNDLED%" server.py
) else (
  start "Controle Amazon" python server.py
)

timeout /t 2 >nul
start http://127.0.0.1:4173/index.html
