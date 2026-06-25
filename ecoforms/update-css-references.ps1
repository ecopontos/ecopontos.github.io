# Script para atualizar todas as páginas HTML para usar o CSS universal
$rootPath = "c:\Users\marce\OneDrive\Área de Trabalho\fabrica-2 (4)\fabrica-2\www"

# Lista de arquivos HTML para atualizar
$htmlFiles = @(
    "test-isolated-checklist.html",
    "test-form-renderer.html",
    "galeria-campos.html", 
    "test-access-control.html",
    "mobile-form-demo.html",
    "debug-field-factory.html",
    "debug-forms.html",
    "test-smart-cache.html",
    "test-auth.html",
    "test-presence-compact.html",
    "debug-presence-compact.html",
    "simple-test-presence.html"
)

foreach ($file in $htmlFiles) {
    $filePath = Join-Path $rootPath $file
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        
        # Remove referências aos CSS antigos
        $content = $content -replace '<link href="css/app\.css" rel="stylesheet">\s*', ''
        $content = $content -replace '<link href="css/mobile-app\.css" rel="stylesheet">\s*', ''
        $content = $content -replace '<link href="css/components\.css" rel="stylesheet">\s*', ''
        $content = $content -replace '<link href="css/utilities\.css" rel="stylesheet">\s*', ''
        
        # Adiciona o CSS universal se não estiver presente
        if ($content -notmatch 'css/design-system\.css') {
            $content = $content -replace '(<title>.*</title>\s*)', "`$1`n    <link href=`"css/design-system.css`" rel=`"stylesheet`">"
        }
        
        # Salva o arquivo atualizado
        Set-Content $filePath $content -Encoding UTF8
        Write-Host "✓ Atualizado: $file"
    } else {
        Write-Host "⚠ Arquivo não encontrado: $file"
    }
}

Write-Host "`n✅ Atualização concluída! Todas as páginas agora usam o CSS universal mobile-desktop."