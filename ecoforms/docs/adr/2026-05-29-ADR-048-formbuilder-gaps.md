# ADR-048: Gaps identificados no módulo FormBuilder

**Data:** 2026-05-29  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** `desktop/components/forms/*`, `desktop/app/forms/edit/page.client.tsx`, `desktop/lib/form/field-type-map.ts`, `desktop/src/domain/widget/`, `desktop/src/application/widgets/`, `mobile/www/ai-form-builder.*`, `EcoForms/`  
**ADRs relacionados:** ADR-023 (RBAC), ADR-040 (Ecopontos gaps), ADR-041 (Tasks gaps)

---

## Contexto

O FormBuilder é o módulo responsável por criar, editar e renderizar formulários dinâmicos associados a tarefas e ecopontos. A auditoria revela que **a camada de construção visual existe e está funcionando parcialmente, mas está desconectada da infraestrutura de widgets (domínio DDD completo nunca conectado), persiste dados via SQLite local sem integração Supabase, e tem o tipo `FormField` definido em três lugares sem sincronização**. Adicionalmente, o diretório `EcoForms/` está vazio e dois arquivos `.backup` indicam refatorações suspensas.

---

## Mapa de Componentes do FormBuilder

```
desktop/components/forms/
  ├── VisualEditor.tsx          — editor principal drag-and-drop
  ├── SchemaEditor.tsx          — editor JSON + FIELD_GROUPS + rascunho localStorage
  ├── FieldPropertiesPanel.tsx  — painel de propriedades do campo selecionado
  ├── FormPropertiesPanel.tsx   — propriedades globais do formulário
  ├── FormLayoutConfig.tsx      — configuração de layout (colunas, espaçamento)
  ├── FormAccessModal.tsx       — gestão de acesso por usuário
  ├── VisibilityRulesEditor.tsx — regras de visibilidade condicional entre campos
  └── JsonEditor.tsx            — editor JSON raw com parse/validação sintática

desktop/app/forms/edit/
  └── page.client.tsx           — carrega formulário via Tauri invoke() → SQLite nativo

desktop/lib/form/
  ├── field-type-map.ts         — aliases: select-field→select, camera→photo, etc.
  └── brasilia-time.ts          — utilitário de fuso horário para campos datetime

desktop/src/
  ├── domain/widget/
  │     ├── UserWidgetInstance.ts          — entidade de domínio
  │     ├── UserWidgetInstanceRepository.ts — interface abstrata (sem implementação)
  │     └── WidgetRegistry.ts              — registry em memória (nunca populado)
  └── application/widgets/
        ├── WidgetUseCases.ts              — CRUD de widgets (chama repositório inexistente)
        ├── SchemaDiscoveryService.ts      — descobre campos de datasources (zero callers)
        └── builtin/                       — widgets embutidos (não registrados)

mobile/www/
  ├── ai-form-builder.html      — builder mobile estático (sem versionamento)
  └── js/ai-form-builder.js     — JS do builder mobile (duplica lógica do desktop)

EcoForms/                       — apenas .gitattributes, sem implementação
VisualEditor.tsx.backup         — refatoração suspensa
```

---

## Gaps Detalhados

### Gap 1 — `UserWidgetInstanceRepository` sem implementação (Crítico — Runtime Error)

**Arquivo:** `desktop/src/domain/widget/UserWidgetInstanceRepository.ts`, `desktop/src/application/widgets/WidgetUseCases.ts`

```typescript
// UserWidgetInstanceRepository.ts — interface pura, sem implementação concreta
export interface UserWidgetInstanceRepository {
    findByUserId(userId: string): Promise<UserWidgetInstance[]>;
    save(instance: UserWidgetInstance): Promise<void>;
    delete(instanceId: string): Promise<void>;
}

// WidgetUseCases.ts:52 — chama repositório que nunca foi injetado
async updateWidget(instanceId: string, props: Record<string, unknown>) {
    const existing = await this.repo.findByUserId(userId);
    // this.repo é undefined em produção — nenhuma classe implementa a interface
}
```

Nenhuma classe (`SqliteUserWidgetInstanceRepository`, `SupabaseUserWidgetInstanceRepository`) foi criada. O container DI nunca injeta `UserWidgetInstanceRepository`. Qualquer chamada a `WidgetUseCases` lança `TypeError: Cannot read properties of undefined`.

