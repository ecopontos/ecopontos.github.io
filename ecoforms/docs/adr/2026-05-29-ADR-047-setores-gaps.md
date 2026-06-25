# ADR-047: Gaps identificados no módulo Setores (Segregação de Conteúdo)

**Data:** 2026-05-29  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** `SectorQueryUtils.ts`, `AccessFilterBuilder.ts`, `resolveSetorId.ts`, `useSetores.ts`, `sectors/page.tsx`, `SqliteKanbanRepository.getKanbanData`, `useKanbanData.ts`, `useInboxData.ts`, `useAccessFilters.ts`, schema_ddl.sql  
**ADRs relacionados:** ADR-023 (RBAC), ADR-043 (Usuários gaps)

---

## Contexto

Setores são o mecanismo principal de **segregação horizontal de conteúdo** no sistema: cada tarefa, suíte e manifestação pertence a um setor; usuários têm acesso apenas a setores aos quais estão associados. A auditoria revela que **a infraestrutura de segregação existe e está bem projetada, mas está desconectada do caminho de leitura** — as funções `getEffectiveSectors`, `buildTaskAccessFilter`, `buildSectorFilter` e `buildRecordAccessFilter` nunca são chamadas para filtrar o que um usuário vê. Adicionalmente, duas colunas centrais ao modelo (`setor_principal_id` em `usuarios`, `pai_id` em `setores`) são referenciadas no código mas **não existem no schema canônico**.

---

## Mapa de Componentes de Setores

```
Schema
  ├── setores (id, nome, descricao, ativo, criado_em, atualizado_em)
  │     — sem pai_id → hierarquia planejada mas não implementada no schema
  └── usuarios_setores (usuario_id, setor_id) — junction N:N

SectorQueryUtils.getEffectiveSectors(userId, db)
  ├── UNION: usuarios_setores + usuarios.setor_principal_id  ← coluna não existe no schema
  └── BFS via setores.pai_id                                 ← coluna não existe no schema

AccessFilterBuilder
  ├── buildSectorFilter(effectiveSectors, column)   → SQL clause
  ├── buildTaskAccessFilter(userId, perfil, sectors?) → SQL clause para tarefas
  ├── buildRecordAccessFilter(userId, perfil, sectors?) → SQL clause para suítes
  └── buildInboxAccessFilter(userId, perfil, sectors?) → SQL clause para inbox

Callers (produção)
  ├── CreateTaskUseCase → getEffectiveSectors (valida setor ao criar)  ✅
  ├── useInboxData → buildInboxAccessFilter (sem effectiveSectors)      ⚠️ path sem setor
  ├── useKanbanData → getKanbanData(setor: user.setores?.[0])           ❌ setor ignorado
  └── buildTaskAccessFilter / buildRecordAccessFilter                   ❌ nunca chamados
```

---

## Gaps Detalhados

### Gap 1 — `setor_principal_id` referenciado no código mas inexistente no schema (Crítico — Runtime Error)

**Arquivos:** `SectorQueryUtils.ts:24`, `resolveSetorId.ts:33`, `SqliteKanbanRepository.ts:31`, `crm-datasources.ts:83`, `HandlerRegistry.ts:201`

```sql
-- SectorQueryUtils.ts — coluna inexistente
SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL

-- resolveSetorId.ts — coluna inexistente
SELECT setor_principal_id FROM usuarios WHERE id = ?

-- SqliteKanbanRepository.getUserSectors — coluna inexistente
SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL
```

O schema canônico (`schema_ddl.sql`) define a tabela `usuarios` com as colunas: `id, id_old, username, password_hash, nome, perfil, formularios_permitidos, ativo, criado_em, atualizado_em, setor, org_id, sync_salt, email`. A coluna `setor_principal_id` **não existe**.

Consequências:
- `getEffectiveSectors()` retorna sempre apenas os setores de `usuarios_setores`, nunca o setor principal — a UNION retorna vazio na segunda parte
- `resolveSetorId()` sempre retorna `null` como fallback, nunca usa o setor principal do usuário
- `getUserSectors()` em `SqliteKanbanRepository` idem
- Em SQLite com modo permissivo, a query pode não lançar erro — retorna NULL silenciosamente, mascarando o problema

**Decisão:** Escolher uma das duas abordagens:
- **A (preferida):** Adicionar migration com `ALTER TABLE usuarios ADD COLUMN setor_principal_id TEXT REFERENCES setores(id)` e popular com dados existentes
- **B:** Remover as referências a `setor_principal_id` do código e usar apenas `usuarios_setores`

