# ADR-054 — Correções de Gaps no Geoprocessamento (ADR-038)

**Status:** Implementado  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Relacionado:** ADR-038

---

## Contexto

Auditoria da implementação do ADR-038 revelou 8 gaps entre a especificação e o código real. Alguns são bugs funcionais (MultiPolygon parcial, FK órfã), outros são inconsistências documentais (KML/GPX sem parser, coluna `storage_path` não usada).

---

## Decisões

### 1. `roteiro_clientes.terreno_id` passa a ser consultado com fallback

**Gap:** A coluna `roteiro_clientes.terreno_id` existia no schema mas nunca era lida. A query `useItinerario` sempre derivava o terreno de `clientes.terreno_id`.

**Decisão:** `useItinerario` agora usa `COALESCE(rc.terreno_id, c.terreno_id)`, permitindo que um roteiro override o terreno do cliente sem alterar o cadastro base. Se `rc.terreno_id` for NULL, cai no padrão do cliente.

### 2. `deleteTerrenoById` propaga NULL para clientes e roteiro_clientes

**Gap:** Soft-delete em `terrenos` não limpava as FKs nas tabelas dependentes. Clientes continuavam apontando para terreno inativo, causando exibição parcial (ponto sem polígono).

**Decisão:** Ao inativar um terreno, `UPDATE clientes SET terreno_id = NULL WHERE terreno_id = ?` e `UPDATE roteiro_clientes SET terreno_id = NULL WHERE terreno_id = ?`. O LEFT JOIN em `useClientesGeo` e `useItinerario` já tratam NULL corretamente.

### 3. `computeAreaM2` soma todos os polígonos de MultiPolygon

**Gap:** Para `MultiPolygon`, apenas o primeiro polígono era considerado (`coordinates[0][0]`), subestimando a área de lotes com múltiplas parcelas.

**Decisão:** Iterar sobre todos os polígonos do `MultiPolygon`, somando as áreas individuais. Cada polígono usa o mesmo cálculo Shoelace com conversão graus→m².

### 4. `computeCentroid` usa bounding box para MultiPolygon

**Gap:** Para `MultiPolygon`, o centróide era calculado apenas no primeiro polígono, podendo posicionar o pino fora da área visível.

**Decisão:** Para `MultiPolygon`, calcular o centróide como a média ponderada pela área de cada polígono. Polígonos maiores puxam o centróide para si, resultado mais representativo visualmente.

### 5. `TerrenoImport` valida tipo de geometria

**Gap:** Qualquer geometria não-null era aceita (Point, LineString, etc.), gerando registros com `centroid_lat/lng = null` e `area_m2 = null`.

**Decisão:** Filtrar apenas `Polygon` e `MultiPolygon` no import, rejeitando features com geometria incompatível. O contador de "skipped" já existia e absorve essas rejeições.

### 6. KML/GPX: CHECK mantido, documentado como extensão futura

**Gap:** `geo_layers.tipo` permite `'kml'` e `'gpx'` mas não há parser implementado.

**Decisão:** Manter o CHECK constraint para evitar migração de schema. A UI orienta conversão via mapshaper.org. Quando houver demanda, implementar parser de KML/GPX e atualizar o `saveGeoLayer` para aceitar esses formatos.

### 7. `storage_path` mantido como coluna reservada

**Gap:** Coluna existe mas nunca é escrita ou lida.

**Decisão:** Manter como reserva para futuro armazenamento em disco de arquivos GeoJSON grandes (> 5 MB). Atualmente, o GeoJSON é armazenado diretamente na coluna `geojson` como TEXT. Nenhuma ação imediata.

---

## Consequências

### Positivas
- Roteiros podem override o terreno do cliente sem afetar o cadastro base
- Exclusão de terreno não deixa FKs órfãs em clientes
- Área e centróide corretos para MultiPolygon
- Import rejeita geometrias incompatíveis silenciosamente
- Documentação sincronizada com implementação

### Negativas / Trade-offs
- `roteiro_clientes.terreno_id` ainda precisa de UI para edição (futuro)
- KML/GPX ainda requer conversão manual — não é blocking mas é attrition para operadores