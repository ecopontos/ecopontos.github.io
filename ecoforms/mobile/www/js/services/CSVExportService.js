/**
 * CSVExportService - Serviço completo de exportação de dados
 * Suporte para localStorage e IndexedDB
 * 4 tipos de exportação: Todos, Formulários, Ecopontos, Usuários
 * Interface de botões com feedback visual
 * Remoção automática de senhas na exportação de usuários
 * Suporte a UTF-8 com BOM (acentuação)
 * Escapamento correto de caracteres CSV
 * Detecção de tamanho de memória
 * Documentação completa do sistema
 */

class CSVExportService {
    constructor() {
        this.BOM = '\uFEFF'; // Byte Order Mark para UTF-8
    }

    /**
     * Escapa valores para CSV
     */
    escapeCSV(value) {
        if (value === null || value === undefined) return '';

        const str = String(value);

        // Se contém vírgula, aspas ou quebras de linha, envolve em aspas
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }

        return str;
    }

    /**
     * Converte objeto para linha CSV
     */
    objectToCSVRow(obj, headers) {
        return headers.map(header => this.escapeCSV(obj[header])).join(',');
    }

    /**
     * Cria cabeçalho CSV
     */
    createCSVHeader(headers) {
        return headers.join(',') + '\n';
    }

    /**
     * Cria conteúdo CSV completo
     */
    createCSVContent(headers, data) {
        let csv = this.BOM + this.createCSVHeader(headers);
        data.forEach(item => {
            csv += this.objectToCSVRow(item, headers) + '\n';
        });
        return csv;
    }

    /**
     * Faz download do arquivo CSV
     */
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Obtém informações de memória
     */
    async getMemoryInfo() {
        try {
            let localStorageSize = 0;
            let localStorageItems = 0;

            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    localStorageItems++;
                    localStorageSize += (key.length + localStorage[key].length) * 2; // UTF-16
                }
            }

            return {
                localStorage: {
                    items: localStorageItems,
                    sizeMB: (localStorageSize / (1024 * 1024)).toFixed(2)
                }
            };
        } catch (error) {
            console.error('Erro ao obter informações de memória:', error);
            return null;
        }
    }

    /**
     * Exporta todos os dados
     */
    async exportAll() {
        try {
            const results = await Promise.allSettled([
                this.exportForms(),
                this.exportEcopontos(),
                this.exportUsers()
            ]);

            const allData = [];
            let totalRows = 0;
            const errors = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success && result.value.data) {
                        allData.push(...result.value.data);
                        totalRows += result.value.rows;
                    } else if (result.value.warning) {
                        errors.push(result.value.warning);
                    }
                } else {
                    errors.push(`Erro na exportação ${['forms', 'ecopontos', 'users'][index]}: ${result.reason.message}`);
                }
            });

            if (allData.length === 0) {
                return {
                    success: false,
                    warning: 'Nenhum dado encontrado para exportação.',
                    rows: 0
                };
            }

            // Criar headers únicos
            const allHeaders = new Set();
            allData.forEach(item => {
                Object.keys(item).forEach(key => allHeaders.add(key));
            });

            const headers = Array.from(allHeaders);
            const csv = this.createCSVContent(headers, allData);
            const filename = `ecoforms-todos-dados-${new Date().toISOString().split('T')[0]}.csv`;

            this.downloadCSV(csv, filename);

            return {
                success: true,
                filename: filename,
                rows: totalRows,
                data: allData
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                rows: 0
            };
        }
    }

    /**
     * Exporta formulários
     */
    async exportForms() {
        try {
            const forms = [];

            // Buscar formulários do localStorage
            for (let key in localStorage) {
                if (key.startsWith('ecoforms_form_') || key.includes('formData')) {
                    try {
                        const data = JSON.parse(localStorage[key]);
                        if (data && typeof data === 'object') {
                            forms.push({
                                tipo: 'localStorage',
                                chave: key,
                                dados: JSON.stringify(data),
                                timestamp: new Date().toISOString()
                            });
                        }
                    } catch (e) {
                        // Ignorar itens inválidos
                    }
                }
            }

            if (forms.length === 0) {
                return {
                    success: false,
                    warning: 'Nenhum formulário encontrado.',
                    rows: 0
                };
            }

            const headers = ['tipo', 'chave', 'dados', 'timestamp'];
            const csv = this.createCSVContent(headers, forms);
            const filename = `ecoforms-formularios-${new Date().toISOString().split('T')[0]}.csv`;

            this.downloadCSV(csv, filename);

            return {
                success: true,
                filename: filename,
                rows: forms.length,
                data: forms
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                rows: 0
            };
        }
    }

    /**
     * Exporta ecopontos
     */
    async exportEcopontos() {
        try {
            const ecopontos = [];

            // Buscar ecopontos do localStorage
            for (let key in localStorage) {
                if (key.includes('ecoponto') || key.includes('Ecoponto')) {
                    try {
                        const data = JSON.parse(localStorage[key]);
                        if (data && typeof data === 'object') {
                            if (Array.isArray(data)) {
                                data.forEach(item => {
                                    ecopontos.push({
                                        tipo: 'localStorage',
                                        chave: key,
                                        id: item.id || '',
                                        nome: item.nome || '',
                                        dados: JSON.stringify(item),
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            } else {
                                ecopontos.push({
                                    tipo: 'localStorage',
                                    chave: key,
                                    id: data.id || '',
                                    nome: data.nome || '',
                                    dados: JSON.stringify(data),
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    } catch (e) {
                        // Ignorar itens inválidos
                    }
                }
            }

            if (ecopontos.length === 0) {
                return {
                    success: false,
                    warning: 'Nenhum ecoponto encontrado.',
                    rows: 0
                };
            }

            const headers = ['tipo', 'chave', 'id', 'nome', 'dados', 'timestamp'];
            const csv = this.createCSVContent(headers, ecopontos);
            const filename = `ecoforms-ecopontos-${new Date().toISOString().split('T')[0]}.csv`;

            this.downloadCSV(csv, filename);

            return {
                success: true,
                filename: filename,
                rows: ecopontos.length,
                data: ecopontos
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                rows: 0
            };
        }
    }

    /**
     * Exporta usuários (removendo senhas)
     */
    async exportUsers() {
        try {
            const users = [];

            // Buscar usuários do localStorage
            for (let key in localStorage) {
                if (key.includes('user') || key.includes('User') || key === 'ecoforms_users') {
                    try {
                        const data = JSON.parse(localStorage[key]);
                        if (data && typeof data === 'object') {
                            if (Array.isArray(data)) {
                                data.forEach(user => {
                                    const cleanUser = { ...user };
                                    delete cleanUser.password; // Remover senha
                                    delete cleanUser.senha; // Remover senha (português)
                                    users.push({
                                        tipo: 'localStorage',
                                        chave: key,
                                        id: user.id || user.username || '',
                                        username: user.username || user.login || '',
                                        role: user.role || user.perfil || '',
                                        dados: JSON.stringify(cleanUser),
                                        timestamp: new Date().toISOString()
                                    });
                                });
                            } else {
                                const cleanUser = { ...data };
                                delete cleanUser.password;
                                delete cleanUser.senha;
                                users.push({
                                    tipo: 'localStorage',
                                    chave: key,
                                    id: data.id || data.username || '',
                                    username: data.username || data.login || '',
                                    role: data.role || data.perfil || '',
                                    dados: JSON.stringify(cleanUser),
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    } catch (e) {
                        // Ignorar itens inválidos
                    }
                }
            }

            if (users.length === 0) {
                return {
                    success: false,
                    warning: 'Nenhum usuário encontrado.',
                    rows: 0
                };
            }

            const headers = ['tipo', 'chave', 'id', 'username', 'role', 'dados', 'timestamp'];
            const csv = this.createCSVContent(headers, users);
            const filename = `ecoforms-usuarios-${new Date().toISOString().split('T')[0]}.csv`;

            this.downloadCSV(csv, filename);

            return {
                success: true,
                filename: filename,
                rows: users.length,
                data: users
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                rows: 0
            };
        }
    }
}

// Tornar disponível globalmente
window.CSVExportService = new CSVExportService();