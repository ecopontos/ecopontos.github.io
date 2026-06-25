import { uuidv7 } from 'ecoforms-core';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { SyncOutbox } from '../../../infrastructure/sync/SyncOutbox';
import { ExecucaoColetaStateMachine } from '../../../domain/logistics/ExecucaoColetaStateMachine';
import type {
    LogisticsRepository,
    Roteiro,
    RoteiroCliente,
    ExecucaoColeta,
    ExecucaoCliente,
    ExecucaoPesagem,
    ExecucaoHistorico,
    Intercorrencia,
    ChecklistExecucao,
    RoteiroFilter,
    ExecucaoFilter,
} from '../../../domain/logistics/LogisticsRepository';

export class SqliteLogisticsRepository implements LogisticsRepository {
    constructor(private readonly db: SqlitePort, private readonly sync?: SyncOutbox) {}

    // --- Roteiros ---
    async findAllRoteiros(filter?: RoteiroFilter): Promise<Roteiro[]> {
        const conditions: string[] = ['1=1'];
        const params: unknown[] = [];
        if (filter?.situacao) { conditions.push('situacao = ?'); params.push(filter.situacao); }
        if (filter?.searchTerm) {
            conditions.push('(nome LIKE ? OR descricao LIKE ?)');
            const like = `%${filter.searchTerm}%`;
            params.push(like, like);
        }
        const sql = `SELECT *, residuo AS tipoResiduo, criado_por AS criadoPor, criado_em AS criadoEm, atualizado_em AS atualizadoEm
                      FROM roteiros WHERE ${conditions.join(' AND ')} ORDER BY nome`;
        return this.db.query<Roteiro>(sql, params);
    }

    async findRoteiroById(id: string): Promise<Roteiro | null> {
        const rows = await this.db.query<Roteiro>(
            `SELECT *, residuo AS tipoResiduo, criado_por AS criadoPor, criado_em AS criadoEm, atualizado_em AS atualizadoEm
             FROM roteiros WHERE id = ? LIMIT 1`, [id]
        );
        return rows[0] || null;
    }

