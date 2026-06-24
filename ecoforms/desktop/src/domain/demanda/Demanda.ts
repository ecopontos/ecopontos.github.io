export type DemandaOrigemTipo = 'ouvidoria' | 'interno' | 'proprio' | 'agendamento';
export type DemandaStatus = 'aberta' | 'aceita' | 'em_campo' | 'concluida';
export type PoliticaConclusao = 'todas' | 'declarado';
export type ArchiveStatus = 'completed';

export interface DemandaProps {
  id: string;
  origemTipo: DemandaOrigemTipo;
  origemId: string | null;
  solicitanteId: string;
  destinatarioId: string;
  setorId?: string | null;
  tipoAcao: string | null;
  descricao: string | null;
  status: DemandaStatus;
  politicaConclusao: PoliticaConclusao;
  autoAceite: boolean;
  aceitoPor: string | null;
  aceitoEm: string | null;
  encerradoPor: string | null;
  encerradoEm: string | null;
  criadaEm: string;
  arquivadaEm: string | null;
  arquivoPath: string | null;
  archiveStatus: ArchiveStatus | null;
}

export class Demanda {
  private constructor(private readonly props: DemandaProps) {}

  static fromProps(props: DemandaProps): Demanda {
    if (!props.id) throw new Error('Demanda requer id');
    if (!props.solicitanteId) throw new Error('Demanda requer solicitanteId');
    if (!props.destinatarioId) throw new Error('Demanda requer destinatarioId');
    if (!props.descricao || !props.descricao.trim()) throw new Error('Demanda requer descrição');
    return new Demanda({ ...props });
  }

  toProps(): DemandaProps { return { ...this.props }; }

  get id(): string { return this.props.id; }
  get origemTipo(): DemandaOrigemTipo { return this.props.origemTipo; }
  get origemId(): string | null { return this.props.origemId; }
  get solicitanteId(): string { return this.props.solicitanteId; }
  get destinatarioId(): string { return this.props.destinatarioId; }
  get setorId(): string | null { return this.props.setorId ?? null; }
  get tipoAcao(): string | null { return this.props.tipoAcao; }
  get descricao(): string | null { return this.props.descricao; }
  get status(): DemandaStatus { return this.props.status; }
  get politicaConclusao(): PoliticaConclusao { return this.props.politicaConclusao; }
  get autoAceite(): boolean { return this.props.autoAceite; }
  get aceitoPor(): string | null { return this.props.aceitoPor; }
  get aceitoEm(): string | null { return this.props.aceitoEm; }
  get encerradoPor(): string | null { return this.props.encerradoPor; }
  get encerradoEm(): string | null { return this.props.encerradoEm; }
  get criadaEm(): string { return this.props.criadaEm; }
  get arquivadaEm(): string | null { return this.props.arquivadaEm; }
  get arquivoPath(): string | null { return this.props.arquivoPath; }
  get archiveStatus(): ArchiveStatus | null { return this.props.archiveStatus; }

  toSyncJSON(): Record<string, unknown> {
    return {
      id: this.props.id,
      origem_tipo: this.props.origemTipo,
      origem_id: this.props.origemId,
      solicitante_id: this.props.solicitanteId,
      destinatario_id: this.props.destinatarioId,
      setor_id: this.props.setorId,
      tipo_acao: this.props.tipoAcao,
      descricao: this.props.descricao,
      status: this.props.status,
      politica_conclusao: this.props.politicaConclusao,
      auto_aceite: this.props.autoAceite ? 1 : 0,
      aceito_por: this.props.aceitoPor,
      aceito_em: this.props.aceitoEm,
      encerrado_por: this.props.encerradoPor,
      encerrado_em: this.props.encerradoEm,
      criada_em: this.props.criadaEm,
      arquivada_em: this.props.arquivadaEm,
      arquivo_path: this.props.arquivoPath,
      archive_status: this.props.archiveStatus,
      created_at: this.props.criadaEm,
      updated_at: new Date().toISOString(),
    };
  }
}
