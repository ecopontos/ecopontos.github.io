# Plano de Implementação — Setores Fase 0

**Data:** 2026-05-29  
**Status:** CONCLUÍDO (2026-06-09)  
**Contexto:** ADR-044 identificou que a segregação de conteúdo por setor está arquitetada mas não funciona em produção. Fase 0 é pré-requisito para tudo: resolve inconsistências de schema vs. código antes de conectar os filtros.  
**Fases posteriores dependem desta:** Fase 1 (conectar `getEffectiveSectors` ao Kanban/Inbox), Fase 2 (robustez/UI), Fase 3 (domain entity `Setor`).

---

## Diagnóstico

### O que o schema tem vs. o que o código usa

| Conceito | Schema real | Código usa | Resultado |
|----------|-------------|------------|-----------|
| Setor principal do usuário | `usuarios.setor TEXT` | `usuarios.setor_principal_id` | Query sempre retorna NULL ou erro |
| Hierarquia de setores | — (não existe) | `setores.pai_id` (BFS) | Query sempre retorna `no such column` |

### Onde isso causa falha hoje (runtime)

**Bug 1 — `HandlerRegistry.ts` — sync de usuários quebrado**

```sql
-- evento usuario.criado tenta INSERT com coluna inexistente
INSERT OR IGNORE INTO usuarios
  (id, nome, nome_usuario, perfil, ativo, setor_principal_id, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

`INSERT OR IGNORE` ignora violações de constraint (UNIQUE, FK), mas **não ignora `no such column`**. Toda vez que o sistema recebe um evento `usuario.criado` via sync (desktop ↔ mobile), a inserção falha. O usuário não é criado na máquina receptora.

**Bug 2 — `SectorQueryUtils.getEffectiveSectors` — setores sempre incompletos**

```sql
-- segunda parte do UNION sempre falha ou retorna vazio
SELECT u.setor_principal_id FROM usuarios u
WHERE u.id = ? AND u.setor_principal_id IS NOT NULL
```

O setor principal do usuário nunca é incluído nos setores efetivos. Quando Fase 1 conectar os filtros, usuários sem entrada em `usuarios_setores` verão zero conteúdo — mesmo tendo `setor` preenchido.

**Bug 3 — `SectorQueryUtils.getEffectiveSectors` — BFS infinito ou erro**

```sql
-- setores.pai_id não existe
SELECT id FROM setores WHERE pai_id IN (?) AND ativo = 1
```

SQLite retorna `no such column: pai_id`. O while loop lança erro na primeira iteração, ou o driver engole silenciosamente e o BFS termina sem expandir filhos. Hierarquia nunca funciona.

**Bug 4 — `resolveSetorId.ts` — setor de criação de tarefa sempre null**

```sql
SELECT setor_principal_id FROM usuarios WHERE id = ?
```

Ao criar uma tarefa sem `setorId` explícito, o sistema deveria usar o setor principal do criador. Retorna NULL porque a coluna não existe. Tarefas ficam sem `setor_id`.

**Bug 5 — `crm-datasources` datasource `usuarios` — setor_id de usuário incorreto**

```sql
SELECT u.id, u.nome, COALESCE(us.setor_id, u.setor_principal_id) AS setor_id
```

A segunda parte do COALESCE nunca resolve. Usuários sem entrada em `usuarios_setores` aparecem sem `setor_id` nos datasources de formulário.

---

## Decisões de design (definir antes de codar)

### Decisão 1 — `setor_principal_id`: migration ou rename?

**Opção A — Rename no código (sem migration)** ← Recomendada

A coluna `setor TEXT` já existe em `usuarios`. É o mesmo conceito. Basta renomear as 5 referências no código de `setor_principal_id` para `setor`. Nenhuma migration necessária.

**Opção B — Criar nova coluna `setor_principal_id`**

`ALTER TABLE usuarios ADD COLUMN setor_principal_id TEXT REFERENCES setores(id)`. Requer migration (número 020), popular dados existentes a partir de `setor`, e manter `setor` por compatibilidade com sync events que ainda usam `setor`. Desnecessariamente complexo.

**Decisão: Opção A.** A coluna `setor` já é o setor principal. Renomear no código.

---

### Decisão 2 — `pai_id` (hierarquia de setores): implementar ou remover?

**Opção A — Remover o BFS (setores flat)** ← Recomendada

A UI de gestão de setores não tem campo "setor pai". Nenhum setor tem pai no banco. Nenhum usuário configurou hierarquia. A feature é aspiracional, nunca foi ativada. Remover o BFS e deixar setores como lista flat é o estado atual real.

Quando hierarquia for necessária: adicionar `pai_id` ao schema (migration), campo na UI, e re-adicionar o BFS — em ordem correta.

**Opção B — Adicionar `pai_id` ao schema agora**

`ALTER TABLE setores ADD COLUMN pai_id TEXT REFERENCES setores(id)`. O BFS funcionaria mas retornaria os mesmos resultados (todos `pai_id = NULL`). Não adiciona valor agora, aumenta complexidade de UI e migration. Defer.

**Decisão: Opção A.** Remover BFS. Setores são flat. Documentar que hierarquia é backlog.

---

## Escopo de Fase 0

Fase 0 **não conecta filtros de visibilidade** (isso é Fase 1). Fase 0 apenas corrige o código para que o modelo de dados seja consistente: `setor_principal_id` → `setor`, BFS removido.

### O que entra em Fase 0

| # | Arquivo | Mudança | Tipo |
|---|---------|---------|------|
| A1 | `HandlerRegistry.ts:201` | `setor_principal_id` → `setor` na lista de colunas do INSERT | Bug fix |
| A2 | `SectorQueryUtils.ts:24` | UNION `setor_principal_id` → `setor` | Bug fix |
| A3 | `SectorQueryUtils.ts:37–44` | Remover BFS while loop; atualizar comentário | Simplificação |
| A4 | `resolveSetorId.ts:32–36` | `setor_principal_id` → `setor` | Bug fix |
| A5 | `SqliteKanbanRepository.ts:31` | `setor_principal_id` → `setor` | Bug fix |
| A6 | `crm-datasources.ts:83` | `u.setor_principal_id` → `u.setor` | Bug fix |

### O que NÃO entra em Fase 0

- Conectar `getEffectiveSectors` ao `getKanbanData` → Fase 1
- Conectar `effectiveSectors` ao inbox → Fase 1
- Invalidar cache ao criar/editar setor → Fase 1 (junto com conexão)
- `SetorRepository` domain entity → Fase 3
- Soft delete em `useSetores.remove` → Fase 2
- `pai_id` hierarquia → backlog

---

## Implementação detalhada

### A1 — `HandlerRegistry.ts` — linha 201

**Arquivo:** `src/infrastructure/sync/HandlerRegistry.ts`

```diff
- `INSERT OR IGNORE INTO usuarios
-  (id, nome, nome_usuario, perfil, ativo, setor_principal_id, criado_em, atualizado_em)
-  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
+ `INSERT OR IGNORE INTO usuarios
+  (id, nome, nome_usuario, perfil, ativo, setor, criado_em, atualizado_em)
+  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
```

O `d.setor ?? null` nos params já estava correto — não muda.

**Impacto:** Corrige sync de usuários criados via eventos. Antes: INSERT falhava com `no such column`. Depois: INSERT funciona.

---

### A2 + A3 — `SectorQueryUtils.ts` — linhas 12–49

**Arquivo:** `src/infrastructure/persistence/SectorQueryUtils.ts`

```diff
- /**
-  * Retorna todos os setor_id que um usuário pode acessar:
-  * setores diretos (setor_principal_id + usuarios_setores) e seus descendentes
-  * via pai_id (BFS). Resultado cacheado por 5 minutos.
-  */
+ /**
+  * Retorna todos os setor_id que um usuário pode acessar:
+  * setores de usuarios_setores (N:N) + setor principal (usuarios.setor).
+  * Resultado cacheado por 5 minutos.
+  * Nota: hierarquia pai/filho não está implementada no schema atual.
+  */
  export async function getEffectiveSectors(userId: string, db: DbLike): Promise<string[]> {
      const cached = _cache.get(userId);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.sectors;

      const directRows = await db.query<{ setor_id: string }>(
          `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
           UNION
-          SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
+          SELECT u.setor FROM usuarios u WHERE u.id = ? AND u.setor IS NOT NULL`,
          [userId, userId],
      );
-     const directIds = directRows.map(r => r.setor_id);
-
-     if (directIds.length === 0) {
-         _cache.set(userId, { sectors: [], ts: Date.now() });
-         return [];
-     }
-
-     const allIds = new Set(directIds);
-     let frontier = [...directIds];
-
-     while (frontier.length > 0) {
-         const children = await db.query<{ id: string }>(
-             `SELECT id FROM setores WHERE pai_id IN (${frontier.map(() => '?').join(',')}) AND ativo = 1`,
-             frontier,
-         );
-         frontier = children.map(r => r.id).filter(id => !allIds.has(id));
-         frontier.forEach(id => allIds.add(id));
-     }
-
-     const sectors = [...allIds];
+     const sectors = directRows.map(r => r.setor_id).filter(Boolean);
      _cache.set(userId, { sectors, ts: Date.now() });
      return sectors;
  }
