#!/usr/bin/env bash
# NetworkTrace launcher (Linux / macOS)
set -e
cd "$(dirname "$0")"

echo "== NetworkTrace =="
echo "1/2  Installing dependencies..."
python3 -m pip install -q -r backend/requirements.txt

echo "2/2  Starting server on http://127.0.0.1:8000"
echo "     (first launch seeds the database — ~5 seconds)"
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
