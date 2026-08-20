@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-NovelFlow.ps1"
exit /b %errorlevel%
