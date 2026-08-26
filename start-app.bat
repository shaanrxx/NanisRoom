@echo off
cd /d "%~dp0"
echo Starting Auntie's Room...
npm run dev -- --host 0.0.0.0 --port 4173
