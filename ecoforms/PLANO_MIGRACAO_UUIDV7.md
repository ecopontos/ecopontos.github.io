# Plano de Migração: UUID → UUIDv7

## Status Atual

O projeto **Ecoforms** adota UUIDv7 parcialmente via `ecoforms-core`, mas ainda utiliza UUIDv4 (`crypto.randomUUID()`) em ~46 pontos do desktop e em todo o mobile. A migração para UUIDv7 unificado é **segura** porque:

- O schema do banco (SQLite/PostgreSQL) usa `TEXT PRIMARY KEY` — comporta tanto v4 quanto v7.
- A implementação `uuidv7()` já existe em `packages/core/src/utils/uuidv7.ts`.
- Não há ORM (Prisma/TypeORM) exigindo migração de schema.

---

## 1. Objetivo

Substituir **todas** as gerações de UUIDv4 por UUIDv7 em:

1. **Desktop** (Next.js / TypeScript)
2. **Mobile** (vanilla JS / Capacitor)
3. **Core** (`packages/core` — shared)

Remover dependência morta `uuid` do `desktop/package.json`.

---

## 2. Benefícios da Mudança

| Benefício | Descrição |
|-----------|-----------|
| **Ordenação temporal** | UUIDv7 incorpora timestamp de 48 bits no prefixo. Permite `ORDER BY id` sem índice extra em created_at. |
| **Localidade de cache** | IDs gerados próximos no tempo são lexicograficamente próximos. Melhora cache locality no SQLite/PostgreSQL (B-tree). |
| **Compatibilidade** | Formato string idêntico ao v4. Nenhuma mudança de schema necessária. |
| **Unificação** | Elimina dualidade v4/v7 no codebase. Reduz confusão de "qual usar". |
| **Segurança** | Mesma entropia aleatória de 74 bits do v4. Não há perda de unicidade. |

---

## 3. Escopo de Mudança

### 3.1. Desktop (~46 ocorrências de `crypto.randomUUID()`)

#### Páginas / UI
- `desktop/components/runtime/FormRenderer.tsx` (2x)
- `desktop/app/manifestacoes/page.tsx` (5x)
- `desktop/app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` (9x)
- `desktop/app/logistica/roteiros/[id]/RoteiroDetailPage.tsx` (4x)
- `desktop/app/clientes/[id]/ClienteDetailPage.tsx`
- `desktop/app/clientes/novo/page.tsx`
- `desktop/app/admin/sectors/page.tsx`

#### Hooks / Mutations
- `desktop/src/interface/hooks/mutations/useKanbanMutations.ts` (3x)
- `desktop/src/interface/hooks/mutations/useAnexoUpload.ts` (2x)
- `desktop/src/interface/hooks/mutations/useSeedDemo.ts` (8x)

#### Repositories / Infrastructure
- `desktop/src/infrastructure/persistence/sqlite/SqliteKanbanRepository.ts` (1x)
- `desktop/src/infrastructure/persistence/sqlite/SqliteTaskRepository.ts` (1x)
- `desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts` (1x)
- `desktop/src/infrastructure/persistence/sqlite/SqliteProjectRepository.ts`

#### Use Cases / Application
- `desktop/src/application/ouvidoria/VerificarPrazosVencidosJob.ts` (1x)
- `desktop/src/application/module/CreateModuleUseCase.ts` (1x)
- `desktop/src/application/demanda/CloseDemandaUseCase.ts` (1x)
- `desktop/src/application/demanda/CreateDemandaUseCase.ts`
- `desktop/src/application/task/CreateTaskUseCase.ts`
- `desktop/src/application/user/CreateUserUseCase.ts`
- `desktop/src/application/suite/SubmitSuiteUseCase.ts`

#### Scripts / Seeds
- `desktop/scripts/seed-bootstrap.ts`

