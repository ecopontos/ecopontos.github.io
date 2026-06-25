# Infrastructure Layer

**Único lugar com imports de `@tauri-apps/*`, `@supabase/*`, e npm externo.**

Implementações de repositórios (domain interfaces) e adapters (application ports).

## Características

- ✅ **I/O aqui:** `invoke()`, `supabase.*`, `fetch()`
- ✅ **Implementações:** dos ports e repositórios abstratos
- ✅ **Isolado:** application e domain não dependem disto
- ✅ **Testável:** com mocks dos clientes externos
- ✅ **Swappable:** trocar Supabase por Firebase não quebra application

## Estrutura

```
infrastructure/
├── persistence/
│   ├── sqlite/
│   │   ├── tauriSqliteAdapter.ts          # Wraps invoke('db_query|db_execute')
│   │   ├── SqliteTaskRepository.ts        # Implementa TaskRepository
│   │   ├── SqliteSuiteRepository.ts
│   │   ├── SqliteClientRepository.ts
│   │   ├── SqliteCRMRepository.ts
│   │   ├── SqliteOuvidoriaRepository.ts
│   │   ├── SqliteDataRegistryRepository.ts
│   │   └── SqliteUserRepository.ts
│   └── supabase/
│       ├── supabaseClient.ts              # Singleton getSupabaseClient()
│       └── SupabaseTaskRepository.ts      # (Opcional: read-only mirror)
├── storage/
│   └── SupabaseFileStorage.ts             # Implementa FileStoragePort
├── adapters/
│   ├── SystemClock.ts                     # Implementa ClockPort
│   ├── ConsoleLogger.ts                   # Implementa LoggerPort
│   └── (Outros adapters específicos)
├── sync/
│   ├── SyncService.ts                     # Use cases de sync
│   ├── StorageSyncService.ts              # Storage remoto
│   ├── OfflineQueue.ts                    # Fila offline
│   └── (Sincronização I/O)
└── container.ts                            # DI Factory: compõe e injeta tudo
```

## Padrão: Adapter (Implementação de Port)

```typescript
// infrastructure/adapters/SystemClock.ts
import type { ClockPort } from '@/src/application/ports/ClockPort';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }
}
```

```typescript
// infrastructure/storage/SupabaseFileStorage.ts
import { getSupabaseClient } from '../persistence/supabase/supabaseClient';
import type { FileStoragePort } from '@/src/application/ports/FileStoragePort';

export class SupabaseFileStorage implements FileStoragePort {
  async upload(bucket: string, path: string, file: Blob): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.storage.from(bucket).upload(path, file);
    if (error) throw error;
  }

  async download(bucket: string, path: string): Promise<Blob> {
    const client = getSupabaseClient();
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) throw error;
    return data!;
  }

  // ... resto dos métodos
}
```

## Padrão: Repository (Implementação de Interface de Domínio)

```typescript
// infrastructure/persistence/sqlite/SqliteTaskRepository.ts
import type { TaskRepository } from '@/src/domain/task/TaskRepository';
import { Task, TaskStatus } from '@/src/domain/task/Task';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';
import type { TaskFilter } from '@/src/application/task/dto/TaskDto';

export class SqliteTaskRepository implements TaskRepository {
  constructor(private sqlite: SqlitePort) {}

  async findById(id: string): Promise<Task | null> {
    const rows = await this.sqlite.query(
      'SELECT * FROM tarefas WHERE id = ?',
      [id],
    );
    if (!rows.length) return null;
    return this.rowToTask(rows[0]);
  }

  async save(task: Task): Promise<void> {
    const sql = task.id
      ? 'UPDATE tarefas SET ... WHERE id = ?'
      : 'INSERT INTO tarefas (...) VALUES (...)';
    
    await this.sqlite.execute(sql, [
      task.id,
      task.title,
      task.status.value,
      // ... outros campos
    ]);
  }

  async query(filter: TaskFilter): Promise<Task[]> {
    let sql = 'SELECT * FROM tarefas WHERE 1=1';
    const params: unknown[] = [];
    
    if (filter.projectId) {
      sql += ' AND project_id = ?';
      params.push(filter.projectId);
    }
    
    const rows = await this.sqlite.query(sql, params);
    return rows.map(r => this.rowToTask(r));
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return new Task(
      row.id as string,
      row.title as string,
      new TaskStatus(row.status as TaskStatusValue),
      row.assigned_to as string | undefined,
      new Date(row.created_at as string),
    );
  }
}
```

