// Script para extrair TODOS os registros do IndexedDB usando cursor (sem limite de getAll)
// Cole TODO este código no Console do Chrome DevTools

(function extractAllWithCursor() {
    const DB_NAME = 'FormDataDB';
    const STORE_NAME = 'formsubmissions';
    const BATCH_SIZE = 500; // Processa em lotes para não travar
    
    const allData = [];
    let count = 0;
    
    function log(msg) {
        console.log('[Cursor Extract]', msg);
    }
    
    log('Abrindo banco com cursor...');
    
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = function(e) {
        const db = e.target.result;
        log('Banco aberto. Stores: ' + Array.from(db.objectStoreNames).join(', '));
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            log('Store não encontrado!', 'error');
            db.close();
            return;
        }
        
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        // Usar count primeiro para saber o total
        const countReq = store.count();
        countReq.onsuccess = function(e) {
            const total = e.target.result;
            log('TOTAL DE REGISTROS NO BANCO: ' + total);
            
            if (total === 0) {
                log('Banco vazio!');
                db.close();
                return;
            }
            
            // Agora extrair com cursor
            let processed = 0;
            const cursorReq = store.openCursor();
            
            cursorReq.onsuccess = function(e) {
                const cursor = e.target.result;
                if (cursor) {
                    allData.push(cursor.value);
                    processed++;
                    count++;
                    
                    if (processed % BATCH_SIZE === 0) {
                        log('Processados: ' + processed + ' / ' + total);
                    }
                    
                    cursor.continue();
                } else {
                    // Fim do cursor
                    log('EXTRAÇÃO CONCLUÍDA! Total: ' + allData.length);
                    
                    // Download
                    const blob = new Blob([JSON.stringify(allData, null, 2)], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'ecoforms_formsubmissions_COMPLETE_' + Date.now() + '.json';
                    document.body.appendChild(a);
                    a.click();
                    URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    log('Download iniciado: ' + a.download);
                    db.close();
                }
            };
            
            cursorReq.onerror = function(e) {
                log('Erro no cursor: ' + e.target.error, 'error');
                db.close();
            };
        };
        
        countReq.onerror = function(e) {
            log('Erro ao contar: ' + e.target.error, 'error');
            db.close();
        };
    };
    
    req.onerror = function(e) {
        log('Erro ao abrir banco: ' + e.target.error, 'error');
    };
})();
