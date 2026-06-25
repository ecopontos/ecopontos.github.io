/**
 * Secure App Wrapper - Integra autenticação com FormRenderer
 * Controla acesso aos formulários baseado no perfil do usuário
 */

class SecureApp {
    constructor() {
        this.authManager = null;
        this.formRenderer = null;
        this.initialized = false;
        this.currentUser = null;
    }

    /**
     * Inicializa a aplicação segura
     */
    async init() {
        try {
            console.log('🔐 Inicializando aplicação segura...');

            // Inicializar autenticação
            this.authManager = new AuthManager();
            if (typeof supabase !== 'undefined' && window.supabaseConfig) {
                // Usar cliente singleton global se existir
                let supabaseClient;
                if (window.globalSupabaseClient) {
                    supabaseClient = window.globalSupabaseClient;
                    console.log('🔐 SecureApp usando cliente Supabase singleton existente');
                } else {
                    supabaseClient = supabase.createClient(
                        window.supabaseConfig.url,
                        window.supabaseConfig.key
                    );
                    window.globalSupabaseClient = supabaseClient;
                    console.log('🔐 SecureApp criou cliente Supabase singleton');
                }
                await this.authManager.init(supabaseClient);
            } else {
                await this.authManager.init();
            }

            // Verificar se usuário está logado
            if (!this.authManager.isLoggedIn()) {
                this.redirectToLogin();
                return false;
            }

            this.currentUser = this.authManager.getCurrentUser();
            console.log(`👤 Usuário logado: ${this.currentUser.nome} (${this.currentUser.perfil})`);

            // Inicializar FormRenderer
            if (typeof FormRenderer !== 'undefined') {
                this.formRenderer = new FormRenderer();
                await this.formRenderer.init();
            }

            this.initialized = true;
            console.log('✅ Aplicação segura inicializada');
            
            // Mostrar informações do usuário na interface
            this.updateUserInterface();
            
            return true;

        } catch (error) {
            console.error('❌ Erro na inicialização segura:', error);
            throw error;
        }
    }

    /**
     * Carrega formulário com verificação de permissão
     */
    async loadForm(formId, containerId) {
        if (!this.initialized) {
            await this.init();
        }

        // Verificar permissão de acesso
        if (!this.canAccessForm(formId)) {
            const error = `Usuário ${this.currentUser.nome} não tem permissão para acessar o formulário '${formId}'`;
            console.error('🚫', error);
            this.showAccessDenied(containerId, formId);
            return false;
        }

        console.log(`✅ Permissão concedida para '${formId}' → ${this.currentUser.nome}`);

        // Carregar formulário normalmente
        if (this.formRenderer) {
            return await this.formRenderer.loadForm(formId, containerId);
        } else {
            throw new Error('FormRenderer não inicializado');
        }
    }

