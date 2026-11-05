@echo off
setlocal
title Mec Tracker - installer
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "SRC=%~dp0com.mectracker"
set "DST=C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.mectracker"
if not exist "%SRC%\manifest.json" ( echo Plugin folder not found next to this file. & pause & exit /b 1 )
echo Copying the plugin to:
echo   %DST%
rem remove old versions (com.mectracker.v2, com.mectracker.v2_x.y.z, com.mectracker_x.y.z)
for /d %%O in ("C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.mectracker.v2*" "C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.mectracker_*") do rmdir /s /q "%%O"
if exist "%DST%" rmdir /s /q "%DST%"
mkdir "%DST%" >nul 2>&1
xcopy "%SRC%\*" "%DST%\" /e /i /y /q >nul
if %errorlevel% neq 0 ( echo Copy failed. & pause & exit /b 1 )
echo Registering the plugin in Premiere...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$d='C:\ProgramData\Adobe\UXP\PluginsInfo\v1'; $f=Join-Path $d 'PremierePro.json';" ^
 "New-Item -ItemType Directory -Force -Path $d | Out-Null;" ^
 "if (Test-Path $f) { Copy-Item $f ($f+'.bak') -Force; $j = Get-Content $f -Raw | ConvertFrom-Json } else { $j = [pscustomobject]@{ plugins = @() } };" ^
 "if (-not $j.plugins) { $j | Add-Member -NotePropertyName plugins -NotePropertyValue @() -Force };" ^
 "$j.plugins = @($j.plugins | Where-Object { $_.pluginId -ne 'com.mectracker' -and $_.pluginId -ne 'com.mectracker.v2' });" ^
 "$j.plugins += [pscustomobject]@{ hostMinVersion='25.6.0'; name='Mec Tracker'; path='$extension/Plugins/External/com.mectracker'; pluginId='com.mectracker'; status='enabled'; type='uxp'; versionString='3.3.4' };" ^
 "$j | ConvertTo-Json -Depth 10 | Set-Content $f -Encoding UTF8"
echo.
echo Done. Restart Premiere Pro and go to Window ^> UXP Plugins ^> Mec Tracker
pause
