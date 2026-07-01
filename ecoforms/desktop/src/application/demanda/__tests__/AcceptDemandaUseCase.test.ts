import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AcceptDemandaUseCase } from '../AcceptDemandaUseCase';
import { InMemoryDemandaRepository } from '../../../test/fakes/InMemoryDemandaRepository';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { FixedClock } from '../../../test/fakes/FixedClock';
import { TaskProjectionService } from '../../task/TaskProjectionService';
import { Demanda } from '../../../domain/demanda/Demanda';
import type { DemandaProps } from '../../../domain/demanda/Demanda';
import type { SyncOutbox } from '../../ports/SyncOutboxPort';

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

describe('AcceptDemandaUseCase', () => {
  let repo: InMemoryDemandaRepository;
  let taskRepo: InMemoryTaskRepository;
  let clock: FixedClock;
  let syncOutbox: SyncOutbox;
  let taskProjection: TaskProjectionService;
  let sut: AcceptDemandaUseCase;

  beforeEach(() => {
    repo = new InMemoryDemandaRepository();
    taskRepo = new InMemoryTaskRepository();
    clock = new FixedClock('2026-04-28T10:00:00Z');
    syncOutbox = {
      write: vi.fn(),
    } as unknown as SyncOutbox;
    taskProjection = new TaskProjectionService(
      taskRepo,
      (tf) => repo.saveTarefaFormulario(tf),
      clock,
      syncOutbox,
    );
    sut = new AcceptDemandaUseCase(repo, taskProjection, clock, syncOutbox);
  });

  it('deve aceitar uma demanda e criar tarefas e formulários vinculados', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({
      id: demandaId,
      origemTipo: 'ouvidoria',
      origemId: 'ouv-123',
      solicitanteId: 'ouv-user',
      destinatarioId: 'setor-operacional',
      tipoAcao: 'Vistoria',
      descricao: 'Descrição',
      status: 'aberta',
      politicaConclusao: 'todas',
    }));

    const input = {
      demandaId,
      aceitoPor: 'gerente-1',
      tarefas: [
        {
          titulo: 'Vistoria de Campo',
          descricao: 'Realizar vistoria',
          formularios: [
            {
              formRegistryId: 'form-vistoria',
              formSnapshot: { campos: [] },
              ordem: 0,
              obrigatorio: true
            }
          ]
        }
      ]
    };

    await sut.execute(input);

    const demanda = await repo.findById(demandaId);
    expect(demanda?.status).toBe('aceita');
    expect(demanda?.aceitoPor).toBe('gerente-1');

    const tarefas = await taskRepo.findByOrigin('demanda', demandaId);
    expect(tarefas).toHaveLength(1);
    expect(tarefas[0].titulo).toBe('Vistoria de Campo');
    expect(tarefas[0].toProps().origemId).toBe(demandaId);

    const formulários = await repo.findTarefaFormularios(tarefas[0].id);
    expect(formulários).toHaveLength(1);
    expect(formulários[0].formRegistryId).toBe('form-vistoria');

    const eventos = await repo.findEventos(demandaId);
    expect(eventos.some(e => e.type === 'demanda.aceita')).toBe(true);
    expect(eventos.some(e => e.type === 'task.criada')).toBe(true);

    expect(syncOutbox.write).toHaveBeenCalled();
  });

  it('deve lançar erro se a demanda já estiver aceita', async () => {
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aceita' }));

    const input = { demandaId, aceitoPor: 'user', tarefas: [] };

    await expect(sut.execute(input)).rejects.toThrow('Apenas demandas com status \'aberta\' podem ser aceitas');
  });

  it('publica os eventos de sync (task.criada e demanda.aceita) somente apos a transacao externa commitar', async () => {
    // TaskProjectionService.project() abre sua propria transaction() internamente, mas quando
    // chamado de dentro da transaction() externa deste use case, TauriSqliteAdapter reaproveita a
    // transacao ja aberta (nao gera um novo BEGIN) — entao um sync.write feito por project() logo
    // apos sua transaction() interna ainda executaria DENTRO da transaction() externa ainda aberta,
    // travando o mutex estatico do adaptador (mesma causa raiz corrigida em TaskProjectionService).
    // Este teste usa fakes in-memory (sem lock real) para travar o CONTRATO: nenhum sync.write pode
    // disparar antes da transaction() externa deste use case ter retornado.
    const demandaId = 'demanda-1';
    await repo.save(makeDemanda({ id: demandaId, status: 'aberta' }));

    const events: string[] = [];
    const originalTransaction = repo.transaction.bind(repo);
    vi.spyOn(repo, 'transaction').mockImplementation(async (fn) => {
      events.push('outer-transaction:start');
      const result = await originalTransaction(fn);
      events.push('outer-transaction:commit');
      return result;
    });
    vi.mocked(syncOutbox.write).mockImplementation(async (type) => {
      events.push(`sync:write:${type}`);
    });

    await sut.execute({
      demandaId,
      aceitoPor: 'gerente-1',
      tarefas: [
        { titulo: 'Tarefa A', formularios: [] },
        { titulo: 'Tarefa B', formularios: [] },
      ],
    });

    const commitIndex = events.indexOf('outer-transaction:commit');
    const firstSyncWriteIndex = events.findIndex(e => e.startsWith('sync:write:'));
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(firstSyncWriteIndex).toBeGreaterThan(commitIndex);
    expect(events.filter(e => e === 'sync:write:task.criada')).toHaveLength(2);
    expect(events.filter(e => e === 'sync:write:demanda.aceita')).toHaveLength(1);
  });
});
