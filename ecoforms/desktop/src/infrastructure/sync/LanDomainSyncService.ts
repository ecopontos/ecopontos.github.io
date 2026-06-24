import { uuidv7 } from 'ecoforms-core';
import type { LanFileStorage, LanIndex, UserSummary } from '../storage/LanFileStorage';

/**
 * ADR-020: Serviço de sync granular por domínio via pasta LAN.
 *
 * Mantém a estrutura:
 *   {lan_path}/{domain}/index.json         ← { last_entity_uuid, entities: { uuid: { v, hash, last_event_id } } }
 *   {lan_path}/{domain}/{entityId}.json    ← snapshot da entidade
 *
 * Graceful degradation: se LAN não configurada, todas as operações são no-op.
 */
export class LanDomainSyncService {
    constructor(private readonly lan: LanFileStorage) {}

    /**
     * Sincroniza uma entidade para a LAN.
     * Idempotente: skip se o hash do conteúdo não mudou.
     */
    async syncEntity(domain: string, entityId: string, data: unknown): Promise<void> {
        const root = await this.lan.getLanPath();
        if (!root) return;

        const hash = await this.hashJson(data);

        const currentIndex = await this.lan.readIndex(domain);
        const existing = currentIndex?.entities[entityId];
        if (existing?.hash === hash) return;

        const v = (existing?.v ?? 0) + 1;
        const lastEventId = uuidv7();

        await this.lan.writeJson(`${domain}/${entityId}.json`, data);
        await this.lan.updateIndex(domain, entityId, v, hash, lastEventId);
    }

    /**
     * Lê o index.json de um domínio — usado pelo pull para detectar entidades novas/alteradas.
     * Retorna null se LAN não configurada ou domínio ausente.
     */
    async pullIndex(domain: string): Promise<LanIndex | null> {
        return this.lan.readIndex(domain);
    }

    /**
     * Lê o snapshot de uma entidade específica.
     * Retorna null se não encontrada.
     */
    async fetchEntity<T>(domain: string, entityId: string): Promise<T | null> {
        return this.lan.readJson<T>(`${domain}/${entityId}.json`);
    }

    private async hashJson(data: unknown): Promise<string> {
        const json = JSON.stringify(data);
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Pull completo de todos os usuários do LAN.
     * Usa listUsersFromLan (index + entities) para obter lista resumida,
     * depois fetchEntity para cada usuário completo.
     * Retorna array vazio se LAN não configurada ou domínio ausente.
     */
    async pullAllUsers(): Promise<UserSummary[]> {
        return this.lan.listUsersFromLan();
    }
}
