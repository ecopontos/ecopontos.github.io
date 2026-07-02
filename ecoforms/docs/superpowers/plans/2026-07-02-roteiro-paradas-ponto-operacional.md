# Ponto operacional por parada de roteiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma parada de roteiro (`roteiro_clientes`) use um ponto operacional ou imóvel específico (override manual), em vez de depender só do vínculo principal automático do cliente — Fase 3 do plano `2026-07-02-clientes-logistica-roteiros-itinerarios.md`.

**Architecture:** Estende `roteiro_clientes` com duas colunas nullable (`imovel_id`, `ponto_operacional_id`) em vez de criar uma tabela nova. A query `ROTEIRO_CLIENTES_ITINERARIO` ganha 2 níveis de prioridade no topo da cadeia de fallback já existente (via `LEFT JOIN` adicionais + `COALESCE`). `deriveCoordOrigem` (função pura) ganha 2 valores novos de `CoordOrigem` para diferenciar override manual de resolução automática. A UI ganha um diálogo compartilhado (`ParadaLocalizacaoDialog`) acionado de dois pontos (`ItinerarioModal.tsx`, `RoteiroDetailPage.tsx`), e o mapa (`ItinerarioMap.tsx`) ganha um marcador distinto para paradas com override.

**Tech Stack:** TypeScript, React, SQLite (via `SqlitePort`), Vitest, MapLibre GL.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-02-roteiro-paradas-ponto-operacional-design.md` (aprovado).
- `roteiro_clientes` mantém PK `(roteiro_id, cliente_id)` — não é recriada nem migrada para uma tabela nova.
- Sem `CHECK` cruzado entre `imovel_id` e `ponto_operacional_id` no banco (SQLite não valida FK condicional); a garantia "o ponto pertence ao imóvel" fica na UI (o picker só oferece pontos do imóvel já resolvido).
- `imovel_id` e `ponto_operacional_id` são independentes: `imovel_id` sozinho é override de qual imóvel resolve a parada; `ponto_operacional_id` é override fino de um ponto específico (sempre implica um imóvel, preenchido junto pela UI).
- Nova convenção de UI: `<select>` nativo com `className="w-full border rounded-md px-3 py-2"` (padrão já usado em `TerrenoDetailPage.tsx`, `NovaExecucaoDialog.tsx`) — não introduzir o componente `Popover` (não existe em `components/ui/`, evitar dependência nova).
- Validação final de cada task: `npx vitest run <arquivo>` do teste da task. Validação final do plano inteiro: `npm run typecheck` + `npx eslint <arquivos tocados>` + `npx vitest run`.

---

### Task 1: Schema — colunas de override por parada em `roteiro_clientes`

**Files:**
- Modify: `desktop/scripts/ensure-columns.ts:701-704` (logo após os índices de `roteiro_clientes`)
- Test: `desktop/src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts`

**Interfaces:**
- Produces: colunas `roteiro_clientes.imovel_id` (TEXT, nullable) e `roteiro_clientes.ponto_operacional_id` (TEXT, nullable)

- [ ] **Step 1: Write the failing test**

Criar `desktop/src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { ensureColumns } from '@/scripts/ensure-columns';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('ensureColumns — override de localização por parada (Fase 3 logística)', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('adiciona imovel_id e ponto_operacional_id em roteiro_clientes e é idempotente ao rodar duas vezes seguidas', async () => {
        db = await createMemoryDb();

        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();
        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();

        const columns = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('roteiro_clientes')");
        const names = columns.map(c => c.name);

        expect(names).toEqual(
            expect.arrayContaining(['imovel_id', 'ponto_operacional_id']),
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && npx vitest run src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts`
Expected: FAIL — `imovel_id`/`ponto_operacional_id` não estão em `names` (colunas ainda não existem).

- [ ] **Step 3: Add the columns**

Em `desktop/scripts/ensure-columns.ts`, logo após a linha `await execute(\`CREATE INDEX IF NOT EXISTS idx_roteiro_clientes_ordem   ON roteiro_clientes(roteiro_id, ordem)\`);` (linha 704):

```typescript
    // ── Fase 3 (logística): override de localização por parada ──
    // imovel_id: override de qual imóvel resolve esta parada (independente do vínculo principal
    // do cliente — útil quando o cliente tem mais de um vínculo em cliente_imovel_vinculos).
    // ponto_operacional_id: override fino de um ponto específico desse imóvel; sempre implica um
    // imovel_id preenchido junto pela UI (não validado por CHECK — ver plano/spec).
    await execute(`ALTER TABLE roteiro_clientes ADD COLUMN imovel_id TEXT REFERENCES terrenos(id)`).catch(() => {});
    await execute(`ALTER TABLE roteiro_clientes ADD COLUMN ponto_operacional_id TEXT REFERENCES imovel_pontos_operacionais(id)`).catch(() => {});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop && npx vitest run src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/scripts/ensure-columns.ts desktop/src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts
git commit -m "feat(logistica): colunas de override imovel_id/ponto_operacional_id em roteiro_clientes"
```

---

### Task 2: Repositório — `findClientesByRoteiro` expõe o override, `updateParadaLocalizacao` grava

**Files:**
- Modify: `desktop/src/domain/logistics/LogisticsRepository.ts:20-29` (interface `RoteiroCliente`), `:162-166` (interface `LogisticsRepository`)
- Modify: `desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts:82-132`
- Test: `desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts`

**Interfaces:**
- Consumes: `SqlitePort` (`@/src/application/ports/SqlitePort`) — mesmo padrão de fake usado em `SqliteClienteRepository.vinculos.test.ts`
- Produces: `RoteiroCliente.imovelId?: string | null`, `RoteiroCliente.pontoOperacionalId?: string | null`, `LogisticsRepository.updateParadaLocalizacao(roteiroId: string, clienteId: string, update: { imovelId: string | null; pontoOperacionalId: string | null }): Promise<void>`

- [ ] **Step 1: Add the type fields (no test — verificado pelo typecheck junto dos steps seguintes)**

Em `desktop/src/domain/logistics/LogisticsRepository.ts`, dentro da interface `RoteiroCliente` (linhas 20-29), adicionar após `clienteNome?: string | null;`:

```typescript
export interface RoteiroCliente {
    id: string;
    roteiroId: string;
    clienteId: string;
    ordem: number;
    observacao?: string | null;
    ativo: number;
    criadoEm: string;
    clienteNome?: string | null;
    /** Override de qual imóvel resolve esta parada (independente do vínculo principal do cliente). */
    imovelId?: string | null;
    /** Override de um ponto operacional específico desse imóvel para esta parada. */
    pontoOperacionalId?: string | null;
}
```

Na interface `LogisticsRepository`, logo após `updateClienteOrdemBatch(roteiroId: string, items: { clienteId: string; ordem: number }[]): Promise<void>;` (linha 166):

```typescript
    updateParadaLocalizacao(roteiroId: string, clienteId: string, update: { imovelId: string | null; pontoOperacionalId: string | null }): Promise<void>;
```

- [ ] **Step 2: Write the failing test**

Criar `desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SqliteLogisticsRepository } from '../SqliteLogisticsRepository';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

function makeDb(overrides: { query?: (sql: string, params: unknown[]) => unknown[] } = {}) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const executes: { sql: string; params: unknown[] }[] = [];
    const db = {
        query: async (sql: string, params: unknown[] = []) => {
            queries.push({ sql, params });
            return overrides.query?.(sql, params) ?? [];
        },
        execute: async (sql: string, params: unknown[] = []) => {
            executes.push({ sql, params });
        },
        all: async () => [],
        transaction: async <T,>(cb: (tx: SqlitePort) => Promise<T>) => cb(db as unknown as SqlitePort),
    } as unknown as SqlitePort;
    return { db, queries, executes };
}

describe('SqliteLogisticsRepository — override de localização por parada', () => {
    it('findClientesByRoteiro seleciona imovel_id e ponto_operacional_id da parada', async () => {
        const { db, queries } = makeDb({
            query: () => [{
                id: 'rc-1', roteiroId: 'rot-1', clienteId: 'cli-1', ordem: 1,
                observacao: null, ativo: 1, criadoEm: '2026-01-01', clienteNome: 'Cliente 1',
                imovelId: 'ter-1', pontoOperacionalId: 'po-1',
            }],
        });
        const repo = new SqliteLogisticsRepository(db);

        const rows = await repo.findClientesByRoteiro('rot-1');

        expect(queries[0].sql).toContain('rc.imovel_id AS imovelId');
        expect(queries[0].sql).toContain('rc.ponto_operacional_id AS pontoOperacionalId');
        expect(rows[0].imovelId).toBe('ter-1');
        expect(rows[0].pontoOperacionalId).toBe('po-1');
    });

    it('updateParadaLocalizacao grava imovel_id e ponto_operacional_id da parada', async () => {
        const { db, executes } = makeDb();
        const repo = new SqliteLogisticsRepository(db);

        await repo.updateParadaLocalizacao('rot-1', 'cli-1', { imovelId: 'ter-2', pontoOperacionalId: 'po-2' });

        expect(executes[0].sql).toContain('UPDATE roteiro_clientes SET imovel_id = ?, ponto_operacional_id = ?');
        expect(executes[0].params).toEqual(['ter-2', 'po-2', 'rot-1', 'cli-1']);
    });

    it('updateParadaLocalizacao aceita null nos dois campos para remover o override', async () => {
        const { db, executes } = makeDb();
        const repo = new SqliteLogisticsRepository(db);

        await repo.updateParadaLocalizacao('rot-1', 'cli-1', { imovelId: null, pontoOperacionalId: null });

        expect(executes[0].params).toEqual([null, null, 'rot-1', 'cli-1']);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd desktop && npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts`
Expected: FAIL — `queries[0].sql` não contém `rc.imovel_id AS imovelId` (SELECT ainda não foi alterado); `repo.updateParadaLocalizacao is not a function`.

- [ ] **Step 4: Implement `findClientesByRoteiro` and `updateParadaLocalizacao`**

Em `desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts`, substituir o método `findClientesByRoteiro` (linhas 82-98):

```typescript
    // --- Roteiro Clientes ---
    async findClientesByRoteiro(roteiroId: string): Promise<RoteiroCliente[]> {
        return this.db.query<RoteiroCliente>(`
            SELECT
                rc.id,
                rc.roteiro_id   AS roteiroId,
                rc.cliente_id   AS clienteId,
                rc.ordem,
                rc.observacao,
                rc.ativo,
                rc.criado_em    AS criadoEm,
                c.nome          AS clienteNome,
                rc.imovel_id    AS imovelId,
                rc.ponto_operacional_id AS pontoOperacionalId
            FROM roteiro_clientes rc
            JOIN clientes c ON rc.cliente_id = c.id
            WHERE rc.roteiro_id = ? AND rc.ativo = 1
            ORDER BY rc.ordem, c.nome
        `, [roteiroId]);
    }
```

Adicionar o novo método logo após `updateClienteOrdemBatch` (depois da linha 132, antes do comentário `// --- Execucao Coleta ---`):

```typescript
    async updateParadaLocalizacao(
        roteiroId: string,
        clienteId: string,
        update: { imovelId: string | null; pontoOperacionalId: string | null },
    ): Promise<void> {
        await this.db.execute(
            'UPDATE roteiro_clientes SET imovel_id = ?, ponto_operacional_id = ? WHERE roteiro_id = ? AND cliente_id = ?',
            [update.imovelId, update.pontoOperacionalId, roteiroId, clienteId],
        );
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd desktop && npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add desktop/src/domain/logistics/LogisticsRepository.ts desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts
git commit -m "feat(logistica): repositorio le/grava override de localizacao por parada"
```

---

### Task 3: Query — prioridade de resolução em `ROTEIRO_CLIENTES_ITINERARIO`

**Files:**
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts:185-233`
- Modify: `desktop/src/interface/hooks/queries/useMapData.ts:62-79` (interface `ItinerarioStop`)
- Test: `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts`

**Interfaces:**
- Consumes: `roteiro_clientes.imovel_id`/`ponto_operacional_id` (Task 1)
- Produces: `ItinerarioStop` com os campos crus `parada_ponto_operacional_id`, `parada_ponto_operacional_lat/lng`, `parada_imovel_id`, `parada_imovel_ponto_operacional_lat/lng`, `parada_imovel_centroid_lat/lng` — consumidos por `deriveCoordOrigem` na Task 4

- [ ] **Step 1: Write the failing test**

Em `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts`, adicionar ao final do arquivo:

```typescript
describe('override de localização por parada (Fase 3 logística)', () => {
    it('ROTEIRO_CLIENTES_ITINERARIO prioriza ponto_operacional_id explícito da parada', () => {
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('po_parada.latitude');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('LEFT JOIN imovel_pontos_operacionais po_parada ON po_parada.id = rc.ponto_operacional_id');
    });

    it('ROTEIRO_CLIENTES_ITINERARIO resolve imovel_id da parada para ponto principal ou centroide desse imóvel', () => {
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('LEFT JOIN terrenos t_parada ON t_parada.id = rc.imovel_id');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('po_imovel_parada.imovel_id = rc.imovel_id');
    });

    it('ROTEIRO_CLIENTES_ITINERARIO expõe os campos crus para deriveCoordOrigem distinguir override', () => {
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS parada_ponto_operacional_id');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS parada_ponto_operacional_lat');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS parada_imovel_ponto_operacional_lat');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS parada_imovel_centroid_lat');
    });

    it('ROTEIRO_CLIENTES_ITINERARIO mantém a precedência do override de parada sobre o vínculo automático no COALESCE', () => {
        const latCoalesce = ROTEIRO_CLIENTES_ITINERARIO.sql.match(/COALESCE\(po_parada\.latitude[^)]*\)/)?.[0] ?? '';
        expect(latCoalesce.indexOf('po_parada')).toBeLessThan(latCoalesce.indexOf('po.latitude'));
        expect(latCoalesce.indexOf('po_imovel_parada')).toBeLessThan(latCoalesce.indexOf('po.latitude'));
        expect(latCoalesce.indexOf('t_parada')).toBeLessThan(latCoalesce.indexOf('po.latitude'));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && npx vitest run src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts -t "override de localização por parada"`
Expected: FAIL — nenhuma das strings novas existe no SQL atual de `ROTEIRO_CLIENTES_ITINERARIO`.

- [ ] **Step 3: Implement the updated query**

Em `desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts`, substituir o bloco de comentário + `ROTEIRO_CLIENTES_ITINERARIO` (linhas 185-233) por:

```typescript
/**
 * Ordem de fallback usada para resolver a posição (latitude/longitude) de cada parada do
 * itinerário — documentada aqui e em `deriveCoordOrigem`/`deriveMotivoSemLocalizacao`
 * (`desktop/lib/itinerary.ts`):
 *   0. `roteiro_clientes.ponto_operacional_id` — override explícito de ponto nesta parada (Fase 3 logística)
 *   1. `roteiro_clientes.imovel_id` → ponto operacional principal desse imóvel (Fase 3 logística)
 *   2. `roteiro_clientes.imovel_id` → centroide desse imóvel, se não tiver ponto principal (Fase 3 logística)
 *   3. `imovel_pontos_operacionais`   — ponto operacional principal do imóvel vinculado (Fase 4 georref)
 *   4. `cliente_imovel_vinculos`      — vínculo principal do cliente resolve o imóvel (Fase 3 georref)
 *   5. `clientes.latitude/longitude`  — coordenada do próprio cliente, usada se não houver vínculo/centroide
 * Se nada disso resolver, a parada fica sem localização (latitude/longitude nulos no resultado).
 *
 * Histórico: até a migração da Fase 3 (follow-up) do georreferenciamento, a resolução passava por
 * `clientes.terreno_id` (FK 1:1, ADR-038) e por um override `roteiro_clientes.terreno_id` (per-stop)
 * que nunca foi escrito pelo app — ambos removidos da resolução. Os níveis 0-2 acima são o override
 * por parada dedicado, reintroduzido como feature real na Fase 3 do plano de logística.
 *
 * As colunas `terreno_centroid_lat/lng`, `ponto_operacional_lat/lng`, `parada_*` abaixo são expostas
 * apenas para a UI derivar, no client, a origem da coordenada usada — não introduzem colunas novas no
 * banco, apenas reexpõem valores já lidos por este JOIN.
 */
export const ROTEIRO_CLIENTES_ITINERARIO: QueryDef = {
  sql: `SELECT rc.ordem,
              c.id  AS cliente_id,
              c.nome,
              COALESCE(po_parada.latitude, po_imovel_parada.latitude, t_parada.centroid_lat, po.latitude, t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(po_parada.longitude, po_imovel_parada.longitude, t_parada.centroid_lng, po.longitude, t.centroid_lng, c.longitude) AS longitude,
              COALESCE(rc.imovel_id, cv.imovel_id) AS terreno_id,
              COALESCE(t_parada.nome, t.nome)      AS terreno_nome,
              COALESCE(t_parada.codigo_cadastral, t.codigo_cadastral) AS codigo_cadastral,
              t.centroid_lat    AS terreno_centroid_lat,
              t.centroid_lng    AS terreno_centroid_lng,
              po.latitude       AS ponto_operacional_lat,
              po.longitude      AS ponto_operacional_lng,
              rc.ponto_operacional_id AS parada_ponto_operacional_id,
              po_parada.latitude AS parada_ponto_operacional_lat,
              po_parada.longitude AS parada_ponto_operacional_lng,
              rc.imovel_id      AS parada_imovel_id,
              po_imovel_parada.latitude AS parada_imovel_ponto_operacional_lat,
              po_imovel_parada.longitude AS parada_imovel_ponto_operacional_lng,
              t_parada.centroid_lat AS parada_imovel_centroid_lat,
              t_parada.centroid_lng AS parada_imovel_centroid_lng
       FROM roteiro_clientes rc
       JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN cliente_imovel_vinculos cv ON cv.cliente_id = c.id AND cv.principal = 1
       LEFT JOIN terrenos t ON t.id = cv.imovel_id
       LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = cv.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po2
           WHERE po2.imovel_id = po.imovel_id
             AND (po2.principal > po.principal
                  OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
       LEFT JOIN imovel_pontos_operacionais po_parada ON po_parada.id = rc.ponto_operacional_id
       LEFT JOIN terrenos t_parada ON t_parada.id = rc.imovel_id
       LEFT JOIN imovel_pontos_operacionais po_imovel_parada ON po_imovel_parada.imovel_id = rc.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po_imovel_parada2
           WHERE po_imovel_parada2.imovel_id = po_imovel_parada.imovel_id
             AND (po_imovel_parada2.principal > po_imovel_parada.principal
                  OR (po_imovel_parada2.principal = po_imovel_parada.principal AND po_imovel_parada2.criado_em < po_imovel_parada.criado_em)))
       WHERE rc.roteiro_id = ? AND rc.ativo = 1 AND c.ativo = 1
       ORDER BY rc.ordem`,
  description: 'Paradas de um roteiro com nome, posição e origem da coordenada (override de parada > vínculo principal > cliente lat/lng; raw p/ diagnóstico na UI) — useItinerario',
  params: ['roteiro_id'],
  use: 'operacional',
  returns: 'ItinerarioStop[]',
  };
```

Em `desktop/src/interface/hooks/queries/useMapData.ts`, substituir a interface `ItinerarioStop` (linhas 62-79) por:

```typescript
export interface ItinerarioStop {
    ordem: number;
    cliente_id: string;
    nome: string;
    latitude: number | null;
    longitude: number | null;
    terreno_id: string | null;
    terreno_nome: string | null;
    codigo_cadastral: string | null;
    /** terrenos.centroid_lat "cru" do terreno resolvido (vínculo principal) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lat: number | null;
    /** terrenos.centroid_lng "cru" do terreno resolvido (vínculo principal) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lng: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lat: number | null;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lng: number | null;
    /** roteiro_clientes.ponto_operacional_id — override explícito de ponto nesta parada (Fase 3 logística). */
    parada_ponto_operacional_id: string | null;
    parada_ponto_operacional_lat: number | null;
    parada_ponto_operacional_lng: number | null;
    /** roteiro_clientes.imovel_id — override de imóvel nesta parada (Fase 3 logística). */
    parada_imovel_id: string | null;
    parada_imovel_ponto_operacional_lat: number | null;
    parada_imovel_ponto_operacional_lng: number | null;
    parada_imovel_centroid_lat: number | null;
    parada_imovel_centroid_lng: number | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop && npx vitest run src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os pré-existentes)

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts desktop/src/interface/hooks/queries/useMapData.ts desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts
git commit -m "feat(logistica): ROTEIRO_CLIENTES_ITINERARIO prioriza override de localizacao por parada"
```

---

### Task 4: `deriveCoordOrigem` — 2 novos valores de `CoordOrigem` para override de parada

**Files:**
- Modify: `desktop/lib/itinerary.ts:75-148`
- Test: `desktop/src/lib/__tests__/itinerary.test.ts`

**Interfaces:**
- Consumes: campos crus de `ItinerarioStop` (Task 3), estruturalmente compatíveis com `CoordOrigemStop`
- Produces: `CoordOrigem` com `'parada_ponto_operacional' | 'parada_imovel_centroid'` além dos 3 valores existentes; `COORD_ORIGEM_LABELS` com entradas para os 2 novos valores

- [ ] **Step 1: Write the failing tests**

Em `desktop/src/lib/__tests__/itinerary.test.ts`, adicionar dentro do `describe("deriveCoordOrigem", ...)`, após o teste `"retorna ponto_operacional quando há ponto operacional..."`:

```typescript
    it("retorna parada_ponto_operacional quando há override explícito de ponto na parada (precedência máxima)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_ponto_operacional_lat: -23.55,
                parada_ponto_operacional_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_ponto_operacional");
    });

    it("retorna parada_ponto_operacional quando o imovel_id da parada resolve para o ponto operacional principal desse imóvel", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_imovel_ponto_operacional_lat: -23.55,
                parada_imovel_ponto_operacional_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_ponto_operacional");
    });

    it("retorna parada_imovel_centroid quando o imovel_id da parada não tem ponto principal, cai no centroide desse imóvel", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_imovel_centroid_lat: -23.55,
                parada_imovel_centroid_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_imovel_centroid");
    });

    it("cai para ponto_operacional (vínculo automático) quando não há override de parada", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                ponto_operacional_lat: -23.55,
                ponto_operacional_lng: -46.63,
                terreno_centroid_lat: -23.54,
                terreno_centroid_lng: -46.62,
            }),
        ).toBe("ponto_operacional");
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd desktop && npx vitest run src/lib/__tests__/itinerary.test.ts`
Expected: FAIL nos 3 primeiros testes novos (TypeScript aceita os campos extras como estruturalmente compatíveis via index signature opcional, mas `deriveCoordOrigem` ainda não os lê — retorna `'ponto_operacional'`/`'terreno_centroid'` em vez de `'parada_*'`). O 4º teste novo já passa (comportamento não mudou nesse caso).

- [ ] **Step 3: Implement**

Em `desktop/lib/itinerary.ts`, substituir o bloco de `CoordOrigem`/`CoordOrigemStop`/`deriveCoordOrigem`/`COORD_ORIGEM_LABELS` (linhas 86-116 e 143-148) pelo seguinte. Primeiro, o type e a interface (linhas 86-100):

```typescript
/** Rótulo de origem da coordenada final usada por uma parada do itinerário. */
export type CoordOrigem =
    | 'ponto_operacional'
    | 'cliente_latlng'
    | 'terreno_centroid'
    | 'parada_ponto_operacional'
    | 'parada_imovel_centroid';

export interface CoordOrigemStop {
    latitude: number | null;
    longitude: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4). */
    ponto_operacional_lat?: number | null | undefined;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4). */
    ponto_operacional_lng?: number | null | undefined;
    /** terrenos.centroid_lat "cru" do terreno resolvido (vínculo principal). */
    terreno_centroid_lat: number | null | undefined;
    /** terrenos.centroid_lng "cru" do terreno resolvido (vínculo principal). */
    terreno_centroid_lng: number | null | undefined;
    /** roteiro_clientes.ponto_operacional_id resolvido — override explícito de ponto na parada (nível 0, Fase 3 logística). */
    parada_ponto_operacional_lat?: number | null | undefined;
    parada_ponto_operacional_lng?: number | null | undefined;
    /** roteiro_clientes.imovel_id resolvido para o ponto operacional principal desse imóvel (nível 1, Fase 3 logística). */
    parada_imovel_ponto_operacional_lat?: number | null | undefined;
    parada_imovel_ponto_operacional_lng?: number | null | undefined;
    /** roteiro_clientes.imovel_id resolvido para o centroide desse imóvel, sem ponto principal (nível 2, Fase 3 logística). */
    parada_imovel_centroid_lat?: number | null | undefined;
    parada_imovel_centroid_lng?: number | null | undefined;
}
```

Depois, `deriveCoordOrigem` (linhas 102-116):

```typescript
/**
 * Deriva de onde veio a coordenada final de uma parada, comparando os valores "crus" que a
 * query ROTEIRO_CLIENTES_ITINERARIO já retorna (sem precisar de coluna nova no banco nem de
 * uma nova query). Precedência: override de ponto explícito na parada > override de imóvel na
 * parada (ponto principal desse imóvel > centroide desse imóvel) > ponto operacional do vínculo
 * automático > centroide do vínculo automático > clientes.latitude/longitude.
 * Retorna null quando a parada não tem localização resolvida.
 */
