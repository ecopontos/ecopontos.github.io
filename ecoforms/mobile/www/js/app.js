/**
 * App Principal - Demonstração da integração completa
 * FormRenderer + SmartCache + Supabase Storage
 */

class App {
    constructor() {
        this.formRenderer = null;
        this.initialized = false;
    }

    async init() {
        try {
            console.log('🚀 Inicializando aplicação...');
            
            // Inicializar FormRenderer
            this.formRenderer = new FormRenderer();
            await this.formRenderer.init();
            
            this.initialized = true;
            console.log('✅ Aplicação inicializada com sucesso!');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar aplicação:', error);
            return false;
        }
    }

    async loadForm(formId, containerId = 'form-container') {
        if (!this.initialized) {
            const success = await this.init();
            if (!success) {
                throw new Error('Falha na inicialização da aplicação');
            }
        }

        return await this.formRenderer.loadForm(formId, containerId);
    }

    async listForms() {
        if (!this.initialized) {
            await this.init();
        }
        return await this.formRenderer.listAvailableForms();
    }

    async listData() {
        if (!this.initialized) {
            await this.init();
        }
        return await this.formRenderer.listAvailableData();
    }

    clearCache() {
        if (this.formRenderer && this.formRenderer.smartCache) {
            this.formRenderer.smartCache.clearCache();
        }
    }
}

// Instância global
window.app = new App();

// Funções utilitárias para uso direto no HTML
window.loadForm = async (formId, containerId) => {
    return await window.app.loadForm(formId, containerId);
};

window.listForms = async () => {
    return await window.app.listForms();
};

window.listData = async () => {
    return await window.app.listData();
};

window.clearCache = () => {
    window.app.clearCache();
};

// Auto-inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado. App disponível em window.app');
});