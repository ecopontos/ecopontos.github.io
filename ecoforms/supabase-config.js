/**
 * Configuração Principal do Supabase
 * Este arquivo ativa a integração do DataService com Supabase em todas as páginas
 */

// Configuração do Supabase - SUPORTA VARIÁVEIS DE AMBIENTE PARA PRODUÇÃO
const SUPABASE_CONFIG = (function () {
    // Try to read runtime meta tags first (safer than hardcoding keys in source)
    const readMeta = (name) => {
        try { return document.querySelector(`meta[name="${name}"]`)?.content || null; } catch (e) { return null; }
    };

    const urlFromMeta = (typeof window !== 'undefined') ? readMeta('supabase-url') : null;
    const keyFromMeta = (typeof window !== 'undefined') ? readMeta('supabase-key') : null;
    const tableFromMeta = (typeof window !== 'undefined') ? readMeta('supabase-table') : null;

    const url = urlFromMeta || ((typeof window !== 'undefined' && window.VITE_SUPABASE_URL) || '');
    const key = keyFromMeta || ((typeof window !== 'undefined' && window.VITE_SUPABASE_ANON_KEY) || '');
    const tableName = tableFromMeta || ((typeof window !== 'undefined' && window.VITE_SUPABASE_TABLE_NAME) || 'suite');

    if (!url || !key) {
        console.error('❌ Supabase URL ou ANON_KEY não configurados. Defina via meta tags ou variáveis de ambiente.');
    }

    return {
        url,
        key,
        tableName,
        userId: '00000000-0000-0000-0000-000000000000'
    };
})();

// Estado da configuração
let isConfigured = false;
let autoSyncInterval = null;

/**
 * Inicializa a configuração do Supabase automaticamente
 */
async function initializeSupabaseIntegration() {
    try {
        // Verificar se o dataService está disponível
        if (typeof window.dataService === 'undefined') {
            console.warn('⚠️ DataService não encontrado. Tentando novamente em 1 segundo...');
            setTimeout(initializeSupabaseIntegration, 1000);
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
 * Inicia sincronização automática
 */
function startAutoSync() {
    if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
    }

    // Sincronizar a cada 30 segundos
    autoSyncInterval = setInterval(async () => {
        try {
            const result = await window.dataService.syncPendingData();
            if (result.synced > 0) {
                console.log(`🔄 Sincronização automática: ${result.synced} registros enviados`);
            }
        } catch (error) {
            console.warn('⚠️ Erro na sincronização automática:', error);
        }
    }, 30000);

    console.log('🔄 Sincronização automática ativada (30s)');
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
 * Força sincronização manual
 */
async function forceSyncNow() {
    try {
        console.log('🔄 Iniciando sincronização manual...');
        const result = await window.dataService.syncPendingData();
        console.log('✅ Sincronização manual concluída:', result);
        return result;
    } catch (error) {
        console.error('❌ Erro na sincronização manual:', error);
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
    document.addEventListener('DOMContentLoaded', initializeSupabaseIntegration);
} else {
    // DOM já está pronto
    initializeSupabaseIntegration();
}

// Também tentar inicializar após um pequeno delay para garantir que o dataService foi carregado
setTimeout(initializeSupabaseIntegration, 500);

// Função para obter estatísticas básicas
function getSupabaseStats() {
    return {
        connected: isConfigured,
        lastSync: new Date().toISOString(),
        status: isConfigured ? 'online' : 'offline'
    };
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

console.log('📦 Supabase Config carregado - aguardando inicialização...');