**Decisão:** Criar `SqliteUserWidgetInstanceRepository` implementando a interface e registrá-la no container.

---

### Gap 2 — `WidgetRegistry.registerWidget()` nunca chamado (Crítico)

**Arquivo:** `desktop/src/domain/widget/WidgetRegistry.ts`, `desktop/src/application/widgets/builtin/`

```typescript
// WidgetRegistry.ts — registry em memória
const _registry = new Map<string, WidgetDefinition>();

export function registerWidget(def: WidgetDefinition) {
    _registry.set(def.type, def);
}

export function getWidget(type: string): WidgetDefinition | undefined {
    return _registry.get(type);  // ← sempre undefined; nunca houve registerWidget()
}
```

O diretório `builtin/` contém definições de widgets, mas nenhum arquivo de bootstrap chama `registerWidget()`. O `VisualEditor` ao tentar resolver um widget por tipo obtém `undefined` — queda silenciosa ou fallback para componente genérico.

**Decisão:** Criar `widgets/bootstrap.ts` que importa todos os builtin e chama `registerWidget()` para cada um; importar no entry-point do desktop.

---

### Gap 3 — `SchemaDiscoveryService` implementado mas nunca usado (Crítico) ✅ RESOLVIDO (2026-06-09)

**Arquivo:** `desktop/src/application/widgets/SchemaDiscoveryService.ts` (criado), `desktop/components/forms/FieldPropertiesPanel.tsx:70-85`

**Diagnóstico:** `SchemaDiscoveryService` não existia no disco (confirmado por grep zero no `src/`). O `FieldPropertiesPanel` usava um `KNOWN` map hardcoded com 7 datasources. Datasources novos adicionados ao `DataRegistry` não atualizavam o map — `suggestFilterProperty` falhava silenciosamente.

**Solução aplicada:**
1. Criado `desktop/src/application/widgets/SchemaDiscoveryService.ts` — classe com cache lazy-populated (`_idFieldCache` + `_itemsCache`)
2. `suggestFilterProperty` em `FieldPropertiesPanel.tsx` agora consulta `SchemaDiscoveryService.discoverFilterProperty(ds)` antes do KNOWN map
3. `DataSourceSchemaPreview` alimenta o cache via `SchemaDiscoveryService.feedItems(tipo, items)`
4. KNOWN map preservado como fallback para datasources sem dados carregados

---

### Gap 4 — FormBuilder persiste via SQLite/Tauri sem Supabase (Crítico — Arquitetura)

**Arquivo:** `desktop/app/forms/edit/page.client.tsx:9-33`, `desktop/components/forms/SchemaEditor.tsx:244-280`

```typescript
// page.client.tsx — Tauri nativo, sem abstração de repositório
const result = await invoke<QueryResult>('db_query', {
    sql: 'SELECT * FROM formularios WHERE id = ?',
    params: [formId]
});

// SchemaEditor.tsx:244 — salva direto em SQLite local
const db = await getContainerAsync();
await db.sqlite.execute(exists ? updateSqlNative : insertSqlNative, nativeParams);
```

Formulários só existem no SQLite local do dispositivo. Sem backup em cloud, sem audit trail, sem colaboração em tempo real, sem acesso de outro dispositivo. Contrasta com tarefas e manifestações que já usam estratégia de sync com Supabase.

**Consequência:** Se o dispositivo for resetado, todos os formulários são perdidos.

**Decisão:** Criar `FormularioRepository` (interface + `SqliteFormularioRepository` + `SupabaseFormularioRepository`) e integrar ao pipeline de sync existente. No mínimo curto prazo: adicionar `FormularioRepository` com implementação SQLite e estruturar para futura adição de sync.

---

### Gap 5 — Tipo `FormField` definido em três lugares sem sincronização (Crítico)

**Arquivos:** `FieldPropertiesPanel.tsx:132-165`, `SchemaEditor.tsx:29-79`, `desktop/lib/form/field-type-map.ts:11-22`

```typescript
// field-type-map.ts — aliases de normalização
const FIELD_TYPE_MAP: Record<string, string> = {
    'select-field': 'select',
    'camera':       'photo',
    'text-field':   'text',
    // ...
};

// SchemaEditor.tsx:29 — FIELD_GROUPS com categorias
const FIELD_GROUPS = [
    { label: 'Texto', fields: ['text', 'textarea', 'number'] },
    { label: 'Seleção', fields: ['select', 'radio', 'chips'] },
    // sem 'select-field', sem 'camera' — aliases não representados
];

// FieldPropertiesPanel.tsx:132 — lista de tipos UI
const FIELD_TYPES = ['text', 'select', 'select-field', 'radio', ...];
// inclui aliases que SchemaEditor não conhece
```

