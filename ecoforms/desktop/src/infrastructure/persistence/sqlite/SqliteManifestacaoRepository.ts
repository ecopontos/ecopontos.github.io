import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { SyncOutbox } from '../../../infrastructure/sync/SyncOutbox';
import type {
    ManifestacaoRepository,
    ManifestacaoSummary,
    ManifestacaoFilter,
    ManifestacaoInput,
    Tramitacao,
    Resposta,
    Despacho,
    Anexo,
    Prazo,
    Notificacao,
    HistoricoAlteracao,
    ModeloResposta,
    EnvioResposta,
    Cobranca,
} from '../../../domain/ouvidoria/ManifestacaoRepository';
import { ProtocoloService } from '../../../domain/ouvidoria/ProtocoloService';
import { SlaCalculator } from '../../../domain/ouvidoria/SlaCalculator';
import { SqliteProximoProtocoloAdapter, SqliteTipoManifestacaoSlaAdapter } from './ouvidoria/SqliteOuvidoriaPorts';
import { ManifestacaoStateMachine } from '../../../domain/ouvidoria/ManifestacaoStateMachine';

interface ManifestacaoRow {
    id: string;
    protocolo: string;
    tipo_id: string;
    tipo_nome: string;
    origem_id: string;
    origem_nome: string;
    classificacao_id: string;
    classificacao_nome: string;
    solicitante_nome: string;
    solicitante_email: string | null;
    solicitante_telefone: string | null;
    assunto: string;
    descricao: string;
    status: string;
    prioridade: string;
    situacao_id: string;
    situacao_nome: string;
    responsavel_id?: string | null;
    responsavel_nome?: string | null;
    setor_id?: string | null;
    setor_nome?: string | null;
    cliente_id?: string | null;
    cliente_nome?: string | null;
    criado_em: string;
    atualizado_em: string;
    encerrado_em?: string | null;
    prazo_limite?: string | null;
    anonimo?: number;
    sigiloso?: number;
    atribuido_em?: string | null;
    aceite_em?: string | null;
    avaliacao_satisfacao?: number | null;
    manifestacao_origem_id?: string | null;
    competencia?: string | null;
    motivo_incompetencia?: string | null;
    orgao_destino?: string | null;
    data_competencia?: string | null;
    subassunto_id?: string | null;
    subunidade_id?: string | null;
    programa_orcamentario_id?: string | null;
}

function rowToSummary(row: ManifestacaoRow): ManifestacaoSummary {
    return {
        id: row.id,
        protocolo: row.protocolo,
        tipoNome: row.tipo_nome,
        origemNome: row.origem_nome,
        classificacaoNome: row.classificacao_nome,
        situacaoNome: row.situacao_nome,
        solicitanteNome: row.solicitante_nome,
        solicitanteEmail: row.solicitante_email ?? undefined,
        solicitanteTelefone: row.solicitante_telefone ?? undefined,
        assunto: row.assunto,
        descricao: row.descricao,
        status: row.status,
        prioridade: row.prioridade,
        responsavelId: row.responsavel_id ?? undefined,
        responsavelNome: row.responsavel_nome ?? undefined,
        setorId: row.setor_id ?? undefined,
        setorNome: row.setor_nome ?? undefined,
        clienteNome: row.cliente_nome ?? undefined,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em ?? undefined,
        prazoLimite: row.prazo_limite ?? undefined,
        anonimo: row.anonimo,
        sigiloso: row.sigiloso,
        atribuidoEm: row.atribuido_em ?? undefined,
        aceiteEm: row.aceite_em ?? undefined,
        avaliacaoSatisfacao: row.avaliacao_satisfacao ?? undefined,
        manifestacaoOrigemId: row.manifestacao_origem_id ?? undefined,
        competencia: (row.competencia as 'compete' | 'nao_compete' | 'pendente') ?? undefined,
        motivoIncompetencia: row.motivo_incompetencia ?? undefined,
        orgaoDestino: row.orgao_destino ?? undefined,
        dataCompetencia: row.data_competencia ?? undefined,
        subassuntoId: row.subassunto_id ?? undefined,
        subunidadeId: row.subunidade_id ?? undefined,
        programaOrcamentarioId: row.programa_orcamentario_id ?? undefined,
    };
}

