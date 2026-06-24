import { buildInboxAccessFilter, isManagerOrAbove, type SqlFilter } from '@/src/infrastructure/persistence/AccessFilterBuilder';
import { getEffectiveSectors } from '@/src/infrastructure/persistence/SectorQueryUtils';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

export async function getInboxAccessFilter(userId: string, userPerfil: string, db: SqlitePort): Promise<SqlFilter> {
    const eff = await getEffectiveSectors(userId, db);
    return buildInboxAccessFilter(userId, userPerfil, eff.length > 0 ? eff : undefined);
}

export function canManageByRole(userPerfil: string): boolean {
    return isManagerOrAbove(userPerfil);
}