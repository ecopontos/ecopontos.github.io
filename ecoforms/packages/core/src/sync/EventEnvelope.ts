/**
 * EventEnvelope unificado — usado por mobile e desktop.
 *
 * Versão: 2
 * Protocolo de sincronização com idempotência e checksums.
 */

import { uuidv7 } from '../utils/uuidv7.js';

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

export interface EventEnvelope {
  v: 2;
  id: string;
  type: EcoFormsEventType;
  source: {
    device_id?: string;
    routing_id: string;
    routing_type: 'setor' | 'user';
    module: string;
    app_version: string;
  };
  aggregate: {
    type: string;
    id: string;
  };
  time: string;
  schema_version: number;
  seq: number;
  prev_event_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  data: Record<string, unknown>;
  checksum: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export async function buildChecksum(data: Record<string, unknown>): Promise<string> {
  const str = stableStringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return (
    'sha256:' +
    Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export interface CreateEnvelopeInput {
  id?: string;
  type: EcoFormsEventType;
  aggregate_type?: string;
  aggregate_id?: string;
  data: Record<string, unknown>;
  correlation_id?: string | null;
  causation_id?: string | null;
  prev_event_id?: string | null;
}

export function createEnvelope(
  input: CreateEnvelopeInput,
  localSeq: number,
  deviceId: string | undefined,
  routingId: string,
  appVersion = '1.0.0'
): EventEnvelope {
  const id = input.id || uuidv7();
  return {
    v: 2,
    id,
    type: input.type,
    source: {
      device_id: deviceId || undefined,
      routing_id: routingId,
      routing_type: 'setor',
      module: 'ecoforms',
      app_version: appVersion,
    },
    aggregate: {
      type: input.aggregate_type || input.type.split('.')[0],
      id: input.aggregate_id || id,
    },
    time: new Date().toISOString(),
    schema_version: 1,
    seq: localSeq,
    prev_event_id: input.prev_event_id ?? null,
    correlation_id: input.correlation_id ?? null,
    causation_id: input.causation_id ?? null,
    data: input.data,
    checksum: '',
  };
}

export async function sealEnvelope(
  envelope: EventEnvelope
): Promise<EventEnvelope> {
  return {
    ...envelope,
    checksum: await buildChecksum(envelope.data),
  };
}
