# ADR-014 — Adequação Arquitetural: Consolidação de Acesso a Dados e Paridade Mobile/Desktop

- **Status**: **Implementado (parcial)** (Fase A concluída 2026-05-21)
- **Data**: 2026-05-19 (revisado 2026-05-20)
- **Autor**: Engenharia reversa assistida (Claude Code)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito (aprovação do time) → Implementado (critérios de aceitação verificados por `grep`) → Supersedido
- **Relacionados**: ADR-009 (RBAC), ADR-010 (Module Registry), ADR-013 (ManifestacaoStateMachine), ADR-017 (Unified Service Engine)
- **Aviso**: ADR-009, ADR-010 e ADR-013 são referenciados mas não existem em `docs/adr/` — criar retroativamente ou substituir pela referência ao arquivo de código relevante.

---

## Contexto

Uma auditoria de consistência identificou quatro gaps entre a arquitetura intencionada (Clean Architecture + DDD) e o código em produção. Os gaps criam riscos operacionais e dívida técnica acumulável:

### Gap 1 — `useSqlite` direto em 67 ocorrências (crítico)

O CLAUDE.md estabelece que componentes e páginas devem consumir dados exclusivamente via use cases do DI container, nunca via hooks raw (`useSQLiteQuery`, `useSQLiteMutation`, `useSqlite`). Na prática, 67 ocorrências em `components/`, `app/`, `contexts/` e hooks de utilidade acessam o banco diretamente pelo hook, contornando toda a camada de domínio e aplicação.

**Risco**: regras de negócio ficam espalhadas em componentes React; mudanças de schema exigem busca em toda a base; testes unitários não conseguem isolar lógica de negócio.

### Gap 2 — Mobile não consome `ecoforms-core`

`packages/core/` contém as implementações canônicas de `EventEnvelope`, `CryptoLayer`, `stableStringify` e `ConflictResolver` em TypeScript. O mobile (`mobile/`) não declara `ecoforms-core` como dependência — o `mobile/package.json` não referencia o pacote compartilhado. A estrutura `mobile/www/js/sync/` (mencionada em versões anteriores deste ADR) não existe mais; o mobile atual usa Capacitor + SQLite nativo sem sync protocol compartilhado.

**Risco**: divergência silenciosa de protocolo de sync — evento gerado pelo mobile pode ser incompatível com o handler do desktop sem falha explícita.

### Gap 3 — Domínio task com rotas fragmentadas

O domínio task tem representação em dois caminhos de rota sem sobreposição completa:
- `/tasks` — lista tabular + `/tasks/metrics`
- `/tarefas/[id]` — detalhe da tarefa

Nenhum dos dois caminhos tem a experiência completa (lista + detalhe + métricas).

**Risco**: UX inconsistente; lógica de navegação duplicada; manutenção de dois entry points para o mesmo domínio.

### Gap 4 — Email sintético `{username}@ecoforms.local`

O campo `email` real não existe na tabela `usuarios`. O Supabase Auth recebe um email fabricado como workaround. Isso impede funcionalidades futuras (recuperação de senha real, notificações por email, auditoria de identidade).

**Risco**: o workaround virou permanente por ausência de decisão explícita; qualquer feature de notificação precisará de retrabalho.

---

## Decisão

Adotar um plano de adequação em três fases, priorizando por severidade de risco.

---

## Fases de Adequação

### Fase A — Paridade Mobile/Desktop (risco de protocolo)

**Escopo**: apontar o mobile para `ecoforms-core` em vez de manter cópias JS.

**Ações**:
1. Configurar Capacitor para suportar bundle ES module ou transpilação de `ecoforms-core`
2. Implementar sync protocol no mobile usando `packages/core/` como dependência compartilhada
3. Adicionar `ecoforms-core` em `mobile/package.json` com path workspace

**Critério de aceitação**: `mobile/package.json` declara `ecoforms-core` como dependência; mobile consome `EventEnvelope`, `ConflictResolver` e `stableStringify` do pacote compartilhado; testes de integração cruzada passam (evento gerado pelo mobile é decodificado pelo desktop sem erro).

---

### Fase B — Consolidação de acesso a dados no desktop (risco arquitetural)

**Escopo**: eliminar `useSqlite` direto de componentes de negócio.

**Estratégia**: não reescrever tudo de uma vez — priorizar por domínio, usando a classificação abaixo.

**Classificação dos 67 usos**:

| Prioridade | Critério | Ação |
|---|---|---|
| Alta | Componente encapsula lógica de negócio (cálculo, regra, workflow) | Extrair para use case + repositório |
| Média | Componente é leitura simples para exibição | Extrair para query hook usando use case existente |
| Baixa | Página de debug/admin/inspector | Manter `useSqlite` direto — acesso irrestrito ao schema é o propósito |

**Regra documentada no CLAUDE.md** *(concluído 2026-05-20)*:
> Componentes em `components/` e `app/` NUNCA importam `useSqlite`, `useSQLiteQuery` ou `useSQLiteMutation` diretamente, exceto arquivos sob `app/admin/inspector/` e `app/debug/`.

**Critério de aceitação**: `grep -r 'useSqlite\b' components/ app/` retorna zero resultados fora das exceções listadas.

