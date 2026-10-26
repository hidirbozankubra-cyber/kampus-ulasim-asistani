@echo off
chcp 65001 >nul
cd /d "%~dp0public"
echo Sunucu basliyor: http://localhost:8080  (kapatmak icin bu pencereyi kapatin)
start "" http://localhost:8080
py -m http.server 8080 2>nul || python -m http.server 8080
pause
