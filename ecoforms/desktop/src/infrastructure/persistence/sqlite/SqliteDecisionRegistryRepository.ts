import { DecisionRegistry } from '../../../domain/decision/DecisionRegistry';
import type { DecisionRegistryRepository } from '../../../domain/decision/DecisionRegistryRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface DecisionRow {
    id: string;
    target_type: string;
    action: string;
    perfis: string;
    enabled_when: string;
    steps: string;
    params: string;
    consequence_type: string;
    consequence_pattern: string | null;
    consequence_config: string;
    ativo: number;
    criado_em: string | null;
    atualizado_em: string | null;
}

function rowToDecision(row: DecisionRow): DecisionRegistry {
    return DecisionRegistry.fromRow({
        id: row.id,
        target_type: row.target_type,
        action: row.action,
        perfis: row.perfis,
        enabled_when: row.enabled_when,
        steps: row.steps,
        params: row.params,
        consequence_type: row.consequence_type,
        consequence_pattern: row.consequence_pattern,
        consequence_config: row.consequence_config,
        ativo: row.ativo,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
    });
}

export class SqliteDecisionRegistryRepository implements DecisionRegistryRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<DecisionRegistry | null> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes WHERE id = ? AND ativo = 1 LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToDecision(rows[0]) : null;
    }

    async findByTargetType(targetType: string): Promise<DecisionRegistry[]> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes WHERE tipo_alvo = ? AND ativo = 1 ORDER BY acao`,
            [targetType],
        );
        return rows.map(rowToDecision);
    }

    async findByAction(action: string): Promise<DecisionRegistry[]> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes WHERE acao = ? AND ativo = 1 ORDER BY tipo_alvo`,
            [action],
        );
        return rows.map(rowToDecision);
    }

    async findByPerfilAndTargetType(perfil: string, targetType: string): Promise<DecisionRegistry[]> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes WHERE tipo_alvo = ? AND perfis LIKE ? AND ativo = 1 ORDER BY acao`,
            [targetType, `%"${perfil}"%`],
        );
        return rows.filter((row) => {
            try {
                const perfis: string[] = JSON.parse(row.perfis);
                return perfis.includes(perfil);
            } catch {
                return false;
            }
        }).map(rowToDecision);
    }

    async findActive(): Promise<DecisionRegistry[]> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes WHERE ativo = 1 ORDER BY tipo_alvo, acao`,
        );
        return rows.map(rowToDecision);
    }

    async findAll(): Promise<DecisionRegistry[]> {
        const rows = await this.db.query<DecisionRow>(
            `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                    passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                    padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                    ativo, criado_em, atualizado_em
             FROM registro_decisoes ORDER BY tipo_alvo, acao`,
        );
        return rows.map(rowToDecision);
    }

    async save(decision: DecisionRegistry): Promise<void> {
        const row = decision.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM registro_decisoes WHERE id = ? LIMIT 1`,
            [row.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO registro_decisoes (id, tipo_alvo, acao, perfis, ativado_quando, passos, parametros,
                  tipo_consequencia, padrao_consequencia, config_consequencia, ativo, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [row.id, row.target_type, row.action, row.perfis, row.enabled_when, row.steps, row.params,
                 row.consequence_type, row.consequence_pattern, row.consequence_config, row.ativo, row.criado_em],
            );
        } else {
            await this.db.execute(
                `UPDATE registro_decisoes SET tipo_alvo = ?, acao = ?, perfis = ?, ativado_quando = ?, passos = ?,
                 parametros = ?, tipo_consequencia = ?, padrao_consequencia = ?, config_consequencia = ?, ativo = ?,
                 atualizado_em = datetime('now') WHERE id = ?`,
                [row.target_type, row.action, row.perfis, row.enabled_when, row.steps, row.params,
                 row.consequence_type, row.consequence_pattern, row.consequence_config, row.ativo, row.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM registro_decisoes WHERE id = ?`, [id]);
    }
}