---

### Gap 2 — `pai_id` referenciado no BFS mas inexistente no schema (Crítico — Runtime Error)

**Arquivo:** `SectorQueryUtils.ts:39`

```typescript
// BFS para expandir hierarquia de setores — coluna pai_id não existe
const children = await db.query<{ id: string }>(
    `SELECT id FROM setores WHERE pai_id IN (${frontier.map(() => '?').join(',')}) AND ativo = 1`,
    frontier,
);
```

O schema de `setores` tem: `id, nome, descricao, ativo, criado_em, atualizado_em`. A coluna `pai_id` não existe. Esta query em SQLite retorna erro `no such column: pai_id` — ou, dependendo do driver, retorna vazio silenciosamente.

Resultado prático: mesmo que `getEffectiveSectors` seja chamado, o BFS sempre termina na primeira iteração (frontier vira vazio), nunca expandindo setores filhos. **A hierarquia de setores está planejada mas completamente não-funcional**.

**Decisão:**
- **A (hierarquia):** `ALTER TABLE setores ADD COLUMN pai_id TEXT REFERENCES setores(id)` + atualizar a página de gestão para suportar pai/filho
- **B (flat):** Remover o BFS do `getEffectiveSectors` — tratar setores como flat, sem hierarquia

---

### Gap 3 — Segregação por setor não aplicada na leitura de tarefas (Crítico — Segurança)

**Arquivo:** `SqliteKanbanRepository.ts:266–366`, `useKanbanData.ts:40–43`

```typescript
// useKanbanData.ts — passa setor[0] mas getKanbanData ignora
await c.kanbanRepository.getKanbanData(
    user.id, user.perfil || '', user.setores?.[0] || null,  // ← setor passado
    permissions.isAdmin(), permissions.isManager(),
    accessiblePerfis, showAllProjects, currentProjectId,
);

// SqliteKanbanRepository.getKanbanData — parâmetro recebido mas nunca usado
async getKanbanData(
    userId: string,
    _perfil: string,      // ← prefixo _ = intencionalmentte ignorado
    setor: string | null, // ← recebido mas não usado em nenhuma WHERE
    isAdmin: boolean,
    isManager: boolean,
    ...
)
```

O filtro de tarefas visíveis é puramente baseado em `criado_por`, `atribuido_para` e `interessados`:

```sql
WHERE t.arquivado = 0 AND t.status != 'cancelado'
  AND (
    ? OR                          -- isAdminMgr
    t.criado_por = ? OR
    t.atribuido_para = ? OR
    EXISTS (tarefas_interessados) OR
    EXISTS (projetos_interessados)
  )
```

**O campo `tarefas.setor_id` não está na cláusula WHERE**. Um `operador` do Setor A pode ver tarefas do Setor B se for `atribuido_para` ou `interessado` nelas — mesmo que os setores sejam segregados administrativamente.

Consequência: a segregação prometida ao usuário ("você vê apenas tarefas do seu setor") não funciona. O `setor_id` da tarefa é armazenado e exibido, mas não filtra a visibilidade.

**Decisão:** Integrar `buildTaskAccessFilter` com `getEffectiveSectors` no `getKanbanData`:

```typescript
// Antes de executar a query de tasks
const effectiveSectors = await getEffectiveSectors(userId, this.db);
const accessFilter = buildTaskAccessFilter(userId, perfil, effectiveSectors.length > 0 ? effectiveSectors : undefined);

// Adicionar à WHERE:
AND (${accessFilter.clause})
// params: [...accessFilter.params]
```

---

### Gap 4 — Inbox usa `buildInboxAccessFilter` sem `effectiveSectors` (Crítico — Segurança)

**Arquivo:** `useAccessFilters.ts:4`, `useInboxData.ts:24–26`

```typescript
// useAccessFilters.ts — chama sem effectiveSectors
export function getInboxAccessFilter(userId: string, userPerfil: string) {
    return buildInboxAccessFilter(userId, userPerfil);  // ← sem effectiveSectors
}
```

`buildInboxAccessFilter` tem dois caminhos:
1. **Com `effectiveSectors`** — usa `buildSectorFilter` (correto)
2. **Sem `effectiveSectors`** — usa `taskClause` (EXISTS em `tarefas`) para operadores, e para gerentes usa JOIN em `usuarios_setores` compartilhados

O caminho sem `effectiveSectors` é descrito no próprio código como "backwards-compatible" — ou seja, é o comportamento legado. O inbox de suítes não é filtrado por setor, apenas por tarefa atribuída ou propriedade do pacote.

