type RouteFallback = {
    pattern: RegExp;
    targetPath: string;
    targetParam: string;
};

const ROUTE_FALLBACKS: RouteFallback[] = [
    { pattern: /^\/admin\/agendamentos\/slots\/([^/]+)\/editar\/?$/, targetPath: "/admin/agendamentos/slots/editar", targetParam: "id" },
    { pattern: /^\/admin\/agendamentos\/slots\/([^/]+)\/?$/, targetPath: "/admin/agendamentos/slots/detalhe", targetParam: "id" },
    { pattern: /^\/admin\/users\/([^/]+)\/exportar\/?$/, targetPath: "/admin/users/exportar", targetParam: "id" },
    { pattern: /^\/admin\/users\/([^/]+)\/eliminar\/?$/, targetPath: "/admin/users/eliminar", targetParam: "id" },
    { pattern: /^\/admin\/modules\/([^/]+)\/edit\/?$/, targetPath: "/admin/modules/edit", targetParam: "id" },
    { pattern: /^\/admin\/service-types\/([^/]+)\/?$/, targetPath: "/admin/service-types/detalhe", targetParam: "id" },
    { pattern: /^\/logistica\/roteiros\/([^/]+)\/?$/, targetPath: "/logistica/roteiros/detalhe", targetParam: "id" },
    { pattern: /^\/tarefas\/([^/]+)\/?$/, targetPath: "/tasks/detalhe", targetParam: "id" },
    { pattern: /^\/tasks\/([^/]+)\/?$/, targetPath: "/tasks/detalhe", targetParam: "id" },
    { pattern: /^\/modulo\/([^/]+)\/?$/, targetPath: "/modulo", targetParam: "slug" },
    { pattern: /^\/view\/([^/]+)\/?$/, targetPath: "/view", targetParam: "id" },
    { pattern: /^\/clientes\/([^/]+)\/?$/, targetPath: "/clientes/detalhe", targetParam: "id" },
    { pattern: /^\/demandas\/([^/]+)\/?$/, targetPath: "/demandas/detalhe", targetParam: "id" },
    { pattern: /^\/manifestacoes\/([^/]+)\/?$/, targetPath: "/manifestacoes/detalhe", targetParam: "id" },
    { pattern: /^\/projects\/([^/]+)\/?$/, targetPath: "/projects/detalhe", targetParam: "id" },
    { pattern: /^\/ecopontos\/([^/]+)\/?$/, targetPath: "/ecopontos/detalhe", targetParam: "id" },
];

export function resolveStaticRouteFallback(pathname: string, search = ""): string | null {
    for (const route of ROUTE_FALLBACKS) {
        const match = pathname.match(route.pattern);
        if (!match) continue;

        const value = match[1];
        const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        params.set(route.targetParam, value);
        const query = params.toString();
        return query ? `${route.targetPath}?${query}` : route.targetPath;
    }

    return null;
}
