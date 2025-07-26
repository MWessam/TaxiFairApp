# APK Debug Logs Script
$ADB_PATH = "D:\Unity Editors\6000.0.29f1\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\adb.exe"
$APP_PACKAGE = "com.MedoWessam.TaxiOgraApp"

Write-Host "=== APK Debug Logs ===" -ForegroundColor Green
Write-Host "1. Clear all logs"
Write-Host "2. Watch logs for your app only"
Write-Host "3. Watch all logs"
Write-Host "4. Watch crash logs only"
Write-Host "5. Get app crash logs"
Write-Host "6. Exit"
Write-Host ""

$choice = Read-Host "Choose an option (1-6)"

switch ($choice) {
    "1" {
        Write-Host "Clearing logs..." -ForegroundColor Yellow
        & $ADB_PATH logcat -c
        Write-Host "Logs cleared!" -ForegroundColor Green
    }
    "2" {
        Write-Host "Watching logs for $APP_PACKAGE..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
        & $ADB_PATH logcat | Select-String $APP_PACKAGE
    }
    "3" {
        Write-Host "Watching all logs..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
        & $ADB_PATH logcat
    }
    "4" {
        Write-Host "Watching crash logs..." -ForegroundColor Yellow
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Cyan
        & $ADB_PATH logcat | Select-String "FATAL\|AndroidRuntime\|crash"
    }
    "5" {
        Write-Host "Getting recent crash logs..." -ForegroundColor Yellow
        & $ADB_PATH logcat -d | Select-String "FATAL\|AndroidRuntime\|crash\|$APP_PACKAGE"
    }
    "6" {
        Write-Host "Exiting..." -ForegroundColor Green
        exit
    }
    default {
        Write-Host "Invalid option!" -ForegroundColor Red
    }
} 