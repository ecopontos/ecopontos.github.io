type DbLike = { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };

const _cache = new Map<string, { sectors: string[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Invalida o cache de setores para um usuário, ou todos se userId omitido. */
export function invalidateSectorCache(userId?: string): void {
    if (userId) _cache.delete(userId);
    else _cache.clear();
}

/**
 * Retorna todos os setor_id que um usuário pode acessar:
 * setores diretos (setor_principal_id + usuarios_setores) e seus descendentes
 * via pai_id (BFS). Resultado cacheado por 5 minutos.
 */
export async function getEffectiveSectors(userId: string, db: DbLike): Promise<string[]> {
    const cached = _cache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.sectors;

    const directRows = await db.query<{ setor_id: string }>(
        `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
         UNION
         SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
        [userId, userId],
    );
    const directIds = directRows.map(r => r.setor_id);

    if (directIds.length === 0) {
        _cache.set(userId, { sectors: [], ts: Date.now() });
        return [];
    }

    const allIds = new Set(directIds);
    let frontier = [...directIds];

    while (frontier.length > 0) {
        const children = await db.query<{ id: string }>(
            `SELECT id FROM setores WHERE pai_id IN (${frontier.map(() => '?').join(',')}) AND ativo = 1`,
            frontier,
        );
        frontier = children.map(r => r.id).filter(id => !allIds.has(id));
        frontier.forEach(id => allIds.add(id));
    }

    const sectors = [...allIds];
    _cache.set(userId, { sectors, ts: Date.now() });
    return sectors;
}
