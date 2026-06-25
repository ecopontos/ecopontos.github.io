/**
 * AuthManager v2.0 - Suporte híbrido JSON + PostgreSQL
 * 
 * Este arquivo estende o AuthManager original para suportar:
 * 1. Modo JSON (arquivo local usuarios.json) - atual
 * 2. Modo PostgreSQL (tabela usuarios no Supabase) - futuro
 * 
 * Para ativar o modo PostgreSQL, execute o script supabase-setup-users.sql
 * e defina AUTH_MODE = 'postgresql' no início do arquivo
 */

// Configuração do modo de autenticação
const AUTH_MODE = 'json'; // Altere para 'postgresql' após executar o script SQL

class AuthManagerV2 {
    constructor() {
        this.currentUser = null;
        this.supabaseClient = null;
        this.mode = AUTH_MODE;
        this.jsonUsers = []; // Cache para modo JSON
        
        console.log(`🔐 AuthManager inicializado no modo: ${this.mode.toUpperCase()}`);
    }

    /**
     * Inicializa o AuthManager
     */
    async init(supabaseClient = null) {
        this.supabaseClient = supabaseClient;
        
        // Carregar usuário da sessão se existir
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('👤 Usuário carregado da sessão:', this.currentUser.nome);
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }

        // Pre-carregar usuários no modo JSON
        if (this.mode === 'json') {
            await this.loadJSONUsers();
        }
    }

    /**
     * Carrega usuários do arquivo JSON (modo json)
     */
    async loadJSONUsers() {
        try {
            // Preferir cache local via smartCache (offline-first)
            try {
                if (window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
                    const cached = await window.smartCache.loadDataSource('usuarios');
                    if (cached) {
                        this.jsonUsers = cached;
                        console.log(`📋 ${this.jsonUsers.length} usuários carregados do cache smartCache`);
                        return;
                    }
                }
            } catch (e) {
                console.warn('smartCache fallback failed in loadJSONUsers:', e.message);
            }

            const response = await fetch('data/usuarios.json');
            this.jsonUsers = await response.json();
            console.log(`📋 ${this.jsonUsers.length} usuários carregados do JSON`);
        } catch (error) {
            console.error('❌ Erro ao carregar usuarios.json:', error);
            this.jsonUsers = [];
        }
    }

    /**
     * Realiza login do usuário
     */
    async login(username, password) {
        if (this.mode === 'json') {
            return await this.loginJSON(username, password);
        } else if (this.mode === 'postgresql') {
            return await this.loginPostgreSQL(username, password);
        }
        
        throw new Error('Modo de autenticação não suportado');
    }

    /**
     * Login via arquivo JSON
     */
    async loginJSON(username, password) {
        const user = this.jsonUsers.find(u => 
            u.username === username && 
            u.password === password && 
            u.ativo !== false
        );

        if (user) {
            this.currentUser = { ...user };
            delete this.currentUser.password; // Remover senha da sessão
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            console.log('✅ Login JSON realizado:', user.nome);
            return { success: true, user: this.currentUser };
        }

        console.log('❌ Login JSON falhou para:', username);
        return { success: false, error: 'Usuário ou senha incorretos' };
    }

    /**
     * Login via PostgreSQL
     */
    async loginPostgreSQL(username, password) {
        if (!this.supabaseClient) {
            throw new Error('Cliente Supabase não inicializado');
        }

        try {
            const passwordHash = this.hashPassword(password);
            
            // Usar função validar_login criada no script SQL
            const { data, error } = await this.supabaseClient
                .rpc('validar_login', {
                    p_username: username,
                    p_password_hash: passwordHash.toString()
                });

            if (error) {
                console.error('❌ Erro na consulta PostgreSQL:', error);
                return { success: false, error: 'Erro interno do servidor' };
            }

            if (data && data.length > 0) {
                const user = data[0];
                this.currentUser = {
                    id: user.user_id,
                    username: username,
                    nome: user.nome,
                    perfil: user.perfil,
                    formulariosPermitidos: user.formularios_permitidos || []
                };
                
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                console.log('✅ Login PostgreSQL realizado:', user.nome);
                return { success: true, user: this.currentUser };
            }

            console.log('❌ Login PostgreSQL falhou para:', username);
            return { success: false, error: 'Usuário ou senha incorretos' };

        } catch (error) {
            console.error('❌ Erro no login PostgreSQL:', error);
            return { success: false, error: 'Erro de conexão com banco' };
        }
    }

    /**
     * Cria novo usuário (apenas gerentes)
     */
    async createUser(userData) {
        if (!this.isManager()) {
            return { success: false, error: 'Apenas gerentes podem criar usuários' };
        }

        if (this.mode === 'json') {
            return { success: false, error: 'Criação de usuários não suportada no modo JSON' };
        }

        if (this.mode === 'postgresql') {
            return await this.createUserPostgreSQL(userData);
        }

        return { success: false, error: 'Modo não suportado' };
    }

    /**
     * Cria usuário no PostgreSQL
     */
    /**
     * Cria usuário (local + sinaliza sincronização)
     */
    async createUserPostgreSQL(userData) {
        try {
            const passwordHash = this.hashPassword(userData.password);
            
            // Gerar UUID v7 (ordenável temporalmente)
            const generateUUID = () => uuidv7();

            const newUser = {
                id: generateUUID(),
                username: userData.username,
                password_hash: passwordHash.toString(),
                nome: userData.nome,
                perfil: userData.perfil,
                formularios_permitidos: userData.formulariosPermitidos || [],
                ativo: true,
                criado_em: new Date().toISOString()
            };

            // Salvar no cache local
            const localUsers = this.jsonUsers || [];
            localUsers.push(newUser);
            this.jsonUsers = localUsers;
            localStorage.setItem('ecoponto_users', JSON.stringify(localUsers));

            // Sinalizar que há dados pendentes para sincronização
            localStorage.setItem('ecoponto_users_pending_sync', 'true');

            console.log('✅ Usuário criado com sucesso:', userData.nome);
            return { success: true, data: newUser };

        } catch (error) {
            console.error('❌ Erro ao criar usuário:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    /**
     * Atualiza usuário existente
     */
    async updateUser(userId, updates) {
        if (!this.isManager()) {
            return { success: false, error: 'Apenas gerentes podem atualizar usuários' };
        }

        if (this.mode === 'postgresql') {
            return await this.updateUserPostgreSQL(userId, updates);
        }

        return { success: false, error: 'Atualização não suportada no modo JSON' };
    }

    /**
     * Atualiza usuário no cache local
     */
    async updateUserPostgreSQL(userId, updates) {
        try {
            const updateData = { ...updates };
            
            // Hash da senha se estiver sendo atualizada
            if (updateData.password) {
                updateData.password_hash = this.hashPassword(updateData.password).toString();
                delete updateData.password;
            }

            // Atualizar no cache local
            const localUsers = this.jsonUsers || [];
            const userIndex = localUsers.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                return { success: false, error: 'Usuário não encontrado' };
            }

            localUsers[userIndex] = { 
                ...localUsers[userIndex], 
                ...updateData,
                atualizado_em: new Date().toISOString()
            };
            this.jsonUsers = localUsers;
            localStorage.setItem('ecoponto_users', JSON.stringify(localUsers));

            // Sinalizar que há dados pendentes para sincronização
            localStorage.setItem('ecoponto_users_pending_sync', 'true');

            console.log('✅ Usuário atualizado com sucesso');
            return { success: true, data: localUsers[userIndex] };

        } catch (error) {
            console.error('❌ Erro ao atualizar usuário:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    /**
     * Lista usuários (apenas gerentes)
     */
    async listUsers() {
        if (!this.isManager()) {
            return { success: false, error: 'Apenas gerentes podem listar usuários' };
        }

        if (this.mode === 'json') {
            const users = this.jsonUsers.map(u => {
                const { password, ...userWithoutPassword } = u;
                return userWithoutPassword;
            });
            return { success: true, users };
        }

        if (this.mode === 'postgresql') {
            return await this.listUsersPostgreSQL();
        }

        return { success: false, error: 'Modo não suportado' };
    }

    /**
     * Lista usuários do cache local
     */
    async listUsersPostgreSQL() {
        try {
            // Usar cache local em vez de view direta
            const users = (this.jsonUsers || [])
                .filter(u => u.ativo !== false)
                .map(u => {
                    const { password_hash, ...userWithoutPassword } = u;
                    return userWithoutPassword;
                })
                .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

            return { success: true, users };

        } catch (error) {
            console.error('❌ Erro ao listar usuários:', error);
            return { success: false, error: 'Erro interno' };
        }
    }

    /**
     * Verifica se usuário está logado
     */
    isLoggedIn() {
        return this.currentUser !== null;
    }

    /**
     * Obtém usuário atual
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Verifica permissão para formulário
     * REFORÇADO: Verificação mais rigorosa das permissões do usuário
     */
    canAccessForm(formId) {
        if (!this.currentUser) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: usuário não autenticado`);
            return false;
        }

        // Gerente tem acesso a tudo
        if (this.currentUser.perfil === 'gerente') {
            console.log(`✅ Acesso permitido ao formulário ${formId}: usuário é gerente`);
            return true;
        }

        // Verificar se o usuário tem a lista de formulários permitidos
        if (!this.currentUser.formulariosPermitidos || !Array.isArray(this.currentUser.formulariosPermitidos)) {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: usuário não tem lista de formulários permitidos`);
            return false;
        }

        // Verificar lista de formulários permitidos
        const hasAccess = this.currentUser.formulariosPermitidos.includes(formId);
        
        if (hasAccess) {
            console.log(`✅ Acesso permitido ao formulário ${formId}: formulário está na lista de permissões`);
        } else {
            console.warn(`🚫 Acesso negado ao formulário ${formId}: formulário não está na lista de permissões do usuário`);
            console.log(`📋 Formulários permitidos do usuário:`, this.currentUser.formulariosPermitidos);
        }

        return hasAccess;
    }

    /**
     * Verifica se é gerente
     */
    isManager() {
        return this.currentUser && this.currentUser.perfil === 'gerente';
    }

    /**
     * Faz logout
     */
    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        console.log('👋 Logout realizado');
    }

    /**
     * Hash simples para senha (substituir por bcrypt em produção)
     */
    hashPassword(password) {
        // Implementação simples - em produção usar bcrypt
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Migra usuários do JSON para PostgreSQL
     */
    async migrateToPostgreSQL() {
        if (!this.isManager()) {
            return { success: false, error: 'Apenas gerentes podem realizar migração' };
        }

        if (this.mode !== 'postgresql') {
            return { success: false, error: 'Altere AUTH_MODE para "postgresql" primeiro' };
        }

        try {
            await this.loadJSONUsers();
            const results = [];

            for (const user of this.jsonUsers) {
                const result = await this.createUserPostgreSQL({
                    username: user.username,
                    password: user.password,
                    nome: user.nome,
                    perfil: user.perfil,
                    formulariosPermitidos: user.formulariosPermitidos || []
                });

                results.push({
                    username: user.username,
                    success: result.success,
                    error: result.error
                });
            }

            const successful = results.filter(r => r.success).length;
            console.log(`✅ Migração concluída: ${successful}/${results.length} usuários`);
            
            return { success: true, results };

        } catch (error) {
            console.error('❌ Erro na migração:', error);
            return { success: false, error: 'Erro na migração' };
        }
    }

    /**
     * Obtém estatísticas do sistema
     */
    getStats() {
        return {
            mode: this.mode,
            isLoggedIn: this.isLoggedIn(),
            currentUser: this.currentUser?.nome || 'Nenhum',
            userProfile: this.currentUser?.perfil || 'N/A',
            allowedForms: this.currentUser?.formulariosPermitidos?.length || 0
        };
    }
}

// Manter compatibilidade com o AuthManager original
if (typeof AuthManager === 'undefined') {
    window.AuthManager = AuthManagerV2;
}

// Expor versão 2 explicitamente
window.AuthManagerV2 = AuthManagerV2;