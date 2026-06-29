import type { SqlitePort } from '../../application/ports/SqlitePort';

type Row = Record<string, unknown>;

/**
 * Fake SqlitePort para testes. Interpreta um subconjunto das queries
 * emitidas pelos serviços de sync (TransportService, InboundService, Manifest).
 */
export class InMemorySqlitePort implements SqlitePort {
    private tables: Map<string, Row[]> = new Map();

    // Acesso direto às tabelas para assertions nos testes
    getTable(name: string): Row[] {
        return this.tables.get(name) ?? [];
    }

    private ensure(table: string): Row[] {
        if (!this.tables.has(table)) this.tables.set(table, []);
        return this.tables.get(table)!;
    }

    async query<T = unknown>(sql: string, params: unknown[] = [], _options?: { bootstrap?: boolean }): Promise<T[]> {
        const s = sql.trim().replace(/\s+/g, ' ');

        // SELECT COALESCE(MAX(sequencia), 0) + 1 AS seq FROM fila_eventos_sync
        if (/SELECT COALESCE\(MAX\(sequencia\)/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync');
            const max = rows.reduce((m, r) => Math.max(m, (r.seq as number) ?? 0), 0);
            return [{ seq: max + 1 }] as T[];
        }

        // SELECT id FROM fila_eventos_sync WHERE situacao = 'sent' ORDER BY sequencia DESC LIMIT 1
        if (/FROM fila_eventos_sync.*situacao = 'sent'/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync')
                .filter(r => r.status === 'sent')
                .sort((a, b) => ((b.seq as number) ?? 0) - ((a.seq as number) ?? 0));
            return rows.slice(0, 1).map(r => ({ id: r.id })) as T[];
        }

        // SELECT id, sequencia AS seq, carga AS payload FROM fila_eventos_sync WHERE situacao = 'pending'
        if (/FROM fila_eventos_sync.*situacao = 'pending'/i.test(s)) {
            const limit = typeof params[0] === 'number' ? (params[0] as number) : 50;
            const rows = this.ensure('fila_eventos_sync')
                .filter(r => r.status === 'pending')
                .sort((a, b) => ((a.seq as number) ?? 0) - ((b.seq as number) ?? 0))
                .slice(0, limit);
            return rows as T[];
        }

        // SELECT sequencia FROM manifesto_sync WHERE id_roteamento = ? LIMIT 1
        if (/FROM manifesto_sync/i.test(s)) {
            const rows = this.ensure('manifesto_sync').filter(r => r.routing_id === params[0]);
            return rows.slice(0, 1).map(r => ({ sequencia: r.seq })) as T[];
        }

        // SELECT 1 AS e FROM log_eventos_aplicados WHERE envelope_id = ?
        if (/FROM log_eventos_aplicados/i.test(s)) {
            const rows = this.ensure('log_eventos_aplicados').filter(r => r.envelope_id === params[0]);
            return rows.slice(0, 1).map(() => ({ e: 1 })) as T[];
        }

        // SELECT COUNT(*) AS count FROM fila_eventos_sync WHERE situacao IN ('pending', 'failed')
        if (/COUNT\(\*\).*fila_eventos_sync.*situacao IN/i.test(s)) {
            const count = this.ensure('fila_eventos_sync').filter(r => r.status === 'pending' || r.status === 'failed').length;
            return [{ count }] as T[];
        }

        // SELECT COUNT(*) AS count FROM fila_eventos_sync WHERE situacao = 'pending'
        if (/COUNT\(\*\).*fila_eventos_sync/i.test(s)) {
            const count = this.ensure('fila_eventos_sync').filter(r => r.status === 'pending').length;
            return [{ count }] as T[];
        }

        // SELECT id FROM fila_eventos_sync WHERE status = 'sent' ORDER BY seq DESC LIMIT 1
        if (/FROM fila_eventos_sync.*status = 'sent'/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync')
                .filter(r => r.status === 'sent')
                .sort((a, b) => ((b.seq as number) ?? 0) - ((a.seq as number) ?? 0));
            return rows.slice(0, 1).map(r => ({ id: r.id })) as T[];
        }

        // SELECT ... FROM fila_eventos_sync WHERE situacao IN ('pending', 'failed') AND tentativas < ?
        if (/FROM fila_eventos_sync.*situacao IN/i.test(s)) {
            const maxRetries = typeof params[0] === 'number' ? (params[0] as number) : 3;
            const limit = typeof params[1] === 'number' ? (params[1] as number) : 50;
            const rows = this.ensure('fila_eventos_sync')
                .filter(r => (r.status === 'pending' || r.status === 'failed') && ((r.attempts as number) ?? 0) < maxRetries)
                .sort((a, b) => ((a.seq as number) ?? 0) - ((b.seq as number) ?? 0))
                .slice(0, limit);
            return rows as T[];
        }

        // SELECT id, seq, payload FROM fila_eventos_sync WHERE status = 'pending'
        if (/FROM fila_eventos_sync.*status = 'pending'/i.test(s)) {
            const limit = typeof params[0] === 'number' ? (params[0] as number) : 50;
            const rows = this.ensure('fila_eventos_sync')
                .filter(r => r.status === 'pending')
                .sort((a, b) => ((a.seq as number) ?? 0) - ((b.seq as number) ?? 0))
                .slice(0, limit);
            return rows as T[];
        }

        // SELECT * FROM log_gaps_sync [WHERE id_roteamento = ?] ... LIMIT ?
        if (/FROM log_gaps_sync/i.test(s)) {
            let rows = this.ensure('log_gaps_sync');
            if (/WHERE id_roteamento\s*=\s*\?/i.test(s)) {
                rows = rows.filter(r => r.id_roteamento === params[0]);
            }
            // tentativas lookup for _retryGap: returns { tentativas }
            if (/SELECT tentativas/i.test(s) && /sequencia_faltante\s*=\s*\?/i.test(s)) {
                const seqParam = params.find(p => typeof p === 'number');
                const filtered = rows.filter(r => r.sequencia_faltante === seqParam);
                return (filtered[0] ? [{ tentativas: filtered[0].tentativas ?? 0 }] : []) as T[];
            }
            const limitMatch = s.match(/LIMIT\s*(\?|\d+)/i);
            const limit = limitMatch ? (typeof params[params.length - 1] === 'number' ? (params[params.length - 1] as number) : 100) : 100;
            return rows.slice(0, limit) as T[];
        }

        // SELECT seq FROM manifesto_sync WHERE routing_id = ?
        if (/FROM manifesto_sync/i.test(s)) {
            const rows = this.ensure('manifesto_sync').filter(r => r.routing_id === params[0]);
            return rows.slice(0, 1) as T[];
        }

        // SELECT 1 AS e FROM log_eventos_aplicados WHERE envelope_id = ?
        if (/FROM log_eventos_aplicados/i.test(s)) {
            const rows = this.ensure('log_eventos_aplicados').filter(r => r.envelope_id === params[0]);
            return rows.slice(0, 1).map(() => ({ e: 1 })) as T[];
        }

        // SELECT COUNT(*) AS count FROM fila_eventos_sync WHERE situacao IN ('pending', 'failed')
        if (/COUNT\(\*\).*fila_eventos_sync.*situacao IN/i.test(s)) {
            const count = this.ensure('fila_eventos_sync').filter(r => r.status === 'pending' || r.status === 'failed').length;
            return [{ count }] as T[];
        }

        // SELECT COUNT(*) AS count FROM fila_eventos_sync WHERE status = 'pending'
        if (/COUNT\(\*\).*fila_eventos_sync/i.test(s)) {
            const count = this.ensure('fila_eventos_sync').filter(r => r.status === 'pending').length;
            return [{ count }] as T[];
        }

        return [];
    }

    async all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        return this.query<T>(sql, params);
    }

