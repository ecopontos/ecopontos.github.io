// Script robusto para extrair dados do IndexedDB com diagnóstico e timeout
// Cole TODO este código no Console do Chrome DevTools

(async function extractWithDiagnostics() {
    const DB_NAME = 'FormDataDB';
    const STORE_NAME = 'formsubmissions';
    const TIMEOUT_MS = 10000; // 10 segundos timeout
    
    function log(msg, type='info') {
        const prefix = '[EcoForms Extract]';
        if (type === 'error') console.error(prefix, msg);
        else if (type === 'warn') console.warn(prefix, msg);
        else console.log(prefix, msg);
    }
    
    function downloadJSON(filename, data) {
        try {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            log(`Download iniciado: ${filename} (${data.length} registros)`);
        } catch (e) {
            log('Erro ao criar download: ' + e.message, 'error');
            // Fallback: mostrar no console para copiar manualmente
            log('Dados (primeiros 5000 chars):');
            console.log(JSON.stringify(data, null, 2).substring(0, 5000));
        }
    }
    
    // Timeout wrapper
    function withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout: ${label} demorou mais de ${ms}ms`)), ms)
            )
        ]);
    }
    
    try {
        log('Abrindo banco: ' + DB_NAME);
        
        // Abrir banco
        const db = await withTimeout(
            new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME);
                req.onsuccess = e => resolve(e.target.result);
                req.onerror = e => reject(e.target.error);
                req.onblocked = () => reject(new Error('Banco bloqueado por outra aba/transaction'));
                req.onupgradeneeded = e => {
                    log('Upgrade needed - versão do banco mudou', 'warn');
                };
            }),
            TIMEOUT_MS,
            'Abrir IndexedDB'
        );
        
        log(`Banco aberto! Nome: ${db.name}, Versão: ${db.version}`);
        log(`Stores disponíveis: [${Array.from(db.objectStoreNames).join(', ')}]`);
        
        // Verificar se store existe
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            log(`Store '${STORE_NAME}' NÃO ENCONTRADO!`, 'error');
            log('Stores disponíveis: ' + Array.from(db.objectStoreNames).join(', '), 'warn');
            db.close();
            return;
        }
        
        log(`Store '${STORE_NAME}' encontrado. Iniciando leitura...`);
        
        // Ler dados
        const data = await withTimeout(
            new Promise((resolve, reject) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.getAll();
                    
                    req.onsuccess = e => resolve(e.target.result);
                    req.onerror = e => reject(e.target.error);
                    
                    tx.oncomplete = () => log('Transaction completada');
                    tx.onerror = e => reject(e.target.error);
                    tx.onabort = () => reject(new Error('Transaction abortada'));
                } catch (e) {
                    reject(e);
                }
            }),
            TIMEOUT_MS,
            'Ler store getAll()'
        );
        
        log(`Leitura concluída! ${data.length} registros encontrados.`);
        
        if (data.length > 0) {
            log('Preview do primeiro registro:');
            console.log(data[0]);
        }
        
        // Download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadJSON(`ecoforms_${STORE_NAME}_${timestamp}.json`, data);
        
        db.close();
        log('Banco fechado. Extração concluída!');
        
    } catch (error) {
        log('ERRO: ' + error.message, 'error');
        console.error(error);
        
        // Diagnóstico adicional
        log('\n=== DIAGNÓSTICO ===', 'warn');
        log('1. Verifique se o app está aberto e visível no dispositivo', 'warn');
        log('2. Na aba Application > IndexedDB, clique em "Refresh IndexedDB"', 'warn');
        log('3. Tente fechar e reabrir o inspect do WebView', 'warn');
        log('4. Verifique se há outras abas do Chrome inspecionando o mesmo app', 'warn');
    }
})();
