# EcoForms — Arquitetura de Dados: 3 Barramentos

> **Offline-First + Clean Architecture**.
> Toda mutação nasce no SQLite local. A partir dele, dois barramentos de sincronização coexistem:
> um orientado a **eventos** (Supabase) e outro orientado a **snapshots por entidade** (LAN).

---

## Visão Geral: Os 3 Barramentos

```mermaid
flowchart LR
    subgraph DEVICE["🖥️ Dispositivo Desktop"]
        UI["UI<br/>Next.js + React"]
        CA["Clean Architecture<br/>Use Cases → Entities → Repos"]
    end

    subgraph BUS1["BARRA 1 — SQLite Local (fonte operacional)"]
        SQLITE[("SQLite<br/>26+ tabelas<br/>fonte da verdade local")]
    end

    subgraph BUS2["BARRA 2 — Event Sync (Supabase)"]
        direction TB
        EVT_OUT["📤 Push<br/>SyncOutbox → CryptoLayer<br/>→ TransportService<br/>→ RPC: push_sync_event"]
        EVT_IN["📥 Pull<br/>InboundService → CryptoLayer<br/>→ HandlerRegistry<br/>→ apply no SQLite"]
        EVT_STORE[("sync_event_index<br/>PostgreSQL<br/>event log encriptado<br/>AES-GCM por usuário")]
    end

    subgraph BUS3["BARRA 3 — Snapshot Sync (LAN)"]
        direction TB
        LAN_OUT["📤 Write<br/>LanDomainSyncService<br/>→ LanFileStorage<br/>→ invoke Tauri Rust<br/>→ fs::write UNC path"]
        LAN_IN["📥 Read<br/>pullIndex() + fetchEntity()<br/>→ compara index.json<br/>→ aplica snapshots alterados"]
        LAN_DISK[("\\\\192.168.12.1\\ecoforms\\<br/>{domain}/index.json<br/>{domain}/{id}.json<br/>LWW por UUID v7")]
    end

    UI --> CA
    CA -->|"leitura/escrita"| SQLITE

    SQLITE -->|"mutação → outbox"| EVT_OUT
    EVT_OUT --> EVT_STORE
    EVT_STORE --> EVT_IN
    EVT_IN -->|"eventos aplicados"| SQLITE

    SQLITE -->|"mutação → snapshot"| LAN_OUT
    LAN_OUT --> LAN_DISK
    LAN_DISK --> LAN_IN
    LAN_IN -->|"snapshots aplicados"| SQLITE

    BUS2 -.->|"coexistem<br/>simultaneamente"| BUS3

    classDef device fill:#e1f5fe,stroke:#0288d1
    classDef bus1 fill:#fff3e0,stroke:#f57c00
    classDef bus2 fill:#e8f5e9,stroke:#2e7d32
    classDef bus3 fill:#f3e5f5,stroke:#7b1fa2

    class UI,CA device
    class SQLITE bus1
    class EVT_OUT,EVT_IN,EVT_STORE bus2
    class LAN_OUT,LAN_IN,LAN_DISK bus3
```

| Barramento | Tipo | Resolução | Cobertura | Encriptação |
|---|---|---|---|---|
| **1 — SQLite Local** | Fonte operacional | Imediata (local) | 100% dos dados | bcrypt (senhas) |
| **2 — Event Sync Supabase** | Orientado a eventos | Eventual (push/pull RPC) | Multi-dispositivo (nuvem) | AES-GCM por chave derivada do usuário |
| **3 — Snapshot Sync LAN** | Orientado a snapshots por entidade | LWW por UUID v7 | Multi-dispositivo (rede local) | Nenhuma (rede confiável) |

---

## Clean Architecture + 3 Barramentos

