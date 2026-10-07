# Volumosos — MVP de agendamento (PWA)

App standalone, **sem login e sem build**, para a equipe registrar agendamentos de
coleta de resíduos volumosos e gerar o checklist do motorista. Nasce do módulo
de agendamentos do EcoForms (`desktop/src/domain/service/`, ADR-015/018/019), mas
**não depende dele**: só a ideia de UI e o formulário `form-agendamento-volumosos`
foram portados.

## Fluxo

1. **Regiões** — cada região tem seus bairros e a regra de abertura das inscrições:
   - *Uma semana antes*: abre na segunda-feira da semana anterior à semana da coleta;
   - *N dias antes*: abre N dias antes da data da coleta (ex.: 3).

   Em ambos os casos as inscrições **encerram na véspera** da coleta. Um bairro só
   pode pertencer a uma região.
2. **Coletas** — programação por região: período + dia(s) da semana + repetição
   (semanal, quinzenal…), com limite opcional de agendamentos por coleta. Cada
   coleta mostra a janela de inscrição e a situação (aguardando, aberta, lotada,
   encerrada, cancelada).
3. **Agendar** — só aparecem as coletas com inscrições abertas hoje. Os campos seguem
   a página do serviço da SMMA (nome completo, CPF, telefone, e-mail opcional,
   endereço com CEP, descrição dos resíduos e quantidades — `js/form-volumosos.js`):
   - CPF com dígito verificador; CEP consulta o ViaCEP e preenche rua/bairro;
   - tipos de resíduo da lista oficial (podas ficam de fora);
   - **até 1 m³ por residência** e um agendamento por CPF e por residência
     (CEP + endereço) em cada coleta;
   - imagens opcionais (até 5), escolhidas da galeria — chegam pelo WhatsApp.
4. **Checklist** — pontos ordenados por bairro e endereço; enviar ao motorista
   (compartilhar/WhatsApp), imprimir, copiar texto, marcar coletado / não coletado.
   Em cada ponto, **Confirmar ao cidadão** abre o WhatsApp do solicitante com a data,
   o endereço, o protocolo e as orientações (resíduos na rua só na data agendada etc.).

## Onde ficam os dados

Tudo no IndexedDB **do aparelho** — não há sincronização entre aparelhos no MVP.
Use *Ajustes → Backup* para exportar/importar (o JSON inclui as fotos).

### Dados de exemplo

*Ajustes → Dados de exemplo* cria de uma vez 2 regiões fictícias (Continente e
Centro), 4 coletas cobrindo todas as situações (encerrada, aberta, lotada,
aguardando abertura), 6 agendamentos (incluindo pontos coletado / não coletado)
e fotos sintéticas ("FOTO DE EXEMPLO" desenhadas no aparelho). Útil para
demonstrar o app ou testar o checklist sem dados reais. Todos os registros vão
marcados com `exemplo: true` — o botão *Remover dados de exemplo* apaga só eles.
O seed fica em `js/dados-exemplo.js` (puro, com testes em
`tests/dados-exemplo.test.js`).

### Fotos no Google Drive (opcional)

*Ajustes → Google Drive* aceita a URL do Web App do EcoForms
(`google-workspace/apps-script/Code.gs`) e uma **credencial por dispositivo**
(`deviceId.segredo`). No checklist, *Fotos ao Drive* envia as fotos pendentes para
`volumosos/{data-da-coleta}/{agendamentoId}/{fotoId}.jpg` via ação `uploadFile`.

A credencial deve ter só o necessário: `actions: ["health", "uploadFile"]` e
`filePrefixes: ["volumosos/"]`. Ela fica salva no navegador; revogue no registro
`DEVICE_CREDENTIALS` se o aparelho for perdido.

## Desenvolvimento

```bash
npm run serve   # http://localhost:5600 (service worker exige localhost ou HTTPS)
npm test        # regras de janela/programação/validação (node:test, sem dependências)
```

- `js/regras.js` — regras puras (janela de inscrição, programação, validação, checklist). É a parte candidata a ir para `packages/core/scheduling` quando o app principal for unificado.
- `js/app.js` — telas (roteamento por hash), `js/db.js` — IndexedDB, `js/drive.js` — Apps Script.
- Ao alterar arquivos do app, incremente `VERSAO` em `sw.js` para os aparelhos instalados receberem a atualização.

### Publicação

Publicado em **https://ecopontos.github.io/volumosos/** — pasta `volumosos/` do repositório
`ecopontos/ecopontos.github.io` (hub, GitHub Pages direto do `main`), no mesmo nível de
`/ecoponto` e `/revista`. **Esta pasta é a fonte**: para atualizar o site, copie só os arquivos
do app (`index.html styles.css manifest.webmanifest icon.svg sw.js js/`) para lá, com `VERSAO`
do `sw.js` incrementada.

No hub, outros service workers (raiz, `/ecoponto`) apagam caches que não são deles; por isso o
`sw.js` deste app regrava no cache tudo que busca na rede e se recompõe na primeira abertura
online. Os dados (IndexedDB `volumosos-pwa`) não são afetados.

## Fora do MVP (próximos passos)

- Sincronização entre aparelhos e com o desktop (evento `agendamento.*` no GAS).
- Reserva com limite decidida no servidor (hoje o limite só vale dentro de um aparelho).
- UI pública para o cidadão via Apps Script, reaproveitando `regras.js`.
