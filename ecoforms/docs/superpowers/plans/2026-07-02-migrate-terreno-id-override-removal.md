# Migração de leituras: remoção do override morto roteiro_terreno_id (Fase 3 follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o override morto `roteiro_clientes.terreno_id` (nunca escrito pelo app) de tipos, lógica de derivação e testes, completando a migração de leituras de `clientes.terreno_id` → `cliente_imovel_vinculos`.

**Architecture:** As queries SQL já foram migradas para usar `LEFT JOIN cliente_imovel_vinculos cv ON cv.principal = 1`. Este plano remove os resíduos do tipo/origem morta: o campo `roteiro_terreno_id` dos tipos, o branch `roteiro_terreno_override` da derivação de origem, e os testes correspondentes.

**Tech Stack:** TypeScript, Vitest

## Global Constraints

- `clientes.terreno_id` e `roteiro_clientes.terreno_id` **não são dropados** (mantidos para reversibilidade/compatibilidade)
- Writers W3/W4/W5 não são tocados
- Mobile não lê `terreno_id` — sem impacto
- Validação final: `npm run typecheck` + `npx eslint` + `npx vitest run`

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `desktop/lib/itinerary.ts` | Modify | Remover `roteiro_terreno_override` de `CoordOrigem`, `CoordOrigemStop`, `deriveCoordOrigem`, `COORD_ORIGEM_LABELS` |
| `desktop/components/logistics/ItinerarioModal.tsx` | Modify | Remover `roteiro_terreno_override` de `COORD_ORIGEM_DOT_COLOR` |
| `desktop/src/interface/hooks/queries/useMapData.ts` | Modify | Remover `roteiro_terreno_id` e `cliente_terreno_id` de `ItinerarioStop` |
| `desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts` | Modify | Atualizar comentário de fallback (remover nível "override de roteiro") |
| `desktop/src/lib/__tests__/itinerary.test.ts` | Modify | Remover caso `roteiro_terreno_override`, remover campo dos objetos de teste |
| `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts` | Modify | Verificar que ROTEIRO_CLIENTES_ITINERARIO não contém mais roteiro_terreno_id |

---

### Task 1: Remover `roteiro_terreno_override` de `CoordOrigem` e lógica de derivação

**Files:**
- Modify: `desktop/lib/itinerary.ts:88-152`

**Interfaces:**
- Produces: `CoordOrigem` sem `'roteiro_terreno_override'`, `CoordOrigemStop` sem `roteiro_terreno_id`, `deriveCoordOrigem` com 3 caminhos (ponto_operacional → terreno_centroid → cliente_latlng)

- [ ] **Step 1: Remover `'roteiro_terreno_override'` do type `CoordOrigem`**

```typescript
// Linha 88 — DE:
export type CoordOrigem = 'ponto_operacional' | 'cliente_latlng' | 'terreno_centroid' | 'roteiro_terreno_override';
// PARA:
export type CoordOrigem = 'ponto_operacional' | 'cliente_latlng' | 'terreno_centroid';
```

- [ ] **Step 2: Remover `roteiro_terreno_id` de `CoordOrigemStop`**

```typescript
// Linhas 90-103 — remover a propriedade roteiro_terreno_id:
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
}
```

- [ ] **Step 3: Simplificar `deriveCoordOrigem`**

```typescript
// Linhas 112-119 — DE:
export function deriveCoordOrigem(stop: CoordOrigemStop): CoordOrigem | null {
    if (stop.latitude == null || stop.longitude == null) return null;
    const usouPontoOperacional = stop.ponto_operacional_lat != null && stop.ponto_operacional_lng != null;
    if (usouPontoOperacional) return 'ponto_operacional';
    const usouCentroideDoTerreno = stop.terreno_centroid_lat != null && stop.terreno_centroid_lng != null;
    if (!usouCentroideDoTerreno) return 'cliente_latlng';
    return stop.roteiro_terreno_id != null ? 'roteiro_terreno_override' : 'terreno_centroid';
}
// PARA:
export function deriveCoordOrigem(stop: CoordOrigemStop): CoordOrigem | null {
    if (stop.latitude == null || stop.longitude == null) return null;
    const usouPontoOperacional = stop.ponto_operacional_lat != null && stop.ponto_operacional_lng != null;
    if (usouPontoOperacional) return 'ponto_operacional';
    const usouCentroideDoTerreno = stop.terreno_centroid_lat != null && stop.terreno_centroid_lng != null;
    if (!usouCentroideDoTerreno) return 'cliente_latlng';
    return 'terreno_centroid';
}
```

- [ ] **Step 4: Remover `roteiro_terreno_override` de `COORD_ORIGEM_LABELS`**

```typescript
// Linhas 147-152 — DE:
export const COORD_ORIGEM_LABELS: Record<CoordOrigem, string> = {
    ponto_operacional: 'Ponto operacional do imóvel',
    cliente_latlng: 'Coordenada do cadastro do cliente',
    terreno_centroid: 'Centroide do terreno vinculado ao cliente',
    roteiro_terreno_override: 'Centroide do terreno vinculado neste roteiro (substitui o do cliente)',
};
// PARA:
export const COORD_ORIGEM_LABELS: Record<CoordOrigem, string> = {
    ponto_operacional: 'Ponto operacional do imóvel',
    cliente_latlng: 'Coordenada do cadastro do cliente',
    terreno_centroid: 'Centroide do terreno vinculado ao cliente',
};
```

