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

Criar uma relacao explicita entre cliente e imovel.

Modelo sugerido:

```text
cliente_imovel_vinculos
- id
- cliente_id
- imovel_id
- tipo_relacao
- principal
- confianca
- origem
- valido_de
- valido_ate
- criado_em
- atualizado_em
```

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

Adicionar pontos operacionais vinculados ao imovel/poligonal.

Modelo sugerido:

```text
imovel_pontos_operacionais
- id
- imovel_id
- tipo
- latitude
- longitude
- origem
- observacao
- criado_em
- atualizado_em
```

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

O comentario atual cita limite de 1 req/s do Nominatim, mas o codigo nao implementa fila/rate-limit real.

Propostas:

- Cache local por hash da query normalizada.
- Rate-limit centralizado para geocoding.
- Evitar nova consulta quando endereco nao mudou.
- Guardar resposta bruta resumida para auditoria tecnica, sem depender do provedor no futuro.

## Plano de implementacao

### Fase 1 - Rastreabilidade sem quebrar o modelo atual

Objetivo: manter `clientes.latitude` e `clientes.longitude`, mas adicionar proveniencia.

Tarefas:

- Criar migracao para metadados de geocodificacao.
- Ajustar `GeoResult` para incluir `provider`, `display_name`, `source_query` e `precision` quando disponivel.
- Atualizar `geocodeFromCep()` para retornar a query usada.
- Salvar metadados no cadastro novo e edicao.
- Exibir na tela do cliente a fonte da coordenada.
- Marcar coordenadas digitadas manualmente como `manual`.

### Fase 2 - Candidatos e validacao de qualidade

Objetivo: reduzir falso positivo de geocodificacao.

Tarefas:

- Alterar Nominatim para retornar ate 5 candidatos.
- Criar modal de escolha de candidato.
- Alertar quando endereco estiver incompleto.
- Validar cidade/UF contra retorno do provedor quando disponivel.
- Registrar `confidence`.

### Fase 3 - Vinculo cliente-imovel

Objetivo: parar de misturar cliente, ponto e poligonal.

Tarefas:

- Criar tabela `cliente_imovel_vinculos`.
- Criar UI para vincular cliente a imovel.
- Sugerir vinculo por `territorial`/codigo cadastral.
- Sugerir vinculo por ponto dentro do poligono.
- Sugerir vinculo por proximidade.
- Exibir confianca e origem do vinculo.

### Fase 4 - Ponto operacional

Objetivo: dar suporte real a logistica, coleta e vistoria.

Tarefas:

- Criar tabela `imovel_pontos_operacionais`.
- Permitir cadastrar ponto pelo mapa.
- Permitir usar centroide como fallback.
- Atualizar consultas de logistica para preferir ponto operacional quando existir.
- Manter centroide/poligonal para visualizacao cadastral e auditoria.

### Fase 5 - Evidencia em campo

Objetivo: comparar local declarado, poligonal e local observado.

Tarefas:

- Registrar GPS do Runtime com acuracia e timestamp.
- Comparar ponto do registro com poligonal do imovel.
- Comparar ponto do registro com ponto operacional esperado.
- Exibir divergencias no Desktop.
- Incluir resultado em relatorios.

## Riscos e cuidados

- Geocoding por endereco nunca deve ser tratado como prova forte sem validacao.
- Centroide nao deve substituir ponto operacional em roteirizacao fina.
- Coordenada manual precisa de autoria e data.
- Importacoes de poligonais devem preservar fonte e data da base.
- O app deve continuar funcionando offline com dados ja resolvidos.
- Se usar Nominatim em producao, e necessario respeitar politica de uso, cache e rate-limit.

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