`select-field` é renderizado como opção em `FieldPropertiesPanel` mas não existe em `FIELD_GROUPS` do `SchemaEditor`. Se o usuário criar um campo `select-field` no visual editor e abrir o SchemaEditor, o tipo aparece como desconhecido. `field-type-map.ts` normaliza, mas só é chamado em caminhos específicos — não há garantia de normalização antes de persistir.

**Decisão:** Criar `desktop/lib/form/form-field-types.ts` como fonte única de verdade com tipos canônicos + aliases + grupos. Todos os componentes importam deste arquivo.

---

### Gap 6 — `JsonEditor` sem validação estrutural (Crítico)

**Arquivo:** `desktop/components/forms/JsonEditor.tsx:26-38`

```typescript
try {
    const parsed = JSON.parse(newVal);
    // ← apenas valida sintaxe JSON; não valida que parsed tem { campos: [], layout: {} }
    onChange(parsed);
} catch {
    setError('JSON inválido');
}
```

JSON sintaticamente correto mas estruturalmente inválido (ex: `{"foo": 123}`) é aceito e salvo. O formulário fica corrompido silenciosamente — o `VisualEditor` falha ao tentar iterar `parsed.campos` que não existe, sem mensagem de erro útil.

**Decisão:** Adicionar schema Zod para `FormSchema` e validar `parsed` antes de chamar `onChange`:

```typescript
import { FormSchema } from '@/lib/form/schemas';
const result = FormSchema.safeParse(parsed);
if (!result.success) { setError(result.error.issues[0].message); return; }
onChange(result.data);
```

---

### Gap 7 — `hasCyclicDependency` sem limite de profundidade (Importante)

**Arquivo:** `desktop/components/forms/FieldPropertiesPanel.tsx:87-99`

```typescript
const dfs = (currentId: string): boolean => {
    if (currentId === fieldId) return true;
    const field = fields.find(f => f.id === currentId);
    if (!field?.dependency?.fieldId) return false;
    return dfs(field.dependency.fieldId);  // ← sem MAX_DEPTH
};
```

Com 100+ campos em cadeia circular (A→B→C→...→A), a recursão causa stack overflow. O JavaScript não tem TCO — com formulários grandes, o browser trava.

**Decisão:** Adicionar `depth` como parâmetro com `MAX_DEPTH = 50`:

```typescript
const dfs = (currentId: string, depth = 0): boolean => {
    if (depth > 50) return true; // assume cycle
    ...
    return dfs(field.dependency.fieldId, depth + 1);
};
```

---

### Gap 8 — `FormAccessModal` sem refetch após edição (Importante)

**Arquivo:** `desktop/components/forms/FormAccessModal.tsx:30-31`

```typescript
const { users, loading, refetch } = useUsersByForm(open ? formId : undefined);
// refetch() nunca é chamado após adicionar/remover usuário
```

Admin abre modal, adiciona usuário ao formulário, fecha e reabre — vê lista desatualizada (do cache anterior). Só atualiza se recarregar a página.

**Decisão:** Chamar `refetch()` no callback de sucesso das mutações de acesso.

---

### Gap 9 — `localStorage` quota exceeded silencioso (Importante)

**Arquivo:** `desktop/components/forms/SchemaEditor.tsx:113-162`

```typescript
try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
} catch {
    // quota exceeded — sem aviso ao usuário, sem fallback
}
```

Formulários grandes (100+ campos) com histórico de rascunhos podem esgotar o localStorage. O rascunho é silenciosamente descartado; o usuário perde trabalho sem saber.

**Decisão:** No catch, exibir `toast.warning('Rascunho não salvo: armazenamento cheio')` e tentar limpar rascunhos mais antigos antes de desistir.

---

### Gap 10 — Zero testes automatizados em todos os componentes (Importante)

**Arquivos:** `desktop/components/forms/*` — 8 componentes, nenhum arquivo `.test.tsx`

Funções críticas sem cobertura:
- `hasCyclicDependency` (FieldPropertiesPanel) — lógica de ciclo
- `normalizeFieldOptions` — chamada 6x, sem memoization
- `buildVisibilityRule` (VisibilityRulesEditor) — lógica complexa de condicionais
- `JSON.parse` + validação (JsonEditor)
- `draft save/restore` (SchemaEditor)

