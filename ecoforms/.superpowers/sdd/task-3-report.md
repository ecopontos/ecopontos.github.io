# Task 3 Report: Remover roteiro_terreno_id e cliente_terreno_id de ItinerarioStop

## Status

**DONE**

## What was done

Removed two dead/legacy properties from the `ItinerarioStop` interface in `desktop/src/interface/hooks/queries/useMapData.ts`:

- `roteiro_terreno_id: string | null;` — dead override field, no longer populated by SQL
- `cliente_terreno_id: string | null;` — legacy field no longer needed

Also updated JSDoc comments on `terreno_centroid_lat` and `terreno_centroid_lng` to replace "rc ou c" references with "vínculo principal".

## Commits

- `4ee0c84` — refactor: remove roteiro_terreno_id and cliente_terreno_id from ItinerarioStop

## Verification

- Grep confirmed references to these fields only exist in the interface definition, test files (Task 5), and plan/report docs (not production code)
- The `useItinerario` hook returns `ItinerarioStop[]` — no consumer accesses the removed fields
- Interface now has 10 properties (was 12), all still used by the SQL query

## Test summary

No runtime tests affected. The test file `itinerary.test.ts` references `roteiro_terreno_id` but will be updated in Task 5 (test cleanup).

## Concerns

None.

## Report file

`.superpowers\sdd\task-3-report.md`