```

**Impacto:**
- Setor principal (`usuarios.setor`) agora entra nos setores efetivos
- BFS removido — sem risco de `no such column: pai_id`
- Função de 49 linhas vira 20 linhas
- Resultado continua sendo `string[]` de `setor_id` — interface pública não muda

---

### A4 — `resolveSetorId.ts` — linhas 32–36

**Arquivo:** `src/application/shared/resolveSetorId.ts`

```diff
- const rows = await db.query<{ setor_principal_id: string | null }>(
-     `SELECT setor_principal_id FROM usuarios WHERE id = ?`,
-     [actorId],
- );
- return rows[0]?.setor_principal_id ?? null;
+ const rows = await db.query<{ setor: string | null }>(
+     `SELECT setor FROM usuarios WHERE id = ?`,
+     [actorId],
+ );
+ return rows[0]?.setor ?? null;
```

**Impacto:** Ao criar uma tarefa sem `setorId` explícito, o sistema agora usa o setor principal do criador como fallback. Antes retornava sempre `null`.

---

### A5 — `SqliteKanbanRepository.ts` — linha 31

**Arquivo:** `src/infrastructure/persistence/sqlite/SqliteKanbanRepository.ts`

```diff
  async getUserSectors(userId: string): Promise<string[]> {
      const rows = await this.db.query<{ setor_id: string }>(
          `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
           UNION
-          SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
+          SELECT u.setor FROM usuarios u WHERE u.id = ? AND u.setor IS NOT NULL`,
          [userId, userId],
      );
      return rows.map(r => r.setor_id);
  }