```mermaid
flowchart TD
    subgraph UI_LAYER["🖥️ Interface"]
        PAGES["31 Páginas Next.js<br/>/, /kanban, /tasks, /forms,<br/>/clientes, /manifestacoes, ..."]
        COMPS["Componentes shadcn/ui<br/>TaskCard, FormRenderer,<br/>DashboardWidgets, KanbanBoard"]
    end

    subgraph HOOKS["🎣 Hooks (65 queries + 17 mutations)"]
        QHOOKS["useInboxData, useKanbanData,<br/>useTaskComments, useClientesData,<br/>useManifestacoesData, ..."]
        MHOOKS["useClienteMutations,<br/>useManifestacaoMutations,<br/>useTaskMutations, ..."]
    end

    subgraph APP["⚙️ Application (Use Cases)"]
        UC["CreateTask, AssignTask, ArchiveTask<br/>SubmitSuite, EditSuite, ReviewSuite<br/>CreateUser, ToggleUserStatus<br/>CreateDemanda, CloseDemanda<br/>CreateProject, ArchiveProject<br/>CreateBooking, Confirm/Cancel<br/>UpdateManifestacaoStatus<br/>CreateDataRegistry, BulkInsert<br/>CreateModule, PublishModule<br/>AddWidget, RemoveWidget<br/>..."]
    end

    subgraph DOMAIN["🏛️ Domain"]
        ENTITIES["Entities<br/>Task, SuitePackage, User, Demanda,<br/>Project, Kanban, Manifestacao,<br/>Agendamento, Cliente, Ecoponto,<br/>Module, Setor, Widget, View..."]
        SM["State Machines<br/>TaskStatus, SuiteStatus,<br/>ProjectStatus, ManifestacaoState,<br/>ExecucaoColetaState"]
        REPOS["Repository Interfaces<br/>TaskRepository, SuiteRepository,<br/>UserRepository, DemandaRepository,<br/>KanbanRepository, ..."]
    end

    subgraph INFRA["🔧 Infrastructure"]
        CONTAINER["DI Container<br/>getContainerAsync()"]

        subgraph BARRA1["BARRA 1 — SQLite Local"]
            SQLITE_REPOS["20+ Sqlite Repositories<br/>SqliteTaskRepository<br/>SqliteSuiteRepository<br/>SqliteUserRepository<br/>SqliteDemandaRepository<br/>SqliteKanbanRepository<br/>SqliteManifestacaoRepository<br/>SqliteClienteRepository<br/>SqliteProjectRepository<br/>SqliteAgendamentoRepository<br/>SqliteServiceTypeRepository<br/>SqliteServiceSlotRepository<br/>SqliteDataRegistryRepository<br/>SqliteLogisticsRepository<br/>SqliteSetorRepository<br/>SqliteModuleRepository<br/>SqliteViewRegistryRepository<br/>SqliteDecisionRegistryRepository<br/>SqliteUserWidgetInstanceRepository<br/>..."]
            SQLITE_PORT["SqlitePort<br/>(shared interface)"]
            TAURI["TauriSqliteAdapter<br/>invoke → Rust SQLite"]
        end

        subgraph BARRA2["BARRA 2 — Event Sync (Supabase)"]
            OUTBOX["SyncOutbox<br/>evento: {type, payload, seq}"]
            CRYPTO["CryptoLayer<br/>PBKDF2 → AES-GCM"]
            TRANSPORT["TransportService<br/>RPC: push_sync_event()"]
            INBOUND["InboundService<br/>RPC: pull_sync_events()"]
            HANDLER["HandlerRegistry<br/>dispatch por event.type"]
        end

        subgraph BARRA3["BARRA 3 — Snapshot Sync (LAN)"]
            LDSS["LanDomainSyncService<br/>syncEntity(domain, id, data)"]
            LFS["LanFileStorage<br/>invoke → Rust fs::*"]
            USS["UserSnapshotService<br/>publish → Supabase + LAN"]
            CRM["CrmSnapshotPublisher<br/>publish → LAN"]
        end
    end

    subgraph EXTERNAL["☁️ Externo"]
        SUPABASE[("Supabase PostgreSQL<br/>sync_event_index")]
        SUPABASE_S3[("Supabase Storage<br/>sync-bucket")]
        LAN_DISK[("UNC Path<br/>\\\\192.168.12.1\\ecoforms")]
    end

    %% Fluxo
    PAGES --> COMPS
    COMPS --> QHOOKS
    COMPS --> MHOOKS
    QHOOKS --> CONTAINER
    MHOOKS --> CONTAINER
    CONTAINER --> UC
    UC --> ENTITIES
    ENTITIES --> REPOS
    REPOS --> SQLITE_REPOS
    SQLITE_REPOS --> SQLITE_PORT
    SQLITE_PORT --> TAURI

    %% Barra 2: Escrita → Event Sync
    MHOOKS -->|"após save()"| OUTBOX
    OUTBOX --> CRYPTO
    CRYPTO -->|"envelope encriptado"| TRANSPORT
    TRANSPORT -->|"RPC push"| SUPABASE
    SUPABASE -->|"RPC pull"| INBOUND
    INBOUND --> CRYPTO
    CRYPTO -->|"evento desencriptado"| HANDLER
    HANDLER -->|"apply()"| SQLITE_REPOS

    %% Barra 3: Escrita → Snapshot LAN
    MHOOKS -->|"após save()"| LDSS
    LDSS --> LFS
    USS --> LFS
    USS --> SUPABASE_S3
    CRM --> LFS
    LFS -->|"write {domain}/{id}.json"| LAN_DISK
    LAN_DISK -->|"read index + entity"| LFS
    LFS -->|"pull snapshots"| LDSS
    LDSS -->|"apply"| SQLITE_REPOS

    %% Styles
    classDef ui fill:#e1f5fe,stroke:#0288d1
    classDef hooks fill:#e8eaf6,stroke:#3949ab
    classDef app fill:#e8f5e9,stroke:#388e3c
    classDef domain fill:#fff3e0,stroke:#f57c00
    classDef barra1 fill:#ffecb3,stroke:#ff8f00
    classDef barra2 fill:#c8e6c9,stroke:#2e7d32
    classDef barra3 fill:#e1bee7,stroke:#7b1fa2
    classDef external fill:#eceff1,stroke:#546e7a

    class PAGES,COMPS ui
    class QHOOKS,MHOOKS hooks
    class UC app
    class ENTITIES,SM,REPOS domain
    class SQLITE_REPOS,SQLITE_PORT,TAURI barra1
    class OUTBOX,CRYPTO,TRANSPORT,INBOUND,HANDLER barra2
    class LDSS,LFS,USS,CRM barra3
    class SUPABASE,SUPABASE_S3,LAN_DISK external
```

