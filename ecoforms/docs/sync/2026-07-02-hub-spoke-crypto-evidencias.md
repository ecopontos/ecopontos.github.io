# Hub-and-Spoke, Criptografia e Evidencias

Data: 2026-07-02
Status: proposta de arquitetura
Escopo: Desktop hub, runtimes mobile/spoke, sync cifrado, fotos/evidencias e geolocalizacao.

## Contexto

O sync atual cifra o payload remoto (`payload_enc`) com `CryptoLayer`, mas ainda usa metadados remotos para roteamento e ordenacao. Para reduzir exposicao de metadados de negocio, uma alternativa mais simples e tratar o remoto como duto de blobs opacos: o servidor/storage sabe apenas direcao, dominio permissivo, nome tecnico do arquivo, tamanho e data tecnica.

O Desktop atua como coordenador central (hub). Os runtimes atuam como nos de execucao (spokes). O volume esperado e baixo e a comunicacao e no varejo, por tarefas ou respostas pontuais.

## Topologia Proposta

Dois dutos logicos:

- `fila_descida/{dominio}/{object_id}.bin`: Desktop publica comandos, tarefas e envelopes para runtimes autorizados daquele dominio.
- `fila_subida/{dominio}/{object_id}.bin`: runtimes publicam respostas, registros e evidencias para o Desktop.

`dominio` pode representar organizacao, setor ou outro recorte operacional autorizado. `object_id` deve ser opaco. `uuidv7` ajuda polling ordenado, mas vaza cronologia aproximada; se a cronologia tecnica tambem for sensivel, usar `uuidv4` ou bytes aleatorios.

## Modelo de Privacidade

O remoto nao deve conhecer metadados de negocio. Campos como tipo de evento, tarefa, formulario, usuario alvo, cliente, endereco, status, prazos e vinculos ficam dentro do envelope cifrado.

Metadados aceitaveis fora do cifrado:

- direcao do duto;
- dominio permissivo minimo;
- nome opaco do objeto;
- tamanho tecnico;
- timestamps tecnicos do storage;
- permissoes de leitura/escrita.

No duto de descida, runtimes autorizados baixam blobs disponiveis, descriptografam localmente e aplicam apenas o que as regras locais permitirem. No duto de subida, runtimes devem ter permissao preferencialmente append-only; o Desktop le e processa tudo.

## Chaves e Roteamento

Com chave simetrica compartilhada por dominio, todos os runtimes autorizados daquele dominio conseguem descriptografar todos os envelopes daquele dominio. Portanto, a chave compartilhada garante isolamento por dominio, nao por runtime individual.

Consequencia: a selecao granular deve acontecer depois do decrypt, via CRUD local e regras de permissao. Nao assumir que falha de AES-GCM seleciona destinatario quando todos compartilham a mesma chave.

Se for necessario que apenas um runtime especifico abra uma tarefa, sera preciso evoluir para uma destas alternativas:

- chave por runtime ou usuario;
- chave de conteudo por envelope, embrulhada para destinatarios especificos;
- envelopes duplicados por destinatario;
- projection/roteamento com algum metadado externo aceito como vazamento controlado.

## Fotos e Evidencias

Fotos devem ser tratadas como evidencias binarias imutaveis. O app nao deve recomprimir, redimensionar, rotacionar fisicamente, regravar EXIF ou inserir legenda no arquivo original.

Fluxo recomendado:

1. Capturar ou importar a imagem original.
2. Calcular SHA-256 dos bytes originais.
3. Cifrar o arquivo original byte a byte.
4. Calcular SHA-256 do blob cifrado.
5. Enviar o blob cifrado para storage opaco.
6. Enviar um manifesto/envelope cifrado com o contexto da evidencia.

O manifesto cifrado deve conter:

```json
{
  "type": "evidence_photo_uploaded",
  "evidenceId": "uuid",
  "taskId": "uuid",
  "formId": "uuid",
  "fieldId": "foto_entrada",
  "caption": "Foto da entrada do ecoponto antes da coleta",
  "deviceId": "runtime-123",
  "capturedAtDevice": "2026-07-02T14:10:12-03:00",
  "original": {
    "path": "evidence/original/uuid.bin.enc",
    "mime": "image/jpeg",
    "size": 4821932,
    "sha256": "sha256-do-arquivo-original"
  },
  "encrypted": {
    "path": "evidence/original/uuid.bin.enc",
    "size": 4821961,
    "sha256": "sha256-do-blob-cifrado",
    "algorithm": "AES-256-GCM"
  }
}
```

