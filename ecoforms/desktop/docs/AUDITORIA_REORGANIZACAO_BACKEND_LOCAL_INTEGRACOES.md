# Auditoria executavel de fronteiras e SQL lusofono

**Gerado em:** 2026-06-30T22:45:25.823Z
**Escopo:** Fase A do `PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md`

## Resumo

### Imports de infraestrutura na UI

Total: **0**

- `crud-local`: 0
- `integracao-externa`: 0
- `hub-lan`: 0
- `legado/compatibilidade`: 0

### Referencias a nomes de tabela fora da convencao lusofona

Total: **0**

- `crud-local`: 0
- `integracao-externa`: 0
- `hub-lan`: 0
- `legado/compatibilidade`: 0

## Imports de infraestrutura na UI

_Nenhum achado._

## Referencias a tabelas nao canonicas

_Nenhum achado._

## Excecoes temporarias aceitas

- `src/interface/hooks/utils/useContainer.ts` — ponte temporaria de composicao para DI enquanto hooks de dominio substituem getContainer direto. Prazo: **2026-07-31**.
- `src/interface/hooks/utils/useSupabaseClient.ts` — escape hatch legado; deve sumir conforme fluxos de storage/admin migrem para hooks especificos. Prazo: **2026-07-15**.

## Leitura operacional

- `crud-local`: chamadas que ainda atravessam container/query packs do backend local embutido.
- `integracao-externa`: fluxos dependentes de Supabase ou outra integracao HTTP/SDK.
- `hub-lan`: adaptadores de LAN/PocketBase e distribuicao entre maquinas.
- `legado/compatibilidade`: nomes e acessos mantidos por compatibilidade ou transicao de schema.
