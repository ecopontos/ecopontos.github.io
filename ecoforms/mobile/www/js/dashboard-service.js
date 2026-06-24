/**
 * Serviço de dados para Dashboards
 * Conecta os dashboards ao banco de dados SQLite e Supabase
 */

class DashboardService {
    constructor() {
        this.supabase = null;
        this.sqliteAdapter = null;
        this.tableName = 'suite';
        this.ocupacaoAtualTableName = 'view_ecoponto_caixas_latest';
        this._initPromise = this._initialize();
        this._setupDataSourceLogger();
    }

    /**
     * Configura logger visual para indicar origem dos dados
     */
    _setupDataSourceLogger() {
        // Criar indicador visual no canto da tela
        if (typeof document !== 'undefined' && !document.getElementById('data-source-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'data-source-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 16px;
                border-radius: 8px;
                font-family: 'Poppins', monospace;
                font-size: 12px;
                font-weight: 600;
                z-index: 9999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: none;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }
    }

    /**
     * Log visual de origem dos dados
     */
    _logDataSource(method, isReal, details = '') {
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const indicator = document.getElementById('data-source-indicator');
        
        if (isReal) {
            console.log(`%c✅ DADOS REAIS [${method}]`, 'color: #10b981; font-weight: bold; font-size: 14px', details);
            if (indicator) {
                indicator.style.display = 'flex';
                indicator.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
                indicator.style.color = 'white';
                indicator.innerHTML = `
                    <span style="font-size: 16px;">✅</span>
                    <span>DADOS REAIS</span>
                    <span style="opacity: 0.8; font-size: 10px;">${timestamp}</span>
                `;
            }
        } else {
            console.log(`%c🎭 DADOS MOCKADOS [${method}]`, 'color: #f59e0b; font-weight: bold; font-size: 14px', details);
            if (indicator) {
                indicator.style.display = 'flex';
                indicator.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
                indicator.style.color = 'white';
                indicator.innerHTML = `
                    <span style="font-size: 16px;">🎭</span>
                    <span>DADOS MOCKADOS</span>
                    <span style="opacity: 0.8; font-size: 10px;">${timestamp}</span>
                `;
            }
        }

        // Auto-esconder após 5 segundos
        if (indicator) {
            setTimeout(() => {
                indicator.style.opacity = '0.7';
            }, 5000);
        }
    }

    /**
     * Inicializa o serviço aguardando o DataService e SQLite
     */
    async _initialize() {
        console.log('[DashboardService] Inicializando serviço...');
        
        // Verificar se o SQLite está disponível
        if (window.SQLiteWorkerAdapter) {
            console.log('[DashboardService] Inicializando adaptador SQLite...');
            this.sqliteAdapter = new window.SQLiteWorkerAdapter({
                workerPath: '../js/sqlite-service-worker.js',
                useWorker: true,
                fallbackToDirect: true,
                timeout: 5000
            });
            
            // Configurar eventos
            this.sqliteAdapter.onInitialized = (info) => {
                console.log('[DashboardService] SQLite inicializado:', info);
            };
            
            this.sqliteAdapter.onError = (error) => {
                console.error('[DashboardService] Erro no SQLite:', error);
            };
            
            // Inicializar o adaptador
            await this.sqliteAdapter.initialize();
            console.log('[DashboardService] Adaptador SQLite inicializado');
        } else {
            console.warn('[DashboardService] SQLiteWorkerAdapter não disponível');
        }
        
        // Verificar se o dataService está disponível
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos
        
        while ((!window.dataService || !window.dataService.supabaseClient) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10));
            attempts++;
        }
        
