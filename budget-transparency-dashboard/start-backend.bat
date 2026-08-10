@echo off
REM Budget Transparency Dashboard - backend launcher (Windows)
cd /d "%~dp0backend"
if exist venv (
  call venv\Scripts\activate
) else (
  py -m venv venv
  call venv\Scripts\activate
  pip install -r requirements.txt
)
python app.py