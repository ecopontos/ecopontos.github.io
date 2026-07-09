// ⚠️ ESPELHO de www/js/sync/EventEnvelope.js
// Alterações aqui devem ser refletidas lá.
import { stableStringify, uuidv7 } from 'ecoforms-core';

export const EcoFormsEventTypes = [
    'acesso.turno.log',
    'agendamento.criado',
    'agendamento.confirmado',
    'agendamento.cancelado',
    'agendamento.realizado',
    'agendamento.despachado',
    'agendamento.slot_publicado',
    'agendamento.slot_cancelado',
    'audit.registro',
    'client.criado',
    'client.atualizado',
    'crm.cliente.criado',
    'crm.cliente.atualizado',
    'crm.coleta.registrada',
    'data_registry.atualizado',
    'demanda.criada',
    'demanda.aceita',
    'demanda.encerrada',
    'demanda.encaminhada',
    'demanda.reencaminhada',
    'demanda.registro.criado',
    'demanda.tarefa.criada',
    'demanda.tarefa.concluida',
    'despacho.registrado',
    'ecoforms.anexo.criado',
    'ecoforms.registro.criado',
    'ecoforms.task.snapshot',
    'ecoforms.tarefa.concluida',
    'ecoponto.remocao.agendada',
    'execucao.criada',
    'execucao.status_atualizado',
    'form_registry.atualizado',
    'instancias_widgets_usuario.created',
    'instancias_widgets_usuario.updated',
    'instancias_widgets_usuario.deleted',
    'intercorrencia.registrada',
    'intercorrencia.resolvida',
    'manifestacao.criada',
    'manifestacao.status_atualizado',
    'module.publicado',
    'module.arquivado',
    'org.config.atualizado',
    'prazo.adicionado',
    'resposta.registrada',
    'roteiro.criado',
    'roteiro.atualizado',
    'suite.aprovada',
    'suite.aprovado',
    'suite.rejeitada',
    'suite.devolvida',
    'suite.solicitada',
    'suite.reencaminhada',
    'suite.editado',
    'tarefa.criada',
    'task.criada',
    'task.movida',
    'task.concluida',
    'task.atualizada',
    'task.arquivada',
    'task.desarquivada',
    'task.excluida',
    'task.comentario_adicionado',
    'tramitacao.registrada',
    'usuario.criado',
    'usuario.atualizado',
    'visuais_modulos.created',
    'visuais_modulos.updated',
    'visuais_modulos.deleted',
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

export interface EnvelopeValidationOptions {
    requireChecksum?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): boolean {
    return value === null || typeof value === 'string';
}

export function validateEventEnvelope(
    envelope: unknown,
    options: EnvelopeValidationOptions = {},
): string[] {
    const errors: string[] = [];
    if (!isRecord(envelope)) return ['envelope must be an object'];

    if (envelope.v !== 2) errors.push('v must be 2');
    if (!isNonEmptyString(envelope.id)) errors.push('id is required');
    if (!isNonEmptyString(envelope.type)) errors.push('type is required');
    if (!isNonEmptyString(envelope.time)) errors.push('time is required');
    if (!Number.isInteger(envelope.schema_version) || (envelope.schema_version as number) < 1) {
        errors.push('schema_version must be a positive integer');
    }
    if (!Number.isInteger(envelope.seq) || (envelope.seq as number) < 0) {
        errors.push('seq must be a non-negative integer');
    }
    if (!isNullableString(envelope.prev_event_id)) errors.push('prev_event_id must be string or null');
    if (!isNullableString(envelope.correlation_id)) errors.push('correlation_id must be string or null');
    if (!isNullableString(envelope.causation_id)) errors.push('causation_id must be string or null');
    if ('stream_id' in envelope && !isNullableString(envelope.stream_id)) {
        errors.push('stream_id must be string or null');
    }

    if (!isRecord(envelope.source)) {
        errors.push('source must be an object');
    } else {
        if (!isNonEmptyString(envelope.source.routing_id)) errors.push('source.routing_id is required');
        if (!isNonEmptyString(envelope.source.routing_type)) errors.push('source.routing_type is required');
        if (!isNonEmptyString(envelope.source.module)) errors.push('source.module is required');
        if (!isNonEmptyString(envelope.source.app_version)) errors.push('source.app_version is required');
        if ('device_id' in envelope.source && envelope.source.device_id !== undefined && !isNonEmptyString(envelope.source.device_id)) {
            errors.push('source.device_id must be non-empty when present');
        }
    }

    if (!isRecord(envelope.aggregate)) {
        errors.push('aggregate must be an object');
    } else {
        if (!isNonEmptyString(envelope.aggregate.type)) errors.push('aggregate.type is required');
        if (!isNonEmptyString(envelope.aggregate.id)) errors.push('aggregate.id is required');
    }

    if (envelope.data === null || envelope.data === undefined) {
        errors.push('data is required');
    } else if (typeof envelope.data !== 'object') {
        errors.push('data must be an object or array');
    }

    if (options.requireChecksum !== false && !isNonEmptyString(envelope.checksum)) {
        errors.push('checksum is required');
    }

    return errors;
}

export function assertValidEventEnvelope(
    envelope: unknown,
    options: EnvelopeValidationOptions = {},
): asserts envelope is EventEnvelope {
    const errors = validateEventEnvelope(envelope, options);
    if (errors.length > 0) {
        throw new Error(`Invalid EventEnvelope: ${errors.join('; ')}`);
    }
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
