import { uuidv7 } from 'ecoforms-core';
import { ServiceSlot } from '../../domain/service/ServiceSlot';
import type { ServiceSlotRepository } from '../../domain/service/ServiceSlotRepository';
import type { ServiceTypeRepository } from '../../domain/service/ServiceTypeRepository';
import { expandRecurrence } from './RecurrenceEngine';

export interface AberturaRegra {
    tipo: 'imediato' | 'antecedencia_dias' | 'data_especifica';
    antecedencia_dias?: number;
}

export interface CreateServiceSlotInput {
    serviceTypeId: string;
    titulo: string;
    descricao?: string;
    dataInicio: string;
    dataFim: string;
    tipoPrazo?: 'unico' | 'periodo' | 'recorrente';
    recorrencia?: string;
    capacidade?: number;
    bairros?: string[];
    local?: string;
    aberturaEm?: string;
    userId: string;
}

export class CreateServiceSlotUseCase {
    constructor(
        private readonly repo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
    ) {}

    async execute(input: CreateServiceSlotInput): Promise<string> {
        const type = await this.typeRepo.findById(input.serviceTypeId);
        if (!type) throw new Error('Tipo de serviço não encontrado');
        if (!type.ativo) throw new Error('Tipo de serviço inativo');

        const id = uuidv7();
        const now = new Date().toISOString();

        // Calcula abertura_em a partir da regra do tipo
        let aberturaEm: string | null = input.aberturaEm ?? null;
        const regraRaw = (type as unknown as { aberturaRegra?: string }).aberturaRegra;
        if (!aberturaEm && regraRaw) {
            try {
                const regra: AberturaRegra = JSON.parse(regraRaw);
                if (regra.tipo === 'antecedencia_dias' && regra.antecedencia_dias) {
                    const d = new Date(input.dataInicio);
                    d.setDate(d.getDate() - regra.antecedencia_dias);
                    aberturaEm = d.toISOString();
                }
            } catch (err) {
                console.error('[CreateServiceSlotUseCase] abertura_regra inválida:', regraRaw, err);
                throw new Error('Regra de abertura do slot é inválida. Verifique o formato JSON.');
            }
        }

        // Para slots recorrentes, expande em múltiplas ocorrências
        if (input.tipoPrazo === 'recorrente' && input.recorrencia) {
            let recorrenciaConfig: Parameters<typeof expandRecurrence>[2];
            try {
                recorrenciaConfig = JSON.parse(input.recorrencia);
            } catch {
                throw new Error('Configuração de recorrência inválida. Verifique o formato JSON.');
            }
            const occurrences = expandRecurrence(input.dataInicio, input.dataFim, recorrenciaConfig);
            const total = occurrences.length;
            const firstId = uuidv7();

            for (let i = 0; i < total; i++) {
                const occ = occurrences[i];
                const occId = i === 0 ? firstId : uuidv7();
                const suffix = total > 1 ? ` (${i + 1}/${total})` : '';
                const slot = ServiceSlot.fromProps({
                    id: occId,
                    serviceTypeId: input.serviceTypeId,
                    titulo: input.titulo + suffix,
                    descricao: input.descricao ?? null,
                    dataInicio: occ.dataInicio,
                    dataFim: occ.dataFim,
                    tipoPrazo: 'recorrente',
                    recorrencia: input.recorrencia ?? null,
                    capacidade: input.capacidade ?? null,
                    bairros: input.bairros ?? [],
                    local: input.local ?? null,
                    vagasOcupadas: 0,
                    status: 'rascunho',
                    aberturaEm: aberturaEm ?? undefined,
                    criadoPor: input.userId,
                    criadoEm: now,
                    atualizadoEm: now,
                });
                await this.repo.save(slot);
            }

            return firstId;
        }

        const slot = ServiceSlot.fromProps({
            id,
            serviceTypeId: input.serviceTypeId,
            titulo: input.titulo,
            descricao: input.descricao ?? null,
            dataInicio: input.dataInicio,
            dataFim: input.dataFim,
            tipoPrazo: input.tipoPrazo ?? 'periodo',
            recorrencia: input.recorrencia ?? null,
            capacidade: input.capacidade ?? null,
            bairros: input.bairros ?? [],
            local: input.local ?? null,
            vagasOcupadas: 0,
            status: 'rascunho',
            aberturaEm: aberturaEm ?? undefined,
            criadoPor: input.userId,
            criadoEm: now,
            atualizadoEm: now,
        });

        await this.repo.save(slot);

        return id;
    }
}