A legenda deve permanecer no manifesto JSON cifrado, nao no EXIF do original. Relatorios, PDFs, thumbnails anotadas e exportacoes podem usar essa legenda como derivado. Se for necessario produzir uma copia marcada, ela deve ser um novo artefato derivado, com hash proprio e referencia explicita ao original.

## EXIF

Como as imagens podem servir para auditoria ou evidencia ao Ministerio Publico, o EXIF integro e relevante. O arquivo original deve ser preservado exatamente como produzido pelo dispositivo, incluindo EXIF.

Nao basta copiar campos EXIF para JSON. O valor probatorio primario e o binario original mais o hash SHA-256. O JSON/manifesto ajuda a interpretar e relacionar a evidencia, mas nao substitui o original.

## Geolocalizacao e Consistencia

O runtime pode registrar a localizacao do formulario e a foto pode trazer localizacao no EXIF. O Desktop pode comparar as duas fontes para classificar coerencia espacial e temporal.

Exemplo de resultado no manifesto/processamento:

```json
{
  "locationCheck": {
    "formGps": {
      "lat": -23.55052,
      "lng": -46.63331,
      "accuracyMeters": 18,
      "capturedAt": "2026-07-02T14:10:12-03:00"
    },
    "photoExifGps": {
      "lat": -23.55061,
      "lng": -46.63320,
      "capturedAt": "2026-07-02T14:09:58-03:00"
    },
    "distanceMeters": 14.7,
    "timeDeltaSeconds": 14,
    "verdict": "consistent"
  }
}
```

Essa verificacao deve ser apresentada como indicio de consistencia, nao como prova absoluta. GPS de celular varia conforme ambiente, aparelho, permissao, rede, ceu aberto e possiveis interferencias.

Politica inicial sugerida:

- `consistent`: distancia <= 50 m e delta <= 10 min;
- `attention`: distancia <= 200 m ou delta <= 60 min;
- `divergent`: distancia > 200 m ou delta > 60 min;
- `unverified`: GPS/timestamp ausente, EXIF sem GPS ou imagem vinda de fonte sem garantias.

Guardar sempre os valores brutos, incluindo `accuracyMeters`, fonte da localizacao, timestamp e se a foto veio da camera ou da galeria.

## Melhorias de GPS no Runtime

O runtime deve capturar localizacao como processo de estabilizacao, nao como leitura unica.

Recomendacao:

- iniciar coleta ao abrir formulario ou camera;
- usar alta precisao quando disponivel;
- coletar multiplas amostras por alguns segundos;
- escolher a melhor leitura por menor `accuracy`;
- encerrar ao atingir limiar aceitavel ou timeout;
- registrar quantidade de amostras e qualidade da medicao.

Limiares iniciais:

- ideal: `accuracy <= 15 m`;
- aceitavel: `accuracy <= 50 m`;
- alerta: `accuracy > 50 m`;
- timeout: 15 a 30 segundos.

## Cadeia de Custodia

Cada evidencia deve gerar eventos append-only, nunca update in-place. Correcoes ou substituicoes viram novos eventos referenciando o anterior.

Eventos recomendados:

- `captured`: imagem capturada e hash original calculado;
- `encrypted`: blob cifrado produzido e hash cifrado calculado;
- `uploaded`: blob enviado ao duto/storage;
- `received_by_desktop`: Desktop recebeu, descriptografou e recalculou hash;
- `derived`: relatorio, thumbnail ou copia anotada gerada a partir do original.

Quando houver chave por dispositivo no futuro, assinar o hash original no runtime fortalece a autoria e a cadeia de custodia.

## Decisao Recomendada

Para baixo volume e prioridade de privacidade, preferir dutos de blobs opacos com filtragem local apos decrypt. O Supabase/storage nao deve ser usado como banco consultavel de negocio. Ele deve atuar como transporte de envelopes cifrados e evidencias cifradas.

O custo aceito e baixar alguns pacotes irrelevantes e descarta-los localmente. O ganho e reduzir vazamento de metadados e simplificar o papel do remoto.
