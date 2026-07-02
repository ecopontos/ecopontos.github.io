# Plano - Geolocalizacao e georreferenciamento de clientes

Data: 2026-07-02

Status: Proposto

## Objetivo

Melhorar a forma como o modulo Clientes resolve, armazena, audita e utiliza coordenadas geograficas, separando endereco textual, coordenada estimada, coordenada operacional e vinculo com a poligonal do imovel.

O objetivo pratico e reduzir erro operacional em roteirizacao/coleta, aumentar rastreabilidade de auditoria e evitar que uma latitude/longitude sem proveniencia seja tratada como verdade geografica forte.

## Descobertas no codigo atual

### Cadastro e edicao de clientes

O cadastro novo de cliente usa dois fluxos separados:

- `fetchCep()` busca dados de endereco a partir do CEP.
- `geocodeFromCep()` busca latitude/longitude a partir do endereco montado.

Arquivos observados:

- `ecoforms/desktop/app/clientes/novo/page.tsx`
- `ecoforms/desktop/app/clientes/[id]/ClienteDetailPage.tsx`
- `ecoforms/desktop/src/lib/cep.ts`
- `ecoforms/desktop/src/lib/geocoding.ts`
- `ecoforms/desktop/src/infrastructure/persistence/sqlite/SqliteClienteRepository.ts`

O fluxo atual no cadastro novo e:

1. Usuario informa CEP.
2. `fetchCep()` tenta `invoke("fetch_cep")` via Tauri.
3. Se falhar, usa fallback web direto no ViaCEP.
4. O resultado preenche `endereco`, `bairro`, `cidade` e `estado`.
5. Na secao de geolocalizacao, o usuario clica em `Buscar`.
6. `geocodeFromCep()` monta uma query com `endereco`, `numero`, `bairro`, `cidade`, `estado` e `Brasil`.
7. `geocodeAddress()` consulta Nominatim/OpenStreetMap com `limit=1` e `countrycodes=br`.
8. O primeiro resultado retorna `lat/lon`.
9. O formulario grava `latitude` e `longitude`.
10. `SqliteClienteRepository.save()` persiste os valores nas colunas `clientes.latitude` e `clientes.longitude`.

Na edicao de cliente o comportamento e equivalente: o botao "Buscar coordenadas pelo endereco" recalcula latitude/longitude e salva no mesmo registro.

### Uso no mapa e logistica

As consultas geograficas de clientes usam preferencia pelo centroide do terreno quando existe poligonal associada:

```sql
COALESCE(t.centroid_lat, c.latitude)  AS latitude,
COALESCE(t.centroid_lng, c.longitude) AS longitude
```

Isso significa:

- Se houver terreno/poligonal com centroide, o mapa usa o centroide.
- Se nao houver terreno, o mapa usa `clientes.latitude` e `clientes.longitude`.

Esse comportamento e util para visualizacao, mas mistura duas naturezas diferentes:

- Coordenada estimada por geocodificacao textual.
- Centroide de poligono cadastral.

### Vinculo cliente-terreno ja existente (ADR-038)

O modelo atual **ja tem** um vinculo formal entre cliente e cadastro imobiliario, decidido na ADR-038:

- `clientes.terreno_id` — FK opcional, 1:1, para `terrenos.id`.
- `terrenos` — tabela propria de dominio cadastral (`codigo_cadastral`, `centroid_lat`, `centroid_lng`, poligono, `logradouro`), criada especificamente para nao duplicar lat/lng do terreno dentro de `clientes`.
- `roteiro_clientes.terreno_id` tambem referencia `terrenos.id` para logistica.

A ADR-038 ja rejeitou explicitamente copiar lat/lng do terreno para o cliente, pelos mesmos motivos que motivam este plano (evitar dados duplicados e desatualizados). Isso significa que as diretrizes 4 e 5 abaixo nao partem de uma base vazia — elas precisam **estender** `terrenos`/`clientes.terreno_id`, e nao criar um dominio cadastral paralelo chamado "imovel". Ver reconciliacao nas diretrizes 4 e 5.

