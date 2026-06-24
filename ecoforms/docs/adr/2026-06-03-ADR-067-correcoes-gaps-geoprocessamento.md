# ADR-067 ÔÇö Corre├º├Áes de Gaps no Geoprocessamento (ADR-038)


> **Renumerado** de ADR-054 para ADR-067 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Implementado  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Relacionado:** ADR-038

---

## Contexto

Auditoria da implementa├º├úo do ADR-038 revelou 8 gaps entre a especifica├º├úo e o c├│digo real. Alguns s├úo bugs funcionais (MultiPolygon parcial, FK ├│rf├ú), outros s├úo inconsist├¬ncias documentais (KML/GPX sem parser, coluna `storage_path` n├úo usada).

---

## Decis├Áes

### 1. `roteiro_clientes.terreno_id` passa a ser consultado com fallback

**Gap:** A coluna `roteiro_clientes.terreno_id` existia no schema mas nunca era lida. A query `useItinerario` sempre derivava o terreno de `clientes.terreno_id`.

**Decis├úo:** `useItinerario` agora usa `COALESCE(rc.terreno_id, c.terreno_id)`, permitindo que um roteiro override o terreno do cliente sem alterar o cadastro base. Se `rc.terreno_id` for NULL, cai no padr├úo do cliente.

### 2. `deleteTerrenoById` propaga NULL para clientes e roteiro_clientes

**Gap:** Soft-delete em `terrenos` n├úo limpava as FKs nas tabelas dependentes. Clientes continuavam apontando para terreno inativo, causando exibi├º├úo parcial (ponto sem pol├¡gono).

**Decis├úo:** Ao inativar um terreno, `UPDATE clientes SET terreno_id = NULL WHERE terreno_id = ?` e `UPDATE roteiro_clientes SET terreno_id = NULL WHERE terreno_id = ?`. O LEFT JOIN em `useClientesGeo` e `useItinerario` j├í tratam NULL corretamente.

### 3. `computeAreaM2` soma todos os pol├¡gonos de MultiPolygon

**Gap:** Para `MultiPolygon`, apenas o primeiro pol├¡gono era considerado (`coordinates[0][0]`), subestimando a ├írea de lotes com m├║ltiplas parcelas.

**Decis├úo:** Iterar sobre todos os pol├¡gonos do `MultiPolygon`, somando as ├íreas individuais. Cada pol├¡gono usa o mesmo c├ílculo Shoelace com convers├úo grausÔåÆm┬▓.

### 4. `computeCentroid` usa bounding box para MultiPolygon

**Gap:** Para `MultiPolygon`, o centr├│ide era calculado apenas no primeiro pol├¡gono, podendo posicionar o pino fora da ├írea vis├¡vel.

**Decis├úo:** Para `MultiPolygon`, calcular o centr├│ide como a m├®dia ponderada pela ├írea de cada pol├¡gono. Pol├¡gonos maiores puxam o centr├│ide para si, resultado mais representativo visualmente.

### 5. `TerrenoImport` valida tipo de geometria

**Gap:** Qualquer geometria n├úo-null era aceita (Point, LineString, etc.), gerando registros com `centroid_lat/lng = null` e `area_m2 = null`.

**Decis├úo:** Filtrar apenas `Polygon` e `MultiPolygon` no import, rejeitando features com geometria incompat├¡vel. O contador de "skipped" j├í existia e absorve essas rejei├º├Áes.

### 6. KML/GPX: CHECK mantido, documentado como extens├úo futura

**Gap:** `geo_layers.tipo` permite `'kml'` e `'gpx'` mas n├úo h├í parser implementado.

**Decis├úo:** Manter o CHECK constraint para evitar migra├º├úo de schema. A UI orienta convers├úo via mapshaper.org. Quando houver demanda, implementar parser de KML/GPX e atualizar o `saveGeoLayer` para aceitar esses formatos.

### 7. `storage_path` mantido como coluna reservada

**Gap:** Coluna existe mas nunca ├® escrita ou lida.

**Decis├úo:** Manter como reserva para futuro armazenamento em disco de arquivos GeoJSON grandes (> 5 MB). Atualmente, o GeoJSON ├® armazenado diretamente na coluna `geojson` como TEXT. Nenhuma a├º├úo imediata.

---

## Consequ├¬ncias

### Positivas
- Roteiros podem override o terreno do cliente sem afetar o cadastro base
- Exclus├úo de terreno n├úo deixa FKs ├│rf├ús em clientes
- ├ürea e centr├│ide corretos para MultiPolygon
- Import rejeita geometrias incompat├¡veis silenciosamente
- Documenta├º├úo sincronizada com implementa├º├úo

### Negativas / Trade-offs
- `roteiro_clientes.terreno_id` ainda precisa de UI para edi├º├úo (futuro)
- KML/GPX ainda requer convers├úo manual ÔÇö n├úo ├® blocking mas ├® attrition para operadores
