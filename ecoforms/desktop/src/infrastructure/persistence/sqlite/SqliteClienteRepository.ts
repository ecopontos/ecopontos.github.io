import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { CategoriaCliente, Cliente, ClienteContato, ClienteFilter, ClienteImovelVinculoWithDetails, ClientePjVinculo, ConfiancaVinculo, ImovelDisponivel, OrigemVinculo, TipoRelacaoVinculo, VinculoSuggestion } from '../../../../types/clientes';
import { pointInPolygon, haversineMeters } from '../../../lib/geometry';
import type { ClienteRepository } from '../../../domain/cliente/ClienteRepository';

interface ClienteRow {
    id: string;
    tipo: string;
    categoria?: string | null;
    nome: string;
    documento?: string | null;
    email?: string | null;
    telefone?: string | null;
    cep?: string | null;
    endereco?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    complemento?: string | null;
    observacoes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geocode_provider?: string | null;
    geocode_source_query?: string | null;
    geocode_display_name?: string | null;
    geocode_precision?: string | null;
    geocode_at?: string | null;
    geocode_confidence?: string | null;
    geocode_validated_at?: string | null;
    geocode_validated_by?: string | null;
    territorial?: string | null;
    pj_id?: string | null;
    ativo: number;
    criado_em?: string | null;
    atualizado_em?: string | null;
}

interface ContatoRow {
    id: string;
    cliente_id: string;
    nome?: string | null;
    cargo?: string | null;
    telefone?: string | null;
    email?: string | null;
    principal: number;
    ativo: number;
    criado_em?: string | null;
}

function rowToCliente(row: ClienteRow): Cliente {
    return {
        id: row.id,
        tipo: row.tipo as 'PF' | 'PJ',
        categoria: (row.categoria ?? null) as CategoriaCliente | null,
        nome: row.nome,
        documento: row.documento ?? null,
        email: row.email ?? null,
        telefone: row.telefone ?? null,
        cep: row.cep ?? null,
        endereco: row.endereco ?? null,
        numero: row.numero ?? null,
        bairro: row.bairro ?? null,
        cidade: row.cidade ?? null,
        estado: row.estado ?? null,
        complemento: row.complemento ?? null,
        observacoes: row.observacoes ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        geocode_provider: row.geocode_provider ?? null,
        geocode_source_query: row.geocode_source_query ?? null,
        geocode_display_name: row.geocode_display_name ?? null,
        geocode_precision: row.geocode_precision ?? null,
        geocode_at: row.geocode_at ?? null,
        geocode_confidence: row.geocode_confidence ?? null,
        geocode_validated_at: row.geocode_validated_at ?? null,
        geocode_validated_by: row.geocode_validated_by ?? null,
        territorial: row.territorial ?? null,
        pj_id: row.pj_id ?? null,
        ativo: row.ativo,
        criado_em: row.criado_em ?? null,
        atualizado_em: row.atualizado_em ?? null,
    };
}

function rowToContato(row: ContatoRow): ClienteContato {
    return {
        id: row.id,
        cliente_id: row.cliente_id,
        nome: row.nome ?? null,
        cargo: row.cargo ?? null,
        telefone: row.telefone ?? null,
        email: row.email ?? null,
        principal: row.principal,
        ativo: row.ativo,
        criado_em: row.criado_em ?? null,
    };
}