    async saveRoteiro(roteiro: Roteiro): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM roteiros WHERE id = ?', [roteiro.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE roteiros SET nome = ?, descricao = ?, residuo = ?, periodicidade = ?,
                 turno = ?, base = ?, distrito = ?, situacao = ?, atualizado_em = ?
                 WHERE id = ?`,
                [roteiro.nome, roteiro.descricao || null, roteiro.tipoResiduo || null,
                 roteiro.periodicidade || null, roteiro.turno || null, roteiro.base || null,
                 roteiro.distrito || null, roteiro.situacao, now, roteiro.id]
            );
            const rows = await this.db.query<Record<string, unknown>>('SELECT * FROM roteiros WHERE id = ? LIMIT 1', [roteiro.id]);
            await this.sync?.write('roteiro.atualizado', rows[0] ?? { roteiroId: roteiro.id }, { aggregateId: roteiro.id });
        } else {
            await this.db.execute(
                `INSERT INTO roteiros (id, nome, descricao, residuo, periodicidade, turno, base, distrito, situacao, criado_por, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [roteiro.id, roteiro.nome, roteiro.descricao || null, roteiro.tipoResiduo || null,
                 roteiro.periodicidade || null, roteiro.turno || null, roteiro.base || null,
                 roteiro.distrito || null, roteiro.situacao, roteiro.criadoPor, now, now]
            );
            const rows2 = await this.db.query<Record<string, unknown>>('SELECT * FROM roteiros WHERE id = ? LIMIT 1', [roteiro.id]);
            await this.sync?.write('roteiro.criado', rows2[0] ?? { roteiroId: roteiro.id }, { aggregateId: roteiro.id });
        }
    }

    async deleteRoteiro(id: string): Promise<void> {
        await this.db.execute(
            "UPDATE roteiros SET situacao = 'inativo', atualizado_em = ? WHERE id = ?",
            [new Date().toISOString(), id]
        );
    }

    // --- Roteiro Clientes ---
    async findClientesByRoteiro(roteiroId: string): Promise<RoteiroCliente[]> {
        return this.db.query<RoteiroCliente>(`
            SELECT
                rc.id,
                rc.roteiro_id   AS roteiroId,
                rc.cliente_id   AS clienteId,
                rc.ordem,
                rc.observacao,
                rc.ativo,
                rc.criado_em    AS criadoEm,
                c.nome          AS clienteNome
            FROM roteiro_clientes rc
            JOIN clientes c ON rc.cliente_id = c.id
            WHERE rc.roteiro_id = ? AND rc.ativo = 1
            ORDER BY rc.ordem, c.nome
        `, [roteiroId]);
    }

    async addClienteToRoteiro(rc: RoteiroCliente): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `INSERT INTO roteiro_clientes (id, roteiro_id, cliente_id, ordem, observacao, ativo, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(roteiro_id, cliente_id) DO UPDATE SET
                 ordem = excluded.ordem, observacao = excluded.observacao, ativo = 1`,
            [rc.id, rc.roteiroId, rc.clienteId, rc.ordem, rc.observacao || null, 1, now]
        );
    }

    async removeClienteFromRoteiro(roteiroId: string, clienteId: string): Promise<void> {
        await this.db.execute(
            'UPDATE roteiro_clientes SET ativo = 0 WHERE roteiro_id = ? AND cliente_id = ?',
            [roteiroId, clienteId]
        );
    }

    async updateClienteOrdem(roteiroId: string, clienteId: string, ordem: number): Promise<void> {
        await this.db.execute(
            'UPDATE roteiro_clientes SET ordem = ? WHERE roteiro_id = ? AND cliente_id = ?',
            [ordem, roteiroId, clienteId]
        );
    }

    async updateClienteOrdemBatch(roteiroId: string, items: { clienteId: string; ordem: number }[]): Promise<void> {
        for (const item of items) {
            await this.db.execute(
                'UPDATE roteiro_clientes SET ordem = ? WHERE roteiro_id = ? AND cliente_id = ?',
                [item.ordem, roteiroId, item.clienteId]
            );
        }
    }

    // --- Execucao Coleta ---
    async findAllExecucoes(filter?: ExecucaoFilter): Promise<ExecucaoColeta[]> {
        const conditions: string[] = ['1=1'];
        const params: unknown[] = [];
        if (filter?.roteiroId) { conditions.push('e.roteiro_id = ?'); params.push(filter.roteiroId); }
        if (filter?.status) { conditions.push('e.status = ?'); params.push(filter.status); }
        if (filter?.motoristaId) { conditions.push('e.motorista_id = ?'); params.push(filter.motoristaId); }
        if (filter?.dataInicio) { conditions.push('e.data_execucao >= ?'); params.push(filter.dataInicio); }
        if (filter?.dataFim) { conditions.push('e.data_execucao <= ?'); params.push(filter.dataFim); }
        const sql = `
            SELECT
                e.id,
                e.id_despacho       AS idDespacho,
                e.codigo_despacho   AS codigoDespacho,
                e.roteiro_id        AS roteiroId,
                e.data_execucao     AS dataExecucao,
                e.status,
                e.motorista_id      AS motoristaId,
                e.ajudante_id       AS ajudanteId,
                e.veiculo_placa     AS veiculo,
                e.km_inicial        AS kmInicial,
                e.km_final          AS kmFinal,
                e.peso_total        AS pesoTotal,
                e.volume_total      AS volumeTotal,
                e.numero_viagens    AS numeroViagens,
                e.observacoes,
                e.inicio_em         AS inicioEm,
                e.fim_em            AS fimEm,
                e.criado_em         AS criadoEm,
                r.nome AS roteiroNome, m.nome AS motoristaNome, a.nome AS ajudanteNome
            FROM execucao_coleta e
            LEFT JOIN roteiros r ON e.roteiro_id = r.id
            LEFT JOIN usuarios m ON e.motorista_id = m.id
            LEFT JOIN usuarios a ON e.ajudante_id = a.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY e.data_execucao DESC
        `;
        return this.db.query<ExecucaoColeta>(sql, params);
    }

    async findExecucaoById(id: string): Promise<ExecucaoColeta | null> {
        const rows = await this.db.query<ExecucaoColeta>(`
            SELECT
                e.id,
                e.id_despacho       AS idDespacho,
                e.codigo_despacho   AS codigoDespacho,
                e.roteiro_id        AS roteiroId,
                e.data_execucao     AS dataExecucao,
                e.status,
                e.motorista_id      AS motoristaId,
                e.ajudante_id       AS ajudanteId,
                e.veiculo_placa     AS veiculo,
                e.km_inicial        AS kmInicial,
                e.km_final          AS kmFinal,
                e.peso_total        AS pesoTotal,
                e.volume_total      AS volumeTotal,
                e.numero_viagens    AS numeroViagens,
                e.observacoes,
                e.inicio_em         AS inicioEm,
                e.fim_em            AS fimEm,
                e.criado_em         AS criadoEm,
                r.nome AS roteiroNome, m.nome AS motoristaNome, a.nome AS ajudanteNome
            FROM execucao_coleta e
            LEFT JOIN roteiros r ON e.roteiro_id = r.id
            LEFT JOIN usuarios m ON e.motorista_id = m.id
            LEFT JOIN usuarios a ON e.ajudante_id = a.id
            WHERE e.id = ?
            LIMIT 1
        `, [id]);
        return rows[0] || null;
    }

    async saveExecucao(exec: ExecucaoColeta): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM execucao_coleta WHERE id = ?', [exec.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE execucao_coleta SET
                    roteiro_id = ?, data_execucao = ?, status = ?, motorista_id = ?, ajudante_id = ?,
                    veiculo_placa = ?, km_inicial = ?, km_final = ?, observacoes = ?, inicio_em = ?, fim_em = ?
                WHERE id = ?`,
                [exec.roteiroId, exec.dataExecucao, exec.status, exec.motoristaId || null,
                 exec.ajudanteId || null, exec.veiculo || null, exec.kmInicial || null,
                 exec.kmFinal || null, exec.observacoes || null, exec.inicioEm || null,
                 exec.fimEm || null, exec.id]
            );
        } else {
            await this.db.execute(
                `INSERT INTO execucao_coleta
                    (id, roteiro_id, data_execucao, status, motorista_id, ajudante_id, veiculo_placa,
                     km_inicial, km_final, observacoes, inicio_em, fim_em, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [exec.id, exec.roteiroId, exec.dataExecucao, exec.status, exec.motoristaId || null,
                 exec.ajudanteId || null, exec.veiculo || null, exec.kmInicial || null,
                 exec.kmFinal || null, exec.observacoes || null, exec.inicioEm || null,
                 exec.fimEm || null, now]
            );
            const execRows = await this.db.query<Record<string, unknown>>('SELECT * FROM execucao_coleta WHERE id = ? LIMIT 1', [exec.id]);
            await this.sync?.write('execucao.criada', execRows[0] ?? { execucaoId: exec.id }, { aggregateId: exec.id, streamId: exec.roteiroId });
        }
    }

    async updateExecucaoStatus(id: string, status: string, fimEm?: string, alteradoPor?: string, observacao?: string): Promise<void> {
        const current = await this.db.query<{ status: string }>(
            'SELECT status FROM execucao_coleta WHERE id = ? LIMIT 1', [id]
        );
        const statusAnterior = current[0]?.status ?? null;
        if (statusAnterior) {
            ExecucaoColetaStateMachine.validarTransicao(statusAnterior, status);
        }

        await this.db.execute(
            'UPDATE execucao_coleta SET status = ?, fim_em = ? WHERE id = ?',
            [status, fimEm || null, id]
        );

        await this.db.execute(
            `INSERT INTO execucao_coleta_historico
                (id, execucao_id, status_anterior, status_novo, alterado_por, alterado_em, observacao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv7(), id, statusAnterior, status,
             alteradoPor || 'sistema', new Date().toISOString(), observacao || null]
        );
        await this.sync?.write('execucao.status_atualizado', { status }, { aggregateId: id });
    }

    async deleteExecucao(id: string): Promise<void> {
        await this.db.execute('DELETE FROM execucao_coleta WHERE id = ?', [id]);
    }

    // --- Histórico de execução ---
    async findHistoricoByExecucao(execucaoId: string): Promise<ExecucaoHistorico[]> {
        return this.db.query<ExecucaoHistorico>(`
            SELECT h.id, h.execucao_id AS execucaoId,
                   h.status_anterior AS statusAnterior,
                   h.status_novo AS statusNovo,
                   h.alterado_por AS alteradoPor,
                   u.nome AS alteradoPorNome,
                   h.alterado_em AS alteradoEm,
                   h.observacao
            FROM execucao_coleta_historico h
            LEFT JOIN usuarios u ON h.alterado_por = u.id
            WHERE h.execucao_id = ?
            ORDER BY h.alterado_em DESC
        `, [execucaoId]);
    }

    // --- Intercorrências ---
    async findIntercorrenciasByExecucao(execucaoId: string): Promise<Intercorrencia[]> {
        return this.db.query<Intercorrencia>(`
            SELECT i.id, i.execucao_id AS execucaoId,
                   i.tipo_ocorrencia_id AS tipoOcorrenciaId,
                   ti.nome AS tipoOcorrenciaNome,
                   i.tipo_residuo_id AS tipoResiduoId,
                   i.quantidade, i.descricao,
                   i.latitude, i.longitude, i.endereco,
                   i.resolvido,
                   i.resolvido_em AS resolvidoEm,
                   i.resolvido_por AS resolvidoPor,
                   ur.nome AS resolvidoPorNome,
                   i.resolvido_como AS resolvidoComo,
                   i.observacao,
                   i.registrado_por AS registradoPor,
                   uc.nome AS registradoPorNome,
                   i.registrado_em AS registradoEm,
                   i.atualizado_em AS atualizadoEm
            FROM intercorrencias_coleta i
            LEFT JOIN tipos_intercorrencia ti ON i.tipo_ocorrencia_id = ti.id
            LEFT JOIN usuarios ur ON i.resolvido_por = ur.id
            LEFT JOIN usuarios uc ON i.registrado_por = uc.id
            WHERE i.execucao_id = ?
            ORDER BY i.registrado_em DESC
        `, [execucaoId]);
    }

    async saveIntercorrencia(item: Intercorrencia): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM intercorrencias_coleta WHERE id = ?', [item.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE intercorrencias_coleta SET
                    tipo_ocorrencia_id = ?, tipo_residuo_id = ?, quantidade = ?,
                    descricao = ?, latitude = ?, longitude = ?, endereco = ?,
                    observacao = ?, atualizado_em = ?
                 WHERE id = ?`,
                [item.tipoOcorrenciaId, item.tipoResiduoId || null, item.quantidade || null,
                 item.descricao || null, item.latitude || null, item.longitude || null,
                 item.endereco || null, item.observacao || null, now, item.id]
            );
        } else {
            await this.db.execute(
                `INSERT INTO intercorrencias_coleta
                    (id, execucao_id, tipo_ocorrencia_id, tipo_residuo_id, quantidade,
                     descricao, latitude, longitude, endereco, resolvido,
                     observacao, registrado_por, registrado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
                [item.id, item.execucaoId, item.tipoOcorrenciaId, item.tipoResiduoId || null,
                 item.quantidade || null, item.descricao || null, item.latitude || null,
                 item.longitude || null, item.endereco || null, item.observacao || null,
                 item.registradoPor, item.registradoEm, now]
            );
            const intRows = await this.db.query<Record<string, unknown>>('SELECT * FROM intercorrencias_coleta WHERE id = ? LIMIT 1', [item.id]);
            await this.sync?.write('intercorrencia.registrada', intRows[0] ?? { intercorrenciaId: item.id }, { aggregateId: item.id, streamId: item.execucaoId });
        }
    }

    async resolverIntercorrencia(id: string, resolvidoPor: string, resolvidoComo: string): Promise<void> {
        const row = await this.db.query<{ execucao_id: string }>(
            'SELECT execucao_id FROM intercorrencias_coleta WHERE id = ? LIMIT 1', [id]
        );
        await this.db.execute(
            `UPDATE intercorrencias_coleta SET
                resolvido = 1, resolvido_em = ?, resolvido_por = ?, resolvido_como = ?, atualizado_em = ?
             WHERE id = ?`,
            [new Date().toISOString(), resolvidoPor, resolvidoComo, new Date().toISOString(), id]
        );
        const resolRows = await this.db.query<Record<string, unknown>>(
            'SELECT resolvido, resolvido_em, resolvido_por, resolvido_como FROM intercorrencias_coleta WHERE id = ? LIMIT 1', [id]
        );
        await this.sync?.write('intercorrencia.resolvida', resolRows[0] ?? {}, { aggregateId: id, streamId: row[0]?.execucao_id ?? undefined });
    }

    // --- Checklist ---
    async findChecklistByExecucao(execucaoId: string): Promise<ChecklistExecucao[]> {
        return this.db.query<ChecklistExecucao>(`
            SELECT
                c.id,
                c.execucao_id   AS execucaoId,
                c.item,
                c.concluido,
                c.observacao,
                c.evidencia_url AS evidenciaUrl,
                c.latitude,
                c.longitude,
                c.concluido_em  AS concluidoEm,
                c.concluido_por AS concluidoPor,
                u.nome          AS concluidoPorNome
            FROM checklist_execucao c
            LEFT JOIN usuarios u ON c.concluido_por = u.id
            WHERE c.execucao_id = ?
            ORDER BY c.item
        `, [execucaoId]);
    }

    async saveChecklistItem(item: ChecklistExecucao): Promise<void> {
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM checklist_execucao WHERE id = ?', [item.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE checklist_execucao SET
                    execucao_id = ?, item = ?, concluido = ?, observacao = ?, evidencia_url = ?,
                    latitude = ?, longitude = ?, concluido_em = ?, concluido_por = ?
                WHERE id = ?`,
                [item.execucaoId, item.item, item.concluido, item.observacao || null,
                 item.evidenciaUrl || null, item.latitude || null, item.longitude || null,
                 item.concluidoEm || null, item.concluidoPor || null, item.id]
            );
        } else {
            await this.db.execute(
                `INSERT INTO checklist_execucao
                    (id, execucao_id, item, concluido, observacao, evidencia_url, latitude, longitude, concluido_em, concluido_por)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.id, item.execucaoId, item.item, item.concluido, item.observacao || null,
                 item.evidenciaUrl || null, item.latitude || null, item.longitude || null,
                 item.concluidoEm || null, item.concluidoPor || null]
            );
        }
    }

    async completeChecklistItem(
        id: string,
        concluidoPor: string,
        observacao?: string,
        evidenciaUrl?: string,
        latitude?: number,
        longitude?: number
    ): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `UPDATE checklist_execucao SET
                concluido = 1, observacao = ?, evidencia_url = ?, latitude = ?, longitude = ?, concluido_em = ?, concluido_por = ?
            WHERE id = ?`,
            [observacao || null, evidenciaUrl || null, latitude || null, longitude || null, now, concluidoPor, id]
        );
    }

    // --- Execucao Clientes (retorno do checklist) ---
    async findExecucaoClientes(execucaoId: string): Promise<ExecucaoCliente[]> {
        return this.db.query<ExecucaoCliente>(`
            SELECT
                ec.id,
                ec.execucao_id      AS execucaoId,
                ec.cliente_id       AS clienteId,
                ec.coleta_realizada AS coletaRealizada,
                ec.quantidade,
                ec.ocorrencia,
                ec.observacao,
                ec.horario_visita   AS horarioVisita,
                ec.latitude,
                ec.longitude,
                ec.registrado_por   AS registradoPor,
                ec.registrado_em    AS registradoEm,
                c.nome              AS clienteNome
            FROM execucao_clientes ec
            JOIN clientes c ON ec.cliente_id = c.id
            WHERE ec.execucao_id = ?
            ORDER BY c.nome
        `, [execucaoId]);
    }

    async saveExecucaoCliente(item: ExecucaoCliente): Promise<void> {
        const now = new Date().toISOString();
        await this.db.execute(
            `INSERT INTO execucao_clientes (id, execucao_id, cliente_id, coleta_realizada, quantidade, ocorrencia, observacao, horario_visita, latitude, longitude, registrado_por, registrado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(execucao_id, cliente_id) DO UPDATE SET
                 coleta_realizada = excluded.coleta_realizada,
                 quantidade = excluded.quantidade,
                 ocorrencia = excluded.ocorrencia,
                 observacao = excluded.observacao,
                 horario_visita = excluded.horario_visita,
                 latitude = excluded.latitude,
                 longitude = excluded.longitude,
                 registrado_por = excluded.registrado_por,
                 registrado_em = excluded.registrado_em`,
            [item.id, item.execucaoId, item.clienteId, item.coletaRealizada,
             item.quantidade ?? null, item.ocorrencia || null, item.observacao || null, item.horarioVisita || null,
             item.latitude || null, item.longitude || null, item.registradoPor, now]
        );
    }

    // --- Pesagens (despacho/balança externos) ---
    async findPesagensByExecucao(execucaoId: string): Promise<ExecucaoPesagem[]> {
        return this.db.query<ExecucaoPesagem>(`
            SELECT
                p.id,
                p.execucao_id      AS execucaoId,
                p.id_balanca       AS idBalanca,
                p.id_despacho      AS idDespacho,
                p.codigo_despacho  AS codigoDespacho,
                p.data_pesagem     AS dataPesagem,
                p.veiculo,
                p.residuo,
                p.origem,
                p.destino,
                p.tipo_coleta      AS tipoColeta,
                p.peso_liquido     AS pesoLiquido,
                p.situacao,
                p.status_despacho  AS statusDespacho,
                p.criado_em        AS criadoEm
            FROM execucao_pesagens p
            WHERE p.execucao_id = ?
            ORDER BY p.data_pesagem DESC
        `, [execucaoId]);
    }
}
