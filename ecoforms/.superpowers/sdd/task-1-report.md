# Task 1 Report: Remover `roteiro_terreno_override` de `CoordOrigem` e lógica de derivação

**Status:** DONE

**Commit:** `b7e395d` - refactor: remove dead roteiro_terreno_override from CoordOrigem and deriveCoordOrigem

**Changes made:**
1. Removed `'roteiro_terreno_override'` from `CoordOrigem` type
2. Removed `roteiro_terreno_id` property from `CoordOrigemStop` interface
3. Simplified `deriveCoordOrigem` function to remove the `roteiro_terreno_override` branch
4. Removed `roteiro_terreno_override` from `COORD_ORIGEM_LABELS` constant
5. Updated fallback comment block to reflect the new hierarchy (removed references to `roteiro_clientes.terreno_id` and `clientes.terreno_id`)

**Test summary:**
- Tests cannot run due to path alias issue (`@/lib/itinerary` not resolved in test file)
- The test file at `desktop/src/lib/__tests__/itinerary.test.ts` contains references to `roteiro_terreno_id` that will need to be removed in Task 5 (as expected per task brief)

**Concerns:** None. All changes are minimal and focused on removing dead code as specified.