        if (window.dataService && window.dataService.supabaseClient) {
            this.supabase = window.dataService.supabaseClient;
            this.tableName = window.dataService.tableName || 'suite';
            
            // Testar conexão imediatamente (via Storage)
            try {
                const { data, error } = await this.supabase.storage
                    .from('sync-bucket')
                    .list('shared/', { limit: 1 });
                if (error) {
                    console.error('❌ [DEBUG] Erro ao testar conexão com Storage:', error);
                } else {
                    console.log('✅ [DEBUG] Conexão com Storage testada com sucesso');
                }
            } catch (testError) {
                console.error('❌ [DEBUG] Exceção ao testar conexão:', testError);
            }
        } else {
            console.warn('⚠️ [DEBUG] DashboardService: DataService ou supabaseClient não disponíveis após tentativas');
            
            // Tentar usar o supabase diretamente se disponível
            if (window.supabase) {
                this.supabase = window.supabase;
                
                // Testar conexão com Storage
                try {
                    const { data, error } = await this.supabase.storage
                        .from('sync-bucket')
                        .list('shared/', { limit: 1 });
                    if (error) {
                        console.error('❌ [DEBUG] Erro ao testar conexão direta com Storage:', error);
                    } else {
                        console.log('✅ [DEBUG] Conexão direta com Storage testada com sucesso');
                    }
                } catch (testError) {
                    console.error('❌ [DEBUG] Exceção ao testar conexão direta:', testError);
                }
            } else {
                console.error('❌ [DEBUG] Supabase não está disponível em nenhum formato');
            }
        }
    }

    /**
     * Garante que o serviço está inicializado antes de usar
     */
    async _ensureInitialized() {
        console.log('🔒 Garantindo inicialização do DashboardService...');
        console.log('⏳ Aguardando promise de inicialização...');
        await this._initPromise;
        console.log('✅ DashboardService está pronto para uso');
        console.log('🔗 this.supabase está disponível?', !!this.supabase);
    }

    /**
     * Obtém métricas estratégicas para o dashboard estratégico
     */
    async getMetricasEstrategicas(periodo = 7) {
        await this._ensureInitialized();
        
        if (!this.supabase) {
            console.error('❌ Supabase client não está disponível');
            this._logDataSource('getMetricasEstrategicas', false, 'Supabase indisponível');
            return this.getDadosMockadosEstrategicos();
        }

        try {
            // Consulta para obter métricas estratégicas
            // Buscar todos os dados e filtrar no cliente
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .order('id', { ascending: false })
                .limit(500);

            if (error) {
                console.error('Erro ao buscar métricas estratégicas:', error);
                this._logDataSource('getMetricasEstrategicas', false, `Erro: ${error.message}`);
                return this.getDadosMockadosEstrategicos();
            }

            // Aplicar permissões de visualização por Setor/Perfil
            let dadosPermitidos = this._aplicarPermissoes(data);

            // Filtrar dados do período no cliente
            const dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - periodo);
            
            const dadosPeriodo = dadosPermitidos.filter(registro => {
                // Usar criado_em como campo principal de timestamp
                const timestamp = registro.criado_em || registro.created_at || registro.createdAt || registro.timestamp || registro.data_criacao;
                if (!timestamp) return true; // Se não tem timestamp, incluir
                
                const dataRegistro = new Date(timestamp);
                return dataRegistro >= dataInicio;
            });

            // Processar os dados para as métricas
            this._logDataSource('getMetricasEstrategicas', true, `${dadosPermitidos.length} registros processados`);
            return this.processarMetricasEstrategicas(dadosPeriodo.length > 0 ? dadosPeriodo : dadosPermitidos, periodo);
        } catch (error) {
            console.error('Erro ao obter métricas estratégicas:', error);
            this._logDataSource('getMetricasEstrategicas', false, `Exceção: ${error.message}`);
            return this.getDadosMockadosEstrategicos();
        }
    }

    /**
     * Filtra o array de registros baseado nas permissões do usuário atual (Setor e Perfil)
     * @param {Array} dados - Array de registros
     * @returns {Array} Registros filtrados e permitidos
     */
    _aplicarPermissoes(dados) {
        if (!dados || dados.length === 0) return [];
        if (!window.authManager || !window.authManager.isLoggedIn()) return [];
        
        const currentUser = window.authManager.getCurrentUser();
        // Admin vê todos os dados
        if (window.authManager.isAdmin()) return dados;
        
        // Gerente vê dados do seu setor E dados criados por ele
        if (window.authManager.isManager()) {
            const setores = currentUser.setores || [];
            return dados.filter(registro => {
                if (registro.user_id === currentUser.id) return true;
                if (registro.setor_id && setores.includes(registro.setor_id)) return true;
                return false;
            });
        }
        
        // Operadores veem apenas dados criados por eles mesmos
        return dados.filter(registro => registro.user_id === currentUser.id);
    }

    /**
     * Processa os dados para métricas estratégicas
     */
    processarMetricasEstrategicas(dados, periodo) {
        if (!dados || dados.length === 0) {
            return this.getDadosMockadosEstrategicos();
        }

        let totalAtendimentos = 0;
        let totalResiduos = 0;
        let totalCaixas = 0;
        let totalCaixasPreenchidas = 0;
        let ecopontosUnicos = new Set();

        dados.forEach(registro => {
            if (registro.dados) {
                try {
                    // Parse do JSON string
                    const dadosObj = typeof registro.dados === 'string' 
                        ? JSON.parse(registro.dados) 
                        : registro.dados;
                    
                    // Contar atendimentos
                    totalAtendimentos++;
                    
                    // Processar dados de caixas (ecopontoCaixasForm)
                    if (dadosObj.data && dadosObj.data.caixas_list) {
                        const caixasList = dadosObj.data.caixas_list;
                        
                        // Somar caixas totais e preenchidas
                        if (caixasList.resumo) {
                            totalCaixas += caixasList.resumo.total_caixas || 0;
                            totalCaixasPreenchidas += caixasList.resumo.caixas_preenchidas || 0;
                        }
                        
                        // Adicionar ecoponto único
                        if (dadosObj.data.ecoponto) {
                            ecopontosUnicos.add(dadosObj.data.ecoponto);
                        }
                    }
                    
                    // Somar volume de resíduos (se disponível em outros formulários)
                    if (dadosObj.volume_residuos) {
                        totalResiduos += parseFloat(dadosObj.volume_residuos) || 0;
                    }
                } catch (e) {
                    console.warn('Erro ao processar registro:', e);
                }
            }
        });

        // Calcular taxa de ocupação média (se disponível nos dados)
        const taxaOcupacao = this.calcularTaxaOcupacaoMedia(dados);

        return {
            totalAtendimentos: totalAtendimentos.toLocaleString('pt-BR'),
            totalResiduos: totalResiduos.toFixed(1),
            totalEcopontos: ecopontosUnicos.size,
            taxaOcupacao: `${Math.round(taxaOcupacao * 100)}%`,
            totalCaixas,
            totalCaixasPreenchidas,
            dadosOriginais: dados
        };
    }

    /**
     * Calcula a taxa média de ocupação a partir dos dados
     */
    calcularTaxaOcupacaoMedia(dados) {
        let totalOcupacao = 0;
        let count = 0;

        dados.forEach(registro => {
            if (registro.dados) {
                try {
                    // Parse do JSON string
                    const dadosObj = typeof registro.dados === 'string' 
                        ? JSON.parse(registro.dados) 
                        : registro.dados;
                    
                    // Processar ocupação das caixas do ecopontoCaixasForm
                    const caixasList = dadosObj.caixas_list || (dadosObj.data && dadosObj.data.caixas_list);
                    if (caixasList && caixasList.ocupacao) {
                        const ocupacao = caixasList.ocupacao;
                        
                        // Iterar sobre as caixas (1, 2, 3, 4, ...)
                        Object.values(ocupacao).forEach(nivel => {
                            if (nivel && nivel !== '') {
                                const nivelNum = parseFloat(nivel);
                                if (!isNaN(nivelNum)) {
                                    totalOcupacao += nivelNum;
                                    count++;
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Erro ao calcular ocupação:', e);
                }
            }
        });

        return count > 0 ? totalOcupacao / 100 : 0.68; // Converter de % para decimal
    }

    /**
     * Obtém dados para gráficos do dashboard estratégico
     */
    async getDadosGraficosEstrategicos(periodo = 30) {
        await this._ensureInitialized();
        
        if (!this.supabase) {
            return this.getDadosGraficosMockados();
        }

        try {
            // Consulta para obter dados para gráficos
            // Buscar todos os dados e filtrar no cliente
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .order('id', { ascending: false })
                .limit(500);

            if (error) {
                console.error('Erro ao buscar dados para gráficos:', error);
                return this.getDadosGraficosMockados();
            }

            // Aplicar filtros de permissao antes das operacoes de tempo
            let dadosPermitidos = this._aplicarPermissoes(data);

            // Filtrar dados do período no cliente
            const dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - periodo);
            
            const dadosPeriodo = dadosPermitidos.filter(registro => {
                // Usar criado_em como campo principal de timestamp
                const timestamp = registro.criado_em || registro.created_at || registro.createdAt || registro.timestamp || registro.data_criacao;
                if (!timestamp) return true; // Se não tem timestamp, incluir
                
                const dataRegistro = new Date(timestamp);
                return dataRegistro >= dataInicio;
            });

            return this.processarDadosGraficos(dadosPeriodo.length > 0 ? dadosPeriodo : dadosPermitidos, periodo);
        } catch (error) {
            console.error('Erro ao obter dados para gráficos:', error);
            return this.getDadosGraficosMockados();
        }
    }

    /**
     * Processa dados para os gráficos
     */
    processarDadosGraficos(dados, periodo) {
        if (!dados || dados.length === 0) {
            return this.getDadosGraficosMockados();
        }

        // Processar dados para diferentes gráficos
        const dadosAtendimentos = this.processarDadosAtendimentos(dados, periodo);
        const dadosResiduos = this.processarDadosResiduos(dados);
        const dadosBairro = this.processarDadosBairro(dados);
        const dadosStatus = this.processarDadosStatus(dados);

        return {
            atendimentos: dadosAtendimentos,
            residuos: dadosResiduos,
            bairro: dadosBairro,
            status: dadosStatus
        };
    }

    /**
     * Processa dados para gráfico de atendimentos
     */
    processarDadosAtendimentos(dados, periodo) {
        // Agrupar dados por período (últimos 12 meses, por exemplo)
        const labels = [];
        const data = [];
        
        // Para simplificação, vamos retornar dados mensais para os últimos 12 meses
        for (let i = 11; i >= 0; i--) {
            const mes = new Date();
            mes.setMonth(mes.getMonth() - i);
            labels.push(mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
            
            // Contar atendimentos para este mês
            const atendimentosMes = dados.filter(registro => {
                // Usar criado_em como campo principal de timestamp
                const timestamp = registro.criado_em || registro.created_at || registro.createdAt || registro.timestamp || registro.data_criacao;
                if (!timestamp) return false;
                
                const dataRegistro = new Date(timestamp);
                return dataRegistro.getMonth() === mes.getMonth() && 
                       dataRegistro.getFullYear() === mes.getFullYear();
            }).length;
            
            data.push(atendimentosMes);
        }

        return {
            labels: labels,
            datasets: [{
                label: 'Atendimentos',
                data: data,
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.08)',
                tension: 0.4,
                fill: true,
                borderWidth: 3
            }]
        };
    }

    /**
     * Processa dados para gráfico de resíduos
     */
    processarDadosResiduos(dados) {
        // Contador de caixas por ID (1-7 representam tipos de resíduos)
        const contadores = {
            '1': 0, // Exemplo: caixa 1
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
            '6': 0,
            '7': 0
        };

        // Contar ocorrências de caixas com ocupação nos dados
        dados.forEach(registro => {
            if (registro.dados) {
                try {
                    const dadosObj = typeof registro.dados === 'string' 
                        ? JSON.parse(registro.dados) 
                        : registro.dados;
                    
                    const caixasList = dadosObj.caixas_list || (dadosObj.data && dadosObj.data.caixas_list);
                    if (caixasList && caixasList.ocupacao) {
                        const ocupacao = caixasList.ocupacao;
                        
                        // Contar cada caixa que tem ocupação
                        Object.entries(ocupacao).forEach(([caixaId, nivel]) => {
                            if (nivel && nivel !== '' && contadores[caixaId] !== undefined) {
                                contadores[caixaId]++;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Erro ao processar resíduos:', e);
                }
            }
        });

        return {
            labels: ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Caixa 4', 'Caixa 5', 'Caixa 6', 'Caixa 7'],
            datasets: [{
                data: [
                    contadores['1'],
                    contadores['2'],
                    contadores['3'],
                    contadores['4'],
                    contadores['5'],
                    contadores['6'],
                    contadores['7']
                ],
                backgroundColor: [
                    '#6b7280', '#92400e', '#16a34a', 
                    '#0ea5e9', '#374151', '#f59e0b', '#06b6d4'
                ],
                borderWidth: 0
            }]
        };
    }

    /**
     * Processa dados para gráfico por bairro
     */
    processarDadosBairro(dados) {
        const ecopontos = {};

        dados.forEach(registro => {
            if (registro.dados) {
                try {
                    const dadosObj = typeof registro.dados === 'string' 
                        ? JSON.parse(registro.dados) 
                        : registro.dados;
                    
                    // Extrair nome do ecoponto
                    const ecoponto = dadosObj.ecoponto || (dadosObj.data && dadosObj.data.ecoponto);
                    if (ecoponto) {
                        ecopontos[ecoponto] = (ecopontos[ecoponto] || 0) + 1;
                    }
                } catch (e) {
                    console.warn('Erro ao processar ecoponto:', e);
                }
            }
        });

        const ecopontosOrdenados = Object.entries(ecopontos)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6); // Pegar os 6 ecopontos com mais registros

        return {
            labels: ecopontosOrdenados.map(([ecoponto]) => ecoponto),
            datasets: [{
                data: ecopontosOrdenados.map(([, count]) => count),
                backgroundColor: [
                    '#0ea5e9', '#38bdf8', '#7dd3fc', 
                    '#bae6fd', '#e0f2fe', '#f0f9ff'
                ],
                borderWidth: 0
            }]
        };
    }

    /**
     * Processa dados para gráfico de status
     */
    processarDadosStatus(dados) {
        // Analisar status das caixas baseado nos dados reais
        const status = { critico: 0, alerta: 0, normal: 0 };

        dados.forEach(registro => {
            if (registro.dados) {
                try {
                    const dadosObj = typeof registro.dados === 'string' 
                        ? JSON.parse(registro.dados) 
                        : registro.dados;
                    
                    const caixasList = dadosObj.caixas_list || (dadosObj.data && dadosObj.data.caixas_list);
                    if (caixasList && caixasList.resumo) {
                        const resumo = caixasList.resumo;
                        
                        // Caixas críticas (>= 80%)
                        status.critico += resumo.caixas_criticas || 0;
                        
                        // Caixas em alerta (50-79%)
                        const totalPreenchidas = resumo.caixas_preenchidas || 0;
                        const criticas = resumo.caixas_criticas || 0;
                        status.alerta += Math.max(0, totalPreenchidas - criticas);
                        
                        // Caixas normais (< 50%)
                        const totalCaixas = resumo.total_caixas || 7;
                        status.normal += Math.max(0, totalCaixas - totalPreenchidas);
                    }
                } catch (e) {
                    console.warn('Erro ao processar status:', e);
                }
            }
        });

        // Se não houver dados, retornar valores padrão
        if (status.critico === 0 && status.alerta === 0 && status.normal === 0) {
            status.normal = 15;
            status.alerta = 8;
            status.critico = 2;
        }

        return {
            labels: ['Normal', 'Alerta', 'Crítico'],
            datasets: [{
                data: [status.normal, status.alerta, status.critico],
                backgroundColor: ['#16a34a', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        };
    }

    /**
     * Obtém métricas operacionais para o dashboard operacional
     */
    async getMetricasOperacionais() {
        await this._ensureInitialized();
        
        // Tentar obter do SQLite primeiro
        if (this.sqliteAdapter && this.sqliteAdapter.isReady()) {
            try {
                console.log('[DashboardService] Obtendo métricas operacionais do SQLite...');
                const data = await this.sqliteAdapter.getByType('ecopontoCaixasForm', {
                    limit: 100,
                    orderBy: 'created_at',
                    orderDirection: 'DESC'
                });
                
                if (data && data.length > 0) {
                    this._logDataSource('getMetricasOperacionais', true, `${data.length} registros do SQLite`);
                    const resultado = this.processarMetricasOperacionaisView(data);
                    return resultado;
                } else {
                    console.warn('[DashboardService] SQLite não retornou dados, tentando Supabase');
                }
            } catch (error) {
                console.error('[DashboardService] Erro ao obter do SQLite:', error);
            }
        }
        
        // Fallback para Supabase
        if (!this.supabase) {
            console.error('❌ [DEBUG] Supabase client não está disponível em getMetricasOperacionais');
            this._logDataSource('getMetricasOperacionais', false, 'Supabase indisponível');
            return this.getDadosMockadosOperacionais();
        }

        try {
            // Consulta direta à view view_ecoponto_caixas_latest
            const { data, error } = await this.supabase
                .from(this.ocupacaoAtualTableName)
                .select('*');

            if (error) {
                console.error('❌ [DEBUG] Erro ao buscar métricas operacionais da view:', error);
                this._logDataSource('getMetricasOperacionais', false, `Erro na view: ${error.message}`);
                return this.getDadosMockadosOperacionais();
            }

            if (!data || data.length === 0) {
                console.warn('⚠️ [DEBUG] View retornou dados vazios ou nulos');
                this._logDataSource('getMetricasOperacionais', false, 'View sem dados');
                return this.getDadosMockadosOperacionais();
            }
            
            // Processar dados da view
            this._logDataSource('getMetricasOperacionais', true, `${data.length} registros de ${this.ocupacaoAtualTableName}`);
            const resultado = this.processarMetricasOperacionaisView(data);
            return resultado;
        } catch (error) {
            console.error('❌ [DEBUG] Exceção ao obter métricas operacionais:', error);
            console.error('📋 [DEBUG] Stack trace:', error.stack);
            this._logDataSource('getMetricasOperacionais', false, `Exceção: ${error.message}`);
            return this.getDadosMockadosOperacionais();
        }
    }

    /**
     * Processa os dados para métricas operacionais
     */
    processarMetricasOperacionais(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosMockadosOperacionais();
        }

        let atendimentosHoje = dados.length;
        let caixasCriticas = 0;
        let ultimoAtendimento = '';
        let ecopontosUnicos = new Set();

        dados.forEach(registro => {
            // Usar criado_em como campo principal de timestamp
            const timestamp = registro.criado_em || registro.created_at || registro.createdAt || registro.timestamp || registro.data_criacao;
            if (timestamp) {
                // Atualizar último atendimento
                if (!ultimoAtendimento || timestamp > ultimoAtendimento) {
                    ultimoAtendimento = timestamp;
                }
            }
            
            // Processar dados das caixas
            if (registro.dados) {
                try {
                    const dadosObj = typeof registro.dados === 'string'
                        ? JSON.parse(registro.dados)
                        : registro.dados;
                    
                    // Verificar se é formulário de caixas
                    if (dadosObj.caixas_list || (dadosObj.data && dadosObj.data.caixas_list)) {
                        const caixasList = dadosObj.caixas_list || dadosObj.data.caixas_list;
                        
                        // Contar caixas críticas do resumo
                        if (caixasList.resumo && caixasList.resumo.caixas_criticas) {
                            caixasCriticas += caixasList.resumo.caixas_criticas;
                        }
                        
                        // Adicionar ecoponto único
                        const ecoponto = dadosObj.ecoponto || (dadosObj.data && dadosObj.data.ecoponto);
                        if (ecoponto) {
                            ecopontosUnicos.add(ecoponto);
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao processar métricas operacionais:', e);
                }
            }
        });

        // Formatar último atendimento
        if (ultimoAtendimento) {
            const data = new Date(ultimoAtendimento);
            ultimoAtendimento = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        return {
            ecopontosOperacionais: ecopontosUnicos.size || 1,
            atendimentosHoje: atendimentosHoje,
            caixasCriticas: caixasCriticas,
            ultimoAtendimento: ultimoAtendimento || 'N/A'
        };
    }

    /**
     * Processa os dados consolidados para métricas operacionais
     */
    processarMetricasOperacionaisConsolidadas(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosMockadosOperacionais();
        }

        let totalEcopontos = dados.length;
        let caixasCriticas = 0;
        let ultimoAtendimento = '';

        dados.forEach(registro => {
            // Atualizar último atendimento com o updated_at do registro consolidado
            if (registro.updated_at) {
                if (!ultimoAtendimento || registro.updated_at > ultimoAtendimento) {
                    ultimoAtendimento = registro.updated_at;
                }
            }
            
            // Contar caixas críticas a partir do resumo consolidado
            if (registro.resumo && registro.resumo.caixas_criticas) {
                caixasCriticas += registro.resumo.caixas_criticas;
            }
        });

        // Formatar último atendimento
        if (ultimoAtendimento) {
            const data = new Date(ultimoAtendimento);
            ultimoAtendimento = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        return {
            ecopontosOperacionais: totalEcopontos,
            atendimentosHoje: totalEcopontos, // Em tempo real, todos os ecopontos representam atividade
            caixasCriticas: caixasCriticas,
            ultimoAtendimento: ultimoAtendimento || 'N/A'
        };
    }

    /**
     * Processa os dados da view_ecoponto_caixas_latest para métricas operacionais
     */
    processarMetricasOperacionaisView(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosMockadosOperacionais();
        }

        // Agrupar dados por ecoponto para obter métricas consolidadas
        const ecopontosMap = {};
        let ultimoAtendimento = '';

        dados.forEach(registro => {
            const ecopontoNome = registro.ecoponto || registro.nome_ecoponto || `Ecoponto ${registro.ecoponto_id || registro.id}`;
            
            if (!ecopontosMap[ecopontoNome]) {
                ecopontosMap[ecopontoNome] = {
                    nome: ecopontoNome,
                    caixasCriticas: 0,
                    timestamp: null
                };
            }

            // Contar caixas críticas (ocupação >= 80%)
            if (registro.ocupacao !== undefined && registro.ocupacao >= 80) {
                ecopontosMap[ecopontoNome].caixasCriticas++;
            }

            // Atualizar último atendimento
            const registroTimestamp = registro.timestamp || registro.created_at || registro.updated_at;
            if (registroTimestamp) {
                if (!ultimoAtendimento || registroTimestamp > ultimoAtendimento) {
                    ultimoAtendimento = registroTimestamp;
                }
            }
        });

        const ecopontosUnicos = Object.keys(ecopontosMap);
        const totalCaixasCriticas = Object.values(ecopontosMap).reduce((sum, ecoponto) => sum + ecoponto.caixasCriticas, 0);

        // Formatar último atendimento
        if (ultimoAtendimento) {
            const data = new Date(ultimoAtendimento);
            ultimoAtendimento = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        return {
            ecopontosOperacionais: ecopontosUnicos.length,
            atendimentosHoje: dados.length,
            caixasCriticas: totalCaixasCriticas,
            ultimoAtendimento: ultimoAtendimento || 'N/A'
        };
    }

    /**
     * Obtém dados para gráfico de ocupação média por tipo
     */
    async getDadosOcupacaoMedia() {
        await this._ensureInitialized();
            hasSupabase: !!this.supabase,
            tableName: this.ocupacaoAtualTableName
        });
        
        if (!this.supabase) {
            console.error('❌ [DEBUG] Supabase client não está disponível em getDadosOcupacaoMedia');
            this._logDataSource('getDadosOcupacaoMedia', false, 'Supabase indisponível');
            return this.getDadosGraficoOcupacaoMockados();
        }

        try {
            // Consulta direta à view view_ecoponto_caixas_latest
            const { data, error } = await this.supabase
                .from(this.ocupacaoAtualTableName)
                .select('*');
                hasData: !!data,
                dataLength: data ? data.length : 0,
                hasError: !!error,
                error: error
            });

            if (error) {
                console.error('❌ [DEBUG] Erro ao buscar dados de ocupação da view:', error);
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                this._logDataSource('getDadosOcupacaoMedia', false, `Erro na view: ${error.message}`);
                return this.getDadosGraficoOcupacaoMockados();
            }

            if (!data || data.length === 0) {
                console.warn('⚠️ [DEBUG] View retornou dados vazios para ocupação média');
                this._logDataSource('getDadosOcupacaoMedia', false, 'View sem dados');
                return this.getDadosGraficoOcupacaoMockados();
            }
            
            this._logDataSource('getDadosOcupacaoMedia', true, `${data.length} registros de ocupação`);
            const resultado = this.processarDadosOcupacaoMediaView(data);
            return resultado;
        } catch (error) {
            console.error('❌ [DEBUG] Exceção ao obter dados de ocupação média:', error);
            console.error('📋 [DEBUG] Stack trace:', error.stack);
            this._logDataSource('getDadosOcupacaoMedia', false, `Exceção: ${error.message}`);
            return this.getDadosGraficoOcupacaoMockados();
        }
    }

    /**
     * Processa dados para gráfico de ocupação média
     */
    processarDadosOcupacaoMedia(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosGraficoOcupacaoMockados();
        }

        const tiposCaixas = ['entulho', 'madeira', 'poda', 'reciclavel', 'rejeito', 'sucata', 'vidro'];
        const somas = {};
        const contagens = {};

        // Inicializar somas e contagens
        tiposCaixas.forEach(tipo => {
            somas[tipo] = 0;
            contagens[tipo] = 0;
        });

        // Calcular somas e contagens
        dados.forEach(registro => {
            if (registro.dados) {
                tiposCaixas.forEach(tipo => {
                    const ocupacao = parseFloat(registro.dados[`${tipo}_ocupacao`]);
                    if (!isNaN(ocupacao)) {
                        somas[tipo] += ocupacao;
                        contagens[tipo]++;
                    }
                });
            }
        });

        // Calcular médias
        const medias = tiposCaixas.map(tipo => {
            return contagens[tipo] > 0 ? (somas[tipo] / contagens[tipo]) : 0;
        });

        return {
            labels: ['Entulho', 'Madeira', 'Poda', 'Reciclável', 'Rejeito', 'Sucata', 'Vidro'],
            datasets: [{
                label: 'Nível Médio de Ocupação',
                data: medias,
                backgroundColor: [
                    'rgba(107, 114, 128, 0.8)',
                    'rgba(146, 64, 14, 0.8)',
                    'rgba(22, 163, 74, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(55, 65, 81, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(6, 182, 212, 0.8)'
                ],
                borderColor: [
                    'rgb(107, 114, 128)',
                    'rgb(146, 64, 14)',
                    'rgb(22, 163, 74)',
                    'rgb(59, 130, 246)',
                    'rgb(5, 65, 81)',
                    'rgb(245, 158, 11)',
                    'rgb(6, 182, 212)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        };
    }

    /**
     * Processa dados consolidados para gráfico de ocupação média
     */
    processarDadosOcupacaoMediaConsolidada(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosGraficoOcupacaoMockados();
        }

        // Contadores para cada tipo de caixa (1 a 7)
        const somas = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
        const contagens = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
        
        // Nomes dos tipos de caixas para exibição
        const nomesCaixas = {
            '1': 'Entulho',
            '2': 'Madeira',
            '3': 'Poda',
            '4': 'Reciclável',
            '5': 'Rejeito',
            '6': 'Sucata',
            '7': 'Vidro'
        };

        // Processar os dados consolidados
        dados.forEach(registro => {
            if (registro.ocupacao) {
                // Percorrer cada caixa no objeto de ocupação
                Object.entries(registro.ocupacao).forEach(([caixaId, nivel]) => {
                    if (nivel !== null && nivel !== undefined && nivel !== '') {
                        const nivelNum = parseFloat(nivel);
                        if (!isNaN(nivelNum)) {
                            somas[caixaId] += nivelNum;
                            contagens[caixaId]++;
                        }
                    }
                });
            }
        });

        // Calcular médias
        const labels = [];
        const medias = [];
        
        for (let i = 1; i <= 7; i++) {
            const caixaId = i.toString();
            labels.push(nomesCaixas[caixaId] || `Caixa ${caixaId}`);
            medias.push(contagens[caixaId] > 0 ? (somas[caixaId] / contagens[caixaId]) : 0);
        }

        return {
            labels: labels,
            datasets: [{
                label: 'Nível Médio de Ocupação',
                data: medias,
                backgroundColor: [
                    'rgba(107, 114, 128, 0.8)',
                    'rgba(146, 64, 14, 0.8)',
                    'rgba(22, 163, 74, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(55, 65, 81, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(6, 182, 212, 0.8)'
                ],
                borderColor: [
                    'rgb(107, 114, 128)',
                    'rgb(146, 64, 14)',
                    'rgb(2, 163, 74)',
                    'rgb(59, 130, 246)',
                    'rgb(5, 65, 81)',
                    'rgb(245, 158, 11)',
                    'rgb(6, 182, 212)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        };
    }

    /**
     * Processa dados da view_ecoponto_caixas_latest para gráfico de ocupação média
     */
    processarDadosOcupacaoMediaView(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosGraficoOcupacaoMockados();
        }

        // Contadores para cada tipo de caixa (1 a 7)
        const somas = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
        const contagens = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 };
        
        // Nomes dos tipos de caixas para exibição
        const nomesCaixas = {
            '1': 'Entulho',
            '2': 'Madeira',
            '3': 'Poda',
            '4': 'Reciclável',
            '5': 'Rejeito',
            '6': 'Sucata',
            '7': 'Vidro'
        };

        // Processar os dados da view
        dados.forEach(registro => {
            // Usar o campo 'caixa' como ID da caixa e 'ocupacao' como valor
            const caixaId = registro.caixa ? registro.caixa.toString() : null;
            const ocupacao = registro.ocupacao !== undefined ? registro.ocupacao : registro.ocupacao_nova;
            
            if (caixaId && ocupacao !== undefined && ocupacao !== null && ocupacao !== '') {
                const nivelNum = parseFloat(ocupacao);
                if (!isNaN(nivelNum)) {
                    somas[caixaId] += nivelNum;
                    contagens[caixaId]++;
                }
            }
        });

        // Calcular médias
        const labels = [];
        const medias = [];
        
        for (let i = 1; i <= 7; i++) {
            const caixaId = i.toString();
            labels.push(nomesCaixas[caixaId] || `Caixa ${caixaId}`);
            medias.push(contagens[caixaId] > 0 ? (somas[caixaId] / contagens[caixaId]) : 0);
        }

        return {
            labels: labels,
            datasets: [{
                label: 'Nível Médio de Ocupação',
                data: medias,
                backgroundColor: [
                    'rgba(107, 114, 128, 0.8)',
                    'rgba(146, 64, 14, 0.8)',
                    'rgba(22, 163, 74, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(55, 65, 81, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(6, 182, 212, 0.8)'
                ],
                borderColor: [
                    'rgb(107, 114, 128)',
                    'rgb(146, 64, 14)',
                    'rgb(22, 163, 74)',
                    'rgb(59, 130, 246)',
                    'rgb(5, 65, 81)',
                    'rgb(245, 158, 11)',
                    'rgb(6, 182, 212)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        };
    }

    /**
     * Obtém dados detalhados por ecoponto para o dashboard operacional
     */
    async getDadosEcopontosDetalhados() {
        await this._ensureInitialized();
            hasSupabase: !!this.supabase,
            tableName: this.ocupacaoAtualTableName
        });
        
        if (!this.supabase) {
            console.error('❌ [DEBUG] Supabase client não está disponível em getDadosEcopontosDetalhados');
            this._logDataSource('getDadosEcopontosDetalhados', false, 'Supabase indisponível');
            return this.getDadosEcopontosMockados();
        }

        try {
            // Consulta direta à view view_ecoponto_caixas_latest
            const { data, error } = await this.supabase
                .from(this.ocupacaoAtualTableName)
                .select('*');
                hasData: !!data,
                dataLength: data ? data.length : 0,
                hasError: !!error,
                error: error
            });

            if (error) {
                console.error('❌ [DEBUG] Erro ao buscar dados detalhados da view:', error);
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                this._logDataSource('getDadosEcopontosDetalhados', false, `Erro na view: ${error.message}`);
                return this.getDadosEcopontosMockados();
            }

            if (!data || data.length === 0) {
                console.warn('⚠️ [DEBUG] View retornou dados vazios para ecopontos');
                this._logDataSource('getDadosEcopontosDetalhados', false, 'View sem dados');
                return this.getDadosEcopontosMockados();
            }
            
            const resultado = this.processarDadosEcopontosDetalhadosView(data);
            return resultado;
        } catch (error) {
            console.error('❌ [DEBUG] Exceção ao obter dados detalhados dos ecopontos:', error);
            console.error('📋 [DEBUG] Stack trace:', error.stack);
            this._logDataSource('getDadosEcopontosDetalhados', false, `Exceção: ${error.message}`);
            return this.getDadosEcopontosMockados();
        }
    }

    /**
     * Processa dados detalhados por ecoponto
     */
    processarDadosEcopontosDetalhados(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosEcopontosMockados();
        }

        // Agrupar dados por ecoponto
        const ecopontosMap = {};

        dados.forEach(registro => {
            if (registro.dados) {
                const nomeEcoponto = registro.dados.ecoponto_nome ||
                                   registro.dados.nome ||
                                   `Ecoponto ${Object.keys(ecopontosMap).length + 1}`;
                
                if (!ecopontosMap[nomeEcoponto]) {
                    ecopontosMap[nomeEcoponto] = {
                        nome: nomeEcoponto,
                        entulho: 0, madeira: 0, poda: 0, reciclavel: 0, rejeito: 0, sucata: 0, vidro: 0,
                        contagem: 0
                    };
                }

                // Acumular ocupações
                const tipos = ['entulho', 'madeira', 'poda', 'reciclavel', 'rejeito', 'sucata', 'vidro'];
                tipos.forEach(tipo => {
                    const ocupacao = parseFloat(registro.dados[`${tipo}_ocupacao`]) || 0;
                    ecopontosMap[nomeEcoponto][tipo] = Math.max(
                        ecopontosMap[nomeEcoponto][tipo],
                        ocupacao
                    );
                });
                
                ecopontosMap[nomeEcoponto].contagem++;
            }
        });

        // Converter para array e limitar a 3 ecopontos principais
        const ecopontosArray = Object.values(ecopontosMap)
            .sort((a, b) => b.contagem - a.contagem)
            .slice(0, 3);

        return ecopontosArray.map(ecoponto => {
            const niveis = [
                ecoponto.entulho, ecoponto.madeira, ecoponto.poda,
                ecoponto.reciclavel, ecoponto.rejeito, ecoponto.sucata, ecoponto.vidro
            ];
            
            // Determinar status baseado na média de ocupação
            const mediaOcupacao = niveis.reduce((sum, val) => sum + val, 0) / niveis.length;
            let status = 'low';
            if (mediaOcupacao > 70) status = 'high';
            else if (mediaOcupacao > 40) status = 'medium';

            return {
                nome: ecoponto.nome,
                status: status,
                ocupacoes: {
                    entulho: ecoponto.entulho,
                    madeira: ecoponto.madeira,
                    poda: ecoponto.poda,
                    reciclavel: ecoponto.reciclavel,
                    rejeito: ecoponto.rejeito,
                    sucata: ecoponto.sucata,
                    vidro: ecoponto.vidro
                }
            };
        });
    }

    /**
     * Processa dados consolidados detalhados por ecoponto
     */
    processarDadosEcopontosDetalhadosConsolidados(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosEcopontosMockados();
        }

        // Converter dados consolidados para o formato esperado pelos dashboards
        const ecopontosArray = dados.map(registro => {
            // Mapear IDs de caixas para nomes amigáveis
            const nomesCaixas = {
                '1': 'entulho',
                '2': 'madeira',
                '3': 'poda',
                '4': 'reciclavel',
                '5': 'rejeito',
                '6': 'sucata',
                '7': 'vidro'
            };

            // Criar objeto de ocupações com base no JSON de ocupação
            const ocupacoes = {};
            Object.entries(nomesCaixas).forEach(([id, nome]) => {
                ocupacoes[nome] = parseFloat(registro.ocupacao[id] || 0);
            });

            // Calcular status com base na média de ocupação
            const niveis = Object.values(ocupacoes);
            const mediaOcupacao = niveis.reduce((sum, val) => sum + val, 0) / niveis.length;
            let status = 'low';
            if (mediaOcupacao > 70) status = 'high';
            else if (mediaOcupacao > 40) status = 'medium';

            return {
                nome: registro.nome_ecoponto || registro.ecoponto_id || `Ecoponto ${registro.ecoponto_id}`,
                status: status,
                ocupacoes: ocupacoes
            };
        });

        // Ordenar por status (priorizando os com status mais crítico) e depois limitar a 3
        return ecopontosArray
            .sort((a, b) => {
                const statusOrder = { high: 3, medium: 2, low: 1 };
                return statusOrder[b.status] - statusOrder[a.status];
            })
            .slice(0, 3);
    }

    /**
     * Processa dados detalhados da view_ecoponto_caixas_latest por ecoponto
     */
    processarDadosEcopontosDetalhadosView(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosEcopontosMockados();
        }

        // Agrupar dados por ecoponto
        const ecopontosMap = {};

        dados.forEach(registro => {
            const nomeEcoponto = registro.ecoponto || registro.nome_ecoponto || `Ecoponto ${registro.ecoponto_id || registro.id}`;
            
            if (!ecopontosMap[nomeEcoponto]) {
                ecopontosMap[nomeEcoponto] = {
                    nome: nomeEcoponto,
                    ocupacoes: {
                        entulho: 0,
                        madeira: 0,
                        poda: 0,
                        reciclavel: 0,
                        rejeito: 0,
                        sucata: 0,
                        vidro: 0
                    }
                };
            }

            // Mapear IDs de caixas para nomes amigáveis
            const nomesCaixas = {
                '1': 'entulho',
                '2': 'madeira',
                '3': 'poda',
                '4': 'reciclavel',
                '5': 'rejeito',
                '6': 'sucata',
                '7': 'vidro'
            };

            // Atualizar ocupação da caixa específica
            const caixaId = registro.caixa ? registro.caixa.toString() : null;
            if (caixaId && nomesCaixas[caixaId]) {
                const nomeTipo = nomesCaixas[caixaId];
                const ocupacao = registro.ocupacao !== undefined ? registro.ocupacao : (registro.ocupacao_nova || 0);
                ecopontosMap[nomeEcoponto].ocupacoes[nomeTipo] = parseFloat(ocupacao) || 0;
            }
        });

        // Converter para array e calcular status
        const ecopontosArray = Object.values(ecopontosMap).map(ecoponto => {
            // Calcular status com base na média de ocupação
            const niveis = Object.values(ecoponto.ocupacoes);
            const mediaOcupacao = niveis.reduce((sum, val) => sum + val, 0) / niveis.length;
            let status = 'low';
            if (mediaOcupacao > 70) status = 'high';
            else if (mediaOcupacao > 40) status = 'medium';

            return {
                nome: ecoponto.nome,
                status: status,
                ocupacoes: ecoponto.ocupacoes
            };
        });

        // Ordenar por status (priorizando os com status mais crítico) e depois limitar a 3
        return ecopontosArray
            .sort((a, b) => {
                const statusOrder = { high: 3, medium: 2, low: 1 };
                return statusOrder[b.status] - statusOrder[a.status];
            })
            .slice(0, 3);
    }

    /**
     * Obtém dados consolidados por tipo de caixa (via Storage)
     */
    async getDadosConsolidadosCaixas() {
        console.log('🔍 Iniciando busca de dados consolidados de caixas...');
        await this._ensureInitialized();
        
        if (!this.supabase) {
            console.error('❌ Supabase client não está disponível');
            console.log('📋 this.supabase existe?', !!this.supabase);
            console.log('📋 this está inicializado?', this.supabase !== null);
            return this.getDadosMockadosEstrategicos();
        }

        try {
            // Buscar do Storage em vez de view direta
            console.log('📡 Buscando dados de caixas no Storage (shared/ecoponto_caixas.json)...');
            const { data: fileData, error: storageError } = await this.supabase
                .storage
                .from('sync-bucket')
                .download('shared/ecoponto_caixas.json');

            if (storageError) {
                console.error('❌ Erro ao buscar dados de caixas do Storage:', storageError);
                console.log('🔄 Usando dados mockados...');
                return this.getDadosMockadosEstrategicos();
            }

            const text = await fileData.text();
            const snapshot = JSON.parse(text);
            const data = snapshot.data || snapshot.caixas || snapshot;
            
            console.log('✅ Dados consolidados de caixas recebidos:', Array.isArray(data) ? data.length : 'objeto', 'registros');

            // Processar dados para métricas consolidadas
            const resultado = this.processarDadosConsolidadosCaixas(Array.isArray(data) ? data : []);
            console.log('📊 Dados consolidados de caixas processados com sucesso');
            return resultado;
        } catch (error) {
            console.error('❌ Erro ao obter dados consolidados de caixas:', error);
            console.error(' stack:', error.stack);
            return this.getDadosMockadosEstrategicos();
        }
    }

    /**
     * Processa dados consolidados da view_ecoponto_caixas_latest
     */
    processarDadosConsolidadosCaixas(dados) {
        console.log('🔍 Iniciando processamento de dados consolidados de caixas...');
        console.log('📊 Total de registros recebidos:', dados.length);
        
        if (!dados || dados.length === 0) {
            console.log('⚠️ Nenhum dado recebido, usando dados mockados');
            return this.getDadosMockadosEstrategicos();
        }

        // Mapear tipos de caixas para nomes amigáveis
        const tiposCaixas = {
            '1': 'Entulho',
            '2': 'Madeira',
            '3': 'Poda',
            '4': 'Reciclável',
            '5': 'Rejeito',
            '6': 'Sucata',
            '7': 'Vidro'
        };

        // Agrupar dados por ecoponto
        const ecopontosMap = {};
        dados.forEach((registro, index) => {
            const nomeEcoponto = registro.ecoponto || registro.nome_ecoponto || `Ecoponto ${index + 1}`;
            
            if (!ecopontosMap[nomeEcoponto]) {
                ecopontosMap[nomeEcoponto] = {
                    nome: nomeEcoponto,
                    totalRegistros: 0,
                    caixas: {
                        '1': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '2': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '3': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '4': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '5': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '6': { ocupacoes: [], media: 0, ultimaAtualizacao: null },
                        '7': { ocupacoes: [], media: 0, ultimaAtualizacao: null }
                    }
                };
            }

            // Processar ocupações por caixa
            const caixaId = registro.caixa ? registro.caixa.toString() : null;
            if (caixaId && ecopontosMap[nomeEcoponto].caixas[caixaId]) {
                ecopontosMap[nomeEcoponto].caixas[caixaId].ocupacoes.push(registro.ocupacao);
                ecopontosMap[nomeEcoponto].caixas[caixaId].ultimaAtualizacao = registro.timestamp;
            }
            
            ecopontosMap[nomeEcoponto].totalRegistros++;
        });
        
        console.log('📊 Agrupamento por ecoponto concluído:', Object.keys(ecopontosMap).length, 'ecopontos encontrados');

        // Converter para array e calcular médias
        const ecopontosArray = Object.values(ecopontosMap).map(ecoponto => {
            // Calcular médias de ocupação por caixa
            Object.keys(ecoponto.caixas).forEach(caixaId => {
                const ocupacoes = ecoponto.caixas[caixaId].ocupacoes;
                if (ocupacoes.length > 0) {
                    ecoponto.caixas[caixaId].media = ocupacoes.reduce((sum, val) => sum + val, 0) / ocupacoes.length;
                } else {
                    ecoponto.caixas[caixaId].media = 0;
                }
            });

            return {
                nome: ecoponto.nome,
                totalRegistros: ecoponto.totalRegistros,
                caixas: ecoponto.caixas
            };
        });
        
        console.log('📊 Processamento concluído, gerando métricas operacionais...');
        
        // Agora vamos converter os dados para o formato de métricas operacionais
        let ecopontosUnicos = new Set();
        let caixasCriticas = 0;
        let ultimoAtendimento = '';

        dados.forEach(registro => {
            ecopontosUnicos.add(registro.ecoponto || registro.nome_ecoponto);
            
            // Contar caixas críticas (ocupação >= 80%)
            if (registro.ocupacao !== undefined && registro.ocupacao >= 80) {
                caixasCriticas++;
            }
            
            // Atualizar último atendimento
            if (registro.timestamp) {
                if (!ultimoAtendimento || registro.timestamp > ultimoAtendimento) {
                    ultimoAtendimento = registro.timestamp;
                }
            }
        });

        // Formatar último atendimento
        if (ultimoAtendimento) {
            const data = new Date(ultimoAtendimento);
            ultimoAtendimento = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        const resultado = {
            ecopontosOperacionais: ecopontosUnicos.size,
            atendimentosHoje: dados.length,
            caixasCriticas: caixasCriticas,
            ultimoAtendimento: ultimoAtendimento || 'N/A'
        };
        
        console.log('✅ Métricas operacionais geradas:', resultado);
        return resultado;
    }

    /**
     * Obtém dados por ecoponto (via Storage)
     */
    async getDadosPorEcopontoView() {
        console.log('🔍 Iniciando busca de dados por ecoponto...');
        await this._ensureInitialized();
        
        if (!this.supabase) {
            console.error('❌ Supabase client não está disponível');
            this._logDataSource('getDadosPorEcopontoView', false, 'Supabase indisponível');
            return this.getDadosEcopontosMockados();
        }

        try {
            // Buscar do Storage em vez de view direta
            console.log('📡 Buscando dados por ecoponto no Storage (shared/ecoponto_caixas.json)...');
            const { data: fileData, error: storageError } = await this.supabase
                .storage
                .from('sync-bucket')
                .download('shared/ecoponto_caixas.json');

            if (storageError) {
                console.error('❌ Erro ao buscar dados por ecoponto do Storage:', storageError);
                console.log('🔄 Usando dados mockados...');
                this._logDataSource('getDadosPorEcopontoView', false, `Erro Storage: ${storageError.message}`);
                return this.getDadosEcopontosMockados();
            }

            const text = await fileData.text();
            const snapshot = JSON.parse(text);
            const data = snapshot.data || snapshot.caixas || snapshot;
            
            console.log('✅ Dados por ecoponto recebidos:', Array.isArray(data) ? data.length : 'objeto', 'registros');

            // Processar dados para o formato esperado pelo dashboard
            const resultado = this.processarDadosPorEcopontoView(Array.isArray(data) ? data : []);
            console.log('📊 Dados por ecoponto processados com sucesso');
            this._logDataSource('getDadosPorEcopontoView', true, `${Array.isArray(data) ? data.length : 0} registros do Storage`);
            return resultado;
        } catch (error) {
            console.error('❌ Erro ao obter dados por ecoponto:', error);
            console.error(' stack:', error.stack);
            this._logDataSource('getDadosPorEcopontoView', false, `Exceção: ${error.message}`);
            return this.getDadosEcopontosMockados();
        }
    }

    /**
     * Processa dados da view para o formato do dashboard
     */
    processarDadosPorEcopontoView(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosEcopontosMockados();
        }

        // Mapeamento de IDs de caixas para nomes amigáveis
        const tiposCaixas = {
            '1': 'entulho',
            '2': 'madeira',
            '3': 'poda',
            '4': 'reciclavel',
            '5': 'rejeito',
            '6': 'sucata',
            '7': 'vidro'
        };

        // Agrupar dados por ecoponto
        const ecopontosMap = {};
        dados.forEach(registro => {
            const nomeEcoponto = registro.ecoponto || registro.nome_ecoponto || `Ecoponto ${Object.keys(ecopontosMap).length + 1}`;
            
            if (!ecopontosMap[nomeEcoponto]) {
                ecopontosMap[nomeEcoponto] = {
                    nome: nomeEcoponto,
                    caixas: {
                        '1': { ocupacao: 0, ultimaAtualizacao: null },
                        '2': { ocupacao: 0, ultimaAtualizacao: null },
                        '3': { ocupacao: 0, ultimaAtualizacao: null },
                        '4': { ocupacao: 0, ultimaAtualizacao: null },
                        '5': { ocupacao: 0, ultimaAtualizacao: null },
                        '6': { ocupacao: 0, ultimaAtualizacao: null },
                        '7': { ocupacao: 0, ultimaAtualizacao: null }
                    }
                };
            }

            // Atualizar ocupação mais recente por caixa
            const caixaId = registro.caixa ? registro.caixa.toString() : null;
            if (caixaId && ecopontosMap[nomeEcoponto].caixas[caixaId]) {
                const registroAtual = ecopontosMap[nomeEcoponto].caixas[caixaId];
                const timestamp = registro.timestamp || registro.updated_at || new Date().toISOString();
                const ocupacao = registro.ocupacao !== undefined ? registro.ocupacao : (registro.ocupacao_nova || 0);
                
                // Manter apenas o registro mais recente
                if (!registroAtual.ultimaAtualizacao || timestamp > registroAtual.ultimaAtualizacao) {
                    ecopontosMap[nomeEcoponto].caixas[caixaId] = {
                        timestamp: timestamp,
                        ocupacao: ocupacao
                    };
                }
            }
        });

        // Converter para array e ordenar
        return Object.values(ecopontosMap)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(ecoponto => ({
                nome: ecoponto.nome,
                status: this.calcularStatusEcoponto(ecoponto.caixas),
                ocupacoes: Object.keys(ecoponto.caixas).reduce((obj, caixaId) => {
                    const nomeTipo = tiposCaixas[caixaId];
                    if (nomeTipo) {
                        obj[nomeTipo] = ecoponto.caixas[caixaId].ocupacao || 0;
                    }
                    return obj;
                }, {})
            }));
    }

    /**
     * Calcula status geral do ecoponto baseado nas ocupações das caixas
     */
    calcularStatusEcoponto(caixas) {
        const ocupacoes = Object.values(caixas).map(caixa => caixa.ocupacao || 0);
        const mediaOcupacao = ocupacoes.reduce((sum, val) => sum + val, 0) / ocupacoes.length;
        
        if (mediaOcupacao > 70) return 'high';
        if (mediaOcupacao > 40) return 'medium';
        return 'low';
    }

    /**
     * Obtém dados históricos da view_ecoponto_caixas_latest
     */
    async getDadosHistoricosCaixas(dias = 30) {
        console.log(`🔍 Iniciando busca de dados históricos para ${dias} dias...`);
        await this._ensureInitialized();
        
        if (!this.supabase) {
            console.error('❌ Supabase client não está disponível');
            return this.getDadosGraficosMockados();
        }

        try {
            // Buscar do Storage em vez de view direta
            const dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - dias);
            console.log('📡 Buscando dados históricos no Storage (shared/ecoponto_caixas.json)...');
            console.log('📅 Filtro de data: de', dataInicio.toISOString(), 'até agora');
            
            const { data: fileData, error: storageError } = await this.supabase
                .storage
                .from('sync-bucket')
                .download('shared/ecoponto_caixas.json');

            if (storageError) {
                console.error('❌ Erro ao buscar dados históricos do Storage:', storageError);
                console.log('🔄 Usando dados mockados...');
                return this.getDadosGraficosMockados();
            }

            const text = await fileData.text();
            const snapshot = JSON.parse(text);
            let allData = snapshot.data || snapshot.caixas || snapshot;
            if (!Array.isArray(allData)) allData = [];

            // Filtrar por data
            const data = allData.filter(r => {
                const recordDate = r.timestamp || r.criado_em;
                return recordDate && recordDate >= dataInicio.toISOString();
            });
            
            console.log('✅ Dados históricos recebidos:', data.length, 'registros');

            // Processar dados para gráfico de evolução temporal
            const resultado = this.processarDadosHistoricosCaixas(data);
            console.log('📊 Dados históricos processados com sucesso');
            return resultado;
        } catch (error) {
            console.error('❌ Erro ao obter dados históricos:', error);
            console.error(' stack:', error.stack);
            return this.getDadosGraficosMockados();
        }
    }

    /**
     * Processa dados históricos para gráficos de evolução
     */
    processarDadosHistoricosCaixas(dados) {
        if (!dados || dados.length === 0) {
            return this.getDadosGraficosMockados();
        }

        // Mapeamento de IDs de caixas para nomes amigáveis
        const tiposCaixas = {
            '1': 'entulho',
            '2': 'madeira',
            '3': 'poda',
            '4': 'reciclavel',
            '5': 'rejeito',
            '6': 'sucata',
            '7': 'vidro'
        };

        // Agrupar dados por data e tipo de caixa
        const dadosPorDataETipo = {};
        dados.forEach(registro => {
            const data = new Date(registro.timestamp).toLocaleDateString('pt-BR');
            const tipoCaixa = tiposCaixas[registro.caixa] || `Caixa ${registro.caixa}`;
            
            if (!dadosPorDataETipo[data]) {
                dadosPorDataETipo[data] = {};
            }
            
            if (!dadosPorDataETipo[data][tipoCaixa]) {
                dadosPorDataETipo[data][tipoCaixa] = [];
            }
            
            dadosPorDataETipo[data][tipoCaixa].push(registro.ocupacao);
        });

        // Preparar dados para o gráfico
        const datas = Object.keys(dadosPorDataETipo).sort();
        const labels = datas;
        const datasets = Object.keys(tiposCaixas).map(tipoCaixa => {
            const nomeTipo = tiposCaixas[tipoCaixa] || `Caixa ${tipoCaixa}`;
            const data = datas.map(data => {
                const valores = dadosPorDataETipo[data][tipoCaixa] || [];
                return valores.length > 0 ? valores.reduce((sum, val) => sum + val, 0) / valores.length : 0;
            });
            
            return {
                label: nomeTipo,
                data: data,
                borderColor: this.getCorPorTipo(tipoCaixa),
                backgroundColor: this.getCorPorTipo(tipoCaixa, 0.6),
                tension: 0.4,
                fill: true,
                borderWidth: 3
            };
        });

        return {
            labels: labels,
            datasets: datasets
        };
    }

    /**
     * Obtém cor por tipo de caixa
     */
    getCorPorTipo(tipoCaixa, alpha = 1) {
        const cores = {
            '1': '#6b7280', // Entulho
            '2': '#92400e', // Madeira
            '3': '#16a34a', // Poda
            '4': '#0ea5e9', // Reciclável
            '5': '#374151', // Rejeito
            '6': '#f59e0b', // Sucata
            '7': '#06b6d4'  // Vidro
        };
        
        return cores[tipoCaixa] || '#6b7280';
    }
    
    /**
     * Obtém dados mockados para métricas operacionais
     */
    getDadosMockadosOperacionais() {
        console.log('🔄 Gerando dados mockados para métricas operacionais...');
        return {
            ecopontosOperacionais: 3,
            atendimentosHoje: 15,
            caixasCriticas: 4,
            ultimoAtendimento: new Date().toLocaleTimeString('pt-BR')
        };
    }
    
    /**
     * Obtém dados mockados para ecopontos
     */
    getDadosEcopontosMockados() {
        console.log('🔄 Gerando dados mockados para ecopontos...');
        return [
            {
                nome: 'Ecoponto Centro',
                status: 'high',
                ocupacoes: {
                    entulho: 85,
                    madeira: 70,
                    poda: 45,
                    reciclavel: 60,
                    rejeito: 5,
                    sucata: 90,
                    vidro: 40
                }
            },
            {
                nome: 'Ecoponto Zona Norte',
                status: 'medium',
                ocupacoes: {
                    entulho: 65,
                    madeira: 30,
                    poda: 75,
                    reciclavel: 50,
                    rejeito: 40,
                    sucata: 35,
                    vidro: 25
                }
            },
            {
                nome: 'Ecoponto Zona Sul',
                status: 'low',
                ocupacoes: {
                    entulho: 20,
                    madeira: 15,
                    poda: 30,
                    reciclavel: 25,
                    rejeito: 10,
                    sucata: 40,
                    vidro: 20
                }
            }
        ];
    }
    
    /**
     * Obtém dados mockados para gráfico de ocupação
     */
    getDadosGraficoOcupacaoMockados() {
        console.log('🔄 Gerando dados mockados para gráfico de ocupação...');
        return {
            labels: ['Entulho', 'Madeira', 'Poda', 'Reciclável', 'Rejeito', 'Sucata', 'Vidro'],
            datasets: [{
                label: 'Nível Médio de Ocupação',
                data: [65, 45, 50, 40, 35, 60, 30],
                backgroundColor: [
                    'rgba(107, 114, 128, 0.8)',
                    'rgba(146, 64, 14, 0.8)',
                    'rgba(22, 163, 74, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(55, 65, 81, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(6, 182, 212, 0.8)'
                ],
                borderColor: [
                    'rgb(107, 114, 128)',
                    'rgb(146, 64, 14)',
                    'rgb(22, 163, 74)',
                    'rgb(59, 130, 246)',
                    'rgb(5, 65, 81)',
                    'rgb(245, 158, 11)',
                    'rgb(6, 182, 212)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        };
    }
    
    /**
     * Obtém dados mockados estratégicos
     */
    getDadosMockadosEstrategicos() {
        console.log('🔄 Gerando dados mockados estratégicos...');
        return {
            totalAtendimentos: '127',
            totalResiduos: '34.5',
            totalEcopontos: 5,
            taxaOcupacao: '68%',
            totalCaixas: 35,
            totalCaixasPreenchidas: 28,
            dadosOriginais: []
        };
    }
    
    /**
     * Obtém dados mockados para gráficos
     */
    getDadosGraficosMockados() {
        console.log('🔄 Gerando dados mockados para gráficos...');
        const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const data = [65, 59, 80, 81, 56, 55, 40, 55, 60, 72, 65, 70];
        
        return {
            atendimentos: {
                labels: labels,
                datasets: [{
                    label: 'Atendimentos',
                    data: data,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.08)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3
                }]
            },
            residuos: {
                labels: ['Caixa 1', 'Caixa 2', 'Caixa 3', 'Caixa 4', 'Caixa 5', 'Caixa 6', 'Caixa 7'],
                datasets: [{
                    data: [12, 8, 15, 10, 7, 11, 9],
                    backgroundColor: [
                        '#6b7280', '#92400e', '#16a34a',
                        '#0ea5e9', '#374151', '#f59e0b', '#06b6d4'
                    ],
                    borderWidth: 0
                }]
            },
            bairro: {
                labels: ['Centro', 'Zona Norte', 'Zona Sul', 'Zona Leste', 'Zona Oeste'],
                datasets: [{
                    data: [25, 18, 22, 15, 20],
                    backgroundColor: [
                        '#0ea5e9', '#38bdf8', '#7dd3fc',
                        '#bae6fd', '#e0f2fe'
                    ],
                    borderWidth: 0
                }]
            },
            status: {
                labels: ['Normal', 'Alerta', 'Crítico'],
                datasets: [{
                    data: [15, 8, 2],
                    backgroundColor: ['#16a34a', '#f59e0b', '#ef444'],
                    borderWidth: 0
                }]
            }
        };
    }
}

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
   module.exports = { DashboardService };
} else {
   window.DashboardService = DashboardService;
}