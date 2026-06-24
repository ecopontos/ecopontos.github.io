#!/bin/bash
# build-debug-mobile.sh
# Script para gerar build de debug otimizado para teste em celular

echo "🚀 Iniciando build de debug para mobile..."

# 1. Limpar builds anteriores
echo "🧹 Limpando builds anteriores..."
rm -rf mobile/android/app/build/
rm -rf node_modules/.cache/ 2>/dev/null

# 2. Build do CSS otimizado
echo "🎨 Compilando CSS..."
npm run build

# 3. Verificar arquivos essenciais
echo "📋 Verificando arquivos essenciais..."
if [ ! -f "mobile/www/index.html" ]; then
    echo "❌ Erro: mobile/www/index.html não encontrado"
    exit 1
fi

if [ ! -f "mobile/www/css/design-system.css" ]; then
    echo "❌ Erro: mobile/www/css/design-system.css não encontrado"
    echo "Execute: npm run build:mobile"
    exit 1
fi

# 4. Sincronizar com Capacitor
echo "🔄 Sincronizando com Capacitor..."
npx cap sync

# 5. Verificar configuração Android
if [ ! -f "mobile/android/app/src/main/AndroidManifest.xml" ]; then
    echo "❌ Erro: Projeto Android não configurado"
    echo "Execute: cd mobile && npx cap add android"
    exit 1
fi

# 6. Build debug APK
echo "📱 Gerando APK de debug..."
cd mobile/android
./gradlew assembleDebug

# 7. Verificar se APK foi gerado
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo "✅ APK gerado com sucesso!"
    echo "📍 Localização: mobile/android/$APK_PATH"
    
    # Mostrar informações do APK
    echo ""
    echo "ℹ️  Informações do APK:"
    ls -lh "$APK_PATH"
    
    # Verificar se ADB está disponível
    if command -v adb &> /dev/null; then
        echo ""
        echo "🔌 ADB detectado. Para instalar no dispositivo conectado:"
        echo "   adb install android/$APK_PATH"
        echo ""
        echo "🔍 Dispositivos conectados:"
        adb devices
    else
        echo ""
        echo "⚠️  ADB não encontrado. Instale Android SDK Platform Tools"
    fi
    
    echo ""
    echo "🎉 Build de debug concluído!"
    echo "📁 APK disponível em: $(pwd)/$APK_PATH"
    
else
    echo "❌ Erro: APK não foi gerado"
    echo "Verifique os logs acima para erros"
    exit 1
fi