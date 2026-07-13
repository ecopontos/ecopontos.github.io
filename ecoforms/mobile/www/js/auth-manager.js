/**
 * Authentication Manager - Sistema de login com Supabase + JSON fallback
 * Suporta perfis de usuário e controle de acesso a formulários
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.supabaseClient = null;
        this.localUsersFile = 'data/usuarios.json';
        this.sessionKey = 'ecoforms_auth_session';
        this.useSupabase = true; // Flag para alternar entre Supabase e JSON local
        this.bcrypt = null;
        this.bcryptSaltRounds = 12;

        // Integração com SystemConfig para configurações de autenticação
        this.systemConfig = null;
        if (typeof window !== 'undefined' && window.systemConfig) {
            this.systemConfig = window.systemConfig;
        }
    }

    /**
     * Inicializa o sistema de autenticação
     */
    async init(supabaseClient = null) {
        console.log('🚀 Inicializando AuthManager...');
        this.supabaseClient = supabaseClient;

        // Se não foi passado um cliente, tentar criar automaticamente
        if (!this.supabaseClient) {
            console.log('⚠️ Cliente Supabase não fornecido, tentando criar automaticamente...');
            await this.initializeSupabaseClient();
        }

        if (this.supabaseClient) {
            console.log('✅ Cliente Supabase disponível para autenticação');
        } else {
            console.warn('⚠️ Cliente Supabase NÃO disponível - usando apenas modo offline');
        }

        // Iniciar sincronização periódica se cliente Supabase disponível e online
        if (this.supabaseClient && typeof window !== 'undefined' && navigator.onLine) {
            console.log('🚀 Executando sincronização inicial de usuários...');
            // Aguardar a primeira sincronização para garantir que o login funcione
            await this.syncUsersToLocalStorage().catch(e => console.warn('Erro na sync inicial:', e));

            this.startPeriodicSync();
        }

        // Configurar listener para mudanças de conectividade
        if (this.supabaseClient) {
            this.setupConnectivityListener();
        }

        // Tentar carregar sessão existente
        await this.loadSession();

        // Fase 6: Iniciar heartbeat de sessão (renovação automática por atividade)
        this.startSessionHeartbeat();

        console.log('✅ AuthManager inicializado');
    }

    /**
     * Fase 6: Session Heartbeat — renova a sessão automaticamente quando o usuário
     * interage com o app (click, keypress, scroll, touch). Também verifica periodicamente
     * se a sessão ainda é válida.
     */
    startSessionHeartbeat() {
        if (typeof window === 'undefined') return;

        // Remover listeners anteriores se existirem
        this.stopSessionHeartbeat();

        this._heartbeatHandler = () => {
            // Renovar sessão silenciosamente a cada interação (throttle: 1 minuto)
            const now = Date.now();
            if (!this._lastHeartbeat || (now - this._lastHeartbeat) > 60000) {
                this._lastHeartbeat = now;
                this._refreshSessionExpiry().catch(() => {});
            }
        };

        const events = ['click', 'keypress', 'scroll', 'touchstart', 'mousemove'];
        events.forEach(evt => {
            window.addEventListener(evt, this._heartbeatHandler, { passive: true });
        });

        // Verificação periódica a cada 5 minutos (mesmo sem interação)
        this._heartbeatInterval = setInterval(() => {
            this._refreshSessionExpiry().catch(() => {});
        }, 5 * 60 * 1000);

        console.log('💓 Session heartbeat iniciado');
    }

    stopSessionHeartbeat() {
        if (typeof window === 'undefined') return;

        if (this._heartbeatHandler) {
            const events = ['click', 'keypress', 'scroll', 'touchstart', 'mousemove'];
            events.forEach(evt => {
                window.removeEventListener(evt, this._heartbeatHandler);
            });
            this._heartbeatHandler = null;
        }

        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    async _refreshSessionExpiry() {
        if (!this.currentUser || typeof window === 'undefined') return;

        try {
            const sessionData = localStorage.getItem(this.sessionKey);
            if (!sessionData) return;

            const session = JSON.parse(sessionData);
            const deviceConfig = this.getDeviceConfig();
            const isIndefiniteSession = deviceConfig?.sessionTimeoutHours >= 999999;

            if (isIndefiniteSession) return;

            const refreshTimeoutMs = this.systemConfig ?
                this.systemConfig.getSessionTimeoutMs() :
                (8 * 60 * 60 * 1000);

            session.expiresAt = new Date(Date.now() + refreshTimeoutMs).toISOString();
            localStorage.setItem(this.sessionKey, JSON.stringify(session));
        } catch (e) {
            // Silencioso — não quebrar a experiência do usuário
        }
    }

    /**
     * Configura listener para mudanças de conectividade
     */
    setupConnectivityListener() {
        if (typeof window === 'undefined') return;

        // Listener para quando voltar online
        window.addEventListener('online', async () => {
            console.log('🌐 Conectividade restaurada - iniciando sincronização...');

            if (this.supabaseClient) {
                // Sincronizar usuários imediatamente
                await this.syncUsersToLocalStorage();

                // Reiniciar sincronização periódica
                this.startPeriodicSync();
            }
        });

        // Listener para quando ficar offline
        window.addEventListener('offline', () => {
            console.log('📴 Conectividade perdida - modo offline ativado');
            this.stopPeriodicSync();
        });

        console.log('📡 Listeners de conectividade configurados');
    }

    /**
     * Inicializa cliente Supabase automaticamente
     */
    async initializeSupabaseClient() {
        try {
            // Inicializar cliente Supabase de forma robusta (meta tags -> supabaseIntegration -> singleton)
            const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
            const metaKey = document.querySelector('meta[name="supabase-key"]')?.content || '';
            const cfg = (window.supabaseConfig) || (window.supabaseIntegration && window.supabaseIntegration.config) || {};
            const url = metaUrl || cfg.url || '';
            const key = metaKey || cfg.key || '';

            if (!url || !key) {
                console.warn('⚠️ Configuração Supabase não encontrada (URL ou KEY ausentes)');
                return;
            }

            try {
                if (typeof window.getSupabaseClientSync === 'function') {
                    this.supabaseClient = window.getSupabaseClientSync(url, key);
                }
                if (!this.supabaseClient && window.globalSupabaseClient) {
                    this.supabaseClient = window.globalSupabaseClient;
                }
                if (!this.supabaseClient && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                    this.supabaseClient = supabase.createClient(url, key);
                }

                if (this.supabaseClient) {
                    console.log('✅ Cliente Supabase criado automaticamente');
                } else {
                    console.warn('⚠️ Não foi possível criar cliente Supabase');
                }
            } catch (e) {
                console.warn('Erro ao criar cliente Supabase:', e);
            }

        } catch (error) {
            console.error('Erro na inicialização do cliente Supabase:', error);
        }
    }

    /**
     * Realiza login do usuário com sincronização automática
     */
    async login(username, password) {
        try {
            let user = null;
            let loginSource = 'unknown';

            console.log(`🔐 Tentando login: ${username}`);

            if (this.useSupabase && this.supabaseClient) {
                // 1. Tentar sincronizar usuários do Supabase Storage antes do login
                try {
                    const synced = await this.syncUsersToLocalStorage();
                    if (synced) {
                        console.log('✅ Usuários sincronizados com sucesso do Storage');
                    } else {
                        console.warn('⚠️ Sincronização falhou ou sem dados novos, usando cache existente');
                    }
                } catch (e) {
                    console.warn('⚠️ Erro ao sincronizar antes do login:', e);
                }

                // 2. Autenticar contra a base local (que acabou de ser atualizada)
                user = await this.loginLocal(username, password);

                if (user) {
                    loginSource = 'storage_synced';
                    console.log('✅ Login bem-sucedido (base sincronizada)');
                } else {
                    console.warn('⚠️ Login falhou mesmo após sync.');
                }
            } else {
                // Modo offline / sem supabase
                console.log('🔌 Supabase não configurado/offline. Tentando login com dados em cache...');
                user = await this.loginLocal(username, password);
                if (user) {
                    loginSource = 'local_cache_offline';
                    console.log('✅ Login offline bem-sucedido');
                }
            }

            if (user) {
                this.currentUser = user;
                this.currentUser.loginSource = loginSource; // Rastrear fonte do login
                // Fase 6: Nunca passar password para saveSession
                await this.saveSession(user);
                console.log(`✅ Login realizado: ${user.nome} (${user.perfil}) - Fonte: ${loginSource}`);

                // Atualizar DataService com o userId do usuário logado
                this.updateDataServiceUserId();

                // Iniciar sincronização periódica se online
                if (this.supabaseClient && navigator.onLine) {
                    this.startPeriodicSync();
                }

                // Iniciar SyncAdapter (pipeline de eventos unificado)
                this._startSyncAdapter(password).catch(e =>
                    console.warn('[Auth] SyncAdapter não pôde iniciar:', e)
                );

                return { success: true, user: user, source: loginSource };
            } else {
                console.log(`❌ Login falhou: credenciais inválidas ou usuário não encontrado`);
                return { success: false, error: 'Credenciais inválidas' };
            }

        } catch (error) {
            console.error('❌ Erro no login:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Login via arquivo JSON local com prioridade para dados sincronizados
     */
    // loginSupabase() removido: usuarios não existe mais no Supabase remoto.
    // Autenticação usa exclusivamente shared/users.json do Storage (sincronizado pelo Desktop).
    async loginLocal(username, password) {
        try {
            // PRIORIDADE 1: Tentar carregar usuários sincronizados do Supabase (modo offline)
            let users = await this.loadSyncedUsers();
            let dataSource = 'synced';

            // PRIORIDADE 2: Se não há usuários sincronizados, usar dados locais padrão
            if (!users || users.length === 0) {
                users = await this.loadUsersLocal();
                dataSource = 'json';
                console.log('📄 Usando dados do arquivo JSON local (usuarios.json)');
            } else {
                console.log('💾 Usando dados sincronizados do Supabase (modo offline)');
            }

            if (!users || users.length === 0) {
                console.error('❌ Nenhum usuário encontrado em nenhuma fonte de dados');
                return null;
            }

            const user = users.find(u => {
                const uname = u.username || u.login;
                return uname === username && u.ativo !== false;
            });

            if (!user) {
                console.log(`❌ Usuário '${username}' não encontrado ou inativo (${users.length} usuários disponíveis)`);
                console.log('📋 Usernames disponíveis:', users.map(u => u.username || u.login).join(', '));
                return null;
            }

            // Verificar senha (bcrypt ou legacy) — normalizar nome do campo
            const storedHash = user.password_hash || user.password || user.senha;
            if (!storedHash) {
                console.log(`❌ Sem hash de senha para usuário '${username}'`);
                return null;
            }
            if (!this.verifyPassword(password, storedHash)) {
                console.log(`❌ Senha incorreta para usuário '${username}'`);
                return null;
            }

            // Rehash automático: upgrade SHA-256 legacy → bcrypt
            if (storedHash && !this.isBcryptHash(storedHash)) {
                try {
                    const newHash = this.hashPassword(password);
                    this._updateUserHashInCache(user.id, username, newHash);
                    console.log(`[Auth] Senha migrada de legacy para bcrypt: ${username}`);
                } catch (e) {
                    console.warn('[Auth] Falha ao migrar hash (non-fatal):', e);
                }
            }

            console.log(`✅ Autenticação local bem-sucedida - Fonte: ${dataSource}`);

            return {
                id: user.id,
                username: user.username,
                nome: user.nome,
                perfil: user.perfil,
                setores: user.setores || [],
                formulariosPermitidos: user.formulariosPermitidos || [],
                loginAt: new Date().toISOString(),
                dataSource: dataSource
            };

        } catch (error) {
            console.error('Erro no login local:', error);
            return null;
        }
    }

    /**
     * Carrega usuários do arquivo JSON local
     */
    async loadUsersLocal() {
        try {
            // Se estamos no browser, usar dados embedded
            if (typeof window !== 'undefined') {
                // Preferir cache local via smartCache quando disponível (offline-first)
                try {
                    if (window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
                        const cached = await window.smartCache.loadDataSource('usuarios');
                        if (cached) return cached;
                    }
                } catch (e) {
                    console.warn('smartCache fallback failed in loadUsersLocal:', e.message);
                }

                const response = await fetch('data/usuarios.json');
                return await response.json();
            }

            // Se estamos no Node.js (Electron), ler arquivo
            const fs = require('fs').promises;
            const data = await fs.readFile(this.localUsersFile, 'utf8');
            return JSON.parse(data);

        } catch (error) {
            console.error('Erro ao carregar usuários locais:', error);
            return [];
        }
    }

    /**
     * Salva sessão no localStorage
     */
    async saveSession(user) {
        // Obter tempo de expiração da configuração do sistema (padrão: 8 horas)
        let timeoutMs = this.systemConfig ?
            this.systemConfig.getSessionTimeoutMs() :
            (8 * 60 * 60 * 1000);

        // Verificar se é tempo indeterminado (999999 horas ou mais)
        const deviceConfig = this.getDeviceConfig();
        const sessionTimeoutHours = deviceConfig?.sessionTimeoutHours || 8;
        if (sessionTimeoutHours >= 999999) {
            // Usar um valor muito grande (100 anos em milissegundos)
            timeoutMs = 100 * 365 * 24 * 60 * 60 * 1000;
            console.log('♾️ Sessão configurada com tempo indeterminado (nunca expira)');
        }

        const session = {
            user: user,
            loginAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + timeoutMs).toISOString()
        };

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(this.sessionKey, JSON.stringify(session));

                const timeoutHours = sessionTimeoutHours >= 999999 ? '∞' : (this.systemConfig ? this.systemConfig.getSessionTimeoutHours() : 8);
                console.log(`✅ Sessão salva no localStorage para: ${user.nome} (expira em ${timeoutHours} horas)`);

                // Verificar se a sessão foi realmente salva
                const savedSession = localStorage.getItem(this.sessionKey);
                if (!savedSession) {
                    console.error('❌ Falha ao salvar sessão: localStorage não contém a chave após salvamento');
                    throw new Error('Falha ao salvar sessão no localStorage');
                }

                // Fase 6: REMOVIDO — nunca salvar credenciais em plaintext.
                // O auto-login agora usa apenas a sessão existente (sessionKey).
                // Credenciais antigas são limpas em loadSession().
            } catch (error) {
                console.error('❌ Erro ao salvar sessão no localStorage:', error);
                throw error;
            }
        }
    }

    /**
     * Carrega sessão do localStorage
     */
    async loadSession() {
        try {
            if (typeof window === 'undefined') return false;

            // Fase 6: Limpar credenciais plaintext antigas (segurança)
            const savedCredentials = localStorage.getItem('ecoforms_auto_login_credentials');
            if (savedCredentials) {
                console.log('🧹 Removendo credenciais antigas salvas em plaintext (Fase 6)');
                localStorage.removeItem('ecoforms_auto_login_credentials');
            }

            const sessionData = localStorage.getItem(this.sessionKey);
            if (!sessionData) return false;

            const session = JSON.parse(sessionData);

            // Verificar se sessão expirou (pular verificação se tempo indeterminado)
            const deviceConfig = this.getDeviceConfig();
            const isIndefiniteSession = deviceConfig?.sessionTimeoutHours >= 999999;

            const expiryDate = new Date(session.expiresAt);
            if (!isIndefiniteSession && session.expiresAt && !isNaN(expiryDate.getTime()) && new Date() > expiryDate) {
                // Sessão expirada
                console.log('⏰ Sessão expirada, efetuando logout');
                await this.logout();
                return false;
            }

            // Fase 6: Renovar sessão (session refresh / heartbeat)
            // Sempre que a sessão é carregada com sucesso, renova o expiresAt
            // para manter o usuário logado enquanto ele estiver ativo
            if (!isIndefiniteSession && session.expiresAt) {
                const refreshTimeoutMs = this.systemConfig ?
                    this.systemConfig.getSessionTimeoutMs() :
                    (8 * 60 * 60 * 1000);
                session.expiresAt = new Date(Date.now() + refreshTimeoutMs).toISOString();
                localStorage.setItem(this.sessionKey, JSON.stringify(session));
                console.log('🔄 Sessão renovada (session refresh)');
            }

            this.currentUser = session.user;
            console.log(`✅ Sessão restaurada: ${this.currentUser.nome}`);

            // Atualizar DataService se disponível
            this.updateDataServiceUserId();

            return true;

        } catch (error) {
            console.error('Erro ao carregar sessão:', error);
            return false;
        }
    }

    normalizeFormPermissions(forms) {
        if (Array.isArray(forms)) {
            return forms.map(form => String(form)).filter(Boolean);
        }

        if (typeof forms === 'string' && forms.trim()) {
            try {
                const parsed = JSON.parse(forms);
                if (Array.isArray(parsed)) {
                    return parsed.map(form => String(form)).filter(Boolean);
                }
            } catch (error) {
                return forms
                    .replace(/[\[\]"]/g, '')
                    .split(',')
                    .map(form => form.trim())
                    .filter(Boolean);
            }
        }

        return [];
    }

    async persistCurrentSession(user = this.currentUser) {
        if (typeof window === 'undefined' || !user) return false;

        let existingSession = null;
        try {
            const rawSession = localStorage.getItem(this.sessionKey);
            existingSession = rawSession ? JSON.parse(rawSession) : null;
        } catch (error) {
            console.warn('⚠️ Não foi possível ler a sessão atual antes de persistir atualização:', error);
        }

        const loginAt = existingSession?.loginAt || user.loginAt || new Date().toISOString();
        const expiresAt = existingSession?.expiresAt || new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();

        localStorage.setItem(this.sessionKey, JSON.stringify({
            user,
            loginAt,
            expiresAt
        }));

        return true;
    }

    async refreshCurrentUserPermissions(options = {}) {
        const { forceSync = false } = options;

        if (!this.currentUser) {
            return { refreshed: false, reason: 'no-current-user' };
        }

        if (forceSync && this.supabaseClient && typeof navigator !== 'undefined' && navigator.onLine) {
            await this.syncUsersToLocalStorage();
        }

        const syncedUsers = await this.loadSyncedUsers();
        if (!syncedUsers || syncedUsers.length === 0) {
            return { refreshed: false, reason: 'no-synced-users', user: this.currentUser };
        }

        const syncedUser = syncedUsers.find(user => user.id === this.currentUser.id || user.username === this.currentUser.username);
        if (!syncedUser) {
            return { refreshed: false, reason: 'user-not-found', user: this.currentUser };
        }

        const nextForms = this.normalizeFormPermissions(syncedUser.formulariosPermitidos || syncedUser.formularios_permitidos);
        const nextSectors = Array.isArray(syncedUser.setores) ? syncedUser.setores : [];
        const currentForms = this.normalizeFormPermissions(this.currentUser.formulariosPermitidos || this.currentUser.formularios_permitidos);
        const currentSectors = Array.isArray(this.currentUser.setores) ? this.currentUser.setores : [];

        const formsChanged = JSON.stringify([...currentForms].sort()) !== JSON.stringify([...nextForms].sort());
        const sectorsChanged = JSON.stringify([...currentSectors].sort()) !== JSON.stringify([...nextSectors].sort());
        const profileChanged = this.currentUser.perfil !== syncedUser.perfil;
        const nameChanged = this.currentUser.nome !== syncedUser.nome;

        const mergedUser = {
            ...this.currentUser,
            ...syncedUser,
            nome: syncedUser.nome || this.currentUser.nome,
            perfil: syncedUser.perfil || this.currentUser.perfil,
            setores: nextSectors,
            formulariosPermitidos: nextForms,
            syncedAt: new Date().toISOString()
        };

        this.currentUser = mergedUser;
        await this.persistCurrentSession(mergedUser);
        this.updateDataServiceUserId();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:session-refreshed', {
                detail: {
                    user: mergedUser,
                    changed: formsChanged || sectorsChanged || profileChanged || nameChanged,
                }
            }));
        }

        if (formsChanged || sectorsChanged || profileChanged || nameChanged) {
            console.log('🔄 Sessão do usuário atualizada a partir do cache sincronizado', {
                userId: mergedUser.id,
                formsChanged,
                sectorsChanged,
                profileChanged,
                nameChanged,
            });
            return { refreshed: true, reason: 'session-updated', user: mergedUser };
        }

        return { refreshed: false, reason: 'already-current', user: mergedUser };
    }

    /**
     * Realiza logout com limpeza de sincronização
     */
    async logout() {
        // Parar SyncAdapter
        if (window.syncAdapter) {
            await window.syncAdapter.stop().catch(e =>
                console.warn('[Auth] Erro ao parar SyncAdapter:', e)
            );
            window.syncAdapter = null;
        }

        // Parar sincronização periódica e heartbeat de sessão
        this.stopPeriodicSync();
        this.stopSessionHeartbeat();

        this.currentUser = null;

        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.sessionKey);
            // Fase 6: Garantir que nenhuma credencial antiga permaneça
            localStorage.removeItem('ecoforms_auto_login_credentials');
        }

        console.log('✅ Logout realizado');
    }

    async _startSyncAdapter(password) {
        // ADR-052 Fase 2: garantir schema SQLite antes do sync
        try {
            const { bootstrapMobileSchema } = await import('./adapters/MobileSchemaBootstrap.js');
            await bootstrapMobileSchema();
        } catch (err) {
            console.warn('[MobileSchema] Falha no bootstrap (não-fatal):', err);
        }

        // ADR-052 Fase 2: migração one-shot IndexedDB → SQLite
        try {
            const { isMigrationNeeded, runMigration } = await import('./adapters/IndexedDbMigration.js');
            if (isMigrationNeeded()) await runMigration();
        } catch (err) {
            console.warn('[Migration] Falha na migração (não-fatal):', err);
        }

        try {
            const { SyncAdapter } = await import('./sync/SyncAdapter.js');
            const adapter = new SyncAdapter();
            await adapter.start(password, this.currentUser);
            adapter.startAutoSync(60000);
            window.syncAdapter = adapter;
            console.log('[SyncAdapter] Pipeline de eventos iniciado');
        } catch (err) {
            console.warn('[SyncAdapter] Falha ao iniciar:', err);
        }
    }

    /**
     * Verifica se usuário está logado
     */
    isLoggedIn() {
        return !!this.currentUser;
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

        // Admin e Gerente têm acesso a tudo
        const fullAccessRoles = ['admin', 'gerente'];
        if (fullAccessRoles.includes(this.currentUser.perfil)) {
            console.log(`✅ Acesso permitido ao formulário ${formId}: usuário é ${this.currentUser.perfil} (acesso total)`);
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
     * Verifica se é admin/administrador
     */
    isAdmin() {
        return this.currentUser && this.currentUser.perfil === 'admin';
    }

    /**
     * Verifica se é operador
     */
    isOperator() {
        return this.currentUser && this.currentUser.perfil === 'operador';
    }

    /**
     * Mapa de hierarquia de perfis (níveis)
     * Menor = mais permissivo
     * Fonte: window.ECOFORMS_RBAC.ROLE_HIERARCHY (gerado de packages/core), com
     * fallback inline idêntico caso o script não tenha carregado.
     */
    static ROLE_HIERARCHY = (typeof window !== 'undefined' && window.ECOFORMS_RBAC?.ROLE_HIERARCHY) || {
        'admin': 0,
        'gerente': 1,
        'coordenador': 2,
        'encarregado': 3,
        'operador': 4,
        'campo': 4
    };

    /**
     * Retorna os perfis que o usuário pode visualizar baseado na hierarquia
     * @returns {string[]} - Array de perfis acessíveis (incluindo o próprio)
     */
    getSubordinatePerfis() {
        if (!this.currentUser?.perfil) return [];

        const hierarchy = AuthManager.ROLE_HIERARCHY;
        const userLevel = hierarchy[this.currentUser.perfil];

        if (userLevel === undefined) {
            return [this.currentUser.perfil];
        }

        // Retorna todos os perfis com nível >= ao do usuário (subordinados)
        return Object.entries(hierarchy)
            .filter(([_, level]) => level >= userLevel)
            .map(([perfil, _]) => perfil);
    }

    /**
     * Verifica se pode acessar dados de outro usuário baseado na hierarquia
     * @param {string} targetUserId - ID do usuário alvo
     * @param {string} targetPerfil - Perfil do usuário alvo
     * @returns {boolean} - true se tem acesso
     */
    canAccessUserData(targetUserId, targetPerfil) {
        if (!this.currentUser) return false;

        // Sempre pode acessar próprios dados
        if (this.currentUser.id === targetUserId) return true;

        // Verificar hierarquia
        const accessiblePerfis = this.getSubordinatePerfis();
        return accessiblePerfis.includes(targetPerfil);
    }

    /**
     * Gera cláusula SQL para filtrar registros por acesso.
     * Retorna a cláusula e os parâmetros separadamente — o chamador deve
     * usar bind parameters, nunca interpolar os valores retornados direto na query.
     * @param {string} aliasTabela - Alias da tabela no SQL (ex: 's' para suite)
     * @param {string} aliasUsuario - Alias da tabela de usuários (ex: 'u')
     * @returns {{ clause: string, params: string[] }}
     */
    buildAccessFilterSQL(aliasTabela = 's', aliasUsuario = 'u') {
        if (!this.currentUser?.id || !this.currentUser?.perfil) {
            return { clause: '1=0', params: [] };
        }

        if (this.isAdmin()) {
            return { clause: '1=1', params: [] };
        }

        const accessiblePerfis = this.getSubordinatePerfis();
        const placeholders = accessiblePerfis.map(() => '?').join(', ');

        return {
            clause: `(${aliasTabela}.user_id = ? OR ${aliasUsuario}.perfil IN (${placeholders}))`,
            params: [this.currentUser.id, ...accessiblePerfis],
        };
    }

    /**
     * Mapa de permissões por perfil — lido de window.ECOFORMS_RBAC.PERMISSION_MATRIX
     * (gerado de packages/core), com fallback vazio caso o script não tenha carregado.
     */
    getPermissionRoles(permission) {
        const matrix = (typeof window !== 'undefined' && window.ECOFORMS_RBAC?.PERMISSION_MATRIX) || {};
        return matrix[permission]?.roles || [];
    }

    /**
     * Verifica se usuário tem permissão específica
     * @param {string} permission - Nome da permissão (ex: 'users.create')
     * @returns {boolean} - true se tem permissão
     */
    hasPermission(permission) {
        if (!this.currentUser) {
            return false;
        }

        const allowedRoles = this.getPermissionRoles(permission);
        return allowedRoles.includes(this.currentUser.perfil);
    }

    /**
     * Verifica se pode editar usuário específico
     * @param {object} targetUser - Usuário alvo da edição
     * @returns {boolean}
     */
    canEditUser(targetUser) {
        if (!this.currentUser) return false;

        // Admin pode editar todos
        if (this.isAdmin()) return true;

        // Gerente pode editar operadores e encarregados
        if (this.isManager()) {
            return targetUser.perfil === 'operador' || targetUser.perfil === 'encarregado';
        }

        // Operador não pode editar ninguém (exceto próprio perfil)
        return targetUser.id === this.currentUser.id;
    }

    /**
     * Verifica se pode editar dado específico
     * @param {object} dataRecord - Registro de dados
     * @returns {boolean}
     */
    canEditData(dataRecord) {
        if (!this.currentUser) return false;

        // Admin e gerente podem editar sem limite de tempo
        if (this.isAdmin() || this.isManager()) return true;

        const createdAt = new Date(dataRecord.criado_em || dataRecord.created_at || dataRecord.created);
        const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

        // Operador pode editar próprios dados dentro do prazo
        if (this.isOperator() && dataRecord.user_id === this.currentUser.id) {
            const maxHours = this.currentUser.max_edit_hours || 24;
            return hoursAgo <= maxHours;
        }

        return false;
    }

    /**
     * Verifica se usuário pode reatribuir uma tarefa para outro usuário
     * Regras:
     * - Admin: sempre
     * - Gerente: ampla (pode reatribuir para qualquer perfil aplicável)
     * - Encarregado: pode reatribuir apenas para operadores, preferencialmente do mesmo galpão
     */
    canReassignTask(targetTask, newAssignee) {
        if (!this.currentUser) return false;

        // Admin pode sempre
        if (this.isAdmin()) return true;

        // Gerente pode reatribuir amplamente
        if (this.isManager()) return true;

        // Encarregado: pode reatribuir apenas para operadores e preferencialmente do mesmo galpão
        if (this.currentUser.perfil === 'encarregado') {
            if (!newAssignee || newAssignee.perfil !== 'operador') return false;

            // Se houver galpão definido em ambos, exigir igualdade
            if (this.currentUser.galpao && newAssignee.galpao) {
                return this.currentUser.galpao === newAssignee.galpao;
            }

            return true;
        }

        return false;
    }

    /**
     * Verifica se pode criar usuário com perfil específico
     * @param {string} perfil - Perfil do novo usuário
     * @returns {boolean}
     */
    canCreateUserWithRole(perfil) {
        if (!this.currentUser) return false;

        // Admin pode criar qualquer perfil
        if (this.isAdmin()) return true;

        // Gerente pode criar operadores e encarregados
        if (this.isManager()) {
            return perfil === 'operador' || perfil === 'encarregado';
        }

        // Operador não pode criar usuários
        return false;
    }

    /**
     * Obtém configuração do dispositivo
     */
    getDeviceConfig() {
        try {
            const configStr = localStorage.getItem('ecoforms_device_config');
            if (configStr) {
                return JSON.parse(configStr);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro ao ler configuração do dispositivo:', error);
            return null;
        }
    }

    /**
     * Obtém instância do bcrypt (browser ou Node) quando disponível
     */
    getBcrypt() {
        if (this.bcrypt) {
            return this.bcrypt;
        }

        if (typeof window !== 'undefined' && window.bcrypt) {
            this.bcrypt = window.bcrypt;
        } else {
            try {
                // eslint-disable-next-line global-require
                this.bcrypt = require('bcryptjs');
            } catch (err) {
                this.bcrypt = null;
            }
        }

        if (!this.bcrypt) {
            console.warn('⚠️ Biblioteca bcrypt não disponível. Utilizando hash legacy.');
        }

        return this.bcrypt;
    }

    /**
     * Hash legado simples (compatibilidade com versões antigas)
     */
    hashPasswordLegacy(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash; // Converte para inteiro 32 bits
        }
        return hash.toString();
    }

    /**
     * Hash seguro com bcrypt (fallback para legacy se indisponível)
     */
    hashPassword(password) {
        if (typeof password !== 'string') {
            return '';
        }

        if (this.isBcryptHash(password)) {
            // Já está no formato esperado
            return password;
        }

        const bcrypt = this.getBcrypt();
        if (bcrypt) {
            try {
                return bcrypt.hashSync(password, this.bcryptSaltRounds);
            } catch (err) {
                console.error('Erro ao gerar hash com bcrypt:', err);
            }
        }

        return this.hashPasswordLegacy(password);
    }

    /**
     * Detecta se uma string está no formato de hash bcrypt
     */
    isBcryptHash(value) {
        return typeof value === 'string' && value.startsWith('$2');
    }

    /**
     * Verifica senha informada contra hash armazenado (bcrypt ou legacy)
     */
    verifyPassword(password, storedHash) {
        if (!storedHash) {
            return false;
        }

        if (this.isBcryptHash(storedHash)) {
            const bcrypt = this.getBcrypt();
            if (!bcrypt) {
                console.error('Hash bcrypt encontrado, mas biblioteca não disponível.');
                return false;
            }

            try {
                return bcrypt.compareSync(password, storedHash);
            } catch (err) {
                console.error('Erro ao comparar senha com bcrypt:', err);
                return false;
            }
        }

        const legacyHash = this.hashPasswordLegacy(password);
        return storedHash === legacyHash || storedHash === password;
    }

    /**
     * Cria novo usuário (apenas gerentes)
     */
    async createUser(userData) {
        if (!this.isManager()) {
            throw new Error('Apenas gerentes podem criar usuários');
        }

        try {
            if (this.useSupabase && this.supabaseClient) {
                return await this.createUserSupabase(userData);
            } else {
                return await this.createUserLocal(userData);
            }
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            throw error;
        }
    }

    /**
     * Cria usuário (local + sincroniza via Storage)
     */
    async createUserSupabase(userData) {
        const plainPassword = userData.password;
        const existingHash = userData.password_hash;
        const hashedPassword = plainPassword
            ? this.hashPassword(plainPassword)
            : existingHash || '';

        if (!hashedPassword) {
            throw new Error('Senha não informada para criação de usuário');
        }

        // Gerar UUID v7 para o id (ordenável temporalmente, compatível com PostgreSQL)
        const generateUUID = () => uuidv7();

        const newUser = {
            id: generateUUID(),
            username: userData.username,
            password_hash: hashedPassword,
            nome: userData.nome,
            perfil: userData.perfil,
            formularios_permitidos: userData.formularios_permitidos || [],
            ativo: true,
            created_at: new Date().toISOString()
        };

        // Salvar no cache local
        const localUsers = await this.loadUsersLocal();
        localUsers.push(newUser);
        localStorage.setItem('ecoponto_users', JSON.stringify(localUsers));

        // Sinalizar que há dados pendentes para sincronização
        localStorage.setItem('ecoponto_users_pending_sync', 'true');

        return newUser;
    }

    /**
     * Lista todos os usuários (apenas gerentes)
     */
    async listUsers() {
        if (!this.isManager()) {
            throw new Error('Apenas gerentes podem listar usuários');
        }

        try {
            // Usar cache local (sincronizado via Storage)
            const users = await this.loadUsersLocal();
            return users.map(u => ({
                id: u.id,
                username: u.username,
                nome: u.nome,
                perfil: u.perfil,
                formulariosPermitidos: u.formularios_permitidos || u.formulariosPermitidos || [],
                ativo: u.ativo !== false
            }));
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            throw error;
        }
    }

    /**
     * Atualiza usuário (local + sinaliza sincronização)
     */
    async updateUser(userId, updates) {
        if (!this.isManager()) {
            throw new Error('Apenas gerentes podem atualizar usuários');
        }

        try {
            const updateData = { ...updates };

            // Se está atualizando senha, fazer hash
            if (updateData.password) {
                updateData.password_hash = this.hashPassword(updateData.password);
                delete updateData.password;
            }

            // Atualizar no cache local
            const localUsers = await this.loadUsersLocal();
            const userIndex = localUsers.findIndex(u => u.id === userId);
            
            if (userIndex === -1) {
                throw new Error('Usuário não encontrado');
            }

            localUsers[userIndex] = { 
                ...localUsers[userIndex], 
                ...updateData,
                atualizado_em: new Date().toISOString()
            };
            localStorage.setItem('ecoponto_users', JSON.stringify(localUsers));

            // Sinalizar que há dados pendentes para sincronização
            localStorage.setItem('ecoponto_users_pending_sync', 'true');

            return localUsers[userIndex];
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            throw error;
        }
    }

    /**
     * Desativa usuário (soft delete)
     */
    async deactivateUser(userId) {
        return await this.updateUser(userId, { ativo: false });
    }

    /**
     * Sincroniza usuários do Supabase para localStorage (cache offline)
     */
    async syncUsersToLocalStorage() {
        try {
            console.log('🔍 Verificando cliente Supabase:', {
                supabaseClient: !!this.supabaseClient,
                supabaseClientType: typeof this.supabaseClient,
                useSupabase: this.useSupabase
            });

            if (!this.supabaseClient) {
                console.error('❌ Cliente Supabase não encontrado. Tentando recriar...');

                // Tentar recriar o cliente
                await this.initializeSupabaseClient();

                if (!this.supabaseClient) {
                    throw new Error('Cliente Supabase não disponível para sincronização');
                }
            }

            console.log('🔄 Iniciando sincronização de usuários...');

            let supabaseUsers = [];
            let source = 'database';

            // 1. Tentar baixar do Supabase Storage (shared/users.json) - Preferencial
            try {
                console.log('⬇️ Tentando baixar users.json do Storage (shared/users.json)...');
                const { data, error } = await this.supabaseClient
                    .storage
                    .from('sync-bucket')
                    .download('shared/users.json');

                if (!error && data) {
                    console.log('✅ shared/users.json baixado com sucesso. Tamanho:', data.size);
                    const text = await data.text();
                    console.log('📄 Conteúdo users.json (início):', text.substring(0, 100));

                    try {
                        const json = JSON.parse(text);
                        console.log('🔍 Keys do JSON:', Object.keys(json));
                        if (json.data) console.log('🔍 Keys do JSON.data:', Object.keys(json.data));

                        // Verificar estrutura do snapshot (pode estar em json.data.usuarios ou json.usuarios)
                        let usersArray = null;

                        if (json.data && json.data.usuarios && Array.isArray(json.data.usuarios)) {
                            usersArray = json.data.usuarios;
                        } else if (json.usuarios && Array.isArray(json.usuarios)) {
                            usersArray = json.usuarios;
                        }

                        if (usersArray) {
                            supabaseUsers = usersArray.filter(u => u.ativo);
                            if (supabaseUsers.length > 0) {
                                source = 'storage';
                                console.log(`✅ Usuários carregados via Storage: ${supabaseUsers.length}`);
                            } else {
                                console.warn('⚠️ users.json lido mas array de usuários está vazio após filtro.');
                            }
                        } else {
                            console.warn('⚠️ users.json lido mas estrutura esperada não encontrada.');
                        }
                    } catch (parseError) {
                        console.warn('⚠️ Erro ao fazer parse do users.json:', parseError);
                    }
                } else if (error) {
                    console.warn(`⚠️ Aviso Storage (download falhou): ${error.message} (Code: ${error.statusCode})`);
                } else {
                    console.warn('⚠️ Aviso Storage: Dados retornados vazios.');
                }
            } catch (storageError) {
                console.warn('⚠️ Falha crítica ao acessar Storage:', storageError);
            }

            // Sem fallback para tabela: usuarios existe apenas no SQLite local do Desktop.
            // Os usuários chegam ao mobile exclusivamente via shared/users.json no Storage.
            if (supabaseUsers.length === 0) {
                console.warn('⚠️ Nenhum usuário encontrado em shared/users.json. Cache existente será mantido.');
                return false;
            }

            // Converter formato do Supabase para formato localStorage
            const localUsers = supabaseUsers.map(user => {
                // Normalizar formularios_permitidos para um array
                let forms = user.formularios_permitidos ?? user.formulariosPermitidos ?? [];
                if (typeof forms === 'string') {
                    try {
                        forms = JSON.parse(forms);
                    } catch (e) {
                        // Fallback: remover colchetes/aspas e separar por vírgula
                        try {
                            forms = forms.replace(/[\[\]\"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
                        } catch (e2) {
                            forms = [];
                        }
                    }
                }
                if (!Array.isArray(forms)) forms = [];

                return {
                    id: user.id,
                    username: user.username,
                    password: user.password_hash, // Manter hash para compatibilidade
                    nome: user.nome,
                    perfil: user.perfil,
                    setores: user.tbl_usuarios_setores ? user.tbl_usuarios_setores.map(r => r.setor_id) : (user.setores || []),
                    formulariosPermitidos: forms,
                    ativo: user.ativo,
                    created_at: user.created_at,
                    synced_at: new Date().toISOString()
                };
            });

            // Preparar dados para cache
            const cacheData = {
                data: localUsers,
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
                version: '1.0',
                source: source
            };

            // Salvar no localStorage
            const cacheKey = 'ecoforms_cache_users_tbl_usuarios';
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));

            console.log(`✅ ${localUsers.length} usuários sincronizados com sucesso (via ${source})`);
            console.log(`📅 Cache válido até: ${new Date(cacheData.expires).toLocaleString()}`);

            return true;

        } catch (error) {
            console.error('❌ Erro na sincronização de usuários:', error);

            // Em caso de erro, manter cache existente se disponível
            const existingCache = localStorage.getItem('ecoforms_cache_users_tbl_usuarios');
            if (existingCache) {
                console.log('📦 Mantendo cache existente devido ao erro de sincronização');
            }

            return false;
        }
    }

    /**
     * Carrega usuários sincronizados do localStorage (modo offline)
     */
    async loadSyncedUsers() {
        try {
            // Tentar cache primário (AuthManager sync)
            const primaryKey = 'ecoforms_cache_users_tbl_usuarios';
            // Fallback: cache do device-setup / updateDeviceData (usuarios.json)
            const fallbackKey = 'ecoforms_cache_data_usuarios.json';

            let cacheData = null;
            let sourceKey = null;

            // 1. Verificar cache primário
            const primaryCached = localStorage.getItem(primaryKey);
            if (primaryCached) {
                const parsed = JSON.parse(primaryCached);
                if (!parsed.expires || Date.now() <= parsed.expires) {
                    cacheData = parsed;
                    sourceKey = primaryKey;
                } else {
                    console.log('⏰ Cache primário de usuários expirado, removendo...');
                    localStorage.removeItem(primaryKey);
                }
            }

            // 2. Se primário não disponível, verificar cache do device-setup
            if (!cacheData) {
                const fallbackCached = localStorage.getItem(fallbackKey);
                if (fallbackCached) {
                    const parsed = JSON.parse(fallbackCached);
                    if (!parsed.expires || Date.now() <= parsed.expires) {
                        cacheData = parsed;
                        sourceKey = fallbackKey;
                        console.log('📦 Usando cache de usuários do device-setup/updateData como fallback');
                    } else {
                        console.log('⏰ Cache fallback de usuários expirado');
                    }
                }
            }

            if (!cacheData || !Array.isArray(cacheData.data) || cacheData.data.length === 0) {
                console.log('📭 Nenhum usuário sincronizado encontrado no localStorage');
                return null;
            }

            const normalized = cacheData.data.map(u => ({
                id: u.id,
                username: u.username || u.login || u.email,
                password_hash: u.password_hash || u.password || u.senha || '',
                password: u.password || u.password_hash || u.senha || '',
                nome: u.nome || u.name || 'Usuário',
                perfil: u.perfil || u.role || 'operador',
                setores: u.setores || [],
                formulariosPermitidos: u.formulariosPermitidos || u.formularios_permitidos || [],
                ativo: u.ativo !== undefined ? u.ativo : true,
            }));

            console.log(`📚 Carregados ${normalized.length} usuários do cache local [${sourceKey}] (sincronizados há ${Math.round((Date.now() - cacheData.timestamp) / (1000 * 60))} minutos)`);
            return normalized;

        } catch (error) {
            console.error('Erro ao carregar usuários sincronizados:', error);
            return null;
        }
    }

    /**
     * Inicia sincronização periódica de usuários (a cada 30 minutos)
     */
    startPeriodicSync() {
        // Evitar múltiplos intervalos
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Sincronizar a cada 30 minutos se online
        this.syncInterval = setInterval(async () => {
            if (navigator.onLine && this.supabaseClient) {
                try {
                    console.log('🔄 Sincronização periódica iniciada...');
                    await this.syncUsersToLocalStorage();
                } catch (error) {
                    console.warn('⚠️ Falha na sincronização periódica:', error.message);
                }
            }
        }, 30 * 60 * 1000); // 30 minutos

        console.log('⏰ Sincronização periódica ativada (30 minutos)');
    }

    /**
     * Para sincronização periódica
     */
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏹️ Sincronização periódica desativada');
        }
    }

    /**
     * Obtém status da sincronização e cache
     */
    getSyncStatus() {
        try {
            const cacheKey = 'ecoforms_cache_users_tbl_usuarios';
            const cached = localStorage.getItem(cacheKey);

            if (!cached) {
                return {
                    hasSyncedData: false,
                    isOnline: navigator.onLine,
                    supabaseAvailable: !!this.supabaseClient,
                    message: 'Nenhum dado sincronizado disponível'
                };
            }

            const cacheData = JSON.parse(cached);
            const now = Date.now();
            const isExpired = now > cacheData.expires;
            const ageMinutes = Math.round((now - cacheData.timestamp) / (1000 * 60));

            return {
                hasSyncedData: true,
                isExpired: isExpired,
                userCount: cacheData.data?.length || 0,
                ageMinutes: ageMinutes,
                expiresAt: new Date(cacheData.expires).toLocaleString(),
                isOnline: navigator.onLine,
                supabaseAvailable: !!this.supabaseClient,
                source: cacheData.source || 'unknown',
                version: cacheData.version || '1.0',
                message: isExpired ?
                    `Cache expirado (${ageMinutes} min) - ${cacheData.data?.length || 0} usuários` :
                    `Cache válido (${ageMinutes} min) - ${cacheData.data?.length || 0} usuários`
            };

        } catch (error) {
            return {
                hasSyncedData: false,
                isOnline: navigator.onLine,
                supabaseAvailable: !!this.supabaseClient,
                error: error.message,
                message: 'Erro ao verificar status da sincronização'
            };
        }
    }

    /**
     * Atualiza o userId no DataService quando o usuário está autenticado
     */
    updateDataServiceUserId() {
        if (this.currentUser?.id && typeof window !== 'undefined' && window.dataService) {
            window.dataService.userId = this.currentUser.id;
            console.log(`🔄 AuthManager atualizou DataService userId: ${this.currentUser.id}`);
        }
    }

    /**
     * Atualiza hash de senha em todos os caches locais (rehash automático).
     */
    _updateUserHashInCache(userId, username, newHash) {
        try {
            const cacheKeys = [
                'ecoforms_cache_users_tbl_usuarios',
                'ecoforms_cache_data_usuarios.json',
            ];
            for (const key of cacheKeys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (!parsed.data || !Array.isArray(parsed.data)) continue;
                let updated = false;
                for (const u of parsed.data) {
                    if ((u.id === userId || u.username === username) && u.password_hash && !u.password_hash.startsWith('$2')) {
                        u.password_hash = newHash;
                        u.password = newHash;
                        updated = true;
                    }
                }
                if (updated) {
                    localStorage.setItem(key, JSON.stringify(parsed));
                }
            }
        } catch (e) {
            console.warn('[Auth] _updateUserHashInCache failed:', e);
        }
    }

    /**
     * Limpa cache de usuários sincronizados
     */
    clearSyncCache() {
        try {
            const cacheKey = 'ecoforms_cache_users_tbl_usuarios';
            localStorage.removeItem(cacheKey);
            console.log('🗑️ Cache de usuários sincronizados removido');
            return { success: true, message: 'Cache removido com sucesso' };
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error);
            return { success: false, error: error.message };
        }
    }
}

// Exportar para uso global
window.AuthManager = AuthManager;