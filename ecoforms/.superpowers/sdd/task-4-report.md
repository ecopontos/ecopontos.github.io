# Task 4: Atualizar comentário de fallback em terrenos.ts

## Status: DONE (no changes needed)

The comment block at lines 185-203 of `desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts` already contains the correct content:

1. **Resolution order** (lines 189-192):
   - 0. `imovel_pontos_operacionais` — ponto operacional principal do imóvel vinculado (Fase 4)
   - 1. `cliente_imovel_vinculos` — vínculo principal do cliente resolve o imóvel (Fase 3)
   - 2. `terrenos.centroid_lat/lng` — centroide do imóvel resolvido em 1
   - 3. `clientes.latitude/longitude` — coordenada do próprio cliente

2. **Historical paragraph** (lines 195-198): Already notes that both `clientes.terreno_id` and `roteiro_clientes.terreno_id` override were removed from resolution.

## Commits

None — no changes required.

## Concerns

None. The task was already completed in a prior session.
