class ProfessionalJsonbBuilder {
    constructor() {
        this.userId = '00000000-0000-0000-0000-000000000000';
        this._ecopontoUtils = null;
    }

    _getEcopontoUtils() {
        if (!this._ecopontoUtils) {
            this._ecopontoUtils = window.ecopontoService || null;
        }
        return this._ecopontoUtils;
    }

    getUserProfile() {
        return window.authManager?.getCurrentUser()?.perfil ?? 'operador';
    }

    createProfessionalJSONB(formData) {
        const timestamp = new Date().toISOString();
        const formId = formData.formId || formData.formId || 'unknown';

        const professionalStructure = {
            metadata: {
                version: '2.0',
                schema: 'ecoforms-professional',
                created_at: timestamp,
                updated_at: timestamp,
                form_type: formId,
                sync_status: 'pending',
                source: 'mobile-app',
                quality: {
                    completeness: this.calculateCompleteness(formData),
                    validation_status: 'pending',
                    review_required: false
                }
            },
            usuario: {
                id: this.userId,
                nome: formData.usuario || formData.userName || 'Usuário',
                device_id: formData.deviceId || formData.device_id || null,
                perfil: this.getUserProfile()
            },
            localizacao: {
                timestamp: timestamp,
                origem: 'manual',
                confiabilidade: 'alta'
            }
        };

        switch (formId) {
            case 'ecopontoForm':
                return { ...professionalStructure, atendimento: this.createProfessionalAtendimento(formData) };
            case 'ecopontoCaixasForm':
                return { ...professionalStructure, inspecao: this.createProfessionalInspecaoCaixas(formData) };
            default:
                return { ...professionalStructure, dados: this.createProfessionalGenericData(formData) };
        }
    }

    createProfessionalAtendimento(formData) {
        const data = formData.data || formData;
        const ec = this._getEcopontoUtils();
        const du = window.dateUtils;
        return {
            identificacao: {
                placa_veiculo: ec ? ec.normalizePlaca(data.placa) : this.normalizePlaca(data.placa),
                tipo_veiculo: ec ? ec.detectVehicleType(data.placa) : this.detectVehicleType(data.placa),
                ecoponto: {
                    id: data.ecoponto,
                    nome: data.ecopontoLabel || data.ecoponto_nome || data.ecoponto,
                    bairro: data.bairro
                }
            },
            entrega: {
                timestamp: du ? du.combineDateTime(data.data, data.hora) : new Date().toISOString(),
                residuos: ec ? ec.normalizeResiduos(data.residuos) : this.normalizeResiduos(data.residuos),
                quantidade_total: ec ? ec.calculateTotalResiduos(data.residuos) : (Array.isArray(data.residuos) ? data.residuos.length : 0),
                classificacao: ec ? ec.classifyEntrega(data.residuos) : 'simples'
            },
            validacao: {
                placa_valida: ec ? ec.validatePlaca(data.placa) : this.validatePlaca(data.placa),
                residuos_permitidos: ec ? ec.validateResiduos(data.residuos) : this.validateResiduos(data.residuos),
                horario_permitido: ec ? ec.validateHorario(data.hora) : this.validateHorario(data.hora)
            }
        };
    }

    createProfessionalInspecaoCaixas(formData) {
        const data = formData.data || formData;
        const caixasList = data.caixas_list || {};
        const ec = this._getEcopontoUtils();
        return {
            ecoponto: {
                id: data.ecoponto,
                nome: data.ecopontoLabel || data.ecoponto_nome || data.ecoponto
            },
            ocupacao: {
                timestamp: data.timestamp || new Date().toISOString(),
                caixas: ec ? ec.normalizeCaixasOcupacao(caixasList) : this.normalizeCaixasOcupacao(caixasList),
                resumo: {
                    total: 7,
                    preenchidas: Object.keys(caixasList.ocupacao || {}).length,
                    criticas: ec ? ec.countCriticalBoxes(caixasList.ocupacao) : 0,
                    removidas: Object.keys(caixasList.removidas || {}).length,
                    taxa_ocupacao: ec ? ec.calculateOccupancyRate(caixasList.ocupacao) : 0
                }
            },
            evento: caixasList.incrementalEvento || null
        };
    }

    createProfessionalGenericData(formData) {
        const data = formData.data || formData;
        return {
            campos: this._cleanGenericData(data),
            resumo: {
                total_campos: Object.keys(data).length,
                campos_preenchidos: Object.keys(data).filter(k => data[k] !== null && data[k] !== undefined && data[k] !== '').length
            }
        };
    }

