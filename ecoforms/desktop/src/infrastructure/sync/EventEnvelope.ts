// ⚠️ ESPELHO de www/js/sync/EventEnvelope.js
// Alterações aqui devem ser refletidas lá.
import { stableStringify, uuidv7 } from 'ecoforms-core';

export const EcoFormsEventTypes = [
    'demanda.criada',
    'demanda.aceita',
    'demanda.encerrada',
    'demanda.encaminhada',
    'demanda.reencaminhada',
    'task.criada',
    'task.concluida',
    'task.movida',
    'task.atualizada',
    'task.arquivada',
    'task.desarquivada',
    'task.excluida',
    'task.comentario_adicionado',
    'demanda.registro.criado',
    'pacotes.aprovada',
    'pacotes.rejeitada',
    'pacotes.reencaminhada',
    'crm.cliente.criado',
    'crm.cliente.atualizado',
    'roteiro.criado',
    'roteiro.atualizado',
    'crm.coleta.registrada',
    'ecoponto.remocao.agendada',
    'registro_formularios.atualizado',
    'registro_dados.atualizado',
    'usuario.criado',
    'usuario.atualizado',
    'org.config.atualizado',
    'ecoforms.registro.criado',
    'ecoforms.anexo.criado',
    'audit.registro',
    'module.publicado',
    'module.arquivado',
    'visuais_modulos.created',
    'visuais_modulos.updated',
    'visuais_modulos.deleted',
    'instancias_widgets_usuario.created',
    'instancias_widgets_usuario.updated',
    'instancias_widgets_usuario.deleted',
    'agendamento.criado',
    'agendamento.confirmado',
    'agendamento.cancelado',
    'agendamento.realizado',
    'agendamento.despachado',
    'agendamento.slot_publicado',
    'agendamento.slot_cancelado',
    'execucao.criada',
    'execucao.status_atualizado',
    'execucao.excluida',
    'intercorrencia.registrada',
    'intercorrencia.resolvida',
    'roteiro_cliente.vinculado',
    'roteiro_cliente.desvinculado',
    'roteiro_cliente.reordenado',
    'execucao_cliente.registrado',
    'checklist.atualizado',
] as const;

export type EcoFormsEventType = typeof EcoFormsEventTypes[number];

export interface EventSource {
    device_id: string;
    routing_id: string;
    routing_type: string;
    module: string;
    app_version: string;
}

export interface EventEnvelope {
    v: 2;
    id: string;
    type: EcoFormsEventType | string;
    source: EventSource;
    aggregate: { type: string; id: string };
    time: string;
    schema_version: number;
    seq: number;
    prev_event_id: string | null;
    correlation_id: string | null;
    causation_id: string | null;
    stream_id: string | null;
    data: unknown;
    checksum: string;
}

export interface CreateEnvelopeParams {
    id?: string;
    type: EcoFormsEventType | string;
    aggregate_type?: string;
    aggregate_id?: string;
    data: unknown;
    correlation_id?: string | null;
    causation_id?: string | null;
    stream_id?: string | null;
    prev_event_id?: string | null;
}

export async function buildChecksum(data: unknown): Promise<string> {
    const str = stableStringify(data);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return (
        'sha256:' +
        Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    );
}

export function createEnvelope(
    params: CreateEnvelopeParams,
    localSeq: number,
    deviceId: string,
    routingId: string,
    appVersion = '1.0.0',
): Omit<EventEnvelope, 'checksum'> & { checksum: string } {
    const id = params.id ?? uuidv7();
    return {
        v: 2,
        id,
        type: params.type,
        source: {
            device_id: deviceId,
            routing_id: routingId,
            routing_type: 'setor',
            module: 'ecoforms-desktop',
            app_version: appVersion,
        },
        aggregate: {
            type: params.aggregate_type ?? params.type.split('.')[0],
            id: params.aggregate_id ?? id,
        },
        time: new Date().toISOString(),
        schema_version: 1,
        seq: localSeq,
        prev_event_id: params.prev_event_id ?? null,
        correlation_id: params.correlation_id ?? null,
        causation_id: params.causation_id ?? null,
        stream_id: params.stream_id ?? null,
        data: params.data,
        checksum: '',
    };
}
