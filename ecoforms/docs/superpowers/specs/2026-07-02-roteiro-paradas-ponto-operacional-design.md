# Design — Ponto operacional por parada de roteiro (Fase 3 do plano de logística)

Data: 2026-07-02

Status: Aprovado (ver decisões abaixo)

## Objetivo

Permitir que uma parada de roteiro (`roteiro_clientes`) resolva sua localização operacional a partir de um ponto operacional específico ou de um imóvel específico, em vez de depender só do vínculo principal automático do cliente (`cliente_imovel_vinculos`). Cobre a Fase 3 do plano `2026-07-02-clientes-logistica-roteiros-itinerarios.md`, cujo pré-requisito (Fase 4 do plano de georreferenciamento — `imovel_pontos_operacionais`) já está concluído.

## Relação com planos existentes

- Não recria `imovel_pontos_operacionais` nem `cliente_imovel_vinculos` — reaproveita as tabelas da Fase 4/3 do plano de georreferenciamento.
- Não substitui `roteiro_clientes` por uma tabela nova `roteiro_paradas` (o nome sugerido no plano original) — ver Decisão 1.

## Decisões tomadas durante o brainstorm

1. **Schema: estender `roteiro_clientes`, não criar tabela nova.** `roteiro_clientes` tem PK `(roteiro_id, cliente_id)` e é usada em produção (`RoteiroDetailPage`, `ItinerarioModal`, `useLogisticsMutations`, `SqliteLogisticsRepository`). Criar uma tabela `roteiro_paradas` paralela exigiria migrar dados e trocar todos os pontos de leitura/escrita, sem ganho funcional adicional. Duas colunas nullable resolvem o mesmo problema com risco zero de migração, seguindo o padrão já usado nas Fases 3/4 do georreferenciamento (estender, não substituir).
2. **`imovel_id` e `ponto_operacional_id` são independentes.** `imovel_id` sozinho é um override de qual imóvel resolve a parada (útil quando o cliente tem mais de um vínculo em `cliente_imovel_vinculos` — ex.: síndico de vários condomínios — e se quer fixar qual imóvel vale para este roteiro). `ponto_operacional_id` é o override fino de um ponto específico desse imóvel; ao ser setado, sempre implica um `imovel_id` (preenchido junto pela UI, não pelo banco).
3. **Escopo completo neste ciclo**: schema + prioridade de resolução + UI de picker + destaque no mapa. Não faseado.
4. **`CoordOrigem` ganha 2 valores novos** para diferenciar override manual de resolução automática (decisão tomada sem confirmação do usuário — sinalizada como revisável): `parada_ponto_operacional` (nível 0, override de ponto) e `parada_imovel_centroid` (níveis 1-2, override de imóvel caindo no centroide). Quando o `imovel_id` da parada resolve para o ponto operacional principal desse imóvel (nível 1), a origem reportada é `parada_ponto_operacional` também (o ponto é o mesmo tipo de dado, só que resolvido automaticamente a partir do imóvel escolhido em vez de escolhido diretamente).

## Schema

```sql
ALTER TABLE roteiro_clientes ADD COLUMN imovel_id TEXT REFERENCES terrenos(id);
ALTER TABLE roteiro_clientes ADD COLUMN ponto_operacional_id TEXT REFERENCES imovel_pontos_operacionais(id);
```

Sem `CHECK` cruzado entre as duas colunas (SQLite não valida FK condicional). A garantia "o ponto pertence ao imóvel" fica na camada de aplicação: a UI só oferece pontos do imóvel já resolvido, e a query de resolução faz `JOIN` direto pelos IDs gravados — se estiverem inconsistentes (dado corrompido/editado fora da UI), o `ponto_operacional_id` prevalece sobre `imovel_id` na leitura (nível 0 > nível 1-2), então uma inconsistência não quebra a resolução, só usa o ponto diretamente.

## Prioridade de resolução (substitui o comentário/SQL de `ROTEIRO_CLIENTES_ITINERARIO`)

```text
0. roteiro_clientes.ponto_operacional_id      — override explícito de ponto nesta parada
1. roteiro_clientes.imovel_id → ponto operacional principal desse imóvel
2. roteiro_clientes.imovel_id → centroide desse imóvel (se não tiver ponto operacional principal)
3. cliente_imovel_vinculos (vínculo principal) → ponto operacional principal
4. cliente_imovel_vinculos (vínculo principal) → centroide
5. clientes.latitude/longitude
```

