# Registro de integracoes externas e legadas

**Data:** 2026-06-30
**Fonte de verdade em runtime:** `src/application/config/ExternalIntegrationsCatalog.ts`
**Contexto:** Fase D do `PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md` e ADR-063.

## Regras operacionais

- SQLite local continua sendo a autoridade do CRUD offline-first.
- Falha externa nao invalida CRUD local ja aceito.
- Excecao: fluxos explicitamente externos podem falhar de forma localizada sem contaminar a persistencia local.
- Integracoes `deprecated` precisam de plano de retirada e nao podem ganhar novas responsabilidades.

## Catalogo

| ID | Classe | Status | Autoridade | Disponibilidade | Credencial | Fallback | Dono tecnico |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `supabase_admin_auth` | `externo-admin` | `ativo` | `nenhuma-no-crud-local` | `obrigatoria-apenas-no-fluxo-externo` | service role no backend Rust | CRUD local segue; admin remoto indisponivel | `admin-identidade` |
| `supabase_storage_sync` | `externo-storage-sync` | `ativo` | `nenhuma-no-crud-local` | `best-effort` | anon key + URL | snapshots/anexos falham localmente sem travar o SQLite | `sync-remoto-e-anexos` |
| `postgres_legacy_sync` | `legado/importacao-sync` | `deprecated` | `nenhuma-no-crud-local` | `obrigatoria-apenas-no-fluxo-externo` | config local cifrada no backend | importacao legada nao executa | `importacao-legada` |
| `lan_shared_folder` | `compartilhamento-arquivos-lan` | `ativo` | `nenhuma-no-crud-local` | `best-effort` | ACL da pasta + `lan_sync_path` | bootstrap/espelhamento param, estacao segue local | `sync-lan` |
| `lan_server_http_ws` | `backend-local-exposto-na-rede` | `ativo` | `distribuicao-local-do-host` | `best-effort` | `X-LAN-Token` + `X-Device-Id` | outbox/replicacao ficam pendentes | `sync-lan` |
| `pocketbase_hub` | `hub-lan-opcional` | `proposto` | `nenhuma-no-crud-local` | `best-effort` | URL/config do hub | POC nao bloqueia runtime | `hub-lan` |
| `viacep` | `api-publica-consulta` | `ativo` | `nenhuma-no-crud-local` | `sob-demanda` | sem credencial | preenchimento manual | `cadastro-endereco` |
| `nominatim` | `api-publica-consulta` | `ativo` | `nenhuma-no-crud-local` | `sob-demanda` | sem credencial | sem geocodificacao automatica | `geo-consulta` |

## Integracao `deprecated`

### `postgres_legacy_sync`

- Motivo: depende de uma base externa antiga e so faz sentido como importacao controlada.
- Superficies atuais: `legacy_sync.rs`, `sync_roteiros.rs`, `sync_residuos.rs`, `sync_pesagens.rs`, `useLegacySyncData.ts`.
- Plano de retirada: substituir por importador controlado ou pipeline de exportacao e remover os comandos Rust de sync legado apos consolidar os datasets ainda necessarios.
- Regra: esse fluxo nao pode voltar a ser dependencia de CRUD local ou autenticacao principal.

## Fluxos explicitamente externos

Os fluxos abaixo podem falhar por indisponibilidade externa sem comprometer a operacao local ja aceita:

- operacoes administrativas remotas no Supabase;
- upload/storage/snapshots remotos no Supabase;
- importacoes do PostgreSQL legado;
- distribuicao LAN por pasta compartilhada ou LAN server;
- consultas publicas ViaCEP/Nominatim;
- POC PocketBase enquanto permanecer opcional.

## Consequencia pratica para implementacao

Ao introduzir uma nova integracao, o minimo exigido agora e:

1. registrar a entrada neste catalogo runtime;
2. declarar autoridade operacional e fallback;
3. dizer se bloqueia ou nao o CRUD local;
4. marcar `deprecated` se for superficie de transicao/legado;
5. atualizar o plano arquitetural se a integracao mudar de papel.
