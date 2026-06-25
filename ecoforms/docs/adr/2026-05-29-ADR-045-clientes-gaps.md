# ADR-045: Gaps identificados no módulo Clientes

**Data:** 2026-05-29  
**Status:**Implementado**
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** `types/clientes.ts`, `ClienteRepository.ts`, `SqliteClienteRepository.ts`, `useClientes.ts`, `useClienteMutations.ts`, `ClienteDetailPage.tsx`, `novo/page.tsx`, `ClientePhoneSearch.tsx`  
**ADRs relacionados:** ADR-038 (BookingModal gaps), ADR-039 (Manifestações gaps), ADR-041 (Tasks gaps)

---

## Contexto

O módulo de clientes é um dos mais completos do sistema: possui domain interface, repositório SQLite, hooks de query/mutation, páginas de lista/detalhe/criação e componente de busca por telefone. Não há gaps estruturais (ao contrário dos módulos ecopontos e CRM). Os problemas encontrados são de **correctness** (campo não persistido, N+1 queries, confirm() no desktop), **robustez** (erros silenciados, duplicatas não verificadas) e **UX** (sem debounce na busca, sem botão Cancelar em edição).

---

## Inventário por Camada

### Domain — ✅ Bem estruturado

| Arquivo | Status |
|---------|--------|
| `ClienteRepository.ts` | ✅ Interface pura, sem SQL, 13 métodos bem definidos |
| `types/clientes.ts` | ✅ Tipos corretos; `CATEGORIAS_PJ/PF` como `const` arrays |

### Infrastructure — 🔴 Bug de persistência + ineficiência

| Arquivo | Status | Gap |
|---------|--------|-----|
| `SqliteClienteRepository.ts` | 🔴 | `observacoes` ausente de `ClienteRow`, `rowToCliente`, `save()` UPDATE/INSERT |
| `SqliteClienteRepository.ts` | ⚠️ | `save()` e `saveContato()` fazem COUNT + INSERT/UPDATE (2 queries) em vez de UPSERT |

### Interface (Hooks) — ⚠️ Erros silenciados

| Arquivo | Status | Gap |
|---------|--------|-----|
| `useClientes.ts` | ⚠️ | `fetch()` sem catch — erro silenciado; sem estado `error` exposto |
| `useClienteById.ts` | ⚠️ | `catch { }` vazio — erro completamente descartado |
| `useClienteContatos.ts` | ⚠️ | Idem; sem catch |
| `usePfContactsByPj.ts` | ⚠️ | Idem |
| `useClientePhoneSearch.ts` | ⚠️ | N+1 queries no loop de resolução de PJ |
| `useClienteMutations.ts` | ✅ | `withLoading` captura e expõe `error` corretamente |

### Pages — 🟡 Problemas de UX e type safety

| Arquivo | Status | Gap |
|---------|--------|-----|
| `novo/page.tsx` | 🔴 | `window.location.href` (hard reload); `as any` ×2; sem verificação de duplicata |
| `ClienteDetailPage.tsx` | 🔴 | `window.confirm()` para desvincular (não funciona em Tauri); sem botão Cancelar; CPF obrigatório em contato |
| `ClientePhoneSearch.tsx` | ✅ | Implementação correta; debounce 450ms; multi-candidato funcional |

---

## Gaps Detalhados

### Gap 1 — `observacoes` nunca persiste (Crítico — Data Loss)

**Arquivo:** `SqliteClienteRepository.ts`

`Cliente.observacoes` está definido em `types/clientes.ts` e é exibido/editado em `ClienteDetailPage.tsx` e `novo/page.tsx`. Mas:

```typescript
// ❌ ClienteRow — campo ausente
interface ClienteRow {
    // ... nenhum campo observacoes
}

// ❌ rowToCliente — não lê observacoes do banco
function rowToCliente(row: ClienteRow): Cliente {
    return { /* observacoes não mapeada */ };
}

// ❌ save() UPDATE — não inclui observacoes
`UPDATE clientes SET tipo = ?, categoria = ?, nome = ?, documento = ?, email = ?, telefone = ?,
 cep = ?, endereco = ?, numero = ?, bairro = ?, cidade = ?, estado = ?,
 complemento = ?, pj_id = ?, ativo = ?, atualizado_em = ? WHERE id = ?`
 // observacoes ausente ↑

// ❌ save() INSERT — não inclui observacoes
`INSERT INTO clientes (id, tipo, categoria, nome, documento, email, telefone, cep, endereco,
 numero, bairro, cidade, estado, complemento, pj_id, ativo, criado_em, atualizado_em)`
 // observacoes ausente ↑
```

