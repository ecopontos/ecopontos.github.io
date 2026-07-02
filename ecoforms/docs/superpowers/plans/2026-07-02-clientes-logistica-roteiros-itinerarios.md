# Plano - Melhorias na relacao Clientes, Roteiros, Itinerarios e Execucoes

Data: 2026-07-02

Status: Proposto

## Objetivo

Melhorar a integracao entre o cadastro de clientes e o modulo de Logistica, deixando explicita a diferenca entre:

- cliente cadastral;
- imovel/poligonal;
- ponto operacional;
- parada de roteiro;
- itinerario ordenado;
- rota calculada;
- execucao em campo.

O objetivo e reduzir ambiguidades no mapa, melhorar roteirizacao/coleta, permitir auditoria da execucao e preparar o app para uso offline sem depender de servicos externos no momento da operacao.

## Relacao com o plano de georreferenciamento

Este plano depende de `2026-07-02-clientes-geolocalizacao-georreferenciamento.md` e nao deve duplicar as entidades que ele define:

- `imovel_id` (usado abaixo em `roteiro_paradas`, `execucao_paradas` e na prioridade de resolucao de coordenada) referencia `terrenos.id` — mesma tabela e mesma convencao adotada no outro plano, nao um dominio cadastral novo.
- `imovel_pontos_operacionais` e criada na Fase 4 do plano de georreferenciamento. A Fase 3 deste plano **reaproveita** essa tabela — nao recria.
- `cliente_imovel_vinculos` e criada na Fase 3 do plano de georreferenciamento. A prioridade de resolucao de coordenada (diretriz 3) so pode considerar o nivel "vinculo principal" depois que essa tabela existir.
- A captura de GPS em campo com `accuracy`/`timestamp` (Fase 5 deste plano) reaproveita a mesma integracao de `GeolocationField.js`/`GPSField.v2.js` descrita na Fase 5 do plano de georreferenciamento — a parte nova aqui e comparar contra a parada planejada, nao capturar GPS de novo.

Ordem de execucao sugerida entre os dois planos: Fase 1-2 deste plano podem rodar em paralelo com qualquer fase do outro (sao so nomenclatura e diagnostico). Fase 3 deste plano depende da Fase 3 e 4 do plano de georreferenciamento estarem concluidas. Fase 5 deste plano depende da Fase 5 do plano de georreferenciamento.

## Descobertas no codigo atual

### Modelo funcional existente

O fluxo atual se apoia em quatro estruturas principais:

```text
clientes
  cadastro base, endereco, latitude/longitude, terreno_id

roteiros
  cabecalho da rota/roteiro: nome, base, turno, periodicidade, situacao

roteiro_clientes
  associacao ordenada entre roteiro e cliente
  roteiro_id + cliente_id + ordem + observacao + ativo + terreno_id opcional

execucao_clientes
  resultado operacional por cliente em uma execucao
  execucao_id + cliente_id + coleta_realizada + quantidade + ocorrencia + GPS observado
```

Arquivos observados:

- `ecoforms/desktop/app/logistica/roteiros/[id]/RoteiroDetailPage.tsx`
- `ecoforms/desktop/components/logistics/ItinerarioModal.tsx`
- `ecoforms/desktop/components/logistics/ItinerarioMap.tsx`
- `ecoforms/desktop/lib/itinerary.ts`
- `ecoforms/desktop/src/domain/logistics/LogisticsRepository.ts`
- `ecoforms/desktop/src/interface/hooks/queries/useLogistics.ts`
- `ecoforms/desktop/src/interface/hooks/mutations/useLogisticsMutations.ts`
- `ecoforms/desktop/src/infrastructure/persistence/sqlite/SqliteLogisticsRepository.ts`
- `ecoforms/desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts`

### Como clientes entram no roteiro

Na tela de detalhe do roteiro, a aba `Clientes` usa `useClientes()` para buscar clientes cadastrados.

Ao selecionar um cliente, a UI chama `addClienteToRoteiro()`, que grava em `roteiro_clientes`.

A relacao e por referencia, nao por copia:

```text
roteiro_clientes.roteiro_id -> roteiros.id
roteiro_clientes.cliente_id -> clientes.id
```

O repositorio usa `ON CONFLICT(roteiro_id, cliente_id)` para reativar um vinculo existente e atualizar `ordem`, `observacao` e `ativo`.

### Como a ordem vira itinerario

`useClientesByRoteiro()` carrega os clientes vinculados ao roteiro via `roteiro_clientes JOIN clientes`, ordenando por `rc.ordem`.

