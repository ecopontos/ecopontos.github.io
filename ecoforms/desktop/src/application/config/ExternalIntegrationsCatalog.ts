export type IntegrationClass =
    | "externo-admin"
    | "externo-storage-sync"
    | "legado/importacao-sync"
    | "hub-lan-opcional"
    | "compartilhamento-arquivos-lan"
    | "api-publica-consulta"
    | "backend-local-exposto-na-rede";

export type IntegrationStatus = "ativo" | "opcional" | "deprecated" | "proposto";

export type IntegrationAuthority =
    | "nenhuma-no-crud-local"
    | "distribuicao-local-do-host";

export type IntegrationAvailability =
    | "best-effort"
    | "sob-demanda"
    | "obrigatoria-apenas-no-fluxo-externo";

export interface ExternalIntegrationDescriptor {
    id: string;
    nome: string;
    classe: IntegrationClass;
    status: IntegrationStatus;
    autoridadeOperacional: IntegrationAuthority;
    disponibilidadeExigida: IntegrationAvailability;
    credencial: string;
    fallback: string;
    donoTecnico: string;
    bloqueiaCrudLocal: boolean;
    finalidade: string;
    superficies: readonly string[];
    fluxoExplicito: readonly string[];
    retirementPlan?: string;
}

export const EXTERNAL_INTEGRATIONS: readonly ExternalIntegrationDescriptor[] = [
    {
        id: "supabase_admin_auth",
        nome: "Supabase Auth/Admin",
        classe: "externo-admin",
        status: "ativo",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "obrigatoria-apenas-no-fluxo-externo",
        credencial: "SUPABASE_SERVICE_ROLE_KEY no backend Rust e NEXT_PUBLIC_SUPABASE_URL para roteamento do endpoint",
        fallback: "CRUD local continua; apenas operacoes administrativas e de identidade remota ficam indisponiveis",
        donoTecnico: "admin-identidade",
        bloqueiaCrudLocal: false,
        finalidade: "Administracao remota de usuarios/perfis no Supabase sem expor a service role ao WebView.",
        superficies: [
            "src-tauri/src/supabase_admin.rs",
            "src/infrastructure/adapters/SupabaseAdminAdapter.ts",
            "src/interface/hooks/queries/useSupabaseAdmin.ts",
            "src/application/ports/SupabaseAdminPort.ts",
        ],
        fluxoExplicito: [
            "supabase_admin_query",
            "read_profiles",
            "read_users",
            "create_user",
            "update_user",
            "delete_user",
            "EliminacaoTitularUseCase",
        ],
    },
    {
        id: "supabase_storage_sync",
        nome: "Supabase Storage + RPC",
        classe: "externo-storage-sync",
        status: "ativo",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "best-effort",
        credencial: "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
        fallback: "Arquivos, snapshots ou RPCs ficam pendentes/falham de forma localizada; o SQLite local segue autoritativo",
        donoTecnico: "sync-remoto-e-anexos",
        bloqueiaCrudLocal: false,
        finalidade: "Storage remoto, snapshots e RPCs auxiliares sem assumir a autoridade do CRUD local.",
        superficies: [
            "src/infrastructure/persistence/supabase/supabaseClient.ts",
            "src/infrastructure/storage/SupabaseFileStorage.ts",
            "src/infrastructure/sync/UserSnapshotService.ts",
            "src/infrastructure/sync/lazy-sync.ts",
            "src/interface/hooks/utils/useSupabaseClient.ts",
        ],
        fluxoExplicito: [
            "upload de anexos/galeria",
            "snapshots de usuarios",
            "RPCs de sync remoto",
        ],
    },
    {
        id: "postgres_legacy_sync",
        nome: "PostgreSQL legado",
        classe: "legado/importacao-sync",
        status: "deprecated",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "obrigatoria-apenas-no-fluxo-externo",
        credencial: "configuracoes_sistema + .ecoforms-pg-legacy.key + chave criptografica carregada no backend local",
        fallback: "Importacoes/syncs legados nao executam; nenhum CRUD local aceito deve depender desse banco",
        donoTecnico: "importacao-legada",
        bloqueiaCrudLocal: false,
        finalidade: "Importar roteiros, residuos e pesagens de uma base externa antiga para o schema local.",
        superficies: [
            "src-tauri/src/commands/legacy_sync.rs",
            "src-tauri/src/commands/sync_roteiros.rs",
            "src-tauri/src/commands/sync_residuos.rs",
            "src-tauri/src/commands/sync_pesagens.rs",
            "src/interface/hooks/queries/useLegacySyncData.ts",
        ],
        fluxoExplicito: [
            "pg_legacy_config_get",
            "pg_legacy_config_save",
            "sync_roteiros_externos",
            "sync_residuos_externos",
            "sync_pesagens_externas",
        ],
        retirementPlan: "Substituir por importador controlado ou pipeline de exportacao e remover os comandos Rust de sync legado apos a validacao dos datasets necessarios.",
    },
    {
        id: "lan_shared_folder",
        nome: "Pasta LAN compartilhada",
        classe: "compartilhamento-arquivos-lan",
        status: "ativo",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "best-effort",
        credencial: "ACL do compartilhamento de rede e caminho configurado em lan_sync_path",
        fallback: "Bootstrap, espelhamento e troca de snapshots ficam indisponiveis; a estacao continua operando com SQLite local",
        donoTecnico: "sync-lan",
        bloqueiaCrudLocal: false,
        finalidade: "Troca de arquivos e snapshots por pasta compartilhada entre estacoes sem depender de nuvem.",
        superficies: [
            "src/infrastructure/storage/LanFileStorage.ts",
            "src/infrastructure/sync/LanDomainSyncService.ts",
            "src/infrastructure/sync/StorageBootstrapService.ts",
            "src/interface/hooks/mutations/useFirstRunSetup.ts",
            "app/admin/settings/page.tsx",
        ],
        fluxoExplicito: [
            "bootstrap_set_lan_sync_path",
            "testConnection",
            "espelhamento de snapshots",
            "exportacao mobile para LAN",
        ],
    },
    {
        id: "lan_server_http_ws",
        nome: "LAN server HTTP/WebSocket",
        classe: "backend-local-exposto-na-rede",
        status: "ativo",
        autoridadeOperacional: "distribuicao-local-do-host",
        disponibilidadeExigida: "best-effort",
        credencial: "Pareamento com X-Device-Id + X-LAN-Token",
        fallback: "Eventos e arquivos deixam de replicar pela rede; o host e os clientes mantem CRUD local e outbox pendente",
        donoTecnico: "sync-lan",
        bloqueiaCrudLocal: false,
        finalidade: "Expor sync e transferencia de arquivos do host para outras maquinas da rede local com autenticacao e limites.",
        superficies: [
            "src-tauri/src/lan_server/server.rs",
            "src-tauri/src/lan_server/routes.rs",
            "src-tauri/src/lan_server/file_routes.rs",
            "src-tauri/src/lan_server/ws.rs",
            "src/infrastructure/sync/LanTransport.ts",
        ],
        fluxoExplicito: [
            "GET/POST /api/sync/events",
            "GET/POST /api/files",
            "GET /api/status",
            "WS /ws",
        ],
    },
    {
        id: "pocketbase_hub",
        nome: "PocketBase hub local",
        classe: "hub-lan-opcional",
        status: "proposto",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "best-effort",
        credencial: "NEXT_PUBLIC_POCKETBASE_URL e configuracoes do proprio hub",
        fallback: "POC nao bloqueia o runtime; SQLite local e mecanismos LAN atuais continuam como caminho principal",
        donoTecnico: "hub-lan",
        bloqueiaCrudLocal: false,
        finalidade: "Hub local opcional para distribuicao e catalogos, sem substituir o SQLite offline-first.",
        superficies: [
            "src/infrastructure/pocketbase/PocketBaseConfig.ts",
            "src/infrastructure/pocketbase/PocketBaseClient.ts",
            "src/infrastructure/pocketbase/HybridTipoResiduoRepository.ts",
            "docs/adr/ADR-062 — PocketBase como hub local iniciado pelo Windows",
        ],
        fluxoExplicito: [
            "POC de repositorio hibrido",
            "descoberta/health-check do hub",
        ],
    },
    {
        id: "viacep",
        nome: "ViaCEP",
        classe: "api-publica-consulta",
        status: "ativo",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "sob-demanda",
        credencial: "Sem credencial",
        fallback: "Preenchimento manual de endereco quando a consulta falha",
        donoTecnico: "cadastro-endereco",
        bloqueiaCrudLocal: false,
        finalidade: "Autocompletar endereco a partir do CEP em fluxos de cadastro.",
        superficies: [
            "src/lib/cep.ts",
            "src-tauri/tauri.conf.json",
        ],
        fluxoExplicito: [
            "fetch_cep",
            "fallback fetch https://viacep.com.br/ws/...",
        ],
    },
    {
        id: "nominatim",
        nome: "Nominatim",
        classe: "api-publica-consulta",
        status: "ativo",
        autoridadeOperacional: "nenhuma-no-crud-local",
        disponibilidadeExigida: "sob-demanda",
        credencial: "Sem credencial",
        fallback: "Sem geocodificacao automatica; coordenadas ficam dependentes de entrada manual ou fluxo posterior",
        donoTecnico: "geo-consulta",
        bloqueiaCrudLocal: false,
        finalidade: "Geocodificar enderecos para fluxos cartograficos e de localizacao.",
        superficies: [
            "src/lib/geocoding.ts",
            "src-tauri/tauri.conf.json",
        ],
        fluxoExplicito: [
            "geocodeAddress",
            "geocodeFromCep",
        ],
    },
] as const;

export function getExternalIntegrations(): readonly ExternalIntegrationDescriptor[] {
    return EXTERNAL_INTEGRATIONS;
}

export function getExternalIntegrationById(id: string): ExternalIntegrationDescriptor | undefined {
    return EXTERNAL_INTEGRATIONS.find((integration) => integration.id === id);
}

export function getDeprecatedExternalIntegrations(): readonly ExternalIntegrationDescriptor[] {
    return EXTERNAL_INTEGRATIONS.filter((integration) => integration.status === "deprecated");
}
