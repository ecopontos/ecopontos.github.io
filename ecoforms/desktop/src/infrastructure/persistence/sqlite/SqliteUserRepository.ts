import { User } from '../../../domain/user/User';
import type { UserRepository } from '../../../domain/user/UserRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { invalidateSectorCache } from '../SectorQueryUtils';
import { uuidv7 } from 'ecoforms-core';
import * as bcrypt from 'bcryptjs';

interface UserRow {
    id: string;
    nome: string;
    nome_usuario: string;
    email: string | null;
    perfil: string;
    ativo: number;
    criado_em: string | null;
    atualizado_em: string | null;
}

interface SectorRow {
    setor_id: string;
}

const SELECT_COLS = 'id, nome, nome_usuario, email, perfil, ativo, criado_em, atualizado_em';

function rowToUser(row: UserRow, setores: string[]): User {
    return User.fromProps({
        id: row.id,
        nome: row.nome,
        username: row.nome_usuario,
        email: row.email ?? undefined,
        perfil: row.perfil,
        ativo: row.ativo === 1,
        setores,
        criadoEm: row.criado_em ?? undefined,
        atualizadoEm: row.atualizado_em ?? undefined,
    });
}

export class SqliteUserRepository implements UserRepository {
    constructor(
        private readonly db: SqlitePort,
        private readonly onUserChanged?: () => void,
    ) {}

    async findAll(): Promise<User[]> {
        const rows = await this.db.query<UserRow>(
            `SELECT ${SELECT_COLS} FROM usuarios ORDER BY nome`,
        );
        const result: User[] = [];
        for (const row of rows) {
            const setores = await this.fetchSetores(row.id);
            result.push(rowToUser(row, setores));
        }
        return result;
    }

    async findById(id: string): Promise<User | null> {
        const rows = await this.db.query<UserRow>(
            `SELECT ${SELECT_COLS} FROM usuarios WHERE id = ? LIMIT 1`,
            [id],
        );
        if (!rows[0]) return null;
        const setores = await this.fetchSetores(id);
        return rowToUser(rows[0], setores);
    }

    async save(user: User): Promise<void> {
        const p = user.toProps();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM usuarios WHERE id = ? LIMIT 1`,
            [p.id],
        );
        if (exists.length === 0) {
            const saltBytes = crypto.getRandomValues(new Uint8Array(32));
            const syncSalt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            await this.db.execute(
                `INSERT INTO usuarios (id, nome, nome_usuario, email, perfil, ativo, hash_senha, sal_sync, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [p.id, p.nome, p.username, p.email ?? null, p.perfil, p.ativo ? 1 : 0, p.passwordHash ?? null, syncSalt, p.criadoEm ?? null],
            );
        } else {
            await this.db.execute(
                `UPDATE usuarios SET
                    nome = ?, nome_usuario = ?, email = ?, perfil = ?, ativo = ?,
                    hash_senha = COALESCE(?, hash_senha), atualizado_em = datetime('now')
                 WHERE id = ?`,
                [p.nome, p.username, p.email ?? null, p.perfil, p.ativo ? 1 : 0, p.passwordHash ?? null, p.id],
            );
        }
        // ADR-047 Gap 11 — toggle de ativo/perfil pode afetar visibilidade por setor
        invalidateSectorCache(p.id);
        this.onUserChanged?.();
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`UPDATE usuarios SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?`, [id]);
        invalidateSectorCache(id);
        this.onUserChanged?.();
    }

    async assignSectors(userId: string, setores: string[]): Promise<void> {
        const statements = [
            { sql: 'DELETE FROM usuarios_setores WHERE usuario_id = ?', params: [userId] },
            ...setores.map((setorId) => ({
                sql: 'INSERT INTO usuarios_setores (usuario_id, setor_id) VALUES (?, ?)',
                params: [userId, setorId],
            })),
        ];

        if (this.db.transactionBatch) {
            await this.db.transactionBatch(statements);
        } else {
            await this.db.transaction(async (tx) => {
                for (const statement of statements) {
                    await tx.execute(statement.sql, statement.params);
                }
            });
        }
        invalidateSectorCache(userId);
        this.onUserChanged?.();
    }
    private async fetchSetores(userId: string): Promise<string[]> {
        const rows = await this.db.query<SectorRow>(
            `SELECT setor_id FROM usuarios_setores WHERE usuario_id = ?`,
            [userId],
        );
        return rows.map((r) => r.setor_id);
    }

    /**
     * Cria usuário a partir de seed (first-run setup).
     * Gera bcrypt hash da senha em claro + sal_sync aleatório.
     * Usado pelo FirstRunSetupModal quando seed JSON é encontrado.
     */
    async createUserFromSeed(seed: {
        id?: string;
        nome: string;
        username: string;
        password: string;
        perfil: string;
        setor?: string;
        ativo?: boolean;
    }): Promise<void> {
        const id = seed.id ?? uuidv7();

        const hashSenha = await bcrypt.hash(seed.password, 10);
        const saltBytes = crypto.getRandomValues(new Uint8Array(32));
        const syncSalt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        await this.db.execute(
            `INSERT INTO usuarios (id, nome, nome_usuario, email, perfil, ativo, hash_senha, sal_sync, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [id, seed.nome, seed.username, null, seed.perfil, seed.ativo !== false ? 1 : 0, hashSenha, syncSalt, new Date().toISOString()],
        );

        if (seed.setor) {
            await this.assignSectors(id, [seed.setor]);
        }

        invalidateSectorCache(id);
        this.onUserChanged?.();
    }
}
