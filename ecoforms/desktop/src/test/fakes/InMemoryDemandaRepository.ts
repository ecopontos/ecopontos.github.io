import { Demanda } from '../../domain/demanda/Demanda';
import type { DemandaProps, DemandaStatus } from '../../domain/demanda/Demanda';
import type { DemandaEvento } from '../../domain/demanda/DemandaEvento';
import type { DemandaRepository, DemandaListItem, DemandaListFilters } from '../../domain/demanda/DemandaRepository';
import type { TarefaFormulario } from '../../domain/demanda/TarefaFormulario';

export class InMemoryDemandaRepository implements DemandaRepository {
  private demandas = new Map<string, Demanda>();
  private eventos: DemandaEvento[] = [];
  private formularios = new Map<string, TarefaFormulario[]>();

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  async findById(id: string): Promise<Demanda | null> {
    return this.demandas.get(id) ?? null;
  }

  async findByStatus(status: DemandaStatus): Promise<Demanda[]> {
    return [...this.demandas.values()].filter(d => d.status === status);
  }

  async findByDestinatario(setorId: string): Promise<Demanda[]> {
    return [...this.demandas.values()].filter(d => d.destinatarioId === setorId);
  }

  async findBySolicitante(setorId: string): Promise<Demanda[]> {
    return [...this.demandas.values()].filter(d => d.solicitanteId === setorId);
  }

  async findAllWithDetails(filters: DemandaListFilters = {}): Promise<DemandaListItem[]> {
    const status = filters.status ?? null;
    return [...this.demandas.values()]
      .filter(d => status === null || d.status === status)
      .map(d => {
        const props = d.toProps();
        return {
          id: props.id,
          origem_tipo: props.origemTipo,
          origem_id: props.origemId,
          solicitante_id: props.solicitanteId,
          destinatario_id: props.destinatarioId,
          tipo_acao: props.tipoAcao,
          descricao: props.descricao,
          status: props.status,
          politica_conclusao: props.politicaConclusao,
          criado_em: props.criadaEm,
          setor_nome: null,
          solicitante_nome: null,
        } as DemandaListItem;
      });
  }

  async save(demanda: Demanda): Promise<void> {
    this.demandas.set(demanda.id, Demanda.fromProps(demanda.toProps()));
  }

  async updateStatus(id: string, status: DemandaStatus, extra?: Partial<DemandaProps>): Promise<void> {
    const existing = this.demandas.get(id);
    if (existing) {
      this.demandas.set(id, Demanda.fromProps({ ...existing.toProps(), ...extra, status }));
    }
  }

  async findEventos(demandaId: string): Promise<DemandaEvento[]> {
    return this.eventos.filter(e => e.demandaId === demandaId);
  }

  async saveEvento(evento: DemandaEvento): Promise<void> {
    this.eventos.push({ ...evento });
  }

  async findTarefaFormularios(tarefaId: string): Promise<TarefaFormulario[]> {
    return this.formularios.get(tarefaId) ?? [];
  }

  async saveTarefaFormulario(tf: TarefaFormulario): Promise<void> {
    const tfs = this.formularios.get(tf.tarefaId) ?? [];
    const index = tfs.findIndex(item => item.id === tf.id);
    if (index >= 0) {
      tfs[index] = { ...tf };
    } else {
      tfs.push({ ...tf });
    }
    this.formularios.set(tf.tarefaId, tfs);
  }

  async markFormularioConcluido(id: string): Promise<void> {
    for (const tfs of this.formularios.values()) {
      const tf = tfs.find(item => item.id === id);
      if (tf) {
        tf.concluido = true;
        tf.concluidoEm = new Date().toISOString();
        break;
      }
    }
  }

  async allFormulariosObrigatoriosConcluidos(tarefaId: string): Promise<boolean> {
    const tfs = this.formularios.get(tarefaId) ?? [];
    return tfs.filter(f => f.obrigatorio && !f.concluido).length === 0;
  }

  async allTarefasObrigatoriasConcluidasParaDemanda(_demandaId: string): Promise<boolean> {
    return true;
  }
}