**Decisão:** Adicionar testes Jest/Vitest. Prioridade: `FieldPropertiesPanel` (ciclo + normalização), `JsonEditor` (parse), `SchemaEditor` (rascunho).

---

### Gap 11 — `EcoForms/` vazio (Médio)

**Arquivo:** `/mnt/shared/htdocs/app/EcoForms/`

Diretório existe apenas com `.gitattributes`. Se era para ser um pacote separado de formulários para ecopontos, nunca foi implementado. O código de formulários de ecopontos existe disperso em `desktop/components/forms/` sem separação clara.

**Decisão:** Remover o diretório ou documentar o escopo pretendido e criar issue de backlog.

---

### Gap 12 — `VisualEditor.tsx.backup` — refatoração suspensa (Médio)

**Arquivo:** `desktop/components/forms/VisualEditor.tsx.backup`

Arquivo de backup indica que uma refatoração do `VisualEditor` foi iniciada e suspensa. O arquivo atual e o backup podem estar divergindo. Não há como saber qual versão tem as correções mais recentes sem diff manual.

**Decisão:** Executar `diff VisualEditor.tsx VisualEditor.tsx.backup`, integrar as partes úteis do backup no arquivo atual e deletar o `.backup`.

---

### Gap 13 — Mobile FormBuilder desacoplado do desktop (Médio) ✅ RESOLVIDO (2026-06-09)

**Arquivos:** `mobile/www/ai-form-builder.html`, `mobile/www/js/ai-form-builder.js`

**Solução aplicada:**
1. Criado `packages/core/src/sync/schemas/form-schema.json` — JSON Schema canônico com 25+ field types, propriedades, dependency, visibility rules
2. Criado `packages/core/src/sync/schemas/form-schema-validator.ts` — validador TypeScript + type guards (`validateFormSchema`, `isValidFieldType`, `normalizeFieldType`) + interface `FormSchemaContract`
3. Exportado via `ecoforms-core/sync` (`packages/core/src/sync/index.ts`)
4. `mobile/www/js/ai-form-builder.js` atualizado:
   - System prompt expandido com todos os tipos canônicos
   - `parseFormJson` agora valida contra o contrato compartilhado via `_validateFormSchema()` inline
   - Validador inline mantido sincronizado com o TS validator

---

### Gap 14 — `UpdateWidgetUseCase` acessa `props` como campo público (Baixo)

**Arquivo:** `desktop/src/application/widgets/WidgetUseCases.ts:52`

```typescript
// Spread de propriedade que deveria ser encapsulada
return { ...existing['props'], ...newProps };
```

Acessa `props` via string literal em vez de getter — viola encapsulamento de `UserWidgetInstance`. Frágil a renomeações. Não é bug hoje mas impede que a entidade imponha invariantes em `props`.

---

## Impacto Downstream

