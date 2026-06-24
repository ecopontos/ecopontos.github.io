# build-debug.ps1
# Script simples para gerar APK de debug

Write-Host "Iniciando build de debug para mobile..." -ForegroundColor Cyan

# 1. Build CSS
Write-Host "Compilando CSS..." -ForegroundColor Yellow
npm run build-css-prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao compilar CSS" -ForegroundColor Red
    exit 1
}

# 2. Sync Capacitor
Write-Host "Sincronizando Capacitor..." -ForegroundColor Yellow
npx cap sync

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro na sincronizacao" -ForegroundColor Red
    exit 1
}

# 3. Build Android
Write-Host "Compilando APK de debug..." -ForegroundColor Yellow
Set-Location android
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -eq 0) {
    Write-Host "APK gerado com sucesso!" -ForegroundColor Green
    
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkInfo = Get-Item $apkPath
        $sizeMB = [math]::Round($apkInfo.Length / 1MB, 2)
        
        Write-Host ""
        Write-Host "=== RESULTADO ===" -ForegroundColor Cyan
        Write-Host "APK: $apkPath" -ForegroundColor White
        Write-Host "Tamanho: ${sizeMB} MB" -ForegroundColor White
        Write-Host "Criado: $($apkInfo.LastWriteTime)" -ForegroundColor White
        
        # Verificar ADB e dispositivos
        try {
            Write-Host ""
            Write-Host "Dispositivos conectados:" -ForegroundColor Blue
            adb devices
            Write-Host ""
            Write-Host "Para instalar:" -ForegroundColor Green
            Write-Host "  adb install android\$apkPath" -ForegroundColor White
        } catch {
            Write-Host ""
            Write-Host "ADB nao encontrado - instale manualmente o APK" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Erro ao compilar APK" -ForegroundColor Red
    exit 1
}

Set-Location ..