const BASE_SELECT = `
    SELECT
        m.id, m.protocolo, m.tipo_id, tm.nome AS tipo_nome,
        m.origem_id, o.nome AS origem_nome,
        m.classificacao_id, c.nome AS classificacao_nome,
        m.solicitante_nome, m.solicitante_email, m.solicitante_telefone,
        m.assunto, m.descricao, m.status, m.prioridade,
        m.situacao_id, s.nome AS situacao_nome,
        m.responsavel_id, u.nome AS responsavel_nome,
        m.setor_id, se.nome AS setor_nome,
        m.cliente_id, cl.nome AS cliente_nome,
        m.criado_em, m.atualizado_em, m.encerrado_em,
        m.anonimo, m.sigiloso,
        m.atribuido_em, m.aceite_em, m.avaliacao_satisfacao, m.manifestacao_origem_id,
        m.prazo_limite,
        m.competencia, m.motivo_incompetencia, m.orgao_destino, m.data_competencia,
        m.subassunto_id, m.subunidade_id, m.programa_orcamentario_id
    FROM manifestacoes m
    LEFT JOIN tipos_manifestacao tm ON m.tipo_id = tm.id
    LEFT JOIN origens o ON m.origem_id = o.id
    LEFT JOIN classificacoes c ON m.classificacao_id = c.id
    LEFT JOIN situacoes s ON m.situacao_id = s.id
    LEFT JOIN usuarios u ON m.responsavel_id = u.id
    LEFT JOIN setores se ON m.setor_id = se.id
    LEFT JOIN clientes cl ON m.cliente_id = cl.id
`;

export class SqliteManifestacaoRepository implements ManifestacaoRepository {
    private readonly protocoloService: ProtocoloService;
    private readonly slaCalculator: SlaCalculator;

    constructor(private readonly db: SqlitePort, private readonly sync?: SyncOutbox) {
        this.protocoloService = new ProtocoloService(new SqliteProximoProtocoloAdapter(db));
        this.slaCalculator = new SlaCalculator(new SqliteTipoManifestacaoSlaAdapter(db));
    }

