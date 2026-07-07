# Design: Backend Google Apps Script para o app Ecoponto

Data: 2026-07-07
Status: aprovado para geração de plano de implementação

## Contexto

O app `ecoponto/` (PWA, duas variantes: `index.html`/`script.js` para celular e
`pc.html`/`scriptpc.js` para PC) já registra atendimentos localmente em
IndexedDB e tenta enviar cada registro via `POST` (`fetch`, `mode: 'no-cors'`)
para uma URL de Google Apps Script configurada em `configuracao.html`
(`localStorage.sheetsUrl`). O que falta é o próprio script do lado do Google
Apps Script (GAS) que recebe esse `POST` e grava os dados numa planilha.

Como o `fetch` usa `mode: 'no-cors'`, o cliente **nunca lê a resposta** do GAS
— o envio é "fire-and-forget". Isso tem duas implicações diretas no design:

1. O GAS não pode sinalizar erros de volta ao app; erros precisam ser
   registrados no próprio GAS para diagnóstico manual.
2. Falhas de rede no cliente disparam reenvio automático pela fila local
   (`filaPendente`, hoje implementada só em `script.js` — ver correção na
   Parte B), então o mesmo registro pode chegar ao GAS mais de uma vez. O GAS
   precisa deduplicar.

### Bug pré-existente identificado

`configuracao.js` salva em `localStorage.ecoponto` o **valor numérico do
select** (`"1"`–`"9"`), não o nome do PEV. Isso é usado tanto para exibir o
nome do ecoponto na tela (`nome-ecoponto-display`) quanto para o campo
`ecoponto` enviado ao Sheets — ou seja, hoje a tela mostra `"3"` em vez de
"PEV MORRO DAS PEDRAS", e é isso que seria gravado na planilha. Este design
inclui a correção no cliente (ver Parte B), para que a planilha receba o nome
legível.

## Parte A — Arquitetura geral

- **Uma planilha Google Sheets** ("Ecopontos - Atendimentos"), com **uma aba
  por PEV** (9 abas — uma para cada opção do select em `configuracao.html`),
  criadas automaticamente pelo script na primeira gravação de cada ecoponto.
- **Uma aba `_Erros`** para registrar payloads malformados, campos
  obrigatórios ausentes, ou nome de ecoponto fora da lista conhecida (ex.:
  dispositivo com versão antiga do app ainda enviando o código numérico).
  Isso evita perder dados silenciosamente, mesmo sem endpoint de leitura.
- **Um único Apps Script vinculado à planilha**, implantado como Web App
  (`doPost`), com **uma única URL `/exec`** configurada em todos os
  dispositivos — todos os ecopontos apontam para a mesma URL; o script decide
  a aba de destino pelo campo `ecoponto` do payload.
- Fluxo: app grava local (IndexedDB) → tenta `POST` (fire-and-forget) → GAS
  valida → deduplica por `idRegistro` → grava na aba correta (ou em
  `_Erros`, se inválido).

## Parte B — Mudanças no cliente (`ecoponto/`)

Três mudanças, aplicadas em `script.js` (celular) e `scriptpc.js` (PC) —
ambos leem a mesma configuração salva em `configuracao.html`/`.js`:

1. **Nome do ecoponto em vez do código numérico.**
   `configuracao.js` (`salvarConfiguracao`) passa a salvar também
   `localStorage.nomeEcoponto` com o texto da opção selecionada
   (`document.getElementById('ecoponto').selectedOptions[0].text`). O select
   continua guardando o id numérico em `localStorage.ecoponto` (necessário
   para restaurar a seleção do `<select>` ao reabrir a tela), mas
   `script.js`/`scriptpc.js` passam a ler `nomeEcoponto` tanto para exibir em
   `nome-ecoponto-display` quanto para preencher o campo `ecoponto` do
   payload enviado ao Sheets.

2. **ID único por registro, para dedup confiável.**
   Em `adicionarAtendimento()`, ao montar `novoAtendimento`, adicionar um
   campo `idRegistro` gerado uma única vez na criação (`crypto.randomUUID()`,
   com fallback para `Date.now() + '-' + Math.random().toString(36).slice(2)`
   em ambientes sem `crypto.randomUUID`). Como esse objeto é o mesmo que é
   salvo no IndexedDB e reenfileirado em `filaPendente` em caso de falha, o
   `idRegistro` se mantém idêntico em todas as tentativas de reenvio do mesmo
   atendimento — permitindo dedup exato no GAS.

3. **Portar a fila de retry para `scriptpc.js`.**
   Hoje `scriptpc.js:enviarParaSheets` só faz `console.warn` no `catch` e
   descarta a tentativa — o registro continua na IndexedDB (`status:
   'Pendente'`), mas nada tenta reenviá-lo automaticamente; só chega ao Sheets
   se alguém exportar e importar o CSV manualmente depois. `script.js` já
   resolve isso com `adicionarFilaPendente`, `enviarPendentes` e
   `atualizarIndicadorPendentes` (fila em `localStorage.filaPendente`,
   reenviada no evento `online` e no carregamento da página). Portar essas
   três funções, idênticas, para `scriptpc.js`, e chamar
   `adicionarFilaPendente` no `catch` de `enviarParaSheets` (em vez de só
   logar) — homogeneizando o comportamento offline dos dois clientes antes de
   depender de dedup por `idRegistro` para cobrir reenvios.