---

## Barra 1: SQLite Local — Fonte Operacional

```mermaid
flowchart LR
    subgraph CAMADAS["Camadas que escrevem/leem"]
        UC2["Use Cases"]
        ENTITIES2["Domain Entities"]
    end

    subgraph REPOSITORIES["Sqlite Repositories"]
        direction TB
        TASK_REPO["SqliteTaskRepository<br/>tarefas"]
        SUITE_REPO["SqliteSuiteRepository<br/>pacotes"]
        USER_REPO["SqliteUserRepository<br/>usuarios"]
        DEMANDA_REPO["SqliteDemandaRepository<br/>demandas"]
        PROJ_REPO["SqliteProjectRepository<br/>projetos"]
        KANBAN_REPO["SqliteKanbanRepository<br/>kanban"]
        MANIF_REPO["SqliteManifestacaoRepository<br/>manifestacoes"]
        AGEND_REPO["SqliteAgendamentoRepository<br/>agendamentos"]
        CLIENTE_REPO["SqliteClienteRepository<br/>clientes"]
        REGISTRY_REPO["SqliteDataRegistryRepository<br/>data_registry"]
        MORE["... +10 repos"]
    end

    subgraph ADAPTER["Adapter"]
        PORT["SqlitePort<br/>query(sql, params)"]
        TAURI2["TauriSqliteAdapter<br/>invoke('db_connect')"]
    end

    subgraph RUST["Rust (Tauri Plugin)"]
        SQLITE2[("SQLite<br/>Arquivo local<br/>AppData/ecoforms.db")]
    end

    UC2 -->|"save / find / delete"| TASK_REPO
    UC2 --> SUITE_REPO
    UC2 --> USER_REPO
    UC2 --> DEMANDA_REPO
    UC2 --> PROJ_REPO
    UC2 --> KANBAN_REPO
    UC2 --> MANIF_REPO
    UC2 --> AGEND_REPO
    UC2 --> CLIENTE_REPO
    UC2 --> REGISTRY_REPO
    UC2 --> MORE

    TASK_REPO --> PORT
    SUITE_REPO --> PORT
    USER_REPO --> PORT
    DEMANDA_REPO --> PORT
    PORT --> TAURI2
    TAURI2 --> SQLITE2

    classDef camadas fill:#e1f5fe,stroke:#0288d1
    classDef repos fill:#fff3e0,stroke:#f57c00
    classDef adapter fill:#c8e6c9,stroke:#388e3c
    classDef rust fill:#ffccbc,stroke:#d84315

    class UC2,ENTITIES2 camadas
    class TASK_REPO,SUITE_REPO,USER_REPO,DEMANDA_REPO,PROJ_REPO,KANBAN_REPO,MANIF_REPO,AGEND_REPO,CLIENTE_REPO,REGISTRY_REPO,MORE repos
    class PORT,TAURI2 adapter
    class SQLITE2 rust
```

