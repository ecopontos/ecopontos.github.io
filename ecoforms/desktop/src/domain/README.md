# Domain Layer

Entidades, value objects, e interfaces que definem o **contrato de persistência** e as **regras de negócio**.

## Características

- ✅ **Zero I/O:** sem `invoke()`, `supabase.*`, nem `fetch()`
- ✅ **Zero dependências externas:** apenas TypeScript stdlib e tipos
- ✅ **Sem React:** sem hooks, sem `@react/`
- ✅ **Testável:** unicamente com `new Entity()` e assertions

## Estrutura

```
domain/
├── entity-name/
│   ├── Entity.ts                 # Classe com métodos de negócio
│   ├── EntityStatus.ts           # Value object ou enum (ex: state machine)
│   └── EntityRepository.ts       # Interface (quem implementa fica em infra)
├── shared/
│   └── errors.ts                 # Exceções de domínio (DomainError, etc.)
└── access/
    └── AccessPolicy.ts           # Regras de acesso (puras, sem SQL)
```

## Padrão: Entity

```typescript
// domain/task/Task.ts
export interface TaskProps {
  id: string;
  title: string;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Task {
  constructor(
    readonly id: string,
    readonly title: string,
    private status: TaskStatus,
    private assignedTo?: string,
    readonly createdAt: Date = new Date(),
    readonly updatedAt: Date = new Date(),
  ) {}

  // Métodos de negócio
  moveTo(newStatus: TaskStatus): void {
    if (!this.status.canTransitionTo(newStatus)) {
      throw new InvalidTransitionError(this.status, newStatus);
    }
    this.status = newStatus;
  }

  assignTo(userId: string): void {
    this.assignedTo = userId;
  }

  static create(props: Omit<TaskProps, 'id' | 'createdAt' | 'updatedAt'>): Task {
    return new Task(
      generateId(),
      props.title,
      props.status,
      props.assignedTo,
      new Date(),
      new Date(),
    );
  }
}
```

## Padrão: Repository Interface

```typescript
// domain/task/TaskRepository.ts
export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProject(projectId: string): Promise<Task[]>;
  save(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
  query(filter: TaskFilter): Promise<Task[]>;
}
```

**Nota:** A implementação (`SqliteTaskRepository`) fica em `infrastructure/`, não aqui.

## Padrão: Value Object (State Machine)

```typescript
// domain/task/TaskStatus.ts
export type TaskStatusValue = 'pending' | 'in-progress' | 'done' | 'archived';

export class TaskStatus {
  constructor(readonly value: TaskStatusValue) {}

  canTransitionTo(newStatus: TaskStatus): boolean {
    const allowed = {
      'pending': ['in-progress', 'archived'],
      'in-progress': ['done', 'pending'],
      'done': ['in-progress', 'archived'],
      'archived': [],
    };
    return allowed[this.value]?.includes(newStatus.value) ?? false;
  }

  equals(other: TaskStatus): boolean {
    return this.value === other.value;
  }
}
```

## Padrão: Erro de Domínio

```typescript
// domain/shared/errors.ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Cannot transition from ${from.value} to ${to.value}`);
    this.name = 'InvalidTransitionError';
  }
}
```

## O que NÃO fazer aqui

❌ `import { invoke } from '@tauri-apps/api/core'`  
❌ `import { supabase } from '@/lib/supabase'`  
❌ `import { useQuery } from 'react-query'`  
❌ `const data = await fetch(...)`  
❌ `this.db.query(sql)`  

## Teste Unitário (Exemplo)

```typescript
// src/test/task.test.ts
import { Task, TaskStatus } from '@/src/domain/task/Task';
import { InvalidTransitionError } from '@/src/domain/shared/errors';

describe('Task state machine', () => {
  it('allows transition from pending to in-progress', () => {
    const task = Task.create({
      title: 'Test',
      status: new TaskStatus('pending'),
    });
    expect(() => task.moveTo(new TaskStatus('in-progress'))).not.toThrow();
  });

  it('rejects transition from done to pending', () => {
    const task = Task.create({
      title: 'Test',
      status: new TaskStatus('done'),
    });
    expect(() => task.moveTo(new TaskStatus('pending'))).toThrow(InvalidTransitionError);
  });
});
```

## Leitura

- Domain-Driven Design (Evans) — cap. 4, 5
- Growing Object-Oriented Software (Freeman & Pryce) — cap. 4
