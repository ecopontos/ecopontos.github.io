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

---

## Alta confianca — arquivos sem referencia aparente

Estes arquivos foram listados por `knip` como `Unused files` e a validacao pontual nao encontrou chamadas/imports diretos relevantes.

| Arquivo | Observacao |
|---|---|
| `app/admin/agendamentos/slots/[id]/SlotDetailClient.tsx` | Provavel remanescente apos split para `page.client.tsx`/rotas estaticas. |
| `app/admin/service-types/[id]/EditServiceTypeClient.tsx` | Provavel remanescente apos introducao de `page.client.tsx`. |
| `components/lan/LanStatusBadge.tsx` | Componente sem uso encontrado. |
| `src/application/kanban/KanbanDto.ts` | DTO antigo; tipos atuais parecem vir de `types` e hooks. |
| `src/application/ports/SyncRepository.ts` | Port nao referenciado. |
| `src/application/service/RealizarAgendamentoUseCase.ts` | Use case antigo sem referencia aparente. |
| `src/application/task/CompleteTaskUseCase.ts` | Use case sem referencia aparente no container atual. |
| `src/application/widgets/SchemaDiscoveryService.ts` | Servico sem referencia aparente. |
| `src/domain/task/TaskEvents.ts` | Eventos antigos de task sem uso encontrado. |
| `src/infrastructure/persistence/SQLiteDBWrapper.ts` | Wrapper antigo sem referencia aparente. |
| `src/infrastructure/storage/InMemoryStorageAdapter.ts` | Adapter antigo sem referencia aparente. |
| `src/infrastructure/sync/base64.ts` | Helper sem uso; conversao local existe em `app/admin/exportar-mobile/page.tsx`. |
| `src/infrastructure/sync/UserWidgetInboundHandler.ts` | Handler sem registro/uso encontrado. |
| `src/interface/hooks/mutations/useSaveTipoResiduo.ts` | Hook sem uso encontrado. |
| `src/interface/hooks/queries/useTiposResiduo.ts` | Hook sem uso encontrado. |
| `src/interface/presenters/toDemandaViewModel.ts` | Presenter documentado, mas sem import real encontrado. |
| `src/interface/presenters/toTaskViewModel.ts` | Presenter documentado, mas sem import real encontrado. |

### Acao recomendada

Remover em um PR separado, em blocos pequenos. Depois de cada bloco:

```bash
npx tsc --noEmit
npm run lint
npm test -- --runInBand # se aplicavel; caso contrario npm test
```

---

## Dependencias possivelmente removiveis

`knip` apontou dependencias sem uso direto:

| Dependencia | Status observado | Recomendacao |
|---|---|---|
| `@tauri-apps/plugin-shell` | Nao apareceu uso JS. O uso ativo e Rust: `tauri-plugin-shell` em `src-tauri`. | Remover de `package.json` se nenhum import JS for introduzido. Manter crate Rust. |
| `@types/bcryptjs` | `bcryptjs` e usado em `SqliteUserRepository.ts`; pacote v3 tende a trazer tipos proprios. | Testar remocao com `npx tsc --noEmit`. |
| `@types/proj4` | `proj4` e usado em `lib/geo/reproject.ts` e script JS; tipos podem vir do pacote. | Testar remocao com `npx tsc --noEmit`. |

`proj4` e `bcryptjs` em si nao devem ser removidos: ambos possuem uso real.

---

## Candidatos que exigem revisao manual

| Item | Motivo |
|---|---|
| `src/domain/project/Project.ts` | `knip` apontou como unused, mas ha muitos tipos/projetos ativos em outros arquivos. Confirmar se este arquivo especifico foi substituido por `ProjectRepository.ts`/`ProjectStatus.ts`. |
| `src/infrastructure/persistence/sqlite/queries/inbox.ts` | Pode ter sido substituido por `inbox_view.ts`; validar historico antes de remover. |
| `src/infrastructure/persistence/sqlite/queries/ouvidoria.ts` | Pode ser catalogo antigo substituido por `manifestacoes.ts`; validar imports indiretos. |
| `src/lib/logger.ts` | `knip` marcou, mas `rg` encontrou uso em `app/view/page.client.tsx`. Provavel falso positivo por alias/config. Nao remover sem investigar. |

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