### Características

| Propriedade | Valor |
|---|---|
| **Motor** | SQLite via Tauri Plugin (Rust) |
| **Acesso** | `SqlitePort` (interface) → `TauriSqliteAdapter` → `invoke('db_connect')` |
| **Tabelas** | 26+ (tarefas, pacotes, usuarios, demandas, projetos, kanban, manifestacoes, agendamentos, clientes, ecopontos, service_types, service_slots, modulos, view_registry, decision_registry, user_widget_instances, setores, tipo_prazos, tipo_residuos, execucao_coletas, execucao_clientes, email_config, hierarquia_perfis, notificacao_solicitantes, data_registry, sync_device_log) |
| **ORM** | Nenhum — SQL raw |
| **Consistência** | Imediata (local) |
| **É a fonte da verdade** | Sim — toda mutação começa aqui |

---

## Barra 2: Event Sync — Supabase (sync_event_index)

> **Orientado a eventos**.
> Cada mutação no SQLite gera um evento no outbox.
> Eventos são encriptados (AES-GCM) e publicados como log imutável no Supabase.
> Outros dispositivos puxam e aplicam na ordem.

```mermaid
flowchart TD
    subgraph DEVICE_A["Desktop A"]
        SQL_A[("SQLite A")]
        OUTBOX_A["SyncOutbox<br/>event: {type, payload, seq}"]
        CRYPTO_A["CryptoLayer<br/>encrypt(AES-GCM, userKey)"]
        TRANSPORT_A["TransportService"]
    end

    subgraph SUPABASE_CLOUD["☁️ Supabase"]
        RPC_PUSH["RPC: push_sync_event()<br/>(org_id, routing_id, encrypted_payload)"]
        EVENT_LOG[("sync_event_index<br/>PostgreSQL<br/>event log encriptado<br/>por dispositivo")]
        RPC_PULL["RPC: pull_sync_events()<br/>(org_id, routing_id, after_seq)"]
        STORAGE2[("Storage<br/>sync-bucket<br/>S3-compatible")]
    end

    subgraph DEVICE_B["Desktop B"]
        SQL_B[("SQLite B")]
        INBOUND_B["InboundService<br/>pullAndApply()"]
        CRYPTO_B["CryptoLayer<br/>decrypt(AES-GCM, userKey)"]
        HANDLER_B["HandlerRegistry<br/>dispatch(event.type)"]
    end

    SQL_A -->|"mutação"| OUTBOX_A
    OUTBOX_A -->|"lote de eventos<br/>não-sincronizados"| CRYPTO_A
    CRYPTO_A -->|"envelope<br/>encriptado"| TRANSPORT_A
    TRANSPORT_A -->|"HTTP POST"| RPC_PUSH
    RPC_PUSH --> EVENT_LOG

    EVENT_LOG -->|"SELECT seq > after_seq"| RPC_PULL
    RPC_PULL -->|"envelopes<br/>encriptados"| INBOUND_B
    INBOUND_B --> CRYPTO_B
    CRYPTO_B -->|"evento<br/>desencriptado"| HANDLER_B
    HANDLER_B -->|"apply(event)"| SQL_B

    %% Storage (arquivos)
    SQL_A -.->|"UserSnapshotService<br/>upload users.json"| STORAGE2
    STORAGE2 -.->|"sync-bucket<br/>download"| SQL_B

    classDef device fill:#e1f5fe,stroke:#0288d1
    classDef cloud fill:#e8f5e9,stroke:#2e7d32
    class A,B device
    class RPC_PUSH,RPC_PULL,EVENT_LOG,STORAGE2 cloud
```

### Características

| Propriedade | Valor |
|---|---|
| **Paradigma** | Event Sourcing (log imutável de eventos) |
| **Granularidade** | Evento = uma mutação atômica (create/update/delete) |
| **Ordem** | Sequencial por dispositivo (`seq`) |
| **Encriptação** | AES-GCM com chave derivada do usuário (PBKDF2) |
| **Transporte** | Supabase RPC (`push_sync_event` / `pull_sync_events`) |
| **Armazenamento** | `sync_event_index` (PostgreSQL) |
| **Resolução de conflitos** | Ordem de chegada no event log |
| **Arquivos** | `sync-bucket` (Supabase Storage S3) para users.json, org config |
| **Ciclo** | Push no save, Pull manual/botão/timer |