#### Sync
- `desktop/src/infrastructure/sync/EventEnvelope.ts` (1x — fallback)
- `desktop/src/infrastructure/sync/InboundService.ts`
- `desktop/src/infrastructure/sync/SupabaseUserSyncService.ts`

### 3.2. Mobile
- `mobile/www/js/data-service.js` — método `generateUUID()` (usado em `saveFormData`, `saveEcopontoCaixasIncremental`, `createSnapshot`)
- `mobile/tests/data-service.sync.test.js` — testes validam regex de v4

### 3.3. Core
- `packages/core/src/sync/EventEnvelope.ts` — `createEnvelope()` usa `crypto.randomUUID()` como fallback (linha 133)
- `packages/core/src/utils/uuidv7.ts` — implementação existente (18 linhas)

### 3.4. Dependências
- `desktop/package.json` — `uuid: "^14.0.0"` (dependência morta, não importada em lugar nenhum)

---

## 4. Estratégia de Implementação

### Fase 1 — Preparação (Segurança)

1. **Remover dependência morta**
   - Remover `"uuid": "^14.0.0"` de `desktop/package.json`.
   - Rodar `npm install` no workspace desktop para atualizar lockfile.

2. **Auditar `uuidv7()` do core**
   - Verificar se `packages/core/src/utils/uuidv7.ts` está exportado corretamente no `index.ts` do core.
   - Validar que a implementação gera strings no formato válido RFC 9562.
   - Adicionar teste unitário básico se não existir (verificar formato regex + ordenação temporal).

3. **Criar utilitário mobile**
   - Como mobile é vanilla JS sem bundler moderno, criar `mobile/www/js/uuidv7.js` com a mesma lógica do core (adaptada para JS puro, sem TypeScript).
   - Exportar `generateUUIDv7()` globalmente para ser usado por `data-service.js`.

### Fase 2 — Desktop

**Padrão de substituição:**

```typescript
// ANTES
crypto.randomUUID()

// DEPOIS
import { uuidv7 } from 'ecoforms-core';
uuidv7()
```

**Passos:**

1. Para cada arquivo listado em 3.1:
   - Adicionar `import { uuidv7 } from 'ecoforms-core';` no topo.
   - Substituir todas as ocorrências de `crypto.randomUUID()` por `uuidv7()`.

2. **Cuidados especiais:**
   - `FormRenderer.tsx`: usado para IDs de campos dinâmicos. UUIDv7 é seguro (unicidade garantida).
   - `useSeedDemo.ts`: seeds geram múltiplos registros. UUIDv7 continua único e ordenável.
   - `EventEnvelope.ts` (core e desktop sync): envelope IDs precisam ser únicos. UUIDv7 é ideal pois adiciona ordenação temporal aos eventos.

3. **Atualizar testes desktop:**
   - `CreateTaskUseCase.test.ts`: substituir `vi.stubGlobal('crypto', { randomUUID: () => 'task-uuid-1' })` por `vi.mock('ecoforms-core', () => ({ uuidv7: () => 'task-uuid-1' }))`.
   - `sync-protocol.test.ts`: já mocka `ecoforms-core.uuidv7`. Verificar se precisa de ajuste (provavelmente não).
   - Revisar todos os testes que stubam `crypto.randomUUID`.

### Fase 3 — Mobile

**Padrão de substituição:**

```javascript
// ANTES (em data-service.js)
generateUUID() // v4

// DEPOIS
// importar ou usar generateUUIDv7() de mobile/www/js/uuidv7.js
generateUUIDv7()
```

**Passos:**

1. Criar `mobile/www/js/uuidv7.js`:

```javascript
function generateUUIDv7() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const ts = BigInt(Date.now());
  bytes[0] = Number((ts >> 40n) & 0xFFn);
  bytes[1] = Number((ts >> 32n) & 0xFFn);
  bytes[2] = Number((ts >> 24n) & 0xFFn);
  bytes[3] = Number((ts >> 16n) & 0xFFn);
  bytes[4] = Number((ts >> 8n) & 0xFFn);
  bytes[5] = Number(ts & 0xFFn);

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

if (typeof window !== 'undefined') {
  window.generateUUIDv7 = generateUUIDv7;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateUUIDv7 };
}
```