## Ponderacoes

### Latitude/longitude sem proveniencia e fraca

Hoje o banco guarda apenas os numeros. Nao fica registrado:

- Qual provedor gerou a coordenada.
- Qual string foi usada na consulta.
- Quando a geocodificacao ocorreu.
- Se o resultado veio de endereco completo, rua, bairro, cidade ou CEP.
- Se a coordenada foi digitada manualmente.
- Se foi validada dentro de uma poligonal.
- Se foi obtida por GPS em campo.

Isso dificulta auditoria e pode induzir erro operacional.

### CEP nao e coordenada

O ViaCEP apenas resolve endereco postal. A coordenada vem de uma segunda etapa, por busca textual no Nominatim.

Essa distincao deve ficar clara na UI e no modelo de dados.

### Primeiro resultado do geocoder pode estar errado

O uso de `limit=1` no Nominatim faz o app aceitar o primeiro candidato sem validacao.

Em enderecos incompletos, ruas repetidas, ausencia de numero ou bairros ambiguos, isso pode deslocar o ponto para outro local.

### Centroide do imovel nao e necessariamente ponto operacional

O centroide de uma poligonal e bom para representar o imovel no mapa, mas pode ser ruim para operacao:

- A entrada pode estar em outra rua.
- O ponto de coleta pode ficar na portaria.
- A lixeira/caixa pode estar em uma lateral.
- Um terreno irregular pode ter centroide distante do acesso real.

### Cliente e imovel nao sao a mesma entidade

Um cliente pode ser proprietario, ocupante, sindico, responsavel, gestor, contribuinte ou ponto de coleta de um imovel.

O modelo deveria representar essa relacao explicitamente, em vez de depender apenas de uma coordenada no registro do cliente.

## Diretrizes propostas

### 1. Coordenada sempre com proveniencia

Adicionar metadados de geocodificacao para evitar coordenadas anonimas.

Campos sugeridos, em tabela propria ou extensao do modelo atual:

```text
geocode_provider
geocode_source
geocode_source_query
geocode_display_name
geocode_precision
geocode_confidence
geocode_at
geocode_validated_at
geocode_validated_by
```

Valores possiveis:

```text
provider:
- nominatim
- gps
- manual
- importacao
- terreno_centroid
- ponto_operacional

precision:
- address_exact
- street_interpolated
- street
- neighborhood
- postcode
- city
- manual
- gps
- polygon_centroid
- operational_point

confidence:
- alta
- media
- baixa
```

### 2. Retornar candidatos em vez de aceitar somente o primeiro

Alterar `geocodeAddress()` para permitir `limit=5` e retornar lista de candidatos.

Na UI:

- Mostrar os candidatos em uma lista.
- Exibir `display_name`.
- Permitir confirmacao manual.
- Marcar baixa confianca quando o endereco for incompleto.

### 3. Validar consistencia municipal e cadastral

Depois da geocodificacao, comparar o resultado com:

- `cidade`
- `estado`
- `cep`
- poligonal do imovel quando existir
- `territorial`/codigo cadastral quando informado

Regras sugeridas:

- Resultado fora da UF informada: bloquear ou exigir confirmacao forte.
- Resultado fora do municipio informado: alertar.
- Resultado dentro da poligonal do imovel: alta confianca.
- Resultado proximo da poligonal: media confianca.
- Resultado em outro imovel: exigir confirmacao manual.

### 4. Separar cliente, imovel e vinculo

**Reconciliacao com ADR-038**: `imovel` aqui *e* `terreno` — nao criar um dominio cadastral novo. `cliente_imovel_vinculos.imovel_id` deve referenciar `terrenos.id`. O objetivo desta diretriz nao e duplicar o dominio, e sim substituir o FK 1:1 `clientes.terreno_id` por uma relacao N:N com metadados (tipo, confianca, origem, vigencia), porque um cliente pode ter mais de um imovel vinculado (ex.: sindico de varios condominios) e um imovel pode ter mais de um cliente responsavel.