    _cleanGenericData(data) {
        const cleanData = {};
        const metadataFields = ['formId', 'formTitulo', 'tipo_form', 'usuario', 'user_id',
            'perfil', 'equipe', 'timestamp', 'device', 'incremental', 'activity_id'];
        for (const key in data) {
            if (data.hasOwnProperty(key) && !metadataFields.includes(key)) {
                cleanData[key] = data[key];
            }
        }
        return cleanData;
    }

    calculateCompleteness(formData) {
        const data = formData.data || formData;
        const camposPreenchidos = Object.keys(data).filter(key => {
            const valor = data[key];
            return valor !== null && valor !== undefined && valor !== '';
        }).length;
        const camposTotais = Object.keys(data).length;
        return camposTotais > 0 ? Math.round((camposPreenchidos / camposTotais) * 100) : 0;
    }

    extractCriticalFields(data) {
        const camposCriticos = ['placa', 'ecoponto', 'data', 'hora', 'residuos'];
        const encontrados = {};
        camposCriticos.forEach(campo => {
            if (data[campo] !== undefined && data[campo] !== null && data[campo] !== '') {
                encontrados[campo] = data[campo];
            }
        });
        return encontrados;
    }

    normalizePlaca(placa) {
        if (!placa) return null;
        return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    detectVehicleType(placa) {
        if (!placa) return 'desconhecido';
        const placaLimpa = this.normalizePlaca(placa);
        if (placaLimpa.length === 7 && /\d/.test(placaLimpa[3])) return 'mercosul';
        if (placaLimpa.length === 7 && /[A-Z]/.test(placaLimpa[3])) return 'antiga';
        return 'desconhecido';
    }

    validatePlaca(placa) {
        if (!placa) return false;
        return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(this.normalizePlaca(placa));
    }

    normalizeResiduos(residuos) {
        if (!residuos) return [];
        if (Array.isArray(residuos)) return residuos;
        if (typeof residuos === 'string') return residuos.split(',').map(r => r.trim());
        return [];
    }

    validateResiduos(residuos) {
        const lista = this.normalizeResiduos(residuos);
        const permitidos = ['entulho', 'madeira', 'poda', 'reciclavel', 'rejeito', 'sucata', 'vidro'];
        return lista.every(residuo => permitidos.includes(residuo.toLowerCase()));
    }

    validateHorario(hora) {
        if (!hora) return false;
        const [horas, minutos] = hora.split(':').map(Number);
        if (isNaN(horas) || isNaN(minutos)) return false;
        return horas >= 7 && horas <= 18;
    }

    normalizeCaixasOcupacao(caixasList) {
        const ocupacao = caixasList.ocupacao || {};
        const removidas = caixasList.removidas || {};
        const tiposCaixa = {
            1: { nome: 'Entulho', cor: 'bg-gray-500' },
            2: { nome: 'Madeira', cor: 'bg-amber-600' },
            3: { nome: 'Poda', cor: 'bg-green-600' },
            4: { nome: 'Reciclável', cor: 'bg-blue-500' },
            5: { nome: 'Rejeito', cor: 'bg-gray-600' },
            6: { nome: 'Sucata', cor: 'bg-yellow-500' },
            7: { nome: 'Vidro', cor: 'bg-cyan-500' }
        };
        return Object.keys(tiposCaixa).map(id => ({
            id: parseInt(id),
            nome: tiposCaixa[id].nome,
            cor: tiposCaixa[id].cor,
            ocupacao: ocupacao[id] || '',
            status: removidas[id] ? 'removida' : (ocupacao[id] ? 'ativa' : 'vazia'),
            nivel_critico: ocupacao[id] && parseInt(ocupacao[id]) >= 80
        }));
    }

    countCriticalBoxes(ocupacao) {
        if (!ocupacao) return 0;
        return Object.values(ocupacao).filter(nivel => parseInt(nivel) >= 80).length;
    }

    calculateOccupancyRate(ocupacao) {
        if (!ocupacao || Object.keys(ocupacao).length === 0) return 0;
        const valores = Object.values(ocupacao).filter(v => v && v !== '');
        if (valores.length === 0) return 0;
        const total = valores.reduce((sum, nivel) => sum + parseInt(nivel) || 0, 0);
        return Math.round(total / valores.length);
    }
}

const professionalJsonbBuilder = new ProfessionalJsonbBuilder();
if (typeof window !== 'undefined') {
    window.ProfessionalJsonbBuilder = ProfessionalJsonbBuilder;
    window.professionalJsonbBuilder = professionalJsonbBuilder;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfessionalJsonbBuilder, professionalJsonbBuilder };
}