`useItinerario()` carrega a visao geografica das paradas a partir da query `ROTEIRO_CLIENTES_ITINERARIO`.

A posicao da parada e resolvida assim:

```sql
COALESCE(t.centroid_lat, c.latitude)  AS latitude,
COALESCE(t.centroid_lng, c.longitude) AS longitude,
COALESCE(rc.terreno_id, c.terreno_id) AS terreno_id
```

Isso significa:

- `roteiro_clientes.terreno_id` pode sobrescrever o terreno do cadastro do cliente.
- Se `roteiro_clientes.terreno_id` estiver nulo, usa `clientes.terreno_id`.
- Se houver terreno/poligonal, usa o centroide.
- Se nao houver terreno, usa `clientes.latitude` e `clientes.longitude`.

### Como a rota e otimizada hoje

O app nao calcula rota viaria real.

O utilitario `lib/itinerary.ts` calcula:

- distancia Haversine em linha reta;
- total aproximado em km;
- quantidade de pontos sem localizacao;
- reordenacao por vizinho mais proximo.

O algoritmo atual e greedy, comecando pelo primeiro ponto geocodificado. Pontos sem coordenada mantem ordem relativa e vao para o final.

### Como a execucao usa o roteiro

Uma execucao de coleta aponta para `roteiro_id`.

Na tela de execucao, o app carrega novamente os clientes do roteiro e registra resultado operacional em `execucao_clientes`.

O registro de execucao por cliente guarda:

- coleta realizada;
- quantidade;
- ocorrencia;
- observacao;
- horario de visita;
- latitude/longitude observada;
- usuario e data de registro.

## Problemas e lacunas

### 1. Roteiro, itinerario e rota estao misturados na linguagem

Hoje o sistema usa "roteiro", "itinerario" e "rota" quase como sinonimos.

Proposta de definicao:

```text
Roteiro:
  agrupamento operacional recorrente de clientes/paradas.

Itinerario:
  lista ordenada de paradas de um roteiro em uma data/configuracao.

Rota:
  caminho calculado entre paradas, idealmente pela malha viaria.

Execucao:
  realizacao concreta de um roteiro/itinerario em campo.
```

### 2. A parada ainda aponta para cliente, nao para ponto operacional

`roteiro_clientes` associa o roteiro a um cliente.

Isso funciona, mas deixa ambigua a localizacao usada:

- cliente pode ter latitude/longitude estimada;
- cliente pode ter terreno/poligonal;
- roteiro pode sobrescrever `terreno_id`;
- nao existe ponto operacional explicito.

Para coleta, a parada deveria poder apontar para um ponto operacional, nao apenas para o cadastro do cliente.

### 3. Centroide da poligonal e usado como ponto de operacao

O centroide e bom para representar o imovel, mas pode ser inadequado para coleta:

- portaria fica em outro ponto;
- acesso de servico fica em outra rua;
- area do terreno pode ser grande ou irregular;
- ponto de coleta pode estar fora do centroide.

### 4. Rota otimizada nao respeita malha viaria

O vizinho mais proximo por Haversine melhora a ordem aproximada, mas nao considera:

- ruas;
- sentidos de circulacao;
- restricoes de veiculo;
- tempo;
- janelas de atendimento;
- base de saida/retorno;
- capacidade do veiculo.

### 5. Execucao nao congela completamente o snapshot do roteiro

O registro de execucao usa `roteiro_id` e registros em `execucao_clientes`.

Se o roteiro for alterado depois, e importante garantir que a execucao passada continue auditavel com a lista e ordem originalmente executadas.

O app ja grava `execucao_clientes`, mas o planejamento deveria tratar isso como snapshot operacional explicito.

### 6. Falta rastreabilidade da fonte geografica usada na parada

Ao montar a parada, o app nao explicita se a coordenada veio de:

- centroide de terreno;
- lat/lng do cliente;
- override em `roteiro_clientes.terreno_id`;
- ponto manual;
- GPS;
- importacao.

Isso dificulta explicar por que uma parada apareceu em certo local.

## Diretrizes propostas

### 1. Separar vocabulario no dominio

Adotar os termos:

```text
Roteiro = plano recorrente.
Parada = item operacional do roteiro.
Itinerario = sequencia ordenada de paradas.
Rota = geometria/caminho calculado entre paradas.
Execucao = evento concreto em campo.
```

Na UI, evitar chamar ordem de clientes de "rota" quando ainda nao ha geometria viaria calculada.

### 2. Evoluir `roteiro_clientes` para conceito de parada