export class SqliteClienteRepository implements ClienteRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(filter?: ClienteFilter): Promise<Cliente[]> {
        const conditions: string[] = ['1=1'];
        const params: unknown[] = [];
        if (filter?.tipo) {
            conditions.push('tipo = ?'); params.push(filter.tipo);
        }
        if (filter?.ativo !== undefined) {
            conditions.push('ativo = ?'); params.push(filter.ativo ? 1 : 0);
        }
        if (filter?.searchTerm) {
            conditions.push('(nome LIKE ? OR documento LIKE ? OR email LIKE ? OR telefone LIKE ?)');
            const like = `%${filter.searchTerm}%`;
            params.push(like, like, like, like);
        }
        const sql = `SELECT * FROM clientes WHERE ${conditions.join(' AND ')} ORDER BY nome`;
        const rows = await this.db.query<ClienteRow>(sql, params);
        return rows.map(rowToCliente);
    }

    async findByTelefone(telefone: string): Promise<Cliente[]> {
        const digits = telefone.replace(/\D/g, '');
        if (!digits) return [];
        const like = `%${digits}%`;
        const rows = await this.db.query<ClienteRow>(
            `SELECT * FROM clientes
             WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone,'(',''),')',''),' ',''),'-',''),'+','') LIKE ?
             AND ativo = 1
             ORDER BY nome`,
            [like]
        );
        return rows.map(rowToCliente);
    }

    async findById(id: string): Promise<Cliente | null> {
        const rows = await this.db.query<ClienteRow>(
            'SELECT * FROM clientes WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] ? rowToCliente(rows[0]) : null;
    }

    async findByDocumento(documento: string): Promise<Cliente | null> {
        const rows = await this.db.query<ClienteRow>(
            'SELECT * FROM clientes WHERE documento = ? LIMIT 1',
            [documento]
        );
        return rows[0] ? rowToCliente(rows[0]) : null;
    }

    async findContatos(clienteId: string): Promise<ClienteContato[]> {
        const rows = await this.db.query<ContatoRow>(
            'SELECT * FROM cliente_contatos WHERE cliente_id = ? AND ativo = 1 ORDER BY principal DESC, nome',
            [clienteId]
        );
        return rows.map(rowToContato);
    }

    async findPfByPjId(pjId: string): Promise<Cliente[]> {
        const rows = await this.db.query<ClienteRow>(
            `SELECT c.* FROM clientes c
             INNER JOIN cliente_pj_vinculo v ON v.pf_id = c.id
             WHERE v.pj_id = ? AND c.ativo = 1
             ORDER BY c.nome`,
            [pjId]
        );
        if (rows.length > 0) return rows.map(rowToCliente);
        const legacyRows = await this.db.query<ClienteRow>(
            'SELECT * FROM clientes WHERE tipo = ? AND pj_id = ? AND ativo = 1 ORDER BY nome',
            ['PF', pjId]
        );
        return legacyRows.map(rowToCliente);
    }

    async findPjByPfId(pfId: string): Promise<(ClientePjVinculo & { pj_nome: string; pj_documento?: string | null; pj_cidade?: string | null; pj_estado?: string | null })[]> {
        const rows = await this.db.query<{
            id: string; pf_id: string; pj_id: string; funcao: string | null; principal: number; criado_em: string | null;
            pj_nome: string; pj_documento: string | null; pj_cidade: string | null; pj_estado: string | null;
        }>(
            `SELECT v.id, v.pf_id, v.pj_id, v.funcao, v.principal, v.criado_em,
                    c.nome as pj_nome, c.documento as pj_documento, c.cidade as pj_cidade, c.estado as pj_estado
             FROM cliente_pj_vinculo v
             INNER JOIN clientes c ON c.id = v.pj_id
             WHERE v.pf_id = ?
             ORDER BY v.principal DESC, c.nome`,
            [pfId]
        );
        return rows.map(r => ({
            id: r.id, pf_id: r.pf_id, pj_id: r.pj_id, funcao: r.funcao, principal: r.principal, criado_em: r.criado_em,
            pj_nome: r.pj_nome, pj_documento: r.pj_documento, pj_cidade: r.pj_cidade, pj_estado: r.pj_estado,
        }));
    }

    async findPfUnassigned(): Promise<Cliente[]> {
        const rows = await this.db.query<ClienteRow>(
            `SELECT * FROM clientes WHERE tipo = ? AND ativo = 1
             AND id NOT IN (SELECT pf_id FROM cliente_pj_vinculo)
             AND (pj_id IS NULL OR pj_id = '')
             ORDER BY nome`,
            ['PF']
        );
        return rows.map(rowToCliente);
    }

    async findPjUnassignedToPf(pfId: string): Promise<Cliente[]> {
        const rows = await this.db.query<ClienteRow>(
            `SELECT * FROM clientes WHERE tipo = 'PJ' AND ativo = 1
             AND id NOT IN (SELECT pj_id FROM cliente_pj_vinculo WHERE pf_id = ?)
             ORDER BY nome`,
            [pfId]
        );
        return rows.map(rowToCliente);
    }

    async linkPfToPj(pfId: string, pjId: string, funcao?: string | null): Promise<void> {
        const id = `vinc-${pfId}-${pjId}`;
        await this.db.execute(
            `INSERT OR IGNORE INTO cliente_pj_vinculo (id, pf_id, pj_id, funcao, principal, criado_em)
             VALUES (?, ?, ?, ?, 0, datetime('now'))`,
            [id, pfId, pjId, funcao ?? null]
        );
        await this.db.execute(
            'UPDATE clientes SET pj_id = ?, atualizado_em = datetime(\'now\') WHERE id = ? AND tipo = ?',
            [pjId, pfId, 'PF']
        );
    }

    async unlinkPfFromPj(pfId: string, pjId: string): Promise<void> {
        await this.db.execute(
            'DELETE FROM cliente_pj_vinculo WHERE pf_id = ? AND pj_id = ?',
            [pfId, pjId]
        );
        const remaining = await this.db.query<{ cnt: number }>(
            'SELECT COUNT(*) as cnt FROM cliente_pj_vinculo WHERE pf_id = ?',
            [pfId]
        );
        if ((remaining[0]?.cnt ?? 0) === 0) {
            await this.db.execute(
                'UPDATE clientes SET pj_id = NULL, atualizado_em = datetime(\'now\') WHERE id = ?',
                [pfId]
            );
        }
    }

    async updateVinculoFuncao(vinculoId: string, funcao: string): Promise<void> {
        await this.db.execute(
            'UPDATE cliente_pj_vinculo SET funcao = ? WHERE id = ?',
            [funcao, vinculoId]
        );
    }

    // ── Fase 3: vínculo N:N cliente↔imóvel (terreno) ──

    async findImoveisByClienteId(clienteId: string): Promise<ClienteImovelVinculoWithDetails[]> {
        const rows = await this.db.query<Omit<ClienteImovelVinculoWithDetails, 'principal' | 'confianca'> & { principal: number; confianca: string | null }>(
            `SELECT v.id, v.cliente_id, v.imovel_id, v.tipo_relacao, v.principal, v.confianca,
                    v.origem, v.valido_de, v.valido_ate, v.criado_em, v.atualizado_em,
                    t.nome            AS imovel_nome,
                    t.codigo_cadastral AS imovel_codigo_cadastral,
                    t.bairro           AS imovel_bairro,
                    t.cidade           AS imovel_cidade,
                    t.estado           AS imovel_estado
             FROM cliente_imovel_vinculos v
             JOIN terrenos t ON t.id = v.imovel_id
             WHERE v.cliente_id = ?
             ORDER BY v.principal DESC, t.nome ASC`,
            [clienteId]
        );
        return rows.map((r) => ({
            id: r.id,
            cliente_id: r.cliente_id,
            imovel_id: r.imovel_id,
            tipo_relacao: (r.tipo_relacao ?? null) as TipoRelacaoVinculo | null,
            principal: r.principal,
            confianca: (r.confianca ?? null) as ConfiancaVinculo | null,
            origem: (r.origem ?? null) as OrigemVinculo | null,
            valido_de: r.valido_de ?? null,
            valido_ate: r.valido_ate ?? null,
            criado_em: r.criado_em ?? null,
            atualizado_em: r.atualizado_em ?? null,
            imovel_nome: r.imovel_nome,
            imovel_codigo_cadastral: r.imovel_codigo_cadastral ?? null,
            imovel_bairro: r.imovel_bairro ?? null,
            imovel_cidade: r.imovel_cidade ?? null,
            imovel_estado: r.imovel_estado ?? null,
        }));
    }

    async findImoveisDisponiveis(clienteId: string, search?: string): Promise<ImovelDisponivel[]> {
        const like = search ? `%${search}%` : null;
        const rows = await this.db.query<{ id: string; nome: string; codigo_cadastral: string | null; bairro: string | null; cidade: string | null; estado: string | null }>(
            `SELECT t.id, t.nome, t.codigo_cadastral, t.bairro, t.cidade, t.estado
             FROM terrenos t
             WHERE t.ativo = 1
               AND t.id NOT IN (SELECT imovel_id FROM cliente_imovel_vinculos WHERE cliente_id = ?)
               ${like ? 'AND (t.nome LIKE ? OR t.codigo_cadastral LIKE ? OR t.bairro LIKE ?)' : ''}
             ORDER BY t.nome
             LIMIT 100`,
            like ? [clienteId, like, like, like] : [clienteId]
        );
        return rows.map((r) => ({
            id: r.id,
            nome: r.nome,
            codigo_cadastral: r.codigo_cadastral ?? null,
            bairro: r.bairro ?? null,
            cidade: r.cidade ?? null,
            estado: r.estado ?? null,
        }));
    }

    async linkClienteToImovel(
        clienteId: string,
        imovelId: string,
        tipo_relacao?: TipoRelacaoVinculo | null,
        principal = false,
        confianca?: ConfiancaVinculo | null,
        origem?: OrigemVinculo | null,
    ): Promise<void> {
        const id = `cvinc-${clienteId}-${imovelId}`;
        await this.db.execute(
            `INSERT OR IGNORE INTO cliente_imovel_vinculos
                (id, cliente_id, imovel_id, tipo_relacao, principal, confianca, origem, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, clienteId, imovelId, tipo_relacao ?? null, principal ? 1 : 0, confianca ?? null, origem ?? 'manual']
        );
        // Sincroniza a coluna legada clientes.terreno_id quando o vínculo é principal,
        // mantendo as leituras de mapa/logística (CLIENTES_GEO, ROTEIRO_CLIENTES_ITINERARIO)
        // funcionando sem precisar migrá-las neste PR.
        if (principal) {
            await this.db.execute(
                `UPDATE clientes SET terreno_id = ?, atualizado_em = datetime('now') WHERE id = ?`,
                [imovelId, clienteId]
            );
        }
    }

    async unlinkClienteFromImovel(vinculoId: string): Promise<void> {
        // Antes de remover, descobre se era o vínculo principal do cliente.
        const rows = await this.db.query<{ cliente_id: string; imovel_id: string; principal: number }>(
            'SELECT cliente_id, imovel_id, principal FROM cliente_imovel_vinculos WHERE id = ?',
            [vinculoId]
        );
        const v = rows[0];
        await this.db.execute('DELETE FROM cliente_imovel_vinculos WHERE id = ?', [vinculoId]);
        // Se era o principal e não há outro vínculo principal, limpa a coluna legada.
        if (v?.principal) {
            const remaining = await this.db.query<{ cnt: number }>(
                'SELECT COUNT(*) as cnt FROM cliente_imovel_vinculos WHERE cliente_id = ? AND principal = 1',
                [v.cliente_id]
            );
            if ((remaining[0]?.cnt ?? 0) === 0) {
                await this.db.execute(
                    `UPDATE clientes SET terreno_id = NULL, atualizado_em = datetime('now') WHERE id = ?`,
                    [v.cliente_id]
                );
            }
        }
    }

    async updateVinculoImovel(vinculoId: string, update: { tipo_relacao?: TipoRelacaoVinculo | null; principal?: boolean; confianca?: ConfiancaVinculo | null }): Promise<void> {
        const sets: string[] = [];
        const params: (string | number | null)[] = [];
        if (update.tipo_relacao !== undefined) { sets.push('tipo_relacao = ?'); params.push(update.tipo_relacao ?? null); }
        if (update.confianca !== undefined) { sets.push('confianca = ?'); params.push(update.confianca ?? null); }
        if (update.principal !== undefined) { sets.push('principal = ?'); params.push(update.principal ? 1 : 0); }
        if (sets.length === 0) return;
        sets.push("atualizado_em = datetime('now')");
        params.push(vinculoId);
        await this.db.execute(
            `UPDATE cliente_imovel_vinculos SET ${sets.join(', ')} WHERE id = ?`,
            params
        );
        // Se mudou o status de principal, sincroniza a coluna legada clientes.terreno_id.
        if (update.principal !== undefined) {
            const rows = await this.db.query<{ cliente_id: string; imovel_id: string }>(
                'SELECT cliente_id, imovel_id FROM cliente_imovel_vinculos WHERE id = ?',
                [vinculoId]
            );
            const v = rows[0];
            if (v && update.principal) {
                // Garante unicidade do principal: desmarca outros principais do mesmo cliente.
                await this.db.execute(
                    `UPDATE cliente_imovel_vinculos SET principal = 0 WHERE cliente_id = ? AND id != ?`,
                    [v.cliente_id, vinculoId]
                );
                await this.db.execute(
                    `UPDATE clientes SET terreno_id = ?, atualizado_em = datetime('now') WHERE id = ?`,
                    [v.imovel_id, v.cliente_id]
                );
            } else if (v && !update.principal) {
                // Desmarcado como principal: se não sobrar outro principal para o cliente,
                // limpa a coluna legada (mesmo comportamento de unlinkClienteFromImovel).
                const remaining = await this.db.query<{ cnt: number }>(
                    'SELECT COUNT(*) as cnt FROM cliente_imovel_vinculos WHERE cliente_id = ? AND principal = 1',
                    [v.cliente_id]
                );
                if ((remaining[0]?.cnt ?? 0) === 0) {
                    await this.db.execute(
                        `UPDATE clientes SET terreno_id = NULL, atualizado_em = datetime('now') WHERE id = ?`,
                        [v.cliente_id]
                    );
                }
            }
        }
    }

    /**
     * Sugere imóveis para vinculação usando 3 heurísticas (Fase 3, diretriz 4):
     *   1. código cadastral — `terrenos.codigo_cadastral` bate com `clientes.territorial`
     *   2. ponto no polígono — lat/lng do cliente cai dentro da poligonal do terreno
     *   3. proximidade — distância haversine até o centroide (top N mais próximos)
     * As heurísticas 2 e 3 rodam no cliente sobre `TERRENOS_ATIVOS` (geojson + centroid),
     * porque o SQLite não tem operações espaciais nativas.
     */
    async suggestImoveisForCliente(clienteId: string): Promise<VinculoSuggestion[]> {
        const cliente = await this.findById(clienteId);
        if (!cliente) return [];

        const suggestions: VinculoSuggestion[] = [];
        const seen = new Set<string>();

        // Heurística 1: código cadastral.
        if (cliente.territorial) {
            const rows = await this.db.query<{ id: string; nome: string; codigo_cadastral: string | null; bairro: string | null }>(
                `SELECT id, nome, codigo_cadastral, bairro FROM terrenos
                 WHERE ativo = 1 AND codigo_cadastral = ?
                   AND id NOT IN (SELECT imovel_id FROM cliente_imovel_vinculos WHERE cliente_id = ?)`,
                [cliente.territorial, clienteId]
            );
            for (const r of rows) {
                suggestions.push({
                    imovel_id: r.id, imovel_nome: r.nome,
                    imovel_codigo_cadastral: r.codigo_cadastral ?? null,
                    imovel_bairro: r.bairro ?? null,
                    motivo: 'codigo_cadastral', distancia_m: null, confianca: 'alta',
                });
                seen.add(r.id);
            }
        }

        // Heurísticas 2 e 3 exigem lat/lng do cliente e terrenos com geojson/centroid.
        if (cliente.latitude != null && cliente.longitude != null) {
            const terrenos = await this.db.query<{ id: string; nome: string; codigo_cadastral: string | null; bairro: string | null; geojson: string; centroid_lat: number | null; centroid_lng: number | null }>(
                `SELECT id, nome, codigo_cadastral, bairro, geojson, centroid_lat, centroid_lng
                 FROM terrenos
                 WHERE ativo = 1
                   AND id NOT IN (SELECT imovel_id FROM cliente_imovel_vinculos WHERE cliente_id = ?)`,
                [clienteId]
            );
            const point: [number, number] = [cliente.longitude, cliente.latitude];

            // Heurística 2: ponto no polígono.
            for (const t of terrenos) {
                if (seen.has(t.id)) continue;
                try {
                    const gj = JSON.parse(t.geojson);
                    if (pointInPolygon(point, gj)) {
                        suggestions.push({
                            imovel_id: t.id, imovel_nome: t.nome,
                            imovel_codigo_cadastral: t.codigo_cadastral ?? null,
                            imovel_bairro: t.bairro ?? null,
                            motivo: 'ponto_no_poligono', distancia_m: null, confianca: 'alta',
                        });
                        seen.add(t.id);
                    }
                } catch {
                    // geojson malformado — ignora este terreno para PIP.
                }
            }

            // Heurística 3: proximidade pelos centroides.
            const byDist = terrenos
                .filter((t) => !seen.has(t.id) && t.centroid_lat != null && t.centroid_lng != null)
                .map((t) => ({
                    t,
                    d: haversineMeters(point, [t.centroid_lng!, t.centroid_lat!]),
                }))
                .sort((a, b) => a.d - b.d)
                .slice(0, 5);
            for (const { t, d } of byDist) {
                const confianca: ConfiancaVinculo = d <= 100 ? 'alta' : d <= 500 ? 'media' : 'baixa';
                suggestions.push({
                    imovel_id: t.id, imovel_nome: t.nome,
                    imovel_codigo_cadastral: t.codigo_cadastral ?? null,
                    imovel_bairro: t.bairro ?? null,
                    motivo: 'proximidade', distancia_m: Math.round(d), confianca,
                });
            }
        }

        return suggestions;
    }

    async save(cliente: Cliente): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM clientes WHERE id = ?',
            [cliente.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE clientes SET
                    tipo = ?, categoria = ?, nome = ?, documento = ?, email = ?, telefone = ?,
                    cep = ?, endereco = ?, numero = ?, bairro = ?, cidade = ?, estado = ?,
                    complemento = ?, observacoes = ?, latitude = ?, longitude = ?,
                    geocode_provider = ?, geocode_source_query = ?, geocode_display_name = ?,
                    geocode_precision = ?, geocode_at = ?, geocode_confidence = ?,
                    geocode_validated_at = ?, geocode_validated_by = ?,
                    territorial = ?, pj_id = ?, ativo = ?, atualizado_em = ?
                WHERE id = ?`,
                [
                    cliente.tipo, cliente.categoria ?? null, cliente.nome, cliente.documento, cliente.email, cliente.telefone,
                    cliente.cep, cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade,
                    cliente.estado, cliente.complemento, cliente.observacoes ?? null,
                    cliente.latitude ?? null, cliente.longitude ?? null,
                    cliente.geocode_provider ?? null, cliente.geocode_source_query ?? null, cliente.geocode_display_name ?? null,
                    cliente.geocode_precision ?? null, cliente.geocode_at ?? null, cliente.geocode_confidence ?? null,
                    cliente.geocode_validated_at ?? null, cliente.geocode_validated_by ?? null,
                    cliente.territorial ?? null, cliente.pj_id ?? null, cliente.ativo, now, cliente.id,
                ]
            );
        } else {
            await this.db.execute(
                `INSERT INTO clientes
                    (id, tipo, categoria, nome, documento, email, telefone, cep, endereco, numero,
                     bairro, cidade, estado, complemento, observacoes, latitude, longitude,
                     geocode_provider, geocode_source_query, geocode_display_name, geocode_precision,
                     geocode_at, geocode_confidence, geocode_validated_at, geocode_validated_by,
                     territorial, pj_id, ativo, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    cliente.id, cliente.tipo, cliente.categoria ?? null, cliente.nome, cliente.documento, cliente.email,
                    cliente.telefone, cliente.cep, cliente.endereco, cliente.numero, cliente.bairro,
                    cliente.cidade, cliente.estado, cliente.complemento, cliente.observacoes ?? null,
                    cliente.latitude ?? null, cliente.longitude ?? null,
                    cliente.geocode_provider ?? null, cliente.geocode_source_query ?? null, cliente.geocode_display_name ?? null,
                    cliente.geocode_precision ?? null, cliente.geocode_at ?? null, cliente.geocode_confidence ?? null,
                    cliente.geocode_validated_at ?? null, cliente.geocode_validated_by ?? null,
                    cliente.territorial ?? null, cliente.pj_id ?? null, cliente.ativo, now, now,
                ]
            );
        }
    }

    async saveContato(contato: ClienteContato): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM cliente_contatos WHERE id = ?',
            [contato.id]
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE cliente_contatos SET
                    cliente_id = ?, nome = ?, cargo = ?, telefone = ?, email = ?, principal = ?, ativo = ?
                WHERE id = ?`,
                [contato.cliente_id, contato.nome, contato.cargo, contato.telefone, contato.email,
                 contato.principal, contato.ativo, contato.id]
            );
        } else {
            await this.db.execute(
                `INSERT INTO cliente_contatos (id, cliente_id, nome, cargo, telefone, email, principal, ativo, criado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [contato.id, contato.cliente_id, contato.nome, contato.cargo, contato.telefone,
                 contato.email, contato.principal, contato.ativo, now]
            );
        }
    }

    async deleteContato(contatoId: string): Promise<void> {
        await this.db.execute('UPDATE cliente_contatos SET ativo = 0 WHERE id = ?', [contatoId]);
    }

    async delete(id: string): Promise<void> {
        await this.db.execute('UPDATE clientes SET ativo = 0 WHERE id = ?', [id]);
    }

    async nameExists(nome: string, excludeId?: string): Promise<boolean> {
        const sql = excludeId
            ? 'SELECT COUNT(*) as count FROM clientes WHERE nome = ? AND id != ?'
            : 'SELECT COUNT(*) as count FROM clientes WHERE nome = ?';
        const params = excludeId ? [nome, excludeId] : [nome];
        const rows = await this.db.query<{ count: number }>(sql, params);
        return (rows[0]?.count ?? 0) > 0;
    }

    async documentoExists(documento: string, excludeId?: string): Promise<boolean> {
        if (!documento) return false;
        const sql = excludeId
            ? 'SELECT COUNT(*) as count FROM clientes WHERE documento = ? AND id != ?'
            : 'SELECT COUNT(*) as count FROM clientes WHERE documento = ?';
        const params = excludeId ? [documento, excludeId] : [documento];
        const rows = await this.db.query<{ count: number }>(sql, params);
        return (rows[0]?.count ?? 0) > 0;
    }
}
