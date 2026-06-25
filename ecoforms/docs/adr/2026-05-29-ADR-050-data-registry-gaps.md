# ADR-050: Gaps — Data Registry

**Data:** 2026-05-29  
**Status:**Implementado**
**Escopo:** `app/data-registry/`, `components/registry/`, `src/application/data-registry/`, `src/domain/data-registry/`, `src/infrastructure/persistence/sqlite/SqliteDataRegistryRepository.ts`

---

## Resumo Executivo

O Data Registry passou por uma refatoração que deixou artefatos críticos não reconciliados: **dois nomes de tabela diferentes** para o mesmo conceito (`registro_dados` vs `data_registry`), **colunas extras ignoradas** pelo repositório principal, **queries SQL definidas mas nunca usadas**, e **campos de UI sem persistência real**. São 14 gaps, sendo 3 críticos que causam comportamento errado em produção.

---

## Gaps Críticos (P0)

### GAP-01 — Dois nomes de tabela para o mesmo conceito

**Evidência:**

| Arquivo | Tabela usada |
|---|---|
| `SqliteDataRegistryRepository.ts` | `registro_dados` |
| `queries/data-registry.ts` (5 queries) | `registro_dados` |
| `GetModuleVisuaisUseCase.ts` | `registro_dados` |
| `HandlerRegistry.ts` (sync inbound) | `registro_dados` |
| `schema_ddl.sql` (DDL canônico) | `data_registry` |
| `SyncPort.ts` — stat `data_registry: number` | `data_registry` |
| `ModuleWizard.tsx` — lista tipos | `data_registry` |
| `exportar-mobile/page.tsx` — export mobile | `data_registry` |

**Problema:** O DDL canônico define `data_registry` com colunas `(id, tipo, chave, conteudo, versao, criado_em, atualizado_em)`. Todo o código de CRUD usa `registro_dados`. As consequências:

- `ModuleWizard.tsx` exibe lista de tipos vazia (lê `data_registry`, dados estão em `registro_dados`)
- `exportar-mobile/page.tsx` exporta tabela errada — mobile recebe zero registros de data registry
- `SyncPort.data_registry` conta a tabela vazia, nunca reflete o estado real
- A tabela `data_registry` no DDL pode nem existir nos bancos existentes (que têm `registro_dados`)

**Correção:** Unificar em um nome canônico (recomendado: manter `registro_dados` já que é onde os dados estão) e atualizar DDL, `ModuleWizard`, `exportar-mobile`, `SyncPort`.

---

### GAP-02 — `HandlerRegistry` insere colunas que `SqliteDataRegistryRepository` ignora

**Arquivo:** `src/infrastructure/sync/HandlerRegistry.ts:134`

```sql
-- HandlerRegistry insere:
INSERT OR REPLACE INTO registro_dados
  (id, tipo, chave, conteudo, setor, criado_por, criado_em, atualizado_em)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

```ts
// SqliteDataRegistryRepository só sabe ler:
SELECT id, tipo, conteudo, criado_em, atualizado_em FROM registro_dados
```

**Problema:** Registros sincronizados chegam com `chave`, `setor` e `criado_por` preenchidos pelo evento de sync. O repositório nunca lê esses campos — eles existem no banco mas são invisíveis para toda a camada de aplicação (use cases, hooks, UI).

Além disso, `DataRegistryItem` e `DataRegistryDto` não têm esses campos, então mesmo que o repositório lesse, não conseguiria transportá-los.

**Impacto:** Dados de `setor` e `criado_por` inseridos via sync são silenciosamente descartados na leitura. A lógica de filtro por setor (se houver) não funciona.

---

### GAP-03 — `GetModuleVisuaisUseCase` usa sintaxe PostgreSQL (`->>`) em SQLite

**Arquivo:** `src/application/visuals/GetModuleVisuaisUseCase.ts:146`

```ts
joinClause += ` LEFT JOIN ${join.table} ${alias}
  ON registro_dados.data->>'${join.localKey}' = ${alias}.${join.foreignKey}`;
