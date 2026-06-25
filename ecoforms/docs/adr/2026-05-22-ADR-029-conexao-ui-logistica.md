# ADR-029 — Conexão UI do Módulo Logística: Preenchimento dos Gaps de Interface

- **Status**: Proposto
- **Data**: 2026-05-22
- **Autor**: Claude Code (auditoria de gaps entre backend e UI)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-008 (Módulo Logística — criação da base), ADR-014 (Adequação Arquitetural)

---

## Contexto

O módulo de Logística (Onda 4 — SDD) tem domínio, repositório SQLite, hooks de query/mutation e sync outbox **100% implementados**. Porém, apenas **56% das operações** (14 de 25) estão expostas na interface de usuário. Onze funcionalidades têm backend completo mas nenhum componente React que as invoque.

### Gaps confirmados por auditoria de código

| # | Funcionalidade | Backend | Hook/Mutation | UI | Arquivo afetado |
|---|---------------|---------|--------------|----|-----------------|
| 1 | Excluir roteiro | `deleteRoteiro(id)` | `removeRoteiro` exportado | ❌ | `page.tsx`, `RoteiroDetailPage.tsx` |
| 2 | Reordenar clientes | `updateClienteOrdem(...)` | `updateClienteOrdem` exportado | ❌ | `RoteiroDetailPage.tsx:152-166` |
| 3 | Alterar status da execução | `updateExecucaoStatus(...)` | `updateExecucaoStatus` exportado | ❌ | `RoteiroDetailPage.tsx:170-239` |
| 4 | Excluir execução | `deleteExecucao(id)` | `removeExecucao` exportado | ❌ | `RoteiroDetailPage.tsx:170-239` |
| 5 | Atribuir motorista/ajudante/veículo/KM | `saveExecucao(exec)` com todos os campos | `saveExecucao` exportado | ❌ (só envia `dataExecucao`) | `RoteiroDetailPage.tsx:69-80` |
| 6 | Iniciar/Finalizar coleta | `updateExecucaoStatus` com `fimEm` | `updateExecucaoStatus` exportado | ❌ | — |
| 7 | Evidências no checklist (foto/GPS) | `completeChecklistItem(id, ..., evidenciaUrl, lat, lng)` | `completeChecklistItem` exportado | ❌ (só envia `id, 'user-1'`) | `RoteiroDetailPage.tsx:93-101` |
| 8 | GPS/localização nas intercorrências | `Intercorrencia` tem `latitude`, `longitude`, `endereco`, `tipoResiduoId`, `quantidade` | `saveIntercorrencia` exportado | ❌ (só envia tipo + descricao) | `RoteiroDetailPage.tsx:288-303` |
| 9 | Dashboard / Analytics (5 queries) | `queries/logistica.ts` registradas no `QUERY_CATALOG` | Nenhum hook dedicado | ❌ | — |
| 10 | Filtro avançado de execuções | `ExecucaoFilter` suporta `dataInicio`, `dataFim`, `motoristaId` | `useExecucoes(filter)` aceita | ❌ (UI só filtra por status) | `page.tsx:19` |
| 11 | Select de motorista/ajudante | — | — | ❌ | — |

### Impacto funcional

- **Execuções são criadas como "agendada" e nunca progridem** — o painel de Histórico fica permanentemente vazio porque `updateExecucaoStatus` nunca é chamado
- **Sem rastreabilidade de campo** — motorista, veículo, KM e horários de início/fim existem no banco mas nunca são preenchidos
- **Checklist sem evidências** — impossível anexar foto ou registrar coordenadas no momento da conferência
- **Intercorrências sem georreferenciamento** — incidentes de campo não têm localização
- **Zero visibilidade gerencial** — 5 queries de dashboard prontas sem nenhum componente visual

---

## Decisão

Preencher todos os gaps de UI no módulo Logística, em 8 fases ordenadas por dependência e criticidade. Nenhuma alteração é necessária no backend — apenas componentes React que consomem hooks e mutations já existentes.

---

## Fase 1 — Exclusão de roteiro (15 min)

**Arquivos**: `RoteiroDetailPage.tsx`, `page.tsx`

### 1.1 Botão na listagem principal

Em `page.tsx`, adicionar coluna "Ações" na tabela de roteiros com botão deletar:

- Linha 68: adicionar `<TableHead>Ações</TableHead>` após `Situação`
- Linhas 79-95: adicionar `<TableCell>` com `<Button variant="ghost" size="sm">` + ícone `Trash2`
- Chamar `removeRoteiro(id)` (precisa destruturar do hook — não está sendo destruturado atualmente)
- Confirmar com `confirm("Excluir roteiro?")` antes de executar
- Após exclusão, `refetch()` da lista

### 1.2 Botão na página de detalhe