`ROTEIRO_CLIENTES_ITINERARIO` ganha dois `LEFT JOIN` adicionais (um para o ponto operacional explícito via `rc.ponto_operacional_id`, outro para o imóvel explícito via `rc.imovel_id` com o mesmo padrão de "ponto principal por `NOT EXISTS`" já usado para `cv.imovel_id`). O `COALESCE` final passa a ter 5 níveis em vez de 3:

```sql
COALESCE(po_override.latitude, po_imovel_override.latitude, po_vinculo.latitude, t_override.centroid_lat, t_vinculo.centroid_lat, c.latitude) AS latitude
```

(nomenclatura ilustrativa — a query final decide os aliases exatos na implementação).

`CoordOrigemStop` (`lib/itinerary.ts`) ganha os campos crus dos novos níveis (`parada_ponto_operacional_lat/lng`, `parada_imovel_centroid_lat/lng` ou equivalente) para `deriveCoordOrigem` decidir a origem sem precisar de query adicional — mesmo padrão já usado para os níveis existentes.

## API (repositório / hooks)

- `RoteiroCliente` (domain type, `LogisticsRepository.ts`) ganha `imovelId?: string | null` e `pontoOperacionalId?: string | null`.
- `findClientesByRoteiro` retorna as duas colunas novas.
- Novo método `updateParadaLocalizacao(roteiroId: string, clienteId: string, update: { imovelId: string | null; pontoOperacionalId: string | null }): Promise<void>` em `LogisticsRepository`/`SqliteLogisticsRepository` — grava os dois campos juntos (sempre a mesma ação de UI decide os dois).
- Novo hook `updateParadaLocalizacao` em `useLogisticsMutations`.

## UI — picker por parada

Em `ItinerarioModal.tsx` e `RoteiroDetailPage.tsx`, ao lado do `CoordOrigemIndicator` já existente em cada linha de parada, um popover compacto com:

- Se o cliente tiver mais de um vínculo em `cliente_imovel_vinculos`: seletor de qual imóvel usar nesta parada (default: vínculo principal).
- Lista dos pontos operacionais do imóvel resolvido (via `usePontosOperacionais`, já existe da Fase 4) para escolher um específico.
- Ação "Usar centroide deste imóvel" — grava `imovel_id`, `ponto_operacional_id = null`.
- Ação "Remover override" — limpa os dois campos, volta à resolução automática via vínculo principal.

## UI — mapa (`ItinerarioMap.tsx`)

A poligonal do imóvel em rota já é destacada hoje (`terrenos-route` layer, existente). Adiciona um marcador secundário no ponto operacional resolvido quando ele difere do centroide/da posição já plotada — permite ver visualmente "esta parada resolve aqui dentro de um imóvel maior".

## Testes

- `ensure-columns`: idempotência das 2 colunas novas (padrão `ensureColumnsImovelGpsEvidencias.test.ts`).
- `terrenos.ts` (query `ROTEIRO_CLIENTES_ITINERARIO`): asserções de que os novos `LEFT JOIN`/`COALESCE` aparecem no SQL, seguindo o padrão de `terrenos.test.ts` existente.
- `deriveCoordOrigem` (`itinerary.test.ts`): casos novos para os 2 valores de `CoordOrigem` adicionados, incluindo prioridade sobre os níveis existentes.
- `SqliteLogisticsRepository` / `updateParadaLocalizacao`: teste com fake `SqlitePort` (padrão `SqliteClienteRepository.vinculos.test.ts`).

## Fora de escopo

- Migrar `execucao_clientes`/execução para usar `roteiro_clientes.ponto_operacional_id` (isso é a Fase 4 do plano de logística — snapshot de execução).
- Validação de que `ponto_operacional_id` realmente pertence a `imovel_id` no banco (fica só na UI).
- Drag-and-drop do marcador de ponto operacional diretamente no `ItinerarioMap.tsx` (o cadastro de pontos já tem isso em `PontoOperacionalMap.tsx`/`TerrenoDetailPage`; aqui só se escolhe entre os já cadastrados).