export function deriveCoordOrigem(stop: CoordOrigemStop): CoordOrigem | null {
    if (stop.latitude == null || stop.longitude == null) return null;
    const usouParadaPontoExplicito = stop.parada_ponto_operacional_lat != null && stop.parada_ponto_operacional_lng != null;
    if (usouParadaPontoExplicito) return 'parada_ponto_operacional';
    const usouParadaImovelPonto = stop.parada_imovel_ponto_operacional_lat != null && stop.parada_imovel_ponto_operacional_lng != null;
    if (usouParadaImovelPonto) return 'parada_ponto_operacional';
    const usouParadaImovelCentroid = stop.parada_imovel_centroid_lat != null && stop.parada_imovel_centroid_lng != null;
    if (usouParadaImovelCentroid) return 'parada_imovel_centroid';
    const usouPontoOperacional = stop.ponto_operacional_lat != null && stop.ponto_operacional_lng != null;
    if (usouPontoOperacional) return 'ponto_operacional';
    const usouCentroideDoTerreno = stop.terreno_centroid_lat != null && stop.terreno_centroid_lng != null;
    if (!usouCentroideDoTerreno) return 'cliente_latlng';
    return 'terreno_centroid';
}
```

Por fim, `COORD_ORIGEM_LABELS` (linhas 143-148):

```typescript
/** Rótulos amigáveis (pt-BR) para exibição de CoordOrigem na UI. */
export const COORD_ORIGEM_LABELS: Record<CoordOrigem, string> = {
    ponto_operacional: 'Ponto operacional do imóvel',
    cliente_latlng: 'Coordenada do cadastro do cliente',
    terreno_centroid: 'Centroide do terreno vinculado ao cliente',
    parada_ponto_operacional: 'Ponto operacional definido manualmente nesta parada',
    parada_imovel_centroid: 'Centroide de imóvel definido manualmente nesta parada',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd desktop && npx vitest run src/lib/__tests__/itinerary.test.ts`
Expected: PASS (todos os testes do arquivo)

- [ ] **Step 5: Commit**

```bash
git add desktop/lib/itinerary.ts desktop/src/lib/__tests__/itinerary.test.ts
git commit -m "feat(logistica): CoordOrigem distingue override manual de parada da resolucao automatica"
```

---

### Task 5: Hook `updateParadaLocalizacao` em `useLogisticsMutations`

**Files:**
- Modify: `desktop/src/interface/hooks/mutations/useLogisticsMutations.ts`

**Interfaces:**
- Consumes: `LogisticsRepository.updateParadaLocalizacao` (Task 2)
- Produces: `updateParadaLocalizacao(roteiroId: string, clienteId: string, update: { imovelId: string | null; pontoOperacionalId: string | null }): Promise<void>` no retorno de `useLogisticsMutations()`

Este hook é um passthrough fino para o repositório (mesmo padrão de `updateClienteOrdem`/`removeClienteFromRoteiro` já existentes no arquivo, nenhum dos quais tem teste dedicado — a cobertura de comportamento já está na Task 2, no repositório). Sem ciclo RED/GREEN aqui: é adição mecânica de 5 linhas seguindo um padrão 100% estabelecido no mesmo arquivo, verificada pelo typecheck.

- [ ] **Step 1: Add the hook**

Em `desktop/src/interface/hooks/mutations/useLogisticsMutations.ts`, logo após `updateClienteOrdemBatch` (depois da linha 62, antes de `const saveExecucao = ...`):

```typescript
    const updateParadaLocalizacao = useCallback(async (
        roteiroId: string, clienteId: string, update: { imovelId: string | null; pontoOperacionalId: string | null },
    ) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.updateParadaLocalizacao(roteiroId, clienteId, update);
        });
    }, []);
