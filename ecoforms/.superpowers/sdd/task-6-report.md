# Task 6: Atualizar testes de queries

## Status: DONE

## Commit
- `aa85580` — test: add assertions for override removal and vinculo-based resolution

## Changes
- Added `CLIENTES_GEO_COUNT` to import in `terrenos.test.ts`
- Added 2 new test cases in `describe('precedência de ponto operacional (Fase 4)')`:
  1. `ROTEIRO_CLIENTES_ITINERARIO não usa mais roteiro_terreno_id (override removido)` — asserts `rc.terreno_id` and `roteiro_terreno_id` are absent from the SQL
  2. `CLIENTES_GEO_COUNT usa cliente_imovel_vinculos para resolver posição` — asserts `cliente_imovel_vinculos` and `cv.principal = 1` are present

## Test Result
- **10 passed**, 0 failed (6ms)
- All existing tests unaffected

## Concerns
None.