Payload enviado ao GAS passa a ter este formato (igual nas duas variantes):

```json
{
  "idRegistro": "3f9a1c2e-...",
  "ecoponto": "PEV MORRO DAS PEDRAS",
  "placa": "ABC1234",
  "data": "2026-07-07",
  "hora": "14:30",
  "bairro": "Trindade",
  "residuos": "Podas;Entulhos",
  "horaRegistro": "14:30:12",
  "status": "Pendente"
}
```

## Parte C — Lógica do Apps Script (`Code.gs`)

Constantes:

```js
const ECOPONTOS_VALIDOS = [
  'PEV ITACORUBI', 'PEV CAPOEIRAS', 'PEV MORRO DAS PEDRAS',
  'PEV MONTE CRISTO (ARESP)', 'PEV CANASVIEIRAS', 'PEV RIO VERMELHO',
  'PEV INGLESES', 'PEV COSTEIRA', 'PEV COLONINHA'
];
const ABA_ERROS = '_Erros';
const CABECALHO = ['ID Registro', 'Ecoponto', 'Placa', 'Data', 'Hora',
                   'Bairro', 'Residuos', 'Hora Registro', 'Status Envio',
                   'Recebido Em'];
```

- **`doPost(e)`**: ponto de entrada.
  1. Adquire `LockService.getScriptLock()` (evita duas requisições simultâneas
     colidindo na checagem de duplicado + `appendRow`).
  2. `JSON.parse(e.postData.contents)`.
  3. Valida campos obrigatórios (`ecoponto`, `placa`, `data`, `hora`,
     `idRegistro`) e que `ecoponto` está em `ECOPONTOS_VALIDOS`. Se falhar,
     registra o payload bruto + motivo na aba `_Erros` e retorna.
  4. Obtém (ou cria, com cabeçalho `CABECALHO` congelado na linha 1) a aba
     correspondente ao nome do ecoponto.
  5. Verifica se `idRegistro` já existe na coluna A da aba (varredura simples
     via `getRange(...).getValues()` — volume esperado é baixo, poucas
     centenas de linhas por aba/ano, então não precisa de índice otimizado).
  6. Se não existir, `appendRow` com os campos do payload + `new Date()` como
     "Recebido Em". Se já existir, ignora silenciosamente (é um reenvio).
  7. Libera o lock; retorna `ContentService.createTextOutput('OK')` — o
     cliente ignora essa resposta, mas ela ajuda em testes manuais.
- **`doGet(e)`**: apenas retorna um texto fixo tipo `"GAS Ecopontos ativo"`,
  para permitir checagem manual da URL no navegador sem expor dados (mantém a
  decisão de "somente ingestão", sem endpoint de leitura de dados).
- Erros não previstos (`try/catch` em torno de tudo) também vão para
  `_Erros`, junto com o payload bruto recebido, para diagnóstico posterior.

## Parte D — Deploy e testes

1. Criar a planilha "Ecopontos - Atendimentos" no Google Sheets.
2. Extensions → Apps Script, colar `Code.gs`.
3. Deploy → New deployment → tipo "Web app"; "Execute as: Me"; "Who has
   access: Anyone" (necessário pois o app faz o POST sem autenticação Google,
   mesmo padrão que já existe hoje no client); copiar a URL `.../exec`.
4. Colar essa URL em `configuracao.html` ("URL do Google Sheets") em todos os
   dispositivos — mesma URL para todos os ecopontos.
5. Testar `doGet` abrindo a URL direto no navegador (espera o texto de
   status).
6. Testar `doPost` manualmente (`curl`/Postman) com um payload de exemplo:
   confirmar que a linha aparece na aba certa, e que reenviar o mesmo
   `idRegistro` não duplica a linha.
7. Testar payload com `ecoponto` fora da lista (simulando dispositivo com
   versão antiga do app, ainda enviando o código numérico) e confirmar que
   cai em `_Erros` em vez de criar uma aba estranha.
8. Ao editar `Code.gs` depois do primeiro deploy, usar "Manage deployments" →
   editar a implantação existente → nova versão (mantém a mesma URL `/exec`,
   não precisa reconfigurar os dispositivos).

## Fora de escopo (YAGNI por ora)

- Endpoint de leitura (GET com dados) para outros sistemas como
  `gestaoecoponto` — decidido explicitamente como não necessário agora.
- Autenticação alem da URL secreta do deployment — consistente com o padrão
  já usado hoje pelo app.
- Consolidação/relatórios entre abas — pode ser feito depois direto na
  planilha (fórmulas/Apps Script separado), não faz parte deste script de
  ingestão.