### Formato do Evento (SyncOutbox)

```ts
{
  id: string,            // UUID v7
  type: string,          // "task.created" | "suite.updated" | "user.deleted" | ...
  aggregate_id: string,  // ID da entidade
  payload: unknown,      // dados da mutação (delta ou full)
  seq: number,           // sequencial local
  synced: 0 | 1,         // flag de enviado
  created_at: string     // ISO timestamp
}
```

---

## Barra 3: Snapshot Sync — LAN (UNC Path)

> **Orientado a snapshots por entidade**.
> Cada mutação publica o estado completo da entidade como arquivo JSON na pasta compartilhada.
> Outros dispositivos leem o `index.json` para detectar mudanças e aplicam os snapshots alterados.

```mermaid
flowchart TD
    subgraph DEV_A["Desktop A"]
        SQL_A2[("SQLite A")]
        LDSS_A["LanDomainSyncService<br/>syncEntity(domain, id, data)"]
        LFS_A["LanFileStorage<br/>invoke → Rust fs::write"]
    end

    subgraph LAN_FS["💾 Pasta Compartilhada (UNC Path)"]
        direction TB
        ROOT["\\\\192.168.12.1\\ecoforms\\"]

        subgraph DOM_USERS["usuarios/"]
            IDX_U["index.json<br/>{ last_entity_uuid, entities: { id: { v, hash, last_event_id } } }"]
            E_U["{id}.json<br/>snapshot completo<br/>(sem hash_senha/sal_sync)"]
        end

        subgraph DOM_TASKS["tarefas/"]
            IDX_T["index.json"]
            E_T["{id}.json"]
        end

        subgraph DOM_CLI["clientes/"]
            IDX_C["index.json"]
            E_C["{id}.json"]
        end
    end

    subgraph DEV_B["Desktop B"]
        SQL_B2[("SQLite B")]
        LDSS_B["LanDomainSyncService<br/>pullIndex() + fetchEntity()"]
        LFS_B["LanFileStorage<br/>invoke → Rust fs::read"]
    end

    SQL_A2 -->|"mutação"| LDSS_A
    LDSS_A -->|"1. SHA-256(payload)<br/>2. hash igual? → skip<br/>3. write {domain}/{id}.json<br/>4. updateIndex(domain,id,v,hash,eventId)"| LFS_A
    LFS_A -->|"fs::write"| E_U
    LFS_A -->|"fs::write"| IDX_U
    LFS_A -->|"fs::write"| E_T
    LFS_A -->|"fs::write"| IDX_T

    IDX_U -->|"fs::read"| LFS_B
    IDX_T -->|"fs::read"| LFS_B
    E_U -->|"fs::read"| LFS_B
    E_T -->|"fs::read"| LFS_B
    LFS_B --> LDSS_B
    LDSS_B -->|"compara index local<br/>aplica snapshots alterados"| SQL_B2

    classDef device fill:#e1f5fe,stroke:#0288d1
    classDef lan fill:#f3e5f5,stroke:#7b1fa2
    classDev_A,SQL_A2,LDSS_A,LFS_A,DEV_B,SQL_B2,LDSS_B,LFS_B device
    class ROOT,DOM_USERS,DOM_TASKS,DOM_CLI,IDX_U,E_U,IDX_T,E_T,IDX_C,E_C lan
```

### Características

| Propriedade | Valor |
|---|---|
| **Paradigma** | Snapshot por entidade (estado completo, não delta) |
| **Granularidade** | Entidade individual = 1 arquivo JSON |
| **Detecção de mudanças** | SHA-256 do payload → skip se hash não mudou |
| **Resolução de conflitos** | **LWW (Last-Write-Wins)** por `last_event_id` (UUID v7) |
| **Versionamento** | Campo `v` incremental por entidade no index.json |
| **Transporte** | Tauri `invoke()` → Rust `fs::read` / `fs::write` sobre UNC path |
| **Codificação** | Base64 (TypeScript ↔ Rust) |
| **Segurança** | `validate_path()` bloqueia `..` (path traversal) |
| **Graceful degradation** | Se `lan_sync_path` vazio → todas operações no-op |
| **Integridade** | `UserSnapshotService` remove `hash_senha` e `sal_sync` antes de publicar |

### Estrutura de Diretórios na Pasta LAN

