# Plano — Sync para deleteTask e addComment (Tasks)

**Data:** 2026-06-09
**Status:** Concluído (2026-06-09)
**Contexto:** `task.excluida` e `task.comentario_adicionado` foram declarados no `EventEnvelope` core e os handlers inbound `task.excluida` já existem no `HandlerRegistry`. Faltam: emissão nos use cases, injeção de `SyncOutbox`, handler inbound de comentário, e handler inbound `task.excluida` na cópia raiz `src/`.

---

## Diagnóstico

### O que existe

| Componente | Arquivo | Estado |
|------------|---------|--------|
| `DeleteTaskUseCase` | `application/task/DeleteTaskUseCase.ts` | Existe, **sem SyncOutbox**, sem emissão |
| `AddTaskCommentUseCase` | `application/task/TaskCommentUseCases.ts` | Existe, **sem SyncOutbox**, sem emissão |
| `TaskRepository.delete()` | `domain/task/TaskRepository.ts:28` | Interface declarada |
| `SqliteTaskRepository.delete()` | `infrastructure/persistence/sqlite/SqliteTaskRepository.ts:159` | Implementado (soft delete com `deletado_em`) |
| `SqliteTaskRepository.addComment()` | `infrastructure/persistence/sqlite/SqliteTaskRepository.ts:198` | Implementado (INSERT em `tarefas_comentarios`) |
| `container.ts` | `infrastructure/container.ts:439,441` | Instancia sem `syncOutbox` |
| `EventEnvelope` core | `packages/core/src/sync/EventEnvelope.ts` | Tipos `task.excluida` e `task.comentario_adicionado` já declarados |
| Handler inbound `task.excluida` | `desktop/src/.../HandlerRegistry.ts` | ✅ Já existe |
| Handler inbound `task.comentario_adicionado` | — | ❌ Não existe |

### O que falta

1. **`DeleteTaskUseCase`** — injetar `SyncOutbox`, emitir `task.excluida` após `tasks.delete()`
2. **`AddTaskCommentUseCase`** — injetar `SyncOutbox`, emitir `task.comentario_adicionado` após `tasks.addComment()`
3. **`container.ts`** — passar `syncOutbox` nos construtores de ambos use cases
4. **`HandlerRegistry.ts`** — adicionar handler inbound `task.comentario_adicionado` (×2 cópias)

---

## Escopo

### Não entra

- Criar métodos `deleteTask`/`addComment` no `SqliteKanbanRepository` — esses já existem no `SqliteTaskRepository` (repositório de domínio). O `SqliteKanbanRepository` é um repositório de leitura/escrita para o Kanban board, não o repositório de domínio de tarefas.
- Alterar a interface `TaskRepository` — já tem `delete()` e `addComment()`.
- Alterar o `SqliteTaskRepository` — os métodos já funcionam corretamente.

---

## Implementação

### Ação 1 — `DeleteTaskUseCase.ts`

**Arquivo:** `desktop/src/application/task/DeleteTaskUseCase.ts`

```diff
+ import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
  import type { TaskRepository } from '../../domain/task/TaskRepository';

  export class DeleteTaskUseCase {
-     constructor(private readonly tasks: TaskRepository) {}
+     constructor(
+         private readonly tasks: TaskRepository,
+         private readonly sync: SyncOutbox,
+     ) {}

      async execute(id: string): Promise<void> {
          await this.tasks.delete(id);
+         await this.sync.write('task.excluida', {
+             tarefa_id: id,
+         }, { aggregateId: id });
      }
  }
```

**Impacto:** Toda exclusão de tarefa agora emite evento de sync. O dispositivo receptor aplica o DELETE via handler inbound.

---

### Ação 2 — `AddTaskCommentUseCase` (TaskCommentUseCases.ts)

**Arquivo:** `desktop/src/application/task/TaskCommentUseCases.ts`

```diff
+ import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
  import type { TaskRepository } from '../../domain/task/TaskRepository';

  export class AddTaskCommentUseCase {
-     constructor(private readonly tasks: TaskRepository) {}
+     constructor(
+         private readonly tasks: TaskRepository,
+         private readonly sync: SyncOutbox,
+     ) {}

      async execute(tarefaId: string, usuarioId: string, comentario: string): Promise<void> {
-         return this.tasks.addComment(tarefaId, usuarioId, comentario);
+         await this.tasks.addComment(tarefaId, usuarioId, comentario);
+         await this.sync.write('task.comentario_adicionado', {
+             tarefa_id: tarefaId,
+             usuario_id: usuarioId,
+             comentario,
+         }, { aggregateId: tarefaId });
      }
  }
```

**Impacto:** Todo comentário adicionado emite evento de sync. O dispositivo receptor insere o comentário na tabela `tarefas_comentarios` via handler inbound.

---

### Ação 3 — `container.ts`

**Arquivo:** `desktop/src/infrastructure/container.ts` (linhas 439, 441)

```diff
-         delete: new DeleteTaskUseCase(taskRepository),
+         delete: new DeleteTaskUseCase(taskRepository, syncOutbox),
          listByProject: new ListTasksByProjectUseCase(taskRepository),
-         addComment: new AddTaskCommentUseCase(taskRepository),
+         addComment: new AddTaskCommentUseCase(taskRepository, syncOutbox),
```

---

### Ação 4 — Handler inbound `task.comentario_adicionado`

**Arquivo:** `desktop/src/infrastructure/sync/HandlerRegistry.ts` (e cópia `src/infrastructure/sync/HandlerRegistry.ts`)

Inserir após o handler `task.excluida`:

```typescript
inbound.on('task.comentario_adicionado', async (env: EventEnvelope) => {
    const d = env.data as Record<string, unknown>;
    const tarefaId = d.tarefa_id ?? d.tarefaId ?? env.aggregate.id;
    await db.execute(
        `INSERT INTO tarefas_comentarios (id, tarefa_id, usuario_id, comentario, criado_em)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv7(), tarefaId, d.usuario_id ?? env.source.device_id ?? 'system',
         d.comentario ?? '', env.time],
    );
});
```

---

## Critérios de aceitação

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Excluir tarefa no device A | Tarefa desaparece no device B após sync |
| 2 | Adicionar comentário no device A | Comentário aparece no device B após sync |
| 3 | `tsc --noEmit` | Sem erros de tipo |
| 4 | `vitest run` — testes existentes de `DeleteTaskUseCase` | Passam (mock de `SyncOutbox` necessário se houver) |

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Testes existentes de `DeleteTaskUseCase` quebram (construtor mudou) | Alta | Atualizar mocks para incluir `SyncOutbox` fake |
| Comentário duplicado no receptor (se `addComment` for chamado 2x) | Baixa | `INSERT` sem `ON CONFLICT` — idempotência garantida pelo `uuidv7()` único |
| `tarefas_comentarios` sem constraint UNIQUE | Baixa | Verificar schema; se não tiver, considerar adicionar `(tarefa_id, usuario_id, comentario, criado_em)` |

---

## Arquivos afetados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `desktop/src/application/task/DeleteTaskUseCase.ts` | Injeção + emissão |
| `desktop/src/application/task/TaskCommentUseCases.ts` | Injeção + emissão |
| `desktop/src/infrastructure/container.ts` | Atualizar construtores |
| `desktop/src/infrastructure/sync/HandlerRegistry.ts` | Novo handler inbound |
| `src/infrastructure/sync/HandlerRegistry.ts` | Novo handler inbound (cópia) |
