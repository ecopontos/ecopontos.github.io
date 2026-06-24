# Status dos Gaps — ADRs 040–050 (veredito)

**RESOLVIDO: 50 · ABERTO: 2 · REVISAR: 0** — atualizado em 2026-06-01. Resta: 047.5 (controle de acesso transversal — adiado p/ revisão com testes) e 042.1 (race condition auto-confirm). Gaps não listados aqui seguem como abertos por padrão (são auditorias `Proposto`).


## ADR-040
- [x] **RESOLVIDO** — 1 SQL inline (SELECT usuarios)
    - padrão-problema `FROM usuarios`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 2 clienteRepository.save(as any)
    - padrão-problema `clienteRepository\.save`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 3 sem guard de capacidade
    - guard `slot.vagasOcupadas >= slot.capacidade` antes de confirmar (BookingModal.tsx:238-239)
- [x] **RESOLVIDO** — 4 fallback clienteId 'anon'
    - padrão-problema `clienteId:\s*['\"]anon`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 5 catch silencioso handleQuickCreate
    - função agora valida e expõe erro via `setQuickCreateError` + UI `{quickCreateError}` (BookingModal.tsx:174-187, 471-473)
- [x] **RESOLVIDO** — 6 agendamentoNotificacaoRepo na UI
    - padrão-problema `agendamentoNotificacaoRepo`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 7 useEffect sem cleanup
    - o `useEffect` que fazia fetch SQL foi removido (gap 1); restantes são resets de estado síncronos (BookingModal.tsx:96-114) — não exigem cleanup
- [x] **RESOLVIDO** — 9 formatDate sem timezone
    - `toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })` (BookingModal.tsx:640-642)
- [x] **RESOLVIDO** — 10 QuickCreate sem validação doc/tel
    - valida CPF/CNPJ (11/14 dígitos) e telefone (>=10) antes de salvar (BookingModal.tsx:177-186)

## ADR-041
- [x] **RESOLVIDO** — 1 SQL inline ProtocoloService
    - domínio agora depende de `ProximoProtocoloPort`; SQL movido p/ `SqliteProximoProtocoloAdapter` (infra)
- [x] **RESOLVIDO** — 1 SQL inline SlaCalculator
    - domínio agora depende de `TipoManifestacaoSlaPort`; SQL movido p/ `SqliteTipoManifestacaoSlaAdapter` (infra)
- [x] **RESOLVIDO** — 2 catch silencioso (132/170)
    - padrão-problema `catch\s*(\([^)]*\))?\s*\{\s*\}`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 3 catch aninhado encaminhamento
    - padrão-problema `catch\s*(\([^)]*\))?\s*\{\s*\}`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 5 DEFAULT_TIPOS hardcoded
    - dados+seed movidos p/ `SeedManifestacaoCatalogUseCase` (application); hook só lê e delega via `c.seedManifestacaoCatalog.execute()`
- [x] **RESOLVIDO** — 6 getContainerAsync sem cache
    - novo `useContainerAsync()` memoiza a Promise do container; `useManifestacaoMutations` usa o getter (19x)

## ADR-042
- [x] **RESOLVIDO** — 2 sem transação CreateBooking
    - `save(agendamento)`+`save(slot)` envoltos em `sqlite.transaction(...)`; efeitos (outbox) fora da transação
- [x] **RESOLVIDO** — 3 idempotência ConfirmarAgendamento
    - retry em agendamento já `confirmado` não lança; completa efeitos pendentes (task) via `aoConfirmar` reentrant
- [x] **RESOLVIDO** — 4 JSON parse silencioso rowToEntity
    - padrão-solução `console\.(error|warn).*dados_formulario|dados_formulario.*console`: 1 ocorrência(s)
- [x] **RESOLVIDO** — 6 catch silencioso regra abertura
    - `CreateServiceSlotUseCase`: catch agora loga e lança `Error('Regra de abertura do slot é inválida...')`
- [x] **RESOLVIDO** — 7 WhatsApp telefone não validado
    - padrão-solução `length\s*<\s*10|!.*[Tt]elefone\)\s*return`: 1 ocorrência(s)
- [x] **RESOLVIDO** — 8 comparação de datas por string
    - padrão-solução `new Date\(props\.dataFim\)`: 1 ocorrência(s)
- [x] **RESOLVIDO** — 9 sem paginação findAll slots
    - padrão-solução `LIMIT`: 1 ocorrência(s)
- [x] **RESOLVIDO** — 10 eslint-disable exhaustive-deps
    - `useServiceSlots`: deps extraídas p/ primitivos (`status`, `serviceTypeId`); `eslint-disable` removido
- [x] **RESOLVIDO** — 13 sem CHECK constraint status
    - padrão-solução `CHECK\s*\(\s*status`: 2 ocorrência(s)

## ADR-044
- [x] **RESOLVIDO** — 1 daysBack nas métricas
    - padrão-solução `metricsSummary\.execute\(\s*daysBack|metricsByUser\.execute\(\s*daysBack`: 2 ocorrência(s)
- [x] **RESOLVIDO** — 2 gráfico slice(-7) hardcoded
    - corrigido: `maxBars` derivado de `daysBack` + título dinâmico (TaskMetricsContent.tsx)
