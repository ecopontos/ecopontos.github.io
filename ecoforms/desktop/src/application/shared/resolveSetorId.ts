import { ForbiddenError } from '../../domain/shared/errors';

type DbLike = { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };

/**
 * Determina o setor_id a persistir em uma nova entidade.
 *
 * Precedência:
 * 1. input.setorId explícito (validado contra effectiveSectors do ator)
 * 2. setor_principal_id do ator
 * 3. null — nenhum setor configurado
 *
 * Se getEffectiveSectors não for fornecido, a validação de escopo é pulada
 * (comportamento permissivo para contextos sem banco disponível).
 */
export async function resolveSetorId(
    input: { setorId?: string | null },
    actorId: string,
    db: DbLike,
    getEffectiveSectors?: (userId: string, db: DbLike) => Promise<string[]>,
): Promise<string | null> {
    if (input.setorId) {
        if (getEffectiveSectors) {
            const effective = await getEffectiveSectors(actorId, db);
            if (effective.length > 0 && !effective.includes(input.setorId)) {
                throw new ForbiddenError(`Setor '${input.setorId}' fora do escopo do usuário`);
            }
        }
        return input.setorId;
    }

    const rows = await db.query<{ setor_principal_id: string | null }>(
        `SELECT setor_principal_id FROM usuarios WHERE id = ?`,
        [actorId],
    );
    return rows[0]?.setor_principal_id ?? null;
}