    async execute(sql: string, params: unknown[] = []): Promise<void> {
        const s = sql.trim().replace(/\s+/g, ' ');

        // INSERT INTO fila_eventos_sync
        if (/INSERT INTO fila_eventos_sync/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync');
            rows.push({
                id: params[0], type: params[1], payload: params[2],
                aggregate_type: params[3], aggregate_id: params[4],
                seq: params[5], status: 'pending', attempts: 0,
                created_at: new Date().toISOString(), sent_at: null,
            });
            return;
        }

        // UPDATE fila_eventos_sync SET situacao = 'sent'
        if (/UPDATE fila_eventos_sync SET situacao = 'sent'/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync');
            const row = rows.find(r => r.id === params[0]);
            if (row) { row.status = 'sent'; row.sent_at = new Date().toISOString(); }
            return;
        }

        // UPDATE fila_eventos_sync SET situacao = 'failed'
        if (/UPDATE fila_eventos_sync SET situacao = 'failed'/i.test(s)) {
            const rows = this.ensure('fila_eventos_sync');
            const row = rows.find(r => r.id === params[0]);
            if (row) { row.status = 'failed'; row.attempts = ((row.attempts as number) ?? 0) + 1; }
            return;
        }

        // INSERT INTO manifesto_sync ... ON CONFLICT DO UPDATE
        if (/INSERT INTO manifesto_sync/i.test(s)) {
            const rows = this.ensure('manifesto_sync');
            const existing = rows.find(r => r.routing_id === params[0]);
            if (existing) {
                existing.seq = params[1];
                existing.last_event_id = params[2];
                existing.updated_at = new Date().toISOString();
            } else {
                rows.push({
                    routing_id: params[0], seq: params[1],
                    last_event_id: params[2], updated_at: new Date().toISOString(),
                });
            }
            return;
        }

        // INSERT OR IGNORE INTO log_eventos_aplicados
        if (/INSERT.*log_eventos_aplicados/i.test(s)) {
            const rows = this.ensure('log_eventos_aplicados');
            const exists = rows.some(r => r.envelope_id === params[0]);
            if (!exists) {
                rows.push({
                    envelope_id: params[0], entity_type: params[1],
                    entity_id: params[2], storage_path: params[3], source_device: params[4],
                });
            }
            return;
        }

        // INSERT OR IGNORE INTO log_gaps_sync
        if (/INSERT.*log_gaps_sync/i.test(s)) {
            const rows = this.ensure('log_gaps_sync');
            const exists = rows.some(r => r.id === params[0]);
            if (!exists) {
                rows.push({
                    id: params[0],
                    id_roteamento: params[1],
                    sequencia_faltante: params[2],
                    situacao: 'pending',
                    tentativas: 0,
                    resolvido_em: null,
                    detectado_em: new Date().toISOString(),
                });
            }
            return;
        }

        // UPDATE log_gaps_sync SET situacao = ... WHERE id_roteamento = ? AND sequencia_faltante = ?
        if (/UPDATE log_gaps_sync/i.test(s)) {
            const rows = this.ensure('log_gaps_sync');
            // Extract situacao: either literal ('retrying') or parametrized (?)
            const situacaoLiteralMatch = s.match(/situacao\s*=\s*'(\w+)'/i);
            const isSituacaoParam = /situacao\s*=\s*\?/i.test(s);
            const isRetrying = /situacao\s*=\s*'retrying'/i.test(s);
            const isResolved = /resolvido_em\s*=\s*datetime/i.test(s);
            // For parametrized situacao: params[0] is the status value
            const paramStatus = isSituacaoParam ? String(params[0]) : undefined;
            const newStatus = situacaoLiteralMatch ? situacaoLiteralMatch[1] : paramStatus;
            // For parametrized: routingId and missingSeq shift by 1
            const routingIdx = isSituacaoParam ? 1 : 0;
            const seqIdx = isSituacaoParam ? 2 : 1;
            for (const r of rows) {
                if (r.id_roteamento === params[routingIdx] && r.sequencia_faltante === params[seqIdx]) {
                    if (newStatus) r.situacao = newStatus;
                    if (isRetrying) r.tentativas = ((r.tentativas as number | undefined) ?? 0) + 1;
                    if (isResolved) r.resolvido_em = new Date().toISOString();
                }
            }
            return;
        }

        // INSERT OR REPLACE / INSERT OR IGNORE into any table (handlers inbound)
        const insertMatch = s.match(/INSERT (?:OR \w+ )?INTO (\w+)/i);
        if (insertMatch) {
            const table = insertMatch[1];
            const rows = this.ensure(table);
            // Armazena como objeto genérico com params[0] como id
            rows.push({ id: params[0], _raw: params });
            return;
        }

        // DELETE genérico
        const deleteMatch = s.match(/DELETE FROM (\w+) WHERE (.+)/i);
        if (deleteMatch) {
            const table = deleteMatch[1];
            const rows = this.ensure(table);
            // Implementação simplificada: remove todos se for DELETE sem WHERE restritivo
            // ou filtra por situacao=sent para a tabela de sync
            if (table === 'fila_eventos_sync') {
                const newRows = rows.filter(r => r.status !== 'sent');
                this.tables.set(table, newRows);
            } else {
                this.tables.set(table, []);
            }
            return;
        }

        // UPDATE genérico
        const updateMatch = s.match(/UPDATE (\w+) SET (.+) WHERE id = \?/i);
        if (updateMatch) {
            const table = updateMatch[1];
            const rows = this.ensure(table);
            const row = rows.find(r => r.id === params[params.length - 1]);
            if (row) {
                const setClause = updateMatch[2];
                const setPairs = setClause.split(',').map(p => p.trim());
                let paramIdx = 0;
                for (const pair of setPairs) {
                    const [col] = pair.split('=').map(p => p.trim());
                    if (!col.includes('datetime')) {
                        row[col] = params[paramIdx++];
                    }
                }
            }
            return;
        }
    }

    async transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T> {
        return callback(this);
    }
}
