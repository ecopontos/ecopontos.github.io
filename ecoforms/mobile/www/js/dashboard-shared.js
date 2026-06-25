(function (global) {
    'use strict';

    const DEFAULT_REFRESH_INTERVAL = 30000;
    const DEFAULT_PERIOD = 7;

    const TIPOS_RESIDUOS = [
        { key: 'entulho', label: 'Entulho', icon: '🏗️' },
        { key: 'madeira', label: 'Madeira', icon: '🪵' },
        { key: 'poda', label: 'Poda', icon: '🌿' },
        { key: 'reciclavel', label: 'Reciclável', icon: '♻️' },
        { key: 'rejeito', label: 'Rejeito', icon: '🗑️' },
        { key: 'sucata', label: 'Sucata', icon: '⚙️' },
        { key: 'vidro', label: 'Vidro', icon: '🪟' }
    ];

    const STATUS_LABELS = { high: 'Crítico', medium: 'Alerta', low: 'Normal' };
    const CARD_CLASS_MAP = { high: 'state-high', medium: 'state-medium', low: 'state-low' };
    const TEXT_CLASS_MAP = { high: 'text-red-600', medium: 'text-yellow-600', low: 'text-green-600' };
    const INDICATOR_CLASS_MAP = { high: 'status-critical', medium: 'status-warning', low: 'status-normal' };
    const BADGE_CLASS_MAP = { high: 'status-high', medium: 'status-medium', low: 'status-low' };

    const FALLBACK_METHODS = {
        getMetricasOperacionais: 'getDadosMockadosOperacionais',
        getDadosPorEcopontoView: 'getDadosEcopontosMockados',
        getDadosConsolidadosCaixas: 'getDadosGraficoOcupacaoMockados',
        getDadosOcupacaoMedia: 'getDadosGraficoOcupacaoMockados',
        getDadosHistoricosCaixas: 'getDadosGraficosMockados'
    };

    const DEFAULT_BAR_OPTIONS = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                callbacks: {
                    label: context => `Ocupação: ${context.parsed.y}%`
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                title: {
                    display: true,
                    text: 'Nível de Ocupação (%)',
                    font: { size: 14, weight: 'bold' }
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    callback: value => `${value}%`
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 12, weight: '500' }
                }
            }
        }
    };

    const DEFAULT_LINE_OPTIONS = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 16,
                    font: { size: 13, weight: '600' }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Registros',
                    font: { size: 14, weight: 'bold' }
                },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 12, weight: '500' }
                }
            }
        }
    };

    let serviceReadyPromise;

    function mergeNested(base, extra) {
        const result = Object.assign({}, base || {});
        if (!extra) {
            return result;
        }
        Object.keys(extra).forEach(key => {
            const value = extra[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = mergeNested(result[key], value);
            } else {
                result[key] = value;
            }
        });
        return result;
    }

    function mergeOptions(base, extra) {
        if (!extra) {
            return base;
        }
        const merged = Object.assign({}, base, extra);
        if (base.plugins || extra.plugins) {
            merged.plugins = mergeNested(base.plugins, extra.plugins);
        }
        if (base.scales || extra.scales) {
            merged.scales = mergeNested(base.scales, extra.scales);
        }
        return merged;
    }

    async function initializeDashboardServices() {
        if (!serviceReadyPromise) {
            serviceReadyPromise = (async () => {
                // Inicializar DataService primeiro
                if (global.DataService && !global.dataService) {
                    global.dataService = new global.DataService();
                }
                if (global.dataService && global.dataService._initPromise) {
                    await global.dataService._initPromise;
                }
                
                // Inicializar DashboardService
                if (global.DashboardService && !global.dashboardService) {
                    global.dashboardService = new global.DashboardService();
                }
                if (global.dashboardService && global.dashboardService._initPromise) {
                    await global.dashboardService._initPromise;
                }
                
                // Inicializar SQLiteWorkerAdapter se disponível
                if (global.SQLiteWorkerAdapter && !global.sqliteAdapter) {
                    global.sqliteAdapter = new global.SQLiteWorkerAdapter({
                        workerPath: '../js/sqlite-service-worker.js',
                        useWorker: true,
                        fallbackToDirect: true,
                        timeout: 5000
                    });
                    
                    // Configurar eventos
                    global.sqliteAdapter.onInitialized = (info) => {
                        console.log('[DashboardShared] SQLite inicializado:', info);
                    };
                    
                    global.sqliteAdapter.onError = (error) => {
                        console.error('[DashboardShared] Erro no SQLite:', error);
                    };
                    
                    // Inicializar o adaptador
                    await global.sqliteAdapter.initialize();
                    console.log('[DashboardShared] Adaptador SQLite inicializado');
                }
            })();
        }
        return serviceReadyPromise;
    }

    function getServiceMethod(methodName) {
        // Tentar obter do DashboardService primeiro
        if (global.dashboardService && typeof global.dashboardService[methodName] === 'function') {
            return global.dashboardService[methodName].bind(global.dashboardService);
        }
        
        // Tentar obter do SQLiteAdapter como fallback
        if (global.sqliteAdapter && typeof global.sqliteAdapter[methodName] === 'function') {
            console.log(`[DashboardShared] Usando método ${methodName} do SQLiteAdapter`);
            return global.sqliteAdapter[methodName].bind(global.sqliteAdapter);
        }
        
        return null;
    }

    function getFallback(methodName) {
        const fallbackName = FALLBACK_METHODS[methodName];
        
        // Tentar obter do DashboardService primeiro
        if (global.dashboardService && typeof global.dashboardService[fallbackName] === 'function') {
            return global.dashboardService[fallbackName].bind(global.dashboardService);
        }
        
        // Tentar obter do SQLiteAdapter como fallback
        if (global.sqliteAdapter && typeof global.sqliteAdapter[fallbackName] === 'function') {
            console.log(`[DashboardShared] Usando fallback ${fallbackName} do SQLiteAdapter`);
            return global.sqliteAdapter[fallbackName].bind(global.sqliteAdapter);
        }
        
        return null;
    }

    function createDashboardStore(customConfig) {
        const config = Object.assign({
            includeHistorico: false,
            autoRefresh: true,
            refreshInterval: DEFAULT_REFRESH_INTERVAL,
            defaultPeriod: DEFAULT_PERIOD,
            chartSelectors: {
                ocupacao: '#ocupacaoMediaChart',
                historico: '#historicoChart'
            },
            ocupacaoSource: 'consolidado',
            ocupacaoChartOptions: null,
            historicoChartOptions: null
        }, customConfig || {});

        return {
            metrics: {
                ecopontosOperacionais: 0,
                atendimentosHoje: 0,
                caixasCriticas: 0,
                ultimoAtendimento: 'N/A'
            },
            ecopontosDetalhados: [],
            tiposResiduos: TIPOS_RESIDUOS,
            lastUpdate: new Date().toLocaleTimeString('pt-BR'),
            selectedPeriod: config.defaultPeriod,
            hasHistorico: config.includeHistorico,
            isLoading: false,
            error: null,
            filterNivel: 'all',
            sortMode: 'critical-first',
            _charts: {},
            _intervalId: null,

            async init() {
                await initializeDashboardServices();
                await this.refreshAll();
                if (this.hasHistorico) {
                    await this.loadHistorico(this.selectedPeriod);
                }
                if (config.autoRefresh && config.refreshInterval) {
                    this._intervalId = setInterval(() => {
                        this.refreshAll();
                        if (this.hasHistorico) {
                            this.loadHistorico(this.selectedPeriod);
                        }
                    }, config.refreshInterval);
                }
            },

            async refreshAll() {
                await this.loadData();
            },

            async refreshData() {
                await this.refreshAll();
            },

            async loadData() {
                console.log('🔍 [DEBUG] Iniciando loadData no dashboard-shared...');
                console.log('📋 [DEBUG] Estado inicial:', {
                    hasDashboardService: !!global.dashboardService,
                    isLoading: this.isLoading,
                    error: this.error
                });
                
                if (!global.dashboardService) {
                    console.error('❌ [DEBUG] DashboardService indisponível em loadData');
                    return;
                }

                this.isLoading = true;
                this.error = null;

                try {
                    console.log('🔍 [DEBUG] Obtendo métodos de serviço...');
                    const getMetricas = getServiceMethod('getMetricasOperacionais');
                    const getEcopontos = getServiceMethod('getDadosPorEcopontoView');
                    const getOcupacao = (config.ocupacaoSource === 'media'
                        ? getServiceMethod('getDadosOcupacaoMedia')
                        : getServiceMethod('getDadosConsolidadosCaixas'))
                        || getServiceMethod('getDadosConsolidadosCaixas')
                        || getServiceMethod('getDadosOcupacaoMedia');

                    console.log('📋 [DEBUG] Métodos encontrados:', {
                        hasGetMetricas: !!getMetricas,
                        hasGetEcopontos: !!getEcopontos,
                        hasGetOcupacao: !!getOcupacao,
                        ocupacaoSource: config.ocupacaoSource
                    });

                    console.log('📡 [DEBUG] Executando chamadas paralelas...');
                    const [metricas, ecopontos, ocupacao] = await Promise.all([
                        getMetricas ? getMetricas() : null,
                        getEcopontos ? getEcopontos() : null,
                        getOcupacao ? getOcupacao() : null
                    ]);

                    console.log('📊 [DEBUG] Resultados das chamadas:', {
                        metricas: metricas ? 'recebidos' : 'nulos',
                        ecopontos: ecopontos ? (Array.isArray(ecopontos) ? `${ecopontos.length} itens` : 'inválidos') : 'nulos',
                        ocupacao: ocupacao ? 'recebidos' : 'nulos'
                    });

                    const metricasFallback = getFallback('getMetricasOperacionais');
                    const ecopontosFallback = getFallback('getDadosPorEcopontoView');
                    const ocupacaoFallback = getFallback('getDadosConsolidadosCaixas');

                    console.log('🔄 [DEBUG] Métodos de fallback:', {
                        hasMetricasFallback: !!metricasFallback,
                        hasEcopontosFallback: !!ecopontosFallback,
                        hasOcupacaoFallback: !!ocupacaoFallback
                    });

                    // Aplicar dados ou fallback
                    this.metrics = metricas || (metricasFallback ? metricasFallback() : this.metrics);
                    this.ecopontosDetalhados = Array.isArray(ecopontos)
                        ? ecopontos
                        : (ecopontosFallback ? ecopontosFallback() : this.ecopontosDetalhados);

                    console.log('📋 [DEBUG] Dados finais aplicados:', {
                        metrics: this.metrics,
                        ecopontosCount: this.ecopontosDetalhados.length,
                        usingFallbackMetrics: !metricas,
                        usingFallbackEcopontos: !Array.isArray(ecopontos)
                    });

                    const chartData = ocupacao
                        || (ocupacaoFallback ? ocupacaoFallback() : null);
                    if (chartData) {
                        console.log('📊 [DEBUG] Atualizando gráfico com dados:', chartData.labels?.length || 0, 'categorias');
                        this.updateChart('ocupacao', chartData, config.chartSelectors.ocupacao, 'bar', config.ocupacaoChartOptions);
                    } else {
                        console.warn('⚠️ [DEBUG] Sem dados para o gráfico de ocupação');
                    }

                    this.lastUpdate = new Date().toLocaleTimeString('pt-BR');
                    console.log('✅ [DEBUG] loadData concluído com sucesso');
                } catch (error) {
                    console.error('❌ [DEBUG] Erro ao carregar dados do dashboard:', error);
                    console.error('📋 [DEBUG] Stack trace:', error.stack);
                    this.error = 'Falha ao carregar dados';

                    console.log('🔄 [DEBUG] Aplicando fallback devido a erro...');
                    const metricasFallback = getFallback('getMetricasOperacionais');
                    const ecopontosFallback = getFallback('getDadosPorEcopontoView');
                    const ocupacaoFallback = getFallback('getDadosConsolidadosCaixas');

                    if (metricasFallback) {
                        console.log('🔄 [DEBUG] Aplicando fallback para métricas');
                        this.metrics = metricasFallback();
                    }
                    if (ecopontosFallback) {
                        console.log('🔄 [DEBUG] Aplicando fallback para ecopontos');
                        this.ecopontosDetalhados = ecopontosFallback();
                    }
                    if (ocupacaoFallback) {
                        console.log('🔄 [DEBUG] Aplicando fallback para gráfico');
                        const mockChartData = ocupacaoFallback();
                        if (mockChartData) {
                            this.updateChart('ocupacao', mockChartData, config.chartSelectors.ocupacao, 'bar', config.ocupacaoChartOptions);
                        }
                    }
                } finally {
                    this.isLoading = false;
                    console.log('📋 [DEBUG] Estado final:', {
                        isLoading: this.isLoading,
                        error: this.error,
                        metricsCount: Object.keys(this.metrics).length,
                        ecopontosCount: this.ecopontosDetalhados.length
                    });
                }
            },

            async loadHistorico(period) {
                if (!this.hasHistorico || !config.chartSelectors.historico || !global.dashboardService) {
                    return;
                }

                try {
                    const getHistorico = getServiceMethod('getDadosHistoricosCaixas');
                    const historico = getHistorico ? await getHistorico(period) : null;
                    if (historico && historico.datasets) {
                        this.updateChart('historico', historico, config.chartSelectors.historico, 'line', config.historicoChartOptions);
                        return;
                    }
                } catch (error) {
                    console.error('Erro ao carregar histórico:', error);
                }

                const historicoFallback = getFallback('getDadosHistoricosCaixas');
                if (historicoFallback) {
                    const mock = historicoFallback();
                    if (mock && mock.atendimentos) {
                        this.updateChart('historico', mock.atendimentos, config.chartSelectors.historico, 'line', config.historicoChartOptions);
                    }
                }
            },

            setPeriod(period) {
                this.selectedPeriod = period;
                if (this.hasHistorico) {
                    this.loadHistorico(period);
                }
            },

            setFilterNivel(nivel) {
                this.filterNivel = nivel;
            },

            setSortMode(mode) {
                this.sortMode = mode;
            },

            getNivelCount(nivel) {
                if (!Array.isArray(this.ecopontosDetalhados)) {
                    return 0;
                }
                if (nivel === 'all') {
                    return this.ecopontosDetalhados.length;
                }
                return this.ecopontosDetalhados.reduce((total, ecoponto) => {
                    return total + (this.getEcopontoNivel(ecoponto) === nivel ? 1 : 0);
                }, 0);
            },

            getFilteredCount() {
                if (!Array.isArray(this.ecopontosDetalhados)) {
                    return 0;
                }
                if (this.filterNivel === 'all') {
                    return this.ecopontosDetalhados.length;
                }
                return this.ecopontosDetalhados.reduce((total, ecoponto) => {
                    return total + (this.getEcopontoNivel(ecoponto) === this.filterNivel ? 1 : 0);
                }, 0);
            },

            getOcupacaoStats(ecoponto) {
                const valores = this.tiposResiduos.map(tipo => {
                    const bruto = ecoponto && ecoponto.ocupacoes ? ecoponto.ocupacoes[tipo.key] : 0;
                    const numero = typeof bruto === 'number' ? bruto : parseFloat(bruto);
                    return Number.isFinite(numero) ? numero : 0;
                });

                if (!valores.length) {
                    return { max: 0, media: 0, nivel: 'low' };
                }

                const max = Math.max(...valores, 0);
                const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
                return { max, media, nivel: this.resolveNivel(max) };
            },

            getEcopontoNivel(ecoponto, stats) {
                const status = ecoponto && typeof ecoponto.status === 'string' ? ecoponto.status.toLowerCase() : null;
                if (status && STATUS_LABELS[status]) {
                    return status;
                }
                const dados = stats || this.getOcupacaoStats(ecoponto);
                return dados.nivel;
            },

            getFilteredEcopontos() {
                if (!Array.isArray(this.ecopontosDetalhados)) {
                    return [];
                }

                const itens = this.ecopontosDetalhados.map(ecoponto => {
                    const stats = this.getOcupacaoStats(ecoponto);
                    return { ecoponto, stats, nivel: this.getEcopontoNivel(ecoponto, stats) };
                });

                const filtrados = this.filterNivel === 'all'
                    ? itens
                    : itens.filter(item => item.nivel === this.filterNivel);

                filtrados.sort((a, b) => {
                    if (this.sortMode === 'alphabetical') {
                        const nomeA = (a.ecoponto && a.ecoponto.nome) ? a.ecoponto.nome : '';
                        const nomeB = (b.ecoponto && b.ecoponto.nome) ? b.ecoponto.nome : '';
                        return nomeA.localeCompare(nomeB, 'pt-BR');
                    }

                    if (this.sortMode === 'least-loaded') {
                        if (a.stats.max !== b.stats.max) {
                            return a.stats.max - b.stats.max;
                        }
                    } else {
                        if (a.stats.max !== b.stats.max) {
                            return b.stats.max - a.stats.max;
                        }
                    }

                    const nomeA = (a.ecoponto && a.ecoponto.nome) ? a.ecoponto.nome : '';
                    const nomeB = (b.ecoponto && b.ecoponto.nome) ? b.ecoponto.nome : '';
                    return nomeA.localeCompare(nomeB, 'pt-BR');
                });

                return filtrados.map(item => item.ecoponto);
            },

            updateChart(key, chartData, selector, type, customOptions) {
                if (!selector || !chartData || !global.Chart) {
                    return;
                }

                const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
                if (!element || !element.getContext) {
                    return;
                }

                if (!this._charts) {
                    this._charts = {};
                }

                if (this._charts[key]) {
                    this._charts[key].destroy();
                }

                const baseOptions = type === 'line' ? DEFAULT_LINE_OPTIONS : DEFAULT_BAR_OPTIONS;
                const options = mergeOptions(baseOptions, customOptions);

                this._charts[key] = new Chart(element.getContext('2d'), {
                    type,
                    data: chartData,
                    options
                });
            },

            getStatusText(status) {
                return STATUS_LABELS[status] || STATUS_LABELS.low;
            },

            getStatusCardClass(status) {
                return CARD_CLASS_MAP[status] || CARD_CLASS_MAP.low;
            },

            getStatusTextClass(status) {
                return TEXT_CLASS_MAP[status] || TEXT_CLASS_MAP.low;
            },

            getStatusIndicatorClass(status) {
                return INDICATOR_CLASS_MAP[status] || INDICATOR_CLASS_MAP.low;
            },

            getBadgeClass(status) {
                return BADGE_CLASS_MAP[status] || BADGE_CLASS_MAP.low;
            },

            resolveNivel(value) {
                const numero = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(numero)) {
                    return 'low';
                }
                if (numero >= 80) {
                    return 'high';
                }
                if (numero >= 40) {
                    return 'medium';
                }
                return 'low';
            },

            formatPercent(value) {
                const numero = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(numero)) {
                    return '0%';
                }
                return `${Math.round(numero)}%`;
            }
        };
    }

    global.DashboardShared = {
        initializeServices: initializeDashboardServices,
        createStore: createDashboardStore
    };
})(window);
