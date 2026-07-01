import { describe, it, expect, vi } from 'vitest';
import { TaskProjectionService } from '../TaskProjectionService';
import type { TaskRepository } from '../../../domain/task/TaskRepository';
import type { SyncOutbox } from '../../ports/SyncOutboxPort';
import type { ClockPort } from '../../ports/ClockPort';

describe('TaskProjectionService', () => {
    it('publica o evento task.criada somente apos a transacao commitar, nunca de dentro dela', async () => {
        const events: string[] = [];

        const taskRepo = {
            transaction: vi.fn(async (fn: (tx: TaskRepository) => Promise<unknown>) => {
                events.push('transaction:start');
                const txRepo = {
                    nextOrder: vi.fn().mockResolvedValue(1),
                    save: vi.fn(async () => { events.push('task:saved'); }),
                } as unknown as TaskRepository;
                const result = await fn(txRepo);
                events.push('transaction:commit');
                return result;
            }),
        } as unknown as TaskRepository;

        const clock: ClockPort = { now: () => new Date(), nowIso: () => '2026-07-01T00:00:00.000Z' };

        const sync: SyncOutbox = {
            write: vi.fn(async () => { events.push('sync:write'); }),
        };

        const service = new TaskProjectionService(taskRepo, async () => {}, clock, sync);

        await service.project({
            titulo: 'Teste',
            setorId: null,
            criadoPor: 'user-1',
            origemTipo: 'agendamento',
            origemId: 'ag-1',
        });

        // Nested writes inside taskRepo.transaction() deadlock TauriSqliteAdapter in production
        // (its execute() always re-acquires the adapter's static lock instead of reusing the
        // already-open transaction, unlike transaction() itself). sync.write() must run strictly
        // after the transaction has committed, never from inside the callback.
        expect(events).toEqual(['transaction:start', 'task:saved', 'transaction:commit', 'sync:write']);
        expect(sync.write).toHaveBeenCalledWith(
            'task.criada',
            expect.objectContaining({ titulo: 'Teste', origem_tipo: 'agendamento', origem_id: 'ag-1' }),
            expect.objectContaining({ streamId: 'ag-1' }),
        );
    });
});
