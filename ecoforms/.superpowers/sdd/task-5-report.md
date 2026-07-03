# Task 5: Atualizar testes de itinerário

## Status: DONE

## Changes Made

1. **Removed test case** "retorna roteiro_terreno_override quando roteiro_clientes.terreno_id sobrescreveu o terreno do cliente" — this tested functionality no longer exists after Task 1 removed `roteiro_terreno_override` from `CoordOrigem`.

2. **Removed `roteiro_terreno_id` property** from all `deriveCoordOrigem({...})` calls in remaining tests (lines 10, 22, 34, 48).

3. **Updated test description** — changed "sem override do roteiro" to shorter description in the `terreno_centroid` test.

## Test Results

All 8 tests pass:
- `deriveCoordOrigem`: 4 tests
- `deriveMotivoSemLocalizacao`: 4 tests

Output:
```
✓ src/lib/__tests__/itinerary.test.ts (8 tests) 4ms
Test Files  1 passed (1)
Tests       8 passed (8)
```

## Commit

- **SHA:** 06b36d8
- **Message:** test: remove roteiro_terreno_override test case and field from test objects
