// Script de diagnóstico e extração forçada do IndexedDB
// Cole TODO este código no Console do Chrome DevTools

(function diagnoseAndExtract() {
    const DB_NAME = 'FormDataDB';
    const STORE_NAME = 'formsubmissions';
    
    function log(msg, type='info') {
        const prefix = '[EcoForms Diag]';
        if (type === 'error') console.error(prefix, msg);
        else if (type === 'warn') console.warn(prefix, msg);
        else console.log(prefix, msg);
    }
    
    // 1. Primeiro, listar todos os bancos disponíveis
    log('=== DIAGNÓSTICO INICIAL ===');
    log('Verificando indexedDB...');
    log('indexedDB existe? ' + !!window.indexedDB);
    
    if (window.indexedDB && indexedDB.databases) {
        log('Listando todos os bancos com indexedDB.databases()...');
        indexedDB.databases().then(dbs => {
            log('Bancos encontrados: ' + JSON.stringify(dbs));
        }).catch(e => {
            log('Erro ao listar bancos: ' + e.message, 'error');
        });
    } else {
        log('indexedDB.databases() não suportado neste navegador/WebView', 'warn');
    }
    
    // 2. Tentar abrir com timeout curto e retry
    async function tryOpenDB(attempt = 1) {
        log(`Tentativa ${attempt}: Abrindo '${DB_NAME}'...`);
        
        return new Promise((resolve, reject) => {
            let resolved = false;
            
            // Timeout de 5 segundos por tentativa
            const timeout = setTimeout(() => {
                if (!resolved) {
                    log(`Tentativa ${attempt}: TIMEOUT (5s)`, 'warn');
                    reject(new Error('Timeout'));
                }
            }, 5000);
            
            try {
                const req = indexedDB.open(DB_NAME);
                
                req.onsuccess = function(e) {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(e.target.result);
                };
                
                req.onerror = function(e) {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeout);
                    reject(e.target.error);
                };
                
                req.onblocked = function(e) {
                    log(`Tentativa ${attempt}: BLOQUEADO - outra conexão aberta`, 'warn');
                };
                
                req.onupgradeneeded = function(e) {
                    log(`Tentativa ${attempt}: UPGRADE NEEDED (versão ${e.newVersion})`, 'warn');
                };
                
            } catch (err) {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                reject(err);
            }
        });
    }
    
    // 3. Função principal
    async function main() {
        let db = null;
        
        // Tentar até 3 vezes
        for (let i = 1; i <= 3; i++) {
            try {
                db = await tryOpenDB(i);
                log(`SUCESSO! Banco aberto na tentativa ${i}`);
                break;
            } catch (e) {
                log(`Tentativa ${i} falhou: ${e.message}`, 'error');
                if (i === 3) {
                    log('Todas as tentativas falharam.', 'error');
                    log('');
                    log('=== SOLUÇÕES ALTERNATIVAS ===', 'warn');
                    log('1. NA ABA APPLICATION: Clique com direito em FormDataDB > Delete database', 'warn');
                    log('   (CUIDADO: Isso apaga o banco! Só se tiver backup)');
                    log('');
                    log('2. NA ABA APPLICATION: Vá em IndexedDB > FormDataDB > formsubmissions');
                    log('   Clique no botão "Refresh" (circular) acima da lista de stores');
                    log('');
                    log('3. FECHE esta aba do DevTools, abra uma nova em chrome://inspect/#devices');
                    log('   e clique em Inspect novamente');
                    log('');
                    log('4. No dispositivo, FORCE PARE o app e abra novamente');
                    log('');
                    log('5. Tente extrair via ADB (necessita root ou app debug):');
                    log('   adb shell run-as com.ecosuite.pmf ls -R app_webview/Default/IndexedDB/');
                    return;
                }
                // Esperar 1s antes de tentar novamente
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        if (!db) return;
        
        log(`Banco: ${db.name}, Versão: ${db.version}`);
        log(`Stores: [${Array.from(db.objectStoreNames).join(', ')}]`);
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            log(`Store '${STORE_NAME}' não encontrado!`, 'error');
            db.close();
            return;
        }
        
        // Ler dados
        log(`Lendo store '${STORE_NAME}'...`);
        const data = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout na leitura')), 5000);
            
            try {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                
                req.onsuccess = e => {
                    clearTimeout(timeout);
                    resolve(e.target.result);
                };
                req.onerror = e => {
                    clearTimeout(timeout);
                    reject(e.target.error);
                };
            } catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
        
        log(`EXTRAÍDO! ${data.length} registros.`);
        
        if (data.length > 0) {
            log('Preview:');
            console.log(data[0]);
        }
        
        // Download
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ecoforms_${STORE_NAME}_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            log('Download iniciado!');
        } catch (e) {
            log('Erro no download: ' + e.message, 'error');
            log('Dados no console (copie manualmente):');
            console.log(JSON.stringify(data, null, 2).substring(0, 3000));
        }
        
        db.close();
    }
    
    // Iniciar
    main().catch(e => {
        log('Erro fatal: ' + e.message, 'error');
        console.error(e);
    });
    
})();
