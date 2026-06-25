import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloseDemandaUseCase } from '../CloseDemandaUseCase';
import { InMemoryDemandaRepository } from '../../../test/fakes/InMemoryDemandaRepository';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { FixedClock } from '../../../test/fakes/FixedClock';
import { Demanda } from '../../../domain/demanda/Demanda';
import { Task } from '../../../domain/task/Task';
import type { DemandaProps } from '../../../domain/demanda/Demanda';
import type { DemandaTaskSynchronizer } from '../services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../../../infrastructure/sync/SyncOutbox';

function makeFakeSyncOutbox() {
    const writes: Array<{ type: string; data: Record<string, unknown> }> = [];
    return {
        writes,
        outbox: {
            write: vi.fn(async (type: string, data: Record<string, unknown>) => {
                writes.push({ type, data });
            }),
        } as unknown as SyncOutbox,
    };
}

function makeDemanda(partial: Partial<DemandaProps> & { id: string }): Demanda {
  return Demanda.fromProps({
    origemTipo: 'interno',
    origemId: null,
    solicitanteId: 'test-user',
    destinatarioId: 'test-setor',
    tipoAcao: null,
    descricao: 'Descrição de teste',
    status: 'aberta',
    politicaConclusao: 'declarado',
    autoAceite: false,
    aceitoPor: null,
    aceitoEm: null,
    encerradoPor: null,
    encerradoEm: null,
    criadaEm: '2026-04-28T09:00:00Z',
    arquivadaEm: null,
    arquivoPath: null,
    archiveStatus: null,
    ...partial,
  });
}

describe('CloseDemandaUseCase', () => {
  let repo: InMemoryDemandaRepository;
  let taskRepo: InMemoryTaskRepository;
  let clock: FixedClock;
  let synchronizer: DemandaTaskSynchronizer;
  let syncOutbox: SyncOutbox;
  let fakeSync: ReturnType<typeof makeFakeSyncOutbox>;
  let sut: CloseDemandaUseCase;

  beforeEach(() => {
    repo = new InMemoryDemandaRepository();
    taskRepo = new InMemoryTaskRepository();
    clock = new FixedClock('2026-04-28T10:00:00Z');
    synchronizer = {
      aoMoverTask: vi.fn(),
      aoArquivarTask: vi.fn(),
      aoEncerrarDemanda: vi.fn(async (demandaId: string) => {
        const taskList = await taskRepo.findByDemandaId(demandaId);
        for (const t of taskList) {
          if (t.status === 'concluido' || t.status === 'cancelado') continue;
          t.transitionTo('cancelado');
          await taskRepo.save(t);
        }
      }),
    } as unknown as DemandaTaskSynchronizer;
    fakeSync = makeFakeSyncOutbox();
    syncOutbox = fakeSync.outbox;
    sut = new CloseDemandaUseCase(repo, clock, synchronizer, syncOutbox);
  });

  it('deve encerrar demanda com política "declarado" mesmo com tarefas pendentes', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita', politicaConclusao: 'declarado' }));

    await sut.execute({ demandaId, encerradoPor: 'gerente-1' });

    const demanda = await repo.findById(demandaId);
    expect(demanda?.status).toBe('concluida');
  });

  it('deve lançar erro ao encerrar demanda "todas" se houver pendências', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita', politicaConclusao: 'todas' }));

    repo.allTarefasObrigatoriasConcluidasParaDemanda = async () => false;

    await expect(sut.execute({ demandaId, encerradoPor: 'user' }))
      .rejects.toThrow('há tarefas pendentes para esta demanda');
  });

  it('deve encerrar demanda "todas" se todas as tarefas estiverem concluídas', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita', politicaConclusao: 'todas' }));

    repo.allTarefasObrigatoriasConcluidasParaDemanda = async () => true;

    await sut.execute({ demandaId, encerradoPor: 'user' });

    const demanda = await repo.findById(demandaId);
    expect(demanda?.status).toBe('concluida');
  });

  it('deve escrever sync.demanda.encerrada após encerrar', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita', politicaConclusao: 'declarado' }));

    await sut.execute({ demandaId, encerradoPor: 'gerente-1' });

    expect(fakeSync.writes.some(w => w.type === 'demanda.encerrada' && w.data['encerrado_por'] === 'gerente-1')).toBe(true);
    expect(synchronizer.aoEncerrarDemanda).toHaveBeenCalledWith(demandaId);
  });

  it('deve cancelar tasks pendentes via synchronizer após encerramento', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita', politicaConclusao: 'declarado' }));

    await taskRepo.save(Task.fromProps({
      id: 'task-1', titulo: 'T1', status: 'a_fazer', prioridade: 'media', ordem: 1000,
      criadoPor: 'user-1', projetoId: null, demandaId, arquivado: false,
    }));
    await taskRepo.save(Task.fromProps({
      id: 'task-2', titulo: 'T2', status: 'em_progresso', prioridade: 'alta', ordem: 2000,
      criadoPor: 'user-1', projetoId: null, demandaId, arquivado: false,
    }));
    await taskRepo.save(Task.fromProps({
      id: 'task-3', titulo: 'T3', status: 'concluido', prioridade: 'media', ordem: 3000,
      criadoPor: 'user-1', projetoId: null, demandaId, arquivado: false,
    }));

    await sut.execute({ demandaId, encerradoPor: 'gerente-1' });

    const t1 = await taskRepo.findById('task-1');
    const t2 = await taskRepo.findById('task-2');
    const t3 = await taskRepo.findById('task-3');

    expect(t1?.status).toBe('cancelado');
    expect(t2?.status).toBe('cancelado');
    expect(t3?.status).toBe('concluido');
  });
});
