# Script de Validação Final do Projeto EcoForms
# Verifica integridade e completude do sistema

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  VALIDACAO FINAL - ECOFORMS" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$warnings = 0
$success = 0

# Função auxiliar para verificar arquivo
function Test-FileExists {
    param([string]$path, [string]$description)
    
    if (Test-Path $path) {
        Write-Host "[OK] $description" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[ERRO] $description - Nao encontrado: $path" -ForegroundColor Red
        $script:errors++
        return $false
    }
}

# Função para verificar conteúdo
function Test-FileContent {
    param([string]$path, [string]$pattern, [string]$description, [bool]$shouldExist = $true)
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $found = $content -match $pattern
        
        if ($shouldExist -and $found) {
            Write-Host "[OK] $description" -ForegroundColor Green
            $script:success++
            return $true
        } elseif (-not $shouldExist -and -not $found) {
            Write-Host "[OK] $description" -ForegroundColor Green
            $script:success++
            return $true
        } else {
            $status = if ($shouldExist) { "nao encontrado" } else { "ainda presente" }
            Write-Host "[AVISO] $description - $status" -ForegroundColor Yellow
            $script:warnings++
            return $false
        }
    } else {
        Write-Host "[ERRO] Arquivo nao encontrado: $path" -ForegroundColor Red
        $script:errors++
        return $false
    }
}

Write-Host "1. ARQUIVOS PRINCIPAIS" -ForegroundColor Cyan
Write-Host "----------------------" -ForegroundColor Cyan
Test-FileExists "mobile/www/index.html" "Index principal"
Test-FileExists "mobile/www/login.html" "Pagina de login"
Test-FileExists "mobile/capacitor.config.json" "Config do Capacitor"
Test-FileExists "package.json" "Package.json"
Test-FileExists "build-debug-mobile.ps1" "Script de build Android"
Write-Host ""

Write-Host "2. SERVICOS CORE" -ForegroundColor Cyan
Write-Host "----------------" -ForegroundColor Cyan
Test-FileExists "mobile/www/js/supabase-client.js" "Cliente Supabase"
Test-FileExists "mobile/www/js/data-service.js" "Data Service"
Test-FileExists "mobile/www/js/smart-cache.js" "Smart Cache"
Test-FileExists "mobile/www/js/dashboard-service.js" "Dashboard Service"
Test-FileExists "mobile/www/js/system-config.js" "System Config"
Write-Host ""

Write-Host "3. SISTEMA DE SINCRONIZACAO" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan
Test-FileExists "mobile/www/js/services/DatabaseSyncService.js" "DatabaseSyncService"
Test-FileExists "mobile/www/js/fields/types/OccupationField.js" "OccupationField"
Test-FileExists "mobile/www/js/plugins/ecoponto-caixas-sync.js" "EcopontoCaixasSync Plugin"
Write-Host ""

Write-Host "4. PERFORMANCE E OTIMIZACAO" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan
Test-FileExists "mobile/www/js/core/VirtualScroller.js" "VirtualScroller"
Test-FileExists "mobile/www/js/core/FieldMemoizer.js" "FieldMemoizer"
Test-FileExists "mobile/www/js/core/FormSectionLoader.js" "FormSectionLoader"
Test-FileExists "mobile/www/js/core/ProgressiveFormRenderer.js" "ProgressiveFormRenderer"
Test-FileExists "mobile/www/js/core/PerformanceMonitor.js" "PerformanceMonitor"
Write-Host ""

Write-Host "5. VALIDACOES DE LIMPEZA" -ForegroundColor Cyan
Write-Host "-------------------------" -ForegroundColor Cyan
Test-FileContent "www/js/dashboard-service.js" "console\.log.*\[DEBUG\]" "Logs console.log DEBUG removidos" $false
Test-FileContent "www/js/system-config.js" "desktop.*managed" "Modo 'desktop_managed' removido" $false
Test-FileContent "mobile/scripts/concat-css.js" "DESKTOP ENHANCEMENTS" "Comentario 'DESKTOP ENHANCEMENTS' atualizado" $false
Write-Host ""

