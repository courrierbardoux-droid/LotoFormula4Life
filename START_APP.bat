@echo off
setlocal

REM =========================================================
REM LotoFormula4Life - START (Backend + Frontend)
REM - Backend:  http://localhost:3000
REM - Frontend: http://localhost:5000
REM =========================================================

REM Go to project root (where this .bat lives)
cd /d "%~dp0"

set "FRONTEND_DIR=%~dp0frontend"

if not exist "%FRONTEND_DIR%\package.json" (
  echo [ERREUR] Dossier frontend introuvable: "%FRONTEND_DIR%"
  echo Verifie que ce fichier est bien dans C:\Projects\LotoFormula4Life\
  pause
  exit /b 1
)

echo.
echo [INFO] Demarrage Backend (npm run dev)...
start "L4L Backend (port 3000)" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

echo [INFO] Demarrage Frontend (npm run dev:client)...
start "L4L Frontend (port 5000)" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev:client"

echo.
echo [OK] Fenetres ouvertes. Ouvre: http://localhost:5000/
echo.
exit /b 0

