@echo off
REM Budget Transparency Dashboard - frontend launcher (Windows)
cd /d "%~dp0frontend"
if not exist node_modules (
  call npm install
)
call npm run dev