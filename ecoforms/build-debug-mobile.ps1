# build-debug-mobile.ps1
# Script PowerShell para gerar build de debug otimizado para teste em celular

Write-Host "🚀 Iniciando build de debug para mobile..." -ForegroundColor Cyan

# 1. Limpar builds anteriores
Write-Host "🧹 Limpando builds anteriores..." -ForegroundColor Yellow
if (Test-Path "mobile\android\app\build") {
    Remove-Item -Recurse -Force "mobile\android\app\build"
}

# 2. Build do CSS otimizado
Write-Host "🎨 Compilando CSS..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao compilar CSS" -ForegroundColor Red
    exit 1
}

# 3. Verificar arquivos essenciais
Write-Host "📋 Verificando arquivos essenciais..." -ForegroundColor Blue

$essentialFiles = @(
    "mobile\www\index.html",
    "mobile\www\css\design-system.css",
    "mobile\www\js\data-service.js",
    "mobile\www\js\smart-cache.js",
    "mobile\www\js\sync-manager.js",
    "supabase-config.js"
)

foreach ($file in $essentialFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Erro: $file não encontrado" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ $file" -ForegroundColor Green
}

# 4. Sincronizar com Capacitor
Write-Host "🔄 Sincronizando com Capacitor..." -ForegroundColor Cyan
npx cap sync

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro na sincronização do Capacitor" -ForegroundColor Red
    exit 1
}

# 5. Verificar configuração Android
if (-not (Test-Path "mobile\android\app\src\main\AndroidManifest.xml")) {
    Write-Host "❌ Erro: Projeto Android não configurado" -ForegroundColor Red
    Write-Host "Execute: cd mobile && npx cap add android" -ForegroundColor Yellow
    exit 1
}

# 6. Build debug APK
Write-Host "📱 Gerando APK de debug..." -ForegroundColor Magenta
Set-Location mobile\android

# Verificar se gradlew existe
if (Test-Path ".\gradlew.bat") {
    .\gradlew.bat assembleDebug
} else {
    Write-Host "❌ gradlew.bat não encontrado" -ForegroundColor Red
    exit 1
}

# 7. Verificar se APK foi gerado
$apkPath = "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "✅ APK gerado com sucesso!" -ForegroundColor Green
    Write-Host "📍 Localização: mobile\android\$apkPath" -ForegroundColor Cyan
    
    # Mostrar informações do APK
    Write-Host ""
    Write-Host "ℹ️  Informações do APK:" -ForegroundColor Blue
    $apkInfo = Get-Item $apkPath
    Write-Host "   Tamanho: $([math]::Round($apkInfo.Length / 1MB, 2)) MB"
    Write-Host "   Modificado: $($apkInfo.LastWriteTime)"
    
    # Verificar se ADB está disponível
    try {
        $adbVersion = adb version 2>$null
        if ($adbVersion) {
            Write-Host ""
            Write-Host "🔌 ADB detectado. Para instalar no dispositivo conectado:" -ForegroundColor Green
            Write-Host "   adb install mobile\android\$apkPath" -ForegroundColor White
            Write-Host ""
            Write-Host "🔍 Dispositivos conectados:" -ForegroundColor Blue
            adb devices
        }
    }
    catch {
        Write-Host ""
        Write-Host "⚠️  ADB não encontrado. Instale Android SDK Platform Tools" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🎉 Build de debug concluído!" -ForegroundColor Green
    Write-Host "📁 APK disponível em: $(Get-Location)\$apkPath" -ForegroundColor White
    
    # Voltar ao diretório raiz
    Set-Location ..\..
    
    # Opção para instalar automaticamente
    Write-Host ""
    $install = Read-Host "Deseja instalar o APK automaticamente? (s/N)"
    if ($install -eq "s" -or $install -eq "S") {
        Write-Host "📲 Instalando APK..." -ForegroundColor Cyan
        adb install "$apkPath"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ APK instalado com sucesso!" -ForegroundColor Green
            Write-Host "🚀 Você pode abrir o app EcoSuite no seu dispositivo agora" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Erro na instalação. Verifique se o dispositivo está conectado e USB debugging habilitado" -ForegroundColor Red
        }
    }