Em `RoteiroDetailPage.tsx`:
- Destruturar `removeRoteiro` do hook (linha 26)
- Adicionar botão de exclusão no header (linha 104-119) com `window.confirm` e redirecionamento via `router.push('/logistica')`

---

## Fase 2 — Reordenar clientes no roteiro (30 min)

**Arquivo**: `RoteiroDetailPage.tsx`

### 2.1 Destruturar `updateClienteOrdem`

Linha 26: adicionar `updateClienteOrdem` na desestruturação de `useLogisticsMutations()`.

### 2.2 Campos de ordem editáveis

Na tabela de clientes (linhas 148-166), substituir a exibição estática de `ordem` por:
- Input numérico (`type="number"`) com valor `c.ordem`
- Botões de seta para cima/baixo (`ArrowUp`/`ArrowDown` do lucide)
- `onChange`/`onClick` chamam `updateClienteOrdem(roteiroId, c.clienteId, novaOrdem)` com debounce ou no blur
- Reordenar localmente o array `clientesRoteiro` após mutação bem-sucedida para feedback instantâneo

---

## Fase 3 — Atribuição de motorista, ajudante, veículo e KM na criação da execução (1h)

**Arquivo**: `RoteiroDetailPage.tsx`

### 3.1 Expandir formulário de nova execução

O bloco atual (linhas 177-183) só tem `<Input type="date">`. Expandir para:

```
┌─ Nova Execução ──────────────────────────────────────────────────┐
│  Data: [____/____/______]                                        │
│  Motorista: [____________________▼]  (select de usuários)        │
│  Ajudante:  [____________________▼]  (select de usuários)        │
│  Veículo:   [____________________]    (input texto)              │
│  KM Inicial:[________]                                            │
│  Observações: [________________________________________]         │
│                                                                  │
│  [Salvar]  [Cancelar]                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Hook de usuários para selects

Criar `useUsuarios()` ou reutilizar hook existente para popular dropdowns de motorista/ajudante. Verificar se já existe em `src/interface/hooks/queries/`.

### 3.3 Alterar `handleAddExecucao`

Linhas 69-80: expandir o objeto passado para `saveExecucao` incluindo `motoristaId`, `ajudanteId`, `veiculo`, `kmInicial`, `observacoes`.

---

## Fase 4 — Controle de status da execução (1h)

**Arquivo**: `RoteiroDetailPage.tsx`

### 4.1 Destruturar `updateExecucaoStatus` e `removeExecucao`

Linha 26: adicionar à desestruturação.

### 4.2 Botões de transição de status

Na tabela de execuções (linhas 188-237), adicionar coluna "Ações" com botões condicionais baseados no status atual:

| Status atual | Ações disponíveis |
|---|---|
| `agendada` | **[Iniciar]** [Excluir] |
| `em_andamento` | **[Concluir]** [Cancelar] |
| `concluida` | [Excluir] |
| `cancelada` | [Excluir] |

- **Iniciar**: `updateExecucaoStatus(e.id, 'em_andamento')` + registrar `inicioEm: new Date().toISOString()`
- **Concluir**: `updateExecucaoStatus(e.id, 'concluida', new Date().toISOString())`
- **Cancelar**: `updateExecucaoStatus(e.id, 'cancelada')`
- **Excluir**: `removeExecucao(e.id)` com confirmação

Todas as ações devem chamar `refetchExecucoes()` após sucesso para atualizar historico e status na tabela.

---

## Fase 5 — Evidências no checklist (foto + observação) (45 min)

**Arquivo**: `RoteiroDetailPage.tsx` — componente `ChecklistPanel`

### 5.1 Modal de conclusão

Substituir o toggle direto (linhas 384) por um diálogo/modal ao marcar um item:

```
┌─ Concluir Item ──────────────────────────────────────────────────┐
│  Item: "Verificar contentor padrão"                              │
│                                                                  │
│  Observação: [________________________________________]          │
│  Foto:       [Escolher arquivo]  📎                              │
│  (GPS será capturado automaticamente se disponível)              │
│                                                                  │
│  [Confirmar conclusão]  [Cancelar]                               │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Alterar `handleToggleChecklist`

Linhas 93-101: em vez de chamar `completeChecklistItem` diretamente, abrir modal. Ao confirmar:
```typescript
await completeChecklistItem(item.id, 'user-1', observacao, evidenciaUrl, latitude, longitude);
```

### 5.3 GPS

- Tentar `navigator.geolocation.getCurrentPosition()` no momento da conclusão
- Se não disponível (desktop), omitir lat/lng — campos são opcionais no backend
- Exibir indicador "GPS: 12.345, -67.890" quando disponível

### 5.4 Upload de evidência

- Usar `<input type="file" accept="image/*" capture="environment">`
- Converter para data URL ou usar file picker do Tauri para salvar localmente
- Armazenar caminho/URL no campo `evidenciaUrl`

