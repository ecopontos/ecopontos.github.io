import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { DemandaRepository, DemandaListItem, DemandaListFilters } from '../../../domain/demanda/DemandaRepository';
import { Demanda } from '../../../domain/demanda/Demanda';
import type { DemandaProps, DemandaStatus, DemandaOrigemTipo, PoliticaConclusao, ArchiveStatus } from '../../../domain/demanda/Demanda';
import type { DemandaEvento } from '../../../domain/demanda/DemandaEvento';
import type { TarefaFormulario } from '../../../domain/demanda/TarefaFormulario';
import { DEMANDAS_LIST_WITH_DETAILS } from '../sqlite/queries/demandas';


export class SqliteDemandaRepository implements DemandaRepository {
  constructor(private db: SqlitePort) {}

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  // --- Demanda ---

  async findById(id: string): Promise<Demanda | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM demandas WHERE id = ?', [id]
    );
    return rows.length ? this.mapDemanda(rows[0]) : null;
  }

  async findByStatus(status: DemandaStatus): Promise<Demanda[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM demandas WHERE status = ? ORDER BY criado_em DESC', [status]
    );
    return rows.map(row => this.mapDemanda(row));
  }

  async findByDestinatario(setorId: string): Promise<Demanda[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM demandas WHERE destinatario_id = ? ORDER BY criado_em DESC',
      [setorId]
    );
    return rows.map(row => this.mapDemanda(row));
  }

  async findAllWithDetails(filters: DemandaListFilters = {}): Promise<DemandaListItem[]> {
    const status = filters.status ?? null;
    const rows = await this.db.query<DemandaListItem>(
      DEMANDAS_LIST_WITH_DETAILS.sql,
      [status],
    );
    return rows;
  }

  async findBySolicitante(setorId: string): Promise<Demanda[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM demandas WHERE solicitante_id = ? ORDER BY criado_em DESC',
      [setorId]
    );
    return rows.map(row => this.mapDemanda(row));
  }

  async save(demanda: Demanda): Promise<void> {
    await this.db.execute(
      `INSERT INTO demandas
        (id, origem_tipo, origem_id, solicitante_id, destinatario_id,
         setor_id, tipo_acao, descricao, status, politica_conclusao, auto_aceite,
         aceito_por, aceito_em, encerrado_por, encerrado_em,
         criado_em, arquivada_em, caminho_arquivo, status_arquivo,
         atualizado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        demanda.id, demanda.origemTipo, demanda.origemId,
        demanda.solicitanteId, demanda.destinatarioId,
        demanda.setorId,
        demanda.tipoAcao, demanda.descricao, demanda.status,
        demanda.politicaConclusao, demanda.autoAceite ? 1 : 0,
        demanda.aceitoPor, demanda.aceitoEm,
        demanda.encerradoPor, demanda.encerradoEm,
        demanda.criadaEm || new Date().toISOString(), demanda.arquivadaEm,
        demanda.arquivoPath, demanda.archiveStatus,
        new Date().toISOString(),
      ]
    );
  }

  async upsertFromSync(json: Record<string, unknown>): Promise<void> {
    const exists = await this.db.query<{ id: string }>(
      'SELECT id FROM demandas WHERE id = ? LIMIT 1', [json.id as string]
    );

    if (exists.length === 0) {
      const demanda = Demanda.fromProps({
        id: json.id as string,
        origemTipo: json.origem_tipo as DemandaOrigemTipo,
        origemId: json.origem_id as string | null,
        solicitanteId: json.solicitante_id as string,
        destinatarioId: json.destinatario_id as string,
        setorId: (json.setor_id as string | null) ?? null,
        tipoAcao: json.tipo_acao as string | null,
        descricao: json.descricao as string | null,
        status: json.status as DemandaStatus,
        politicaConclusao: json.politica_conclusao as PoliticaConclusao,
        autoAceite: json.auto_aceite === 1,
        aceitoPor: json.aceito_por as string | null,
        aceitoEm: json.aceito_em as string | null,
        encerradoPor: json.encerrado_por as string | null,
        encerradoEm: json.encerrado_em as string | null,
        criadaEm: json.criado_em as string,
        arquivadaEm: json.arquivada_em as string | null,
        arquivoPath: json.arquivo_path as string | null,
        archiveStatus: json.archive_status as ArchiveStatus | null,
      });
      await this.save(demanda);
    } else {
      const updatedAt = (json.updated_at as string) ?? new Date().toISOString();
      await this.db.execute(
        `UPDATE demandas SET
          origem_tipo = ?, origem_id = ?, solicitante_id = ?, destinatario_id = ?,
          tipo_acao = ?, descricao = ?, status = ?, politica_conclusao = ?,
          auto_aceite = ?, aceito_por = ?, aceito_em = ?,
          encerrado_por = ?, encerrado_em = ?,
          criado_em = COALESCE(?, criado_em),
          arquivada_em = ?, caminho_arquivo = ?,
          status_arquivo = ?, atualizado_em = ?
         WHERE id = ?`,
        [
          json.origem_tipo ?? null, json.origem_id ?? null,
          json.solicitante_id ?? null, json.destinatario_id ?? null,
          json.tipo_acao ?? null, json.descricao ?? null,
          json.status ?? null, json.politica_conclusao ?? null,
          json.auto_aceite != null ? (json.auto_aceite as number) : 0,
          json.aceito_por ?? null, json.aceito_em ?? null,
          json.encerrado_por ?? null, json.encerrado_em ?? null,
          json.criado_em ?? null,
          json.arquivada_em ?? null, json.arquivo_path ?? null,
          json.archive_status ?? null,
          updatedAt,
          json.id,
        ]
      );
    }
  }

  async updateStatus(
    id: string,
    status: DemandaStatus,
    extra?: Partial<DemandaProps>
  ): Promise<void> {
    const agora = new Date().toISOString();
    await this.db.execute(
      `UPDATE demandas SET
        status = ?,
        aceito_por = COALESCE(?, aceito_por),
        aceito_em = COALESCE(?, aceito_em),
        encerrado_por = COALESCE(?, encerrado_por),
        encerrado_em = COALESCE(?, encerrado_em),
        status_arquivo = COALESCE(?, status_arquivo),
        atualizado_em = ?
       WHERE id = ?`,
      [
        status,
        extra?.aceitoPor ?? null,
        extra?.aceitoEm ?? null,
        extra?.encerradoPor ?? null,
        extra?.encerradoEm ?? null,
        extra?.archiveStatus ?? null,
        agora,
        id,
      ]
    );
  }

  // --- Eventos ---

  async findEventos(demandaId: string): Promise<DemandaEvento[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM demanda_eventos WHERE demanda_id = ? ORDER BY criado_em',
      [demandaId]
    );
    return rows.map(this.mapEvento);
  }

  async saveEvento(evento: DemandaEvento): Promise<void> {
    await this.db.execute(
      `INSERT INTO demanda_eventos
        (id, demanda_id, tipo, correlation_id, causation_id,
         carga, id_dispositivo, id_usuario, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        evento.id, evento.demandaId, evento.type,
        evento.correlationId, evento.causationId,
        JSON.stringify(evento.payload),
        evento.deviceId, evento.userId, evento.createdAt,
      ]
    );
  }

  // --- Formulários de Tarefa ---

  async findTarefaFormularios(tarefaId: string): Promise<TarefaFormulario[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM tarefa_formularios WHERE tarefa_id = ? ORDER BY ordem',
      [tarefaId]
    );
    return rows.map(this.mapTarefaFormulario);
  }

  async saveTarefaFormulario(tf: TarefaFormulario): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO tarefa_formularios
        (id, tarefa_id, id_formulario, versao_formulario, snapshot_formulario,
         ordem, obrigatorio, concluido, concluido_em, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        tf.id, tf.tarefaId, tf.formRegistryId, tf.formVersion,
        JSON.stringify(tf.formSnapshot),
        tf.ordem, tf.obrigatorio ? 1 : 0, tf.concluido ? 1 : 0,
        tf.concluidoEm, new Date().toISOString(),
      ]
    );
  }

  async markFormularioConcluido(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE tarefa_formularios SET concluido = 1, concluido_em = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  }

  async allFormulariosObrigatoriosConcluidos(tarefaId: string): Promise<boolean> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM tarefa_formularios
       WHERE tarefa_id = ? AND obrigatorio = 1 AND concluido = 0`,
      [tarefaId]
    );
    return rows[0]?.total === 0;
  }

  async allTarefasObrigatoriasConcluidasParaDemanda(demandaId: string): Promise<boolean> {
    const rows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM tarefas
       WHERE demanda_id = ? AND status != 'concluido'`,
      [demandaId]
    );
    return rows[0]?.total === 0;
  }

  // --- Mappers ---

  private mapDemanda(row: Record<string, unknown>): Demanda {
    return Demanda.fromProps({
      id: row.id as string,
      origemTipo: row.origem_tipo as DemandaOrigemTipo,
      origemId: row.origem_id as string | null,
      solicitanteId: row.solicitante_id as string,
      destinatarioId: row.destinatario_id as string,
      setorId: row.setor_id as string | null,
      tipoAcao: row.tipo_acao as string | null,
      descricao: row.descricao as string | null,
      status: row.status as DemandaStatus,
      politicaConclusao: row.politica_conclusao as PoliticaConclusao,
      autoAceite: row.auto_aceite === 1,
      aceitoPor: row.aceito_por as string | null,
      aceitoEm: row.aceito_em as string | null,
      encerradoPor: row.encerrado_por as string | null,
      encerradoEm: row.encerrado_em as string | null,
      criadaEm: row.criado_em as string,
      arquivadaEm: row.arquivada_em as string | null,
      arquivoPath: row.arquivo_path as string | null,
      archiveStatus: row.archive_status as ArchiveStatus | null,
    });
  }

  private mapEvento(row: Record<string, unknown>): DemandaEvento {
    return {
      id: row.id as string,
      demandaId: row.demanda_id as string,
      type: row.tipo as string,
      correlationId: row.correlation_id as string | null,
      causationId: row.causation_id as string | null,
      payload: JSON.parse(row.carga as string),
      deviceId: row.id_dispositivo as string | null,
      userId: row.id_usuario as string | null,
      createdAt: row.criado_em as string,
    };
  }

  private mapTarefaFormulario(row: Record<string, unknown>): TarefaFormulario {
    return {
      id: row.id as string,
      tarefaId: row.tarefa_id as string,
      formRegistryId: row.id_formulario as string,
      formVersion: row.versao_formulario as number,
      formSnapshot: JSON.parse(row.snapshot_formulario as string),
      ordem: row.ordem as number,
      obrigatorio: row.obrigatorio === 1,
      concluido: row.concluido === 1,
      concluidoEm: row.concluido_em as string | null,
    };
  }
}
