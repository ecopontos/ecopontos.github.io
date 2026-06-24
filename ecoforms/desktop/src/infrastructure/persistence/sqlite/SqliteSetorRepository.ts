import type { SetorRepository } from '../../../domain/setor/SetorRepository';
import type { Setor } from '../../../domain/setor/Setor';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { invalidateSectorCache } from '../SectorQueryUtils';

export class SqliteSetorRepository implements SetorRepository {
  constructor(private readonly sqlite: SqlitePort) {}

  async findAll(): Promise<Setor[]> {
    return this.sqlite.query<Setor>(
      `SELECT id, nome, descricao, criado_em, atualizado_em FROM setores ORDER BY nome`,
      []
    );
  }

  async findAtivos(): Promise<Setor[]> {
    return this.sqlite.query<Setor>(
      `SELECT id, nome, descricao, criado_em, atualizado_em FROM setores ORDER BY nome`,
      []
    );
  }

  async findById(id: string): Promise<Setor | null> {
    const rows = await this.sqlite.query<Setor>(
      `SELECT id, nome, descricao, criado_em, atualizado_em FROM setores WHERE id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  async create(id: string, nome: string, descricao?: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.sqlite.execute(
      `INSERT INTO setores (id, nome, descricao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)`,
      [id, nome, descricao ?? null, now, now]
    );
    // ADR-047 Gap 11 — mudança em setores afeta os setores efetivos de todos os usuários
    invalidateSectorCache();
  }

  async update(id: string, nome: string, descricao?: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.sqlite.execute(
      `UPDATE setores SET nome = ?, descricao = ?, atualizado_em = ? WHERE id = ?`,
      [nome, descricao ?? null, now, id]
    );
    invalidateSectorCache();
  }

  async remove(id: string): Promise<void> {
    await this.sqlite.execute(`DELETE FROM setores WHERE id = ?`, [id]);
    invalidateSectorCache();
  }
}
