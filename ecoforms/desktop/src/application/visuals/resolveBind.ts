export interface ViewContext {
    userId: string;
    userProfile: string;
    userSector: string | null;
}

const bindMap: Record<string, (ctx: ViewContext) => string | number | null> = {
    '@user.id':       (c) => c.userId,
    '@user.perfil':   (c) => c.userProfile,
    '@user.setor':    (c) => c.userSector,
    '@today':         () => new Date().toISOString().slice(0, 10),
    '@now':           () => new Date().toISOString(),
    '@month.start':   () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    '@month.end':     () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    '@year.start':    () => `${new Date().getFullYear()}-01-01`,
    '@year.end':      () => `${new Date().getFullYear()}-12-31`,
};

export function resolveBind(value: string, ctx: ViewContext): string | number | null {
    if (!value.startsWith('@')) return value;

    const resolver = bindMap[value];
    if (!resolver) {
        console.warn(`[QueryEngine] Bind desconhecido: ${value}. Usando NULL.`);
        return null;
    }

    const resolved = resolver(ctx);
    if (resolved === null || resolved === undefined) {
        console.warn(`[QueryEngine] Bind ${value} resolvido para NULL (contexto incompleto)`);
        return null;
    }

    return resolved;
}
