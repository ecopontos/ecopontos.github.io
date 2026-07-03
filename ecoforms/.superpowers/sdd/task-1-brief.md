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