```

**Dois bugs simultâneos:**
1. `registro_dados.data` — a coluna chama-se `conteudo`, não `data`
2. `->>'key'` — operador JSONB do PostgreSQL; SQLite usa `json_extract(conteudo, '$.key')`

**Impacto:** Qualquer módulo que declare `joins` na view config lança erro SQL em runtime. A query retorna erro, o módulo não exibe dados.

---

## Gaps Altos (P1)

### GAP-04 — `versao` no editor nunca é persistido

**Cadeia completa:**

1. `DataRegistryEditor.tsx:219` — campo `<Input type="number" value={formData.versao}` editável pelo usuário
2. `DataRegistryEditorPayload.versao` — incluído no payload enviado ao `onSave`
3. `DataRegistryPage.handleSave` — chama `dr.save.execute({ id, tipo, conteudo })` — **`versao` dropped**
4. `SaveDataRegistryInput` — não tem campo `versao`
5. `registro_dados` — não tem coluna `versao` (só `data_registry` do DDL tem)
6. `toItemView` — mapeia `versao: 1` hardcoded

**Resultado:** O usuário edita a versão, parece que salvou, mas ao reabrir o item volta para 1. Campo completamente ilusório.

---

### GAP-05 — `SqliteModuleRepository` ordena por coluna inexistente

**Arquivo:** `src/infrastructure/persistence/sqlite/SqliteModuleRepository.ts:197`

```sql
SELECT * FROM registro_dados WHERE tipo = ? ORDER BY nome ASC
```

`nome` não é uma coluna da tabela `registro_dados` — está dentro do JSON `conteudo`. SQLite interpreta como `NULL` para todas as linhas e retorna ordem arbitrária (equivalente a sem ORDER BY). O catálogo de dados em módulos nunca é ordenado alfabeticamente como esperado.

**Correção:**
```sql
ORDER BY json_extract(conteudo, '$.nome') ASC
```

---

### GAP-06 — `CountByTypeUseCase` faz full scan O(N)

**Arquivo:** `src/application/data-registry/CountByTypeUseCase.ts`

```ts
async execute(): Promise<Map<string, number>> {
    const items = await this.repo.findAll(); // carrega TODOS os registros
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item.tipo, (counts.get(item.tipo) ?? 0) + 1);
    }
    return counts;
}
```

Já existe a query `REGISTRY_CONTAGEM_POR_TIPO` em `queries/data-registry.ts` que faz exatamente isso no banco:

```sql
SELECT tipo, COUNT(*) AS total FROM registro_dados GROUP BY tipo ORDER BY total DESC
```

Mas esta query **nunca é importada ou usada**. O use case carrega toda a tabela em memória para contar.

---

### GAP-07 — 5 queries SQL definidas mas completamente mortas

**Arquivo:** `src/infrastructure/persistence/sqlite/queries/data-registry.ts`

Exports definidos:
- `REGISTRY_CONTAGEM_POR_TIPO` — contagem por tipo
- `REGISTRY_ITENS_POR_TIPO` — itens paginados por tipo (com LIMIT)
- `REGISTRY_TENDENCIA_MENSAL` — tendência mensal
- `REGISTRY_CAMPO_DISTRIBUICAO` — distribuição de valores de campo
- `REGISTRY_CAMPO_SOMA` — soma/média de campo numérico

Nenhum desses exports é importado em qualquer arquivo do projeto. São dead code puro. Nota: `REGISTRY_ITENS_POR_TIPO` aceita `LIMIT` como parâmetro — é a versão paginada de `findByTipo` que deveria substituir o `findAll()` ineficiente, mas foi esquecida.

---

## Gaps Médios (P2)

### GAP-08 — `chave` e `id` são o mesmo conceito sem clareza

O editor (`DataRegistryEditor`) mostra dois campos separados visualmente: "Nome" e "Chave (ID único)". A UI sugere que `chave` é um identificador de negócio separado do ID técnico.

Mas `toItemView` mapeia `chave: dto.id` — são a mesma coisa. `registro_dados` não tem coluna `chave` separada (ao contrário de `data_registry` no DDL e do `HandlerRegistry` que insere `chave` como campo distinto).

**Resultado:** A semântica de `chave` é inconsistente entre:
- UI: chave = identificador de negócio editável
- Repositório CRUD: chave = alias do id técnico (UUID)
- HandlerRegistry (sync): chave = campo separado com valor de negócio
- DDL `data_registry`: chave = coluna separada

---

### GAP-09 — `DataRegistrySidebar` — novo tipo é efêmero

**Arquivo:** `components/registry/DataRegistrySidebar.tsx:28`

`handleAddType` chama `onSelectType(name)` e `onNewType?.(name)`. Tipos são derivados de `SELECT DISTINCT tipo FROM registro_dados`. Se o usuário criar um novo tipo pela sidebar mas fechar o editor sem salvar nenhum item, o tipo desaparece.

Não há toast de aviso, não há persistência do nome do tipo antes do primeiro item.

---

### GAP-10 — `useDataRegistryAggregated` — fallback silencioso para CRM

**Arquivo:** `src/interface/hooks/queries/useDataRegistryAggregated.ts:26`

Em dois cenários (resultado vazio E erro), o hook silenciosamente tenta `loadCrmDataSource(tipo)`. O componente que recebe os dados não sabe se está vendo dados do registry ou do CRM. Sem diferenciação visual, a fonte dos dados é opaca.

Agravante: esse hook **não é usado pelo `DataRegistryPage`** principal — a page usa `useDataRegistryItemsNew`. O `useDataRegistryAggregated` é usado por outros consumidores (widgets, dashboards) que podem exibir dados CRM pensando ser do registry.

---

### GAP-11 — Sem soft delete, sem sync de exclusão

**Arquivo:** `SqliteDataRegistryRepository.ts:87`

```ts
async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM registro_dados WHERE id = ?`, [id]);
}
```