Modelo sugerido:

```text
cliente_imovel_vinculos
- id                (UUID v7)
- cliente_id
- imovel_id         -- FK para terrenos.id
- tipo_relacao
- principal
- confianca
- origem
- valido_de
- valido_ate
- criado_em
- atualizado_em
```

Migracao: popular `cliente_imovel_vinculos` a partir dos `clientes.terreno_id` existentes (`tipo_relacao='principal'` ou equivalente, `origem='codigo_cadastral'`, `confianca='alta'`) antes de qualquer UI passar a depender da nova tabela. Manter `clientes.terreno_id` como coluna legada/denormalizada até que todo o código de leitura (mapa, logística) migre para consultar `cliente_imovel_vinculos`; só então avaliar descontinuá-la — não remover no mesmo PR que introduz a tabela nova.

Valores de `tipo_relacao`:

```text
proprietario
ocupante
responsavel
sindico
gestor
contribuinte
ponto_coleta
contato
```

Valores de `origem`:

```text
manual
importacao
codigo_cadastral
geocode_inside_polygon
gps_inside_polygon
fiscalizacao
sync
```

### 5. Separar ponto operacional do centroide

Adicionar pontos operacionais vinculados ao terreno/poligonal existente (mesma ressalva da diretriz 4: `imovel_id` = FK para `terrenos.id`, não uma entidade nova).

Modelo sugerido:

```text
imovel_pontos_operacionais
- id                (UUID v7)
- imovel_id         -- FK para terrenos.id
- tipo
- latitude
- longitude
- origem
- observacao
- criado_em
- atualizado_em
```

Caso especifico a tratar: clientes sem `terreno_id`/vinculo (endereco textual apenas, sem poligonal cadastrada) nao tem onde pendurar um ponto operacional por esta tabela. Nesses casos a coordenada com proveniencia da diretriz 1 (`clientes.latitude/longitude` + metadados de geocodificacao) continua sendo o unico ponto disponivel para roteirizacao — a Fase 4 deve manter esse fallback explicito.

Tipos sugeridos:

```text
entrada
portaria
coleta
referencia
acesso_servico
vistoria
```

Uso esperado:

- Mapa cadastral: poligonal e centroide.
- Roteirizacao: ponto operacional principal.
- Auditoria: poligonal, ponto operacional e coordenada observada em campo.
- Relatorio: endereco textual, poligonal vinculada e fonte da coordenada.

### 6. Permitir correcao visual no mapa

Substituir ou complementar digitacao manual de latitude/longitude por:

- Botao "ajustar no mapa".
- Marcador arrastavel.
- Botao "usar centroide do imovel".
- Botao "usar ponto operacional".
- Registro da origem da correcao como `manual`.

### 7. Melhorar uso do GPS em campo

Quando o cadastro ou validacao ocorrer no Runtime/mobile:

- Capturar coordenada GPS com acuracia.
- Aguardar melhoria de precisao quando possivel.
- Registrar `accuracy`, `timestamp`, `provider`, `altitude`, `heading` quando disponivel.
- Comparar GPS do registro com poligonal/ponto operacional.

Isso cria uma evidencia razoavel de presenca em campo sem transformar o GPS em prova absoluta.

### 8. Implementar cache/rate-limit do geocoder

O comentario atual cita limite de 1 req/s do Nominatim, mas o codigo nao implementa fila/rate-limit real. Isso se torna mais critico na Fase 2 (diretriz 2), que aumenta `limit=1` para `limit=5` — mais volume de dados por request, mesma politica de uso a respeitar. Tarefas movidas para a Fase 2 no plano de implementacao.

Propostas:

- Cache local por hash da query normalizada.
- Rate-limit centralizado para geocoding.
- Evitar nova consulta quando endereco nao mudou.
- Guardar resposta bruta resumida para auditoria tecnica, sem depender do provedor no futuro.

## Plano de implementacao

### Fase 1 - Rastreabilidade sem quebrar o modelo atual

Escopo: Desktop apenas (`desktop/app/clientes/`, `desktop/src/lib/geocoding.ts`, `desktop/src/lib/cep.ts`). Cadastro de cliente nao existe no mobile hoje; sem impacto la.

Objetivo: manter `clientes.latitude` e `clientes.longitude`, mas adicionar proveniencia.

Tarefas:

- Criar migracao para metadados de geocodificacao em `scripts/ensure-columns.ts` (bloco `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN` guard) **e** replicar em `docs/db/schema_consolidado_corrigido.sql`, conforme convencao do projeto.
- Ajustar `GeoResult` para incluir `provider`, `display_name`, `source_query` e `precision` quando disponivel.
- Atualizar `geocodeFromCep()` para retornar a query usada.
- Salvar metadados no cadastro novo e edicao.
- Exibir na tela do cliente a fonte da coordenada.
- Marcar coordenadas digitadas manualmente como `manual`.

Criterio de aceite: um cliente geocodificado via CEP exibe provider/precision/data na tela; um cliente com lat/lng digitada manualmente exibe `manual` como origem; nenhuma coluna nova quebra `ensure-columns.ts` idempotente (rodar o script duas vezes sem erro).

### Fase 2 - Candidatos e validacao de qualidade

Escopo: Desktop apenas.

Objetivo: reduzir falso positivo de geocodificacao.

Tarefas:

- Alterar Nominatim para retornar ate 5 candidatos.
- Criar modal de escolha de candidato.
- Alertar quando endereco estiver incompleto.
- Validar cidade/UF contra retorno do provedor quando disponivel.
- Registrar `confidence`.
- Implementar cache local por hash da query normalizada, evitando nova consulta quando o endereco nao mudou (diretriz 8).
- Implementar rate-limit centralizado (fila client-side) respeitando a politica de 1 req/s do Nominatim — necessario porque o modal de candidatos aumenta o volume de dados retornado por consulta.

Criterio de aceite: buscar coordenadas para um endereco incompleto mostra alerta e lista de candidatos (nao aceita o primeiro silenciosamente); repetir a busca para o mesmo endereco nao dispara nova chamada de rede (cache hit).

### Fase 3 - Vinculo cliente-imovel

Escopo: Desktop apenas (`terrenos`/`clientes.terreno_id` sao conceitos exclusivos do desktop; mobile nao tem cadastro de terrenos).

Objetivo: parar de misturar cliente, ponto e poligonal, evoluindo o FK 1:1 `clientes.terreno_id` (ADR-038) para uma relacao N:N com proveniencia.

Tarefas:

- Criar tabela `cliente_imovel_vinculos` (`imovel_id` FK para `terrenos.id`; `id` em UUID v7) em `ensure-columns.ts` + `docs/db/schema_consolidado_corrigido.sql`.
- Migrar `clientes.terreno_id` existentes para `cliente_imovel_vinculos` (ver nota de migracao na diretriz 4); manter a coluna legada ate a leitura (mapa/logistica) migrar para a nova tabela.
- Criar UI para vincular cliente a imovel.
- Sugerir vinculo por `territorial`/codigo cadastral.
- Sugerir vinculo por ponto dentro do poligono.
- Sugerir vinculo por proximidade.
- Exibir confianca e origem do vinculo.

Criterio de aceite: todo `clientes.terreno_id` pre-existente tem uma linha correspondente em `cliente_imovel_vinculos` apos a migracao; um cliente pode ser vinculado a mais de um imovel pela UI.

### Fase 4 - Ponto operacional

