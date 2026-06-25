import { describe, it, expect, beforeEach } from 'vitest';
import { CreateDemandaUseCase } from '../CreateDemandaUseCase';
import { InMemoryDemandaRepository } from '../../../test/fakes/InMemoryDemandaRepository';
import { FixedClock } from '../../../test/fakes/FixedClock';

describe('CreateDemandaUseCase', () => {
  let repo: InMemoryDemandaRepository;
  let clock: FixedClock;
  let sut: CreateDemandaUseCase;

  beforeEach(() => {
    repo = new InMemoryDemandaRepository();
    clock = new FixedClock('2026-04-28T10:00:00Z');
    sut = new CreateDemandaUseCase(repo, clock);
  });

  it('deve criar uma demanda com status "aberta" para origem interna', async () => {
    const input = {
      origemTipo: 'interno' as const,
      solicitanteId: 'user-1',
      destinatarioId: 'setor-a',
      descricao: 'Teste',
      politicaConclusao: 'declarado' as const,
    };

    const result = await sut.execute(input);

    expect(result.id).toBeDefined();
    expect(result.status).toBe('aberta');
    expect(result.autoAceite).toBe(false);
    
    const demandaNoRepo = await repo.findById(result.id);
    expect(demandaNoRepo).toBeTruthy();
    expect(demandaNoRepo?.descricao).toBe('Teste');
    
    const eventos = await repo.findEventos(result.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0].type).toBe('demanda.criada');
  });

  it('deve criar uma demanda com status "aceita" para origem própria (auto-aceite)', async () => {
    const input = {
      origemTipo: 'proprio' as const,
      solicitanteId: 'user-1',
      destinatarioId: 'user-1',
      descricao: 'Demanda própria',
      politicaConclusao: 'todas' as const,
    };

    const result = await sut.execute(input);

    expect(result.status).toBe('aceita');
    expect(result.autoAceite).toBe(true);
    expect(result.aceitoPor).toBe('user-1');
    
    const eventos = await repo.findEventos(result.id);
    expect(eventos).toHaveLength(2); // criada + aceita
    expect(eventos[1].type).toBe('demanda.aceita');
  });
});
