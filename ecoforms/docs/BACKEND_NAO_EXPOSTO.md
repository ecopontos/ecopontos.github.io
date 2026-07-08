# Backend nao exposto

Data: 2026-07-08

## Estado atual

Este tracker registra lacunas entre capacidades do backend desktop e a superficie disponivel para a UI.

## Corrigido neste ciclo

- `registro_visualizacoes.id_usuario` e `registro_visualizacoes.modelo` agora fazem round-trip pelo `SqliteViewRegistryRepository` como `userId` e `isTemplate`.
- Os use cases de dashboard de modulo agora estao expostos em `container.views`:
  - `createModuleDashboard`
  - `updateModuleDashboard`
  - `deleteModuleDashboard`
  - `updateModuleDashboardWidgets`
  - `getModuleDashboardData`
- A UI desktop agora tem hooks de acesso em `useViews.ts`:
  - `useModuleDashboardMutations`
  - `useModuleDashboardData`

## Lacunas restantes conhecidas

- Os hooks novos ainda nao foram ligados a uma tela completa de composicao de dashboard de modulo. A camada de UI agora consegue chamar o backend, mas a experiencia visual de criar/editar dashboards ainda precisa ser desenhada.
- O CRUD de `ModuleVisualView` continua parcialmente exposto na UI: ha uso de `copyViewToPersonal`, mas criacao/edicao/remocao de views visuais ainda passam principalmente pela configuracao do modulo.

## Comandos Tauri sem UI direta

A matriz atual esta em `docs/backend/2026-07-07-tauri-command-matrix.md`. Naquele levantamento nao havia comandos classificados como `candidate-remove`; os comandos sem chamada direta de frontend foram classificados como internos ou reservados/documentados.