Sem quebrar imediatamente o schema, tratar `roteiro_clientes` como "paradas do roteiro".

Campos futuros sugeridos:

```text
roteiro_paradas
- id
- roteiro_id
- cliente_id
- imovel_id
- ponto_operacional_id
- ordem_planejada
- observacao
- tipo_parada
- ativo
- criado_em
- atualizado_em
```

Possiveis tipos de parada:

```text
coleta
vistoria
entrega
fiscalizacao
retirada
apoio
```

### 3. Introduzir ponto operacional como destino preferencial

Quando houver ponto operacional, a parada deve usar esse ponto antes de usar centroide ou lat/lng do cliente.

Prioridade sugerida para resolver coordenada da parada:

```text
1. roteiro_paradas.ponto_operacional_id
2. roteiro_paradas.imovel_id -> ponto operacional principal do imovel
3. roteiro_paradas.imovel_id -> centroide do imovel
4. cliente_imovel_vinculos (vinculo principal) -> ponto operacional principal
5. cliente.terreno_id -> ponto operacional principal
6. cliente.terreno_id -> centroide
7. cliente.latitude/longitude
```

Niveis 1-3 e 5-7 podem ser implementados assim que `imovel_pontos_operacionais` existir (Fase 4 do plano de georreferenciamento). O nivel 4 so fica disponivel depois que `cliente_imovel_vinculos` existir (Fase 3 do plano de georreferenciamento) — ate la, o fallback pula direto de `roteiro_paradas.imovel_id` (niveis 1-3) para `cliente.terreno_id` (niveis 5-7).

Essa prioridade deve ser documentada e visivel em diagnostico da parada.

### 4. Congelar snapshot na execucao

Ao criar uma execucao, gerar snapshot das paradas planejadas.

Modelo sugerido:

```text
execucao_paradas
- id
- execucao_id
- roteiro_parada_id
- cliente_id
- imovel_id
- ponto_operacional_id
- ordem_planejada
- latitude_planejada
- longitude_planejada
- fonte_localizacao_planejada
- endereco_snapshot
- observacao_planejada
- status
- criado_em
```

Isso preserva o que foi planejado mesmo que o cadastro do cliente, terreno ou roteiro mude depois.

`execucao_clientes` pode ser mantida por compatibilidade ou evoluir para apontar para `execucao_paradas`.

### 5. Registrar observado versus planejado

Na execucao, separar:

```text
latitude_planejada / longitude_planejada
latitude_observada / longitude_observada
distancia_planejado_observado_m
gps_accuracy_m
observado_em
observado_por
```

Isso ajuda a detectar:

- coleta feita no local esperado;
- coleta feita em local proximo;
- registro distante da parada;
- ponto operacional que precisa ser corrigido.

### 6. Melhorar status por parada

Hoje a coleta por cliente guarda `coleta_realizada`, quantidade e ocorrencia.

Proposta de status mais expressivo:

```text
pendente
em_deslocamento
visitado
coletado
nao_coletado
reagendar
intercorrencia
cancelado
```

Isso permite relatorio operacional mais claro e facilita sync com runtime/mobile.

### 7. Diferenciar otimizacao aproximada e rota viaria

Manter o algoritmo atual como "otimizacao aproximada por proximidade".

Adicionar no futuro um provedor de roteamento:

```text
route_provider:
- none
- local_haversine
- osrm
- graphhopper
- ors
- google_routes
```

Campos sugeridos para uma rota calculada:

```text
rotas_calculadas
- id
- roteiro_id
- execucao_id
- provider
- profile
- geometry
- distance_m
- duration_s
- calculated_at
- input_hash
```

Para operacao offline, a geometria da rota deve ser calculada antes e enviada no pacote do runtime quando necessario.

### 8. Criar diagnostico de paradas sem localizacao

Hoje o app conta pontos sem localizacao. Isso deve virar ferramenta de qualidade.

Para cada parada sem coordenada, mostrar causa provavel:

- cliente sem lat/lng;
- cliente sem imovel vinculado;
- terreno sem centroide;
- ponto operacional ausente;
- terreno inativo;
- override de terreno invalido.

Acao sugerida na UI:

- abrir cadastro do cliente;
- vincular imovel;
- definir ponto operacional;
- usar coordenada manual;
- remover parada do roteiro.

## Plano de implementacao

### Fase 1 - Diagnostico e nomenclatura

Objetivo: melhorar clareza sem alterar schema principal.

Tarefas:

- Ajustar textos da UI para diferenciar roteiro, itinerario e rota aproximada.
- Renomear descricoes de "Otimizar rota" para "Otimizar ordem por proximidade" quando ainda for Haversine.
- Adicionar painel/lista de paradas sem localizacao com motivo.
- Exibir fonte da coordenada usada na parada: `cliente_latlng`, `terreno_centroid`, `roteiro_terreno_override`.
- Documentar a ordem de fallback atual.

### Fase 2 - Resolver coordenada da parada com proveniencia

Objetivo: criar uma funcao unica para resolver localizacao operacional da parada.

Tarefas:

- Criar helper/servico `resolveParadaLocation`.
- Centralizar a prioridade de fontes.
- Retornar `latitude`, `longitude`, `source`, `confidence`, `source_id`.
- Atualizar `useItinerario()` para consumir esse conceito.
- Adicionar testes para fallback entre `rc.terreno_id`, `c.terreno_id` e `c.latitude/longitude`.

### Fase 3 - Ponto operacional

Pre-requisito: Fase 4 do plano de georreferenciamento (`imovel_pontos_operacionais`) concluida — esta fase reaproveita a tabela, nao cria uma nova.

Objetivo: parar de usar centroide como destino operacional quando houver alternativa melhor.

Tarefas:

- Adicionar `imovel_id` e `ponto_operacional_id` em `roteiro_paradas` (FK para `terrenos.id` e `imovel_pontos_operacionais.id`, respectivamente).
- Permitir escolher ponto operacional no roteiro/parada, a partir dos pontos ja cadastrados para o imovel.
- Atualizar mapa do itinerario para destacar poligonal e ponto operacional.
- Permitir "usar centroide como ponto inicial" com baixa/média confianca.

### Fase 4 - Snapshot de execucao

Objetivo: tornar execucoes historicamente auditaveis.

Tarefas:

- Criar `execucao_paradas` ou equivalente.
- Ao criar execucao, materializar lista de paradas do roteiro.
- Salvar ordem e coordenada planejadas.
- Registrar fonte da coordenada planejada.
- Ajustar painel de coleta para usar snapshot da execucao, nao lista viva do roteiro.
- Migrar gradualmente `execucao_clientes` para compatibilidade.

### Fase 5 - Observado versus planejado

Pre-requisito: Fase 5 do plano de georreferenciamento (integracao `GeolocationField`/`GPSField.v2` com `accuracy`/`timestamp`) concluida — esta fase consome essa captura, nao implementa GPS de novo.

Objetivo: melhorar auditoria operacional.

Tarefas:

- Associar o GPS capturado (Fase 5 do plano de georreferenciamento) ao `execucao_paradas` correspondente, em vez de a um cliente/imovel isolado.
- Calcular distancia entre planejado (`latitude_planejada`/`longitude_planejada`) e observado.
- Exibir alerta quando distancia exceder limite configuravel.
- Incluir divergencia em relatorios.

### Fase 6 - Roteamento viario opcional

Objetivo: evoluir de ordem aproximada para rota real quando necessario.

Tarefas:

- Manter Haversine como fallback offline simples.
- Definir interface `RouteProvider`.
- Avaliar OSRM/GraphHopper/ORS/Google Routes.
- Salvar geometria e metadados da rota calculada.
- Permitir pacote offline com rota precomputada para runtime.

## Riscos e cuidados

- Nao substituir cliente por imovel: um cliente pode se relacionar com varios imoveis.
- Nao substituir poligonal por ponto: poligonal e evidencia cadastral; ponto operacional e destino pratico.
- Nao recalcular execucao antiga com dados atuais do cadastro.
- Nao chamar rota viaria aquilo que e apenas ordem por distancia em linha reta.
- Manter compatibilidade com `roteiro_clientes` e `execucao_clientes` enquanto o modelo evolui.
- Evitar dependência de rede no momento de execucao em campo.

## Resultado esperado

Ao final, o app deve conseguir responder:

- Quais clientes fazem parte deste roteiro?
- Qual e a parada operacional de cada cliente?
- Qual fonte geografica foi usada para cada parada?
- A ordem foi definida manualmente, otimizada por proximidade ou calculada por rota viaria?
- O que foi planejado para a execucao?
- O que foi realmente observado em campo?
- A coleta ocorreu perto do ponto planejado?
- Uma alteracao posterior no cadastro afetou ou nao uma execucao antiga?

Essa melhoria preserva a simplicidade do modelo atual, mas cria uma ponte mais segura entre cadastro, georreferenciamento, planejamento logistico e evidencia de campo.