- [ ] **Step 5: Atualizar comentário de fallback (linhas 75-85)**

Remover referências a `roteiro_clientes.terreno_id` e `clientes.terreno_id` como níveis de fallback. O comentário deve refletir apenas:
```
//   0. imovel_pontos_operacionais  — ponto operacional principal do imóvel vinculado (Fase 4)
//   1. cliente_imovel_vinculos      — vínculo principal do cliente resolve o imóvel (Fase 3)
//   2. terrenos.centroid_lat/lng    — centroide do imóvel resolvido em 1, se tiver centroide
//   3. clientes.latitude/longitude  — coordenada do próprio cliente, usada se não houver vínculo/centroide
```

- [ ] **Step 6: Commit**

```bash
git add desktop/lib/itinerary.ts
git commit -m "refactor: remove dead roteiro_terreno_override from CoordOrigem and deriveCoordOrigem"
```

---

### Task 2: Remover `roteiro_terreno_override` de `COORD_ORIGEM_DOT_COLOR` no modal

**Files:**
- Modify: `desktop/components/logistics/ItinerarioModal.tsx:53-58`

**Interfaces:**
- Consumes: `CoordOrigem` from Task 1 (sem `'roteiro_terreno_override'`)

- [ ] **Step 1: Remover a entrada do Record**

```typescript
// Linhas 53-58 — DE:
const COORD_ORIGEM_DOT_COLOR: Record<CoordOrigem, string> = {
  ponto_operacional: "#f97316",
  cliente_latlng: "#3b82f6",
  terreno_centroid: "#22c55e",
  roteiro_terreno_override: "#a855f7",
};
// PARA:
const COORD_ORIGEM_DOT_COLOR: Record<CoordOrigem, string> = {
  ponto_operacional: "#f97316",
  cliente_latlng: "#3b82f6",
  terreno_centroid: "#22c55e",
};
```

- [ ] **Step 2: Commit**

```bash
git add desktop/components/logistics/ItinerarioModal.tsx
git commit -m "refactor: remove roteiro_terreno_override from COORD_ORIGEM_DOT_COLOR"
```

---

### Task 3: Remover `roteiro_terreno_id` e `cliente_terreno_id` de `ItinerarioStop`

**Files:**
- Modify: `desktop/src/interface/hooks/queries/useMapData.ts:62-83`

**Interfaces:**
- Produces: `ItinerarioStop` sem `roteiro_terreno_id` nem `cliente_terreno_id`

- [ ] **Step 1: Remover as propriedades do type**

```typescript
// Linhas 62-83 — DE:
export interface ItinerarioStop {
    ordem: number;
    cliente_id: string;
    nome: string;
    latitude: number | null;
    longitude: number | null;
    terreno_id: string | null;
    terreno_nome: string | null;
    codigo_cadastral: string | null;
    /** rc.terreno_id "cru" (não coalescido) — presente apenas quando o roteiro sobrescreve o terreno do cliente. */
    roteiro_terreno_id: string | null;
    /** c.terreno_id "cru" (não coalescido) — terreno cadastrado no cliente, independente do roteiro. */
    cliente_terreno_id: string | null;
    /** terrenos.centroid_lat "cru" do terreno resolvido (rc ou c) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lat: number | null;
    /** terrenos.centroid_lng "cru" do terreno resolvido (rc ou c) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lng: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lat: number | null;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lng: number | null;
}
// PARA:
export interface ItinerarioStop {
    ordem: number;
    cliente_id: string;
    nome: string;
    latitude: number | null;
    longitude: number | null;
    terreno_id: string | null;
    terreno_nome: string | null;
    codigo_cadastral: string | null;
    /** terrenos.centroid_lat "cru" do terreno resolvido via vínculo principal — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lat: number | null;
    /** terrenos.centroid_lng "cru" do terreno resolvido via vínculo principal — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lng: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lat: number | null;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lng: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/interface/hooks/queries/useMapData.ts
git commit -m "refactor: remove roteiro_terreno_id and cliente_terreno_id from ItinerarioStop"
```

---

### Task 4: Atualizar comentário de fallback em `terrenos.ts`

**Files:**
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts:186-203`

**Interfaces:**
- Consumes: N/A (comentário apenas)

- [ ] **Step 1: Atualizar o bloco de comentário**

Remover referências a `clientes.terreno_id` e `roteiro_clientes.terreno_id` como níveis de resolução. Atualizar o histórico para refletir que ambos foram removidos da resolução. O comentário deve documentar apenas:
```
 *   0. `imovel_pontos_operacionais`   — ponto operacional principal do imóvel vinculado (Fase 4)
 *   1. `cliente_imovel_vinculos`      — vínculo principal do cliente resolve o imóvel (Fase 3)
 *   2. `terrenos.centroid_lat/lng`    — centroide do imóvel resolvido em 1, se tiver centroide
 *   3. `clientes.latitude/longitude`  — coordenada do próprio cliente, usada se não houver vínculo/centroide