**Decisão:** Passar `effectiveSectors` no `getInboxAccessFilter`:

```typescript
export async function getInboxAccessFilter(userId: string, userPerfil: string, db: DbLike) {
    const effectiveSectors = await getEffectiveSectors(userId, db);
    return buildInboxAccessFilter(userId, userPerfil, effectiveSectors.length > 0 ? effectiveSectors : undefined);
}
```

Requer que `useInboxData` aguarde o resultado de forma assíncrona (mudança de `useMemo` para `useEffect`).

---

### Gap 5 — `buildTaskAccessFilter` e `buildRecordAccessFilter` nunca chamados (Crítico)

**Arquivo:** `AccessFilterBuilder.ts:61–114`

As funções `buildTaskAccessFilter` e `buildRecordAccessFilter` estão completamente implementadas, documentadas e corretas — mas **nunca são chamadas em nenhum caminho de leitura de produção**.

```
buildTaskAccessFilter    → 0 callers em produção
buildRecordAccessFilter  → 0 callers em produção
buildSectorFilter        → 0 callers em produção (só usado internamente por buildInboxAccessFilter)
```

Toda a infraestrutura de segregação horizontal de setor foi construída mas não conectada ao Kanban nem ao repositório de tarefas.

**Decisão:** Conectar em `getKanbanData` (Gap 3) e em `SqliteTaskRepository` (se usado diretamente).

---

### Gap 6 — `useKanbanData` passa apenas `user.setores?.[0]` (Importante)

**Arquivo:** `useKanbanData.ts:41`

```typescript
user.setores?.[0] || null,  // ← apenas o primeiro setor; ignora múltiplos setores
```

Um usuário pode pertencer a múltiplos setores (`usuarios_setores` é N:N). O hook só passa o primeiro. Como `getKanbanData` ignora o parâmetro de qualquer forma (Gap 3), o impacto é nulo hoje — mas quando o Gap 3 for corrigido, esta linha precisa ser atualizada para passar todos os setores ou delegar para `getEffectiveSectors`.

**Decisão:** Remover o parâmetro `setor` de `getKanbanData` completamente e chamar `getEffectiveSectors` internamente no repositório:

```typescript
async getKanbanData(userId: string, perfil: string, ...) {
    const effectiveSectors = await getEffectiveSectors(userId, this.db);
    // usar effectiveSectors nas queries
}
```

---

### Gap 7 — `useSetores.remove` faz hard DELETE sem verificar impacto (Importante)

**Arquivo:** `useSetores.ts:54–58`

```typescript
const remove = useCallback(async (id: string) => {
    const c = await getContainerAsync();
    await c.sqlite.execute(`DELETE FROM setores WHERE id = ?`, [id]);  // ❌ hard DELETE
    await fetch();
}, [fetch]);
```

Deletar um setor com `ativo = 0` seria o correto (soft delete, consistente com o padrão do resto do sistema). Hard delete:
- Não remove entradas em `usuarios_setores` (sem CASCADE) → usuários ficam com `setor_id` apontando para setor deletado
- Não atualiza `tarefas.setor_id` que referenciam o setor deletado → tarefas ficam com `setor_id` órfão
- A página admin avisa "Isso pode afetar a visibilidade de registros associados" mas não impede a ação

Adicionalmente, `sectors/page.tsx:43` usa `window.confirm()` — mesmo problema já documentado em ADR-042 e ADR-043.

**Decisão:**
1. Mudar para soft delete: `UPDATE setores SET ativo = 0 WHERE id = ?`
2. Antes de inativar, verificar `COUNT(*) FROM usuarios_setores WHERE setor_id = ?` e `COUNT(*) FROM tarefas WHERE setor_id = ? AND arquivado = 0`
3. Substituir `confirm()` por `AlertDialog`

---

### Gap 8 — Sem domain entity e sem repository para Setor (Importante)

**Arquivo:** `useSetores.ts`

O hook `useSetores` faz SQL direto (`INSERT INTO setores`, `UPDATE setores`, `DELETE FROM setores`) sem passar por nenhuma entidade de domínio ou repositório interface. É o mesmo padrão identificado no módulo ecopontos (ADR-040).

Comparação com outros módulos bem estruturados: `ClienteRepository`, `UserRepository`, `ManifestacaoRepository` — todos têm interface de domínio e implementação separada.

Consequências:
- Sem ponto único para adicionar validações (ex: nome único de setor)
- Sem auditoria de criação/edição de setores
- SQL inline no hook de interface — violação de camadas