2. Referenciar `uuidv7.js` no `index.html` do mobile antes do `data-service.js`.

3. Substituir todas as chamadas de `this.generateUUID()` por `generateUUIDv7()` dentro de `DataService`.

4. Atualizar testes mobile:
   - `mobile/tests/data-service.sync.test.js`: atualizar regex de validação de UUID v4 para UUID v7.
   - Regex v7: `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

### Fase 4 — Core

1. `packages/core/src/sync/EventEnvelope.ts`:
   - Importar `uuidv7` do utils.
   - Substituir `crypto.randomUUID()` por `uuidv7()` na linha 133.

2. `packages/core/src/utils/uuidv7.ts`:
   - Garantir exportação no `index.ts` do core.
   - Adicionar teste unitário básico.

### Fase 5 — Validação

1. **Build desktop:**
   ```bash
   cd desktop && npm run build
   ```

2. **Testes desktop:**
   ```bash
   cd desktop && npx vitest run
   ```

3. **Testes mobile:**
   ```bash
   cd mobile && npm test  # ou comando equivalente
   ```

4. **Teste manual de geração:**
   - Gerar 1000 UUIDs consecutivos e verificar:
     - Todos únicos (Set size === 1000)
     - Todos ordenáveis lexicograficamente segundo timestamp
     - Todos casam com regex v7

5. **Teste de integração sync:**
   - Publicar evento desktop → consumir no inbound mobile.
   - Verificar que IDs gerados são v7 em ambos os lados.

---

## 5. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Dados legados com UUIDv4 em colunas `TEXT` | **Baixa** | Schema é `TEXT`, não há restrição de formato. v4 e v7 coexistem sem problema. |
| Mobile sem `crypto.getRandomValues` em dispositivos antigos | **Média** | `crypto.getRandomValues` é suportado em todo WebView moderno (Android 4.4+, iOS 11+). Fallback: lançar erro (já comportamento atual). |
| Testes quebrados por mudança de mock | **Baixa** | Atualizar mocks de `crypto.randomUUID` para `ecoforms-core.uuidv7`. UUID v7 é deterministicamente mockável. |
| Ordenação de IDs em queries existentes | **Baixa** | UUIDv7 é **lexicograficamente ordenável** por tempo. Queries que ordenam por `created_at` não precisam mudar, mas `ORDER BY id` agora também funciona cronologicamente. |
| Performance de `BigInt(Date.now())` | **Baixa** | `BigInt` + `Date.now()` é sub-milissegundo. Sem impacto perceptível. |
| Conflito de UUID em geração massiva paralela | **Muito baixa** | 74 bits de aleatoriedade + 48 bits de timestamp. Probabilidade de colisão é desprezível (mesmo nível do v4). |

---

## 6. Checklist de Execução

### Preparação
- [ ] Remover `"uuid": "^14.0.0"` de `desktop/package.json`
- [ ] Rodar `npm install` no desktop
- [ ] Verificar exportação de `uuidv7` no `index.ts` do `ecoforms-core`
- [ ] Criar `mobile/www/js/uuidv7.js`
- [ ] Referenciar `uuidv7.js` no `index.html` do mobile

### Desktop
- [ ] `desktop/components/runtime/FormRenderer.tsx`
- [ ] `desktop/app/manifestacoes/page.tsx`
- [ ] `desktop/app/manifestacoes/[id]/ManifestacaoDetailPage.tsx`
- [ ] `desktop/app/logistica/roteiros/[id]/RoteiroDetailPage.tsx`
- [ ] `desktop/app/clientes/[id]/ClienteDetailPage.tsx`
- [ ] `desktop/app/clientes/novo/page.tsx`
- [ ] `desktop/app/admin/sectors/page.tsx`
- [ ] `desktop/src/interface/hooks/mutations/useKanbanMutations.ts`
- [ ] `desktop/src/interface/hooks/mutations/useAnexoUpload.ts`
- [ ] `desktop/src/interface/hooks/mutations/useSeedDemo.ts`
- [ ] `desktop/src/infrastructure/persistence/sqlite/SqliteKanbanRepository.ts`
- [ ] `desktop/src/infrastructure/persistence/sqlite/SqliteTaskRepository.ts`
- [ ] `desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts`
- [ ] `desktop/src/infrastructure/persistence/sqlite/SqliteProjectRepository.ts`
- [ ] `desktop/src/application/ouvidoria/VerificarPrazosVencidosJob.ts`
- [ ] `desktop/src/application/module/CreateModuleUseCase.ts`
- [ ] `desktop/src/application/demanda/CloseDemandaUseCase.ts`
- [ ] `desktop/src/application/demanda/CreateDemandaUseCase.ts`
- [ ] `desktop/src/application/task/CreateTaskUseCase.ts`
- [ ] `desktop/src/application/user/CreateUserUseCase.ts`
- [ ] `desktop/src/application/suite/SubmitSuiteUseCase.ts`
- [ ] `desktop/scripts/seed-bootstrap.ts`
- [ ] `desktop/src/infrastructure/sync/EventEnvelope.ts`
- [ ] `desktop/src/infrastructure/sync/InboundService.ts`
- [ ] `desktop/src/infrastructure/sync/SupabaseUserSyncService.ts`
- [ ] Atualizar `CreateTaskUseCase.test.ts`
- [ ] Revisar demais testes que stubam `crypto.randomUUID`

### Mobile
- [ ] Substituir `generateUUID()` por `generateUUIDv7()` em `data-service.js`
- [ ] Atualizar `mobile/tests/data-service.sync.test.js`

### Core
- [ ] `packages/core/src/sync/EventEnvelope.ts`
- [ ] Garantir exportação de `uuidv7` no `packages/core/src/index.ts`
- [ ] Adicionar teste unitário para `uuidv7()`

### Validação
- [ ] `npm run build` no desktop passa
- [ ] `npx vitest run` no desktop passa
- [ ] Testes mobile passam
- [ ] Teste manual de geração de 1000 UUIDs v7 (unicidade + ordenação + regex)
- [ ] Teste de integração sync desktop → mobile

---

## 7. Decisões de Design

### Por que não usar biblioteca externa (`uuid` npm)?
A dependência `uuid` ^14.0.0 já está no `package.json` mas **não é importada em lugar nenhum**. Adicionar uma nova biblioteca externa para algo que já temos implementado em 18 linhas aumenta o bundle sem benefício. A implementação própria:
- É suficiente para o caso de uso.
- Não adiciona bytes ao bundle.
- É auditável em uma tela.

### Por que UUIDv7 em vez de continuar com v4?
- **Ordenação temporal:** essencial para sync (eventos, logs, snapshots). Permite `ORDER BY id` cronologicamente.
- **Localidade:** melhora performance de inserção em B-trees do SQLite/PostgreSQL.
- **Debugging:** IDs gerados próximos no tempo são visualmente próximos, facilita leitura de logs.

### O que fazer com dados legados v4?
**Nada.** Eles permanecem válidos. O schema é `TEXT` sem constraint de formato. A mudança é apenas na *geração* de novos UUIDs. IDs antigos v4 continuam funcionando perfeitamente.

---

## 8. Estimativa

| Fase | Tempo estimado |
|------|----------------|
| Fase 1 — Preparação | 30 min |
| Fase 2 — Desktop | 2-3h |
| Fase 3 — Mobile | 45 min |
| Fase 4 — Core | 15 min |
| Fase 5 — Validação | 1h |
| **Total** | **~5h** |

---

*Plano gerado em 19/05/2026. Aprovado para execução.*
