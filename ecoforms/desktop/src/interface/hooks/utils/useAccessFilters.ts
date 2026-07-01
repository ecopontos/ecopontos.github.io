import {
    buildInboxAccessFilter,
    getAccessiblePerfis,
    isManagerOrAbove,
    type SqlFilter,
} from "@/src/interface/gateways/access-filters";
import { getEffectiveSectors } from "@/src/interface/gateways/access-filters";
import type { SqlitePort } from "@/src/application/ports/SqlitePort";

export type { SqlFilter };

export async function getInboxAccessFilter(userId: string, userPerfil: string, db: SqlitePort): Promise<SqlFilter> {
    const eff = await getEffectiveSectors(userId, db);
    return buildInboxAccessFilter(userId, userPerfil, eff.length > 0 ? eff : undefined);
}

export function buildFallbackInboxAccessFilter(userId: string, userPerfil: string): SqlFilter {
    return buildInboxAccessFilter(userId, userPerfil);
}

export function getAccessiblePerfisForPerfil(userPerfil: string): string[] {
    return getAccessiblePerfis(userPerfil);
}

export function canManageByRole(userPerfil: string): boolean {
    return isManagerOrAbove(userPerfil);
}