**Decisão:** Criar `SetorRepository` (interface + `SqliteSetorRepository`) e refatorar `useSetores` para delegar ao repositório.

---

### Gap 9 — Sem validação de nome único para setores (Importante)

**Arquivo:** `useSetores.ts:33–41`

Dois setores com o mesmo nome podem ser criados sem aviso. Isso cria confusão para o admin ao atribuir usuários e pode resultar em dados de acesso inconsistentes quando o usuário seleciona "Coleta Seletiva" em dois contextos diferentes.

**Decisão:** Adicionar verificação antes de `INSERT`:

```typescript
const existing = await c.sqlite.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM setores WHERE nome = ? AND id != ?`,
    [nome, '']
);
if ((existing[0]?.count ?? 0) > 0) throw new Error(`Setor '${nome}' já existe`);
```

---

### Gap 10 — Página de setores protegida por `users.view_all` (Médio)

**Arquivo:** `sectors/page.tsx:76`

```typescript
<ProtectedPage permission="users.view_all">
```

Gestão de setores deveria exigir `system.config` (que existe em `usePermissions.Permission`) — é uma operação de configuração do sistema, não de visualização de usuários. Um gerente com `users.view_all` pode ver/editar/deletar setores que afetam a segregação de todos os dados, mesmo sem ser admin.

**Decisão:** `<ProtectedPage permission="system.config">` (restringe a admin).

---

### Gap 11 — Cache de `getEffectiveSectors` não invalida em cascata (Médio)

**Arquivo:** `SectorQueryUtils.ts:7–9`

```typescript
export function invalidateSectorCache(userId?: string): void {
    if (userId) _cache.delete(userId);
    else _cache.clear();
}
```

`invalidateSectorCache` é chamado em `SqliteUserRepository.assignSectors()` — correto. Mas não é chamado quando:
- Um setor é criado, editado ou deletado (`useSetores.create/update/remove`)
- Um usuário é desativado (`ToggleUserStatusUseCase`)

Se um admin inativa um usuário ou remove seu setor, o cache ainda retorna os setores antigos por até 5 minutos — durante esse período o usuário vê conteúdo que não deveria (quando/se o filtro for conectado).

**Decisão:** Chamar `invalidateSectorCache()` (sem argumento = limpa tudo) em `useSetores.create/update/remove` e em `ToggleUserStatusUseCase`.

---

### Gap 12 — `useSetores` sem error state (Médio)

**Arquivo:** `useSetores.ts:18–29`

```typescript
const fetch = useCallback(async () => {
    setLoading(true);
    try {
        const rows = ...
        setData(rows);
    } finally {  // sem catch
        setLoading(false);
    }
}, [includeAll]);
```

Mesmo padrão de erro silenciado identificado em `useClientes` (ADR-042 Gap 4). Falha na query retorna `data: []` sem distinguir "sem setores" de "erro de banco".

---

### Gap 13 — `SETORES_ATIVOS` retorna `descricao` mas schema usa este nome (Baixo)

**Arquivo:** `queries/usuarios.ts:94`

```sql
SELECT id, nome, descricao FROM setores WHERE ativo = 1 ORDER BY nome
```

Correto. Porém `useSetores` usa `SELECT *` no caminho `includeAll = true`:

```typescript
await c.sqlite.query<Setor>(`SELECT * FROM setores ORDER BY nome`, [])
```

`SELECT *` retorna `ativo` como `INTEGER (0|1)` mas `Setor` interface não tem campo `ativo`. Dado extra silenciosamente descartado pelo TypeScript — não é um bug mas indica que a interface `Setor` está incompleta para o caso `includeAll`.

---

## Impacto Downstream da Segregação Quebrada

A falha dos Gaps 1–5 tem consequências diretas em todos os módulos que dependem de setores para segregação:

| Módulo | O que deveria segregar | Situação atual |
|--------|----------------------|----------------|
| **Kanban / Tarefas** | Tarefas por `setor_id` | ❌ `setor_id` armazenado mas não filtra visibilidade |
| **Inbox (Suítes)** | Pacotes por setor do proprietário | ⚠️ Filtro por tarefa atribuída (sem setor explícito) |
| **Formulários** | Acesso por setor do usuário | ❌ Não verificado via setor |
| **Manifestações** | Encaminhamento entre setores | ✅ Setor explícito em tramitações (correto) |
| **CRM Datasource** | Usuários por setor | ⚠️ `COALESCE(us.setor_id, u.setor_principal_id)` — segunda parte sempre NULL |
| **Hierarquia** | Setores pai → filhos visíveis | ❌ `pai_id` não existe no schema |

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço |
|---|-----|-----------|-----------|---------|
| 1 | `setor_principal_id` inexistente no schema | Crítico | `SectorQueryUtils.ts`, `resolveSetorId.ts`, `SqliteKanbanRepository.ts` | Médio |
| 2 | `pai_id` inexistente no schema (BFS quebrado) | Crítico | `SectorQueryUtils.ts:39` | Baixo–Médio |
| 3 | Segregação por setor não aplicada no Kanban | Crítico | `SqliteKanbanRepository.getKanbanData` | Médio |
| 4 | Inbox sem `effectiveSectors` | Crítico | `useAccessFilters.ts`, `useInboxData.ts` | Médio |
| 5 | `buildTaskAccessFilter`/`buildRecordAccessFilter` nunca chamados | Crítico | `AccessFilterBuilder.ts` | — (consequência de 3+4) |
| 6 | `useKanbanData` passa só setor[0] | Importante | `useKanbanData.ts:41` | Trivial |
| 7 | Hard DELETE de setor sem verificar impacto | Importante | `useSetores.ts:54`, `sectors/page.tsx:43` | Baixo |
| 8 | Sem domain entity/repository para Setor | Importante | `useSetores.ts` | Médio |
| 9 | Sem validação de nome único | Importante | `useSetores.ts:33` | Trivial |
| 10 | Página protegida por permissão incorreta | Médio | `sectors/page.tsx:76` | Trivial |
| 11 | Cache não invalida quando setor muda | Médio | `SectorQueryUtils.ts:7` | Trivial |
| 12 | Erro silenciado em `useSetores.fetch` | Médio | `useSetores.ts:18` | Trivial |
| 13 | `SELECT *` com `Setor` interface incompleta | Baixo | `useSetores.ts:23` | Trivial |

---

## Ordem de Resolução Recomendada

```
Fase 0 — Unblocking (1 dia)
  1. Decidir: setor_principal_id como nova coluna ou remover do código
  2. Decidir: pai_id (hierarquia) ou setores flat
  3. Executar migration ou remover referências

