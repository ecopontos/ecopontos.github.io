// Script para extrair dados do EcoForms via Console do Chrome DevTools
// Como usar:
// 1. Abra o app EcoForms no dispositivo Android
// 2. No PC, abra Chrome -> chrome://inspect/#devices
// 3. Clique em "Inspect" no WebView do EcoForms
// 4. Cole este código inteiro no Console e pressione Enter
// 5. Os dados serão baixados automaticamente como arquivos JSON

(async function extractEcoFormsData() {
    console.log('[EcoFormsExtractor] Iniciando extração de dados...');
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
        console.log(`[EcoFormsExtractor] Download iniciado: ${filename}`);
    }

    // 1. LOCALSTORAGE
    try {
        const localStorageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            let value = localStorage.getItem(key);
            try { value = JSON.parse(value); } catch (e) {}
            localStorageData[key] = value;
        }
        downloadJSON(`ecoforms_localstorage_${timestamp}.json`, localStorageData);
        console.log(`[EcoFormsExtractor] LocalStorage: ${Object.keys(localStorageData).length} chaves encontradas`);
    } catch (e) {
        console.error('[EcoFormsExtractor] Erro ao extrair LocalStorage:', e);
    }

    // 2. SESSIONSTORAGE
    try {
        const sessionStorageData = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            let value = sessionStorage.getItem(key);
            try { value = JSON.parse(value); } catch (e) {}
            sessionStorageData[key] = value;
        }
        if (Object.keys(sessionStorageData).length > 0) {
            downloadJSON(`ecoforms_sessionstorage_${timestamp}.json`, sessionStorageData);
            console.log(`[EcoFormsExtractor] SessionStorage: ${Object.keys(sessionStorageData).length} chaves encontradas`);
        }
    } catch (e) {
        console.error('[EcoFormsExtractor] Erro ao extrair SessionStorage:', e);
    }

    // 3. INDEXEDDB - Tenta abrir ecoforms.sqlite
    try {
        const request = indexedDB.open('ecoforms.sqlite', 1);
        request.onsuccess = function(event) {
            const db = event.target.result;
            console.log(`[EcoFormsExtractor] IndexedDB aberto. Object stores: ${Array.from(db.objectStoreNames).join(', ')}`);
            
            const storeNames = Array.from(db.objectStoreNames);
            if (storeNames.length === 0) {
                console.log('[EcoFormsExtractor] Nenhum object store encontrado no IndexedDB');
                db.close();
                return;
            }

            storeNames.forEach(storeName => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const getAll = store.getAll();
                getAll.onsuccess = function(e) {
                    const data = e.target.result;
                    downloadJSON(`ecoforms_indexeddb_${storeName}_${timestamp}.json`, data);
                    console.log(`[EcoFormsExtractor] IndexedDB store "${storeName}": ${data.length} registros`);
                };
                getAll.onerror = function(e) {
                    console.error(`[EcoFormsExtractor] Erro ao ler store "${storeName}":`, e.target.error);
                };
            });

            tx.oncomplete = function() {
                db.close();
            };
        };
        request.onerror = function(event) {
            console.error('[EcoFormsExtractor] Erro ao abrir IndexedDB:', event.target.error);
        };
        request.onupgradeneeded = function(event) {
            console.log('[EcoFormsExtractor] IndexedDB onupgradeneeded - banco não existia ou versão diferente');
        };
    } catch (e) {
        console.error('[EcoFormsExtractor] Erro ao tentar IndexedDB:', e);
    }

    // 4. WEBSQL - Tenta abrir ecoforms.sqlite
    try {
        if (window.openDatabase) {
            const db = openDatabase('ecoforms.sqlite', '1.0', 'suite', 50 * 1024 * 1024);
            db.transaction(function(tx) {
                tx.executeSql("SELECT name FROM sqlite_master WHERE type='table'", [], function(tx, result) {
                    const tables = [];
                    for (let i = 0; i < result.rows.length; i++) {
                        tables.push(result.rows.item(i).name);
                    }
                    console.log(`[EcoFormsExtractor] WebSQL tabelas encontradas: ${tables.join(', ')}`);
                    
                    if (tables.length === 0) {
                        console.log('[EcoFormsExtractor] Nenhuma tabela no WebSQL');
                        return;
                    }

                    tables.forEach(tableName => {
                        if (tableName === '__WebKitDatabaseInfoTable__' || tableName === 'sqlite_sequence') return;
                        tx.executeSql(`SELECT * FROM ${tableName}`, [], function(tx, res) {
                            const rows = [];
                            for (let i = 0; i < res.rows.length; i++) {
                                rows.push(res.rows.item(i));
                            }
                            downloadJSON(`ecoforms_websql_${tableName}_${timestamp}.json`, rows);
                            console.log(`[EcoFormsExtractor] WebSQL tabela "${tableName}": ${rows.length} registros`);
                        }, function(tx, err) {
                            console.error(`[EcoFormsExtractor] Erro ao ler tabela "${tableName}":`, err);
                        });
                    });
                }, function(tx, err) {
                    console.error('[EcoFormsExtractor] Erro ao listar tabelas WebSQL:', err);
                });
            });
        } else {
            console.log('[EcoFormsExtractor] WebSQL (openDatabase) não disponível neste navegador/WebView');
        }
    } catch (e) {
        console.error('[EcoFormsExtractor] Erro ao tentar WebSQL:', e);
    }

    // 5. Verifica se Service Worker está ativo
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            console.log(`[EcoFormsExtractor] Service Workers registrados: ${regs.length}`);
            regs.forEach((reg, i) => {
                console.log(`  [${i}] Scope: ${reg.scope}, State: ${reg.installing || reg.waiting || reg.active}`);
            });
        } else {
            console.log('[EcoFormsExtractor] Service Worker não suportado');
        }
    } catch (e) {
        console.error('[EcoFormsExtractor] Erro ao verificar Service Worker:', e);
    }

    console.log('[EcoFormsExtractor] Extração concluída! Verifique os downloads.');
})();
