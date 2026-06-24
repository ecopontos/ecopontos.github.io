import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { LanFileStorage } from '../storage/LanFileStorage';

interface DataSourceRow {
    id: string | number;
    nome: string;
    nome_galpao?: string;
    documento?: string;
    setor_id?: string | null;
}

type DataSourceResolver = () => Promise<DataSourceRow[]>;

const resolvers = new Map<string, DataSourceResolver>();
let sqlitePort: SqlitePort | undefined;

async function tableExists(tableName: string): Promise<boolean> {
    if (!sqlitePort) return false;
    try {
        const result = await sqlitePort.query<{ name: string }>(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [tableName]
        );
        return result.length > 0;
    } catch {
        return false;
    }
}

function lanAwareResolver(
    sourceName: string,
    lan: LanFileStorage | undefined,
    sqliteResolver: () => Promise<DataSourceRow[]>,
): DataSourceResolver {
    return async () => {
        if (lan) {
            const fromLan = await lan.readJson<DataSourceRow[]>(`crm/${sourceName}.json`);
            if (fromLan?.length) return fromLan;
        }
        return sqliteResolver();
    };
}

export function registerCrmDataSources(sqlite: SqlitePort, lan?: LanFileStorage): void {
    sqlitePort = sqlite;

    resolvers.set('catadores_crm', lanAwareResolver('catadores_crm', lan, async () => {
        if (!await tableExists('pfisicas') || !await tableExists('contatos') || !await tableExists('pjuridicas')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT cast(pf.idPF AS TEXT) AS id, pf.Nome AS nome, pj.Cliente AS nome_galpao
             FROM pfisicas pf
             JOIN contatos c ON c.idPF = pf.idPF
             JOIN pjuridicas pj ON pj.idPJ = c.idPJ
             WHERE c.TipoContato = 'cooperado'`
        );
    }));

    resolvers.set('galpoes_crm', lanAwareResolver('galpoes_crm', lan, async () => {
        if (!await tableExists('pjuridicas') || !await tableExists('pjtipo')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT cast(pj.idPJ AS TEXT) AS id, pj.Cliente AS nome FROM pjuridicas pj
             JOIN pjtipo t ON t.idPJtipo = pj.idPJtipo
             WHERE t.[Tipo de PJ] = 'galpao_triagem' AND pj.ativo = 1`
        );
    }));

    resolvers.set('pessoas_fisicas_crm', lanAwareResolver('pessoas_fisicas_crm', lan, async () => {
        if (!await tableExists('pfisicas')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT cast(idPF AS TEXT) AS id, Nome AS nome, CPF AS documento FROM pfisicas WHERE ativo = 1`
        );
    }));

    resolvers.set('clientes_crm', lanAwareResolver('clientes_crm', lan, async () => {
        if (!await tableExists('pjuridicas')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT cast(idPJ AS TEXT) AS id, Cliente AS nome FROM pjuridicas WHERE ativo = 1`
        );
    }));

    resolvers.set('cooperativas_crm', lanAwareResolver('cooperativas_crm', lan, async () => {
        if (!await tableExists('pjuridicas') || !await tableExists('pjtipo')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT cast(pj.idPJ AS TEXT) AS id, pj.Cliente AS nome FROM pjuridicas pj
             JOIN pjtipo t ON t.idPJtipo = pj.idPJtipo
             WHERE t.[Tipo de PJ] = 'cooperativa' AND pj.ativo = 1`
        );
    }));

    resolvers.set('ecopontos_crm', lanAwareResolver('ecopontos_crm', lan, async () => {
        if (!await tableExists('ecopontos')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT id AS id, nome AS nome, endereco AS documento FROM ecopontos WHERE ativo = 1`
        );
    }));

    resolvers.set('setores_ativos', lanAwareResolver('setores_ativos', lan, async () => {
        if (!await tableExists('setores')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT id, nome FROM setores WHERE ativo = 1`
        );
    }));

    resolvers.set('usuarios', lanAwareResolver('usuarios', lan, async () => {
        if (!await tableExists('usuarios')) return [];
        return sqlite.query<DataSourceRow>(
            `SELECT u.id, u.nome, COALESCE(us.setor_id, u.setor) AS setor_id
             FROM usuarios u
             LEFT JOIN usuarios_setores us ON us.usuario_id = u.id
             WHERE u.ativo = 1
             ORDER BY u.nome`
        );
    }));
}

export async function loadCrmDataSource(sourceName: string): Promise<DataSourceRow[]> {
    const resolver = resolvers.get(sourceName);
    if (!resolver) return [];
    try {
        return await resolver();
    } catch {
        return [];
    }
}

export function getCrmDataSourceNames(): string[] {
    return Array.from(resolvers.keys());
}
