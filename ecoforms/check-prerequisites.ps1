# check-prerequisites.ps1
# Verificacao de pre-requisitos para build mobile

Write-Host "Verificando pre-requisitos para build mobile..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Node.js nao encontrado" -ForegroundColor Red
    $allGood = $false
}

# Verificar NPM
try {
    $npmVersion = npm --version
    Write-Host "[OK] NPM: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] NPM nao encontrado" -ForegroundColor Red
    $allGood = $false
}

# Verificar Java
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    if ($javaVersion) {
        Write-Host "[OK] Java detectado" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Java nao encontrado" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "[ERRO] Java nao encontrado - Instale JDK 11+" -ForegroundColor Red
    $allGood = $false
}

# Verificar arquivos de configuracao
$configFiles = @(
    "mobile\capacitor.config.json",
    "mobile\package.json",
    "mobile\android\gradlew.bat",
    "mobile\www\index.html"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "[OK] $file" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] $file nao encontrado" -ForegroundColor Red
        $allGood = $false
    }
}

# Verificar ADB (opcional)
try {
    $null = adb version 2>$null
    Write-Host "[OK] ADB disponivel" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] ADB nao encontrado (opcional)" -ForegroundColor Yellow
}

# Resultado
Write-Host ""
Write-Host "========================================"
if ($allGood) {
    Write-Host "RESULTADO: Todos os pre-requisitos OK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Para gerar APK de debug:" -ForegroundColor White
    Write-Host "  powershell -ExecutionPolicy Bypass -File build-debug-mobile.ps1" -ForegroundColor Cyan
} else {
    Write-Host "RESULTADO: Alguns pre-requisitos faltando" -ForegroundColor Red
    Write-Host "Configure os itens com [ERRO] antes de continuar" -ForegroundColor Yellow
}
Write-Host "========================================"