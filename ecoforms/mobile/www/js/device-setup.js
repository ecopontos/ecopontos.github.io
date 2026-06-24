/**
 * Device Setup Service - Configuração inicial do dispositivo
 * Gerencia nomeação do dispositivo e instalação de formulários/dados
 */

class DeviceSetupService {
    constructor() {
        this.supabaseUrl = 'https://vnnimekczkxkpckrydnc.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubmltZWtjemt4a3Bja3J5ZG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDQ0NjUsImV4cCI6MjA3NzA4MDQ2NX0.RqLwcGIv5B5QnTfxvbemtTEx_Lve9Q6hqbab9SKA6aA';
        this.bucketName = 'sync-bucket';
        this.supabaseClient = null;
        this.availableForms = [];
        this.selectedForms = new Set();
        this.isOfflineMode = false; // Flag para controlar modo offline

        // Lista embutida de ecopontos (mudam raramente) — usada como fallback/registro principal
        this.defaultEcopontos = [
            { id: 'Ecoponto1', nome: 'Ecoponto 1' },
            { id: 'Ecoponto2', nome: 'Ecoponto 2' },
            { id: 'Ecoponto3', nome: 'Ecoponto 3' },
            { id: 'Ecoponto4', nome: 'Ecoponto 4' },
            { id: 'Ecoponto5', nome: 'Ecoponto 5' },
            { id: 'Ecoponto6', nome: 'Ecoponto 6' },
            { id: 'Ecoponto7', nome: 'Ecoponto 7' },
            { id: 'Ecoponto8', nome: 'Ecoponto 8' },
            { id: 'Ecoponto9', nome: 'Ecoponto 9' }
        ];
        this.loadingSteps = [];
        this.currentStepIndex = 0;

        // Integração com SystemConfig para versionamento
        this.systemConfig = null;
        if (typeof window !== 'undefined' && window.systemConfig) {
            this.systemConfig = window.systemConfig;
            console.log('📋 DeviceSetup integrado com SystemConfig');
        }

        this.init();
    }

    init() {
        // Verificar se dispositivo estava em modo offline anteriormente
        const offlineMode = localStorage.getItem('ecoforms_offline_mode');
        if (offlineMode === 'true') {
            // Manter o modo offline se foi explicitamente ativado pelo usuário
            this.isOfflineMode = true;
            console.log('📱 Dispositivo mantido em modo offline - usando apenas dados locais');
        } else {
            // Por padrão, tentar usar modo online
            this.isOfflineMode = false;
        }

        // Inicializar cliente Supabase apenas se não estiver em modo offline
        if (!this.isOfflineMode && typeof supabase !== 'undefined') {
            this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseKey);
        }

        // Verificar se dispositivo já foi configurado
        this.checkDeviceSetup();

        // Configurar event listeners (não necessário em modo automático, mas mantido para compatibilidade se houver retry)
        // this.setupEventListeners();

