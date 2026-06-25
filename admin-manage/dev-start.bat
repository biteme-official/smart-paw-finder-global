@echo off
start "API Server (port 3000)" cmd /k "cd /d %~dp0 && npx tsx api/dev-server.ts"
timeout /t 2 /nobreak >nul
start "Vite (port 5173)" cmd /k "cd /d %~dp0 && npm run dev"
