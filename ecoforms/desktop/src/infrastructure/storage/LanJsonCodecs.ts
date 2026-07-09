import type { ExpectedUsersSeed, LanIndex, UserSummary } from './LanFileStorage';
import type { OrgConfig } from '../sync/OrgConfigService';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

function isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === 'string';
}

export function validateLanIndex(value: unknown): value is LanIndex {
    if (!isRecord(value) || typeof value.last_entity_uuid !== 'string' || !isRecord(value.entities)) {
        return false;
    }

    return Object.entries(value.entities).every(([entityId, entry]) => {
        if (!isNonEmptyString(entityId) || !isRecord(entry)) return false;
        return Number.isInteger(entry.v)
            && (entry.v as number) >= 0
            && isNonEmptyString(entry.hash)
            && isNonEmptyString(entry.last_event_id);
    });
}

export function validateExpectedUsersSeed(value: unknown): value is ExpectedUsersSeed {
    if (!isRecord(value) || !Number.isInteger(value.version) || !isNonEmptyString(value.created_at)) {
        return false;
    }
    if (!Array.isArray(value.users)) return false;

    return value.users.every((user) => {
        if (!isRecord(user)) return false;
        return isOptionalString(user.id)
            && isNonEmptyString(user.nome)
            && isNonEmptyString(user.username)
            && isNonEmptyString(user.password)
            && isNonEmptyString(user.perfil)
            && isOptionalString(user.setor)
            && (user.ativo === undefined || isBoolean(user.ativo));
    });
}

export function validateUserSummary(value: unknown): value is UserSummary {
    return isRecord(value)
        && isNonEmptyString(value.nome)
        && isNonEmptyString(value.username)
        && isNonEmptyString(value.perfil)
        && isOptionalString(value.setor);
}

export function validateOrgConfig(value: unknown): value is OrgConfig {
    if (!isRecord(value)) return false;
    if (!isNonEmptyString(value.org_id) || !isNonEmptyString(value.org_nome) || !isNonEmptyString(value.updated_at)) {
        return false;
    }
    if (!Array.isArray(value.setores)) return false;

    return value.setores.every((setor) => (
        isRecord(setor)
        && isNonEmptyString(setor.id)
        && isNonEmptyString(setor.nome)
        && isBoolean(setor.ativo)
    ));
}

export function parseJsonWithValidator<T>(
    text: string,
    validator: (value: unknown) => value is T,
): T | null {
    try {
        const parsed = JSON.parse(text);
        return validator(parsed) ? parsed : null;
    } catch {
        return null;
    }
}
