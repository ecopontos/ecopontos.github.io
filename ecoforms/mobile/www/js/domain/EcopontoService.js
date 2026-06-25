class EcopontoService {
    constructor(store, sync) {
        this.store = store;
        this.sync = sync;
        this.userId = '00000000-0000-0000-0000-000000000000';
    }

    setUserId(userId) {
        this.userId = userId || this.userId;
    }

    async saveCaixasIncremental(formData) {
        const ecopontoId = formData.data.ecoponto;
        const evento = formData.data.incrementalEvento || formData.data.caixas_list?.incrementalEvento;

        if (!ecopontoId || !evento) {
            console.warn('⚠️ Dados incrementais incompletos, salvando como registro normal');
            return this.saveFormData({ ...formData, incremental: false });
        }

        const caixaId = evento.caixaId;
        const nivelNovo = evento.nivel;
        const isRemoved = evento.removed || false;
        const storeKey = `ecoponto_ocupacao_${ecopontoId}`;
        let estadoAtual = await this.getEcopontoEstado(storeKey);

        if (!estadoAtual) {
            estadoAtual = {
                ecoponto_id: ecopontoId,
                nome_ecoponto: formData.data.ecopontoLabel || formData.data.ecoponto,
                ocupacao: {},
                resumo: { total_caixas: 7, caixas_criticas: 0, caixas_preenchidas: 0, caixas_removidas: 0 },
                historico: []
            };
        }

        const nivelAnterior = estadoAtual.ocupacao[caixaId] || '';
        if (isRemoved) {
            delete estadoAtual.ocupacao[caixaId];
        } else {
            estadoAtual.ocupacao[caixaId] = nivelNovo;
        }

        const ocupacoes = Object.values(estadoAtual.ocupacao).filter(v => v && v !== '');
        estadoAtual.resumo = {
            total_caixas: 7,
            caixas_criticas: ocupacoes.filter(v => parseInt(v) >= 80).length,
            caixas_preenchidas: ocupacoes.length,
            caixas_removidas: estadoAtual.historico.filter(h => h.acao === 'remove').length
        };

        const uuidGen = window.uuidGenerator;
        estadoAtual.historico.push({
            caixa_id: caixaId,
            ocupacao_anterior: nivelAnterior,
            ocupacao_nova: isRemoved ? null : nivelNovo,
            acao: isRemoved ? 'remove' : (nivelAnterior ? 'update' : 'add'),
            timestamp: evento.timestamp || new Date().toISOString(),
            evento_id: evento.id || (uuidGen ? uuidGen.generateUUID() : uuidv7())
        });

        const builder = window.professionalJsonbBuilder;
        if (builder) {
            builder.userId = this.userId;
            estadoAtual.professional_jsonb = builder.createProfessionalJSONB(formData);
        }

        estadoAtual.updated_at = new Date().toISOString();
        estadoAtual.device_id = formData.deviceId || formData.data?.meta?.deviceId;
        estadoAtual.user_id = this.userId;
        estadoAtual.syncStatus = 'pending';

        await this.saveEcopontoEstado(storeKey, estadoAtual);

        if (navigator.onLine && this.sync && this.sync.supabaseClient) {
            setTimeout(() => this.sync.syncEcopontoOcupacao(estadoAtual), 1000);
        }

        return storeKey;
    }

    async getEcopontoEstado(storeKey) {
        return this.store.getByKey(storeKey);
    }

    async saveEcopontoEstado(storeKey, estado) {
        return this.store.put({ ...estado, id: storeKey });
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

    calculateTotalResiduos(residuos) {
        return this.normalizeResiduos(residuos).length;
    }

    classifyEntrega(residuos) {
        const lista = this.normalizeResiduos(residuos);
        if (lista.length === 0) return 'vazia';
        if (lista.length === 1) return 'simples';
        if (lista.length <= 3) return 'mista';
        return 'complexa';
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

if (typeof window !== 'undefined') {
    window.EcopontoService = EcopontoService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EcopontoService };
}
