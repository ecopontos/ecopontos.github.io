# check-mobile-prerequisites.ps1
# Verificar pré-requisitos para build mobile

Write-Host "🔍 Verificando pré-requisitos para build mobile..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado" -ForegroundColor Red
    $allGood = $false
}

# 2. Verificar NPM
try {
    $npmVersion = npm --version
    Write-Host "✅ NPM: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ NPM não encontrado" -ForegroundColor Red
    $allGood = $false
}

# 3. Verificar Capacitor CLI
try {
    $capVersion = npx cap --version 2>$null
    if ($capVersion) {
        Write-Host "✅ Capacitor CLI: $($capVersion.Split("`n")[0])" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Capacitor CLI não encontrado globalmente" -ForegroundColor Yellow
        Write-Host "   Usando via npx (OK para build)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Capacitor CLI não encontrado" -ForegroundColor Red
    $allGood = $false
}

# 4. Verificar Java (necessário para Android)
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    if ($javaVersion) {
        Write-Host "✅ Java: $($javaVersion.Line)" -ForegroundColor Green
    } else {
        Write-Host "❌ Java não encontrado" -ForegroundColor Red
        Write-Host "   Instale Java JDK 11 ou superior" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "❌ Java não encontrado" -ForegroundColor Red
    Write-Host "   Instale Java JDK 11 ou superior" -ForegroundColor Yellow
    $allGood = $false
}

# 5. Verificar Android SDK (via ANDROID_HOME)
if ($env:ANDROID_HOME) {
    Write-Host "✅ ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
} else {
    Write-Host "⚠️  ANDROID_HOME não definido" -ForegroundColor Yellow
    Write-Host "   Configure o Android SDK se necessário" -ForegroundColor Gray
}

# 6. Verificar ADB
try {
    $adbVersion = adb version 2>$null
    if ($adbVersion) {
        Write-Host "✅ ADB disponível" -ForegroundColor Green
    } else {
        Write-Host "⚠️  ADB não encontrado" -ForegroundColor Yellow
        Write-Host "   Instale Android SDK Platform Tools para instalação automática" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  ADB não encontrado" -ForegroundColor Yellow
}

# 7. Verificar arquivos de configuração
Write-Host ""
Write-Host "📋 Verificando configuração do projeto:" -ForegroundColor Blue

$configFiles = @{
    "mobile\capacitor.config.json" = "Configuração do Capacitor"
    "mobile\package.json" = "Configuração do NPM (mobile)"
    "mobile\android\gradlew.bat" = "Gradle Wrapper"
    "mobile\android\app\build.gradle" = "Build Android"
    "mobile\www\index.html" = "Aplicação web"
}

foreach ($file in $configFiles.Keys) {
    if (Test-Path $file) {
        Write-Host "✅ $($configFiles[$file]): $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $($configFiles[$file]): $file não encontrado" -ForegroundColor Red
        $allGood = $false
    }
}

# 8. Verificar dependências npm
Write-Host ""
Write-Host "📦 Verificando dependências:" -ForegroundColor Blue

if (Test-Path "mobile\node_modules") {
    Write-Host "✅ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules não encontrado" -ForegroundColor Yellow
    Write-Host "   Execute: cd mobile && npm install" -ForegroundColor Gray
}

# 9. Verificar espaço em disco
$drive = Get-PSDrive C
$freeSpaceGB = [math]::Round($drive.Free / 1GB, 2)
if ($freeSpaceGB -gt 5) {
    Write-Host "✅ Espaço livre: ${freeSpaceGB}GB" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pouco espaço livre: ${freeSpaceGB}GB" -ForegroundColor Yellow
    Write-Host "   Recomendado: pelo menos 5GB para builds Android" -ForegroundColor Gray
}

# Resultado final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "🎉 Todos os pré-requisitos OK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para gerar o APK de debug, execute:" -ForegroundColor White
    Write-Host "   .\build-debug-mobile.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou use os comandos npm:" -ForegroundColor White
    Write-Host "   npm run debug-mobile" -ForegroundColor Cyan
    Write-Host "   npm run build-debug" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Alguns pré-requisitos não foram atendidos" -ForegroundColor Yellow
    Write-Host "   Configure os itens marcados com ❌ antes de continuar" -ForegroundColor Gray
}
Write-Host "========================================" -ForegroundColor Cyan