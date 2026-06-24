# Script para extrair banco de dados do app EcoForms do dispositivo Android
# Requer: ADB instalado e dispositivo conectado via USB com debug ativado

$packageName = "com.ecosuite.pmf"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputDir = "$env:USERPROFILE\Desktop\ecoforms_backup_$timestamp"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Write-Host "=== EcoForms - Extração de Dados do Dispositivo ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se adb está disponível
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) {
    Write-Host "ERRO: adb não encontrado no PATH." -ForegroundColor Red
    Write-Host "Por favor, instale o Android SDK Platform Tools e adicione ao PATH." -ForegroundColor Yellow
    Write-Host "Download: https://developer.android.com/studio/releases/platform-tools" -ForegroundColor Yellow
    exit 1
}

# 2. Verificar dispositivos conectados
Write-Host "Verificando dispositivos conectados..." -ForegroundColor Yellow
adb devices
Write-Host ""

# 3. Verificar se o app está instalado
Write-Host "Verificando se o app $packageName está instalado..." -ForegroundColor Yellow
$appCheck = adb shell pm list packages | Select-String $packageName
if (-not $appCheck) {
    Write-Host "AVISO: App $packageName não encontrado no dispositivo." -ForegroundColor Red
    Write-Host "Pacotes encontrados relacionados a 'eco':" -ForegroundColor Yellow
    adb shell pm list packages | Select-String "eco"
    Write-Host ""
    $packageName = Read-Host "Digite o nome do pacote correto (ou pressione Enter para sair)"
    if (-not $packageName) { exit 1 }
}

# 4. Listar diretórios de dados do app
Write-Host ""
Write-Host "Listando diretórios de dados do app..." -ForegroundColor Yellow

$diretorios = @(
    "/data/data/$packageName/databases",
    "/data/data/$packageName/app_webview/Default/databases",
    "/data/data/$packageName/app_webview/Default/IndexedDB",
    "/data/data/$packageName/files",
    "/data/data/$packageName/shared_prefs",
    "/data/data/$packageName/app_webview/Default/Local Storage"
)

foreach ($dir in $diretorios) {
    Write-Host ""
    Write-Host "--- Diretório: $dir ---" -ForegroundColor Green
    adb shell "ls -la $dir 2>/dev/null || echo 'DIRETORIO_NAO_ENCONTRADO'"
}

Write-Host ""
Write-Host "=== EXTRAINDO ARQUIVOS ===" -ForegroundColor Cyan
Write-Host ""

# 5. Tentar extrair bancos de dados SQLite
$destDbDir = "$outputDir\databases"
New-Item -ItemType Directory -Path $destDbDir -Force | Out-Null

# Extrair da pasta databases principal
Write-Host "Extraindo /data/data/$packageName/databases ..." -ForegroundColor Yellow
adb shell "run-as $packageName ls databases/ 2>/dev/null" | ForEach-Object {
    $file = $_.Trim()
    if ($file -and $file -notmatch "^ls: ") {
        Write-Host "  -> Copiando $file ..."
        adb shell "run-as $packageName cat databases/$file" | Set-Content -Path "$destDbDir\$file" -Encoding Byte
    }
}

# Se run-as falhar, tentar com root/adb pull
Write-Host ""
Write-Host "Tentando extrair com adb pull (requer root ou debug)..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/databases/" "$destDbDir" 2>$null
adb pull "/data/data/$packageName/app_webview/Default/databases/" "$outputDir\webview_databases" 2>$null

# 6. Extrair IndexedDB (estrutura de diretórios)
Write-Host ""
Write-Host "Extraindo IndexedDB..." -ForegroundColor Yellow
$destIndexedDbDir = "$outputDir\IndexedDB"
New-Item -ItemType Directory -Path $destIndexedDbDir -Force | Out-Null
adb shell "run-as $packageName ls -R app_webview/Default/IndexedDB/ 2>/dev/null" | Out-File "$outputDir\indexeddb_listing.txt"
adb pull "/data/data/$packageName/app_webview/Default/IndexedDB/" "$destIndexedDbDir" 2>$null

# 7. Extrair Local Storage
Write-Host "Extraindo Local Storage..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/app_webview/Default/Local Storage/" "$outputDir\LocalStorage" 2>$null

# 8. Extrair SharedPreferences (configurações)
Write-Host "Extraindo SharedPreferences..." -ForegroundColor Yellow
adb pull "/data/data/$packageName/shared_prefs/" "$outputDir\shared_prefs" 2>$null

# 9. Verificar se conseguimos extrair algo
Write-Host ""
Write-Host "=== VERIFICAÇÃO ===" -ForegroundColor Cyan
Write-Host ""

$arquivosEncontrados = Get-ChildItem $outputDir -Recurse -File -ErrorAction SilentlyContinue
if ($arquivosEncontrados.Count -eq 0) {
    Write-Host "Nenhum arquivo foi extraído. Possíveis causas:" -ForegroundColor Red
    Write-Host "  1. O app não está em modo debug (android:debuggable='true')" -ForegroundColor Yellow
    Write-Host "  2. O dispositivo não está rooteado e o app não é debug" -ForegroundColor Yellow
    Write-Host "  3. O pacote está incorreto" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativa: Use o Chrome DevTools para inspecionar o WebView:" -ForegroundColor Cyan
    Write-Host "  1. No PC, abra Chrome e vá para: chrome://inspect/#devices" -ForegroundColor White
    Write-Host "  2. Com o app aberto, você verá o WebView do EcoForms listado" -ForegroundColor White
    Write-Host "  3. Clique em 'inspect' -> Aplicação -> IndexedDB / WebSQL" -ForegroundColor White
    Write-Host "  4. Lá você pode exportar os dados manualmente" -ForegroundColor White
} else {
    Write-Host "SUCESSO! Arquivos extraídos para: $outputDir" -ForegroundColor Green
    Write-Host "Total de arquivos: $($arquivosEncontrados.Count)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Arquivos encontrados:" -ForegroundColor Cyan
    $arquivosEncontrados | ForEach-Object {
        Write-Host "  $($_.FullName.Replace($outputDir, '')) - $([math]::Round($_.Length/1KB, 2)) KB" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Para visualizar os bancos SQLite, use:" -ForegroundColor Cyan
    Write-Host "  - DB Browser for SQLite (https://sqlitebrowser.org/)" -ForegroundColor White
    Write-Host "  - sqlite3 CLI" -ForegroundColor White
    Write-Host "  - Extensão VS Code: SQLite Viewer" -ForegroundColor White
}

Write-Host ""
Write-Host "=== CONCLUÍDO ===" -ForegroundColor Cyan

# Abrir pasta de saída
explorer $outputDir
