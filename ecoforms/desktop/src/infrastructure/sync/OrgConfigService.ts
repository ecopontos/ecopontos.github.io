import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { SyncStoragePort } from './SyncStoragePort';
import type { LanFileStorage } from '../storage/LanFileStorage';

export interface OrgSetor {
    id: string;
    nome: string;
    ativo: boolean;
}

export interface OrgConfig {
    org_id: string;
    org_nome: string;
    setores: OrgSetor[];
    updated_at: string;
}

const ORG_CONFIG_PATH = 'shared/org_config.json';

export class OrgConfigService {
    constructor(
        private storage: SyncStoragePort,
        private sqlite: SqlitePort,
        private lan?: LanFileStorage,
    ) {}

    async loadFromStorage(): Promise<OrgConfig> {
        const blob = await this.storage.download(ORG_CONFIG_PATH);
        const text = await blob.text();
        const config = JSON.parse(text) as OrgConfig;
        await this.cacheToLocal(config);
        return config;
    }

    async loadFromCache(): Promise<OrgConfig | null> {
        const rows = await this.sqlite.all<{ conteudo: string }>(
            `SELECT conteudo FROM registro_dados
             WHERE tipo = 'org_config' AND chave = 'current' LIMIT 1`
        );
        return rows[0] ? JSON.parse(rows[0].conteudo) : null;
    }

    async load(): Promise<OrgConfig> {
        const fromLan = await this.lan?.readJson<OrgConfig>(ORG_CONFIG_PATH);
        if (fromLan) {
            await this.cacheToLocal(fromLan);
            return fromLan;
        }

        try {
            return await this.loadFromStorage();
        } catch {
            const cached = await this.loadFromCache();
            if (!cached) {
                throw new Error(
                    'org_config.json não encontrado no Storage nem em cache local. ' +
                    'Configure o arquivo no Supabase Storage antes do primeiro uso.'
                );
            }
            return cached;
        }
    }

    getActiveRoutingIds(config: OrgConfig): string[] {
        return config.setores.filter(s => s.ativo).map(s => s.id);
    }

    private async cacheToLocal(config: OrgConfig): Promise<void> {
        await this.sqlite.execute(
            `INSERT OR REPLACE INTO registro_dados (tipo, chave, conteudo, atualizado_em)
             VALUES ('org_config', 'current', ?, ?)`,
            [JSON.stringify(config), config.updated_at]
        );
    }
}