- [x] **RESOLVIDO** — 3 handlers em tasks/page
    - padrão-solução `onStatusChange`: 1 ocorrência(s)
- [x] **RESOLVIDO** — 4 onDelete sem confirmação
    - `KanbanBoard`: `window.confirm()` (quebrado no Tauri) trocado por `AlertDialog` com estado `deleteTargetId`
- [x] **RESOLVIDO** — 5 badge cancelado/solicitacao
    - corrigido: cases `solicitacao` e `cancelado` em `getStatusBadge` (TasksTableView.tsx)
- [x] **RESOLVIDO** — 6 imports mortos FolderKanban/ShieldCheck
    - padrão-problema `FolderKanban|ShieldCheck`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 8 formatDate sem ano
    - corrigido: inclui ano quando != ano atual via `getFullYear` (TasksTableView.tsx)
- [x] **RESOLVIDO** — 10 parseRecorrencia no componente
    - corrigido: extraída para função de módulo (fora do componente) em TasksTableView.tsx

## ADR-045
- [x] **RESOLVIDO** — 1 observacoes nunca persiste
    - `observacoes` presente no INSERT (linhas 188-195) e no UPDATE (175-183) de clientes (SqliteClienteRepository.ts)
- [x] **RESOLVIDO** — 3 window.confirm() (Tauri)
    - padrão-problema `window\.confirm`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 6 window.location.href
    - corrigido: `router.push("/clientes")` (next/navigation) em app/clientes/novo/page.tsx
- [x] **RESOLVIDO** — 16 as any em novo/page
    - `clientes/novo`: objeto `Cliente` tipado no save; cast do select para `"PF" | "PJ"`; catch tipado

## ADR-046
- [x] **RESOLVIDO** — 1 password_hash em localStorage
    - hash/sal removidos antes de persistir: `login/page.tsx` (destructure pós-verify) + sanitização defensiva em `AuthContext.login` antes de `setUser`/`localStorage`
- [x] **RESOLVIDO** — 3 syncSupabaseAuth auto-provisiona
    - `signUp` automático já removido em `AuthContext.tsx:45-47` (só `console.warn`) — veredito anterior estava desatualizado
- [x] **RESOLVIDO** — 4 console.log dados sensíveis
    - padrão-problema `console\.log`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 7 alert() no fluxo
    - `users/page.tsx` (4×) e `UserDialog.tsx` (2×) migrados para `toast.error` (sonner); Toaster já em ClientLayout
- [x] **RESOLVIDO** — 6 USUARIOS_POR_SETOR u.setor_id
    - JOIN corrigido p/ tabela de junção `usuarios_setores`; `GROUP BY s.id`, `COUNT(DISTINCT u.id)`

## ADR-047
- [x] **RESOLVIDO** — 1 setor_principal_id (code vs schema)
    - coluna existe no schema de runtime `scripts/ensure-columns.ts:169` (`usuarios.setor_principal_id`). O `schema_ddl.sql` é apenas um dump desatualizado — falso-positivo
- [x] **RESOLVIDO** — 2 pai_id (code vs schema)
    - coluna existe no schema de runtime `scripts/ensure-columns.ts:152` (`setores.pai_id`). `schema_ddl.sql` desatualizado — falso-positivo
- [ ] **ABERTO (adiado)** — 5 buildTaskAccessFilter/buildRecordAccessFilter sem callers
    - segurança transversal: exige JOIN `usuarios u_criador` + propagar userId/perfil/effectiveSectors por `ListTasksByProjectUseCase`→repo→hook. Adiado p/ revisão dedicada com testes (não enviar controle de acesso não verificado)

## ADR-048
- [x] **RESOLVIDO** — 1 UserWidgetInstanceRepository impl
    - `SqliteUserWidgetInstanceRepository` registrado no container (+ use cases `widgets.{add,update,remove}`). Bug de schema corrigido: coluna física é `id_usuario`, repo/InboundHandler usavam `user_id` (INSERT/SELECT quebravam)
- [x] **RESOLVIDO** — 2 registerWidget() chamado
    - `registerWidget\(`: 2 arquivo(s) (def + callers)
- [x] **RESOLVIDO** — 6 JsonEditor validação
    - já valida estrutura (`{ campos: [...] }`) além de sintaxe; título do alerta ajustado para "JSON inválido" (JsonEditor.tsx)
- [x] **RESOLVIDO** — 12 VisualEditor.tsx.backup existe
    - `VisualEditor.tsx.backup` não existe mais

## ADR-049
- [x] **RESOLVIDO** — 4 ArchiveModuleUseCase
    - criado `ArchiveModuleUseCase`, registrado em `modules.archive`, hook `useModules.archiveModule` + botão "Arquivar" (status=published) em admin/modules
- [x] **RESOLVIDO** — 5 ViewConfigDialog descarta config
    - `onSave` monta config completa (name, filters, columns, chart_type, category/value/aggregation, status_field) e propaga via `onSave(config)` (ViewConfigDialog.tsx:65-77)

## ADR-050
- [x] **RESOLVIDO** — 3 GetModuleVisuais usa ->> (PG)
    - padrão-problema `->>`: 0 ocorrência(s)
- [x] **RESOLVIDO** — 5 SqliteModuleRepository order col
    - padrão-solução `json_extract`: 1 ocorrência(s)
