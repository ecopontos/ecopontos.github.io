@echo off
echo 🚀 Iniciando Servidor para Página de Exemplo Vistoria Checklist
echo ============================================================
echo.
echo 📋 Página: exemplo-vistoria-checklist-funcional.html
echo 🌐 URL: http://localhost:8080/exemplo-vistoria-checklist-funcional.html
echo 📖 README: VISTORIA_CHECKLIST_EXAMPLE_README.md
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
cd /d "%~dp0www"
python -m http.server 8080