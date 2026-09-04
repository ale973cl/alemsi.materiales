@echo off
setlocal
cd /d "%~dp0"
echo.
echo ===============================================
echo   ALEMSI Materiales - preparar para Firebase
echo ===============================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta instalado o no esta en PATH.
  echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

echo Generando package-lock.json desde package.json...
call npm install --package-lock-only
if errorlevel 1 (
  echo.
  echo ERROR: npm no pudo generar package-lock.json.
  echo Revisa tu conexion a Internet y vuelve a intentarlo.
  pause
  exit /b 1
)

if not exist package-lock.json (
  echo.
  echo ERROR: no se genero package-lock.json.
  pause
  exit /b 1
)

echo.
echo OK: package-lock.json generado correctamente.
echo Ya puedes subir TODO el contenido de esta carpeta a la rama development.
echo.
pause
endlocal