```

No `return` do hook (linha 123-130), adicionar `updateParadaLocalizacao` à lista:

```typescript
    return {
        saveRoteiro, removeRoteiro,
        addClienteToRoteiro, removeClienteFromRoteiro, updateClienteOrdem, updateClienteOrdemBatch, updateParadaLocalizacao,
        saveExecucao, updateExecucaoStatus, transicaoExecucaoStatus, removeExecucao,
        saveChecklistItem, completeChecklistItem,
        saveIntercorrencia, resolverIntercorrencia,
        loading, error,
    };
```

- [ ] **Step 2: Typecheck**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros novos

- [ ] **Step 3: Commit**

```bash
git add desktop/src/interface/hooks/mutations/useLogisticsMutations.ts
git commit -m "feat(logistica): hook updateParadaLocalizacao em useLogisticsMutations"
```

---

### Task 6: Componente `ParadaLocalizacaoDialog`

**Files:**
- Create: `desktop/components/logistics/ParadaLocalizacaoDialog.tsx`

**Interfaces:**
- Consumes: `useImoveisByClienteId` (`@/src/interface/hooks/catalog/clientes`, já existe), `usePontosOperacionais` (`@/src/interface/hooks/queries/usePontoOperacional`, já existe da Fase 4), `useLogisticsMutations().updateParadaLocalizacao` (Task 5)
- Produces: componente `ParadaLocalizacaoDialog` — consumido pelas Tasks 7 e 8

Componente de UI sem lógica pura isolada (orquestra 3 hooks + formulário controlado) — não tem teste unitário dedicado, seguindo a convenção já estabelecida no módulo (`PontoOperacionalMap.tsx`, `TerrenoDetailPage.tsx`, `GeocodeCandidateModal.tsx` também não têm). Verificado manualmente no dev server na Task 9.

- [ ] **Step 1: Create the component**

```typescript
"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useImoveisByClienteId } from "@/src/interface/hooks/catalog/clientes";
import { usePontosOperacionais } from "@/src/interface/hooks/queries/usePontoOperacional";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";