```

**Impacto:** `getUserSectors` é chamado em `useKanbanMutations` ao criar/atualizar tarefa para inferir o setor do responsável. Agora retorna o setor correto quando o responsável tem `setor` preenchido mas não tem entrada em `usuarios_setores`.

---

### A6 — `crm-datasources.ts` — linha 83

**Arquivo:** `src/infrastructure/config/crm-datasources.ts`

```diff
- `SELECT u.id, u.nome, COALESCE(us.setor_id, u.setor_principal_id) AS setor_id
+ `SELECT u.id, u.nome, COALESCE(us.setor_id, u.setor) AS setor_id
```

**Impacto:** Datasource `usuarios` no EntityPicker de formulários agora retorna `setor_id` correto para usuários com `setor` mas sem entrada em `usuarios_setores`.

---

## Estado final das edições (2026-06-09)

| # | Arquivo | Status |
|---|---------|--------|
| A1 | `HandlerRegistry.ts` (2 cópias: `src/` e `desktop/src/`) | ✅ `setor_principal_id` → `setor` no INSERT |
| A2+A3 | `SectorQueryUtils.ts` | ✅ Coluna corrigida + BFS while loop removido (49→20 linhas) |
| A4 | `resolveSetorId.ts` | ✅ `setor_principal_id` → `setor` |
| A5 | `SqliteKanbanRepository.ts` | ✅ `setor_principal_id` → `setor` |
| A6 | `crm-datasources.ts` | ✅ Já estava correto (`u.setor`) |

## Verificação adicional

- `usuarios.setor` — coluna **existe** no schema real. As 5 queries agora a referenciam corretamente.
- `setor_principal_id` — **não existe** no schema. Nenhuma referência restante no código ativo.
- `setores.pai_id` — **não existe**. BFS removido. Hierarquia documentada como backlog.

---

## Critérios de aceitação de Fase 0

### Testes manuais

**CT-01 — Sync de usuário via evento**
1. Publicar evento `usuario.criado` no outbox com `{ setor: "setor-coleta" }`
2. Verificar que a inserção em `usuarios` não lança erro
3. Verificar que `SELECT setor FROM usuarios WHERE id = ?` retorna `"setor-coleta"`

**CT-02 — `getEffectiveSectors` com setor principal**
1. Criar usuário sem entrada em `usuarios_setores`, mas com `setor = "setor-A"`
2. Chamar `getEffectiveSectors(userId, db)`
3. Verificar retorno: `["setor-A"]`

**CT-03 — `getEffectiveSectors` com múltiplos setores**
1. Criar usuário com `setor = "setor-A"` e entrada em `usuarios_setores` com `setor_id = "setor-B"`
2. Chamar `getEffectiveSectors`
3. Verificar retorno: `["setor-A", "setor-B"]` (sem duplicatas)

**CT-04 — `resolveSetorId` fallback para setor principal**
1. Criar tarefa sem `setorId` explícito; criador tem `setor = "setor-coleta"`
2. Verificar que a tarefa criada tem `setor_id = "setor-coleta"`

**CT-05 — Sem regressão em BFS**
1. Verificar que `getEffectiveSectors` não lança erro para nenhum usuário
2. Verificar que performance não degradou (sem loop)

### Verificação de schema (não há migration — verificar que nada quebrou)

```sql
-- deve retornar resultados (coluna existe)
SELECT setor FROM usuarios LIMIT 1;

