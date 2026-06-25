import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { CategoriaCliente, Cliente, ClienteContato, ClienteFilter, ClientePjVinculo } from '../../../../types/clientes';
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
                    complemento = ?, observacoes = ?, latitude = ?, longitude = ?, territorial = ?,
                    pj_id = ?, ativo = ?, atualizado_em = ?
                WHERE id = ?`,
                [
                    cliente.tipo, cliente.categoria ?? null, cliente.nome, cliente.documento, cliente.email, cliente.telefone,
                    cliente.cep, cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade,
                    cliente.estado, cliente.complemento, cliente.observacoes ?? null,
                    cliente.latitude ?? null, cliente.longitude ?? null, cliente.territorial ?? null,
                    cliente.pj_id ?? null, cliente.ativo, now, cliente.id,
                ]
            );
        } else {
            await this.db.execute(
                `INSERT INTO clientes
                    (id, tipo, categoria, nome, documento, email, telefone, cep, endereco, numero,
                     bairro, cidade, estado, complemento, observacoes, latitude, longitude, territorial,
                     pj_id, ativo, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    cliente.id, cliente.tipo, cliente.categoria ?? null, cliente.nome, cliente.documento, cliente.email,
                    cliente.telefone, cliente.cep, cliente.endereco, cliente.numero, cliente.bairro,
                    cliente.cidade, cliente.estado, cliente.complemento, cliente.observacoes ?? null,
                    cliente.latitude ?? null, cliente.longitude ?? null, cliente.territorial ?? null,
                    cliente.pj_id ?? null, cliente.ativo, now, now,
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
