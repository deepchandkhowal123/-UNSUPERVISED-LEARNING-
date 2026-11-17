@echo off
REM NetworkTrace launcher (Windows)
cd /d "%~dp0"
echo == NetworkTrace ==
echo 1/2  Installing dependencies...
python -m pip install -q -r backend\requirements.txt
echo 2/2  Starting server on http://127.0.0.1:8000
echo      (first launch seeds the database - ~5 seconds)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