## Padrão: SQLite Adapter (Único place com invoke)

```typescript
// infrastructure/persistence/sqlite/tauriSqliteAdapter.ts
import { invoke } from '@tauri-apps/api/core';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

export class tauriSqliteAdapter implements SqlitePort {
  async query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    return invoke('db_query', { sql, params });
  }

  async execute(sql: string, params: unknown[]): Promise<void> {
    await invoke('db_execute', { sql, params });
  }

  async transaction<T>(
    callback: (conn: SqlitePort) => Promise<T>,
  ): Promise<T> {
    try {
      await this.execute('BEGIN', []);
      const result = await callback(this);
      await this.execute('COMMIT', []);
      return result;
    } catch (e) {
      await this.execute('ROLLBACK', []);
      throw e;
    }
  }
}
```

**Regra:** `invoke()` NUNCA aparece em outros arquivos. Se precisar chamar Tauri de application/domain/interface, passe pelo adapter.

## DI Container

```typescript
// infrastructure/container.ts
import { SqliteTaskRepository } from './persistence/sqlite/SqliteTaskRepository';
import { SupabaseFileStorage } from './storage/SupabaseFileStorage';
import { SystemClock } from './adapters/SystemClock';
import { ConsoleLogger } from './adapters/ConsoleLogger';
import { CreateTaskUseCase } from '@/src/application/task/CreateTaskUseCase';

let _container: Container | null = null;

export interface Container {
  sqlite: SqlitePort;
  fileStorage: FileStoragePort;
  clock: ClockPort;
  logger: LoggerPort;
  // Use cases
  createTaskUseCase: CreateTaskUseCase;
  // ...
}

export function buildContainer(): Container {
  const sqlite = new tauriSqliteAdapter();
  const taskRepository = new SqliteTaskRepository(sqlite);
  const clock = new SystemClock();
  
  return {
    sqlite,
    fileStorage: new SupabaseFileStorage(),
    clock,
    logger: new ConsoleLogger(),
    createTaskUseCase: new CreateTaskUseCase(taskRepository, clock),
    // ... resto dos use cases
  };
}

export function getContainer(): Container {
  if (!_container) {
    _container = buildContainer();
  }
  return _container;
}

export function setContainer(container: Container): void {
  _container = container;
}

export function resetContainer(): void {
  _container = null;
}
```

## Teste com Fakes

```typescript
// src/test/CreateTaskUseCase.test.ts
import { CreateTaskUseCase } from '@/src/application/task/CreateTaskUseCase';
import { FakeTaskRepository } from '@/src/test/fakes/FakeTaskRepository';
import { FakeClock } from '@/src/test/fakes/FakeClock';

describe('CreateTaskUseCase', () => {
  it('saves to fake repository', async () => {
    const fakeRepo = new FakeTaskRepository();
    const fakeClock = new FakeClock(new Date('2026-04-27T10:00:00Z'));
    const useCase = new CreateTaskUseCase(fakeRepo, fakeClock);

    await useCase.execute({ title: 'Test' });

    expect(fakeRepo.saved).toHaveLength(1);
    expect(fakeRepo.saved[0].title).toBe('Test');
  });
});
```

## O que NÃO fazer aqui

❌ Lógica de negócio (fica em domain/)  
❌ Orquestração complexa (fica em application/)  
❌ React/hooks  

## O que FAZER aqui

✅ I/O: `invoke()`, `supabase.*`, `fetch()`, `fs.*`  
✅ Conversão: rows do DB → entities  
✅ Implementação: dos ports (interfaces)  
✅ Composição: container que injeta tudo  

## Regra de Ouro

> Se o código precisa de `@tauri-apps/*`, `@supabase/*`, ou `npm` externo, ele vai em `infrastructure/`.

Se está em `domain/`, `application/`, ou `interface/`, reroute via injeção de dependência.

## Leitura

- Clean Architecture (Martin) — cap. 26 (frameworks & drivers)
- Dependency Injection Principles, Practices, and Patterns (Seeman & van Deursen)
