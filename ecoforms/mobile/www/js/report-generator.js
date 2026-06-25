/**
 * Report Generator Service
 * 
 * Serviço para gerar relatórios agregados e analíticos
 * a partir dos dados normalizados dos formulários.
 */

class ReportGenerator {
    constructor(normalizationService) {
        this.normService = normalizationService;
        this.client = normalizationService.client;
    }

    /**
     * Gera relatório agregado por tipo de formulário
     * @param {Object} dateRange - {start: Date, end: Date}
     * @returns {Promise<Object>} Relatório com estatísticas por tipo
     */
    async generateFormTypeReport(dateRange = {}) {
        try {
            const stats = await this.normService.getStats({
                dateFrom: dateRange.start,
                dateTo: dateRange.end
            });

            // Calcular totais gerais
            const totals = stats.reduce((acc, stat) => ({
                total_records: acc.total_records + (stat.total_records || 0),
                total_users: acc.total_users + (stat.total_users || 0),
                pending_count: acc.pending_count + (stat.pending_count || 0),
                synced_count: acc.synced_count + (stat.synced_count || 0),
                draft_count: acc.draft_count + (stat.draft_count || 0),
                validated_count: acc.validated_count + (stat.validated_count || 0)
            }), {
                total_records: 0,
                total_users: 0,
                pending_count: 0,
                synced_count: 0,
                draft_count: 0,
                validated_count: 0
            });

            return {
                period: {
                    start: dateRange.start || 'Início',
                    end: dateRange.end || 'Agora'
                },
                totals,
                byFormType: stats,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erro ao gerar relatório por tipo:', error);
            throw error;
        }
    }

    /**
     * Gera relatório com drill-down em campos específicos (local)
     * @param {string} formType - Tipo do formulário
     * @param {string} fieldPath - Path do campo (ex: 'atendimento.endereco.bairro')
     * @param {Object} dateRange - {start: Date, end: Date}
     * @returns {Promise<Object>} Relatório de frequência de valores
     */
    async generateFieldReport(formType, fieldPath, dateRange = {}) {
        try {
            // Buscar do cache local (dataService)
            let data = [];
            if (window.dataService && window.dataService.getFormSubmissions) {
                const filters = {
                    formType: formType,
                    dateFrom: dateRange.start,
                    dateTo: dateRange.end,
                    limit: 10000
                };
                data = await window.dataService.getFormSubmissions(filters);
            } else {
                console.warn('getFormSubmissions não disponível no dataService');
                data = [];
            }

            // Extrair valores do campo
            const values = data.map(record => ({
                value: this.normService.getNestedValue(record.dados || record, fieldPath),
                date: record.criado_em
            }));

            // Contar frequências
            const frequency = values.reduce((acc, item) => {
                const key = item.value || '(vazio)';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

            // Ordenar por frequência
            const sortedFrequency = Object.entries(frequency)
                .sort(([, a], [, b]) => b - a)
                .reduce((acc, [key, value]) => {
                    acc[key] = value;
                    return acc;
                }, {});

            return {
                formType,
                field: fieldPath,
                period: {
                    start: dateRange.start || 'Início',
                    end: dateRange.end || 'Agora'
                },
                totalRecords: data.length,
                uniqueValues: Object.keys(frequency).length,
                distribution: sortedFrequency,
                values: values,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erro ao gerar relatório de campo:', error);
            throw error;
        }
    }

    /**
     * Gera relatório de completude ao longo do tempo (local)
     * @param {string} formType - Tipo do formulário (opcional)
     * @param {Object} dateRange - {start: Date, end: Date}
     * @param {string} groupBy - 'day', 'week', 'month'
     * @returns {Promise<Object>} Série temporal de completude
     */
    async generateCompletenessReport(formType = null, dateRange = {}, groupBy = 'day') {
        try {
            // Buscar do cache local (dataService)
            let data = [];
            if (window.dataService && window.dataService.getFormSubmissions) {
                const filters = {
                    formType: formType,
                    dateFrom: dateRange.start,
                    dateTo: dateRange.end,
                    limit: 10000
                };
                data = await window.dataService.getFormSubmissions(filters);
            } else {
                console.warn('getFormSubmissions não disponível no dataService');
                data = [];
            }

            // Agrupar por período
            const grouped = this.groupByPeriod(data, groupBy);

            return {
                formType: formType || 'Todos',
                period: {
                    start: dateRange.start || 'Início',
                    end: dateRange.end || 'Agora'
                },
                groupBy,
                timeSeries: grouped,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erro ao gerar relatório de completude:', error);
            throw error;
        }
    }

    /**
     * Gera relatório de produtividade por usuário (local)
     * @param {Object} dateRange - {start: Date, end: Date}
     * @returns {Promise<Object>} Estatísticas por usuário
     */
    async generateUserProductivityReport(dateRange = {}) {
        try {
            // Buscar do cache local (dataService)
            let data = [];
            if (window.dataService && window.dataService.getFormSubmissions) {
                const filters = {
                    dateFrom: dateRange.start,
                    dateTo: dateRange.end,
                    limit: 10000
                };
                data = await window.dataService.getFormSubmissions(filters);
            } else {
                console.warn('getFormSubmissions não disponível no dataService');
                data = [];
            }

            // Agrupar por usuário
            const userStats = {};

            data.forEach(record => {
                const userId = record.user_id || record.userId;
                if (!userStats[userId]) {
                    userStats[userId] = {
                        userId,
                        userName: record.user_name || record.userName || 'Usuário',
                        totalRecords: 0,
                        avgCompleteness: 0,
                        formTypes: {},
                        records: []
                    };
                }

                const user = userStats[userId];
                user.totalRecords++;
                user.avgCompleteness += record.completeness || record.resumo_completude || 0;
                const formType = record.form_type || record.tipo_form || 'unknown';
                user.formTypes[formType] = (user.formTypes[formType] || 0) + 1;
                user.records.push(record);
            });

            // Calcular médias
            Object.values(userStats).forEach(user => {
                if (user.totalRecords > 0) {
                    user.avgCompleteness = Math.round(user.avgCompleteness / user.totalRecords);
                }
            });

            // Ordenar por total de registros
            const sortedUsers = Object.values(userStats).sort((a, b) => 
                b.totalRecords - a.totalRecords
            );

            return {
                period: {
                    start: dateRange.start || 'Início',
                    end: dateRange.end || 'Agora'
                },
                totalUsers: sortedUsers.length,
                users: sortedUsers,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erro ao gerar relatório de produtividade:', error);
            throw error;
        }
    }

    /**
     * Gera relatório geográfico (por localização)
     * @param {string} formType - Tipo do formulário
     * @param {Object} dateRange - {start: Date, end: Date}
     * @returns {Promise<Object>} Distribuição geográfica
     */
    async generateGeographicReport(formType = null, dateRange = {}) {
        try {
            const fieldPath = formType === 'ecopontoForm' 
                ? 'atendimento.endereco.bairro'
                : 'inspecao.local.bairro';

            const report = await this.generateFieldReport(formType, fieldPath, dateRange);

            // Adicionar coordenadas se disponíveis
            const withCoordinates = report.values
                .filter(v => v.value)
                .map(v => {
                    // TODO: Buscar coordenadas do registro completo
                    return {
                        location: v.value,
                        date: v.date,
                        // lat: ...,
                        // lng: ...
                    };
                });

            return {
                ...report,
                locations: withCoordinates,
                mapReady: false // TODO: Integrar com mapa
            };
        } catch (error) {
            console.error('Erro ao gerar relatório geográfico:', error);
            throw error;
        }
    }

    /**
     * Agrupa dados por período de tempo
     * @private
     */
    groupByPeriod(data, groupBy) {
        const grouped = {};

        data.forEach(record => {
            const date = new Date(record.criado_em);
            let key;

            switch (groupBy) {
                case 'day':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            if (!grouped[key]) {
                grouped[key] = {
                    period: key,
                    count: 0,
                    avgCompleteness: 0,
                    records: []
                };
            }

            grouped[key].count++;
            grouped[key].avgCompleteness += record.resumo_completude || 0;
            grouped[key].records.push(record);
        });

        // Calcular médias
        Object.values(grouped).forEach(group => {
            if (group.count > 0) {
                group.avgCompleteness = Math.round(group.avgCompleteness / group.count);
            }
        });

        return Object.values(grouped).sort((a, b) => 
            a.period.localeCompare(b.period)
        );
    }

    /**
     * Exporta relatório para CSV
     * @param {Object} reportData - Dados do relatório
     * @param {string} filename - Nome do arquivo
     */
    exportToCSV(reportData, filename = 'relatorio.csv') {
        let csv = '';

        // Se for relatório com schema
        if (reportData.schema && reportData.records) {
            const schema = reportData.schema;
            const records = reportData.records;

            // Cabeçalhos
            const headers = schema.map(f => f.field_label).join(',');
            csv += headers + '\n';

            // Linhas
            records.forEach(record => {
                const row = schema.map(field => {
                    const value = this.normService.getNestedValue(record, field.field_path);
                    return this.escapeCsvValue(value);
                }).join(',');
                csv += row + '\n';
            });
        } 
        // Se for distribuição de frequência
        else if (reportData.distribution) {
            csv += 'Valor,Frequência\n';
            Object.entries(reportData.distribution).forEach(([key, value]) => {
                csv += `${this.escapeCsvValue(key)},${value}\n`;
            });
        }
        // Série temporal
        else if (reportData.timeSeries) {
            csv += 'Período,Quantidade,Completude Média\n';
            reportData.timeSeries.forEach(item => {
                csv += `${item.period},${item.count},${item.avgCompleteness}\n`;
            });
        }
        // Produtividade de usuários
        else if (reportData.users) {
            csv += 'Usuário,Total Registros,Completude Média\n';
            reportData.users.forEach(user => {
                csv += `${this.escapeCsvValue(user.userName)},${user.totalRecords},${user.avgCompleteness}\n`;
            });
        }

        // Download
        this.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    }

    /**
     * Exporta relatório para JSON
     * @param {Object} reportData - Dados do relatório
     * @param {string} filename - Nome do arquivo
     */
    exportToJSON(reportData, filename = 'relatorio.json') {
        const json = JSON.stringify(reportData, null, 2);
        this.downloadFile(json, filename, 'application/json;charset=utf-8;');
    }

    /**
     * Escapa valor para CSV
     * @private
     */
    escapeCsvValue(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Faz download de arquivo
     * @private
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
}

// Instância global
if (typeof window !== 'undefined') {
    window.ReportGenerator = ReportGenerator;
    
    // Auto-inicialização se formNormalizationService já estiver disponível
    if (window.formNormalizationService) {
        window.reportGenerator = new ReportGenerator(window.formNormalizationService);
        console.log('✅ ReportGenerator inicializado');
    } else {
        // Esperar serviço ficar disponível
        const initReportGenerator = () => {
            if (window.formNormalizationService) {
                window.reportGenerator = new ReportGenerator(window.formNormalizationService);
                console.log('✅ ReportGenerator inicializado (após normalizationService)');
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initReportGenerator);
        } else {
            // Tentar novamente após um pequeno delay
            setTimeout(initReportGenerator, 100);
        }
    }
}

// Export para módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportGenerator;
}