    async findAll(filter?: ManifestacaoFilter): Promise<ManifestacaoSummary[]> {
        const conditions: string[] = ['1=1'];
        const params: unknown[] = [];
        if (filter?.status) { conditions.push('m.status = ?'); params.push(filter.status); }
        if (filter?.tipoId) { conditions.push('m.tipo_id = ?'); params.push(filter.tipoId); }
        if (filter?.origemId) { conditions.push('m.origem_id = ?'); params.push(filter.origemId); }
        if (filter?.classificacaoId) { conditions.push('m.classificacao_id = ?'); params.push(filter.classificacaoId); }
        if (filter?.situacaoId) { conditions.push('m.situacao_id = ?'); params.push(filter.situacaoId); }
        if (filter?.responsavelId) { conditions.push('m.responsavel_id = ?'); params.push(filter.responsavelId); }
        if (filter?.setorId) { conditions.push('m.setor_id = ?'); params.push(filter.setorId); }
        if (filter?.clienteId) { conditions.push('m.cliente_id = ?'); params.push(filter.clienteId); }
        if (filter?.searchTerm) {
            conditions.push('(m.protocolo LIKE ? OR m.assunto LIKE ? OR m.solicitante_nome LIKE ?)');
            const like = `%${filter.searchTerm}%`;
            params.push(like, like, like);
        }
        if (filter?.dataInicio) { conditions.push('m.criado_em >= ?'); params.push(filter.dataInicio); }
        if (filter?.dataFim) { conditions.push('m.criado_em <= ?'); params.push(filter.dataFim); }

        const sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.criado_em DESC`;
        const rows = await this.db.query<ManifestacaoRow>(sql, params);
        return rows.map(rowToSummary);
    }

    async findById(id: string): Promise<ManifestacaoSummary | null> {
        const sql = `${BASE_SELECT} WHERE m.id = ? LIMIT 1`;
        const rows = await this.db.query<ManifestacaoRow>(sql, [id]);
        return rows[0] ? rowToSummary(rows[0]) : null;
    }

    async findByProtocolo(protocolo: string): Promise<ManifestacaoSummary | null> {
        const sql = `${BASE_SELECT} WHERE m.protocolo = ? LIMIT 1`;
        const rows = await this.db.query<ManifestacaoRow>(sql, [protocolo]);
        return rows[0] ? rowToSummary(rows[0]) : null;
    }

    async save(manifestacao: ManifestacaoInput): Promise<void> {
        const now = new Date().toISOString();
        const id = manifestacao.id;

        // ADR-013 1.1: gerar protocolo automaticamente se não fornecido
        if (!manifestacao.protocolo) {
            manifestacao.protocolo = await this.protocoloService.gerar();
        }

        // ADR-013 1.2: calcular prazo_limite automaticamente
        const tipoId = manifestacao.tipo_id;
        const prioridade = manifestacao.prioridade || 'normal';
        if (tipoId && !manifestacao.prazo_limite) {
            const prazo = await this.slaCalculator.calcularPrazoLimite(tipoId, prioridade);
            if (prazo) manifestacao.prazo_limite = prazo;
        }

        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM manifestacoes WHERE id = ?',
            [id]
        );
        const fields = Object.keys(manifestacao).filter(k => k !== 'id');
        if (exists[0]?.count > 0) {
            const setClause = fields.map(f => `${f} = ?`).join(', ') + ', atualizado_em = ?';
            const values = fields.map(f => (manifestacao as unknown as Record<string, unknown>)[f]);
            values.push(now, id);
            await this.db.execute(`UPDATE manifestacoes SET ${setClause} WHERE id = ?`, values);
        } else {
            const cols = ['id', ...fields, 'criado_em', 'atualizado_em'];
            const placeholders = cols.map(() => '?').join(', ');
            const values = [id, ...fields.map(f => (manifestacao as unknown as Record<string, unknown>)[f]), now, now];
            await this.db.execute(`INSERT INTO manifestacoes (${cols.join(', ')}) VALUES (${placeholders})`, values);
            await this.sync?.write('manifestacao.criada', { manifestacaoId: id }, { aggregateId: id });
        }
    }

    async updateStatus(id: string, status: string, responsavelId?: string): Promise<void> {
        // ADR-013 1.4: validar máquina de estados
        const currentRows = await this.db.query<{ status: string }>(
            'SELECT status FROM manifestacoes WHERE id = ?',
            [id]
        );
        const statusAtual = currentRows[0]?.status ?? 'aberta';
        ManifestacaoStateMachine.validarTransicao(statusAtual, status);

        const now = new Date().toISOString();
        const updates: string[] = ['status = ?', 'atualizado_em = ?'];
        const values: unknown[] = [status, now];

        if (responsavelId) {
            updates.push('responsavel_id = ?');
            values.push(responsavelId);
            // Registra timestamp de atribuição apenas na primeira vez
            if (status === 'em_analise' && statusAtual === 'aberta') {
                updates.push('atribuido_em = ?');
                values.push(now);
            }
        }
        // aceite_em NÃO é definido aqui — requer ação explícita via aceitarManifestacao()

        values.push(id);
        await this.db.execute(
            `UPDATE manifestacoes SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        await this.sync?.write('manifestacao.status_atualizado', { manifestacaoId: id, status }, { aggregateId: id });
    }