**Efeito:** Usuário preenche "Observações" → salva → campo é silenciosamente descartado. Ao recarregar a página, o campo aparece vazio. Dado perdido sem aviso.

**Decisão:** Adicionar `observacoes` em `ClienteRow`, `rowToCliente`, UPDATE e INSERT:

```typescript
// ClienteRow
observacoes?: string | null;

// rowToCliente
observacoes: row.observacoes ?? null,

// UPDATE (adicionar antes de WHERE id = ?)
complemento = ?, observacoes = ?, pj_id = ?, ...

// INSERT (adicionar coluna e valor)
`INSERT INTO clientes (..., observacoes, ...) VALUES (..., ?, ...)`
```

---

### Gap 2 — N+1 queries em `useClientePhoneSearch` (Crítico)

**Arquivo:** `useClientes.ts:111–124`

```typescript
for (const c of matches) {
    if (c.tipo === 'PJ') { ... }
    else if (c.pj_id) {
        if (!pjMap.has(c.pj_id)) {
            const pj = await repo.findById(c.pj_id);  // ❌ await dentro de loop
            if (pj) pjMap.set(pj.id, { cliente: pj, viaContato: c.nome });
        }
    }
}
```

Para cada PF com `pj_id` não visto ainda, dispara um `findById` sequencial. Se 8 PFs com telefones diferentes, mas todas vinculadas a PJs distintas, baterem na busca → 8 queries sequenciais.

**Decisão:** Coletar todos os `pj_id` únicos e buscar em lote:

```typescript
const pfMatches = matches.filter(c => c.tipo === 'PF' && c.pj_id);
const pjIds = [...new Set(pfMatches.map(c => c.pj_id!).filter(id => !pjMap.has(id)))];

// Adicionar findByIds ao repositório ou fazer query manual:
if (pjIds.length > 0) {
    const pjs = await Promise.all(pjIds.map(id => repo.findById(id)));
    for (const pj of pjs) {
        if (pj) {
            const via = pfMatches.find(c => c.pj_id === pj.id);
            pjMap.set(pj.id, { cliente: pj, viaContato: via?.nome });
        }
    }
}
```

Ou adicionar `findByIds(ids: string[])` ao `ClienteRepository` com `WHERE id IN (...)`.

---

### Gap 3 — `window.confirm()` não funciona em Tauri (Crítico)

**Arquivo:** `ClienteDetailPage.tsx:176`

```typescript
const handleUnlinkPf = async (pfId: string) => {
    if (!confirm("Desvincular contato?")) return;
```

`window.confirm()` é um dialog nativo do browser. Em webviews Tauri (modo desktop), dialogs nativos frequentemente não são exibidos ou são bloqueados silenciosamente — `confirm()` retorna `false` ou `true` sem mostrar nada ao usuário, tornando a ação sempre cancelada ou sempre executada.

**Decisão:** Substituir por `AlertDialog` do shadcn (padrão já adotado no restante do sistema):

```typescript
// Adicionar estado
const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

// No render:
<AlertDialog open={!!unlinkTarget} onOpenChange={() => setUnlinkTarget(null)}>
    <AlertDialogContent>
        <AlertDialogTitle>Desvincular contato?</AlertDialogTitle>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleUnlinkPf(unlinkTarget!); setUnlinkTarget(null); }}>
                Desvincular
            </AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
```

---

### Gap 4 — Erros silenciados em hooks de query (Importante)

**Arquivo:** `useClientes.ts`, `useClienteById.ts`, `useClienteContatos.ts`, `usePfContactsByPj.ts`, `usePfUnassigned.ts`

```typescript
// ❌ useClientes — sem catch, erro propagado mas não capturado
const fetch = useCallback(async () => {
    setLoading(true);
    try {
        const rows = await repo.findAll(filterRef.current);
        setData(rows);
    } finally {  // sem catch
        setLoading(false);
    }
}, [filterKey]);

// ❌ useClienteById — catch vazio
} catch { if (!cancelled) setLoading(false); }
```

Em caso de falha (banco não inicializado, query inválida), o hook retorna `data: []` / `cliente: null` sem distinguir "não encontrado" de "erro". O componente exibe "Nenhum cliente encontrado" quando na realidade houve uma falha.

