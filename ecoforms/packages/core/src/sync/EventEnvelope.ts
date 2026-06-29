/**
 * EventEnvelope unificado — usado por mobile e desktop.
 *
 * Versão: 2
 * Protocolo de sincronização com idempotência e checksums.
 */

import { uuidv7 } from '../utils/uuidv7.js';

export type EcoFormsEventType =
  | 'demanda.criada'
  | 'demanda.aceita'
  | 'demanda.encerrada'
  | 'demanda.tarefa.criada'
  | 'demanda.tarefa.concluida'
  | 'demanda.encaminhada'
  | 'demanda.reencaminhada'
  | 'demanda.registro.criado'
  | 'suite.aprovada'
  | 'suite.rejeitada'
  | 'suite.devolvida'
  | 'suite.solicitada'
  | 'suite.reencaminhada'
  | 'crm.cliente.criado'
  | 'crm.cliente.atualizado'
  | 'roteiro.criado'
  | 'roteiro.atualizado'
  | 'crm.coleta.registrada'
  | 'client.criado'
  | 'client.atualizado'
  | 'ecoponto.remocao.agendada'
  | 'form_registry.atualizado'
  | 'data_registry.atualizado'
  | 'usuario.criado'
  | 'usuario.atualizado'
  | 'org.config.atualizado'
  | 'ecoforms.task.snapshot'
  | 'ecoforms.registro.criado'
  | 'ecoforms.tarefa.concluida'
  | 'ecoforms.anexo.criado'
  | 'audit.registro'
  | 'tarefa.criada'
  | 'task.criada'
  | 'task.movida'
  | 'task.concluida'
  | 'task.atualizada'
  | 'task.arquivada'
  | 'task.desarquivada'
  | 'task.excluida'
  | 'task.comentario_adicionado'
  | 'module.publicado'
  | 'module.arquivado'
  | 'agendamento.criado'
  | 'agendamento.confirmado'
  | 'agendamento.cancelado'
  | 'agendamento.realizado'
  | 'agendamento.despachado'
  | 'agendamento.slot_publicado'
  | 'agendamento.slot_cancelado'
  | 'execucao.criada'
  | 'execucao.status_atualizado'
  | 'execucao.excluida'
  | 'intercorrencia.registrada'
  | 'intercorrencia.resolvida'
  | 'roteiro_cliente.vinculado'
  | 'roteiro_cliente.desvinculado'
  | 'roteiro_cliente.reordenado'
  | 'execucao_cliente.registrado'
  | 'checklist.atualizado';

export const EcoFormsEventTypes: EcoFormsEventType[] = [
  'demanda.criada',
  'demanda.aceita',
  'demanda.encerrada',
  'demanda.tarefa.criada',
  'demanda.tarefa.concluida',
  'demanda.encaminhada',
  'demanda.reencaminhada',
  'demanda.registro.criado',
  'suite.aprovada',
  'suite.rejeitada',
  'suite.devolvida',
  'suite.solicitada',
  'suite.reencaminhada',
  'crm.cliente.criado',
  'crm.cliente.atualizado',
  'roteiro.criado',
  'roteiro.atualizado',
  'crm.coleta.registrada',
  'client.criado',
  'client.atualizado',
  'ecoponto.remocao.agendada',
  'form_registry.atualizado',
  'data_registry.atualizado',
  'usuario.criado',
  'usuario.atualizado',
  'org.config.atualizado',
  'ecoforms.task.snapshot',
  'ecoforms.registro.criado',
  'ecoforms.tarefa.concluida',
  'ecoforms.anexo.criado',
  'audit.registro',
  'tarefa.criada',
  'task.criada',
  'task.movida',
  'task.concluida',
  'task.atualizada',
  'task.arquivada',
  'task.desarquivada',
  'task.excluida',
  'task.comentario_adicionado',
  'module.publicado',
  'module.arquivado',
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
];

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
