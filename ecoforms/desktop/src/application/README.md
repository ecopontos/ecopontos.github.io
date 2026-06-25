# Application Layer

Casos de uso (orquestração de lógica), DTOs (data transfer objects), e ports (contratos de infraestrutura).

## Características

- ✅ **Sem I/O direto:** chama repositórios via interfaces (ports)
- ✅ **Sem React:** apenas TypeScript puro
- ✅ **Sem infrastructure:** importa apenas domain + ports
- ✅ **Testável:** com fake repositories e fake ports
- ✅ **Orquestrador:** regras de negócio já estão em domain; aqui é composição

## Estrutura

```
application/
├── entity-name/
│   ├── CreateEntityUseCase.ts
│   ├── UpdateEntityUseCase.ts
│   ├── DeleteEntityUseCase.ts
│   ├── ListEntitiesUseCase.ts
│   ├── dto/
│   │   ├── EntityDto.ts
│   │   ├── CreateEntityInput.ts
│   │   ├── CreateEntityOutput.ts
│   │   └── EntityFilter.ts
│   └── mappers.ts                # DTO ↔ Entity
├── ports/
│   ├── ClockPort.ts              # Abstração de tempo
│   ├── LoggerPort.ts             # Abstração de logging
│   ├── FileStoragePort.ts        # Abstração de storage
│   ├── SqlitePort.ts             # Abstração de DB
│   ├── SyncPort.ts               # Abstração de sincronização
│   └── StorageSyncPort.ts        # Abstração de storage remoto
├── sync/
│   ├── PushTasksUseCase.ts
│   └── PullTasksUseCase.ts
└── shared/
    └── dependencies.ts           # Registro centralizado de portas (opcional)
```

## Padrão: Use Case

```typescript
// application/task/CreateTaskUseCase.ts
import type { TaskRepository } from '@/src/domain/task/TaskRepository';
import type { ClockPort } from '../ports/ClockPort';
import { Task } from '@/src/domain/task/Task';
import type { CreateTaskInput, CreateTaskOutput } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export class CreateTaskUseCase {
  constructor(
    private taskRepository: TaskRepository,
    private clock: ClockPort,
  ) {}

  async execute(input: CreateTaskInput): Promise<CreateTaskOutput> {
    // 1. Validação de entrada (opcional, pode estar em input.ts)
    if (!input.title.trim()) {
      throw new Error('Title cannot be empty');
    }

    // 2. Criar entidade de domínio
    const task = Task.create({
      title: input.title,
      status: new TaskStatus('pending'),
      assignedTo: input.assignedTo,
    });

    // 3. Persistir via repositório
    await this.taskRepository.save(task);

    // 4. Retornar DTO
    return toTaskDto(task);
  }
}
```

## Padrão: DTO (Data Transfer Object)

```typescript
// application/task/dto/TaskDto.ts
export interface TaskDto {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
  createdAt: string; // ISO string, não Date
}

export interface CreateTaskInput {
  title: string;
  assignedTo?: string;
}

export interface CreateTaskOutput extends TaskDto {}

export interface TaskFilter {
  projectId?: string;
  status?: string;
  assignedTo?: string;
}
```

**Regra:** DTOs usam tipos serializáveis (string, number, boolean, Date → ISO string).

## Padrão: Mapper

```typescript
// application/task/mappers.ts
import { Task } from '@/src/domain/task/Task';
import type { TaskDto } from './dto/TaskDto';

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    status: task.status.value,
    assignedTo: task.assignedTo,
    createdAt: task.createdAt.toISOString(),
  };
}

export function toTaskEntity(dto: TaskDto): Task {
  return new Task(
    dto.id,
    dto.title,
    new TaskStatus(dto.status as TaskStatusValue),
    dto.assignedTo,
    new Date(dto.createdAt),
  );
}
```

## Padrão: Port (Interface de Infraestrutura)

```typescript
// application/ports/FileStoragePort.ts
export interface FileStoragePort {
  upload(bucket: string, path: string, file: Blob): Promise<void>;
  download(bucket: string, path: string): Promise<Blob>;
  remove(bucket: string, path: string): Promise<void>;
  list(bucket: string, prefix: string): Promise<string[]>;
  getPublicUrl(bucket: string, path: string): Promise<string>;
}
```

**Nota:** A implementação (`SupabaseFileStorage`) fica em `infrastructure/`.

## Teste de Use Case

```typescript
// src/test/CreateTaskUseCase.test.ts
import { CreateTaskUseCase } from '@/src/application/task/CreateTaskUseCase';
import { FakeTaskRepository } from '@/src/test/fakes/FakeTaskRepository';
import { SystemClock } from '@/src/infrastructure/adapters/SystemClock';

describe('CreateTaskUseCase', () => {
  it('creates a task with valid input', async () => {
    const repo = new FakeTaskRepository();
    const clock = new SystemClock();
    const useCase = new CreateTaskUseCase(repo, clock);

    const output = await useCase.execute({
      title: 'Buy milk',
      assignedTo: 'user-123',
    });

    expect(output.id).toBeDefined();
    expect(output.title).toBe('Buy milk');
    expect(output.status).toBe('pending');
  });

  it('rejects empty title', async () => {
    const repo = new FakeTaskRepository();
    const useCase = new CreateTaskUseCase(repo, new SystemClock());

    await expect(useCase.execute({ title: '' })).rejects.toThrow(
      'Title cannot be empty',
    );
  });
});
```

## O que NÃO fazer aqui

❌ `import { invoke } from '@tauri-apps/api'`  
❌ `import { supabase } from '@/lib/supabase'`  
❌ `import { useQuery } from 'react-query'`  
❌ Lógica de negócio (fica em domain/)  
❌ Renderização React  

## O que FAZER aqui

✅ Orquestração: `repositório.save()`, `port.upload()`, etc.  
✅ Conversão: DTO ↔ Entity  
✅ Validação simples de entrada  
✅ Erros de negócio (`NotFoundError`, `InvalidTransitionError`)  

## Injeção de Dependência

```typescript
// src/infrastructure/container.ts — onde tudo é composto
export function buildContainer() {
  const sqlite = new tauriSqliteAdapter();
  const taskRepo = new SqliteTaskRepository(sqlite);
  const clock = new SystemClock();
  
  return {
    createTaskUseCase: new CreateTaskUseCase(taskRepo, clock),
    // ...
  };
}
```

Depois, no hook:
```typescript
// src/interface/hooks/useTask.ts
export function useTask() {
  const container = getContainer();
  return {
    create: (input) => container.createTaskUseCase.execute(input),
  };
}
```

## Leitura

- Clean Architecture (Martin) — cap. 20–22
- Patterns of Enterprise Application Architecture (Fowler) — cap. 5 (layers)