```
\\192.168.12.1\ecoforms\
├── usuarios/
│   ├── index.json
│   ├── 018f3a2c-...json
│   └── 019a4b5d-...json
├── tarefas/
│   ├── index.json
│   └── 01b5c6e7-...json
├── clientes/
│   ├── index.json
│   └── ...
├── crm/
│   ├── fonte_a.json
│   └── fonte_b.json
└── shared/
    └── users.json          ← snapshot completo (todos usuários)
```

### Formato do index.json

```json
{
  "last_entity_uuid": "019a4b5d-...",
  "entities": {
    "018f3a2c-...": {
      "v": 3,
      "hash": "a1b2c3d4e5f6...",
      "last_event_id": "01b5c6e7-..."
    }
  }
}
```

---

## Coexistência Barra 2 + Barra 3: Quando Usar Cada Um

```mermaid
flowchart TD
    MUT["Mutação no SQLite"]

    MUT --> EVT{"Event Sync<br/>disponível?"}
    EVT -->|"✅ Internet"| EVT_PUSH["Publica evento encriptado<br/>no sync_event_index"]
    EVT -->|"❌ Offline"| EVT_SKIP["Evento fica no outbox<br/>será enviado depois"]

    MUT --> LAN{"LAN Sync<br/>configurada?"}
    LAN -->|"✅ lan_sync_path preenchido"| LAN_PUSH["Escreve snapshot<br/>na pasta compartilhada"]
    LAN -->|"❌ Não configurado"| LAN_SKIP["No-op<br/>(graceful degradation)"]

    EVT_PUSH --> COEXIST["Ambos operam<br/>simultaneamente<br/>e de forma independente"]
    LAN_PUSH --> COEXIST

    COEXIST --> NOTE["<b>Event Sync</b>: log imutável,<br/>replicável para qualquer dispositivo<br/>com chave do usuário.<br/><br/><b>Snapshot LAN</b>: estado completo<br/>da entidade, ideal para bootstrap<br/>rápido e redes sem internet."]

    classDef mut fill:#ffecb3,stroke:#ff8f00
    classDef evt fill:#c8e6c9,stroke:#2e7d32
    classDef lan fill:#e1bee7,stroke:#7b1fa2
    classDef note fill:#eceff1,stroke:#546e7a

    class MUT mut
    class EVT,EVT_PUSH,EVT_SKIP evt
    class LAN,LAN_PUSH,LAN_SKIP lan
    class COEXIST,NOTE note
```

| Cenário | Barra 2 (Event Sync) | Barra 3 (Snapshot LAN) |
|---|---|---|
| **Dispositivo offline** | Eventos acumulam no outbox | Não disponível (sem rede) |
| **Rede local sem internet** | Indisponível | ✅ Funciona (UNC path) |
| **Internet disponível** | ✅ Sincroniza via Supabase | ✅ Sincroniza via LAN |
| **Novo dispositivo (bootstrap)** | Precisa reproduzir todo event log | ✅ Lê snapshots direto |
| **Auditoria / histórico** | ✅ Log imutável de eventos | ❌ Apenas estado atual |
| **Conflitos** | Ordem de chegada no log | LWW por UUID v7 |
| **Segurança** | AES-GCM (dados encriptados em trânsito e repouso) | Rede confiável (sem encriptação) |

---

## Autenticação

```mermaid
flowchart TD
    LOGIN["Tela de Login<br/>usuário + senha"]
    BCRYPT["bcryptjs.compare()<br/>hash armazenada no SQLite"]
    PBKDF2["PBKDF2<br/>senha + sal → chave AES-GCM<br/>(usada pelas Barras 2 e 3)"]
    SESSION["set_session()<br/>invoke Tauri Rust"]
    STORAGE["localStorage<br/>user + timestamp"]
    SUPABASE_SYNC["Supabase Auth Sync<br/>(não-bloqueante)<br/>email: user@ecoforms.local"]
    REDIRECT["Redireciona para /"]

    LOGIN --> BCRYPT
    BCRYPT -->|"match ✅"| PBKDF2
    BCRYPT -->|"fail ❌"| LOGIN
    PBKDF2 --> SESSION
    SESSION --> STORAGE
    STORAGE --> SUPABASE_SYNC
    SUPABASE_SYNC --> REDIRECT

    classDef auth fill:#e8eaf6,stroke:#3949ab
    class LOGIN,BCRYPT,PBKDF2,SESSION,STORAGE,SUPABASE_SYNC,REDIRECT auth
```

