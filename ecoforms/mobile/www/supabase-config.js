/**
 * Configuração Principal do Supabase
 * Este arquivo ativa a integração do DataService com Supabase em todas as páginas
 * e também inclui a integração do EcopontoCaixasSync com o serviço de sincronização SQLite
 */

// Evita a redeclaração da constante
if (typeof window._SUPABASE_CONFIG_INSTANCE === 'undefined') {
    window._SUPABASE_CONFIG_INSTANCE = {
        url: (typeof window !== 'undefined' && window.VITE_SUPABASE_URL) || 'https://vnnimekczkxkpckrydnc.supabase.co',
        key: (typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubmltZWtjemt4a3Bja3J5ZG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDQ0NjUsImV4cCI6MjA3NzA4MDQ2NX0.RqLwcGIv5B5QnTfxvbemtTEx_Lve9Q6hqbab9SKA6aA',
        tableName: (typeof window !== 'undefined' && window.VITE_SUPABASE_TABLE_NAME) || 'suite',
        userId: '00000000-0000-0000-0000-000000000000'
    };
}
// Usar `var` para evitar erro se o script for incluído múltiplas vezes no mesmo contexto
var SUPABASE_CONFIG = window._SUPABASE_CONFIG_INSTANCE;

// Estado da configuração (usando var para evitar redeclaração se script carregado múltiplas vezes)
if (typeof window._supabaseConfigState === 'undefined') {
    window._supabaseConfigState = {
        isConfigured: false,
        autoSyncInterval: null,
        initializationAttempted: false
    };
}
var isConfigured = window._supabaseConfigState.isConfigured;
var autoSyncInterval = window._supabaseConfigState.autoSyncInterval;
var initializationAttempted = window._supabaseConfigState.initializationAttempted;

/**
 * Inicializa a configuração do Supabase automaticamente
 */
async function initializeSupabaseIntegration() {
    // Evitar inicializações múltiplas
    if (initializationAttempted) {
        console.log('🔄 Inicialização do Supabase já foi tentada');
        return;
    }
    initializationAttempted = true;

    try {
        // Verificar se o dataService está disponível
        if (typeof window.dataService === 'undefined') {
            console.warn('⚠️ DataService não encontrado. Aguardando carregamento...');

            // Apenas aguardar - não carregar novamente pois já está no HTML
            // O script data-service.js deve estar carregando via tag <script> no index.html
            setTimeout(initializeSupabaseIntegration, 500);
            return;
        }

        // Verificar se já foi configurado
        if (isConfigured) {
            console.log('✅ Supabase já está configurado');
            return;
        }

        console.log('🔧 Configurando integração com Supabase...');

        // Configurar o DataService
        window.dataService.configureSupabase(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.key,
            SUPABASE_CONFIG.userId
        );

        // Definir nome da tabela
        window.dataService.setTableName(SUPABASE_CONFIG.tableName);

        // Testar conexão
        const connectionStatus = await window.dataService.checkSupabaseConnection();

        if (connectionStatus.connected) {
            console.log('✅ Supabase configurado e conectado com sucesso!');
            console.log(`📊 Tabela: ${SUPABASE_CONFIG.tableName}`);

            // Marcar como configurado
            isConfigured = true;

            // Iniciar sincronização automática (a cada 30 segundos)
            startAutoSync();

            // Disparar evento personalizado para notificar outras partes da aplicação
            window.dispatchEvent(new CustomEvent('supabaseConfigured', {
                detail: { config: SUPABASE_CONFIG, status: connectionStatus }
            }));

        } else {
            console.error('❌ Falha na conexão com Supabase:', connectionStatus.error);
            console.warn('⚠️ Verifique as configurações em supabase-config.js');
        }

    } catch (error) {
        console.error('❌ Erro ao configurar Supabase:', error);
        console.warn('⚠️ Verifique as configurações em supabase-config.js');
    }
}

/**
 * Inicia sincronização automática via SyncAdapter
 */
function startAutoSync() {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }

    autoSyncInterval = setInterval(async () => {
        try {
            const adapter = window.syncAdapter;
            if (adapter && adapter.isStarted()) {
                const result = await adapter.syncNow();
                if (result.pushed > 0 || result.pulled > 0) {
                    console.log(`🔄 AutoSync: ${result.pushed} enviados, ${result.pulled} recebidos`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro no auto-sync:', error);
        }
    }, 30000);

    console.log('🔄 AutoSync ativado via SyncAdapter (30s)');
}

/**
 * Para sincronização automática
 */
function stopAutoSync() {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        console.log('⏹️ Sincronização automática desativada');
    }
}

/**
 * Força sincronização manual via SyncAdapter
 */
async function forceSyncNow() {
    try {
        console.log('🔄 Sincronização manual...');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            const result = await adapter.syncNow();
            console.log('✅ Sync manual:', result);
            return result;
        }
        console.warn('⚠️ SyncAdapter não disponível');
        return { pushed: 0, pulled: 0, errors: [] };
    } catch (error) {
        console.error('❌ Erro no sync manual:', error);
        throw error;
    }
}

/**
 * Obtém estatísticas atuais
 */
async function getSupabaseStats() {
    try {
        const stats = await window.dataService.getStats();
        return stats;
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
        return null;
    }
}

/**
 * Verifica se o Supabase está configurado e conectado
 */
function isSupabaseReady() {
    return isConfigured;
}

// Inicializar automaticamente quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeSupabaseIntegration, 100);
    });
} else {
    // DOM já está pronto, inicializar após um pequeno delay
    setTimeout(initializeSupabaseIntegration, 100);
}

// Exportar funções para uso global
window.supabaseIntegration = {
    config: SUPABASE_CONFIG,
    isReady: isSupabaseReady,
    forceSyncNow,
    getStats: getSupabaseStats,
    startAutoSync,
    stopAutoSync
};

// Para ambientes Node.js (se necessário)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUPABASE_CONFIG,
        initializeSupabaseIntegration,
        forceSyncNow,
        getSupabaseStats,
        isSupabaseReady,
        startAutoSync,
        stopAutoSync
    };
}

// Inicializar integração do EcopontoCaixasSync
async function initializeEcopontoCaixasSyncIntegration() {
    try {
        // Verificar se o script de integração já foi carregado
        if (typeof window.getEcopontoCaixasSyncIntegration === 'function') {
            console.log('🔧 Inicializando integração do EcopontoCaixasSync...');
            const integration = window.getEcopontoCaixasSyncIntegration();
            await integration.initialize();
            console.log('✅ Integração do EcopontoCaixasSync inicializada');
        } else {
            // Se o script não estiver carregado, tentar carregar dinamicamente
            console.warn('⚠️ Script de integração do EcopontoCaixasSync não encontrado. Carregando...');
            const script = document.createElement('script');
            script.src = '../js/ecoponto-caixas-sync-integration.js';
            script.async = false;
            script.dataset.injected = 'ecoponto-caixas-sync-integration';
            document.head.appendChild(script);
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar integração do EcopontoCaixasSync:', error);
    }
}

// Inicializar a integração após o Supabase estar configurado
document.addEventListener('supabaseConfigured', () => {
    setTimeout(initializeEcopontoCaixasSyncIntegration, 500);
});

console.log('📦 Supabase Config carregado - aguardando inicialização...');