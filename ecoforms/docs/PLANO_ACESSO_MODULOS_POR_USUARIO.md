# Plano — Acesso seletivo a módulos por usuário (ADR-063)

> Status: **proposto** · 2026-06-13 · aplicar no Windows ([[ecoforms-build-constraints]])
> Decisões do produto: **(1) escopo unificado** (módulos dinâmicos + páginas fixas),
> **(2) role como base + override por usuário**, **(3) matriz CRUD completa**.

## Índice

**Visão geral**
- [1. Estado atual (auditado)](#1-estado-atual-auditado)
- [2. Modelo-alvo](#2-modelo-alvo)
- [3. Mudanças de schema](#3-mudanças-de-schema)
- [4. Resolver de permissão](#4-resolver-de-permissão-camada-de-aplicação)
- [5. Enforcement](#5-enforcement)
- [6. Admin UI](#6-admin-ui)
- [7. Sync & auditoria](#7-sync--auditoria-convenções-do-claudemd)
- [8. Riscos / guardas](#8-riscos--guardas)
- [9. Faseamento sugerido](#9-faseamento-sugerido)

**Detalhamento por fase**
- [10. F1 — schema + seed](#10-detalhamento-da-f1-schema--seed) · DDL, `permissoes_modulos_usuario`, seed dos 18 system modules, matriz `can_view`
- [11. F2 — resolver + runtime](#11-detalhamento-da-f2-resolver--runtime) · `ModuleAccessResolver`, métodos do repo, `loadRuntimeDto` (nova aridade), hooks
- [12. F3 — sidebar data-driven + guards](#12-detalhamento-da-f3-sidebar-data-driven--guards-de-rota) · flag, sidebar híbrida, `ModuleAccessGuard`, `/modulo/[slug]`
- [13. F4 — UI admin (override por usuário)](#13-detalhamento-da-f4-ui-admin--override-por-usuário) · `/admin/users/[id]/acesso`, grade tri-state, anti-lockout
- [14. F5 — sync + auditoria](#14-detalhamento-da-f5-sync--auditoria) · eventos `module.perm.user.*`, handler inbound, `log_audit`
- [15. F6 — enforcement Rust (opcional)](#15-detalhamento-da-f6-enforcement-no-rust--endurecimento-opcional) · `module_set_user_permission`, proteção das tabelas
- [16. Recapitulação de sequência](#16-recapitulação-de-sequência)

> **Caminho rápido:** MVP = **F1 → F2 → F4** · Unificação = **F3** · Robustez = **F5 → F6**.
> Checklists de aceite ao fim de cada §10–§15.

## 1. Estado atual (auditado)

| Peça | Hoje |
|---|---|
| Permissão de módulo | **por perfil**: `permissoes_modulos (module_id, profile, can_view/create/edit/approve/delete, PK(module_id,profile))` |
| Resolução runtime | `SqliteModuleRepository.loadRuntimeDto(slug, userProfile)` → acha row do perfil; **default tudo-false** se não houver |
| Bloqueio `/modulo/[slug]` | **NÃO bloqueia** com `can_view=false` — só esconde botões (`ModuloPageClient`). **Gap.** |
| Sidebar | `useModules('published')` lista **todos** os módulos publicados **sem filtrar permissão**; itens fixos hardcoded com `HideForRole`/`ShowForManager` |
| Páginas fixas | Logística/Clientes/Agendamentos/Manifestações/… gateadas só por role guards, fora da matriz de módulos |
| Backend | Rust `SessionState` revalida commands protegidos **por perfil**; `db_execute` sanitiza tabelas sensíveis |
| Admin UI | `ModuleWizard` edita matriz **por perfil** (bug: usa perfil `'gestor'` inexistente; reais = gerente/coordenador/encarregado/operador/campo) |

**Conclusão:** acesso é por role, a navegação ignora a matriz, e não há override por usuário nem bloqueio efetivo de rota.

## 2. Modelo-alvo

Acesso resolvido como **matriz efetiva por (usuário, módulo)**:

```
efetivo[flag] = override_usuario[flag] != NULL ? override_usuario[flag]
                                               : permissao_perfil[flag]   (default 0)
admin → tudo true (curto-circuito)
```

- **Baseline por perfil** = `permissoes_modulos` (mantém-se).
- **Override por usuário** = nova tabela tri-state (NULL=herda, 1=concede, 0=revoga) por flag CRUD.
- **Unificado**: páginas fixas viram "módulos de sistema" no mesmo `registro_modulos`, navegação 100% data-driven.

## 3. Mudanças de schema

> Tudo em `scripts/ensure-columns.ts` (fonte única) + replicar em `docs/db/schema_consolidado_corrigido.sql`.

### 3.1 Tornar `registro_modulos` capaz de descrever páginas fixas
```sql
ALTER TABLE registro_modulos ADD COLUMN tipo  TEXT DEFAULT 'dynamic'; -- 'dynamic' | 'system'
ALTER TABLE registro_modulos ADD COLUMN route TEXT;                    -- NULL → /modulo/{slug}
ALTER TABLE registro_modulos ADD COLUMN grupo TEXT;                    -- agrupamento da sidebar
```

### 3.2 Override por usuário (tri-state)
```sql
CREATE TABLE IF NOT EXISTS permissoes_modulos_usuario (
    module_id     TEXT NOT NULL REFERENCES registro_modulos(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES usuarios(id)         ON DELETE CASCADE,
    can_view      INTEGER,   -- NULL=herda perfil | 0=revoga | 1=concede
    can_create    INTEGER,
    can_edit      INTEGER,
    can_approve   INTEGER,
    can_delete    INTEGER,
    atualizado_em  TEXT,
    atualizado_por TEXT,
    PRIMARY KEY (module_id, user_id)
);
```

### 3.3 Seed de módulos de sistema (comportamento idêntico ao de hoje)
Inserir em `registro_modulos` (`tipo='system'`, `status='published'`, `route`, `grupo`) os itens fixos da sidebar e popular `permissoes_modulos` espelhando os `HideForRole` atuais — assim **ninguém perde acesso no dia 1**:

| slug (system) | route | grupo | perfis com can_view (espelha hoje) |
|---|---|---|---|
| inicio | / | Operacional | todos |
| tarefas | /kanban | Operacional | todos |
| minhas-solicitacoes | /minhas-solicitacoes | Operacional | todos exceto operador |
| demandas | /demandas | Operacional | todos |
| tarefas-campo | /minhas-tarefas-campo | Operacional | exceto admin/gerente |
| form-builder | /forms | Gestão | exceto operador |
| data-registry | /data-registry | Gestão | exceto operador |
| analise | /analysis | Gestão | exceto operador |
| remocao | /remocao | Gestão | exceto operador |
| projetos | /projects | Gestão | exceto operador |
| clientes | /clientes | Relacionamento | exceto operador/campo |
| manifestacoes | /manifestacoes | Relacionamento | exceto operador/campo |
| logistica | /logistica | Relacionamento | exceto operador/campo |
| agendamentos | /agendamentos | Relacionamento | exceto operador/campo |
| historico | /history | Relacionamento | exceto operador/campo |
| galeria, metricas, admin/* | … | Administração | admin/gerente |

## 4. Resolver de permissão (camada de aplicação)

Nova função única `resolveModulePermissions(moduleId, userId, userProfile)` em `SqliteModuleRepository`
(ou novo `application/permissions/ModuleAccessResolver.ts`):

1. admin → retorna tudo-true.
2. lê `permissoes_modulos` do perfil (default 0).
3. lê `permissoes_modulos_usuario` do (module,user); para cada flag, override `!= NULL` vence.

Reusada por:
- `loadRuntimeDto(slug, userId, userProfile)` — **mudar assinatura** p/ receber `userId` (hoje só `userProfile`). Atualizar `GetModuleRuntimeUseCase` + `useModuleRuntime` (passar `user?.id`).
- Nova `listAccessibleModules(userId, profile)` — devolve módulos (system+dynamic) com `efetivo.can_view=true`, com `route`/`grupo`/`ordem`, para a sidebar.

## 5. Enforcement

1. **Sidebar (data-driven)** — substituir itens hardcoded + `useModules('published')` por `useAccessibleModules()`, renderizando por `grupo` na ordem. Remove os `HideForRole`/`ShowForManager` da navegação (a matriz passa a ser a fonte). Isto entrega o objetivo "unificado".
2. **Guard de rota** — `<ModuleAccessGuard>` em `app/modulo/[slug]` (bloqueia + redireciona quando `can_view=false`, **fecha o gap atual**) e um check no layout para rotas de sistema (mapeia `pathname → módulo.route → efetivo.can_view`).
3. **Backend (Rust)** — sub-trilha: commands protegidos hoje validam por perfil; estender para consultar a matriz efetiva (override por usuário) nas mutações sensíveis de módulo. Baseline = enforcement no frontend + sanitização existente do `db_execute`; enforcement Rust completo é incremento posterior.

## 6. Admin UI

- **Manter** matriz por perfil no `ModuleWizard`/`EditModuleClient` (baseline) e **corrigir** o seed `'gestor'` → perfis reais de `tbl_perfis`.
- **Novo**: aba "Acesso a módulos" em `/admin/users/[id]` — lista todos os módulos com a permissão **efetiva resolvida** + controle tri-state (Herda / Permitir / Negar) por flag CRUD. Entrada mais natural para "definir quais usuários acessam quais módulos".
- Atalho espelhado a partir do módulo: "Exceções por usuário".

## 7. Sync & auditoria (convenções do CLAUDE.md)

- `permissoes_modulos_usuario` e novas colunas precisam de handler no `EventSyncAdapter`/`HandlerRegistry`.
- `log_audit()` em todo grant/revoke (actor, módulo, usuário, antes/depois) → também emite `audit.registro` na fila de sync.

## 8. Riscos / guardas

- **Auto-lockout**: impedir que o usuário revogue o próprio acesso; admin sempre bypassa.
- **Refactor da sidebar** é o maior risco (toca navegação inteira). Mitigar: registrar módulos de sistema + resolver atrás de flag, manter sidebar atual até validar paridade 1:1 com o seed.
- **Mobile** (Capacitor, `mobile/www/`) é RBAC frontend-only e codebase separado — fora de escopo; acesso a módulos lá é independente.
- **Default seguro**: `permissoes_modulos` sem row = tudo-false; garantir seed completo antes de ligar o enforcement na navegação para não "sumir" módulos.

## 9. Faseamento sugerido

| Fase | Entrega | Esforço |
|---|---|---|
| F1 | Schema: colunas `tipo/route/grupo` + `permissoes_modulos_usuario` + seed system modules espelhando hoje | M |
| F2 | `ModuleAccessResolver` + ajustar `loadRuntimeDto`/`useModuleRuntime` | M |
| F3 | `useAccessibleModules` + sidebar data-driven (atrás de flag) + `ModuleAccessGuard` | G |
| F4 | Admin: aba "Acesso a módulos" por usuário (tri-state) + fix perfil `gestor` | M |
| F5 | Sync handler + auditoria de grant/revoke | M |
| F6 | (Opcional) enforcement Rust por usuário nas mutações sensíveis | G |

Ordem de valor: **F1→F2→F4** já entrega override por usuário nos módulos dinâmicos com UI;
**F3** entrega o "unificado" (páginas fixas + nav data-driven); **F5/F6** endurecem.

---

# 10. Detalhamento da F1 (schema + seed)

> Tudo em `scripts/ensure-columns.ts` (fonte única) + replicar em
> `docs/db/schema_consolidado_corrigido.sql`. `database.rs` é query-only — sem DDL lá.
> Perfis reais (tabela `perfis`): **admin, gerente, coordenador, encarregado, operador, campo**.
> A tabela de perfis chama-se `perfis` (não `tbl_perfis`); corrigir referências no plano e no `ModuleWizard` (`'gestor'` → `'gerente'`).

## 10.1 ALTER em `registro_modulos`

Seguir o **guard de coluna** já usado no arquivo (ADD COLUMN idempotente / try-catch
por coluna — não recriar a tabela):

```sql
ALTER TABLE registro_modulos ADD COLUMN tipo  TEXT NOT NULL DEFAULT 'dynamic';  -- 'dynamic' | 'system'
ALTER TABLE registro_modulos ADD COLUMN route TEXT;                              -- NULL → /modulo/{slug}
ALTER TABLE registro_modulos ADD COLUMN grupo TEXT;                              -- grupo da sidebar
```

Colunas existentes relevantes (não mudam): `id, slug, nome, descricao, tipo_entidade,
icon, color, prefix, ordem, status, versao, configuracao, config_suite,
criado_em, atualizado_em, publicado_em`.

## 10.2 Nova tabela `permissoes_modulos_usuario`

```sql
CREATE TABLE IF NOT EXISTS permissoes_modulos_usuario (
    module_id      TEXT NOT NULL REFERENCES registro_modulos(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES usuarios(id)         ON DELETE CASCADE,
    can_view       INTEGER,   -- tri-state: NULL=herda perfil | 0=revoga | 1=concede
    can_create     INTEGER,
    can_edit       INTEGER,
    can_approve    INTEGER,
    can_delete     INTEGER,
    atualizado_em  TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_por TEXT,
    PRIMARY KEY (module_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pmu_user ON permissoes_modulos_usuario(user_id);
```

Regra do resolver: `efetivo[flag] = override[flag] IS NOT NULL ? override[flag] : perfil[flag]` (default 0); admin → tudo 1.

## 10.3 Matriz `can_view` dos módulos de sistema (espelha o `AppSidebar` atual)

> Objetivo: **paridade 1:1** com os `HideForRole`/`ShowForManager` de hoje → ninguém muda de acesso no dia 1.

| id | slug | route | grupo | ordem | admin | gerente | coord | encarreg | operador | campo |
|---|---|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| sys-inicio | inicio | / | Operacional | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| sys-tarefas | tarefas | /kanban | Operacional | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| sys-minhas-solicitacoes | minhas-solicitacoes | /minhas-solicitacoes | Operacional | 2 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-demandas | demandas | /demandas | Operacional | 3 | 1 | 1 | 1 | 1 | 1 | 1 |
| sys-tarefas-campo | tarefas-campo | /minhas-tarefas-campo | Operacional | 4 | **0** | **0** | 1 | 1 | 1 | 1 |
| sys-form-builder | form-builder | /forms | Gestão | 10 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-data-registry | data-registry | /data-registry | Gestão | 11 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-analise | analise | /analysis | Gestão | 12 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-remocao | remocao | /remocao | Gestão | 13 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-projetos | projetos | /projects | Gestão | 14 | 1 | 1 | 1 | 1 | **0** | 1 |
| sys-clientes | clientes | /clientes | Relacionamento | 20 | 1 | 1 | 1 | 1 | **0** | **0** |
| sys-manifestacoes | manifestacoes | /manifestacoes | Relacionamento | 21 | 1 | 1 | 1 | 1 | **0** | **0** |
| sys-logistica | logistica | /logistica | Relacionamento | 22 | 1 | 1 | 1 | 1 | **0** | **0** |
| sys-agendamentos | agendamentos | /agendamentos | Relacionamento | 23 | 1 | 1 | 1 | 1 | **0** | **0** |
| sys-historico | historico | /history | Relacionamento | 24 | 1 | 1 | 1 | 1 | **0** | **0** |
| sys-galeria | galeria | /gallery | Administração | 30 | 1 | 1 | **0** | **0** | **0** | **0** |
| sys-metricas | metricas | /tasks?tab=metricas | Administração | 31 | 1 | 1 | **0** | **0** | **0** | **0** |
| sys-admin | administracao | /admin | Administração | 32 | 1 | 1 | **0** | **0** | **0** | **0** |

Notas de paridade:
- Grupo **Gestão** hoje é `HideForRole roles={["operador"]}` → **campo VÊ** Gestão (comportamento atual preservado; sinalizar p/ revisão se indevido).
- Grupo **Administração** = `ShowForManager` (admin+gerente). `/admin` cobre todos os `/admin/*` com um único guard de rota; sub-itens podem virar módulos próprios depois.
- O fixo **`/agendamentos`** (slug `agendamentos`) é distinto do módulo dinâmico já semeado `agendamento` (`/modulo/agendamento`) — sem colisão de slug.
- Demais flags CRUD dos módulos de **sistema**: na F1 só `can_view` é consumido pela navegação; CRUD das páginas fixas continua sob o `usePermissions` legado. Por isso o seed grava `can_create/edit/approve/delete = can_view` apenas para **admin**, e `0` para os demais (evita implicar restrição/poder falso). Migração fina de CRUD das fixas é trilha posterior.

## 10.4 Seed — `registro_modulos` (tipo='system')

```sql
INSERT OR IGNORE INTO registro_modulos
    (id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem, status, versao, configuracao, config_suite, tipo, route, grupo, criado_em, atualizado_em, publicado_em)
VALUES
    ('sys-inicio','inicio','Início',NULL,'sistema',NULL,NULL,'',0,'published',1,'{}',NULL,'system','/','Operacional',datetime('now'),datetime('now'),datetime('now')),
    ('sys-tarefas','tarefas','Tarefas',NULL,'sistema',NULL,NULL,'',1,'published',1,'{}',NULL,'system','/kanban','Operacional',datetime('now'),datetime('now'),datetime('now')),
    ('sys-minhas-solicitacoes','minhas-solicitacoes','Minhas Solicitações',NULL,'sistema',NULL,NULL,'',2,'published',1,'{}',NULL,'system','/minhas-solicitacoes','Operacional',datetime('now'),datetime('now'),datetime('now')),
    ('sys-demandas','demandas','Demandas',NULL,'sistema',NULL,NULL,'',3,'published',1,'{}',NULL,'system','/demandas','Operacional',datetime('now'),datetime('now'),datetime('now')),
    ('sys-tarefas-campo','tarefas-campo','Tarefas de Campo',NULL,'sistema',NULL,NULL,'',4,'published',1,'{}',NULL,'system','/minhas-tarefas-campo','Operacional',datetime('now'),datetime('now'),datetime('now')),
    ('sys-form-builder','form-builder','Form Builder',NULL,'sistema',NULL,NULL,'',10,'published',1,'{}',NULL,'system','/forms','Gestão',datetime('now'),datetime('now'),datetime('now')),
    ('sys-data-registry','data-registry','Data Registry',NULL,'sistema',NULL,NULL,'',11,'published',1,'{}',NULL,'system','/data-registry','Gestão',datetime('now'),datetime('now'),datetime('now')),
    ('sys-analise','analise','Análise',NULL,'sistema',NULL,NULL,'',12,'published',1,'{}',NULL,'system','/analysis','Gestão',datetime('now'),datetime('now'),datetime('now')),
    ('sys-remocao','remocao','Remoção',NULL,'sistema',NULL,NULL,'',13,'published',1,'{}',NULL,'system','/remocao','Gestão',datetime('now'),datetime('now'),datetime('now')),
    ('sys-projetos','projetos','Projetos',NULL,'sistema',NULL,NULL,'',14,'published',1,'{}',NULL,'system','/projects','Gestão',datetime('now'),datetime('now'),datetime('now')),
    ('sys-clientes','clientes','Clientes',NULL,'sistema',NULL,NULL,'',20,'published',1,'{}',NULL,'system','/clientes','Relacionamento',datetime('now'),datetime('now'),datetime('now')),
    ('sys-manifestacoes','manifestacoes','Manifestações',NULL,'sistema',NULL,NULL,'',21,'published',1,'{}',NULL,'system','/manifestacoes','Relacionamento',datetime('now'),datetime('now'),datetime('now')),
    ('sys-logistica','logistica','Logística',NULL,'sistema',NULL,NULL,'',22,'published',1,'{}',NULL,'system','/logistica','Relacionamento',datetime('now'),datetime('now'),datetime('now')),
    ('sys-agendamentos','agendamentos','Agendamentos',NULL,'sistema',NULL,NULL,'',23,'published',1,'{}',NULL,'system','/agendamentos','Relacionamento',datetime('now'),datetime('now'),datetime('now')),
    ('sys-historico','historico','Histórico',NULL,'sistema',NULL,NULL,'',24,'published',1,'{}',NULL,'system','/history','Relacionamento',datetime('now'),datetime('now'),datetime('now')),
    ('sys-galeria','galeria','Galeria',NULL,'sistema',NULL,NULL,'',30,'published',1,'{}',NULL,'system','/gallery','Administração',datetime('now'),datetime('now'),datetime('now')),
    ('sys-metricas','metricas','Métricas',NULL,'sistema',NULL,NULL,'',31,'published',1,'{}',NULL,'system','/tasks?tab=metricas','Administração',datetime('now'),datetime('now'),datetime('now')),
    ('sys-admin','administracao','Administração',NULL,'sistema',NULL,NULL,'',32,'published',1,'{}',NULL,'system','/admin','Administração',datetime('now'),datetime('now'),datetime('now'));
```

## 10.5 Seed — `permissoes_modulos` (baseline por perfil)

> `can_create/edit/approve/delete` = `can_view` só para **admin**; demais perfis recebem só `can_view` (CRUD das fixas fica no legado — ver 10.3).
> `INSERT OR IGNORE` preserva ajustes manuais já feitos.

```sql
-- admin: pode tudo em tudo
INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
SELECT id, 'admin', 1,1,1,1,1 FROM registro_modulos WHERE tipo='system';

-- can_view por perfil (1 linha por par módulo×perfil onde view=1; CRUD=0)
INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete) VALUES
  -- Operacional (todos os perfis exceto onde marcado)
  ('sys-inicio','gerente',1,0,0,0,0),('sys-inicio','coordenador',1,0,0,0,0),('sys-inicio','encarregado',1,0,0,0,0),('sys-inicio','operador',1,0,0,0,0),('sys-inicio','campo',1,0,0,0,0),
  ('sys-tarefas','gerente',1,0,0,0,0),('sys-tarefas','coordenador',1,0,0,0,0),('sys-tarefas','encarregado',1,0,0,0,0),('sys-tarefas','operador',1,0,0,0,0),('sys-tarefas','campo',1,0,0,0,0),
  ('sys-minhas-solicitacoes','gerente',1,0,0,0,0),('sys-minhas-solicitacoes','coordenador',1,0,0,0,0),('sys-minhas-solicitacoes','encarregado',1,0,0,0,0),('sys-minhas-solicitacoes','campo',1,0,0,0,0), -- operador: SEM row (view=0)
  ('sys-demandas','gerente',1,0,0,0,0),('sys-demandas','coordenador',1,0,0,0,0),('sys-demandas','encarregado',1,0,0,0,0),('sys-demandas','operador',1,0,0,0,0),('sys-demandas','campo',1,0,0,0,0),
  ('sys-tarefas-campo','coordenador',1,0,0,0,0),('sys-tarefas-campo','encarregado',1,0,0,0,0),('sys-tarefas-campo','operador',1,0,0,0,0),('sys-tarefas-campo','campo',1,0,0,0,0), -- admin/gerente: SEM row
  -- Gestão (todos exceto operador)
  ('sys-form-builder','gerente',1,0,0,0,0),('sys-form-builder','coordenador',1,0,0,0,0),('sys-form-builder','encarregado',1,0,0,0,0),('sys-form-builder','campo',1,0,0,0,0),
  ('sys-data-registry','gerente',1,0,0,0,0),('sys-data-registry','coordenador',1,0,0,0,0),('sys-data-registry','encarregado',1,0,0,0,0),('sys-data-registry','campo',1,0,0,0,0),
  ('sys-analise','gerente',1,0,0,0,0),('sys-analise','coordenador',1,0,0,0,0),('sys-analise','encarregado',1,0,0,0,0),('sys-analise','campo',1,0,0,0,0),
  ('sys-remocao','gerente',1,0,0,0,0),('sys-remocao','coordenador',1,0,0,0,0),('sys-remocao','encarregado',1,0,0,0,0),('sys-remocao','campo',1,0,0,0,0),
  ('sys-projetos','gerente',1,0,0,0,0),('sys-projetos','coordenador',1,0,0,0,0),('sys-projetos','encarregado',1,0,0,0,0),('sys-projetos','campo',1,0,0,0,0),
  -- Relacionamento (admin/gerente/coordenador/encarregado)
  ('sys-clientes','gerente',1,0,0,0,0),('sys-clientes','coordenador',1,0,0,0,0),('sys-clientes','encarregado',1,0,0,0,0),
  ('sys-manifestacoes','gerente',1,0,0,0,0),('sys-manifestacoes','coordenador',1,0,0,0,0),('sys-manifestacoes','encarregado',1,0,0,0,0),
  ('sys-logistica','gerente',1,0,0,0,0),('sys-logistica','coordenador',1,0,0,0,0),('sys-logistica','encarregado',1,0,0,0,0),
  ('sys-agendamentos','gerente',1,0,0,0,0),('sys-agendamentos','coordenador',1,0,0,0,0),('sys-agendamentos','encarregado',1,0,0,0,0),
  ('sys-historico','gerente',1,0,0,0,0),('sys-historico','coordenador',1,0,0,0,0),('sys-historico','encarregado',1,0,0,0,0),
  -- Administração (só gerente além do admin já inserido pelo SELECT acima)
  ('sys-galeria','gerente',1,0,0,0,0),
  ('sys-metricas','gerente',1,0,0,0,0),
  ('sys-admin','gerente',1,0,0,0,0);
```
> Para `sys-galeria`/`sys-metricas`/`sys-admin`: só `admin` (via `SELECT`) e `gerente` têm `can_view` — nenhum outro perfil recebe row.

## 10.6 Backfill de módulos dinâmicos existentes

Módulos já existentes (ex.: `mod-agendamento`) recebem `tipo='dynamic'` pelo DEFAULT da coluna — nada a fazer. `route` permanece NULL → navegação usa `/modulo/{slug}`.

## 10.7 Checklist de aceite da F1

- [ ] `registro_modulos` tem `tipo/route/grupo`; dinâmicos antigos com `tipo='dynamic'`, `route=NULL`.
- [ ] `permissoes_modulos_usuario` criada + índice por `user_id`.
- [ ] 18 system modules semeados (`tipo='system'`, `status='published'`).
- [ ] `SELECT profile,count(*)` em `permissoes_modulos` para `tipo='system'` bate com a matriz 10.3.
- [ ] Replicado em `docs/db/schema_consolidado_corrigido.sql`.
- [ ] `ModuleWizard` default `'gestor'` → `'gerente'`.
- [ ] Nenhuma mudança de comportamento da sidebar (enforcement só entra na F3).

---

# 11. Detalhamento da F2 (resolver + runtime)

> Objetivo: uma **única** função que combina baseline-por-perfil + override-por-usuário,
> reusada por `loadRuntimeDto` e por `listAccessibleModules`. Sem enforcement de UI ainda
> (isso é F3) — F2 só corrige a **resolução** e expõe os dados.

## 11.1 Tipos de domínio (`src/domain/module/ModuleRegistry.ts`)

```ts
// flags efetivas (booleans resolvidos)
export interface CrudFlags {
  can_view: boolean; can_create: boolean; can_edit: boolean; can_approve: boolean; can_delete: boolean;
}

// override por usuário: tri-state (null = herda do perfil)
export type CrudOverride = { [K in keyof CrudFlags]: boolean | null };

// item para navegação data-driven (F3)
export interface AccessibleModule {
  id: string; slug: string; name: string;
  icon: string | null; route: string | null; grupo: string | null;
  ordem: number; tipo: 'dynamic' | 'system';
  permissions: CrudFlags;   // efetivas para o usuário
}
```

Estender `ModuleRegistry` e `ModuleRuntimeDto` com os 3 campos novos
(`tipo: 'dynamic'|'system'`, `route: string | null`, `grupo: string | null`) e mapear
em `rowToModule` (`SqliteModuleRepository`), adicionando ao `ModuleRow`:
`tipo: string; route: string | null; grupo: string | null;`.

## 11.2 Resolver puro (`src/application/permissions/ModuleAccessResolver.ts` — novo)

```ts
import type { CrudFlags, CrudOverride } from '@/src/domain/module/ModuleRegistry';

const ALL_FALSE: CrudFlags = { can_view:false, can_create:false, can_edit:false, can_approve:false, can_delete:false };
const ALL_TRUE:  CrudFlags = { can_view:true,  can_create:true,  can_edit:true,  can_approve:true,  can_delete:true  };
const FLAGS = Object.keys(ALL_FALSE) as (keyof CrudFlags)[];

/** efetivo[flag] = override != null ? override : perfil (default 0); admin → tudo true. */
export function resolveEffective(
  profilePerm: CrudFlags | undefined,
  override: CrudOverride | undefined,
  isAdmin: boolean,
): CrudFlags {
  if (isAdmin) return { ...ALL_TRUE };
  const base = profilePerm ?? ALL_FALSE;
  const out = { ...base };
  if (override) for (const f of FLAGS) if (override[f] !== null && override[f] !== undefined) out[f] = override[f]!;
  return out;
}

export const isAdminProfile = (p: string | null | undefined) => p === 'admin';
```

> Decisão: `admin` por **string de perfil** (curto-circuito), coerente com `usePermissions.normalizeRole`. Não depende de override.

## 11.3 Repositório — novos métodos (`SqliteModuleRepository` + interface)

Acrescentar à interface `ModuleRepository`:

```ts
getUserOverride(moduleId: string, userId: string): Promise<CrudOverride | null>;
getUserOverridesByUser(userId: string): Promise<Array<{ module_id: string } & CrudOverride>>;
setUserOverride(moduleId: string, userId: string, ov: CrudOverride, actorId: string): Promise<void>;
listAccessibleModules(userId: string, userProfile: string): Promise<AccessibleModule[]>;
// MUDA assinatura:
loadRuntimeDto(slug: string, userId: string, userProfile: string): Promise<ModuleRuntimeDto | null>;
```

Implementação (mapas tri-state: `1→true, 0→false, NULL→null`):

```ts
private toOverride(r: Record<string, number|null>): CrudOverride {
  const m = (v: number|null) => v === null || v === undefined ? null : v === 1;
  return { can_view:m(r.can_view), can_create:m(r.can_create), can_edit:m(r.can_edit), can_approve:m(r.can_approve), can_delete:m(r.can_delete) };
}

async getUserOverride(moduleId, userId) {
  const rows = await this.db.query(`SELECT can_view,can_create,can_edit,can_approve,can_delete
    FROM permissoes_modulos_usuario WHERE module_id=? AND user_id=? LIMIT 1`, [moduleId, userId]);
  return rows[0] ? this.toOverride(rows[0]) : null;
}

async setUserOverride(moduleId, userId, ov, actorId) {
  const allNull = Object.values(ov).every(v => v === null);
  const b = (v: boolean|null) => v === null ? null : (v ? 1 : 0);
  if (allNull) {                                   // “Herda” em tudo → remove a row
    await this.db.execute(`DELETE FROM permissoes_modulos_usuario WHERE module_id=? AND user_id=?`, [moduleId, userId]);
  } else {
    await this.db.execute(
      `INSERT INTO permissoes_modulos_usuario (module_id,user_id,can_view,can_create,can_edit,can_approve,can_delete,atualizado_em,atualizado_por)
       VALUES (?,?,?,?,?,?,?,datetime('now'),?)
       ON CONFLICT(module_id,user_id) DO UPDATE SET
         can_view=excluded.can_view, can_create=excluded.can_create, can_edit=excluded.can_edit,
         can_approve=excluded.can_approve, can_delete=excluded.can_delete,
         atualizado_em=excluded.atualizado_em, atualizado_por=excluded.atualizado_por`,
      [moduleId, userId, b(ov.can_view), b(ov.can_create), b(ov.can_edit), b(ov.can_approve), b(ov.can_delete), actorId]);
  }
  // F5: log_audit(actorId, 'module.perm.override', 'permissoes_modulos_usuario', moduleId, ...)
}
```

`loadRuntimeDto` passa a resolver via `resolveEffective`:

```ts
async loadRuntimeDto(slug, userId, userProfile) {
  const mod = await this.findBySlug(slug);
  if (!mod) return null;
  const profilePerm = (await this.getPermissions(mod.id)).find(p => p.profile === userProfile);
  const override   = await this.getUserOverride(mod.id, userId);
  const perms = resolveEffective(profilePerm, override ?? undefined, isAdminProfile(userProfile));
  // ...resto igual, usando `perms` no lugar do antigo userPerm...
}
```

`listAccessibleModules` — **3 queries + combinação em memória** (sem N+1):

```ts
async listAccessibleModules(userId, userProfile) {
  const mods = await this.findAll('published');                                   // já ordena por ordem
  const perfilRows = await this.db.query(`SELECT module_id,can_view,can_create,can_edit,can_approve,can_delete
      FROM permissoes_modulos WHERE profile=?`, [userProfile]);
  const ovRows = await this.db.query(`SELECT module_id,can_view,can_create,can_edit,can_approve,can_delete
      FROM permissoes_modulos_usuario WHERE user_id=?`, [userId]);
  const perfilMap = new Map(perfilRows.map(r => [r.module_id, /*→CrudFlags*/]));
  const ovMap     = new Map(ovRows.map(r => [r.module_id, this.toOverride(r)]));
  const admin = isAdminProfile(userProfile);
  return mods
    .map(m => ({ ...m, permissions: resolveEffective(perfilMap.get(m.id), ovMap.get(m.id), admin) }))
    .filter(m => m.permissions.can_view)
    .map(m => ({ id:m.id, slug:m.slug, name:m.name, icon:m.icon, route:m.route, grupo:m.grupo, ordem:m.ordem, tipo:m.tipo, permissions:m.permissions }));
}
```

## 11.4 Use cases + container

- `GetModuleRuntimeUseCase.execute(slug, userId, userProfile)` — repassa os 3 args.
- Novo `ListAccessibleModulesUseCase.execute(userId, userProfile)` → `repo.listAccessibleModules(...)`.
- Novo `SetModulePermissionOverrideUseCase.execute(moduleId, userId, ov, actorId)` (para a UI da F4).
- Wiring em `ModuleContainerModule.ts` no objeto `modules`:
  ```ts
  getRuntime: new GetModuleRuntimeUseCase(moduleRepository),
  listAccessible: new ListAccessibleModulesUseCase(moduleRepository),     // novo
  setUserOverride: new SetModulePermissionOverrideUseCase(moduleRepository), // novo
  ```

## 11.5 Hooks de interface

- **Mudar** `useModuleRuntime(slug, perfil)` → `useModuleRuntime(slug, userId, perfil)`; dep array `[slug, userId, perfil]`; guard `if (!slug || !perfil) ...` mantém (userId pode ser exigido também).
  - Único caller: `app/modulo/[slug]/ModuloPageClient.tsx:27` → `useModuleRuntime(slug, user?.id, user?.perfil)`.
- **Novo** `useAccessibleModules()` (consumido na F3 pela sidebar):
  ```ts
  export function useAccessibleModules() {
    const { user } = useAuth();
    const [modules, setModules] = useState<AccessibleModule[]>([]);
    // getContainerAsync → c.modules.listAccessible.execute(user.id, user.perfil)
  }
  ```

## 11.6 Ripple / compat

- `loadRuntimeDto` muda de aridade (2→3). Callers: só `GetModuleRuntimeUseCase` (use case) e, indireto, `useModuleRuntime`. Atualizar ambos. `grep -rn "loadRuntimeDto\|getRuntime.execute" desktop/` antes de fechar.
- `ModuleRow`/`rowToModule` ganham `tipo/route/grupo` — `SELECT *` já traz as colunas novas após a F1; sem mudança de query.
- Nada de SQL inline novo fora do repositório (mantém a convenção [[SQL_INLINE_AUDIT]] — queries no repo, não nos hooks). Para **lookups triviais de UI** (dropdowns de perfis/módulos/rotas) preferir estender `src/interface/hooks/queries/lookups.ts` em vez de criar hook novo em `catalog/`: é a fachada vigente pós-refactor P3 (`c2b7aba` + 16 commits da sessão 2026-06-13) e respeita a regra `no-restricted-imports` que bloqueia `src/infrastructure/**` direto na UI. A fachada agora cobre ~50 funções imperativas; use-cases com `db: SqlitePort` no construtor importam `QueryDef` direto do catalog.

## 11.7 Checklist de aceite da F2

- [ ] `ModuleAccessResolver` com testes do tri-state (herda/concede/revoga) + admin curto-circuito.
- [ ] `loadRuntimeDto` resolve override; `/modulo/[slug]` reflete permissão efetiva (ex.: revogar `can_create` de 1 usuário esconde botão **só** para ele).
- [ ] `listAccessibleModules` retorna system+dynamic com `can_view` efetivo, ordenado por `ordem`, sem N+1.
- [ ] `useModuleRuntime` e `ModuloPageClient` passam `user.id`.
- [ ] Container expõe `listAccessible` e `setUserOverride`.
- [ ] Comportamento da sidebar **inalterado** (ainda não migrada — F3).

---

# 12. Detalhamento da F3 (sidebar data-driven + guards de rota)

> Objetivo: a **visibilidade** na navegação e o **acesso à rota** passam a vir da matriz
> efetiva (F2), não mais de `HideForRole`/`ShowForManager`. Enforcement de UI + bloqueio
> de rota. **Atrás de flag** até validar paridade 1:1 com o seed da F1.

## 12.0 Flag de rollout

`NEXT_PUBLIC_FEATURE_MODULE_ACCESS` (ou row em `configuracoes`). Off → comportamento atual
(guards estáticos). On → sidebar e guard data-driven. Permite ligar em homolog e reverter sem deploy.

## 12.1 Abordagem da sidebar: **híbrida** (recomendada)

Renderizador 100% genérico esbarra em detalhes ricos que **devem** ser preservados:
ícones (lucide ≠ string no DB), badge de pendências em *Tarefas* (`pendingCount`), e o
submenu colapsável de *Administração* (`/admin/*`). Logo:

- **Inclusão/visibilidade** vem da F2: `const access = useAccessibleModules();` → `const can = (slug) => access.some(m => m.slug === slug);`
- **Apresentação** (ícone, badge, submenu) continua em código, **keyed por slug**.
- Trocar cada `HideForRole`/`ShowForManager` por `can('<slug>')`:

```tsx
const { modules: access } = useAccessibleModules();
const can = (slug: string) => access.some(m => m.slug === slug);
// ...
{can('minhas-solicitacoes') && <NavItem href="/minhas-solicitacoes" .../>}
{can('tarefas-campo')       && <NavItem href="/minhas-tarefas-campo" .../>}

{/* Grupo Gestão: mostrar se houver QUALQUER item visível */}
{['form-builder','data-registry','analise','remocao','projetos'].some(can) && (
  <NavGroup title="Gestão" ...>
    {can('form-builder')  && <NavItem href="/forms" .../>}
    {/* ... */}
  </NavGroup>
)}
{/* idem Relacionamento e Administração (gate por can('galeria')||can('metricas')||can('administracao')) */}
```

Ícones dos módulos de sistema (DB tem `icon=NULL`) via mapa local:

```ts
const SLUG_ICON: Record<string, React.ElementType> = {
  inicio: Home, tarefas: KanbanSquare, 'minhas-solicitacoes': Inbox, demandas: Send,
  'tarefas-campo': HardHat, 'form-builder': FileText, 'data-registry': Database,
  analise: BarChart3, remocao: Package, projetos: FolderKanban, clientes: Users,
  manifestacoes: MessageSquareWarning, logistica: Box, agendamentos: Calendar,
  historico: History, galeria: ImageIcon, metricas: LineChart, administracao: Shield,
};
```

**Grupo "Módulos" (dinâmicos)** — substituir `useModules('published')` por
`access.filter(m => m.tipo === 'dynamic')` (já filtrado por `can_view` efetivo, ordenado):

```tsx
{access.filter(m => m.tipo === 'dynamic').length > 0 && (
  <NavGroup title="Módulos" ...>
    {access.filter(m => m.tipo === 'dynamic').map(mod => (
      <ModuleNavItem key={mod.slug} href={`/modulo/${mod.slug}`} icon={mod.icon || undefined} label={mod.name} .../>
    ))}
  </NavGroup>
)}
```

> Resultado: paridade visual com hoje, mas a **fonte da verdade** de quem vê o quê passa a ser a matriz. Itens fixos não acessíveis simplesmente não entram em `access`.

### (Opcional, stretch) renderizador totalmente genérico
Agrupar `access` por `grupo`, ordenar por `ordem`, render `NavGroup`/`NavItem` em loop.
Exige resolver badge/submenu de forma declarativa (ex.: coluna `meta JSON` no módulo).
Recomendo só após a híbrida estável.

## 12.2 `ModuleAccessGuard` — bloqueio de rotas fixas

Ponto de injeção único: `ClientLayout` envolve `{children}` em `SidebarMain`. Inserir o guard ali:

```tsx
<SidebarMain>
  <ModuleAccessGuard>{children}</ModuleAccessGuard>
</SidebarMain>
```

Precisamos do conjunto de **todas** as rotas gerenciadas (não só as acessíveis) para
distinguir "rota gerenciada e proibida" de "rota não gerenciada". Duas opções:

- (A) novo `listManagedRoutes()` no repo: `SELECT slug, route, tipo FROM registro_modulos WHERE status='published' AND route IS NOT NULL`.
- (B) reusar o cálculo do resolver para a rota atual via `canAccessRoute(userId, profile, pathname)`.

Recomendo **(A)** + cruzar com `useAccessibleModules()` no cliente:

```tsx
function ModuleAccessGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { routes } = useManagedRoutes();          // [{slug, route}] de sistema, todas
  const { modules: access, loading: accLoading } = useAccessibleModules();
  const enabled = process.env.NEXT_PUBLIC_FEATURE_MODULE_ACCESS === 'true';

  // rota gerenciada = match de prefixo mais longo (query string ignorada)
  const match = useMemo(() => {
    if (!enabled) return null;
    const path = pathname.split('?')[0];
    return routes
      .filter(r => r.route === '/' ? path === '/' : (path === r.route || path.startsWith(r.route + '/')))
      .sort((a, b) => b.route.length - a.route.length)[0] ?? null;
  }, [routes, pathname, enabled]);

  const allowed = !match || access.some(m => m.slug === match.slug);

  useEffect(() => {
    if (!enabled || loading || accLoading) return;
    if (user && match && !allowed) {
      console.warn(`🚫 acesso negado à rota gerenciada: ${pathname} (módulo ${match.slug})`);
      router.replace('/');
    }
  }, [enabled, loading, accLoading, user, match, allowed, pathname, router]);

  if (enabled && match && !allowed && !loading && !accLoading) return null; // evita flash
  return <>{children}</>;
}
```

Regras de matching cobertas pelo seed da F1:
- `/` casa **exato** (senão tudo casaria com `/`).
- `/admin` cobre todos os `/admin/*` (um único `sys-admin`); `/admin/agendamentos` resolve para `/admin` (prefixo mais longo), **não** para `/agendamentos`.
- `/tasks?tab=metricas` → strip query → casa `/tasks` (sys-metricas).
- Rotas **não** gerenciadas (ex.: `/perfil`, `/login`, `/clientes/[id]` filhos herdam de `/clientes`) → `match=null` → libera.

## 12.3 `/modulo/[slug]` (dinâmicos)

Não precisa do guard de rota: `ModuloPageClient` já carrega o runtime com permissão
**efetiva** (F2). Basta bloquear quando `!can_view` — fecha o gap atual:

```tsx
if (!moduleData) return /* "não encontrado" (como hoje) */;
if (!moduleData.permissions.can_view) {
  return <AcessoNegado />; // ou router.replace('/')
}
```

## 12.4 Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `components/layout/AppSidebar.tsx` | `useAccessibleModules` + `can(slug)`; `SLUG_ICON`; grupo Módulos via `access`; remove `HideForRole`/`ShowForManager` da nav (sob flag) |
| `components/ClientLayout.tsx` | envolve children com `<ModuleAccessGuard>` |
| `components/auth/ModuleAccessGuard.tsx` | **novo** |
| `src/interface/hooks/queries/useAccessibleModules.ts` | **novo** (F2) |
| `src/interface/hooks/queries/useManagedRoutes.ts` | **novo** (`listManagedRoutes`) |
| `app/modulo/[slug]/ModuloPageClient.tsx` | bloqueio `!can_view` |
| repo/use case/container | `listManagedRoutes` + use case |

## 12.5 Riscos / decisões

- **Fail-open vs fail-closed**: em erro transitório de query da matriz, **fail-open** (não bloqueia) — F3 é defesa-em-profundidade no front; enforcement real é F6 no Rust. Logar warning. Trade-off explícito.
- **Flash de conteúdo**: enquanto `loading||accLoading`, não redirecionar nem esconder; mostrar layout. O `return null` só após resolver.
- **Auto-lockout**: admin nunca é bloqueado (resolver curto-circuita). Garantir que a UI da F4 impeça remover o próprio acesso de admin.
- **Paridade**: QA comparando, por perfil, a sidebar com flag OFF vs ON — devem ser **idênticas** dado o seed da F1. Só então promover a flag a default.
- **`react-query` já presente** (`QueryClientProvider` no `ClientLayout`) — `useManagedRoutes`/`useAccessibleModules` podem usá-lo para cache/staleTime e evitar refetch a cada navegação.

## 12.6 Checklist de aceite da F3

- [ ] Flag OFF reproduz exatamente a navegação atual.
- [ ] Flag ON: sidebar montada a partir de `useAccessibleModules`; itens fixos sem `can_view` somem; grupo some quando vazio.
- [ ] `ModuleAccessGuard` redireciona rota fixa proibida para `/`; rota não gerenciada passa; `/` exato.
- [ ] `/admin/*` protegido por `sys-admin`; `/admin/agendamentos` não vaza por `/agendamentos`.
- [ ] `/modulo/[slug]` com `can_view=false` bloqueia (gap fechado).
- [ ] Revogar `can_view` de um módulo para 1 usuário remove o item da sidebar **só** dele e bloqueia a rota; admin intacto.
- [ ] Sem flash de conteúdo proibido durante o load.

---

# 13. Detalhamento da F4 (UI admin — override por usuário)

> Objetivo: tela onde o admin define, **por usuário**, exceções (Herda/Permitir/Negar) sobre
> o baseline do perfil. Entrada principal = a partir do usuário (responde "quais módulos este
> usuário acessa"). `UserDialog` (max-w-2xl) é pequeno demais → **página dedicada**.

## 13.1 Entrada e rota

- Botão **"Acesso"** em cada linha de `app/admin/users/page.tsx` → `router.push('/admin/users/${id}/acesso')`.
  (Mesmo padrão dos sub-itens existentes `/admin/users/[id]/{eliminar,exportar}`.)
- Nova rota: `app/admin/users/[id]/acesso/page.tsx` (server) + `AcessoModulosClient.tsx` (client).
- (Opcional) atalho espelhado no editor de módulo: aba "Exceções por usuário".
- Proteger a página com `ShowForManager`/`ProtectedPage permission="users.edit"`.

## 13.2 Leitura — matriz completa (novo)

`listAccessibleModules` filtra `can_view` e devolve só o efetivo — insuficiente para a grade.
Novo método de leitura (reusa as 3 queries da F2, **sem** filtrar):

```ts
// repo + use case GetUserAccessMatrixUseCase
getUserAccessMatrix(userId, userProfile): Promise<UserAccessRow[]>

interface UserAccessRow {
  module: { id: string; slug: string; name: string; grupo: string | null; ordem: number; tipo: 'dynamic'|'system' };
  baseline: CrudFlags;    // do perfil (default tudo-false)
  override: CrudOverride; // tri-state atual (tudo-null se sem row)
  effective: CrudFlags;   // resolveEffective(baseline, override, isAdmin)
}
```

Hook `useUserAccessMatrix(userId)` → `c.modules.getAccessMatrix.execute(userId, targetUser.perfil)`.

## 13.3 UX da grade (tri-state)

90 células (18 módulos × 5 flags) é muito para edição plana. Padrão **2 níveis**:

1. **Linha por módulo** (agrupada por `grupo`, ordenada por `ordem`) com um **controle primário
   de Acesso** = tri-state de `can_view` (cobre o caso comum "quem acessa o módulo"):
   - `Herda (✓/✗)` · `Permitir` · `Negar` — segmented de 3 botões; o rótulo "Herda" mostra o baseline resolvido.
2. **Expandir "Permissões detalhadas (CRUD)"** por linha → tri-state das 4 flags restantes
   (`can_create/edit/approve/delete`), mesmo segmented.

Mapeamento do segmented → `CrudOverride[flag]`: `Herda→null`, `Permitir→true`, `Negar→false`.
Exibir o **efetivo** ao lado (badge) para feedback imediato. Ações rápidas: "Herda tudo"
(reset da linha) e, no topo, "Resetar usuário" (remove todos os overrides).

Reaproveitar o visual da tabela de `ModuleWizard` (step 6) trocando `Checkbox` por o segmented tri-state.

## 13.4 Escrita

- Salvar por módulo alterado: `c.modules.setUserOverride.execute(moduleId, userId, override, actorId)` (F2).
  - `override` tudo-null → o método **deleta** a row (volta a herdar).
- Botão "Salvar" faz diff (só módulos com override mudado) e dispara em lote; toast de resultado.
- `actorId = currentUser.id` (para auditoria F5 + coluna `atualizado_por`).

## 13.5 Guardas de segurança (anti-lockout)

- Se `targetUser.perfil === 'admin'`: bloquear edição (admin tem tudo por curto-circuito) — mostrar aviso "Admin tem acesso total; exceções não se aplicam".
- Impedir o usuário de editar **a si mesmo** removendo o próprio acesso (`targetUser.id === currentUser.id` + flag crítica) — desabilitar com tooltip.
- Override só tem efeito sobre não-admin (coerente com `resolveEffective`).

## 13.6 Correção acoplada (dívida da F1)

No `ModuleWizard.tsx` (DEFAULT_PERMISSIONS e UI): perfil `'gestor'` **não existe** →
trocar por `'gerente'` e alinhar a lista aos perfis reais de `perfis`
(admin, gerente, coordenador, encarregado, operador, campo). Idealmente carregar os perfis
de `perfis` em vez de hardcode.

## 13.7 Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `app/admin/users/page.tsx` | botão "Acesso" por linha |
| `app/admin/users/[id]/acesso/page.tsx` | **novo** (server wrapper) |
| `app/admin/users/[id]/acesso/AcessoModulosClient.tsx` | **novo** (grade tri-state) |
| `components/ui/TriStatePermission.tsx` | **novo** (segmented Herda/Permitir/Negar) |
| `src/interface/hooks/queries/useUserAccessMatrix.ts` | **novo** |
| repo/use case/container | `getUserAccessMatrix` + `GetUserAccessMatrixUseCase` |
| `components/module/ModuleWizard.tsx` | fix `'gestor'`→`'gerente'` |

## 13.8 Checklist de aceite da F4

- [ ] `/admin/users/[id]/acesso` lista todos os módulos (system+dynamic) por grupo/ordem, com baseline, override e efetivo.
- [ ] Tri-state grava `null/true/false` corretamente; "Herda tudo" deleta a row.
- [ ] Alterar override reflete na sidebar/rota do usuário-alvo (F3) sem afetar outros.
- [ ] Admin-alvo bloqueado; auto-lockout impedido.
- [ ] `ModuleWizard` sem `'gestor'`.
- [ ] Salvar faz diff em lote + toast; `atualizado_por` preenchido.

---

# 14. Detalhamento da F5 (sync + auditoria)

> Objetivo: overrides por usuário propagam entre dispositivos (mesmo pipeline `EventSyncAdapter`)
> e toda concessão/revogação é auditada (convenções do CLAUDE.md).

## 14.1 Eventos de domínio

Em `domain/module/ModuleEvents.ts` (arquivo já existe):

```ts
export const MODULE_PERM_USER_SET     = 'module.perm.user.set';
export const MODULE_PERM_USER_CLEARED = 'module.perm.user.cleared';
// payload set: { module_id, user_id, can_view, can_create, can_edit, can_approve, can_delete, atualizado_em, atualizado_por }
// payload cleared: { module_id, user_id, atualizado_em, atualizado_por }
```

`SetModulePermissionOverrideUseCase` (F2) **emite** o evento via `EventBus`/`InMemoryDomainEventBus`
(use case emite; handler reage — padrão do projeto), além de persistir local. Não inline no repo.

## 14.2 Schema de validação (`ecoforms-core/sync`)

Adicionar JSON schema do payload (igual aos schemas de task/suite/demanda/user/client/module)
e registrar na validação de envelope v2. `ConflictResolver` usa **LWW por `atualizado_em`**
(+hash) — a coluna já existe na tabela (F1).

## 14.3 Handler inbound

Em `infrastructure/sync/module/ModuleSyncHandler.ts`, registrar no `register(inbound)`:

```ts
inbound.on('module.perm.user.set',     this.onPermUserSet.bind(this));
inbound.on('module.perm.user.cleared', this.onPermUserCleared.bind(this));
// set → INSERT ... ON CONFLICT(module_id,user_id) DO UPDATE (mesma query do setUserOverride)
// cleared → DELETE FROM permissoes_modulos_usuario WHERE module_id=? AND user_id=?
```

Adicionar à contagem de handlers essenciais do `HandlerRegistry`. **Mobile** (`mobile/www/js/sync/HandlerRegistry.js`)
fica **fora de escopo** (RBAC mobile é separado) — registrar lá só se/quando módulos forem expostos no app de campo.

## 14.4 Transporte

`TransportService.pushPending()` já envia a `sync_event_queue` criptografada — sem mudança;
basta o evento entrar na fila (via EventBus). Inbound puxa e alimenta o `HandlerRegistry`.

## 14.5 Auditoria

Toda escrita de override chama `log_audit()` (Rust) → `tbl_audit_log` + emite `audit.registro`:

```
actor_id     = currentUser.id
action       = 'module.perm.grant' | 'module.perm.revoke' | 'module.perm.inherit'
target_table = 'permissoes_modulos_usuario'
target_id    = module_id (+ user_id no payload)
old/new      = override antes/depois
```

Caminho recomendado: via o **command dedicado da F6** (que já valida sessão) — evita auditar no JS.
Se F6 não entrar, chamar o command de audit existente a partir do `SetModulePermissionOverrideUseCase`.

## 14.6 Checklist F5

- [ ] Eventos `module.perm.user.{set,cleared}` definidos + schema em `ecoforms-core/sync`.
- [ ] `SetModulePermissionOverrideUseCase` emite evento (não inline).
- [ ] Handler inbound faz upsert/delete idempotente; LWW por `atualizado_em`.
- [ ] Override propaga device→device num teste de 2 instâncias.
- [ ] Grant/revoke/inherit auditados em `tbl_audit_log`.

---

# 15. Detalhamento da F6 (enforcement no Rust — endurecimento, opcional)

> Frontend (F3) é defesa-em-profundidade; **teeth** real é no Rust, onde a sessão
> (`SessionState`: `user_id`+`perfil`) é revalidada. Duas frentes.

## 15.1 Proteger as tabelas de permissão (barato, alto valor)

Em `database.rs`, incluir `permissoes_modulos` e `permissoes_modulos_usuario` na lista de
tabelas cuja escrita via `db_execute`/`db_execute_batch` genérico é **bloqueada para não-admin**
(mesma mecânica que hoje protege `usuarios`/`perfis`/`hierarquia_perfis`/`tbl_permissions`).
Isso força mutação por **command dedicado**.

Novo command (espelha o padrão `demanda_aceitar`):

```rust
#[tauri::command]
pub fn module_set_user_permission(
    module_id: String, user_id: String,
    can_view: Option<bool>, can_create: Option<bool>, can_edit: Option<bool>,
    can_approve: Option<bool>, can_delete: Option<bool>,
    db_state: State<DbState>, session: State<SessionState>,
) -> Result<(), String> {
    let conn = /* lock */;
    let (actor_id, perfil) = session.validate_against_db(conn)?;     // revalida no DB
    // exigir admin/gerente (nivel <= 1 em hierarquia_perfis)
    // anti-lockout: se user_id == actor_id e revogando can_view → erro
    // UPSERT/DELETE (tudo-None → delete)
    // log_audit(conn, &actor_id, "module.perm.grant|revoke", "permissoes_modulos_usuario", &module_id, old, new)
    Ok(())
}
```

`setUserOverride` (F2) passa a invocar **este** command em vez de `db_execute`.

## 15.2 Enforcement de mutação de dados de módulo (maior esforço)

Helper Rust `resolve_module_permission(conn, user_id, perfil, module_id) -> CrudFlags`
(porta da lógica de `resolveEffective`), chamado por commands de mutação de dados de
módulo **antes** de escrever (create/edit/delete checam o flag correspondente).
Aplica-se só onde a mutação passa por command dedicado; escrita genérica de dados de
módulo continua sob a sanitização por tabela existente. Avaliar custo/benefício por entidade.

## 15.3 Checklist F6

- [ ] `permissoes_modulos` + `permissoes_modulos_usuario` na lista de escrita-bloqueada-para-não-admin.
- [ ] `module_set_user_permission`: valida sessão, exige admin/gerente, anti-lockout, audita.
- [ ] `setUserOverride` (TS) usa o command dedicado.
- [ ] (Opcional) `resolve_module_permission` em Rust para mutações sensíveis de dados.

---

# 16. Recapitulação de sequência

```
F1 schema+seed ─→ F2 resolver+runtime ─→ F4 UI admin        (MVP: override por usuário em módulos dinâmicos)
                              └─────────→ F3 sidebar+guard    (unificado: páginas fixas data-driven)
F5 sync+auditoria ─→ F6 enforcement Rust                     (propagação + teeth)
```

- **MVP entregável** (override por usuário visível e funcional): **F1 → F2 → F4**.
- **Unificação** (páginas fixas sob a mesma matriz + nav data-driven): **F3**.
- **Robustez** (multi-device + segurança real): **F5 → F6**.

Notas globais: tudo em `desktop/` ([[ecoforms-build-constraints]]: sem build local — validar no Windows);
schema sempre em `ensure-columns.ts` + `schema_consolidado_corrigido.sql`; queries no repositório,
não nos hooks ([[ecoforms-sql-inline-audit]]); mobile fora de escopo.