---

## Tabelas e Entidades por Domínio

| Domínio | Entidade | Tabela SQLite (Barra 1) | Use Cases |
|---------|----------|--------------------------|-----------|
| **Task** | Task | `tarefas` | CreateTask, AssignTask, ArchiveTask, MoveTask, TaskMetrics |
| **Kanban** | KanbanBoard | `kanban` | GetKanban, UpdateColumns |
| **Suite** | SuitePackage | `pacotes` | SubmitSuite, EditSuite, ReviewSuite, ListInbox, ResubmitSuite |
| **User** | User | `usuarios` | ListUsers, CreateUser, UpdateUser, ToggleUserStatus |
| **Demanda** | Demanda | `demandas` | CreateDemanda, AcceptDemanda, CloseDemanda, DemandaTaskSynchronizer |
| **Project** | Project | `projetos` | CreateProject, UpdateProject, ArchiveProject, ListProjectsWithMetrics |
| **Service** | Agendamento, ServiceSlot, ServiceType | `agendamentos`, `service_slots`, `service_types` | CreateBooking, Confirm/Cancel, ListSlots |
| **Ouvidoria** | Manifestacao | `manifestacoes` | UpdateManifestacaoStatus, SeedCatalog |
| **Logistics** | ExecucaoColeta | `execucao_coletas` | StartColeta, CompleteColeta |
| **Client** | Cliente | `clientes` | CreateCliente, UpdateCliente |
| **Ecoponto** | Ecoponto | `ecopontos` | ListEcopontos, ToggleActive |
| **Data Registry** | DataRegistryItem | `data_registry` | ListItems, CreateDataRegistry, BulkInsert, AggregateByType |
| **Module** | ModuleRegistry | `modulos` | CreateModule, PublishModule, ArchiveModule |
| **View** | ViewRegistry | `view_registry` | GetView, GetActiveViews, GetViewsByPerfil |
| **Widget** | UserWidgetInstance | `user_widget_instances` | AddWidget, UpdateWidget, RemoveWidget |
| **Sector** | Setor | `setores` | ListSetores |
| **Deadline** | TipoPrazo | `tipo_prazos` | ListPrazos |
| **Waste Type** | TipoResiduo | `tipo_residuos` | ListResiduos |

---

## Stack Tecnológica

```
┌──────────────────────────────────────────────────────────┐
│                    🖥️ Desktop (Tauri)                      │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────────┐ │
│  │ Next.js 16  │  │ React 19 │  │ TailwindCSS 4 +      │ │
│  │ App Router  │  │          │  │ shadcn/ui (Radix)    │ │
│  └─────────────┘  └──────────┘  └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Clean Architecture (TypeScript)                     │ │
│  │  interface/ → application/ → domain/ → infrastructure│ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Rust Backend │  │  SQLite  │  │  bcryptjs + PBKDF2 │  │
│  │ (Tauri 2.x)  │  │  Local   │  │  Auth Local        │  │
│  └──────────────┘  └──────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                    📱 Mobile (Capacitor)                   │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Vanilla JS   │  │ Ionic    │  │ Capacitor SQLite   │  │
│  │              │  │ PWA      │  │ Plugin             │  │
│  └──────────────┘  └──────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│                 📦 ecoforms-core (Shared)                  │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Sync Engine  │  │ Permiss. │  │ Conflict Resolver  │  │
│  │ (EventSrc)   │  │ Engine   │  │ + UUID v7          │  │
│  └──────────────┘  └──────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│            ☁️ Barra 2 — Event Sync (Supabase)              │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ PostgreSQL   │  │ Storage  │  │ Auth               │  │
│  │ sync_events  │  │ S3 Bucket│  │ RLS Policies       │  │
│  └──────────────┘  └──────────┘  └────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│           💾 Barra 3 — Snapshot Sync (LAN)                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ UNC Path (\\192.168.12.1\ecoforms)                   │ │
│  │ {domain}/index.json + {domain}/{id}.json             │ │
│  │ Tauri invoke → Rust fs::read/write → LWW UUID v7     │ │
│  └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│                   🌐 Express Proxy (server.js)             │
│  ┌──────────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Signed URLs  │  │ Upload   │  │ Rate Limit         │  │
│  │ /api/signed  │  │ /api/up  │  │ 30 req/min         │  │
│  └──────────────┘  └──────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```