**Decisão:** Adicionar estado `error` e catch explícito em todos os hooks de query, seguindo o padrão já adotado em `useClienteMutations`:

```typescript
const [error, setError] = useState<string | null>(null);
// ...
try { ... }
catch (e) {
    setError(e instanceof Error ? e.message : 'Erro ao carregar');
    console.error('[useClientes]', e);
}
```

---

### Gap 5 — Duplicata de documento não verificada antes de salvar (Importante)

**Arquivo:** `novo/page.tsx:77–95`, `useClienteMutations.ts`

`ClienteRepository` expõe `documentoExists(documento, excludeId?)` e `nameExists(nome, excludeId?)`, mas nenhum dos dois é chamado antes de `save()`. Um usuário pode cadastrar dois clientes com o mesmo CNPJ ou CPF sem aviso.

O banco SQLite pode ou não ter `UNIQUE` constraint em `documento` — se não tiver, a duplicata é inserida silenciosamente; se tiver, o erro genérico "Erro ao criar cliente" aparece sem identificar a causa.

**Decisão:**

```typescript
// Em handleSubmit (novo/page.tsx) e handleSave (detail)
if (form.documento) {
    const container = await getContainerAsync();
    const dup = await container.clienteRepository.documentoExists(form.documento, cliente?.id);
    if (dup) { toast.error("Documento já cadastrado"); return; }
}
```

---

### Gap 6 — `window.location.href` em `novo/page.tsx` (Importante)

**Arquivo:** `novo/page.tsx:92`

```typescript
toast.success("Cliente criado");
window.location.href = "/clientes";  // ❌ hard reload
```

Força um reload completo da página em vez de usar o router do Next.js. Em Tauri/desktop isso pode causar flash ou perda de estado do shell. O restante das navegações no sistema usa `Link` ou `useRouter().push()`.

**Decisão:**

```typescript
import { useRouter } from 'next/navigation';
const router = useRouter();
// ...
router.push('/clientes');
```

---

### Gap 7 — `handleAddContato` exige CPF mesmo sendo campo opcional (Importante)

**Arquivo:** `ClienteDetailPage.tsx:129–131`

```typescript
const docDigits = novoContato.documento.replace(/\D/g, "");
if (docDigits.length !== 11) { toast.error("CPF inválido"); return; }
```

`Cliente.documento` é `string | null` — campo opcional. A validação bloqueia adicionar um contato PF sem CPF, o que é um cenário legítimo (pessoa sem CPF disponível, estrangeiro, etc.).

**Decisão:** Validar CPF apenas quando preenchido:

```typescript
if (novoContato.documento) {
    const docDigits = novoContato.documento.replace(/\D/g, "");
    if (docDigits.length !== 11) { toast.error("CPF inválido"); return; }
}
```

---

### Gap 8 — `useClienteContatos` (`cliente_contatos`) nunca usado na UI (Importante)

**Arquivo:** `useClientes.ts:51–69`, `ClienteDetailPage.tsx`

O sistema tem dois modelos de contato:
1. **PF vinculadas por `pj_id`** — clientes do tipo PF com `pj_id = clienteId` (usado na aba "Contatos")
2. **`cliente_contatos`** — tabela separada com campos `cargo`, `principal`, `ativo` (hook `useClienteContatos` existe mas nunca é usado)

A aba "Contatos" exibe apenas modelo 1. O modelo 2 (com cargos e campo `principal`) existe no schema e no repositório mas nunca é surfaceado em nenhuma página. Usuários não têm como ver/editar contatos da tabela `cliente_contatos`.

**Decisão:** Definir qual modelo é canônico e remover ou surfacear o outro:
- Se `cliente_contatos` for legado → remover `findContatos`, `saveContato`, `deleteContato` do repositório e o hook `useClienteContatos`
- Se `cliente_contatos` for necessário → adicionar sub-aba na tela de detalhe da PJ

---

### Gap 9 — Busca na lista sem debounce (Médio)

**Arquivo:** `app/clientes/page.tsx:16,38–40`

```typescript
const { data: clientes, loading } = useClientes({ searchTerm: search || undefined });
// ...
onChange={(e) => setSearch(e.target.value)}  // query a cada tecla
```

Cada tecla pressionada dispara `repo.findAll()` com LIKE em 4 colunas. Para listas grandes, isso significa dezenas de queries por segundo enquanto o usuário digita. `useClientePhoneSearch` tem debounce de 450ms — o mesmo padrão deveria ser aplicado aqui.

**Decisão:**

