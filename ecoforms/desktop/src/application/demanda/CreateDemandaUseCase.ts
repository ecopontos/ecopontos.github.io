import { Demanda } from '../../domain/demanda/Demanda';
import type { DemandaOrigemTipo, PoliticaConclusao } from '../../domain/demanda/Demanda';
import type { DemandaRepository } from '../../domain/demanda/DemandaRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SqlitePort } from '../ports/SqlitePort';
import { uuidv7 } from 'ecoforms-core';
import { resolveSetorId } from '../shared/resolveSetorId';

type DbLike = { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };
type GetEffectiveSectorsFn = (userId: string, db: DbLike) => Promise<string[]>;

export interface CreateDemandaInput {
  origemTipo: DemandaOrigemTipo;
  origemId?: string;
  solicitanteId: string;
  destinatarioId: string;
  setorId?: string;
  tipoAcao?: string;
  descricao?: string;
  politicaConclusao: PoliticaConclusao;
}

export class CreateDemandaUseCase {
  constructor(
    private repo: DemandaRepository,
    private clock: ClockPort,
    private db?: SqlitePort,
    private getEffectiveSectors?: GetEffectiveSectorsFn,
  ) {}

  async execute(input: CreateDemandaInput): Promise<Demanda> {
    if (!input.descricao?.trim()) {
      throw new Error('Demanda requer descrição');
    }

    const autoAceite = input.origemTipo === 'proprio';
    const agora = this.clock.nowIso();

    const setorId = this.db
      ? await resolveSetorId(
          { setorId: input.setorId },
          input.solicitanteId,
          this.db,
          this.getEffectiveSectors,
        )
      : input.setorId ?? null;

    const demanda = Demanda.fromProps({
      id: uuidv7(),
      origemTipo: input.origemTipo,
      origemId: input.origemId ?? null,
      solicitanteId: input.solicitanteId,
      destinatarioId: input.destinatarioId,
      setorId,
      tipoAcao: input.tipoAcao ?? null,
      descricao: input.descricao,
      status: autoAceite ? 'aceita' : 'aberta',
      politicaConclusao: input.politicaConclusao,
      autoAceite,
      aceitoPor: autoAceite ? input.solicitanteId : null,
      aceitoEm: autoAceite ? agora : null,
      encerradoPor: null,
      encerradoEm: null,
      criadaEm: agora,
      arquivadaEm: null,
      arquivoPath: null,
      archiveStatus: null,
    });

    await this.repo.save(demanda);

    await this.repo.saveEvento({
      id: uuidv7(),
      demandaId: demanda.id,
      type: 'demanda.criada',
      correlationId: demanda.id,
      causationId: null,
      payload: { origemTipo: demanda.origemTipo, origemId: demanda.origemId },
      deviceId: null,
      userId: input.solicitanteId,
      createdAt: agora,
    });

    if (autoAceite) {
      await this.repo.saveEvento({
        id: uuidv7(),
        demandaId: demanda.id,
        type: 'demanda.aceita',
        correlationId: demanda.id,
        causationId: null,
        payload: { aceitoPor: demanda.aceitoPor, autoAceite: true },
        deviceId: null,
        userId: input.solicitanteId,
        createdAt: agora,
      });
    }

    return demanda;
  }
}
