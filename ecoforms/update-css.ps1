# Script para atualizar CSS references
$wwwPath = "c:\Users\marce\OneDrive\Área de Trabalho\fabrica-2 (4)\fabrica-2\www"

$files = @(
    "test-isolated-checklist.html",
    "test-form-renderer.html", 
    "galeria-campos.html",
    "test-access-control.html",
    "debug-field-factory.html",
    "debug-forms.html",
    "test-smart-cache.html",
    "test-auth.html"
)

foreach ($file in $files) {
    $path = Join-Path $wwwPath $file
    if (Test-Path $path) {
        $content = Get-Content $path -Raw -Encoding UTF8
        $content = $content -replace '<link href="css/app\.css" rel="stylesheet">', '<link href="css/design-system.css" rel="stylesheet">'
        $content = $content -replace '<link href="css/mobile-app\.css" rel="stylesheet">', ''
        Set-Content $path $content -Encoding UTF8
        Write-Host "Updated: $file"
    }
}

Write-Host "Done!"