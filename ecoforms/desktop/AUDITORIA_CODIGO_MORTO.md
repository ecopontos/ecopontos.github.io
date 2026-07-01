# Auditoria de Codigo Morto — EcoForms Desktop

**Data:** 2026-06-29
**Escopo:** `ecoforms/desktop`
**Objetivo:** registrar candidatos a codigo morto, dependencias sem uso e falsos positivos encontrados por analise automatica e validacao pontual.

---

## Metodologia

Comandos executados a partir de `ecoforms/desktop`:

```bash
npx knip
rg -n "TODO|DEPRECATED|deprecated|unused|nao usado|legacy|LEGACY|dead code|codigo morto" app components contexts lib scripts src types -S
rg -n "@tauri-apps/plugin-shell|@types/bcryptjs|@types/proj4|bcryptjs|proj4|plugin-shell" package.json package-lock.json app components contexts lib scripts src types src-tauri -S
```

Tambem foi feita validacao pontual com `rg` para confirmar se alguns arquivos apontados pelo `knip` tinham referencias reais.

**Observacao:** `knip` pode gerar falsos positivos em exports de catalogos/barrels, componentes UI reutilizaveis e APIs publicas internas. Remocoes devem ser feitas em lotes pequenos com `npx tsc --noEmit`, `npm run lint` e testes relevantes.

---

## Veredito

Ha candidatos reais de codigo morto, principalmente arquivos antigos de use cases, presenters, wrappers e adapters que nao aparecem referenciados. A remocao mais segura e comecar pelos arquivos inteiros de alta confianca e pelas dependencias JS sem uso confirmado.

Prioridade sugerida:

1. Remover arquivos inteiros sem referencias aparentes.
2. Remover dependencias JS redundantes.
3. Revisar exports sem uso somente se houver objetivo de reduzir API interna.
4. Ignorar, por enquanto, exports de componentes UI e catalogos compartilhados.

## Progresso aplicado em 2026-06-30

**Lote 1 concluido**

Foram removidos com gate limpo (`npx tsc --noEmit` + `npm run lint`):

- `components/lan/LanStatusBadge.tsx`
- `src/interface/hooks/mutations/useSaveTipoResiduo.ts`
- `src/interface/hooks/queries/useTiposResiduo.ts`
- `src/infrastructure/storage/InMemoryStorageAdapter.ts`
- `src/infrastructure/persistence/SQLiteDBWrapper.ts`

**Lote 2 concluido**

Tambem foram removidos com gate limpo (`npx tsc --noEmit` + `npm run lint`):

- `src/application/ports/SyncRepository.ts`
- `src/application/service/RealizarAgendamentoUseCase.ts`
- `src/application/task/CompleteTaskUseCase.ts`
- `src/application/widgets/SchemaDiscoveryService.ts`
- `src/domain/task/TaskEvents.ts`
- `src/infrastructure/sync/base64.ts`
- `src/infrastructure/sync/UserWidgetInboundHandler.ts`
- `src/interface/presenters/toDemandaViewModel.ts`
- `src/interface/presenters/toTaskViewModel.ts`

**Lote 3 concluido**

Removidos apos revisao manual, com `npx tsc --noEmit` passando e `npm run lint` reduzindo o baseline para **0 erros / 146 warnings**:

- `app/admin/agendamentos/slots/[id]/SlotDetailClient.tsx`
- `app/admin/service-types/[id]/EditServiceTypeClient.tsx`
- `src/application/kanban/KanbanDto.ts`

**Lote 4 concluido**

Removidos apos triagem dos itens duvidosos, mantendo `logger.ts` como falso positivo confirmado:

- `src/domain/project/Project.ts`
- `src/infrastructure/persistence/sqlite/queries/inbox.ts`
- `src/infrastructure/persistence/sqlite/queries/ouvidoria.ts`

Tambem foram removidas as dependencias JS sem uso confirmado:

- `@tauri-apps/plugin-shell`
- `@types/bcryptjs`
- `@types/proj4`

---

## Alta confianca — status final

O backlog de alta confianca foi esgotado nesta rodada. Os candidatos inicialmente listados foram removidos em quatro lotes com gate objetivo.

---

## Dependencias possivelmente removiveis

`knip` apontou dependencias sem uso direto:

| Dependencia | Status observado | Recomendacao |
|---|---|---|
| `@tauri-apps/plugin-shell` | Removida do `package.json`; nenhum uso JS encontrado. | Concluido no lote 1 da Fase E. |
| `@types/bcryptjs` | Removida; `bcryptjs` segue com tipos suficientes para o projeto. | Concluido no lote 1 da Fase E. |
| `@types/proj4` | Removida; `proj4` segue tipado sem pacote extra. | Concluido no lote 1 da Fase E. |

`proj4` e `bcryptjs` em si nao devem ser removidos: ambos possuem uso real.

---

## Candidatos que exigem revisao manual

| Item | Motivo |
|---|---|
| `src/lib/logger.ts` | `knip` marcou, mas `rg` encontrou uso em `app/view/page.client.tsx`. Falso positivo confirmado; manter. |

---

## Falsos positivos confirmados ou provaveis

Itens marcados pelo `knip`, mas com referencias reais encontradas por `rg`:

| Item | Evidencia |
|---|---|
| `src/infrastructure/persistence/sqlite/queries/cliente-perfil.ts` | Importado por `src/interface/hooks/queries/useClientePerfil.ts`. |
| `src/interface/hooks/queries/useClientePerfil.ts` | Exporta hooks de perfil de cliente; pode ser usado via catalogo/rotas futuras. Confirmar antes de remover. |
| `src/application/persistence/sqlite/queries/log_acoes.ts` | Importado por actions e use cases de usuario. |
| `src/application/persistence/sqlite/queries/log_auditoria.ts` | Importado por `EliminacaoTitularUseCase`. |
| `src/lib/logger.ts` | Importado por `app/view/page.client.tsx`. |

---

## Exports sem uso — tratar com cuidado

`knip` reportou muitos `Unused exports`, especialmente em:

- `components/ui/*`
- `src/interface/hooks/catalog/*`
- catalogos SQL em `src/application/persistence/sqlite/queries/*`
- catalogos SQL em `src/infrastructure/persistence/sqlite/queries/*`

Esses exports podem ser API interna intencional, barrel exports ou pontos de extensao. Remover sem uma politica clara pode gerar churn e quebrar consumo futuro.

Recomendacao: so remover exports quando o arquivo inteiro ja estiver morto ou quando houver substituto claro e validado por typecheck.

---

## Comandos de validacao recomendados para uma limpeza

```bash
npx tsc --noEmit
npm run lint
npm test
node scripts/audit-db-consistency.js
npm run build
```

Para mudancas em Rust/Tauri:

```bash
cd src-tauri
cargo check
cargo test --lib
```