```

Atualizar o parágrafo de histórico:
```
 * Histórico: até a migração da Fase 3 (follow-up), a resolução passava por `clientes.terreno_id`
 * (FK 1:1, ADR-038) e por um override `roteiro_clientes.terreno_id` (per-stop) que nunca foi
 * escrito pelo app — ambos removidos da resolução. O override por parada pode voltar como
 * feature dedicada no plano de logística (Fase 3 daquele plano) se necessário.
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts
git commit -m "docs: update fallback comment to reflect roteiro_terreno_override removal"
```

---

### Task 5: Atualizar testes de itinerário

**Files:**
- Modify: `desktop/src/lib/__tests__\itinerary.test.ts`

**Interfaces:**
- Consumes: `CoordOrigem` e `CoordOrigemStop` de Task 1

- [ ] **Step 1: Remover caso `roteiro_terreno_override`**

Remover o it test "retorna roteiro_terreno_override quando roteiro_clientes.terreno_id sobrescreveu o terreno do cliente" (linhas 41-53).

- [ ] **Step 2: Remover `roteiro_terreno_id` dos objetos de teste existentes**

Em todos os `deriveCoordOrigem({...})`, remover a propriedade `roteiro_terreno_id`:
- Linha 10: remover `roteiro_terreno_id: null,`
- Linha 21: remover `roteiro_terreno_id: null,`
- Linha 32: remover `roteiro_terreno_id: null,`
- Linha 46: remover `roteiro_terreno_id: "terreno-override-1",` (do caso removido)
- Linha 60: remover `roteiro_terreno_id: null,`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/__tests__/itinerary.test.ts
git commit -m "test: remove roteiro_terreno_override test case and field from test objects"
```

---

### Task 6: Atualizar testes de queries

**Files:**
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts`

**Interfaces:**
- Consumes: Queries de `terrenos.ts`

- [ ] **Step 1: Adicionar asserção de que ROTEIRO_CLIENTES_ITINERARIO não contém roteiro_terreno_id**

```typescript
it('ROTEIRO_CLIENTES_ITINERARIO não usa mais roteiro_terreno_id (override removido)', () => {
    expect(ROTEIRO_CLIENTES_ITINERARIO.sql).not.toContain('rc.terreno_id');
    expect(ROTEIRO_CLIENTES_ITINERARIO.sql).not.toContain('roteiro_terreno_id');
});
```

- [ ] **Step 2: Adicionar asserção de que CLIENTES_GEO_COUNT usa cliente_imovel_vinculos**

```typescript
it('CLIENTES_GEO_COUNT usa cliente_imovel_vinculos para resolver posição', () => {
    expect(CLIENTES_GEO_COUNT.sql).toContain('cliente_imovel_vinculos');
    expect(CLIENTES_GEO_COUNT.sql).toContain('cv.principal = 1');
});
```

- [ ] **Step 3: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts
git commit -m "test: add assertions for override removal and vinculo-based resolution"
```

---

### Task 7: Validação final

**Files:**
- N/A (comandos de verificação)

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```
Expected: PASS (sem erros de tipo — o `Record<CoordOrigem>` e os tipos vão pegar qualquer referência órfã)

- [ ] **Step 2: Lint**

```bash
npx eslint desktop/lib/itinerary.ts desktop/components/logistics/ItinerarioModal.tsx desktop/src/interface/hooks/queries/useMapData.ts desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts desktop/src/lib/__tests__/itinerary.test.ts desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts
```
Expected: PASS

- [ ] **Step 3: Testes**

```bash
npx vitest run desktop/src/lib/__tests__/itinerary.test.ts desktop/src/infrastructure/persistence/sqlite/queries/__tests__/terrenos.test.ts
```
Expected: PASS

- [ ] **Step 4: Commit final (se necessário)**

```bash
git add -A && git commit -m "chore: verify typecheck, lint and tests pass after override removal"
```

---

## Self-Review

**1. Spec coverage:**
- §1 Queries: ✅ Já migradas (terrenos.ts, service.ts, SqliteAgendamentoRepository.ts) — verificado via leitura
- §2 Override morto: ✅ Task 1-4 (tipos, lógica, comentário)
- §3 Types: ✅ Task 3 (ItinerarioStop), Task 1 (CoordOrigem/CoordOrigemStop)
- §4 Writers: ✅ Fora de escopo (mantidos)
- §5 Mobile/sync: ✅ Sem impacto confirmado
- §6 Testes: ✅ Task 5-6
- §7 Critério de aceite: coberto pelas tasks acima

**2. Placeholder scan:** Nenhum placeholder encontrado.

**3. Type consistency:**
- `CoordOrigem` (Task 1) → `COORD_ORIGEM_DOT_COLOR` (Task 2) → testes (Task 5) — consistente
- `CoordOrigemStop` (Task 1) → `deriveCoordOrigem` (Task 1) → testes (Task 5) — consistente
- `ItinerarioStop` (Task 3) → sem consumers que usem `roteiro_terreno_id` — verificado via grep