---

## Fase 6 — Localização e campos extras nas intercorrências (30 min)

**Arquivo**: `RoteiroDetailPage.tsx` — componente `IntercorrenciasPanel`

### 6.1 Expandir formulário de registro

O formulário atual (linhas 317-321) só tem tipo e descrição. Adicionar:

```
┌─ Registrar Intercorrência ───────────────────────────────────────┐
│  Tipo:         [____________________▼]  (select do catálogo)     │
│  Descrição:    [________________________________________]        │
│  Endereço:     [________________________________________]        │
│  Latitude:     [________]  Longitude: [________]  [📍 Capturar]  │
│                                                                  │
│  [Registrar]                                                     │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Alterar `handleAdd`

Linhas 289-304: incluir `latitude`, `longitude`, `endereco` no objeto enviado para `saveIntercorrencia`.

### 6.3 Botão de captura de localização

Adicionar botão "📍 Capturar" que chama `navigator.geolocation.getCurrentPosition()` e preenche lat/lng.

---

## Fase 7 — Filtros avançados na listagem de execuções (30 min)

**Arquivos**: `page.tsx`, hooks de queries

### 7.1 Filtros na aba Execuções (página principal)

Em `page.tsx`, acima da tabela de execuções (linha 105), adicionar barra de filtros:

```
┌─ Filtros ────────────────────────────────────────────────────────┐
│  Roteiro: [Todos ▼]  Status: [Todos ▼]  Data início: [__/__/__] │
│  Data fim: [__/__/__]  Motorista: [Todos ▼]                     │
│  [Aplicar] [Limpar filtros]                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Hook `useExecucoes` com filtro expandido

O hook `useExecucoes` (em `queries/useLogistics.ts:51`) já aceita `ExecucaoFilter` completo (`roteiroId`, `status`, `dataInicio`, `dataFim`, `motoristaId`). O repositório `SqliteLogisticsRepository.findAllExecucoes` já implementa todos esses filtros com queries parametrizadas.

Apenas conectar o estado React dos filtros ao parâmetro `filter` da chamada `useExecucoes(filter)`.

### 7.3 Select de roteiros e motoristas

- Select de roteiros: já existe `useRoteiros()` (sem filtro) — usar para popular dropdown
- Select de motoristas: reutilizar hook de usuários da Fase 3

---

## Fase 8 — Dashboard / Analytics (2h)

**Arquivos novos**: `app/logistica/dashboard/page.tsx`, `components/logistica/`

### 8.1 Página de dashboard

Criar rota `/logistica/dashboard` com:

```
┌─ Dashboard de Logística ─────────────────────────────────────────┐
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ 12 Roteiros  │  │ 45 Execuções │  │ 8 Pendentes  │           │
│  │   (8 ativos) │  │  (32 concl.) │  │  (2 andam.)  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌─ Roteiros por Status (bar chart) ────────────────────────────┐│
│  │  ████████████ ativo (8)                                       ││
│  │  ████ inativo (3)                                             ││
│  │  ██ suspenso (1)                                              ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Execuções por Roteiro (table) ──────────────────────────────┐│
│  │  Roteiro          Total   Concluídas   Última execução       ││
│  │  Centro           15      12            22/05/2026            ││
│  │  Zona Norte       10      8             21/05/2026            ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Intercorrências por Tipo (pie/horizontal bar) ──────────────┐│
│  │  Acesso negado:    5                                          ││
│  │  Contaminação:     3                                          ││
│  │  Veículo quebrado: 1                                          ││
│  └───────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Tendência Mensal (line chart) ──────────────────────────────┐│
│  │  Jan: 12  Fev: 15  Mar: 18  Abr: 14  Mai: 20                 ││
│  └───────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Execução das queries de analytics

As 5 queries (`ROTEIROS_POR_STATUS`, `EXECUCOES_RESUMO`, `EXECUCOES_POR_ROTEIRO`, `INTERCORRENCIAS_POR_TIPO`, `EXECUCOES_TENDENCIA_MENSAL`) estão definidas em `queries/logistica.ts` e registradas no `QUERY_CATALOG` em `queries/index.ts:205-209`.

Criar hook `useLogisticsDashboard` que:
1. Obtém `SqlitePort` do container
2. Executa cada query via `sqlitePort.all(sql, params)`
3. Retorna dados formatados por gráfico

### 8.3 Visualização

Usar `recharts` (já presente no projeto) para gráficos:
- `BarChart` para roteiros por status e intercorrências por tipo
- `LineChart` para tendência mensal
- `Card` components para KPIs numéricos

Ou, se não houver biblioteca de gráficos instalada, usar barras horizontais em CSS puro (divs coloridas com width proporcional) — abordagem zero-dependência.

### 8.4 Navegação

Adicionar link "Dashboard" na página principal (`page.tsx`) e no sidebar (`AppSidebar.tsx`).

---

## Resumo de Estimativas

| Fase | Descrição | Tempo |
|------|-----------|-------|
| Fase 1 | Exclusão de roteiro | 15 min |
| Fase 2 | Reordenar clientes | 30 min |
| Fase 3 | Atribuição motorista/ajudante/veículo/KM | 1h |
| Fase 4 | Controle de status da execução | 1h |
| Fase 5 | Evidências no checklist (foto + obs) | 45 min |
| Fase 6 | Localização nas intercorrências | 30 min |
| Fase 7 | Filtros avançados de execuções | 30 min |
| Fase 8 | Dashboard / Analytics | 2h |
| **Total** | | **~6,5h (1 dia)** |

---

## Arquivos Modificados

| Arquivo | Fases | Tipo de alteração |
|---------|-------|-------------------|
| `app/logistica/page.tsx` | 1, 7 | Adicionar coluna "Ações" (deletar roteiro), barra de filtros de execução |
| `app/logistica/roteiros/[id]/RoteiroDetailPage.tsx` | 1, 2, 3, 4, 5, 6 | Múltiplas adições: botão deletar, ordem editável, formulário expandido, status buttons, modal checklist, campos intercorrência |
| `app/logistica/dashboard/page.tsx` | 8 | **Novo arquivo** — página de dashboard |
| `src/interface/hooks/queries/useLogisticsDashboard.ts` | 8 | **Novo arquivo** — hook de analytics |
| `components/layout/AppSidebar.tsx` | 8 | Adicionar item "Dashboard Logística" |

---

## O que NÃO muda

- `LogisticsRepository` (domínio) — sem alterações
- `SqliteLogisticsRepository` — sem alterações
- Todos os hooks de query existentes (`useRoteiros`, `useExecucoes`, `useChecklistByExecucao`, etc.) — sem alterações
- `useLogisticsMutations` — sem alterações (já exporta todas as funções necessárias)
- `schema_ddl.sql` / `ensure-columns.ts` — sem alterações
- Sync outbox / `HandlerRegistry` — sem alterações
- Estrutura de rotas existentes (`/logistica`, `/logistica/roteiros/novo`, `/logistica/roteiros/[id]`)

---

## Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| **Select de usuários inexistente** — não há hook para listar usuários como motoristas/ajudantes | Média | Verificar se `useUsuarios` ou similar existe; se não, criar query SQL direta ou reutilizar hook de `usuarios` existente no módulo Admin |
| **Biblioteca de gráficos ausente** — recharts pode não estar instalada | Baixa | Usar gráficos CSS puro (barras horizontais com width %) como fallback zero-dependência |
| **Geolocalização no desktop** — `navigator.geolocation` pode não estar disponível em Tauri | Baixa | Campos de lat/lng são opcionais; exibir input manual como fallback; botão "Capturar" só aparece se API disponível |
| **Upload de foto no desktop** — Tauri tem API diferente do browser para file system | Média | Usar Tauri `dialog.open()` para selecionar arquivo e `convertFileSrc()` para preview; fallback para `<input type="file">` |
| **Usuário hardcoded 'user-1'** — várias chamadas usam string fixa | Baixa | Fora do escopo deste ADR (resolver com ADR de sessão/autenticação); manter 'user-1' como fallback |

---

## Critérios de Aceitação

1. Roteiro pode ser excluído com confirmação, tanto da listagem quanto da página de detalhe
2. Ordem de clientes no roteiro pode ser alterada via input numérico ou botões up/down
3. Nova execução aceita motorista (select), ajudante (select), veículo, KM inicial e observações
4. Execução "agendada" pode ser iniciada (status → `em_andamento`)
5. Execução "em_andamento" pode ser concluída (status → `concluida`, `fimEm` registrado)
6. Execução pode ser cancelada a partir de qualquer status ativo
7. Execução pode ser excluída com confirmação
8. Histórico de status exibe entradas reais após transições (não mais vazio)
9. Ao concluir item de checklist, modal permite adicionar observação e anexar foto
10. Registro de intercorrência aceita endereço, latitude e longitude
11. Botão "Capturar localização" preenche coordenadas GPS quando disponível
12. Aba "Execuções" da página principal tem filtros por roteiro, status, data início/fim e motorista
13. Página `/logistica/dashboard` exibe 5 visualizações de dados (KPI cards, roteiros por status, execuções por roteiro, intercorrências por tipo, tendência mensal)
14. Todas as queries de analytics retornam dados corretos do SQLite
15. Nenhuma regressão nas funcionalidades já conectadas (CRUD roteiro, vínculo de clientes, checklist básico, intercorrências básicas)
