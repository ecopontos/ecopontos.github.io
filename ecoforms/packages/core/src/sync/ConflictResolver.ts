import { stableStringify } from '../utils/stableStringify.js';

export const ConflictProfile = {
    A: 'profile_a' as const,
    B: 'profile_b' as const,
    C: 'profile_c' as const,
} as const;

export type ConflictProfileType = typeof ConflictProfile[keyof typeof ConflictProfile];

export interface ConflictResult {
    hasConflict: boolean;
    winner?: 'local' | 'remote';
    strategy?: string;
    details?: string;
    resolved?: Record<string, unknown>;
    serverWins?: string[];
    localWins?: string[];
}

const TIME_TOLERANCE_MS = 5000;

function quickHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
}

function toMillis(timestamp: unknown): number | null {
    if (!timestamp) return null;
    const t = new Date(timestamp as string).getTime();
    return Number.isNaN(t) ? null : t;
}

function resolveProfileA(localRecord: Record<string, unknown>, remoteRecord: Record<string, unknown> | null): ConflictResult {
    if (!remoteRecord) {
        return { hasConflict: false, winner: 'local', strategy: 'no_remote' };
    }

    const localTime = toMillis(
        localRecord.updated_at || localRecord.created_at || localRecord.updatedAt || localRecord.createdAt
    );
    const remoteTime = toMillis(
        remoteRecord.updated_at || remoteRecord.created_at || remoteRecord.updatedAt || remoteRecord.createdAt
    );

    if (localTime === null && remoteTime === null) {
        return { hasConflict: true, winner: 'local', strategy: 'no_timestamps_fallback_local' };
    }

    const timeDiff = Math.abs((localTime || 0) - (remoteTime || 0));

    if (timeDiff > TIME_TOLERANCE_MS) {
        const winner = (localTime || 0) > (remoteTime || 0) ? 'local' : 'remote';
        return { hasConflict: true, winner: winner as 'local' | 'remote', strategy: 'last_write_wins', details: `${winner} wins by ${timeDiff}ms` };
    }

    try {
        const localStr = stableStringify(localRecord.dados || localRecord.data || localRecord);
        const remoteStr = stableStringify(remoteRecord.dados || remoteRecord.data || remoteRecord);
        const localHash = quickHash(localStr);
        const remoteHash = quickHash(remoteStr);

        if (localHash === remoteHash) {
            return { hasConflict: false, winner: 'local', strategy: 'identical_content' };
        }

        return { hasConflict: true, winner: 'local', strategy: 'content_hash_tiebreak', details: `Local hash ${localHash} vs Remote ${remoteHash}` };
    } catch {
        return { hasConflict: true, winner: 'local', strategy: 'fallback_local', details: 'Hash comparison failed' };
    }
}

function resolveProfileB(localData: Record<string, unknown> | null, remoteData: Record<string, unknown> | null): ConflictResult {
    const result: ConflictResult = {
        hasConflict: false,
        resolved: {},
        serverWins: [],
        localWins: [],
        details: '',
    };

    const allKeys = new Set([
        ...Object.keys(remoteData || {}),
        ...Object.keys(localData || {}),
    ]);

    allKeys.forEach(key => {
        const localVal = localData && localData[key] !== undefined ? localData[key] : null;
        const remoteVal = remoteData && remoteData[key] !== undefined ? remoteData[key] : null;

        if (localVal === remoteVal) {
            (result.resolved as Record<string, unknown>)[key] = localVal;
            return;
        }

        result.hasConflict = true;

        if (remoteVal !== null) {
            (result.resolved as Record<string, unknown>)[key] = remoteVal;
            result.serverWins!.push(key);
        } else {
            (result.resolved as Record<string, unknown>)[key] = localVal;
            result.localWins!.push(key);
        }
    });

    return result;
}

function resolveProfileC(localRecord: Record<string, unknown>, remoteRecord: Record<string, unknown> | null): ConflictResult {
    if (!remoteRecord) {
        return { hasConflict: false, winner: 'local', strategy: 'no_remote' };
    }
    return { hasConflict: true, winner: 'remote', strategy: 'server_wins', details: 'Config/data sempre prevalece do servidor' };
}

export function resolveConflict(
    profile: ConflictProfileType,
    localRecord: Record<string, unknown>,
    remoteRecord: Record<string, unknown> | null
): ConflictResult {
    switch (profile) {
        case ConflictProfile.A:
            return resolveProfileA(localRecord, remoteRecord);
        case ConflictProfile.B:
            return resolveProfileB(localRecord, remoteRecord);
        case ConflictProfile.C:
            return resolveProfileC(localRecord, remoteRecord);
        default:
            console.warn(`[ConflictResolver] Perfil desconhecido "${profile}", usando Profile A como fallback`);
            return resolveProfileA(localRecord, remoteRecord);
    }
}

export function profileForEventType(eventType: string): ConflictProfileType {
    if (!eventType) return ConflictProfile.A;

    if (eventType.startsWith('suite.') || eventType.startsWith('task.') || eventType.startsWith('demanda.')) {
        return ConflictProfile.A;
    }
    if (eventType.startsWith('ecoponto.') || eventType.startsWith('caixas.')) {
        return ConflictProfile.B;
    }
    if (eventType.startsWith('data-registry.') || eventType.startsWith('user.') || eventType.startsWith('form.')) {
        return ConflictProfile.C;
    }

    return ConflictProfile.A;
}