**Coordenação com ADR-016**: a refatoração de `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` (parte desta Fase B) deve ser executada em conjunto com ADR-016 — as duas iniciativas alteram a mesma página e devem compor um único PR para o domínio `ouvidoria`.

---

### Fase C — Unificação de rotas do domínio task

**Escopo**: consolidar `/tasks` e `/tarefas` em uma única rota coerente.

**Decisão de rota**:
- Manter `/tasks` como rota canônica (mais genérica, sem acentuação)
- Adicionar `/tasks/[id]` para detalhe
- Redirecionar `/tarefas/[id]` → `/tasks/[id]` via `next.config.js` redirect (preserva bookmarks/links existentes)
- Mover `/tasks/metrics` para aba dentro de `/tasks`

**Critério de aceitação**: um único entry point por operação; `/tarefas` retorna 301 para `/tasks`; nenhuma funcionalidade perdida.

---

### Fase D — Decisão sobre email real de usuário (workaround → decisão explícita)

Este gap exige decisão de produto antes de implementação técnica.

**Opção 1 — Adicionar campo `email` real**
- Adicionar coluna `email TEXT` em `usuarios` (database.rs + ensure-columns.ts)
- Atualizar tela de cadastro de usuário (`UserDialog`) para capturar email
- Migrar Supabase Auth para usar email real
- Habilita: recuperação de senha, notificações

**Opção 2 — Aceitar email sintético como permanente**
- Documentar explicitamente que `{username}@ecoforms.local` é o identificador Supabase
- Remover a nota "temporário" do CLAUDE.md
- Bloquear qualquer feature que dependa de email real até decisão futura

**Recomendação**: Opção 1, executada junto com uma funcionalidade que já precise de email (ex: notificações de manifestação ou recuperação de senha).

---

## Consequências

### Positivas
- Componentes React voltam a ser testáveis em isolamento
- Mudanças de schema SQLite são localizadas nos repositórios
- Protocolo de sync tem implementação canônica única
- Navegação do usuário consistente no domínio task

### Negativas / Custos
- Fase B exige refatoração incremental de 67 pontos — risco de regressão se feita sem testes de cobertura prévia
- Fase A requer validação de compatibilidade do bundler Capacitor com ES modules do workspace
- Fase C exige atualização de links internos e testes de navegação

### Não muda
- A arquitetura Clean Architecture existente no `src/` permanece como está — este ADR não propõe novos padrões, apenas elimina desvios dos padrões já decididos
- RBAC enforcement no Rust (desktop) e frontend-only (mobile) permanece — é uma limitação da plataforma, não um gap arquitetural
- `admin/inspector` e `debug` continuam com acesso direto ao banco — são ferramentas de diagnóstico, não de negócio

---

## Ordem de execução recomendada (atualizada 2026-05-20)

A sequência foi ajustada após análise de dependências cruzadas entre ADRs:

| Ordem | Iniciativa | Detalhamento | Bloqueia |
|---|---|---|---|
| 1 | **ADR-014 Fase B (ouvidoria) + ADR-016** | Executados juntos em **1 PR único** — ambos alteram `ManifestacaoDetailPage.tsx` (~1464 linhas); separar causaria conflito de merge e testes duplicados | Entrega no domínio `ouvidoria` |
| 2 | **ADR-014 Fase B (demais domínios)** | Incremental, **um domínio por vez** (agendamento, task, formulários, etc.). Prioridade por risco arquitetural (lógica de negócio em componentes → primeiro) | Entrega no domínio sob refatoração |
| 3 | **ADR-015** | Após conclusão da Fase B nos domínios de **agendamento** (consome `useFormTemplate` e `DynamicFormEditor`, que só existem quando o acesso a dados está limpo) | — |
| 4 | **ADR-014 Fase C (rotas task)** | **Independente**, pode rodar em paralelo com as Fases B desde que não toque em páginas de task sob refatoração | — |
| 5 | **ADR-014 Fase A + Fase D** | **Diferidos** até decisão de produto — Fase A requer spike de bundler Capacitor + ES modules; Fase D requer escolha entre Opção 1 (email real) ou Opção 2 (sintético permanente). Nenhum dos dois é técnico puro | — |
| 6 | **ADR-017** | **Diferir indefinidamente** até requisito concreto de unificação de serviços surgir. Não é pré-requisito de nenhum dos itens acima | — |

### Regras de coordenação

- **Fase B por domínio**: quando um domínio entra em refatoração, novas features nele são bloqueadas. O domínio é "congelado" até `grep -r 'useSqlite\b' app/<dominio>/` retornar zero.
- **ADR-016 integrado**: o workflow da ouvidoria (ADR-016) é parte da Fase B do domínio ouvidoria — não um trabalho separado.
- **ADR-015 não antecipa**: o motor de agendamento depende de componentes de agendamento já refatorados (sem `useSqlite` direto). Tentar implementar ADR-015 antes da Fase B de agendamento duplicaria trabalho.
- **Fase C paralela**: a unificação de rotas task (Fase C) não depende de limpeza de `useSqlite` nas rotas — é uma mudança estrutural de URL e componente. Pode rodar simultaneamente à Fase B de outros domínios.
- **Fases A e D**: são os únicos itens que exigem decisão de produto. Enquanto isso, permanecem no backlog com status "Aguardando spike/decisão".
- **ADR-017**: permanece como "radical but not urgent" — se nunca for necessário, pode ser arquivado sem custo.
