# POC PocketBase offline-first

Este POC conecta o catalogo `TipoResiduo` a um hub PocketBase opcional, mantendo SQLite como fonte de operacao local.

## Objetivo

- Continuar lendo dados do SQLite local para preservar operacao offline.
- Salvar e excluir primeiro no SQLite.
- Replicar alteracoes para PocketBase em modo best-effort quando o hub estiver configurado.
- Nao adicionar SDK ou dependencia nova no desktop.

## Configuracao

No ambiente do desktop:

```bash
NEXT_PUBLIC_POCKETBASE_ENABLED=true
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_POCKETBASE_TIPO_RESIDUO_COLLECTION=tipos_residuo
```

`NEXT_PUBLIC_POCKETBASE_TIPO_RESIDUO_COLLECTION` e opcional; o padrao e `tipos_residuo`.

## Colecao PocketBase

Crie uma colecao `tipos_residuo` com os campos:

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | record id | mesmo id local |
| `codigo` | text | idealmente unico |
| `nome` | text | usado para ordenacao |
| `descricao` | text | opcional |
| `cor` | text | cor em texto, por exemplo `#16a34a` |
| `ativo` | bool | filtra catalogo ativo |
| `criado_em` | text/date | timestamp originado do SQLite |

Para este POC, a colecao precisa aceitar leitura/escrita do cliente desktop ou ter regras equivalentes para o ambiente de teste.

## Limites intencionais

- Nao ha token administrativo no frontend. Producao deve autenticar via regra segura, comando Tauri/Rust ou backend proprio.
- Leituras continuam locais; o POC valida replicacao para hub, nao sincronizacao bidirecional.
- Falhas de rede no PocketBase sao registradas no console e nao bloqueiam o SQLite.

## Arquivos

- `src/infrastructure/pocketbase/PocketBaseConfig.ts`
- `src/infrastructure/pocketbase/PocketBaseClient.ts`
- `src/infrastructure/pocketbase/PocketBaseTipoResiduoRepository.ts`
- `src/infrastructure/pocketbase/HybridTipoResiduoRepository.ts`
- `src/infrastructure/container.ts`