Escopo: Desktop apenas.

Objetivo: dar suporte real a logistica, coleta e vistoria.

Tarefas:

- Criar tabela `imovel_pontos_operacionais` (`imovel_id` FK para `terrenos.id`; `id` em UUID v7) em `ensure-columns.ts` + doc de schema.
- Permitir cadastrar ponto pelo mapa.
- Permitir usar centroide como fallback.
- Atualizar consultas de logistica para preferir ponto operacional quando existir, com fallback para `clientes.latitude/longitude` quando o cliente nao tiver `terreno_id`/vinculo (caso descrito na diretriz 5).
- Manter centroide/poligonal para visualizacao cadastral e auditoria.

Criterio de aceite: uma parada de roteiro com ponto operacional cadastrado usa esse ponto em vez do centroide; um cliente sem terreno vinculado continua roteirizavel via `clientes.latitude/longitude`.

### Fase 5 - Evidencia em campo

Escopo: Mobile (captura) + Desktop (comparacao/relatorio). Reaproveitar os campos de GPS ja existentes no mobile (`mobile/www/js/fields/types/GeolocationField.js` e `GPSField.v2.js`, que ja capturam `accuracy` e `timestamp`) em vez de implementar captura nova — o trabalho aqui e de integracao com o cadastro de cliente/imovel, nao de captura de GPS do zero.

Objetivo: comparar local declarado, poligonal e local observado.

Tarefas:

- Integrar `GeolocationField`/`GPSField.v2` ao fluxo de validacao de cliente/imovel no mobile, adicionando `provider`, `altitude` e `heading` quando disponiveis (campos que os componentes atuais nao capturam ainda).
- Comparar ponto do registro com poligonal do imovel.
- Comparar ponto do registro com ponto operacional esperado.
- Exibir divergencias no Desktop.
- Incluir resultado em relatorios.

Criterio de aceite: um registro de GPS em campo fora da poligonal do imovel gera um alerta visivel no Desktop, com distancia e origem dos dois pontos.

## Riscos e cuidados

- Geocoding por endereco nunca deve ser tratado como prova forte sem validacao.
- Centroide nao deve substituir ponto operacional em roteirizacao fina.
- Coordenada manual precisa de autoria e data.
- Importacoes de poligonais devem preservar fonte e data da base.
- O app deve continuar funcionando offline com dados ja resolvidos.
- Se usar Nominatim em producao, e necessario respeitar politica de uso, cache e rate-limit.
- `clientes.terreno_id` nao deve ser removido na mesma fase em que `cliente_imovel_vinculos` e criada — remover cedo demais quebra qualquer leitura (mapa, logistica) que ainda dependa do FK direto.
- `imovel_id`/`imovel_pontos_operacionais` referenciam `terrenos.id`; nao criar uma tabela cadastral paralela para "imovel" — isso duplicaria o dominio que a ADR-038 ja resolveu.

## Resultado esperado

Ao final, o modulo Clientes deve conseguir responder:

- De onde veio esta coordenada?
- Qual endereco foi usado para calcula-la?
- Quem confirmou?
- Quando foi confirmada?
- Ela cai dentro do imovel?
- Qual imovel esta vinculado ao cliente?
- Qual ponto deve ser usado para operacao?
- Qual foi o local real registrado em campo?

Essa separacao melhora logistica, relatorios, auditoria e confiabilidade dos dados sem exigir grande volume de dados ou exposicao desnecessaria de metadados sensiveis.

## Plano relacionado

`2026-07-02-clientes-logistica-roteiros-itinerarios.md` depende das Fases 3, 4 e 5 deste plano (`cliente_imovel_vinculos`, `imovel_pontos_operacionais` e a captura de GPS de campo) para resolver a coordenada operacional de paradas de roteiro e comparar planejado vs. observado. Nao recriar essas tabelas la — ver secao "Relacao com o plano de georreferenciamento" no outro documento.
