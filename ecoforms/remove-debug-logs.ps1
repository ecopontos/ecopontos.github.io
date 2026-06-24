# Script para remover logs de DEBUG do dashboard-service.js
# Remove linhas com [DEBUG] mas mantém logs importantes de erro

$filePath = "www\js\dashboard-service.js"
$backupPath = "www\js\dashboard-service.js.backup"

Write-Host "Removendo logs de DEBUG do dashboard-service.js..." -ForegroundColor Cyan

# Criar backup
if (Test-Path $filePath) {
    Copy-Item $filePath $backupPath -Force
    Write-Host "Backup criado: $backupPath" -ForegroundColor Green
} else {
    Write-Host "Arquivo nao encontrado: $filePath" -ForegroundColor Red
    exit 1
}

# Ler conteúdo
$content = Get-Content $filePath -Raw

# Contar logs antes
$debugLogsBefore = ([regex]::Matches($content, "console\.log.*\[DEBUG\]")).Count
Write-Host "Logs [DEBUG] encontrados: $debugLogsBefore" -ForegroundColor Yellow

# Remover linhas com console.log que contenham [DEBUG]
$content = $content -replace "(?m)^\s*console\.log\([^)]*\[DEBUG\][^\n]*\n", ""

# Remover linhas vazias duplas
$content = $content -replace "(?m)^\s*\n\s*\n", "`n"

# Salvar arquivo modificado
$content | Set-Content $filePath -NoNewline

# Contar logs depois
$contentAfter = Get-Content $filePath -Raw
$debugLogsAfter = ([regex]::Matches($contentAfter, "console\.log.*\[DEBUG\]")).Count

Write-Host "Logs [DEBUG] removidos: $($debugLogsBefore - $debugLogsAfter)" -ForegroundColor Green
Write-Host "Logs [DEBUG] restantes: $debugLogsAfter" -ForegroundColor Yellow

if ($debugLogsAfter -eq 0) {
    Write-Host "Todos os logs [DEBUG] foram removidos com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Alguns logs [DEBUG] ainda permanecem (podem estar em strings multilinhas)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para reverter, execute: Copy-Item $backupPath $filePath -Force" -ForegroundColor Cyan