    async classificar(
        id: string,
        data: { subassuntoId?: string; subunidadeId?: string; programaOrcamentarioId?: string },
    ): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `UPDATE manifestacoes
             SET subassunto_id = ?, subunidade_id = ?, programa_orcamentario_id = ?,
                 status = 'em_atendimento', atualizado_em = ?
             WHERE id = ?`,
            [data.subassuntoId ?? null, data.subunidadeId ?? null, data.programaOrcamentarioId ?? null, now, id],
        );
        await this.sync?.write('manifestacao.classificada', {
            manifestacaoId: id,
            subassuntoId: data.subassuntoId,
            subunidadeId: data.subunidadeId,
            programaOrcamentarioId: data.programaOrcamentarioId,
        }, { aggregateId: id });
        await this.sync?.write('manifestacao.status_atualizado', { manifestacaoId: id, status: 'em_atendimento' }, { aggregateId: id });
    }

    async aceitarManifestacao(id: string): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            'UPDATE manifestacoes SET aceite_em = ?, status = ?, atualizado_em = ? WHERE id = ? AND aceite_em IS NULL',
            [now, 'em_atendimento', now, id]
        );
    }

    async verificarCompetencia(
        id: string,
        competencia: 'compete' | 'nao_compete',
        motivo?: string,
        orgaoDestino?: string,
    ): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `UPDATE manifestacoes
             SET competencia = ?, motivo_incompetencia = ?, orgao_destino = ?, data_competencia = ?, atualizado_em = ?
             WHERE id = ?`,
            [competencia, motivo ?? null, orgaoDestino ?? null, now, now, id],
        );
        await this.sync?.write('manifestacao.competencia_verificada', { manifestacaoId: id, competencia, motivo, orgaoDestino }, { aggregateId: id });
    }

    async delete(id: string): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            "UPDATE manifestacoes SET status = 'cancelada', atualizado_em = ? WHERE id = ?",
            [now, id],
        );
        await this.sync?.write('manifestacao.status_atualizado', { manifestacaoId: id, status: 'cancelada' }, { aggregateId: id });
    }

    // --- Tramitacoes ---
    async listTramitacoes(manifestacaoId: string): Promise<Tramitacao[]> {
        const rows = await this.db.query<Tramitacao>(`
            SELECT t.id, t.manifestacao_id AS manifestacaoId, t.observacao, t.criado_em AS criadoEm,
                   t.de_setor_id AS deSetorId, t.para_setor_id AS paraSetorId,
                   t.tipo_tramitacao AS tipoTramitacao,
                   de.nome AS deSetorNome, para.nome AS paraSetorNome, u.nome AS usuarioNome
            FROM tramitacoes t
            LEFT JOIN setores de ON t.de_setor_id = de.id
            LEFT JOIN setores para ON t.para_setor_id = para.id
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE t.manifestacao_id = ?
            ORDER BY t.criado_em DESC
        `, [manifestacaoId]);
        return rows;
    }

    async addTramitacao(t: Tramitacao): Promise<void> {
        const tipo = t.tipoTramitacao ?? 'encaminhamento';
        await this.db.execute(
            'INSERT INTO tramitacoes (id, manifestacao_id, de_setor_id, para_setor_id, observacao, usuario_id, tipo_tramitacao, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [t.id, t.manifestacaoId, t.deSetorId ?? null, t.paraSetorId, t.observacao ?? null, t.usuarioId, tipo, t.criadoEm],
        );
        await this.sync?.write('manifestacao.tramitacao_registrada', { tramitacaoId: t.id, manifestacaoId: t.manifestacaoId }, { aggregateId: t.manifestacaoId });
        if (tipo === 'transferencia') {
            await this.sync?.write('manifestacao.transferida', {
                manifestacaoId: t.manifestacaoId,
                deSetorId: t.deSetorId ?? undefined,
                paraSetorId: t.paraSetorId,
                tipoTramitacao: tipo,
            }, { aggregateId: t.manifestacaoId });
        }
    }

    // --- Respostas ---
    async listRespostas(manifestacaoId: string): Promise<Resposta[]> {
        const rows = await this.db.query<Resposta>(`
            SELECT r.id, r.manifestacao_id AS manifestacaoId, r.texto,
                   r.enviada_em AS enviadaEm, r.enviada_por AS enviadaPorId,
                   u.nome AS enviadaPor,
                   r.resposta_formatada AS respostaFormatada,
                   r.modelo_id AS modeloId,
                   r.revisada_por AS revisadaPorId,
                   rv.nome AS revisadaPor,
                   r.data_revisao AS dataRevisao
            FROM respostas r
            LEFT JOIN usuarios u  ON r.enviada_por  = u.id
            LEFT JOIN usuarios rv ON r.revisada_por = rv.id
            WHERE r.manifestacao_id = ?
            ORDER BY r.enviada_em DESC
        `, [manifestacaoId]);
        return rows;
    }

    async addResposta(r: Resposta): Promise<void> {
        await this.db.execute(
            `INSERT INTO respostas
             (id, manifestacao_id, texto, enviada_por, enviada_em,
              resposta_formatada, modelo_id, revisada_por, data_revisao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [r.id, r.manifestacaoId, r.texto, r.enviadaPorId, r.enviadaEm,
             r.respostaFormatada ?? null, r.modeloId ?? null, r.revisadaPorId ?? null, r.dataRevisao ?? null],
        );
        await this.sync?.write('manifestacao.resposta_registrada', { respostaId: r.id, manifestacaoId: r.manifestacaoId }, { aggregateId: r.manifestacaoId });
    }

    async formatarResposta(
        manifestacaoId: string,
        data: { respostaId: string; respostaFormatada: string; modeloId?: string; revisadaPorId: string; marcarRespondida: boolean },
    ): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `UPDATE respostas
             SET resposta_formatada = ?, modelo_id = ?, revisada_por = ?, data_revisao = ?
             WHERE id = ?`,
            [data.respostaFormatada, data.modeloId ?? null, data.revisadaPorId, now, data.respostaId],
        );
        if (data.marcarRespondida) {
            ManifestacaoStateMachine.validarTransicao(
                (await this.db.query<{ status: string }>('SELECT status FROM manifestacoes WHERE id = ?', [manifestacaoId]))[0]?.status ?? 'em_atendimento',
                'respondida',
            );
            await this.db.execute(
                'UPDATE manifestacoes SET status = ?, atualizado_em = ? WHERE id = ?',
                ['respondida', now, manifestacaoId],
            );
            await this.sync?.write('manifestacao.status_atualizado', { manifestacaoId, status: 'respondida' }, { aggregateId: manifestacaoId });
        }
        await this.sync?.write('manifestacao.resposta_formatada', {
            respostaId: data.respostaId,
            manifestacaoId,
            modeloId: data.modeloId,
            marcadaRespondida: data.marcarRespondida,
        });
    }

    async listModelosResposta(tipoId?: string, assuntoId?: string): Promise<ModeloResposta[]> {
        const conditions = ['ativo = 1'];
        const params: unknown[] = [];
        if (tipoId) { conditions.push('tipo_manifestacao_id = ?'); params.push(tipoId); }
        if (assuntoId) { conditions.push('(assunto_id IS NULL OR assunto_id = ?)'); params.push(assuntoId); }
        const rows = await this.db.query<{
            id: string; tipo_manifestacao_id: string; assunto_id: string | null; titulo: string; corpo: string;
        }>(`SELECT id, tipo_manifestacao_id, assunto_id, titulo, corpo FROM modelos_resposta WHERE ${conditions.join(' AND ')} ORDER BY titulo`, params);
        return rows.map(r => ({
            id: r.id,
            tipoManifestacaoId: r.tipo_manifestacao_id,
            assuntoId: r.assunto_id,
            titulo: r.titulo,
            corpo: r.corpo,
        }));
    }

    // --- Despachos ---
    async listDespachos(manifestacaoId: string): Promise<Despacho[]> {
        const rows = await this.db.query<Despacho>(`
            SELECT d.id, d.manifestacao_id, d.texto, d.despachado_em, u.nome AS despachadoPor
            FROM despachos d
            LEFT JOIN usuarios u ON d.despachado_por = u.id
            WHERE d.manifestacao_id = ?
            ORDER BY d.despachado_em DESC
        `, [manifestacaoId]);
        return rows;
    }

    async addDespacho(d: Despacho): Promise<void> {
        await this.db.execute(
            'INSERT INTO despachos (id, manifestacao_id, texto, despachado_por, despachado_em) VALUES (?, ?, ?, ?, ?)',
            [d.id, d.manifestacaoId, d.texto, d.despachadoPorId, d.despachadoEm]
        );
        await this.sync?.write('manifestacao.despacho_registrado', { despachoId: d.id, manifestacaoId: d.manifestacaoId }, { aggregateId: d.manifestacaoId });
    }

    // --- Anexos ---
    async listAnexos(manifestacaoId: string): Promise<Anexo[]> {
        const rows = await this.db.query<{
            id: string; manifestacao_id: string; nome_arquivo: string;
            caminho_storage: string | null; tipo_mime: string | null; criado_em: string;
        }>(
            'SELECT id, manifestacao_id, nome_arquivo, caminho_storage, tipo_mime, criado_em FROM anexos WHERE manifestacao_id = ? ORDER BY criado_em DESC',
            [manifestacaoId]
        );
        return rows.map(r => ({
            id: r.id,
            manifestacaoId: r.manifestacao_id,
            nomeArquivo: r.nome_arquivo,
            storagePath: r.caminho_storage ?? undefined,
            mimeType: r.tipo_mime ?? undefined,
            criadoEm: r.criado_em,
        }));
    }

    async addAnexo(a: Anexo): Promise<void> {
        await this.db.execute(
            'INSERT INTO anexos (id, manifestacao_id, nome_arquivo, caminho_storage, tipo_mime, sincronizado, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [a.id, a.manifestacaoId, a.nomeArquivo, a.storagePath ?? null, a.mimeType ?? null, 0, a.criadoEm]
        );
    }

    async removeAnexo(anexoId: string): Promise<void> {
        await this.db.execute('DELETE FROM anexos WHERE id = ?', [anexoId]);
    }

    // --- Prazos ---
    async listPrazos(manifestacaoId: string): Promise<Prazo[]> {
        const rows = await this.db.query<{
            id: string; manifestacao_id: string; tipo_prazo: string | null;
            tipo_prazo_id: string | null; data_limite: string; status: string;
            cumprido_em: string | null; criado_em: string;
        }>(
            'SELECT id, manifestacao_id, tipo_prazo, tipo_prazo_id, data_limite, status, cumprido_em, criado_em FROM prazos WHERE manifestacao_id = ? ORDER BY data_limite ASC',
            [manifestacaoId]
        );
        return rows.map(r => ({
            id: r.id,
            manifestacaoId: r.manifestacao_id,
            tipoPrazo: r.tipo_prazo ?? r.tipo_prazo_id ?? '',
            dataLimite: r.data_limite,
            status: r.status,
            cumpridoEm: r.cumprido_em ?? undefined,
            criadoEm: r.criado_em,
        }));
    }

    async addPrazo(p: Prazo): Promise<void> {
        await this.db.execute(
            'INSERT INTO prazos (id, manifestacao_id, tipo_prazo, tipo_prazo_id, data_limite, status, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [p.id, p.manifestacaoId, p.tipoPrazo, p.tipoPrazo, p.dataLimite, p.status, p.criadoEm]
        );
        await this.sync?.write('manifestacao.prazo_adicionado', { prazoId: p.id, manifestacaoId: p.manifestacaoId }, { aggregateId: p.manifestacaoId });
    }

    async updatePrazoStatus(prazoId: string, status: string, cumpridoEm?: string): Promise<void> {
        await this.db.execute(
            'UPDATE prazos SET status = ?, cumprido_em = ? WHERE id = ?',
            [status, cumpridoEm || null, prazoId]
        );
    }

    // --- Notificacoes ---
    async listNotificacoes(usuarioId: string, apenasNaoLidas = false): Promise<Notificacao[]> {
        const sql = apenasNaoLidas
            ? 'SELECT * FROM notificacoes WHERE usuario_id = ? AND lida = 0 ORDER BY criado_em DESC'
            : 'SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC';
        const rows = await this.db.query<Notificacao>(sql, [usuarioId]);
        return rows;
    }

    async marcarNotificacaoLida(notificacaoId: string): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            'UPDATE notificacoes SET lida = 1, lida_em = ? WHERE id = ?',
            [now, notificacaoId]
        );
    }

    async addNotificacao(n: Notificacao): Promise<void> {
        await this.db.execute(
            'INSERT INTO notificacoes (id, usuario_id, manifestacao_id, mensagem, lida, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
            [n.id, n.usuarioId, n.manifestacaoId || null, n.mensagem, n.lida ? 1 : 0, n.criadoEm]
        );
    }

    // --- Historico ---
    async listHistorico(manifestacaoId: string): Promise<HistoricoAlteracao[]> {
        const rows = await this.db.query<HistoricoAlteracao>(`
            SELECT h.id, h.manifestacao_id, h.campo, h.valor_anterior, h.valor_novo, h.alterado_em, u.nome AS alteradoPor
            FROM historico_alteracoes h
            LEFT JOIN usuarios u ON h.alterado_por = u.id
            WHERE h.manifestacao_id = ?
            ORDER BY h.alterado_em DESC
        `, [manifestacaoId]);
        return rows;
    }

    async addHistorico(h: HistoricoAlteracao): Promise<void> {
        await this.db.execute(
            'INSERT INTO historico_alteracoes (id, manifestacao_id, campo, valor_anterior, valor_novo, alterado_por, alterado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [h.id, h.manifestacaoId, h.campo, h.valorAnterior || null, h.valorNovo || null, h.alteradoPor, h.alteradoEm]
        );
    }

    // --- Envios ao cidadão ---
    async listEnvios(manifestacaoId: string): Promise<EnvioResposta[]> {
        const rows = await this.db.query<{
            id: string; resposta_id: string; manifestacao_id: string;
            canal: string; destinatario: string | null;
            status_envio: string; data_envio: string | null; erro: string | null;
        }>(
            'SELECT id, resposta_id, manifestacao_id, canal, destinatario, status_envio, data_envio, erro FROM envios_resposta WHERE manifestacao_id = ? ORDER BY data_envio DESC',
            [manifestacaoId],
        );
        return rows.map(r => ({
            id: r.id,
            respostaId: r.resposta_id,
            manifestacaoId: r.manifestacao_id,
            canal: r.canal as EnvioResposta['canal'],
            destinatario: r.destinatario,
            statusEnvio: r.status_envio as EnvioResposta['statusEnvio'],
            dataEnvio: r.data_envio,
            erro: r.erro,
        }));
    }

    async registrarEnvio(e: EnvioResposta): Promise<void> {
        await this.db.execute(
            'INSERT INTO envios_resposta (id, resposta_id, manifestacao_id, canal, destinatario, status_envio, data_envio, erro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [e.id, e.respostaId, e.manifestacaoId, e.canal, e.destinatario ?? null, e.statusEnvio, e.dataEnvio ?? null, e.erro ?? null],
        );
    }

    // --- Cobranças ---
    async listCobranças(manifestacaoId: string): Promise<Cobranca[]> {
        const rows = await this.db.query<{
            id: string; mensagem: string; criado_em: string; usuario_nome: string;
        }>(
            `SELECT n.id, n.mensagem, n.criado_em, u.nome AS usuario_nome
             FROM notificacoes n
             LEFT JOIN usuarios u ON n.usuario_id = u.id
             WHERE n.manifestacao_id = ? AND n.prazo_id IS NOT NULL
             ORDER BY n.criado_em DESC`,
            [manifestacaoId],
        );
        return rows.map(r => ({
            id: r.id,
            mensagem: r.mensagem,
            criadoEm: r.criado_em,
            usuarioNome: r.usuario_nome,
        }));
    }
}