interface Props {
  open: boolean;
  onClose: () => void;
  roteiroId: string;
  clienteId: string;
  clienteNome: string;
  /** Imóvel do vínculo principal do cliente — usado como fallback quando não há override nesta parada. */
  vinculoImovelId: string | null;
  /** roteiro_clientes.imovel_id atual (override desta parada), se houver. */
  overrideImovelId: string | null;
  /** roteiro_clientes.ponto_operacional_id atual (override desta parada), se houver. */
  overridePontoOperacionalId: string | null;
  onSaved: () => void;
}

/**
 * Diálogo compartilhado (ItinerarioModal, RoteiroDetailPage) para definir um override de
 * localização por parada: escolher um imóvel diferente do vínculo principal do cliente e/ou
 * um ponto operacional específico desse imóvel. Ver Fase 3 do plano de logística.
 */
export function ParadaLocalizacaoDialog({
  open, onClose, roteiroId, clienteId, clienteNome,
  vinculoImovelId, overrideImovelId, overridePontoOperacionalId, onSaved,
}: Props) {
  const [selectedImovelId, setSelectedImovelId] = useState<string | null>(overrideImovelId ?? vinculoImovelId);
  const [selectedPontoId, setSelectedPontoId] = useState<string | null>(overridePontoOperacionalId);

  useEffect(() => {
    if (!open) return;
    setSelectedImovelId(overrideImovelId ?? vinculoImovelId);
    setSelectedPontoId(overridePontoOperacionalId);
  }, [open, overrideImovelId, overridePontoOperacionalId, vinculoImovelId]);

  const { data: vinculos } = useImoveisByClienteId(open ? clienteId : null);
  const { data: pontos } = usePontosOperacionais(selectedImovelId);
  const { updateParadaLocalizacao, loading } = useLogisticsMutations();

  async function salvar() {
    try {
      await updateParadaLocalizacao(roteiroId, clienteId, {
        imovelId: selectedImovelId,
        pontoOperacionalId: selectedPontoId,
      });
      toast.success("Localização da parada atualizada");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao atualizar localização da parada");
    }
  }

  function removerOverride() {
    setSelectedImovelId(null);
    setSelectedPontoId(null);
  }

  function usarCentroide() {
    setSelectedPontoId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Localização da parada — {clienteNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {vinculos.length > 1 && (
            <div className="space-y-1.5">
              <Label>Imóvel</Label>
              <select
                value={selectedImovelId ?? ""}
                onChange={(e) => { setSelectedImovelId(e.target.value || null); setSelectedPontoId(null); }}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Vínculo principal do cliente</option>
                {vinculos.map((v) => (
                  <option key={v.imovel_id} value={v.imovel_id}>{v.imovel_nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Ponto operacional</Label>
            <select
              value={selectedPontoId ?? ""}
              onChange={(e) => setSelectedPontoId(e.target.value || null)}
              className="w-full border rounded-md px-3 py-2"
              disabled={!selectedImovelId || pontos.length === 0}
            >
              <option value="">
                {selectedImovelId ? "Usar centroide deste imóvel" : "Selecione um imóvel"}
              </option>
              {pontos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tipo ?? "ponto"}{p.principal === 1 ? " (principal)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={removerOverride} disabled={loading}>
              Remover override
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={usarCentroide} disabled={loading || !selectedImovelId}>
                Usar centroide
              </Button>
              <Button size="sm" onClick={salvar} disabled={loading}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros no arquivo novo (o componente ainda não é importado em nenhum lugar — normal, isso acontece nas Tasks 7/8)

- [ ] **Step 3: Commit**

```bash
git add desktop/components/logistics/ParadaLocalizacaoDialog.tsx
git commit -m "feat(logistica): componente ParadaLocalizacaoDialog"
```

---

### Task 7: Integrar o diálogo em `ItinerarioModal.tsx`

**Files:**
- Modify: `desktop/components/logistics/ItinerarioModal.tsx`

**Interfaces:**
- Consumes: `ParadaLocalizacaoDialog` (Task 6), `CoordOrigem` valores novos (Task 4)

- [ ] **Step 1: Add the 2 new colors to `COORD_ORIGEM_DOT_COLOR`**

Em `desktop/components/logistics/ItinerarioModal.tsx`, linhas 51-55, substituir:

```typescript
const COORD_ORIGEM_DOT_COLOR: Record<CoordOrigem, string> = {
  ponto_operacional: "#f97316",
  cliente_latlng: "#3b82f6",
  terreno_centroid: "#22c55e",
  parada_ponto_operacional: "#a855f7",
  parada_imovel_centroid: "#ec4899",
};
```

- [ ] **Step 2: Import `ParadaLocalizacaoDialog`, `Compass` icon, and `useLogisticsMutations`**

Na linha 21 (`import { GripVertical, Trash2, Search, X, Users, MapIcon, Wand2, Route, AlertTriangle } from "lucide-react";`), adicionar `Compass`:

```typescript
import { GripVertical, Trash2, Search, X, Users, MapIcon, Wand2, Route, AlertTriangle, Compass } from "lucide-react";
```

Após a linha `import { useClientesGeo, useItinerario, useTerrenos } from "@/src/interface/hooks/catalog/logistica";` (linha 29), adicionar:

```typescript
import { ParadaLocalizacaoDialog } from "./ParadaLocalizacaoDialog";
```

- [ ] **Step 3: Add trigger button next to `CoordOrigemIndicator` in `SortableItem`**

Substituir a assinatura de `SortableItem` (linhas 86-102) para receber as duas novas props:

```typescript
function SortableItem({
  item,
  cliente,
  isSelected,
  onSelect,
  onRemove,
  saving,
  itinerarioStop,
  roteiroId,
  onEditLocalizacao,
}: {
  item: RoteiroCliente;
  cliente: Cliente | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  saving: boolean;
  itinerarioStop: ItinerarioStop | undefined;
  roteiroId: string;
  onEditLocalizacao: () => void;
}) {
```

(`roteiroId` fica disponível para uso futuro no componente sem quebrar a assinatura; usado hoje apenas via `onEditLocalizacao`, que já encapsula o `roteiroId` no `ItinerarioModal`.)

No JSX do `SortableItem`, logo após o `<CoordOrigemIndicator .../>` (linha 132-134), adicionar o botão de trigger antes do `<span className="truncate font-medium"...`:

```typescript
      <span className="flex items-center justify-center">
        <CoordOrigemIndicator origem={coordOrigem} motivo={motivoSemLoc} />
      </span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Definir ponto operacional ou imóvel específico para esta parada"
        onClick={(e) => { e.stopPropagation(); onEditLocalizacao(); }}
      >
        <Compass className="h-3.5 w-3.5" />
      </button>
      <span className="truncate font-medium" title={nome}>{nome}</span>
```

A linha `grid grid-cols-[1.5rem_2rem_1rem_1fr_8.5rem_2.5rem_1.5rem]` (linha 117) precisa de uma coluna extra para o botão novo — atualizar para `grid-cols-[1.5rem_2rem_1rem_1rem_1fr_8.5rem_2.5rem_1.5rem]`.

- [ ] **Step 4: Wire dialog state in `ItinerarioModal` main component**

Dentro de `export function ItinerarioModal(...)`, logo após a declaração de `const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);` (linha 180), adicionar:

```typescript
  const [paradaLocalizacaoTarget, setParadaLocalizacaoTarget] = useState<{ clienteId: string; clienteNome: string } | null>(null);
```

Onde `clientesRoteiro.map(...)` renderiza cada `SortableItem` (é preciso localizar esse `.map` — ele fica dentro do `SortableContext`/`DndContext`, mais abaixo no arquivo; identificar pela prop `item={c}` já passada hoje), passar as duas props novas:

```typescript
              <SortableItem
                key={c.clienteId}
                item={c}
                cliente={clienteById.get(c.clienteId)}
                isSelected={selectedClienteId === c.clienteId}
                onSelect={() => setSelectedClienteId(c.clienteId)}
                onRemove={() => handleRemoveCliente(c.clienteId)}
                saving={saving}
                itinerarioStop={itinerarioByCliente.get(c.clienteId)}
                roteiroId={roteiroId}
                onEditLocalizacao={() => setParadaLocalizacaoTarget({ clienteId: c.clienteId, clienteNome: cliente?.nome || c.clienteNome || c.clienteId })}
              />
```

(Ajustar nomes de variáveis — `clienteById`, `itinerarioByCliente`, `cliente` — para os já existentes no `.map` real do arquivo; a lista de props passadas é o que importa.)

Logo antes do fechamento do componente (antes do último `</Dialog>` de `ItinerarioModal`, que envolve todo o JSX), adicionar:

```typescript
      {paradaLocalizacaoTarget && (
        <ParadaLocalizacaoDialog
          open={!!paradaLocalizacaoTarget}
          onClose={() => setParadaLocalizacaoTarget(null)}
          roteiroId={roteiroId}
          clienteId={paradaLocalizacaoTarget.clienteId}
          clienteNome={paradaLocalizacaoTarget.clienteNome}
          vinculoImovelId={itinerarioByCliente.get(paradaLocalizacaoTarget.clienteId)?.terreno_id ?? null}
          overrideImovelId={clientesRoteiro?.find((c) => c.clienteId === paradaLocalizacaoTarget.clienteId)?.imovelId ?? null}
          overridePontoOperacionalId={clientesRoteiro?.find((c) => c.clienteId === paradaLocalizacaoTarget.clienteId)?.pontoOperacionalId ?? null}
          onSaved={refetch}
        />
      )}
```

- [ ] **Step 2: Typecheck**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add desktop/components/logistics/ItinerarioModal.tsx
git commit -m "feat(logistica): picker de localizacao por parada no ItinerarioModal"
```

---

### Task 8: Integrar o diálogo em `RoteiroDetailPage.tsx`

**Files:**
- Modify: `desktop/app/logistica/roteiros/[id]/RoteiroDetailPage.tsx`

**Interfaces:**
- Consumes: `ParadaLocalizacaoDialog` (Task 6)

- [ ] **Step 1: Import `ParadaLocalizacaoDialog` and `Compass` icon**

Na linha 6, adicionar `Compass` à lista de ícones importados de `lucide-react`.

Após a linha `import { NovaExecucaoDialog } from "@/components/logistics/NovaExecucaoDialog";` (linha 26), adicionar:

```typescript
import { ParadaLocalizacaoDialog } from "@/components/logistics/ParadaLocalizacaoDialog";
```

- [ ] **Step 2: Add dialog state**

Logo após `const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);` (linha 63), adicionar:

```typescript
  const [paradaLocalizacaoTarget, setParadaLocalizacaoTarget] = useState<{ clienteId: string; clienteNome: string } | null>(null);
```

- [ ] **Step 3: Add trigger button in the "Localização" table cell**

Na `TableCell` de "Localização" (linhas 270-284), adicionar o botão de trigger dentro da célula, após o `span`/`else` de origem/motivo:

```typescript
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {coordOrigem ? (
                              <span className="text-xs text-muted-foreground" title={`Origem da coordenada: ${COORD_ORIGEM_LABELS[coordOrigem]}`}>
                                {COORD_ORIGEM_LABELS[coordOrigem]}
                              </span>
                            ) : (
                              <span
                                className="text-xs text-amber-600 inline-flex items-center gap-1"
                                title={motivo ? MOTIVO_SEM_LOCALIZACAO_LABELS[motivo] : "Sem localização"}
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {motivo ? MOTIVO_SEM_LOCALIZACAO_LABELS[motivo] : "Sem localização"}
                              </span>
                            )}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              title="Definir ponto operacional ou imóvel específico para esta parada"
                              onClick={() => setParadaLocalizacaoTarget({ clienteId: c.clienteId, clienteNome: c.clienteNome || c.clienteId })}
                            >
                              <Compass className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
```

- [ ] **Step 4: Render the dialog**

Antes do fechamento do componente `RoteiroDetailPage` (encontrar o `return (...)` mais externo e adicionar logo antes de seu fechamento final, no mesmo nível de `<NovaExecucaoDialog .../>` já existente no arquivo), adicionar:

```typescript
      {paradaLocalizacaoTarget && id && (
        <ParadaLocalizacaoDialog
          open={!!paradaLocalizacaoTarget}
          onClose={() => setParadaLocalizacaoTarget(null)}
          roteiroId={id}
          clienteId={paradaLocalizacaoTarget.clienteId}
          clienteNome={paradaLocalizacaoTarget.clienteNome}
          vinculoImovelId={itinerarioByCliente.get(paradaLocalizacaoTarget.clienteId)?.terreno_id ?? null}
          overrideImovelId={clientesRoteiro?.find((c) => c.clienteId === paradaLocalizacaoTarget.clienteId)?.imovelId ?? null}
          overridePontoOperacionalId={clientesRoteiro?.find((c) => c.clienteId === paradaLocalizacaoTarget.clienteId)?.pontoOperacionalId ?? null}
          onSaved={refetchClientes}
        />
      )}
```

(`itinerarioByCliente` precisa existir como `Map<string, ItinerarioStop>` derivado de `itinerario` — se o arquivo já tiver essa variável para a lógica de `coordOrigem`/`motivo` do `.map` da tabela, reaproveitar; senão, adicionar `const itinerarioByCliente = useMemo(() => new Map((itinerario || []).map((s) => [s.cliente_id, s])), [itinerario]);` próximo aos outros `useMemo` do componente.)

- [ ] **Step 5: Typecheck**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add "desktop/app/logistica/roteiros/[id]/RoteiroDetailPage.tsx"
git commit -m "feat(logistica): picker de localizacao por parada na tabela de clientes do roteiro"
```

---

### Task 9: Marcador de override no mapa (`ItinerarioMap.tsx`)

**Files:**
- Modify: `desktop/components/logistics/ItinerarioMap.tsx`

**Interfaces:**
- Consumes: `deriveCoordOrigem` (Task 4)

- [ ] **Step 1: Import `deriveCoordOrigem`**

Na linha 8 (`import { createBaseMap } from "@/lib/map-base";`), adicionar logo abaixo:

```typescript
import { deriveCoordOrigem } from "@/lib/itinerary";
```

- [ ] **Step 2: Add the override marker layer**

Em `desktop/components/logistics/ItinerarioMap.tsx`, dentro de `renderLayers`, logo após o bloco `--- order labels for itinerary stops ---` (após a linha 256, antes do comentário `--- terreno polygons for in-route clients ---`), adicionar:

```typescript
    // --- override markers: distinguish stops resolved via parada-level override ---
    const overrideFeatures: FeatureCollection["features"] = routePoints
      .filter((s) => {
        const origem = deriveCoordOrigem(s);
        return origem === "parada_ponto_operacional" || origem === "parada_imovel_centroid";
      })
      .map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [s.longitude!, s.latitude!] },
        properties: { cliente_id: s.cliente_id },
      }));
    const overrideGeo: FeatureCollection = { type: "FeatureCollection", features: overrideFeatures };

    if (map.getSource("stops-override")) {
      (map.getSource("stops-override") as maplibregl.GeoJSONSource).setData(overrideGeo);
    } else {
      map.addSource("stops-override", { type: "geojson", data: overrideGeo });
      map.addLayer({
        id: "stops-override-ring",
        type: "circle",
        source: "stops-override",
        paint: {
          "circle-radius": 10,
          "circle-color": "transparent",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#a855f7",
        },
      });
    }
```

- [ ] **Step 3: Typecheck**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add desktop/components/logistics/ItinerarioMap.tsx
git commit -m "feat(logistica): destaca no mapa paradas com override de localizacao"
```

---

### Task 10: Verificação final

**Files:** N/A (comandos de verificação)

- [ ] **Step 1: Typecheck completo**

Run: `cd desktop && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (sem erros)

- [ ] **Step 2: Lint dos arquivos tocados**

Run:
```bash
cd desktop && npx eslint scripts/ensure-columns.ts src/domain/logistics/LogisticsRepository.ts src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts src/infrastructure/persistence/sqlite/queries/terrenos.ts src/interface/hooks/queries/useMapData.ts lib/itinerary.ts src/interface/hooks/mutations/useLogisticsMutations.ts components/logistics/ParadaLocalizacaoDialog.tsx components/logistics/ItinerarioModal.tsx components/logistics/ItinerarioMap.tsx "app/logistica/roteiros/[id]/RoteiroDetailPage.tsx" src/test/__tests__/ensureColumnsRoteiroClientesParada.test.ts src/infrastructure/persistence/sqlite/__tests__/SqliteLogisticsRepository.paradaLocalizacao.test.ts src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts src/lib/__tests__/itinerary.test.ts
```
Expected: PASS (sem erros)

- [ ] **Step 3: Suite completa**

Run: `cd desktop && npx vitest run`
Expected: PASS — todos os arquivos, incluindo os novos desta Fase 3

- [ ] **Step 4: Verificação manual no dev server**

Run: `cd desktop && npm run dev` (porta 3001)

Roteiro de teste manual:
1. Abrir `/logistica/roteiros/[id]` de um roteiro com pelo menos 1 cliente vinculado a um imóvel com ponto operacional cadastrado (reaproveitar dado de teste da Fase 4, `/logistica/terreno/[id]`).
2. Na aba Clientes, clicar no ícone de bússola (`Compass`) ao lado da coluna Localização.
3. Confirmar que o diálogo abre, lista os pontos operacionais do imóvel, e "Salvar" com um ponto escolhido atualiza o texto de origem para "Ponto operacional definido manualmente nesta parada".
4. Repetir o mesmo fluxo dentro do `ItinerarioModal` (botão "Editar itinerário").
5. Na aba Mapa, confirmar que a parada com override aparece com um anel roxo distinto.
6. Clicar em "Remover override" e confirmar que a origem volta a refletir a resolução automática (vínculo principal).

- [ ] **Step 5: Commit final (se necessário)**

```bash
git add -A && git commit -m "chore: verify typecheck, lint and tests pass after Fase 3 logistica"
```

---

## Self-Review

**1. Spec coverage:**
- Schema (spec §Schema): ✅ Task 1
- Prioridade de resolução (spec §Prioridade): ✅ Task 3, Task 4
- API repositório/hooks (spec §API): ✅ Task 2, Task 5
- UI picker (spec §UI — picker): ✅ Task 6, 7, 8
- UI mapa (spec §UI — mapa): ✅ Task 9
- Testes (spec §Testes): ✅ cobertos em cada task correspondente
- Fora de escopo (spec §Fora de escopo): não implementado — confirmado, nenhuma task toca `execucao_clientes`, validação de FK cruzada no banco, ou drag-and-drop no `ItinerarioMap.tsx`

**2. Placeholder scan:** nenhum "TBD"/"TODO" — as duas únicas ressalvas explícitas (nomes de variáveis a ajustar em Task 7/8 conforme o `.map` real do arquivo, `itinerarioByCliente` a reaproveitar ou criar em Task 8) são decisões de integração pontuais com instrução completa de código, não lacunas de comportamento.

**3. Type consistency:** `RoteiroCliente.imovelId`/`pontoOperacionalId` (Task 2) usados identicamente em `ParadaLocalizacaoDialog` (Task 6, via `overrideImovelId`/`overridePontoOperacionalId` props) e nas duas integrações (Task 7/8). `CoordOrigem` (Task 4) usado identicamente em `COORD_ORIGEM_DOT_COLOR` (Task 7) e `ItinerarioMap.tsx` (Task 9). `ItinerarioStop.parada_*` (Task 3) é o único produtor consumido por `deriveCoordOrigem` (Task 4) — nomes conferem.
