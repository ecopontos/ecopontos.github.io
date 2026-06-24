/**
 * Access Control — camada de compatibilidade.
 * Regras puras migraram para `src/domain/access/AccessPolicy.ts` (Fase 2).
 * Helpers SQL continuam aqui por enquanto (infra-adjacentes); serão movidos
 * para repositórios específicos nas fases seguintes.
 */
import {
    getAccessiblePerfis as domainGetAccessiblePerfis,
    getSubordinatePerfis,
    canAccessUserData as domainCanAccessUserData,
    isAdmin as domainIsAdmin,
    isManagerOrAbove as domainIsManagerOrAbove,
    roleLevel,
} from '../../domain/access/AccessPolicy';

export interface SqlFilter {
    clause: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any[];
}

export const getAccessiblePerfis = domainGetAccessiblePerfis;
export const canAccessUserData = domainCanAccessUserData;
export const isAdmin = domainIsAdmin;
export const isManagerOrAbove = domainIsManagerOrAbove;

/**
 * Gera cláusula SQL que restringe resultados aos setores efetivos do usuário.
 *
 * @param effectiveSectors — resultado de getEffectiveSectors(userId)
 * @param directColumn — coluna setor_id na tabela (ex: 't.setor_id'); se omitido, usa EXISTS via ownerColumn
 * @param ownerColumn — para entidades sem setor_id direto: coluna usuario_id do dono (ex: 's.id_proprietario')
 */
export function buildSectorFilter(
    effectiveSectors: string[],
    directColumn?: string,
    ownerColumn?: string,
): [string, string[]] {
    if (effectiveSectors.length === 0) return ['1=0', []];

    const placeholders = effectiveSectors.map(() => '?').join(',');

    if (directColumn) {
        return [`${directColumn} IN (${placeholders})`, effectiveSectors];
    }

    return [
        `EXISTS (
            SELECT 1 FROM usuarios_setores us_owner
            WHERE us_owner.usuario_id = ${ownerColumn}
              AND us_owner.setor_id IN (${placeholders})
        )`,
        effectiveSectors,
    ];
}

/**
 * Filtro de acesso para tarefas.
 * Se effectiveSectors for fornecido, adiciona restrição horizontal de setor.
 */
export function buildTaskAccessFilter(
    userId: string,
    userPerfil: string,
    effectiveSectors?: string[],
): SqlFilter {
    if (userPerfil === 'admin') return { clause: '1=1', params: [] };

    const userLevel = roleLevel(userPerfil);
    const subordinatePerfis = getSubordinatePerfis(userPerfil);

    const verticalClause = subordinatePerfis.length > 0
        ? `(t.criado_por = ? OR t.atribuido_para = ? OR u_criador.perfil IN (${subordinatePerfis.map(() => '?').join(', ')}))`
        : `(t.criado_por = ? OR t.atribuido_para = ?)`;

    const verticalParams = userLevel !== undefined && subordinatePerfis.length > 0
        ? [userId, userId, ...subordinatePerfis]
        : [userId, userId];

    if (!effectiveSectors) {
        return { clause: verticalClause, params: verticalParams };
    }

    const [sectorClause, sectorParams] = buildSectorFilter(effectiveSectors, 't.setor_id');
    return {
        clause: `(${sectorClause}) AND ${verticalClause}`,
        params: [...sectorParams, ...verticalParams],
    };
}

/**
 * Filtro de acesso para pacotes/suites.
 * Se effectiveSectors for fornecido, adiciona restrição horizontal de setor via EXISTS.
 */
export function buildRecordAccessFilter(
    userId: string,
    userPerfil: string,
    effectiveSectors?: string[],
): SqlFilter {
    const accessiblePerfis = getAccessiblePerfis(userPerfil);
    const placeholders = accessiblePerfis.map(() => '?').join(', ');

    const verticalClause = `(s.id_proprietario = ? OR u.perfil IN (${placeholders}))`;
    const verticalParams = [userId, ...accessiblePerfis];

    if (!effectiveSectors) {
        return { clause: verticalClause, params: verticalParams };
    }

    const [sectorClause, sectorParams] = buildSectorFilter(effectiveSectors, undefined, 's.id_proprietario');
    return {
        clause: `(${sectorClause}) AND ${verticalClause}`,
        params: [...sectorParams, ...verticalParams],
    };
}

/**
 * Filtro de acesso para inbox.
 * Quando effectiveSectors for fornecido, substitui o EXISTS hardcoded por buildSectorFilter
 * e unifica todos os perfis (remove lógica específica de gerente).
 */
export function buildInboxAccessFilter(
    userId: string,
    userPerfil: string,
    effectiveSectors?: string[],
): SqlFilter {
    if (!userId || !userPerfil) return { clause: '1=0', params: [] };
    if (userPerfil === 'admin') return { clause: '1=1', params: [] };

    const taskClause = `EXISTS (
        SELECT 1 FROM tarefas t
        WHERE t.suite_id = v.id_pacote
          AND (
            t.atribuido_para = ?
            OR t.criado_por = ?
            OR EXISTS (
              SELECT 1 FROM tarefas_interessados ti
              WHERE ti.tarefa_id = t.id AND ti.usuario_id = ?
            )
          )
    )`;

    if (effectiveSectors) {
        const subordinatePerfis = getSubordinatePerfis(userPerfil);
        const subordinatePlaceholders = subordinatePerfis.map(() => '?').join(',');
        const [sectorClause, sectorParams] = buildSectorFilter(effectiveSectors, undefined, 'v.id_proprietario');

        return {
            clause: `(${sectorClause}) AND (
                v.id_proprietario = ?
                OR u.perfil IN (${subordinatePlaceholders})
            )`,
            params: [...sectorParams, userId, ...subordinatePerfis],
        };
    }

    // Backwards-compatible path (no effectiveSectors provided)
    if (userPerfil === 'gerente') {
        const deptClause = `EXISTS (
            SELECT 1 FROM usuarios_setores us_me
            JOIN usuarios_setores us_other ON us_me.setor_id = us_other.setor_id
            WHERE us_me.usuario_id = ?
              AND us_other.usuario_id = v.id_proprietario
        )`;

        return {
            clause: `(v.id_proprietario = ? OR ${deptClause} OR ${taskClause})`,
            params: [userId, userId, userId, userId, userId],
        };
    }

    return {
        clause: `(v.id_proprietario = ? OR ${taskClause})`,
        params: [userId, userId, userId, userId],
    };
}