```typescript
const [debouncedSearch, setDebouncedSearch] = useState("");
useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
}, [search]);
const { data: clientes, loading } = useClientes({ searchTerm: debouncedSearch || undefined });
```

---

### Gap 10 — Sem botão "Cancelar" no modo de edição (Médio)

**Arquivo:** `ClienteDetailPage.tsx:206–210`

```typescript
{!editMode ? (
    <Button onClick={handleEdit} variant="outline">Editar</Button>
) : (
    <Button onClick={handleSave} disabled={saving}><Save />Salvar</Button>
    // ❌ sem botão Cancelar
)}
```

Ao entrar em modo de edição, o único caminho de saída é salvar. Não há como descartar as alterações sem recarregar a página.

**Decisão:**

```typescript
{editMode && (
    <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
)}
```

---

### Gap 11 — PF não exibe vínculo com PJ pai (Médio)

**Arquivo:** `ClienteDetailPage.tsx:213–217`

Quando o cliente é do tipo PF e tem `pj_id`, a aba "Dados" não exibe o vínculo com a PJ pai nem oferece link de navegação para ela. O usuário que abre um contato PF não consegue saber a qual PJ está vinculado sem ir à lista geral.

**Decisão:** Adicionar campo "Organização" na aba Dados de PFs:

```typescript
{cliente.pj_id && (
    <div className="space-y-2">
        <Label>Organização</Label>
        <Link href={`/clientes/${cliente.pj_id}`} className="underline text-primary">
            {/* resolver nome via useClienteById(cliente.pj_id) */}
        </Link>
    </div>
)}
```

---

### Gap 12 — `maskDocument` e `maskPhone` duplicados (Médio)

**Arquivo:** `novo/page.tsx:17–31`, `ClienteDetailPage.tsx:23–37`

Funções `maskDocument` e `maskPhone` idênticas em dois arquivos. Adição de dígito móvel de 9 dígitos para CNPJ, ou alteração de máscara, exige mudança em dois lugares.

**Decisão:** Extrair para `lib/clientes-masks.ts` ou `types/clientes.ts`:

```typescript
export function maskPhone(value: string): string { ... }
export function maskDocument(value: string, tipo: 'PF' | 'PJ'): string { ... }
```

---

### Gap 13 — `handleCepBlur` duplicado 3 vezes (Médio)

**Arquivo:** `novo/page.tsx:57–75`, `ClienteDetailPage.tsx:87–125` (×2: `handleCepBlur` + `handleEditCepBlur`)

A lógica de busca de CEP (strip non-digits → `fetchCep` → preencher endereço/bairro/cidade/estado) é copiada três vezes com variações superficiais.

**Decisão:** Extrair hook:

```typescript
// src/interface/hooks/utils/useCepLookup.ts
export function useCepLookup(onResult: (data: CepResult) => void) {
    const [loading, setLoading] = useState(false);
    const lookup = useCallback(async (cep: string) => {
        if (cep.replace(/\D/g, '').length !== 8) return;
        setLoading(true);
        const data = await fetchCep(cep);
        setLoading(false);
        if (data) { onResult(data); toast.success("Endereço encontrado"); }
        else toast.error("CEP não encontrado");
    }, [onResult]);
    return { lookup, loading };
}
```

---

### Gap 14 — `save()` usa COUNT antes de INSERT/UPDATE (Baixo)

**Arquivo:** `SqliteClienteRepository.ts:167–196`, `saveContato` linhas `199–221`

```typescript
// ❌ 2 round-trips por save
const exists = await this.db.query('SELECT COUNT(*) ... WHERE id = ?', [cliente.id]);
if (exists[0]?.count > 0) { /* UPDATE */ } else { /* INSERT */ }
```

SQLite suporta UPSERT desde 3.24 (2018). A operação atual faz 2 queries onde 1 bastaria.

**Decisão:**

```typescript
await this.db.execute(
    `INSERT INTO clientes (...) VALUES (...)
     ON CONFLICT(id) DO UPDATE SET tipo = excluded.tipo, nome = excluded.nome, ...`,
    [...]
);
```

---

### Gap 15 — `findByDocumento` sem uso na UI (Baixo)

`ClienteRepository.findByDocumento` está implementado no repositório mas nunca é chamado por nenhum hook ou página. O uso esperado seria verificar duplicatas antes de salvar, mas isso é feito via `documentoExists` (que também nunca é chamado, ver Gap 5).