| Módulo | Dependência | Situação |
|--------|-------------|----------|
| **Ecopontos** | formulários associados a visitas | ❌ sem sync Supabase — dados locais apenas |
| **Tarefas** | formulários associados a tarefas | ❌ idem |
| **Widgets (dashboard)** | `WidgetUseCases` + registry | ❌ registry vazio + repository sem impl |
| **Mobile** | ai-form-builder | ⚠️ funciona em isolamento, sem contrato compartilhado |
| **RBAC (ADR-023)** | acesso a formulários por setor | ❌ `FormAccessModal` só por usuário, sem filtro de setor |

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço | Status |
|---|-----|-----------|-----------|---------|--------|
| 1 | `UserWidgetInstanceRepository` sem implementação | Crítico | `WidgetUseCases.ts`, `UserWidgetInstanceRepository.ts` | Médio | ⏳ Backlog |
| 2 | `WidgetRegistry.registerWidget()` nunca chamado | Crítico | `WidgetRegistry.ts`, `builtin/` | Baixo | ⏳ Backlog |
| 3 | `SchemaDiscoveryService` com zero callers | Crítico | `SchemaDiscoveryService.ts`, `FieldPropertiesPanel.tsx:70` | Médio | ✅ Resolvido |
| 4 | Persistência apenas SQLite local, sem Supabase | Crítico | `page.client.tsx`, `SchemaEditor.tsx:244` | Alto | ⏳ Backlog |
| 5 | `FormField` em 3 arquivos sem sincronização | Crítico | `FieldPropertiesPanel.tsx`, `SchemaEditor.tsx`, `field-type-map.ts` | Baixo | ✅ Resolvido (anterior) |
| 6 | `JsonEditor` sem validação estrutural (sem Zod) | Crítico | `JsonEditor.tsx:26` | Baixo | ✅ Resolvido (anterior) |
| 7 | `hasCyclicDependency` sem limite de profundidade | Importante | `FieldPropertiesPanel.tsx:87` | Trivial | ✅ Resolvido (anterior) |
| 8 | `FormAccessModal` sem refetch após mutação | Importante | `FormAccessModal.tsx:30` | Trivial | ✅ Resolvido (anterior) |
| 9 | `localStorage` quota exceeded silencioso | Importante | `SchemaEditor.tsx:113` | Trivial | ✅ Resolvido (anterior) |
| 10 | Zero testes em todos os componentes forms | Importante | `components/forms/*` | Alto | ⏳ Backlog |
| 11 | `EcoForms/` vazio | Médio | `EcoForms/` | Trivial | ✅ Resolvido (anterior) |
| 12 | `VisualEditor.tsx.backup` — refatoração suspensa | Médio | `VisualEditor.tsx.backup` | Baixo | ⏳ Backlog |
| 13 | Mobile FormBuilder sem contrato compartilhado | Médio | `mobile/www/ai-form-builder.*` | Médio | ✅ Resolvido |
| 14 | `UpdateWidgetUseCase` acessa `props` como público | Baixo | `WidgetUseCases.ts:52` | Trivial | ⏳ Backlog |

---

## Ordem de Resolução (atualizada 2026-06-09)

```
Fase 0 — Desbloqueio ✅ CONCLUÍDO
  1. Consolidar FormField types → form-field-types.ts (Gap 5) ✅
  2. Adicionar validação Zod no JsonEditor (Gap 6) ✅
  3. Fix hasCyclicDependency MAX_DEPTH (Gap 7) ✅
  4. Triviais: refetch FormAccessModal (Gap 8), localStorage toast (Gap 9) ✅

Fase 1 — Conectar infraestrutura de widgets (parcial)
  5. Criar SqliteUserWidgetInstanceRepository (Gap 1) ⏳
  6. Criar widgets/bootstrap.ts com registerWidget() (Gap 2) ⏳
  7. Injetar SchemaDiscoveryService em FieldPropertiesPanel (Gap 3) ✅
  8. Resolver VisualEditor.backup — merge ou delete (Gap 12) ⏳
  9. Remover EcoForms/ ou documentar (Gap 11) ✅

Fase 2 — Persistência e sync (parcial)
  10. Criar FormularioRepository interface + SqliteFormularioRepository (Gap 4) ⏳
  11. Estruturar sync com Supabase para formulários (Gap 4) ⏳
  12. Definir contrato JSON compartilhado mobile/desktop (Gap 13) ✅

Fase 3 — Cobertura de testes (roadmap)
  13. Testes: FieldPropertiesPanel (ciclo), JsonEditor (parse/Zod), SchemaEditor (draft) ⏳
```

---

## O que está bem (não tocar)

- `VisibilityRulesEditor` — lógica de condicionais bem estruturada, regras compostas corretas
- `FormLayoutConfig` — configuração de colunas/espaçamento sem bugs aparentes
- `FormPropertiesPanel` — validações básicas de título/slug presentes
- `brasilia-time.ts` — utilitário isolado e correto
- `field-type-map.ts` — normalização de aliases funciona; problema é não ser a fonte única
- `SchemaEditor` FIELD_GROUPS — categorias bem organizadas; problema é não sincronizar com FieldPropertiesPanel

## Relação com ADRs Existentes

- **ADR-023 (RBAC Fase 2):** `FormAccessModal` controla acesso por usuário individual — ao implementar RBAC por setor, o modal precisa suportar acesso baseado em setor também
- **ADR-040 (Ecopontos):** persistência SQLite local sem Supabase é o mesmo padrão identificado; a solução de repositório se aplica a ambos
- **ADR-041 (Tasks):** formulários associados a tarefas dependem de `FormularioRepository` — gaps 1 e 4 bloqueiam integração tasks↔formulários no mobile sync (ver ADR de mobile sync)
