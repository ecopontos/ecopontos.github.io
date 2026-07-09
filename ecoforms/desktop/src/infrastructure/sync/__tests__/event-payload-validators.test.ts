import { describe, expect, it } from 'vitest';
import type { EcoFormsEventType, EventEnvelope } from '../EventEnvelope';
import { validateEventPayload } from '../EventPayloadValidators';

function envelope(type: string, aggregateId: string, data: Record<string, unknown>): EventEnvelope {
    return {
        v: 2,
        id: `evt-${type}`,
        type: type as EcoFormsEventType,
        source: {
            device_id: 'device-1',
            routing_id: 'setor-1',
            routing_type: 'setor',
            module: 'ecoforms-test',
            app_version: '1.0.0',
        },
        aggregate: { type: type.split('.')[0], id: aggregateId },
        time: '2026-06-15T12:00:00.000Z',
        schema_version: 1,
        seq: 1,
        prev_event_id: null,
        correlation_id: null,
        causation_id: null,
        stream_id: null,
        data,
        checksum: 'sha256:test',
    };
}

describe('EventPayloadValidators', () => {
    it('accepts canonical task.criada payload', () => {
        const errors = validateEventPayload(envelope('task.criada', 'task-1', {
            id: 'task-1',
            titulo: 'Tarefa',
            status: 'a_fazer',
            prioridade: 'media',
            criado_por: 'user-1',
        }));

        expect(errors).toEqual([]);
    });

    it('rejects task.criada without payload id', () => {
        const errors = validateEventPayload(envelope('task.criada', 'task-1', {
            titulo: 'Tarefa sem id',
        }));

        expect(errors).toContain('id is required');
    });

    it('rejects invalid task status enum', () => {
        const errors = validateEventPayload(envelope('task.atualizada', 'task-1', {
            tarefa_id: 'task-1',
            status: 'feito',
        }));

        expect(errors.some(error => error.includes('status must be one of'))).toBe(true);
    });

    it('rejects usuario.atualizado with no recognised fields', () => {
        const errors = validateEventPayload(envelope('usuario.atualizado', 'user-1', {
            cargo: 'externo',
        }));

        expect(errors).toContain('usuario.atualizado must include at least one recognised field');
    });

    it('rejects manifestacao.criada with unknown payload columns', () => {
        const errors = validateEventPayload(envelope('manifestacao.criada', 'mani-1', {
            protocolo: 'OUV-001',
            coluna_inexistente: 'x',
        }));

        expect(errors).toContain('coluna_inexistente is not an allowed manifestacao field');
    });

    it('rejects manifestacao.criada when payload id differs from aggregate id', () => {
        const errors = validateEventPayload(envelope('manifestacao.criada', 'mani-1', {
            id: 'mani-2',
            protocolo: 'OUV-002',
        }));

        expect(errors).toContain('id must match aggregate.id');
    });

    it('accepts legacy manifestacao.criada payload with manifestacaoId alias', () => {
        const errors = validateEventPayload(envelope('manifestacao.criada', 'mani-1', {
            manifestacaoId: 'mani-1',
        }));

        expect(errors).toEqual([]);
    });

    it('requires package id for suite events', () => {
        const errors = validateEventPayload(envelope('suite.aprovada', 'suite-1', {
            status: 'approved',
        }));

        expect(errors).toContain('packageId or suiteId is required');
    });

    it('accepts client events with id or uuid', () => {
        expect(validateEventPayload(envelope('client.criado', 'client-1', {
            uuid: 'client-1',
            Cliente: 'Cliente A',
        }))).toEqual([]);
    });
});