-- deve ser NULL ou erro de coluna (confirmar que setor_principal_id não existe)
SELECT setor_principal_id FROM usuarios LIMIT 1;  -- deve dar "no such column"

-- deve retornar resultados
SELECT id, nome, setor FROM usuarios WHERE setor IS NOT NULL;
```

---

## Fase 1 — O que vem depois (não implementar agora)

Após Fase 0 estar completa e testada:

1. **Conectar `getEffectiveSectors` ao `getKanbanData`**
   - Chamar `getEffectiveSectors(userId, this.db)` no início do método
   - Adicionar `AND (t.setor_id IN (${placeholders}) OR isAdminMgr)` à WHERE de tarefas
   - Parâmetros: `[...effectiveSectors, isAdminMgr ? 1 : 0]`

2. **Conectar `effectiveSectors` ao inbox**
   - Tornar `getInboxAccessFilter` assíncrona
   - Passar `effectiveSectors` para `buildInboxAccessFilter`
   - Ajustar `useInboxData` para aguardar o resultado

3. **Invalidar cache ao criar/editar/deletar setor**
   - Chamar `invalidateSectorCache()` em `useSetores.create/update/remove`

4. **`useKanbanData` — remover parâmetro `setor` de `getKanbanData`**
   - Limpar o parâmetro que era passado mas ignorado

---

## Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| `usuarios.setor` está vazio para todos os usuários existentes | Média | Se sim, Fase 1 ainda funciona via `usuarios_setores`; Fase 0 não quebra nada |
| `nome_usuario` vs `username` (colunas com nomes diferentes) | Baixa | Schema usa `nome_usuario`, código TS usa `username` — já mapeado em `SqliteUserRepository.rowToUser` |
| Usuário com `setor` preenchido E entrada em `usuarios_setores` recebe setor duplicado | Baixa | `UNION` em SQL deduplica por valor; se `setor = "X"` e `setor_id = "X"`, retorna `"X"` uma vez |
| Regressão em `createTask` se `setor` for uma string antiga (nome, não ID) | Baixa | `setores` usa UUIDs como `id`; se `usuarios.setor` contiver nome legado em vez de UUID, `resolveSetorId` retorna o valor mas FK não valida — monitorar logs |
