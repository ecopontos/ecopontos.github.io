# Script de preparação do ambiente
# Garante que todos os arquivos necessários estão no lugar

Write-Host "Preparando ambiente EcoForms..." -ForegroundColor Cyan
Write-Host ""

$errors = 0

# 1. Criar diretórios necessários
Write-Host "1. Criando diretorios necessarios..." -ForegroundColor Yellow
$directories = @(
    "mobile/www/styles",
    "mobile/www/css",
    "mobile/www/forms",
    "mobile/www/js/services",
    "mobile/www/js/fields/types",
    "mobile/www/js/plugins",
    "mobile/www/docs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  [+] Criado: $dir" -ForegroundColor Green
    } else {
        Write-Host "  [OK] $dir" -ForegroundColor Gray
    }
}

# 2. Gerar CSS
Write-Host ""
Write-Host "2. Gerando CSS..." -ForegroundColor Yellow

try {
    # Executar concat-css para gerar design-system.css
    npm run concat-css --prefix mobile --silent 2>$null | Out-Null
    
    if (Test-Path "mobile/www/css/design-system.css") {
        Write-Host "  [OK] design-system.css gerado" -ForegroundColor Green
        
        # Copiar para styles/tailwind.css
        Copy-Item "mobile/www/css/design-system.css" "mobile/www/styles/tailwind.css" -Force
        Write-Host "  [OK] tailwind.css atualizado" -ForegroundColor Green
    } else {
        Write-Host "  [ERRO] Falha ao gerar design-system.css" -ForegroundColor Red
        $errors++
    }
} catch {
    Write-Host "  [ERRO] Falha ao executar concat-css: $_" -ForegroundColor Red
    $errors++
}

# 3. Verificar arquivos críticos
Write-Host ""
Write-Host "3. Verificando arquivos criticos..." -ForegroundColor Yellow

$criticalFiles = @{
    "mobile/www/index.html" = "Index principal"
    "mobile/www/login.html" = "Login"
    "mobile/www/js/supabase-client.js" = "Supabase Client"
    "mobile/www/js/data-service.js" = "Data Service"
    "mobile/www/js/auth-manager.js" = "Auth Manager"
    "mobile/www/js/smart-cache.js" = "Smart Cache"
    "mobile/www/js/services/DatabaseSyncService.js" = "Database Sync Service"
    "mobile/capacitor.config.json" = "Capacitor Config"
    "mobile/package.json" = "Package.json (mobile)"
}

foreach ($file in $criticalFiles.Keys) {
    if (Test-Path $file) {
        Write-Host "  [OK] $($criticalFiles[$file])" -ForegroundColor Gray
    } else {
        Write-Host "  [ERRO] $($criticalFiles[$file]) - $file" -ForegroundColor Red
        $errors++
    }
}

# 4. Verificar JSON dos formulários
Write-Host ""
Write-Host "4. Validando formularios JSON..." -ForegroundColor Yellow

$formFiles = Get-ChildItem "mobile/www/forms/*.json" -ErrorAction SilentlyContinue

if ($formFiles) {
    foreach ($form in $formFiles) {
        try {
            $null = Get-Content $form.FullName -Raw | ConvertFrom-Json
            Write-Host "  [OK] $($form.Name)" -ForegroundColor Gray
        } catch {
            Write-Host "  [ERRO] $($form.Name) - JSON invalido" -ForegroundColor Red
            $errors++
        }
    }
} else {
    Write-Host "  [AVISO] Nenhum formulario encontrado em www/forms/" -ForegroundColor Yellow
}

# Resumo
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  RESUMO" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

if ($errors -eq 0) {
    Write-Host "STATUS: Ambiente pronto!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pode executar:" -ForegroundColor Cyan
    Write-Host "  npm run serve      - Servidor local" -ForegroundColor White
    Write-Host "  npm run build      - Build completo" -ForegroundColor White
    Write-Host "  .\build-debug-mobile.ps1  - Build APK" -ForegroundColor White
    exit 0
} else {
    Write-Host "STATUS: $errors erro(s) encontrado(s)" -ForegroundColor Red
    Write-Host "Corrija os erros antes de continuar" -ForegroundColor Yellow
    exit 1
}
