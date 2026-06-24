# Interface Layer

Esta camada contém tudo que conecta a aplicação ao mundo externo: React hooks, presenters (view models) e adaptadores de UI. É a única camada que pode depender de React e de frameworks de apresentação.

---

## Estrutura

```
interface/
├── hooks/           # React hooks organizados por responsabilidade
│   ├── domain/      # Facades do DI container (use*UseCases)
│   ├── queries/     # Data fetching (leitura)
│   ├── mutations/   # Comandos (escrita)
│   ├── tauri/       # Wrappers de Tauri (confinados)
│   └── utils/       # Utilitários reutilizáveis
├── presenters/      # Conversão DTO → ViewModel
└── README.md        # Este arquivo
```

---

## Hooks — Quando usar o quê

| Subpasta | Quando usar | Exemplo |
|----------|-------------|---------|
| `domain/` | Você precisa chamar um **use case** da aplicação. São facades sobre o DI container. | `useTaskUseCases()`, `useClientUseCases()` |
| `queries/` | Você precisa **ler dados** diretamente do SQLite, Supabase ou estado local. | `useClientQueries()`, `useKanbanData()`, `useDemandas()` |
| `mutations/` | Você precisa **escrever dados** (INSERT, UPDATE, DELETE) ou executar comandos. | `useClientMutations()`, `useKanbanMutations()`, `useDataRegistryBulkInsert()` |
| `tauri/` | Você precisa interagir com APIs do **Tauri** (`invoke`, `dialog`, `fs`). | `useTauriInvoke()`, `useTauriDialog()` |
| `utils/` | Lógica reutilizável que não se encaixa nas categorias acima. | `useCEP()`, `useContainer()`, `useOnlineStatus()` |

**Regra de ouro:** se o hook faz `getContainer()` para obter use cases → `domain/`. Se faz `invoke` do Tauri → `tauri/`. Se é leitura pura → `queries/`. Se é escrita pura → `mutations/`.

---

## Como criar um novo hook de domínio

1. Crie o arquivo em `hooks/domain/use<Domain>UseCases.ts`
2. Use `getContainer()` de `../utils/useContainer` (ou `@/src/infrastructure/container`)
3. Retorne um `useMemo` com os use cases necessários:

```typescript
import { useMemo } from 'react';
import { getContainer } from '../utils/useContainer';

export function useInvoiceUseCases() {
    return useMemo(() => getContainer().invoices, []);
}
```

4. Atualize o DI container (`infrastructure/container.ts`) com a nova interface/factory se ainda não existir.

---

## Regras estritas

### 1. `@tauri-apps` só em `hooks/tauri/`

**NUNCA** importe `@tauri-apps/api/*`, `@tauri-apps/plugin-*` ou `invoke`/`listen` fora da subpasta `hooks/tauri/`.

Se um componente precisa de uma API do Tauri, ele deve usar um hook de `tauri/` — nunca importar diretamente.

```typescript
// ❌ ERRADO — em um componente ou hook de queries/
import { invoke } from '@tauri-apps/api/core';

// ✅ CERTO — usar o hook encapsulado
import { useTauriInvoke } from '@/src/interface/hooks/tauri/useTauriInvoke';
```

### 2. Não coloque lógica de negócio em hooks

Hooks de `queries/` e `mutations/` devem ser finos — orquestram chamadas, gerenciam estado de loading/erro, mas não tomam decisões de negócio. Regras de domínio ficam em `domain/` e `application/`.

### 3. Use presenters para transformar dados de exibição

Não formate datas, CNPJ, labels ou cores inline em componentes. Use presenters em `interface/presenters/`:

```typescript
// ❌ ERRADO — no componente
<div className={client.inativo ? 'text-red-600' : 'text-green-600'}>

// ✅ CERTO — presenter
import { toClientViewModel } from '@/src/interface/presenters/toClientViewModel';
const vm = toClientViewModel(client);
<div className={vm.statusColor}>
```

---

## Presenters

Presenters convertem DTOs (retornados pelos use cases) em **ViewModels** otimizados para a UI.

| Presenter | Domínio | O que formata |
|-----------|---------|---------------|
| `toTaskViewModel.ts` | Task | Status label, flag de atraso |
| `toClientViewModel.ts` | Client | CNPJ formatado, endereço completo, status color |
| `toDemandaViewModel.ts` | Demanda | Labels de status/origem, datas em pt-BR |

Para criar um novo presenter:
1. Crie `interface/presenters/to<Domain>ViewModel.ts`
2. Receba o DTO ou Entity como input
3. Retorne um interface `<Domain>ViewModel` com tudo formatado
4. Use em componentes em vez de formatar inline

---

## Import aliases recomendados

```typescript
// Hooks de domínio
import { useTaskUseCases } from '@/src/interface/hooks/domain/useTaskUseCases';

// Hooks de queries
import { useClientQueries } from '@/src/interface/hooks/queries/useClientQueries';

// Hooks de mutations
import { useKanbanMutations } from '@/src/interface/hooks/mutations/useKanbanMutations';

// Hooks de Tauri
import { useTauriInvoke } from '@/src/interface/hooks/tauri/useTauriInvoke';

// Presenters
import { toClientViewModel } from '@/src/interface/presenters/toClientViewModel';
```