**Decisão:** Remover `findByDocumento` do repositório se `documentoExists` for suficiente, ou integrá-lo ao fluxo de validação de duplicatas (Gap 5).

---

### Gap 16 — `as any` em `novo/page.tsx` (Baixo)

**Arquivo:** `novo/page.tsx:90,93`

```typescript
} as any);       // mascara incompatibilidade de tipo em save()
} catch (e: any) { // mascara tipo de erro
```

O primeiro `as any` oculta que `form.categoria` pode ser `""` (string vazia) enquanto `Cliente.categoria` espera `CategoriaCliente | null`. O código já trata isso com `categoria: form.categoria || null`, mas o TypeScript não consegue verificar porque o cast vem depois.

**Decisão:**

```typescript
await save({
    id: uuidv7(),
    ...form,
    categoria: (form.categoria || null) as CategoriaCliente | null,
    ativo: 1,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
});
// catch (e: unknown) — e usar e instanceof Error
```

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço |
|---|-----|-----------|-----------|---------|
| 1 | `observacoes` nunca persiste (data loss) | Crítico | `SqliteClienteRepository.ts` | Baixo |
| 2 | N+1 queries em phone search | Crítico | `useClientes.ts:111` | Médio |
| 3 | `window.confirm()` não funciona em Tauri | Crítico | `ClienteDetailPage.tsx:176` | Baixo |
| 4 | Erros silenciados em hooks de query | Importante | `useClientes.ts` (5 hooks) | Médio |
| 5 | Duplicata de documento não verificada | Importante | `novo/page.tsx`, `detail` | Médio |
| 6 | `window.location.href` (hard reload) | Importante | `novo/page.tsx:92` | Trivial |
| 7 | CPF obrigatório em contato (campo opcional) | Importante | `ClienteDetailPage.tsx:129` | Trivial |
| 8 | `cliente_contatos` nunca surfaceado na UI | Importante | `ClienteDetailPage.tsx` | Alto |
| 9 | Busca sem debounce | Médio | `app/clientes/page.tsx` | Baixo |
| 10 | Sem botão Cancelar no modo edição | Médio | `ClienteDetailPage.tsx:206` | Trivial |
| 11 | PF não exibe link para PJ pai | Médio | `ClienteDetailPage.tsx` | Baixo |
| 12 | `maskDocument`/`maskPhone` duplicados | Médio | `novo/page.tsx`, `detail` | Baixo |
| 13 | `handleCepBlur` duplicado 3× | Médio | ambos os arquivos | Baixo |
| 14 | `save()` usa COUNT + INSERT/UPDATE | Baixo | `SqliteClienteRepository.ts` | Baixo |
| 15 | `findByDocumento` sem uso | Baixo | `SqliteClienteRepository.ts` | Trivial |
| 16 | `as any` em `novo/page.tsx` | Baixo | `novo/page.tsx:90,93` | Trivial |

**Gap 1 é o mais urgente — dados de usuário são silenciosamente descartados.**  
**Gaps 3, 6, 7, 10, 16 são triviais e devem ser feitos num único PR de correções rápidas.**  
**Gap 8 (dois modelos de contato) requer decisão de produto antes de implementar.**

---

## O que está bem (não tocar)

- `SqliteClienteRepository` — estrutura geral, mappers `rowToCliente`/`rowToContato`, queries parametrizadas (sem SQL injection)
- `findByTelefone` — strip de non-digits no SQL e no parâmetro; LIKE correto
- `useClienteMutations` — `withLoading` + `error` state bem implementado; `loading` compartilhado
- `ClientePhoneSearch` — debounce 450ms, multi-candidato, deduplicação por `pj_id` com `Map`
- `findAll` filtros — `tipo`, `ativo`, `searchTerm` todos parametrizados corretamente
- CEP lookup (`fetchCep`) — implementação correta; pattern de `onBlur` + botão manual
- `maskDocument` lógica — máscaras CPF/CNPJ corretas (apesar de duplicadas)

## Relação com ADRs Existentes

- **ADR-038/039/041 (gaps sistêmicos):** gaps 3 e 4 (confirm nativo, erros silenciados) seguem padrão sistêmico identificado nos módulos anteriores
- **ADR-023 (RBAC):** nenhuma das operações de cliente tem `check_permission` — operações destrutivas (`delete`) deveriam verificar permissão `clients.manage`
- **ADR-031-desktop (QueryCatalog):** gap 2 (N+1 em phone search) e gap 14 (COUNT + INSERT) são candidatos para a camada de queries