    /**
     * Verifica se usuário pode acessar formulário
     * REFORÇADO: Verificação mais rigorosa das permissões do usuário
     */
    canAccessForm(formId) {
        console.log(`🔍 Validando acesso ao formulário: ${formId}`);
        
        if (!this.currentUser) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: usuário não autenticado`);
            return false;
        }

        // Gerentes têm acesso a tudo
        if (this.currentUser.perfil === 'gerente') {
            console.log(`✅ Acesso permitido ao formulário ${formId}: usuário é gerente`);
            return true;
        }

        // Verificar lista de formulários permitidos
        const allowed = this.currentUser.formulariosPermitidos.includes(formId);
        if (!allowed) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: não está na lista de permissões`);
        } else {
            console.log(`✅ Acesso permitido ao formulário ${formId}: está na lista de permissões`);
        }
        return allowed;
    }

    /**
     * Valida acesso ao formulário
     * REFORÇADO: Verificação mais rigorosa das permissões do usuário
     */
    validateFormAccess(formId) {
        console.log(`🔍 Validando acesso ao formulário: ${formId}`);
        
        if (!this.authManager.isLoggedIn()) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: usuário não está logado`);
            this.showLoginModal();
            return false;
        }

        if (!this.authManager.canAccessForm(formId)) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: usuário não tem permissão`);
            this.showMessage('Acesso negado', 'Você não tem permissão para acessar este formulário.', 'error');
            return false;
        }

        console.log(`✅ Acesso permitido ao formulário ${formId}: validação concluída com sucesso`);
        return true;
    }

    /**
     * Lista formulários disponíveis para o usuário
     * REFORÇADO: Sempre filtra baseado apenas nas permissões do usuário
     */
    async getAvailableForms() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // Buscar todos os formulários do Storage
            const allForms = this.formRenderer 
                ? await this.formRenderer.listAvailableForms()
                : [];

            console.log(`📋 Buscando formulários disponíveis para usuário: ${this.currentUser.nome} (${this.currentUser.perfil})`);

            // Filtrar baseado nas permissões
            if (this.currentUser.perfil === 'gerente') {
                console.log(`✅ Gerente tem acesso a todos ${allForms.length} formulários`);
                return allForms; // Gerente vê todos
            }

            // Filtrar apenas formulários que o usuário tem permissão
            const allowedForms = allForms.filter(form => {
                const hasPermission = this.currentUser.formulariosPermitidos.includes(form.id);
                if (!hasPermission) {
                    console.warn(`🚫 Formulário ${form.id} filtrado: não está na lista de permissões`);
                }
                return hasPermission;
            });

            console.log(`📊 Usuário tem acesso a ${allowedForms.length} de ${allForms.length} formulários`);
            console.log(`📋 Formulários permitidos:`, allowedForms.map(f => f.id));
            
            return allowedForms;

        } catch (error) {
            console.error('❌ Erro ao buscar formulários:', error);
            return [];
        }
    }

    /**
     * Mostra tela de acesso negado
     */
    showAccessDenied(containerId, formId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div style="
                text-align: center;
                padding: 40px 20px;
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                color: #856404;
            ">
                <h2>🚫 Acesso Negado</h2>
                <p>Você não tem permissão para acessar o formulário <strong>'${formId}'</strong></p>
                <p>Usuário: <strong>${this.currentUser.nome}</strong> (${this.currentUser.perfil})</p>
                
                <div style="margin: 20px 0;">
                    <strong>Formulários permitidos:</strong><br>
                    ${this.currentUser.formulariosPermitidos.length > 0 
                        ? this.currentUser.formulariosPermitidos.join(', ')
                        : 'Nenhum formulário específico (consulte o gerente)'
                    }
                </div>
                
                <button onclick="window.history.back()" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 5px;
                ">← Voltar</button>
                
                <button onclick="window.secureApp.showAvailableForms('${containerId}')" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 5px;
                ">Ver Formulários Disponíveis</button>
            </div>
        `;
    }

    /**
     * Mostra formulários disponíveis para o usuário
     */
    async showAvailableForms(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const availableForms = await this.getAvailableForms();

        let html = `
            <div style="padding: 20px;">
                <h2>📋 Formulários Disponíveis</h2>
                <p>Usuário: <strong>${this.currentUser.nome}</strong> (${this.currentUser.perfil})</p>
        `;

        if (availableForms.length === 0) {
            html += `
                <div style="
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                ">
                    ❌ Nenhum formulário disponível para este usuário.
                    <br><small>Entre em contato com o gerente para solicitar acesso.</small>
                </div>
            `;
        } else {
            html += `
                <div style="display: grid; gap: 15px; margin-top: 20px;">
            `;

            availableForms.forEach(form => {
                html += `
                    <div style="
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 5px;
                        padding: 15px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <strong>${form.id}</strong>
                            <br><small>Tamanho: ${form.size} bytes</small>
                        </div>
                        <button onclick="window.secureApp.loadForm('${form.id}', '${containerId}')" style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 8px 15px;
                            border-radius: 3px;
                            cursor: pointer;
                        ">Abrir</button>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Atualiza interface com informações do usuário
     */
    updateUserInterface() {
        // Adicionar barra de usuário se não existir
        let userBar = document.getElementById('user-bar');
        if (!userBar && this.currentUser) {
            userBar = document.createElement('div');
            userBar.id = 'user-bar';
            userBar.innerHTML = `
                <div style="
                    background: #343a40;
                    color: white;
                    padding: 10px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                ">
                    <div>
                        👤 <strong>${this.currentUser.nome}</strong> 
                        <span style="
                            background: #007bff;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 11px;
                            margin-left: 10px;
                        ">${this.currentUser.perfil.toUpperCase()}</span>
                    </div>
                    <div>
                        <button onclick="window.secureApp.logout()" style="
                            background: #dc3545;
                            color: white;
                            border: none;
                            padding: 5px 10px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 12px;
                        ">🚪 Sair</button>
                    </div>
                </div>
            `;
            
            // Inserir no topo da página
            document.body.insertBefore(userBar, document.body.firstChild);
        }
    }

    /**
     * Realiza logout
     */
    async logout() {
        await this.authManager.logout();
        this.redirectToLogin();
    }

    /**
     * Redireciona para página de login
     */
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    /**
     * Obtém informações do usuário atual
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Verifica se é gerente
     */
    isManager() {
        return this.currentUser && this.currentUser.perfil === 'gerente';
    }

    /**
     * Obtém status da aplicação
     */
    getStatus() {
        return {
            initialized: this.initialized,
            user: this.currentUser,
            canManageUsers: this.isManager(),
            authManager: !!this.authManager,
            formRenderer: !!this.formRenderer
        };
    }
}

// Instância global
window.secureApp = new SecureApp();

// Auto-inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.secureApp.init();
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    }
});