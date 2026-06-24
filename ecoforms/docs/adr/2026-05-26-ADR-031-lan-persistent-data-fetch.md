# ADR-031: Fetch de Dados Persistentes via LAN

**Data:** 2026-05-26  
**Status:**Implementado**
**Autores:** Equipe EcoForms

---

## Contexto

O desktop app atualmente obtém dados persistentes (não-eventos) de duas fontes:

- **SQLite local** — datasources CRM (`pfisicas`, `pjuridicas`, `ecopontos`, `setores`, `usuarios`)
- **Supabase Storage** — `shared/org_config.json` e `shared/users.json`

Isso cria três problemas:

1. **Instâncias secundárias** (outros PCs na rede sem DB local completo) não conseguem carregar datasources CRM — `loadCrmDataSource` retorna `[]`.
2. **Operação offline** (sem internet) falha no boot quando `OrgConfigService.load()` tenta Supabase e não há cache local válido.
3. **A infraestrutura LAN já existe** (`LanFileStorage`, `LanDomainSyncService`) mas é usada apenas para escrita de eventos — nenhum dado persistente é lido de lá.

O app mobile (ecopontos) é deliberadamente excluído deste escopo: continua usando Supabase como fonte de `users.json` (ADR-030).

---

## Decisão

**A LAN passa a ser fonte primária para dados persistentes no desktop.** A prioridade de leitura será:

```
LAN (filesystem compartilhado) → Supabase Storage → SQLite cache / []
```

Isso se aplica a três categorias de dados:

| Categoria | Path LAN | Publicado por |
|-----------|----------|---------------|
| Config da organização | `shared/org_config.json` | `StorageBootstrapService` + `OrgConfigService` |
| Snapshot de usuários | `shared/users.json` | `UserSnapshotService` |
| Datasources CRM | `crm/{sourceName}.json` | `CrmSnapshotPublisher` (novo) |

---

## Consequências

### Positivas

- Desktop funciona 100% offline via pasta compartilhada, sem depender de Supabase
- Instâncias secundárias na LAN carregam datasources CRM sem precisar de réplica do DB local
- `LanFileStorage` passa de write-only para read-write real, aproveitando infraestrutura existente

### Negativas / Riscos

- **Race condition** na escrita do `index.json` (já existente em `LanDomainSyncService.syncEntity`) — mitigado pelo LWW já implementado
- **Cache stale na LAN**: se a pasta compartilhada tiver JSON desatualizado e Supabase estiver offline, o app usa dado antigo — aceitável dado que Supabase é fallback e a LAN é sempre mais recente que o cache SQLite
- Aumento de latência no boot se `getLanPath()` consultar SQLite a cada leitura — mitigado por cache em memória (ver implementação)

### Sem mudança

- Protocolo de eventos (`InboundService`, `EventSyncAdapter`, `LanDomainSyncService`) — intacto
- Mobile (`AttachmentService.js`, `InboundService.js`) — continua usando Supabase
- Formato de `shared/users.json` — compatível com ADR-030 (campos `username`/`password_hash` para mobile + `nome_usuario`/`hash_senha` para desktop legado)

---

## Implementação

### 1. `OrgConfigService` — injetar `LanFileStorage`

```ts
// src/infrastructure/sync/OrgConfigService.ts
async load(): Promise<OrgConfig> {
    // 1. LAN
    const fromLan = await this.lan?.readJson<OrgConfig>('shared/org_config.json');
    if (fromLan) {
        await this.cacheToLocal(fromLan);
        return fromLan;
    }
    // 2. Supabase
    try { return await this.loadFromStorage(); } catch {}
    // 3. SQLite cache
    const cached = await this.loadFromCache();
    if (!cached) throw new Error('org_config não encontrado em nenhuma fonte');
    return cached;
}
```

Publicação via LAN adicionada em `StorageBootstrapService.bootstrapIfNeeded()` após upload Supabase bem-sucedido.

### 2. `UserSnapshotService` — também escreve `shared/users.json` na LAN

```ts
// após upload Supabase existente:
await this.lan?.writeJson('shared/users.json', snapshot);
```

O campo `hash_senha`/`sal_sync` já é removido em `processed` antes do upload (sem mudança de segurança).

### 3. Novo `CrmSnapshotPublisher`

```ts
// src/infrastructure/sync/CrmSnapshotPublisher.ts
export class CrmSnapshotPublisher {
    constructor(private lan: LanFileStorage, private sqlite: SqlitePort) {}

    async publishAll(): Promise<void> {
        const names = getCrmDataSourceNames();
        await Promise.allSettled(names.map(n => this.publishOne(n)));
    }

    async publishOne(sourceName: string): Promise<void> {
        const rows = await loadCrmDataSource(sourceName);
        if (rows.length === 0) return; // não sobrescreve com vazio
        await this.lan.writeJson(`crm/${sourceName}.json`, rows);
    }
}
```

Chamado em `ensureColumnsIfNeeded` (fire-and-forget) após registro dos resolvers CRM.

### 4. `crm-datasources.ts` — LAN como fonte primária

```ts
export function registerCrmDataSources(sqlite: SqlitePort, lan?: LanFileStorage): void {
    resolvers.set('catadores_crm', async () => {
        const fromLan = await lan?.readJson<DataSourceRow[]>('crm/catadores_crm.json');
        if (fromLan?.length) return fromLan;
        return sqlite.query<DataSourceRow>(`SELECT ...`);
    });
    // idem para demais resolvers
}
```

### 5. `container.ts` — wiring

```ts
// já existente:
const lanFileStorage = new LanFileStorage(sqlite);

// novo:
const crmPublisher = new CrmSnapshotPublisher(lanFileStorage, sqlite);

// após registerCrmDataSources:
registerCrmDataSources(sqlite, lanFileStorage);
crmPublisher.publishAll().catch(() => {}); // fire-and-forget no boot

// OrgConfigService recebe lanFileStorage como 3º argumento
```

---

## Alternativas Consideradas

### HTTP server no desktop (descartada)

Expor endpoint HTTP (axum/tide via Tauri) para servir os JSONs. Permitiria acesso mobile via LAN sem Supabase. Descartado porque aumenta complexidade operacional (porta aberta, firewall) e o mobile já tem Supabase funcionando (ADR-030).

### Pasta compartilhada montada no Android (descartada)

Android não monta SMB/NFS nativamente sem permissões root. Inviável para deployment padrão.

### Manter SQLite como única fonte para CRM (descartada)

Bloqueia instâncias secundárias sem DB local. O padrão atual de `LanDomainSyncService` já estabelece a LAN como espelho de estado — consistente estender para datasources.

---

## Referências

- `ADR-020` — sync granular por domínio via pasta LAN (`LanDomainSyncService`)
- `ADR-025` — protocolo de sync de binários
- `ADR-030` — autenticação offline-first mobile (users.json no Supabase)
- `src/infrastructure/storage/LanFileStorage.ts`
- `src/infrastructure/sync/LanDomainSyncService.ts`
- `src/infrastructure/sync/OrgConfigService.ts`
- `src/infrastructure/sync/UserSnapshotService.ts`
- `src/infrastructure/config/crm-datasources.ts`
