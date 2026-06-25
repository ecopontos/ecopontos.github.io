# Script para extrair dados do app EcoForms (pacote com.ecoforms.app) via ADB
# Requer: dispositivo conectado via USB com debug ativado

$packageName = "com.ecoforms.app"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputDir = "$env:USERPROFILE\Desktop\ecoforms_backup_$timestamp"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Write-Host "=== EcoForms Data Extraction ===" -ForegroundColor Cyan
Write-Host "Pacote: $packageName" -ForegroundColor Cyan
Write-Host "Dispositivo: ZF5233VRQ8 (Moto G8 Power)" -ForegroundColor Cyan
Write-Host ""

# Verificar dispositivos
Write-Host "Verificando dispositivo..." -ForegroundColor Yellow
adb devices
Write-Host ""

# Verificar pacote
Write-Host "Verificando pacote $packageName..." -ForegroundColor Yellow
$pkg = adb shell pm list packages | Select-String $packageName
if ($pkg) {
    Write-Host "PACOTE ENCONTRADO: $pkg" -ForegroundColor Green
} else {
    Write-Host "Pacote não encontrado!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Criar diretórios locais
$dirs = @("databases", "webview_databases", "IndexedDB", "LocalStorage", "shared_prefs", "cache", "files")
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path "$outputDir\$d" -Force | Out-Null
}

Write-Host "=== EXTRAINDO DADOS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Databases principais
Write-Host "[1/7] Extraindo /data/data/$packageName/databases..." -ForegroundColor Yellow
adb shell "run-as $packageName ls databases/ 2>/dev/null" | ForEach-Object {
    $file = $_.Trim()
    if ($file -and $file -notmatch "^ls: " -and $file -notmatch "No such") {
        Write-Host "  -> $file"
        adb shell "run-as $packageName cat databases/$file" | Set-Content -Path "$outputDir\databases\$file" -Encoding Byte
    }
}
adb pull "/data/data/$packageName/databases/" "$outputDir\databases" 2>$null

# 2. WebView databases (WebSQL)
Write-Host "[2/7] Extraindo WebView databases..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/app_webview/Default/databases/" "$outputDir\webview_databases" 2>$null
adb pull "/data/data/$packageName/app_webview/databases/" "$outputDir\webview_databases" 2>$null

# 3. IndexedDB - ESTE É O MAIS IMPORTANTE
Write-Host "[3/7] Extraindo IndexedDB..." -ForegroundColor Yellow
$indexedDbPaths = @(
    "/data/data/$packageName/app_webview/Default/IndexedDB"
    "/data/data/$packageName/app_webview/IndexedDB"
    "/data/data/$packageName/cache/IndexedDB"
)
foreach ($idbPath in $indexedDbPaths) {
    Write-Host "  Tentando: $idbPath"
    $listing = adb shell "ls -la $idbPath 2>/dev/null" 2>$null
    if ($listing -and $listing -notmatch "No such") {
        Write-Host "  ENCONTRADO! Extraindo..." -ForegroundColor Green
        adb shell "ls -R $idbPath" | Out-File "$outputDir\IndexedDB\listing.txt" -Append
        adb pull "$idbPath" "$outputDir\IndexedDB" 2>$null
    }
}

# 4. Local Storage
Write-Host "[4/7] Extraindo Local Storage..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/app_webview/Default/Local Storage/" "$outputDir\LocalStorage" 2>$null

# 5. Shared Prefs
Write-Host "[5/7] Extraindo SharedPreferences..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/shared_prefs/" "$outputDir\shared_prefs" 2>$null

# 6. Cache
Write-Host "[6/7] Extraindo Cache..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/cache/" "$outputDir\cache" 2>$null

# 7. Files
Write-Host "[7/7] Extraindo Files..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/files/" "$outputDir\files" 2>$null

# Verificar resultados
Write-Host ""
Write-Host "=== RESULTADO ===" -ForegroundColor Cyan
$arquivos = Get-ChildItem $outputDir -Recurse -File -ErrorAction SilentlyContinue
if ($arquivos.Count -gt 0) {
    Write-Host "SUCESSO! Total de arquivos: $($arquivos.Count)" -ForegroundColor Green
    Write-Host "Pasta: $outputDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "Arquivos extraídos:" -ForegroundColor Cyan
    $arquivos | ForEach-Object {
        $relPath = $_.FullName.Replace($outputDir, "").TrimStart("\")
        $sizeKB = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  $relPath ($sizeKB KB)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Para abrir bancos SQLite: https://sqlitebrowser.org/" -ForegroundColor Yellow
} else {
    Write-Host "Nenhum arquivo extraído." -ForegroundColor Red
    Write-Host ""
    Write-Host "Possíveis causas:" -ForegroundColor Yellow
    Write-Host "  - run-as falhou: app não é debug ou não está rodando" -ForegroundColor Yellow
    Write-Host "  - Dispositivo não está rooteado" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativa: Use o Chrome DevTools manualmente:" -ForegroundColor Cyan
    Write-Host "  Application > IndexedDB > FormDataDB > formsubmissions" -ForegroundColor White
    Write-Host "  Clique nos registros e copie os dados" -ForegroundColor White
}

# Abrir pasta
explorer $outputDir
Write-Host ""
Write-Host "Concluído!" -ForegroundColor Cyan