Fase 1 — Conectar a segregação (2–3 dias)
  3. Integrar getEffectiveSectors no getKanbanData (Gap 3)
  4. Integrar effectiveSectors no buildInboxAccessFilter (Gap 4)
  5. Invalidar cache ao criar/editar/deletar setor (Gap 11)

Fase 2 — Robustez (1 dia)
  6. Soft delete em useSetores.remove + AlertDialog (Gap 7)
  7. Verificação de impacto antes de deletar setor (Gap 7)
  8. Proteção de rota: system.config (Gap 10)
  9. Nome único de setor (Gap 9)
  10. Triviais: Gap 6, 11, 12

Fase 3 — Arquitetura (roadmap)
  11. SetorRepository (domain entity + interface + SqliteSetorRepository) (Gap 8)
```

---

## O que está bem (não tocar)

- `AccessFilterBuilder.buildSectorFilter` — implementação correta, parametrizada, sem SQL injection
- `AccessFilterBuilder.buildTaskAccessFilter` — lógica de hierarquia vertical + horizontal correta
- `AccessFilterBuilder.buildInboxAccessFilter` — ambos os paths (com/sem effectiveSectors) implementados
- `SectorQueryUtils` — estrutura do BFS está correta; problema é só `pai_id` não existir no schema
- `SqliteUserRepository.assignSectors` — usa transaction + invalida cache corretamente
- `resolveSetorId` — lógica de precedência bem definida; problema é `setor_principal_id` não existir
- `usuarios_setores` junction table — modelo N:N correto para múltiplos setores por usuário
- Manifestações — uso de `de_setor_id`/`para_setor_id` em tramitações está correto e não é afetado por estes gaps

## Relação com ADRs Existentes

- **ADR-023 (RBAC Fase 2):** gaps 1–5 são pré-requisitos para qualquer RBAC granular — sem segregação horizontal funcionando, as permissões verticais (perfil) não isolam o conteúdo
- **ADR-043 (Usuários):** gap 1 (`setor_principal_id`) impacta diretamente `getEffectiveSectors` que é chamado em `CreateTaskUseCase` — criação de tarefa pode falhar silenciosamente ao tentar resolver o setor do ator
- **ADR-040 (Ecopontos):** gap 8 (sem domain entity para Setor) segue o mesmo padrão do módulo ecopontos
- **ADR-042 (Clientes):** gap 7 (`confirm()`/`alert()`) e gap 12 (erro silenciado) seguem padrão sistêmico