        // Carregar opções dos selects
        this.loadDeviceOptions();
    }

    // Garante que exista um cliente Supabase utilizável (tenta múltiplas estratégias)
    async ensureSupabaseClient() {
        // Se estiver em modo offline, não tentar conectar
        if (this.isOfflineMode) {
            console.log('📱 Modo offline ativo - pulando conexão Supabase');
            return null;
        }

        if (this.supabaseClient) return this.supabaseClient;

        // 1) Se houver um singleton global configurado por supabase-config.js
        if (window.globalSupabaseClient) {
            this.supabaseClient = window.globalSupabaseClient;
            return this.supabaseClient;
        }

        // 2) Se a lib supabase está disponível globalmente, criar cliente usando as credenciais locais
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            try {
                this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
                return this.supabaseClient;
            } catch (e) {
                console.warn('Falha ao criar supabase client localmente:', e);
            }
        }

        // 3) Tentar obter via helper global (quando disponível)
        if (typeof window.getSupabaseClientSync === 'function') {
            try {
                this.supabaseClient = window.getSupabaseClientSync(this.supabaseUrl, this.supabaseKey);
                if (this.supabaseClient) return this.supabaseClient;
            } catch (e) { /* ignore */ }
        }

        // 4) Carregar dinamicamente a biblioteca do CDN e criar o cliente
        try {
            await new Promise((resolve, reject) => {
                if (typeof window.supabase !== 'undefined') return resolve();
                const s = document.createElement('script');
                s.src = 'js/supabase.js';
                s.onload = () => setTimeout(resolve, 10);
                s.onerror = (e) => reject(new Error('Falha ao carregar supabase-js'));
                document.head.appendChild(s);
            });
            if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
                return this.supabaseClient;
            }
        } catch (e) {
            console.warn('Não foi possível inicializar o cliente Supabase dinamicamente:', e);
        }

        // Se chegou aqui, não conseguiu conectar - mas não ativar modo offline automaticamente
        // Apenas registrar o problema e tentar usar dados locais quando necessário
        console.warn('⚠️ Cliente Supabase não disponível - sistema tentará usar dados locais quando necessário');
        return null;
    }

    /**
     * Carrega lista de ecopontos (tenta cache/local -> supabase)
     */
    /**
     * Carrega lista de ecopontos (tenta cache/local -> supabase)
     */
    async loadEcopontos() {
        try {
            // tentar carregar de localStorage cache primeiro
            const cacheKey = 'ecoforms_cache_data_ecoponto.json';
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                console.log('♻️ Ecopontos carregados do cache local', parsed.data?.length || 0);
                // Mesclar com defaults (defaults first but allow cached to override if same id)
                const merged = this._mergeEcopontos(this.defaultEcopontos, parsed.data || []);
                return merged;
            }

            // se não tiver cache, tentar Supabase Storage (garantir cliente)
            const client = await this.ensureSupabaseClient();
            if (!client) {
                console.warn('❗ Supabase client não inicializado ao carregar ecopontos');
                this.showAlert('Não foi possível conectar ao Supabase. Verifique a conexão e tente novamente.', 'error');
                return [];
            }

            console.log('📥 Buscando ecopontos no Storage (shared/data_registry.json)...');
            try {
                const { data: fileData, error: storageError } = await client
                    .storage
                    .from('sync-bucket')
                    .download('shared/data_registry.json');

                if (storageError) {
                    console.warn('Erro ao baixar ecopontos do Storage:', storageError);
                    return this.defaultEcopontos.slice();
                }

                const text = await fileData.text();
                const registry = JSON.parse(text);
                
                // Extrair ecopontos do registry
                const allData = registry.data || registry.data_registry || registry;
                let ecopontos = [];
                
                if (Array.isArray(allData)) {
                    const ecopontoRecord = allData.find(r => r.tipo === 'ecoponto');
                    ecopontos = ecopontoRecord ? (typeof ecopontoRecord.conteudo === 'string' ? JSON.parse(ecopontoRecord.conteudo) : ecopontoRecord.conteudo) : [];
                } else if (allData.conteudo) {
                    ecopontos = typeof allData.conteudo === 'string' ? JSON.parse(allData.conteudo) : allData.conteudo;
                }

                // Mesclar com defaults para garantir os registros embarcados
                const merged = this._mergeEcopontos(this.defaultEcopontos, ecopontos || []);
                // salvar no cache local com a mesma chave usada pelo downloadSystemData
                const cacheData = { data: merged, timestamp: Date.now(), expires: Date.now() + (24 * 60 * 60 * 1000) };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                console.log('✅ Ecopontos baixados do Storage, mesclados com defaults e salvos no cache local', merged?.length || 0);
                return merged;
            } catch (storageErr) {
                console.warn('Erro ao acessar Storage para ecopontos:', storageErr);
                return this.defaultEcopontos.slice();
            }
        } catch (e) {
            console.error('Erro em loadEcopontos:', e);
            // Em caso de erro, retornar a lista embutida
            console.log('🔁 Usando ecopontos embutidos (fallback)');
            return this.defaultEcopontos.slice();
        }
    }

    _mergeEcopontos(defaults, remote) {
        const map = new Map();

        // Se remote for um objeto, tentar extrair o array
        let remoteArray = remote;
        if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
            // Tentar propriedades comuns que podem conter o array
            remoteArray = remote.ecopontos || remote.data || remote.items || remote.records || [];
            if (!Array.isArray(remoteArray)) {
                console.warn('Remote data não é um array válido, usando array vazio', remote);
                remoteArray = [];
            }
        }

        // indexar defaults
        (defaults || []).forEach(d => {
            const key = (d.id || d.ecoponto_id || d.codigo || d.nome || JSON.stringify(d)).toString();
            map.set(key, { id: d.id || d.ecoponto_id || d.codigo || key, nome: d.nome || d.label || key, ...d });
        });
        // mesclar/overrides com remote
        (remoteArray || []).forEach(r => {
            const key = (r.id || r.ecoponto_id || r.codigo || r.nome || JSON.stringify(r)).toString();
            map.set(key, { id: r.id || r.ecoponto_id || r.codigo || key, nome: r.nome || r.label || key, ...r });
        });
        return Array.from(map.values());
    }

    // Sistema de status de carregamento
    initLoadingStatus() {
        this.loadingSteps = [
            { id: 'init', title: 'Preparando', description: 'Configurando o ambiente', icon: '⚙️', status: 'pending' },
            { id: 'user', title: 'Instalando Usuário', description: 'Configurando usuário administrador', icon: '👤', status: 'pending' },
            { id: 'forms', title: 'Instalando Formulários', description: 'Carregando formulários locais', icon: '📋', status: 'pending' },
            { id: 'data', title: 'Instalando Dados', description: 'Baixando dados do sistema', icon: '', status: 'pending' },
            { id: 'complete', title: 'Tudo Pronto!', description: 'Configuração concluída com sucesso', icon: '🎉', status: 'pending' }
        ];
        this.renderLoadingStatus();
    }

    updateLoadingStep(stepId, status, description = null, progress = null) {
        const step = this.loadingSteps.find(s => s.id === stepId);
        if (step) {
            step.status = status;
            if (description) step.description = description;
            if (progress !== null) step.progress = progress;
            this.renderLoadingStatus();
            this.updateOverallProgress();
        }
    }

    renderLoadingStatus() {
        const container = document.getElementById('status-container');
        if (!container) return;

        const html = this.loadingSteps.map(step => `
            <div class="status-item ${step.status}">
                <div class="status-icon">${step.icon}</div>
                <div class="status-content">
                    <div class="status-title">${step.title}</div>
                    <div class="status-description">${step.description}</div>
                    ${step.progress !== undefined ? `
                        <div class="mini-progress">
                            <div class="mini-progress-fill" style="width: ${step.progress}%"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    updateOverallProgress() {
        const completedSteps = this.loadingSteps.filter(s => s.status === 'success').length;
        const totalSteps = this.loadingSteps.length;
        const progress = (completedSteps / totalSteps) * 100;

        const progressFill = document.getElementById('overall-progress');
        const progressText = document.getElementById('overall-status');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) {
            const currentStep = this.loadingSteps.find(s => s.status === 'loading');
            progressText.textContent = currentStep ? currentStep.title : `Progresso: ${Math.round(progress)}%`;
        }
    }

    showLoadingStatus() {
        document.getElementById('setup-form').classList.add('hidden');
        document.getElementById('loading-status').classList.remove('hidden');
    }

    hideLoadingStatus() {
        document.getElementById('loading-status').classList.add('hidden');
        document.getElementById('setup-form').classList.remove('hidden');
    }

    checkDeviceSetup() {
        const deviceConfig = localStorage.getItem('ecoforms_device_config');
        if (deviceConfig) {
            // Dispositivo já configurado, redirecionar para login
            console.log('📱 Dispositivo já configurado, redirecionando para login...');
            if (this.isOfflineMode) {
                console.log('📱 Modo offline ativo - mantendo dados locais');
            }
            window.location.href = 'login.html';
            return;
        }

        // Dispositivo não configurado, mostrar tela de setup
        // Dispositivo não configurado, iniciar setup automático
        console.log('🚀 Iniciando configuração automática...');
        this.runAutomaticSetup();
    }

    // Método público para verificar status offline
    isOffline() {
        return this.isOfflineMode;
    }

    /**
     * EXECUTAR SETUP AUTOMÁTICO
     * Substitui o formulário manual por valores padrão
     */
    async runAutomaticSetup() {
        this.initLoadingStatus();
        this.showLoadingStatus();

        // 1. Definir Nome do Dispositivo (priorizando valor existente em config)
        const existingConfig = this.getSavedDeviceConfig();
        let deviceName;
        if (existingConfig && existingConfig.deviceName) {
            deviceName = existingConfig.deviceName.trim();
            console.log(`ℹ️ Nome do dispositivo carregado de config: ${deviceName}`);
        } else {
            const deviceId = this.generateDeviceId();
            const shortId = deviceId.split('_')[1] || Math.floor(Math.random() * 10000);
            deviceName = `Tablet_${shortId.toString().substring(0, 6).toUpperCase()}`;
            console.log(`🤖 Nome gerado automaticamente: ${deviceName}`);
        }

        // 2. Definir valores padrão
        const deviceUsage = ""; // Vazio, será definido pelo setor do usuário
        const formsSource = "auto";
        const sessionTimeoutHours = 8;
        const autoLoginEnabled = false;
        const outdoorModeEnabled = false;

        // 3. Salvar configurações iniciais (SystemConfig)
        if (typeof window.systemConfig !== 'undefined') {
            try {
                window.systemConfig.setFormSourcePreference(formsSource);
                window.systemConfig.setSessionTimeoutHours(sessionTimeoutHours);
            } catch (error) {
                console.warn('⚠️ Erro ao salvar configs iniciais:', error);
            }
        }

        // 4. Carregar Formulários e Dados (Executar fluxo de instalação)
        try {
            // Atualizar status visual
            this.updateLoadingStep('init', 'success', `Dispositivo: ${deviceName}`);

            // Carregar formulários (disparado automaticamente na lógica original, mas aqui controlamos o fluxo)
            // Vamos reaproveitar a lógica de loadAvailableForms mas adaptada para não depender de UI
            await this.loadAndInstallResources(deviceName, deviceUsage);

        } catch (error) {
            console.error("❌ Erro fatal no setup automático:", error);
            this.showAlert("Erro na instalação automática. Tente recarregar a página.", "error");
        }
    }

    async loadAndInstallResources(deviceName, deviceUsage) {
        try {
            // Garantir cliente Supabase quando disponível (sem interromper fallback local)
            this.supabaseClient = await this.ensureSupabaseClient();

            // Passo 1: Formulários
            this.updateLoadingStep('forms', 'loading', 'Baixando formulários...');
            const formsList = await this.discoverForms();
            this.availableForms = formsList;
            this.selectedForms = new Set(formsList); // Selecionar todos
            const selectedForms = Array.from(this.selectedForms);

            // Instalar e cachear formulários para uso no runtime
            const formInstallResult = await this.installSelectedForms(selectedForms);
            await this.registerLocalFormsInCache();
            this.updateLoadingStep('forms', 'success', `${formInstallResult.completed}/${formInstallResult.total} formulários instalados`);

            // Passo 2: Ecopontos (Dados)
            this.updateLoadingStep('data', 'loading', 'Baixando dados do sistema...');
            await this.loadEcopontos();
            await this.downloadSystemData();
            this.updateLoadingStep('data', 'success');

            // Passo 3: Validar instalação de usuários explicitamente
            this.updateLoadingStep('user', 'loading', 'Verificando usuários instalados...');
            const userCount = await this.validateUserInstallation();
            if (userCount === 0) {
                // Tentar baixar usuarios.json diretamente
                this.updateLoadingStep('user', 'loading', 'Baixando lista de usuários...');
                await this.downloadEssentialFile('usuarios.json');
                const retryCount = await this.validateUserInstallation();
                if (retryCount === 0) {
                    this.updateLoadingStep('user', 'error', 'Nenhum usuário encontrado — login offline pode falhar');
                    console.warn('⚠️ usuarios.json sem dados. Login offline estará indisponível.');
                    // Não abortar o setup, mas avisar claramente
                } else {
                    this.updateLoadingStep('user', 'success', `${retryCount} usuário(s) instalado(s)`);
                }
            } else {
                this.updateLoadingStep('user', 'success', `${userCount} usuário(s) instalado(s)`);
            }

            // Passo 4: Finalizar Instalação

            const deviceConfig = {
                deviceName: deviceName,
                deviceUsage: deviceUsage, // Será override pelo login do usuário
                formsSource: 'auto',
                selectedForms: Array.from(this.selectedForms),
                selectedEcoponto: '',
                selectedEcopontoName: '',
                setupDate: new Date().toISOString(),
                deviceId: this.generateDeviceId(),
                autoLogin: false,
                outdoorMode: false,
                sessionTimeoutHours: 8
            };

            // Validar se dados mínimos de runtime foram realmente instalados
            this.validateRuntimeInstallation(deviceConfig.selectedForms);

            // Salvar Configuração final
            localStorage.setItem('ecoforms_device_config', JSON.stringify(deviceConfig));
            console.log('✅ Configuração salva com sucesso:', deviceConfig);

            this.updateLoadingStep('complete', 'success', 'Instalação concluída!');

            // Pequeno delay para o usuário ver o sucesso
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);

        } catch (error) {
            console.error('Erro na instalação de recursos:', error);
            this.updateLoadingStep('complete', 'error', 'Falha na instalação.');
        }
    }

    // Método para obter configuração salva do dispositivo
    getSavedDeviceConfig() {
        try {
            const configStr = localStorage.getItem('ecoforms_device_config');
            if (configStr) {
                return JSON.parse(configStr);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro ao ler configuração salva:', error);
            return null;
        }
    }

    // Método para verificar disponibilidade do localStorage
    isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            console.error('❌ localStorage não está disponível:', error);
            return false;
        }
    }

    generateDeviceId() {
        try {
            const savedConfig = this.getSavedDeviceConfig();
            if (savedConfig && savedConfig.deviceId) {
                return savedConfig.deviceId;
            }
        } catch (e) {
            console.warn('Falha ao reutilizar deviceId existente do config:', e);
        }

        try {
            const cachedId = localStorage.getItem('ecoforms_routing_id')
                || localStorage.getItem('ecoforms_device_id');
            if (cachedId) return cachedId;
        } catch (e) {
            console.warn('Falha ao ler deviceId persistido:', e);
        }

        let newId;
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                newId = `device_${crypto.randomUUID()}`;
            }
        } catch (e) {
            console.warn('Falha ao usar crypto.randomUUID, aplicando fallback:', e);
        }

        if (!newId) {
            const randomPart = Math.random().toString(36).slice(2, 10);
            newId = `device_${Date.now()}_${randomPart}`;
        }

        try {
            localStorage.setItem('ecoforms_routing_id', newId);
        } catch (e) {
            console.warn('Falha ao persistir novo deviceId:', e);
        }

        return newId;
    }

    // Método para exibir alertas na interface
    showAlert(message, type = 'info') {
        const container = document.getElementById('alert-container');
        if (!container) {
            console.warn('⚠️ Container de alertas não encontrado');
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;

        container.innerHTML = '';
        container.appendChild(alertDiv);

        // Auto-remover alertas de sucesso após 5 segundos
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode === container) {
                    container.removeChild(alertDiv);
                }
            }, 5000);
        }
    }

    // Método público para tentar reconectar
    async tryReconnect() {
        if (!this.isOfflineMode) {
            console.log('Sistema já está online');
            return true;
        }

        console.log('🔄 Tentando reconectar ao Supabase...');
        const reconnected = await this.checkConnectivity();

        if (reconnected) {
            this.showAlert('Conectividade restaurada! Sistema voltou ao modo online.', 'success');
            return true;
        } else {
            this.showAlert('Ainda sem conectividade. Sistema permanece em modo offline.', 'warning');
            return false;
        }
    }

    async loadAvailableForms() {
        try {
            console.log('📋 Carregando lista de formulários disponíveis...');
            console.log('🔗 Supabase URL:', this.supabaseUrl);
            console.log('📦 Bucket:', this.bucketName);
            console.log('🔍 Modo: descoberta automática de formulários');

            // Verificar configuração de fonte de formulários salva
            const savedConfig = this.getSavedDeviceConfig();
            const formsSource = savedConfig?.formsSource || 'auto';
            console.log(`📋 Configuração de fonte: ${formsSource}`);

            // Mostrar status de carregamento
            this.showLoadingStatus();
            this.updateLoadingStep('init', 'success');

            // MODO LOCAL_ONLY: não suportado mais (forms/ removido)
            if (formsSource === 'local_only') {
                console.warn('📱 Modo local_only não é mais suportado (pasta forms/ removida).');
                this.updateLoadingStep('forms', 'error', 'Modo local não suportado');
                this.showAlert('Modo "Somente Local" não é mais suportado. Use "Automático".', 'error');
                return;
            }

            // MODO SUPABASE_FIRST ou AUTO: tentar Supabase primeiro
            this.updateLoadingStep('supabase', 'loading', 'Conectando ao Supabase...');

            // Garantir que o cliente Supabase está disponível
            this.supabaseClient = await this.ensureSupabaseClient();
            if (!this.supabaseClient) {
                console.warn('Cliente Supabase não disponível.');
                this.updateLoadingStep('supabase', 'error', 'Supabase indisponível');
                // Sem fallback local agora
                this.updateLoadingStep('forms', 'error', 'Não foi possível conectar ao servidor.');
                return;
            }

            this.updateLoadingStep('supabase', 'success');
            this.updateLoadingStep('forms', 'loading', 'Descobrindo formulários automaticamente...');

            // Descobrir formulários automaticamente (local + remoto)
            const formsList = await this.discoverForms();
            console.log('✅ Formulários descobertos:', formsList);
            this.availableForms = formsList;

            this.updateLoadingStep('forms', 'success', `Encontrados ${formsList.length} formulários`);
            this.hideLoadingStatus();
            this.renderFormsSelector(formsList);

        } catch (error) {
            console.error('❌ Erro ao carregar formulários:', error);
            console.error('🔍 Stack trace:', error.stack);

            this.updateLoadingStep('forms', 'error', 'Erro ao carregar formulários');
            this.showAlert('Erro crítico ao carregar formulários. Verifique sua conexão.', 'error');
        }
    }

    // Fallback: carregar formulários do arquivo local
    // Fallback: carregar formulários do arquivo local
    // Fallback local removido (pasta forms/ não existe mais)

    /**
     * Descobre automaticamente formulários disponíveis na pasta forms/
     */
    async discoverForms() {
        const discoveredForms = [];
        // Check Supabase Storage (Primary Source)
        try {
            const client = await this.ensureSupabaseClient();
            if (client) {
                console.log('🔍 Verificando formulários no Storage (shared/form_registry.json)...');
                const { data: fileData, error: storageError } = await client
                    .storage
                    .from('sync-bucket')
                    .download('shared/form_registry.json');

                if (!storageError && fileData) {
                    const text = await fileData.text();
                    const registry = JSON.parse(text);
                    
                    // Extrair IDs dos formulários
                    const forms = registry.data || registry.form_registry || registry;
                    if (Array.isArray(forms)) {
                        const remoteForms = forms.map(f => {
                            const id = f.form_id || f.id || f.slug;
                            return id.endsWith('.json') ? id : `${id}.json`;
                        });
                        remoteForms.forEach(f => {
                            if (!discoveredForms.includes(f)) discoveredForms.push(f);
                        });
                        console.log(`☁️ Formulários encontrados no Storage: ${discoveredForms.length}`);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Erro ao verificar formulários remotos:', e);
            this.showAlert('Erro ao conectar com o servidor. Verifique sua conexão.', 'error');
        }

        console.log(`✅ Total de formulários disponíveis: ${discoveredForms.length}`);
        return discoveredForms;
    }

    renderFormsSelector(forms) {
        const container = document.getElementById('forms-selector');

        if (!container) {
            console.warn('Container de formulários não encontrado');
            return;
        }

        if (!forms || forms.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nenhum formulário encontrado</div>';
            return;
        }

        // NOVO: Mostrar todos os formulários como pré-selecionados sem opção de desmarcar
        const offlineMessage = this.isOfflineMode ?
            '<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 10px; margin-bottom: 15px;"><strong>📱 Modo Offline:</strong> Sistema funcionará apenas com dados locais armazenados.</div>' : '';

        const html = `
            ${offlineMessage}
            <div style="background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%); border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #155724;">🎯 Tudo Pronto para Uso!</h4>
                <p style="margin: 0; color: #155724; font-size: 14px;">
                    Todos os <strong>${forms.length} formulários</strong> serão instalados automaticamente. 
                    Você terá acesso completo a todas as funcionalidades do EcoForms!
                </p>
            </div>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 8px; padding: 10px;">
                ${forms.map(form => `
                    <div style="padding: 8px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center;">
                        <span style="color: #28a745; margin-right: 8px;">✅</span>
                        <span style="color: #495057;">${this.formatFormName(form)}</span>
                    </div>
                `).join('')}
            </div>
`;

        container.innerHTML = html;

        // Selecionar todos os formulários automaticamente
        this.selectedForms.clear();
        forms.forEach(form => {
            this.selectedForms.add(form);
        });

        // Verificar se há formulários de ecoponto e mostrar seletor se necessário
        const hasEcopontoForm = forms.some(f => /ecoponto/i.test(f));
        const ecopontoContainer = document.getElementById('ecoponto-selector');
        if (hasEcopontoForm) {
            if (ecopontoContainer) ecopontoContainer.classList.remove('hidden');
            this.loadEcopontos().then(list => {
                const selectEl = document.getElementById('ecoponto-select');
                if (!selectEl) return;
                selectEl.innerHTML = '<option value="">-- Selecione um ecoponto (opcional) --</option>' +
                    '<option value="todos">🌍 Todos os Ecopontos</option>' +
                    (Array.isArray(list) && list.length ? list.map(e => {
                        const id = e.id ?? e.codigo ?? e.value ?? e.nome ?? JSON.stringify(e);
                        const label = e.nome || e.label || id;
                        return `< option value = "${id}" > ${label}</option > `;
                    }).join('') : '<option value="">(Nenhum ecoponto encontrado)</option>');
            }).catch(err => console.warn('Erro carregando ecopontos para selector', err));
        }
    }

    formatFormName(filename) {
        // Converte nome do arquivo para nome legível
        const nameMap = {
            'galpaoChamadaForm.json': '📞 Chamada de Galpão',
            'educacaoAmbientalForm.json': '🌱 Educação Ambiental',
            'ecopontoForm.json': '🏢 Ecoponto',
            'ecopontoCaixasForm.json': '📦 Ecoponto + Caixas',
            'colocacaoCaixasForm.json': '📦 Colocação de Caixas',
            'remocaoForm.json': '🚛 Remoção'
        };

        return nameMap[filename] || filename.replace('.json', '').replace(/([A-Z])/g, ' $1').trim();
    }

    setupEventListeners() {
        const form = document.getElementById('setup-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.performDeviceSetup();
        });
    }

    async performDeviceSetup() {
        const deviceNameInput = document.getElementById('device-name');
        const deviceUsageInput = document.getElementById('device-usage');
        const formsSourceInput = document.getElementById('forms-source');

        if (!deviceNameInput) {
            this.showAlert('Campo de nome do dispositivo não encontrado.', 'error');
            return;
        }

        const deviceName = deviceNameInput.value.trim();
        const deviceUsage = deviceUsageInput ? deviceUsageInput.value.trim() : '';
        const formsSource = formsSourceInput ? formsSourceInput.value : 'auto';

        if (!deviceName) {
            this.showAlert('Por favor, informe o nome do dispositivo.', 'error');
            return;
        }

        if (!deviceUsage) {
            this.showAlert('Por favor, selecione o uso do dispositivo.', 'error');
            return;
        }

        // Salvar preferência de fonte de formulários no SystemConfig
        if (typeof window.systemConfig !== 'undefined') {
            try {
                window.systemConfig.setFormSourcePreference(formsSource);
                console.log('✅ Preferência de fonte de formulários salva:', formsSource);
            } catch (error) {
                console.warn('⚠️ Erro ao salvar preferência de fonte:', error);
            }
        }

        // Configurar tempo de expiração da sessão
        const sessionTimeoutInput = document.getElementById('session-timeout');
        const sessionTimeoutHours = sessionTimeoutInput ? parseInt(sessionTimeoutInput.value) : 8;

        if (typeof window.systemConfig !== 'undefined') {
            try {
                window.systemConfig.setSessionTimeoutHours(sessionTimeoutHours);
                console.log('✅ Tempo de expiração da sessão configurado:', sessionTimeoutHours, 'horas');
            } catch (error) {
                console.warn('⚠️ Erro ao configurar tempo de expiração:', error);
            }
        } else {
            console.warn('⚠️ SystemConfig não disponível - preferência será salva no deviceConfig');
        }

        // Removido: validação de formulários selecionados - todos são selecionados automaticamente

        // Nota: não mostrar status de carregamento até passarmos pelas validações de seleção

        try {

            // 1. Verificar se precisamos pedir seleção de ecoponto
            const selected = Array.from(this.selectedForms);
            let chosenEcoponto = null;
            const hasEcopontoForm = selected.some(f => /ecoponto/i.test(f));
            if (hasEcopontoForm) {
                // Primeiro: verificar se o select já existe e tem um valor escolhido pelo usuário.
                const selectEl = document.getElementById('ecoponto-select');
                const container = document.getElementById('ecoponto-selector');
                if (selectEl && container) {
                    // Se o usuário já selecionou um ecoponto, usá-lo imediatamente e evitar recarregar a lista
                    if (selectEl.value && selectEl.value !== '') {
                        chosenEcoponto = selectEl.value;
                        try { selectEl.focus(); } catch (e) { }
                        var chosenEcopontoName = (selectEl.options && selectEl.options[selectEl.selectedIndex] && selectEl.options[selectEl.selectedIndex].text) || '';
                    } else {
                        // ainda sem seleção: carregar ecopontos e popular select para o usuário escolher
                        this.updateLoadingStep('data', 'loading', 'Carregando lista de ecopontos...');
                        const ecopontos = await this.loadEcopontos();
                        // popular somente se necessário (para não sobrescrever seleção do usuário)
                        const needsPopulate = selectEl.options.length <= 1 || (selectEl.options[0] && /Carregando|Selecione/i.test(selectEl.options[0].text));
                        if (needsPopulate) {
                            selectEl.innerHTML = '<option value="">-- Selecione um ecoponto --</option>' + (Array.isArray(ecopontos) && ecopontos.length ? ecopontos.map(e => {
                                const id = e.id ?? e.codigo ?? e.value ?? e.nome ?? JSON.stringify(e);
                                const label = e.nome || e.label || id;
                                return `< option value = "${id}" > ${label}</option > `;
                            }).join('') : '<option value="">(Nenhum ecoponto encontrado)</option>');
                        }
                        if (container) container.classList.remove('hidden');
                        try { selectEl.focus(); } catch (e) { }
                        chosenEcoponto = selectEl.value || '';
                        var chosenEcopontoName = '';
                        try { chosenEcopontoName = (selectEl.options && selectEl.options[selectEl.selectedIndex] && selectEl.options[selectEl.selectedIndex].text) || ''; } catch (e) { chosenEcopontoName = ''; }
                    }
                } else {
                    // Select não renderizado ainda: carregar ecopontos para criar o select na interface
                    this.updateLoadingStep('data', 'loading', 'Carregando lista de ecopontos...');
                    const ecopontos = await this.loadEcopontos();
                    // Tentar inserir opções se o select for criado posteriormente pelo DOM
                    const maybeSelect = document.getElementById('ecoponto-select');
                    if (maybeSelect) {
                        maybeSelect.innerHTML = '<option value="">-- Selecione um ecoponto --</option>' + (Array.isArray(ecopontos) && ecopontos.length ? ecopontos.map(e => {
                            const id = e.id ?? e.codigo ?? e.value ?? e.nome ?? JSON.stringify(e);
                            const label = e.nome || e.label || id;
                            return `< option value = "${id}" > ${label}</option > `;
                        }).join('') : '<option value="">(Nenhum ecoponto encontrado)</option>');
                    }
                }
            }

            // 2. Validar seleção de ecoponto quando necessário e salvar configuração do dispositivo
            if (hasEcopontoForm) {
                // Re-ler o valor atual do select no momento do submit para garantir que a escolha do usuário seja considerada
                try {
                    const selectElNow = document.getElementById('ecoponto-select');
                    if (selectElNow) {
                        const valNow = selectElNow.value || '';
                        const nameNow = (selectElNow.options && selectElNow.selectedIndex >= 0) ? (selectElNow.options[selectElNow.selectedIndex].text || '') : '';
                        console.log('DEBUG: ecoponto select current value at submit:', valNow, 'label:', nameNow);
                        chosenEcoponto = valNow;
                        chosenEcopontoName = nameNow;
                    }
                } catch (e) {
                    console.warn('Erro ao ler select de ecoponto no submit', e);
                }

                // Considerar "Todos" como uma escolha válida (caso exista)
                const isTodos = (typeof chosenEcopontoName === 'string' && /todos/i.test(chosenEcopontoName));
                if (!chosenEcoponto || chosenEcoponto === '') {
                    if (!isTodos) {
                        // Ecoponto não é mais obrigatório - permitir continuar sem seleção
                        console.log('ℹ️ Ecoponto não selecionado - continuando sem filtro específico');
                    }
                }
            }

            // Mostrar status de carregamento agora que validações passaram
            this.showLoadingStatus();
            this.updateLoadingStep('forms', 'success');
            this.updateLoadingStep('data', 'loading', 'Iniciando instalação...');

            // Verificar se localStorage está disponível antes de prosseguir
            if (!this.isLocalStorageAvailable()) {
                this.showAlert('Armazenamento local não disponível. Verifique as configurações do navegador.', 'error');
                return;
            }

            // Ler configuração de login automático
            const autoLoginCheckbox = document.getElementById('auto-login');
            const autoLoginEnabled = autoLoginCheckbox ? autoLoginCheckbox.checked : false;

            // Ler configuração de modo outdoor
            const outdoorModeCheckbox = document.getElementById('outdoor-mode');
            const outdoorModeEnabled = outdoorModeCheckbox ? outdoorModeCheckbox.checked : false;

            const deviceConfig = {
                deviceName: deviceName,
                deviceUsage: deviceUsage,
                formsSource: formsSource,
                selectedForms: selected,
                selectedEcoponto: (chosenEcoponto === null ? '' : chosenEcoponto),
                selectedEcopontoName: (typeof chosenEcopontoName !== 'undefined' ? chosenEcopontoName : ''),
                setupDate: new Date().toISOString(),
                deviceId: this.generateDeviceId(),
                autoLogin: autoLoginEnabled,
                outdoorMode: outdoorModeEnabled,
                sessionTimeoutHours: sessionTimeoutHours
            };

            localStorage.setItem('ecoforms_device_config', JSON.stringify(deviceConfig));
            console.log('💾 Configuração do dispositivo salva:', deviceConfig);

            // Salvar configuração de login automático
            if (autoLoginEnabled) {
                localStorage.setItem('ecoforms_auto_login', 'true');
                console.log('✅ Login automático ativado');
            } else {
                localStorage.removeItem('ecoforms_auto_login');
                console.log('ℹ️ Login automático desativado');
            }

            // Salvar configuração de modo outdoor
            if (outdoorModeEnabled) {
                localStorage.setItem('outdoor-mode', 'true');
                console.log('🌞 Modo outdoor ativado');
            } else {
                localStorage.setItem('outdoor-mode', 'false');
                console.log('ℹ️ Modo outdoor desativado');
            }

            // 3. Verificar se o SmartPreloader está disponível
            if (typeof window.SmartPreloader !== 'undefined') {
                console.log('🚀 Usando SmartPreloader para pré-carregamento inteligente');

                try {
                    // Inicializar o SmartPreloader
                    const smartPreloader = new SmartPreloader(this);

                    // 3.1 Instalar formulários selecionados
                    await this.installSelectedForms(deviceConfig.selectedForms);

                    // 3.1.1 Registrar formulários locais no localStorage para uso offline
                    await this.registerLocalFormsInCache();

                    // 3.2 Usar o pré-carregamento inteligente para dados
                    const preloadResult = await smartPreloader.startSmartPreloading(deviceConfig.selectedForms);

                    if (preloadResult.success) {
                        console.log(`✅ Pré - carregamento inteligente concluído: ${preloadResult.downloaded} arquivos baixados`);
                        this.updateLoadingStep('data', 'success', `Sistema instalado com ${preloadResult.downloaded} arquivos!`);
                    } else {
                        console.warn('⚠️ Pré-carregamento inteligente falhou, usando método tradicional');
                        // Fallback para método tradicional
                        await this.downloadSystemData();
                        this.updateLoadingStep('data', 'success', 'Sistema instalado com dados básicos!');
                    }
                } catch (preloaderError) {
                    console.error('❌ Erro no SmartPreloader:', preloaderError);
                    console.log('🔄 Usando método tradicional como fallback');
                    // Fallback para método tradicional
                    await this.downloadSystemData();
                }
            } else {
                console.log('ℹ️ SmartPreloader não disponível, usando método tradicional');

                // Método tradicional
                await this.installSelectedForms(deviceConfig.selectedForms);
                await this.downloadSystemData();
            }

            // 4. Finalizar configuração
            this.updateLoadingStep('data', 'success', 'Sistema instalado com sucesso!');
            this.updateLoadingStep('complete', 'success');

            // Se funcionou com dados locais, confirmar modo offline
            if (this.isOfflineMode) {
                console.log('✅ Configuração offline concluída com sucesso');
                this.showAlert('🎉 Dispositivo configurado em modo offline! Pronto para uso com dados locais.', 'success');
            } else {
                this.showAlert('🎉 Configuração concluída! Seu dispositivo está pronto para uso.', 'success');
            }

            setTimeout(() => {
                this.showAlert('🚀 Redirecionando para o login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            }, 1000);

        } catch (error) {
            console.error('Erro durante configuração:', error);
            this.updateLoadingStep('data', 'error', 'Ops! Algo deu errado');
            this.showAlert('😅 Ocorreu um problema durante a configuração. Vamos tentar novamente?', 'error');

            // Rollback: remover configuração do dispositivo se instalação falhou
            try {
                localStorage.removeItem('ecoforms_device_config');
                console.log('Configuração do dispositivo removida devido a erro na instalação');
            } catch (rollbackError) {
                console.warn('Erro ao fazer rollback da configuração:', rollbackError);
            }

            // Mostrar botão de tentar novamente
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.style.display = 'block';
                retryBtn.onclick = () => {
                    retryBtn.style.display = 'none';
                    this.performDeviceSetup();
                };
            } else {
                console.warn('Botão de retry não encontrado');
            }
        }
    }

    async installSelectedForms(selectedForms) {
        const total = selectedForms.length;
        let completed = 0;
        const failed = [];

        for (const formFile of selectedForms) {
            const currentIndex = selectedForms.indexOf(formFile) + 1;
            const formLabel = this.formatFormName(formFile);
            this.updateLoadingStep(
                'forms',
                'loading',
                `Instalando ${formLabel} (${currentIndex}/${total})...`,
                Math.round((currentIndex / total) * 100)
            );

            try {
                let formData = null;
                let formVersion = null;

                // Primeiro tentar baixar do Supabase Storage
                if (this.supabaseClient) {
                    try {
                        const { data, error } = await this.supabaseClient.storage
                            .from(this.bucketName)
                            .download(`forms/${formFile}`);

                        if (!error) {
                            formData = JSON.parse(await data.text());
                            console.log(`✅ Formulário ${formFile} baixado do Supabase`);
                        } else {
                            console.warn(`Erro ao baixar ${formFile} do Supabase:`, error);
                        }
                    } catch (supabaseError) {
                        console.warn(`Falha no Supabase para ${formFile}:`, supabaseError);
                    }
                } else {
                    console.warn('Cliente Supabase não disponível, tentando fallback local');
                }

                // Fallback: tentar carregar do arquivo local
                if (!formData) {
                    try {
                        const response = await fetch(`forms/${formFile}`);
                        if (response.ok) {
                            formData = await response.json();
                            console.log(`✅ Formulário ${formFile} carregado do fallback local`);
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (localError) {
                        console.error(`Erro no fallback local para ${formFile}:`, localError);
                        failed.push(formLabel);
                        continue; // Pular este formulário
                    }
                }

                // Se há ecoponto selecionado, pré-preencher campos de ecoponto nos formulários
                const deviceConfig = JSON.parse(localStorage.getItem('ecoforms_device_config') || '{}');
                if (deviceConfig.selectedEcoponto && /ecoponto/i.test(formFile)) {
                    this.prefillEcopontoFields(formData, deviceConfig.selectedEcoponto, deviceConfig.selectedEcopontoName);
                }

                // Detectar versão do formulário se disponível
                if (this.systemConfig) {
                    // Tentar extrair versão dos metadados do arquivo ou usar timestamp como fallback
                    formVersion = formData._version || formData.version || new Date().toISOString().split('T')[0];
                    this.systemConfig.registerFormVersion(formFile, formVersion);
                }

                // Instalar dataSources associados ao formulário (remoto)
                const formDataSources = await this.installFormDataSources(formData, false);
                console.log(`📊 ${formDataSources.length} dataSources instalados para ${formFile}`);

                // Verificar se localStorage está disponível
                if (this.isLocalStorageAvailable()) {
                    // Salvar no localStorage com cache e metadados de versionamento
                    const cacheKey = `ecoforms_cache_forms_${formFile}`;
                    const cacheData = {
                        data: formData,
                        timestamp: Date.now(),
                        expires: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
                        version: formVersion,
                        installedAt: new Date().toISOString(),
                        dataSources: formDataSources // Registrar quais dataSources foram instalados
                    };

                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    console.log(`✅ Formulário ${formFile} instalado (versão: ${formVersion || 'n/a'}, ${formDataSources.length} dataSources)`);

                    // Registrar evento de instalação
                    if (this.systemConfig) {
                        this.systemConfig.recordSyncEvent('form_installed', {
                            formFile,
                            version: formVersion,
                            timestamp: cacheData.installedAt
                        });
                    }
                } else {
                    console.warn(`localStorage não disponível, pulando cache para ${formFile}`);
                }

                completed++;

            } catch (error) {
                console.error(`Erro ao instalar ${formFile}:`, error);
                failed.push(formLabel);

                // Registrar falha de instalação
                if (this.systemConfig) {
                    this.systemConfig.recordSyncEvent('form_install_failed', {
                        formFile,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        console.log(`📋 Instalação concluída: ${completed}/${total} formulários`);

        // Resumo final com detalhes de falhas
        if (failed.length > 0) {
            console.warn(`⚠️ Formulários com falha (${failed.length}):`, failed.join(', '));
            this.updateLoadingStep(
                'forms',
                completed > 0 ? 'success' : 'error',
                `${completed}/${total} instalados${failed.length > 0 ? ` (⚠️ ${failed.length} falharam)` : ''}`
            );
        }

        if (completed === 0 && total > 0) {
            console.error('❌ Nenhum formulário foi instalado com sucesso.');
        }

        // Registrar conclusão geral da instalação
        if (this.systemConfig) {
            this.systemConfig.recordSyncEvent('forms_installation_completed', {
                totalForms: total,
                completedForms: completed,
                failedForms: failed,
                successRate: total > 0 ? (completed / total) * 100 : 0,
                timestamp: new Date().toISOString()
            });
        }

        return { total, completed, failed };
    }

    /**
     * Instala dataSources referenciados por um formulário no cache local.
     * Retorna a lista de arquivos .json instalados.
     */
    async installFormDataSources(formData, forceRefresh = false) {
        const installedDataSources = [];

        if (!formData || typeof formData !== 'object') {
            return installedDataSources;
        }

        const dataSources = new Set();

        const collectFromFields = (fields) => {
            if (!Array.isArray(fields)) return;

            fields.forEach((field) => {
                if (field?.dataSource) {
                    dataSources.add(String(field.dataSource).replace(/\.json$/i, '') + '.json');
                }

                if (field?.config?.dataSource) {
                    dataSources.add(String(field.config.dataSource).replace(/\.json$/i, '') + '.json');
                }

                if (Array.isArray(field?.campos)) collectFromFields(field.campos);
                if (Array.isArray(field?.fields)) collectFromFields(field.fields);
            });
        };

        collectFromFields(formData.campos);
        collectFromFields(formData.fields);

        for (const dataFile of dataSources) {
            const cacheKey = `ecoforms_cache_data_${dataFile}`;

            if (!forceRefresh) {
                try {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        const isValid = parsed?.data && (!parsed.expires || Date.now() < parsed.expires);
                        if (isValid) {
                            installedDataSources.push(dataFile);
                            continue;
                        }
                    }
                } catch (cacheError) {
                    console.warn(`⚠️ Cache inválido para ${dataFile}, refazendo download:`, cacheError);
                }
            }

            let dataContent = null;

            // 1) Tentar Supabase Storage
            if (this.supabaseClient) {
                try {
                    const { data, error } = await this.supabaseClient.storage
                        .from(this.bucketName)
                        .download(`data/${dataFile}`);

                    if (!error && data) {
                        dataContent = JSON.parse(await data.text());
                        console.log(`✅ DataSource ${dataFile} baixado do Supabase`);
                    } else if (error) {
                        console.warn(`⚠️ Erro ao baixar dataSource ${dataFile} do Supabase:`, error);
                    }
                } catch (supabaseError) {
                    console.warn(`⚠️ Falha no Supabase para dataSource ${dataFile}:`, supabaseError);
                }
            }

            // 2) Fallback local
            if (!dataContent) {
                try {
                    const response = await fetch(`data/${dataFile}`);
                    if (response.ok) {
                        dataContent = await response.json();
                        console.log(`✅ DataSource ${dataFile} carregado do fallback local`);
                    }
                } catch (localError) {
                    console.warn(`⚠️ Fallback local falhou para dataSource ${dataFile}:`, localError);
                }
            }

            if (!dataContent) continue;

            if (this.isLocalStorageAvailable()) {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: dataContent,
                    timestamp: Date.now(),
                    expires: Date.now() + (24 * 60 * 60 * 1000)
                }));
            }

            installedDataSources.push(dataFile);
        }

        return installedDataSources;
    }

    /**
     * Validação mínima pós-instalação para garantir funcionamento do runtime.
     */
    validateRuntimeInstallation(selectedForms = []) {
        const formsIndexRaw = localStorage.getItem('ecoforms_forms_index');
        if (!formsIndexRaw) {
            throw new Error('Índice de formulários não foi criado (ecoforms_forms_index).');
        }

        const missingForms = [];
        (selectedForms || []).forEach((formFile) => {
            const key = `ecoforms_cache_forms_${formFile}`;
            if (!localStorage.getItem(key)) {
                missingForms.push(formFile);
            }
        });

        if (missingForms.length > 0) {
            throw new Error(`Formulários sem cache de setup: ${missingForms.join(', ')}`);
        }

        const hasAnyDataCache = Object.keys(localStorage).some((k) => k.startsWith('ecoforms_cache_data_'));
        if (!hasAnyDataCache) {
            throw new Error('Nenhum dataSource foi cacheado para runtime.');
        }

        console.log('✅ Validação de instalação concluída: runtime pronto (forms + data).');
    }

    /**
     * Valida se usuarios.json foi instalado com ao menos um usuário.
     * @returns {number} Quantidade de usuários encontrados no cache (0 = não instalado ou vazio)
     */
    async validateUserInstallation() {
        const cacheKey = 'ecoforms_cache_data_usuarios.json';
        try {
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return 0;
            const parsed = JSON.parse(cached);
            const users = Array.isArray(parsed.data) ? parsed.data : [];
            console.log(`👤 Usuários em cache: ${users.length}`);
            return users.length;
        } catch (e) {
            console.warn('⚠️ Erro ao verificar usuarios.json no cache:', e);
            return 0;
        }
    }

    /**
     * Baixa um arquivo essencial de dados (ex: usuarios.json) do Supabase Storage
     * e o salva no cache local. Usado quando downloadSystemData() não cobriu o arquivo.
     * @param {string} filename — nome do arquivo em suite/data/
     */
    async downloadEssentialFile(filename) {
        const cacheKey = `ecoforms_cache_data_${filename}`;
        try {
            let dataContent = null;

            if (this.supabaseClient) {
                try {
                    const { data, error } = await this.supabaseClient.storage
                        .from(this.bucketName)
                        .download(`data/${filename}`);
                    if (!error && data) {
                        dataContent = JSON.parse(await data.text());
                        console.log(`✅ ${filename} baixado do Supabase (essential)`);
                    } else {
                        console.warn(`⚠️ Erro ao baixar ${filename} do Supabase:`, error);
                    }
                } catch (e) {
                    console.warn(`⚠️ Falha Supabase para ${filename}:`, e);
                }
            }

            // Fallback local
            if (!dataContent) {
                try {
                    const response = await fetch(`data/${filename}`);
                    if (response.ok) {
                        dataContent = await response.json();
                        console.log(`✅ ${filename} carregado do fallback local (essential)`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Fallback local falhou para ${filename}:`, e);
                }
            }

            if (dataContent && this.isLocalStorageAvailable()) {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: dataContent,
                    timestamp: Date.now(),
                    expires: Date.now() + (24 * 60 * 60 * 1000)
                }));
                console.log(`✅ ${filename} salvo no cache (essential)`);
            }
        } catch (e) {
            console.error(`❌ Erro em downloadEssentialFile(${filename}):`, e);
        }
    }

    /**
     * Registra todos os formulários locais no localStorage para uso offline
     * Esta função garante que os formulários locais estejam sempre disponíveis
     * mesmo quando o Supabase não estiver acessível
     */
    async registerLocalFormsInCache() {
        try {
            console.log('📋 Registrando formulários locais no cache...');

            // Descobrir formulários automaticamente
            const localFormsList = await this.discoverForms();
            console.log(`📁 Encontrados ${localFormsList.length} formulários locais:`, localFormsList);

            // Registrar no localStorage como cache principal
            const formsIndex = {
                forms: localFormsList,
                timestamp: Date.now(),
                source: 'local_setup',
                version: '1.0'
            };

            localStorage.setItem('ecoforms_forms_index', JSON.stringify(formsIndex));
            console.log('✅ Formulários locais registrados no cache principal');

            // Também registrar cada formulário individualmente no cache
            let registeredCount = 0;
            for (const formFile of localFormsList) {
                try {
                    // Verificar se já está no cache
                    const cacheKey = `ecoforms_cache_forms_${formFile}`;
                    const existingCache = localStorage.getItem(cacheKey);

                    if (!existingCache) {
                        // Carregar e registrar no cache
                        const formResponse = await fetch(`forms/${formFile}`);
                        if (formResponse.ok) {
                            const formData = await formResponse.json();

                            const cacheData = {
                                data: formData,
                                timestamp: Date.now(),
                                expires: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 dias
                                version: formData.version || '1.0',
                                installedAt: new Date().toISOString(),
                                source: 'local_setup'
                            };

                            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                            registeredCount++;
                            console.log(`📦 Registrado no cache: ${formFile}`);
                        } else {
                            console.warn(`⚠️ Não foi possível carregar ${formFile} para cache`);
                        }
                    } else {
                        console.log(`📦 Já em cache: ${formFile}`);
                        registeredCount++;
                    }
                } catch (formError) {
                    console.warn(`⚠️ Erro ao registrar ${formFile} no cache:`, formError);
                }
            }

            console.log(`✅ Registro concluído: ${registeredCount}/${localFormsList.length} formulários no cache local`);

        } catch (error) {
            console.error('❌ Erro ao registrar formulários locais no cache:', error);
            // Não falhar completamente - apenas logar o erro
        }
    }

    /**
     * Pré-preenche campos de ecoponto em um formulário com o ecoponto selecionado no setup
     * @param {Object} formData - Dados do formulário JSON
     * @param {String} ecopontoId - ID do ecoponto selecionado
     * @param {String} ecopontoName - Nome do ecoponto selecionado
     */
    prefillEcopontoFields(formData, ecopontoId, ecopontoName) {
        if (!formData || !formData.campos || !Array.isArray(formData.campos)) {
            return;
        }

        const processFields = (campos) => {
            campos.forEach(campo => {
                // Identificar campos de ecoponto por id ou label
                const isEcopontoField = /ecoponto/i.test(campo.id) || /ecoponto/i.test(campo.label || '');

                if (isEcopontoField) {
                    // Definir valor padrão se ainda não tiver
                    if (!campo.default && !campo.defaultValue && !campo.value) {
                        // Para campos que usam optionValue (select), usar o ID
                        if (campo.optionValue || campo.dataSource) {
                            campo.default = ecopontoId;
                            console.log(`✅ Campo '${campo.id}' pré-preenchido com ecoponto: ${ecopontoId}`);
                        }
                        // Para campos de texto simples, usar o nome
                        else if (campo.type === 'text' || campo.tipo === 'text') {
                            campo.default = ecopontoName || ecopontoId;
                            console.log(`✅ Campo '${campo.id}' pré-preenchido com ecoponto: ${ecopontoName || ecopontoId}`);
                        }
                    }
                }

                // Recursão para campos aninhados (group fields, etc)
                if (campo.campos && Array.isArray(campo.campos)) {
                    processFields(campo.campos);
                }
                if (campo.fields && Array.isArray(campo.fields)) {
                    processFields(campo.fields);
                }
            });
        };

        processFields(formData.campos);
        console.log(`📍 Formulário configurado para ecoponto: ${ecopontoName || ecopontoId}`);
    }

    async downloadSystemData() {
        console.log('📊 Baixando dados do sistema...');

        // Verificar configuração de fonte de dados salva
        const savedConfig = this.getSavedDeviceConfig();
        const formsSource = savedConfig?.formsSource || 'auto';
        console.log(`📊 Configuração de fonte para dados: ${formsSource}`);

        // MODO LOCAL_ONLY: pular download de dados do Supabase
        if (formsSource === 'local_only') {
            console.log('📱 Modo local_only: pulando download de dados do sistema');
            this.updateLoadingStep('data', 'skipped', 'Modo local - usando apenas dados locais');
            return;
        }

        // Listar dinamicamente todos os arquivos .json da pasta data/
        let allDataFiles = [];

        try {
            this.updateLoadingStep('data', 'loading', 'Listando arquivos de dados...');

            const { data: fileList, error: listError } = await this.supabaseClient.storage
                .from(this.bucketName)
                .list('data', {
                    limit: 100,
                    offset: 0
                });

            if (listError) {
                console.warn('⚠️ Erro ao listar arquivos em /data/, usando lista padrão:', listError);
                // Fallback para lista hardcoded caso a listagem falhe
                allDataFiles = [
                    'bairros.json',
                    'caixas.json',
                    'cooperados.json',
                    'cooperados_demo.json',
                    'ecoponto.json',
                    'equipes.json',
                    'galpoes.json',
                    'itens_vistoria.json',
                    'logins.json',
                    'participantes.json',
                    'publico_alvo.json',
                    'residuos.json',
                    'temas.json',
                    'user.json',
                    'usuarios.json'
                ];
            } else {
                // Filtrar apenas arquivos .json (excluir pastas e outros tipos)
                allDataFiles = fileList
                    .filter(file => file.name && file.name.endsWith('.json'))
                    .map(file => file.name);

                console.log(`📋 Encontrados ${allDataFiles.length} arquivos de dados em /data/`);
            }
        } catch (error) {
            console.error('❌ Erro ao listar /data/, usando lista padrão:', error);
            // Fallback para lista hardcoded
            allDataFiles = [
                'bairros.json',
                'caixas.json',
                'cooperados.json',
                'cooperados_demo.json',
                'ecoponto.json',
                'equipes.json',
                'galpoes.json',
                'itens_vistoria.json',
                'logins.json',
                'participantes.json',
                'publico_alvo.json',
                'residuos.json',
                'temas.json',
                'user.json',
                'usuarios.json'
            ];
        }

        // 🔍 FILTRO INTELIGENTE: Analisar formulários selecionados e extrair dataSources necessários
        const requiredDataSources = await this.extractRequiredDataSources();

        // Arquivos essenciais sempre necessários (independente dos formulários)
        const essentialFiles = ['ecoponto.json', 'usuarios.json', 'user.json'];

        // Combinar dataSources necessários + arquivos essenciais
        const dataFiles = [...new Set([...requiredDataSources, ...essentialFiles])];

        // Filtrar apenas os que existem na listagem completa
        const filesToDownload = dataFiles.filter(file => allDataFiles.includes(file));

        console.log(`🔍 Filtro inteligente: ${filesToDownload.length}/${allDataFiles.length} arquivos necessários`);
        if (filesToDownload.length < allDataFiles.length) {
            const skipped = allDataFiles.filter(f => !filesToDownload.includes(f));
            console.log(`⏭️  Pulando ${skipped.length} arquivos não utilizados:`, skipped.join(', '));
        }

        let completed = 0;
        const total = filesToDownload.length;

        for (const dataFile of filesToDownload) {
            this.updateLoadingStep('data', 'loading', `Baixando ${dataFile}...`, 50 + (completed / total) * 50);

            try {
                let dataContent = null;

                // Primeiro tentar baixar do Supabase Storage
                if (this.supabaseClient) {
                    try {
                        const { data, error } = await this.supabaseClient.storage
                            .from(this.bucketName)
                            .download(`data/${dataFile}`);

                        if (!error) {
                            dataContent = JSON.parse(await data.text());
                            console.log(`✅ Dados ${dataFile} baixados do Supabase`);
                        } else {
                            console.warn(`Erro ao baixar ${dataFile} do Supabase:`, error);
                        }
                    } catch (supabaseError) {
                        console.warn(`Falha no Supabase para ${dataFile}:`, supabaseError);
                    }
                } else {
                    console.warn('Cliente Supabase não disponível, tentando fallback local');
                }

                // Fallback: tentar carregar do arquivo local
                if (!dataContent) {
                    try {
                        const response = await fetch(`data/${dataFile}`);
                        if (response.ok) {
                            dataContent = await response.json();
                            console.log(`✅ Dados ${dataFile} carregados do fallback local`);
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (localError) {
                        console.error(`Erro no fallback local para ${dataFile}:`, localError);
                        continue; // Pular este arquivo
                    }
                }

                // Verificar se localStorage está disponível antes de salvar
                if (this.isLocalStorageAvailable()) {
                    // Salvar no localStorage com cache
                    const cacheKey = `ecoforms_cache_data_${dataFile}`;
                    const cacheData = {
                        data: dataContent,
                        timestamp: Date.now(),
                        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
                    };

                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                    console.log(`✅ Dados ${dataFile} salvos no cache`);
                } else {
                    console.warn(`localStorage não disponível, pulando cache para ${dataFile}`);
                }

                completed++;

            } catch (error) {
                console.error(`Erro ao baixar ${dataFile}:`, error);
            }
        }

        console.log(`📊 Download concluído: ${completed}/${total} arquivos de dados`);
    }

    /**
     * Extrai lista de dataSources necessários dos formulários selecionados
     * Analisa campos dos formulários para identificar quais arquivos .json são referenciados
     */
    async extractRequiredDataSources() {
        const dataSources = new Set();

        try {
            console.log('🔍 Analisando formulários para identificar dados necessários...');

            for (const formFile of this.selectedForms) {
                try {
                    // Verificar se já temos o formulário em cache local
                    const cacheKey = `ecoforms_cache_forms_${formFile}`;
                    let formData = null;

                    // Tentar cache primeiro
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached);
                            formData = parsed.data || parsed;
                        } catch (e) {
                            console.warn(`Cache inválido para ${formFile}`, e);
                        }
                    }

                    // Se não houver cache, buscar do Supabase
                    if (!formData) {
                        if (!this.supabaseClient) {
                            console.warn(`⚠️ Supabase client não disponível para baixar ${formFile} — pulando`);
                            continue;
                        }
                        const { data, error } = await this.supabaseClient.storage
                            .from(this.bucketName)
                            .download(`forms/${formFile}`);

                        if (error) {
                            console.warn(`Erro ao baixar ${formFile} para análise:`, error);
                            continue;
                        }

                        formData = JSON.parse(await data.text());
                    }

                    // Extrair dataSources de todos os campos (recursivo para campos aninhados)
                    const extractFromFields = (fields) => {
                        if (!Array.isArray(fields)) return;

                        fields.forEach(field => {
                            // Verificar dataSource no campo
                            if (field.dataSource) {
                                const ds = String(field.dataSource).replace(/\.json$/i, '') + '.json';
                                dataSources.add(ds);
                            }

                            // Verificar dataSource em config
                            if (field.config && field.config.dataSource) {
                                const ds = String(field.config.dataSource).replace(/\.json$/i, '') + '.json';
                                dataSources.add(ds);
                            }

                            // Recursão para campos aninhados (ex: group fields)
                            if (field.campos && Array.isArray(field.campos)) {
                                extractFromFields(field.campos);
                            }

                            // Recursão para fields (nomenclatura alternativa)
                            if (field.fields && Array.isArray(field.fields)) {
                                extractFromFields(field.fields);
                            }
                        });
                    };

                    // Extrair de campos do formulário
                    if (formData.campos) {
                        extractFromFields(formData.campos);
                    }
                    if (formData.fields) {
                        extractFromFields(formData.fields);
                    }

                } catch (error) {
                    console.error(`Erro ao analisar ${formFile}:`, error);
                }
            }

            const result = Array.from(dataSources);
            console.log(`✅ DataSources identificados: ${result.length}`, result.length > 0 ? result : '(nenhum)');
            return result;

        } catch (error) {
            console.error('Erro ao extrair dataSources:', error);
            return [];
        }
    }

    // Carregar opções dos selects dinamicamente do JSON
    async loadDeviceOptions() {
        try {
            const response = await fetch('data/device-options.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const options = await response.json();

            // Popular device-usage
            const deviceUsageSelect = document.getElementById('device-usage');
            if (deviceUsageSelect && options.deviceUsage) {
                options.deviceUsage.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label;
                    deviceUsageSelect.appendChild(opt);
                });
            }

            // Popular forms-source
            const formsSourceSelect = document.getElementById('forms-source');
            if (formsSourceSelect && options.formsSource) {
                options.formsSource.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label;
                    formsSourceSelect.appendChild(opt);
                });
                // Definir padrão como 'auto'
                formsSourceSelect.value = 'auto';
            }

            // Popular session-timeout
            const sessionTimeoutSelect = document.getElementById('session-timeout');
            if (sessionTimeoutSelect && options.sessionTimeout) {
                options.sessionTimeout.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label;
                    sessionTimeoutSelect.appendChild(opt);
                });
                // Definir padrão como 8 horas
                sessionTimeoutSelect.value = '8';
            }

            // Carregar configurações existentes
            this.loadExistingConfiguration();

            console.log('✅ Opções dos selects carregadas com sucesso');
        } catch (error) {
            console.error('❌ Erro ao carregar opções dos selects:', error);
            // Fallback: adicionar opções básicas hardcoded
            this.loadFallbackOptions();
        }
    }

    // Carregar configurações existentes do localStorage
    loadExistingConfiguration() {
        try {
            // Carregar configuração de auto-login
            const autoLoginEnabled = localStorage.getItem('ecoforms_auto_login') === 'true';
            const autoLoginCheckbox = document.getElementById('auto-login');
            if (autoLoginCheckbox) {
                autoLoginCheckbox.checked = autoLoginEnabled;
            }

            // Carregar configuração de modo outdoor
            const outdoorModeEnabled = localStorage.getItem('outdoor-mode') === 'true';
            const outdoorModeCheckbox = document.getElementById('outdoor-mode');
            if (outdoorModeCheckbox) {
                outdoorModeCheckbox.checked = outdoorModeEnabled;
            }

            console.log('✅ Configurações existentes carregadas:', { autoLoginEnabled, outdoorModeEnabled });
        } catch (error) {
            console.warn('⚠️ Erro ao carregar configurações existentes:', error);
        }
    }

    // Fallback para opções básicas se o JSON falhar
    loadFallbackOptions() {
        const deviceUsageSelect = document.getElementById('device-usage');
        if (deviceUsageSelect) {
            ['Ecoponto 1', 'Ecoponto 2', 'Ecoponto 3'].forEach(value => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value;
                deviceUsageSelect.appendChild(opt);
            });
        }

        const formsSourceSelect = document.getElementById('forms-source');
        if (formsSourceSelect) {
            const opt = document.createElement('option');
            opt.value = 'auto';
            opt.textContent = '🔄 Automático';
            formsSourceSelect.appendChild(opt);
        }

        const sessionTimeoutSelect = document.getElementById('session-timeout');
        if (sessionTimeoutSelect) {
            const opt = document.createElement('option');
            opt.value = '8';
            opt.textContent = '8 horas';
            sessionTimeoutSelect.appendChild(opt);
        }
    }

    /**
     * Reinicia o setup automático sem recarregar a página.
     * Limpa dados parciais de uma tentativa anterior e reexecuta o fluxo completo,
     * preservando o cliente Supabase já inicializado.
     */
    async retrySetup() {
        console.log('🔄 Reiniciando setup automático...');

        // Esconder botão de retry
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) retryBtn.style.display = 'none';

        // Limpar apenas dados parciais de instalação (não o device_config se existir)
        const keysToRemove = Object.keys(localStorage).filter(k =>
            k.startsWith('ecoforms_cache_forms_') ||
            k.startsWith('ecoforms_cache_data_') ||
            k === 'ecoforms_forms_index'
        );
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log(`🧹 ${keysToRemove.length} entradas de cache parcial removidas para retry`);

        // Reiniciar estado interno
        this.availableForms = [];
        this.selectedForms = new Set();
        this.loadingSteps = [];
        this.currentStepIndex = 0;

        // Re-executar setup
        await this.runAutomaticSetup();
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.deviceSetup = new DeviceSetupService();
});