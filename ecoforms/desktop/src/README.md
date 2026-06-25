# Clean Architecture Layers

Este diretório organiza o código em 4 camadas isoladas com dependências direcionadas:

```
Interface (UI, React) → Application (Use Cases) → Infrastructure (Implementations)
                                    ↓
                              Domain (Entities)
```

## Convenções de Nomenclatura

### Domain (`./domain/`)
Entidades, value objects, e interfaces de repositório. **Nunca tem I/O, nunca importa de fora.**

- `Entity.ts` — classe com métodos de negócio (ex: `Task.ts`)
- `EntityStatus.ts` — value object + state machine (ex: `TaskStatus.ts`)
- `EntityRepository.ts` — interface abstrata (ex: `TaskRepository.ts`)
- `errors.ts` — exceções de domínio

### Application (`./application/`)
Casos de uso (orquestração), DTOs, e ports (contratos de infraestrutura). **Sem React, sem imports de infrastructure.**

- `entity/CreateEntityUseCase.ts` — operação isolada
- `entity/dto/EntityDto.ts` — estrutura de transferência
- `ports/PortName.ts` — interface que infra implementa
- `mappers.ts` — DTO ↔ Entity

**Exemplo:**
```typescript
// CreateTaskUseCase.ts
export class CreateTaskUseCase {
  constructor(
    private taskRepo: TaskRepository,
    private clock: ClockPort,
  ) {}
  
  async execute(input: CreateTaskInput): Promise<TaskDto> {
    const task = new Task(input);
    await this.taskRepo.save(task);
    return toTaskDto(task);
  }
}
```

### Infrastructure (`./infrastructure/`)
**Único lugar com imports de `@tauri-apps`, `@supabase`, e npm externo.** Implementações dos ports e repositórios.

- `persistence/sqlite/SqliteEntityRepository.ts` — implementa `EntityRepository`
- `persistence/supabase/supabaseClient.ts` — singleton do Supabase
- `adapters/SystemClock.ts` — implementa `ClockPort`
- `sync/SyncService.ts` — sincronização (I/O apenas)
- `container.ts` — factory que compõe e injeta dependências

**Regra de ouro:** se precisa de `invoke()`, `supabase.*`, ou `fs.*`, fica aqui.

### Interface (`./interface/`)
**React adapters:** hooks que chamam use cases, nenhuma lógica de negócio.

- `hooks/useEntity.ts` — orquestra casos de uso, retorna loading/data/error
- `hooks/useTauriInvoke.ts` — wrapper que encapsula `@tauri-apps/api/core`
- `presenters/toEntityViewModel.ts` — DTO → ViewModel para componente

**Exemplo:**
```typescript
// useTask.ts
export function useTask() {
  const container = getContainer();
  return {
    create: (input) => container.taskService.createTask(input),
    move: (id, status) => container.taskService.moveTask(id, status),
  };
}
```

## Regras de Dependência (Enforcement via ESLint)

| De ↓ | Domain | Application | Infrastructure | Interface |
|---|---|---|---|---|
| **Domain** | ✅ | ❌ | ❌ | ❌ |
| **Application** | ✅ | ✅ | ❌ | ❌ |
| **Infrastructure** | ✅ | ✅ (só ports) | ✅ | ❌ |
| **Interface** | ✅ (types) | ✅ | ❌ | ✅ |

## Checklist: Novo Módulo

Ao adicionar `src/domain/novo-modulo/`:

- [ ] Criar entidade: `src/domain/novo-modulo/Entity.ts`
- [ ] Criar repositório interface: `src/domain/novo-modulo/EntityRepository.ts`
- [ ] Criar use cases: `src/application/novo-modulo/*UseCase.ts`
- [ ] Criar DTOs: `src/application/novo-modulo/dto/`
- [ ] Criar implementação: `src/infrastructure/persistence/sqlite/SqliteEntityRepository.ts`
- [ ] Injetar em container: `src/infrastructure/container.ts`
- [ ] Criar hook: `src/interface/hooks/useEntity.ts`
- [ ] Atualizar `<root>/src/test/fakes/` com repositório mock
- [ ] Lint: `npm run lint` (deve passar)

## Testes

Use repositórios fake em `src/test/fakes/`:

```typescript
// Exemplo
import { FakeTaskRepository } from '@/src/test/fakes/FakeTaskRepository';

const useCase = new CreateTaskUseCase(new FakeTaskRepository(), new SystemClock());
const result = await useCase.execute({ title: 'Test' });
expect(result.id).toBeDefined();
```

## Leitura Recomendada

- Domain-Driven Design (Eric Evans) — cap. 4 (entities)
- Clean Architecture (Robert C. Martin) — cap. 20–22 (layers)
- https://martinfowler.com/bliki/AnemicDomainModel.html (anti-pattern: evitar)
