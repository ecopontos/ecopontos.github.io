// Script para extrair dados do IndexedDB store 'formsubmissions' do banco 'FormDataDB'
// Como usar:
// 1. No Chrome DevTools (inspect do app), vá na aba Console
// 2. Cole este código e pressione Enter
// 3. O arquivo JSON será baixado automaticamente

(async function extractFormSubmissions() {
    const DB_NAME = 'FormDataDB';
    const STORE_NAME = 'formsubmissions';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    function downloadJSON(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`[Extract] Download iniciado: ${filename} (${data.length} registros)`);
    }

    // Abre o banco de dados
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = function(event) {
        const db = event.target.result;
        console.log(`[Extract] Banco aberto: ${db.name}, versão: ${db.version}`);
        console.log(`[Extract] Stores disponíveis: ${Array.from(db.objectStoreNames).join(', ')}`);

        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.error(`[Extract] Store '${STORE_NAME}' não encontrado! Stores: ${Array.from(db.objectStoreNames).join(', ')}`);
            db.close();
            return;
        }

        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getAll = store.getAll();

        getAll.onsuccess = function(e) {
            const data = e.target.result;
            downloadJSON(`ecoforms_${STORE_NAME}_${timestamp}.json`, data);
            console.log(`[Extract] Sucesso! ${data.length} registros extraídos.`);
            
            // Mostra preview dos primeiros registros
            if (data.length > 0) {
                console.log('[Extract] Preview do primeiro registro:');
                console.log(data[0]);
            }
        };

        getAll.onerror = function(e) {
            console.error('[Extract] Erro ao ler registros:', e.target.error);
        };

        tx.oncomplete = function() {
            db.close();
            console.log('[Extract] Transação concluída.');
        };
    };

    request.onerror = function(event) {
        console.error('[Extract] Erro ao abrir IndexedDB:', event.target.error);
        console.log('[Extract] Dica: Verifique o nome exato do banco na aba Application > IndexedDB');
    };

    request.onblocked = function() {
        console.warn('[Extract] Banco bloqueado. Feche outras abas/janelas que possam estar usando o IndexedDB.');
    };
})();