Write-Host "6. DOCUMENTACAO" -ForegroundColor Cyan
Write-Host "----------------" -ForegroundColor Cyan
Test-FileExists "README.md" "README principal"
Test-FileExists "docs/SISTEMA-ATUALIZACAO-OTA.md" "Doc OTA"
Test-FileExists "docs/SUPABASE_CLIENT_INTEGRATION.md" "Doc Supabase"
Test-FileExists "mobile/www/docs/SISTEMA-ATUALIZACAO-DADOS-ECOPONTO-CAIXAS.md" "Doc sincronizacao caixas"
Test-FileExists "PERFORMANCE-SYSTEM-SUMMARY.md" "Resumo de performance"
Write-Host ""

Write-Host "7. TESTES" -ForegroundColor Cyan
Write-Host "---------" -ForegroundColor Cyan
Test-FileExists "mobile/tests/device-setup-download.test.js" "Teste device setup/download"
Test-FileExists "mobile/tests/smart-preloader.test.js" "Teste SmartPreloader"
Test-FileExists "test-ecoponto-caixas-latest-view.html" "Teste view caixas"
Test-FileExists "mobile/tests/performance.benchmark.test.js" "Benchmark de performance"
Write-Host ""

Write-Host "8. BUILD E DEPLOY" -ForegroundColor Cyan
Write-Host "-----------------" -ForegroundColor Cyan
Test-FileExists "mobile/android/app/build.gradle" "Config Android Gradle"
Test-FileExists "mobile/android/gradlew.bat" "Gradle wrapper"
Test-FileExists "build-debug-mobile.ps1" "Script de build PowerShell"
Test-FileExists "build-debug-mobile.sh" "Script de build Bash"
Write-Host ""

Write-Host "9. FORMULARIOS" -ForegroundColor Cyan
Write-Host "--------------" -ForegroundColor Cyan
Test-FileExists "mobile/www/forms/ecopontoCaixasForm.json" "Form ecoponto caixas"
Test-FileExists "mobile/www/ai-form-builder.html" "AI Form Builder"
Write-Host ""

# Verificações adicionais
Write-Host "10. VERIFICACOES ADICIONAIS" -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan

# Verificar se package.json tem scripts necessários
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    $mobilePackageJson = Get-Content "mobile/package.json" -Raw | ConvertFrom-Json

    if ($mobilePackageJson.scripts."build-css-prod") {
        Write-Host "[OK] Script 'build-css-prod' presente" -ForegroundColor Green
        $success++
    } else {
        Write-Host "[AVISO] Script 'build-css-prod' ausente" -ForegroundColor Yellow
        $warnings++
    }

    if ($mobilePackageJson.dependencies."@supabase/supabase-js") {
        Write-Host "[OK] Dependencia Supabase instalada" -ForegroundColor Green
        $success++
    } else {
        Write-Host "[ERRO] Dependencia Supabase ausente" -ForegroundColor Red
        $errors++
    }

    if ($mobilePackageJson.dependencies."@capacitor/core") {
        Write-Host "[OK] Capacitor Core instalado" -ForegroundColor Green
        $success++
    } else {
        Write-Host "[ERRO] Capacitor Core ausente" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  RESULTADO DA VALIDACAO" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sucessos:  $success" -ForegroundColor Green
Write-Host "Avisos:    $warnings" -ForegroundColor Yellow
Write-Host "Erros:     $errors" -ForegroundColor Red
Write-Host ""

if ($errors -eq 0) {
    Write-Host "STATUS: PROJETO PRONTO PARA USO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor Cyan
    Write-Host "1. Execute: npm install" -ForegroundColor White
    Write-Host "2. Configure Supabase em www/index.html" -ForegroundColor White
    Write-Host "3. Build APK: .\build-debug-mobile.ps1" -ForegroundColor White
    exit 0
} elseif ($errors -le 3) {
    Write-Host "STATUS: PROJETO QUASE COMPLETO" -ForegroundColor Yellow
    Write-Host "Corrija os erros acima antes de usar em producao" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "STATUS: PROJETO COM PROBLEMAS" -ForegroundColor Red
    Write-Host "Varios arquivos criticos estao ausentes" -ForegroundColor Red
    exit 2
}
