/**
 * Regras puras de controle de acesso (hierarquia de perfis).
 * Tradução para SQL/filtros fica nos repositórios de infraestrutura.
 */

export type Perfil = 'admin' | 'gerente' | 'coordenador' | 'encarregado' | 'operador' | 'campo';

const ROLE_HIERARCHY: Record<Perfil, number> = {
    admin: 0,
    gerente: 1,
    coordenador: 2,
    encarregado: 3,
    operador: 4,
    campo: 4,
};

export function isKnownPerfil(perfil: string): perfil is Perfil {
    return perfil in ROLE_HIERARCHY;
}

export function roleLevel(perfil: string): number | undefined {
    return isKnownPerfil(perfil) ? ROLE_HIERARCHY[perfil] : undefined;
}

export function isAdmin(perfil: string): boolean {
    return perfil === 'admin';
}

export function isManagerOrAbove(perfil: string): boolean {
    const level = roleLevel(perfil);
    return level !== undefined && level <= ROLE_HIERARCHY.gerente;
}

/**
 * Perfis acessíveis para um usuário de dado perfil (ele mesmo + subordinados).
 */
export function getAccessiblePerfis(userPerfil: string): string[] {
    const userLevel = roleLevel(userPerfil);
    if (userLevel === undefined) return [userPerfil];
    return (Object.entries(ROLE_HIERARCHY) as [Perfil, number][])
        .filter(([, level]) => level >= userLevel)
        .map(([perfil]) => perfil);
}

export function getSubordinatePerfis(userPerfil: string): string[] {
    const userLevel = roleLevel(userPerfil);
    if (userLevel === undefined) return [];
    return (Object.entries(ROLE_HIERARCHY) as [Perfil, number][])
        .filter(([, level]) => level > userLevel)
        .map(([perfil]) => perfil);
}

export function canAccessUserData(currentPerfil: string, targetPerfil: string): boolean {
    const currentLevel = roleLevel(currentPerfil);
    const targetLevel = roleLevel(targetPerfil);
    if (currentLevel === undefined || targetLevel === undefined) return false;
    return targetLevel >= currentLevel;
}

export function canAssignProfile(actorPerfil: string, targetPerfil: string): boolean {
    const actorLevel = roleLevel(actorPerfil);
    const targetLevel = roleLevel(targetPerfil);
    if (actorLevel === undefined || targetLevel === undefined) return false;
    if (actorLevel === 0) return true;
    return targetLevel > actorLevel;
}