- Hard delete: sem `deletado_em` ou `ativo` na tabela
- Sem evento de sync: cópias remotas nunca sabem que o item foi excluído
- `SyncPort` tem campo `data_registry: number` sugerindo que sync foi planejado, mas nenhuma operação do repositório escreve no outbox

---

### GAP-12 — `SaveDataRegistryUseCase` não preserva `criadoEm` no upsert

**Arquivo:** `src/application/data-registry/ListItemsUseCase.ts:57`

```ts
async execute(input: SaveDataRegistryInput): Promise<DataRegistryDto> {
    const now = this.clock.nowIso();
    const id = input.id ?? uuidv7();
    const item = DataRegistryItem.fromProps({
        id,
        tipo: input.tipo,
        conteudo: input.conteudo,
        criadoEm: now,     // sempre now, mesmo para updates
        atualizadoEm: now,
    });
```

Quando `input.id` é fornecido (edição), o repositório faz UPDATE e ignora `criado_em` — então o dado não corrompe. Mas semanticamente o use case cria entidades de domínio com `criadoEm` errado. Se alguém adicionar lógica que depende de `entity.criadoEm` para diferenciar insert de update, vai falhar.

---

## Gaps Baixos (P3)

### GAP-13 — `DataRegistryImport` usa `any` explícito (4 ocorrências)

**Arquivo:** `components/registry/DataRegistryImport.tsx:28,33,104,116`

```ts
const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
const [validationResult, setValidationResult] = useState<{
    valid: { chave: string; conteudo: any }[];
    ...
}>
```

Deveria usar `Record<string, unknown>` e `Record<string, FormFieldValue>` consistentemente com o resto do código.

---

### GAP-14 — `detectSchemaFromItems` — schema derivado nunca inclui `chave`/`versao` no formulário

**Arquivo:** `src/lib/registry-schema.ts:9`

```ts
const EXCLUDED_KEYS = new Set(["nome", "ativo", "id"]);
```

`id` está excluído, mas `chave` (alias de `id`) não está. Se algum item tiver `chave` no `conteudo` (o que acontece em registros inseridos pelo HandlerRegistry), ele aparece como campo editável no `DynamicFormEditor`, gerando duplicidade com o campo "Chave" fixo do header.

---

## Mapa de Prioridade

| Gap | Impacto | Esforço | Prioridade |
|-----|---------|---------|------------|
| GAP-01 (dual table name) | Crítico | Médio | P0 |
| GAP-02 (colunas ignoradas do sync) | Crítico | Médio | P0 |
| GAP-03 (PostgreSQL syntax em SQLite) | Crítico | Baixo | P0 |
| GAP-04 (versao fake) | Alto | Baixo | P1 |
| GAP-05 (ORDER BY nome inexistente) | Alto | Mínimo | P1 |
| GAP-06 (CountByType O(N)) | Alto | Baixo | P1 |
| GAP-07 (5 queries dead code) | Alto | Baixo | P1 |
| GAP-08 (chave vs id semântica) | Médio | Alto | P2 |
| GAP-09 (novo tipo efêmero) | Médio | Baixo | P2 |
| GAP-10 (fallback CRM silencioso) | Médio | Baixo | P2 |
| GAP-11 (sem soft delete / sync) | Médio | Alto | P2 |
| GAP-12 (criadoEm errado no upsert) | Baixo | Mínimo | P3 |
| GAP-13 (any explícito no import) | Baixo | Mínimo | P3 |
| GAP-14 (chave aparece no DynamicFormEditor) | Baixo | Mínimo | P3 |

---

## Causa Raiz

Os gaps P0 derivam de uma refatoração incompleta: o sistema foi migrado de um modelo com tabela `data_registry` (com `chave` e `versao` explícitos) para `registro_dados` (mais simples), mas:

1. O DDL não foi atualizado — mantém `data_registry` como tabela canônica
2. Consumidores externos (sync stats, mobile export, ModuleWizard) não foram migrados para o novo nome
3. O HandlerRegistry (sync inbound) foi escrito contra um schema diferente do repositório — inserindo colunas que o repositório nunca lê
4. Use cases criados para o QueryCatalog (`queries/data-registry.ts`) nunca foram conectados ao repositório
