import { describe, it, expect, beforeEach } from 'vitest';
import { GetDemandaStatusUseCase } from '../GetDemandaStatusUseCase';
import { InMemoryDemandaRepository } from '../../../test/fakes/InMemoryDemandaRepository';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { Demanda } from '../../../domain/demanda/Demanda';
import { Task } from '../../../domain/task/Task';

describe('GetDemandaStatusUseCase', () => {
  let repo: InMemoryDemandaRepository;
  let taskRepo: InMemoryTaskRepository;
  let sut: GetDemandaStatusUseCase;

  beforeEach(() => {
    repo = new InMemoryDemandaRepository();
    taskRepo = new InMemoryTaskRepository();
    sut = new GetDemandaStatusUseCase(repo, taskRepo);
  });

  it('deve retornar o status completo da demanda, incluindo progresso de tarefas', async () => {
    const demandaId = 'demanda-1';
    await repo.save(Demanda.fromProps({
      id: demandaId,
      status: 'aceita',
      origemTipo: 'interno',
      origemId: null,
      solicitanteId: 'test-user',
      destinatarioId: 'test-setor',
      tipoAcao: null,
      descricao: 'Descrição de teste',
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
    }));

    const t1 = Task.fromProps({
      id: 't1', titulo: 'Tarefa 1', status: 'concluido', demandaId,
      prioridade: 'media', ordem: 1, criadoPor: 'user'
    });
    const t2 = Task.fromProps({
      id: 't2', titulo: 'Tarefa 2', status: 'a_fazer', demandaId,
      prioridade: 'media', ordem: 2, criadoPor: 'user'
    });

    await taskRepo.save(t1);
    await taskRepo.save(t2);

    const result = await sut.execute(demandaId);

    expect(result.demanda.id).toBe(demandaId);
    expect(result.tarefas).toHaveLength(2);
    expect(result.progresso.tarefasTotal).toBe(2);
    expect(result.progresso.tarefasConcluidas).toBe(1);
  });

  it('deve lançar erro se a demanda não existir', async () => {
    await expect(sut.execute('inexistente')).rejects.toThrow('não encontrada');
  });
});
