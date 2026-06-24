import type { Demanda, DemandaProps, DemandaStatus } from './Demanda';
import type { DemandaEvento } from './DemandaEvento';
import type { TarefaFormulario } from './TarefaFormulario';

/** Linha crua de `demandas` com joins resolvidos (setor_nome, solicitante_nome). */
export interface DemandaListItem {
  id: string;
  origem_tipo: string;
  origem_id: string | null;
  solicitante_id: string;
  destinatario_id: string;
  tipo_acao: string | null;
  descricao: string | null;
  status: string;
  politica_conclusao: string;
  criado_em: string;
  setor_nome: string | null;
  solicitante_nome: string | null;
  [k: string]: unknown;
}

/** Filtros opcionais para listagem. status=null/undefined = todas. */
export interface DemandaListFilters {
  status?: DemandaStatus | null;
}

export interface DemandaRepository {
  // Demanda
  findById(id: string): Promise<Demanda | null>;
  findByStatus(status: DemandaStatus): Promise<Demanda[]>;
  findByDestinatario(setorId: string): Promise<Demanda[]>;
  findBySolicitante(setorId: string): Promise<Demanda[]>;
  /** Lista com join em setores/usuarios (resolve nomes sem N+1). Filtro de status opcional. */
  findAllWithDetails(filters?: DemandaListFilters): Promise<DemandaListItem[]>;
  save(demanda: Demanda): Promise<void>;
  updateStatus(id: string, status: DemandaStatus, extra?: Partial<DemandaProps>): Promise<void>;

  // Eventos
  findEventos(demandaId: string): Promise<DemandaEvento[]>;
  saveEvento(evento: DemandaEvento): Promise<void>;

  // Formulários de tarefa
  findTarefaFormularios(tarefaId: string): Promise<TarefaFormulario[]>;
  saveTarefaFormulario(tf: TarefaFormulario): Promise<void>;
  markFormularioConcluido(id: string): Promise<void>;

  // Verificação de conclusão
  allFormulariosObrigatoriosConcluidos(tarefaId: string): Promise<boolean>;
  allTarefasObrigatoriasConcluidasParaDemanda(demandaId: string): Promise<boolean>;

  // Transações
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
