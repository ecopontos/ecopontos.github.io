/**
 * Teste de performance para upload de imagens
 * Execute no console do navegador para testar as melhorias
 */

async function testImageUploadPerformance() {
    console.log('🧪 Iniciando teste de performance de upload de imagens...');

    // Simular seleção de arquivo grande
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log(`📁 Arquivo selecionado: ${file.name} (${Math.round(file.size/1024/1024*100)/100}MB)`);

        const startTime = performance.now();

        try {
            // Testar compressão
            if (file.size > 1024 * 1024) {
                console.log('🗜️ Testando compressão...');
                const compressedFile = await CameraField.compressImage(file);
                const compressionTime = performance.now() - startTime;
                console.log(`✅ Compressão concluída em ${compressionTime.toFixed(2)}ms`);
                console.log(`📊 Tamanho reduzido: ${Math.round(file.size/1024/1024*100)/100}MB → ${Math.round(compressedFile.size/1024/1024*100)/100}MB`);
            }

            // Testar upload (se dataService estiver disponível)
            if (window.dataService && window.dataService.supabaseClient) {
                console.log('📤 Testando upload...');
                const uploadStart = performance.now();
                const result = await window.dataService.uploadFileToStorage(file);
                const uploadTime = performance.now() - uploadStart;
                console.log(`✅ Upload concluído em ${uploadTime.toFixed(2)}ms`);
                console.log('🔗 URL do arquivo:', result.url);
            } else {
                console.log('⚠️ DataService não configurado - upload não testado');
            }

        } catch (error) {
            console.error('❌ Erro no teste:', error);
        }

        const totalTime = performance.now() - startTime;
        console.log(`⏱️ Tempo total: ${totalTime.toFixed(2)}ms`);
    };

    // Simular clique para abrir seletor de arquivos
    input.click();
}

// Função para testar apenas o preview
function testImagePreviewPerformance() {
    console.log('🖼️ Testando performance do preview de imagens...');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        console.log(`📁 Arquivo para preview: ${file.name} (${Math.round(file.size/1024/1024*100)/100}MB)`);

        const startTime = performance.now();

        const reader = new FileReader();
        reader.onload = () => {
            const previewTime = performance.now() - startTime;
            console.log(`✅ Preview gerado em ${previewTime.toFixed(2)}ms`);

            // Criar preview visual para teste
            const img = document.createElement('img');
            img.src = reader.result;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '200px';
            img.style.border = '1px solid #ccc';
            img.style.borderRadius = '4px';

            // Adicionar à página para visualização
            const testDiv = document.createElement('div');
            testDiv.style.position = 'fixed';
            testDiv.style.top = '10px';
            testDiv.style.right = '10px';
            testDiv.style.background = 'white';
            testDiv.style.padding = '10px';
            testDiv.style.border = '1px solid #ccc';
            testDiv.style.zIndex = '9999';
            testDiv.innerHTML = '<h4>Teste de Preview</h4>';
            testDiv.appendChild(img);

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Fechar';
            closeBtn.onclick = () => document.body.removeChild(testDiv);
            testDiv.appendChild(closeBtn);

            document.body.appendChild(testDiv);
        };

        reader.readAsDataURL(file);
    };

    input.click();
}

// Disponibilizar funções globalmente para teste
if (typeof window !== 'undefined') {
    window.testImageUploadPerformance = testImageUploadPerformance;
    window.testImagePreviewPerformance = testImagePreviewPerformance;
    console.log('🧪 Funções de teste disponíveis:');
    console.log('  - testImageUploadPerformance()');
    console.log('  - testImagePreviewPerformance()');
}