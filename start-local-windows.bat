@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS from https://nodejs.org/ and retry.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing packages...
  call npm install
  if errorlevel 1 (
    echo Package installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)
echo.
echo MT Bites POS is starting. Open http://localhost:5173 in your browser.
echo Keep this window open while testing locally.
echo.
call npm run dev
pause
