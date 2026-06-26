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
});
