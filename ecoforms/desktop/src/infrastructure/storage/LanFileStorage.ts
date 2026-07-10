import type { SqlitePort } from '../../application/ports/SqlitePort';
import { validateExpectedUsersSeed, validateLanIndex, validateUserSummary } from './LanJsonCodecs';

export interface LanIndexEntry {
    v: number;
    hash: string;
    last_event_id: string;
}

export interface LanIndex {
    last_entity_uuid: string;
    entities: Record<string, LanIndexEntry>;
}

export interface SeedUser {
    id?: string;
    nome: string;
    username: string;
    password: string;
    perfil: string;
    setor?: string;
    ativo?: boolean;
}

export interface ExpectedUsersSeed {
    version: number;
    created_at: string;
    users: SeedUser[];
}

export interface UserSummary {
    id: string;
    nome: string;
    username: string;
    perfil: string;
    setor?: string;
}

/**
 * Acesso ao sistema de arquivos local via Tauri (pasta LAN / rede compartilhada).
 * Graceful degradation: se `lan_sync_path` estiver vazio, todas as operações são no-op.
 */
export class LanFileStorage {
    constructor(private readonly sqlite: SqlitePort) {}

    /** Lê o caminho raiz da LAN do banco de dados (sem cache). */
    async getLanPath(): Promise<string> {
        try {
            const rows = await this.sqlite.query<{ valor: string }>(
                `SELECT valor FROM configuracoes_sistema WHERE chave = 'lan_sync_path'`,
                [],
            );
            return rows[0]?.valor?.trim() ?? '';
        } catch {
            return '';
        }
    }

    /** Lê um arquivo. Retorna null se LAN não configurada ou arquivo não encontrado. */
    async readFile(relPath: string): Promise<Uint8Array | null> {
        const root = await this.getLanPath();
        if (!root) return null;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const b64 = await invoke<string>('lan_read_file', { path: relPath });
            return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        } catch {
            return null;
        }
    }

    /** Escreve um arquivo. No-op se LAN não configurada. Re-lança erro de I/O para o caller. */
    async writeFile(relPath: string, data: Uint8Array): Promise<void> {
        const root = await this.getLanPath();
        if (!root) return;
        const b64 = btoa(String.fromCharCode(...data));
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('lan_write_file', { path: relPath, content: b64 });
        } catch (e) {
            console.warn('[LanFileStorage] write failed', relPath, e);
            throw e;
        }
    }

    /** Lista arquivos em um diretório relativo. Retorna [] se LAN não configurada. */
    async listDir(relPath: string): Promise<string[]> {
        const root = await this.getLanPath();
        if (!root) return [];
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke<string[]>('lan_list_dir', { path: relPath });
        } catch {
            return [];
        }
    }

    /** Lê e desserializa um arquivo JSON. Retorna null se não encontrado ou inválido. */
    async readJson<T>(relPath: string): Promise<T | null> {
        const bytes = await this.readFile(relPath);
        if (!bytes) return null;
        try {
            return JSON.parse(new TextDecoder().decode(bytes)) as T;
        } catch {
            return null;
        }
    }

    /** Serializa e escreve um arquivo JSON. No-op se LAN não configurada. */
    async writeJson(relPath: string, data: unknown): Promise<void> {
        const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
        await this.writeFile(relPath, bytes);
    }

    /** Lê o index.json de um domínio. Retorna null se LAN não configurada ou ausente. */
    async readIndex(domain: string): Promise<LanIndex | null> {
        const index = await this.readJson<unknown>(`${domain}/index.json`);
        return validateLanIndex(index) ? index : null;
    }

    /**
     * Atualiza atomicamente a entrada de uma entidade no index.json do domínio.
     * LWW: ignora se `lastEventId` não for maior que o registrado.
     */
    async updateIndex(
        domain: string,
        entityId: string,
        v: number,
        hash: string,
        lastEventId: string,
    ): Promise<void> {
        const root = await this.getLanPath();
        if (!root) return;

        const current: LanIndex = (await this.readIndex(domain))
            ?? { last_entity_uuid: '', entities: {} };

        const existing = current.entities[entityId];
        if (existing && existing.last_event_id >= lastEventId) return;

        current.entities[entityId] = { v, hash, last_event_id: lastEventId };
        if (entityId > current.last_entity_uuid) {
            current.last_entity_uuid = entityId;
        }

        await this.writeJson(`${domain}/index.json`, current);
    }

    /** Verifica se a pasta LAN está acessível. */
    async testConnection(): Promise<{ ok: boolean; message: string }> {
        const root = await this.getLanPath();
        if (!root) return { ok: false, message: 'Caminho LAN não configurado.' };
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke<string[]>('lan_list_dir', { path: '' });
            return { ok: true, message: `Pasta acessível: ${root}` };
        } catch (e) {
            return { ok: false, message: `Erro ao acessar pasta: ${String(e)}` };
        }
    }

    /**
     * Lê o seed de usuários esperados: shared/expected_users.json
     * Retorna null se não existe ou inválido.
     */
    async readExpectedUsersSeed(): Promise<ExpectedUsersSeed | null> {
        const seed = await this.readJson<unknown>('shared/expected_users.json');
        return validateExpectedUsersSeed(seed) ? seed : null;
    }

    /**
     * Lista usuários do LAN via pull normal (index.json + {id}.json).
     * Usado quando não há seed ou seed foi consumido.
     */
    async listUsersFromLan(): Promise<UserSummary[]> {
        const index = await this.readIndex('usuarios');
        if (!index) return [];

        const users: UserSummary[] = [];
        for (const entityId of Object.keys(index.entities)) {
            const user = await this.readJson<unknown>(`usuarios/${entityId}.json`);
            if (validateUserSummary(user)) {
                users.push({
                    id: entityId,
                    nome: user.nome ?? '',
                    username: user.username ?? '',
                    perfil: user.perfil ?? 'operador',
                    setor: user.setor,
                });
            }
        }
        return users;
    }
}
