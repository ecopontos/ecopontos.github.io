# Revisao tecnica — ADR-064 Sincronizacao Consolidada

**Documento original:** [ADR-064 — Event Sourcing + REST Mesh LAN](./ADR-064-event-sourcing-rest-mesh-sync.md)
**Data:** 2026-06-18
**Status **Decidido**

> **Incorporação (2026-06-18):** os bloqueadores B1-B5 e os achados técnicos #1-#5 abaixo foram **incorporados ao próprio ADR-064** (seções "Bloqueadores de aceitação (B1-B5)" e "Achados pré-implementação (#1-#5)"). Este documento permanece como **registro da revisão original**; a fonte canônica dos bloqueadores passou a ser o ADR-064. As exigências ("Exigir no ADR") abaixo são endereçadas lá como "Contrato a adicionar neste ADR".

## Parecer executivo

O ADR-064 e a sintese mais adequada as restricoes do que qualquer um dos dois ADRs de origem isolado. A decisao de **separar eixos** (modelo de dados do rascunho ADR-001 + transporte do ADR-063 + blobs por meio-termo) e tecnicamente correta e justificada pelos dois requisitos confirmados:

- auditoria/historico imutavel obrigatorio → event sourcing pleno (nao mais opcional);
- blobs muitos/grandes → distribuicao multi-source, mas sem o peso de IPFS/WebTorrent em LAN fechada.

O risco mudou de **"escolha de arquitetura"** para **"execucao da migracao"**. A escolha esta certa; o perigo agora e a Fase 0 e quatro pontos de desenho que, se ignorados, corrompem dado ou auditoria silenciosamente.

**Recomendacao:** manter como **Proposto**. Promover a **Aceito** apos resolver B1-B5 abaixo.

## Bloqueadores de desenho

### B1. Retencao do log vs. capacidade do mobile

Auditoria imutavel (requisito 8) exige reter **todos** os eventos para sempre. Mobile nao pode guardar log ilimitado. O ADR resolve por divisao de papeis (ancora = arquivo completo; mobile = projecoes + cauda), mas nao fecha o contrato:

- ate onde o mobile trunca a cauda sem perder capacidade de operar offline?
- o que acontece se o **unico** ancora com o log completo falhar de forma permanente (disco morto)? A auditoria mora em um unico ponto fisico — isso e um SPOF de auditoria.
- ha replicacao do log completo entre multiplos desktops, ou o ancora e singular?

**Exigir no ADR:** politica de truncamento do mobile; >=2 desktops mantendo log completo (replica de auditoria); backup/exportacao do event store.

### B2. Determinismo de projecoes nao e garantido por construcao

Replay so reconstroi projecao identica se os handlers forem **puros e deterministicos**. Risco real:

- handler que usa `Date.now()`, `Math.random()`, `uuidv7()` ou ordem de iteracao nao-estavel produz projecao divergente entre peers;
- mudanca de versao de handler altera a projecao derivada do mesmo log → dois peers em versoes diferentes divergem.

**Exigir no ADR:** contrato de pureza dos handlers (sem efeito nao-deterministico no replay); versionamento de handler/projecao; teste que replaya o mesmo log em dois ambientes e exige projecao identica.

### B3. Assinatura de evento amarra auditoria a identidade de dispositivo

O ADR exige assinatura por evento (correto — sem ela o token compartilhado permite forjar historico). Mas isso reabre o gap herdado do REV-063 (B2/B3): **de onde vem a chave de assinatura por device e como os outros confiam nela?**

- token compartilhado por org autentica a org, nao o dispositivo;
- se a chave de assinatura nao for por device com bootstrap de confianca, a assinatura nao prova autoria — vira so checksum.

**Exigir no ADR:** chave de assinatura por `device_id`, distribuicao/registro da chave publica no bootstrap (mesmo canal do fingerprint TLS), comportamento ao ver evento assinado por device desconhecido ou revogado.

### B4. Camada de blobs content-addressed e nova e subespecificada

Nao ha codigo reaproveitavel. Para nao virar fonte de inconsistencia, precisa de contrato:

- formato do indice de disponibilidade (quem tem qual hash) e como sincroniza;
- tamanho de chunk e protocolo de *range* multi-source;
- comportamento quando nenhum holder online tem o blob referenciado por um evento ja aplicado (evento aplicado, anexo indisponivel — estado parcial valido?);
- GC de blob orfao sem corrida com evento que ainda vai referencia-lo;
- limite de tamanho e verificacao de hash na recepcao.

**Exigir no ADR:** secao "Contrato de blobs" com indice, chunking, estado parcial e GC.

### B5. Fase 0 e um rewrite do write path com periodo de escrita dupla

Inverter "tabela e a verdade" para "evento e a verdade" toca todo handler de mutacao. Durante a transicao, ha risco de **escrita dupla divergente** (evento gravado mas projecao falha, ou vice-versa).

**Exigir no ADR:** estrategia de escrita atomica evento+projecao (mesma transacao SQLite) ou reconstrucao de projecao on-read; plano de rollback por dominio; ordem de migracao dominio-a-dominio (nao big-bang).

## Achados tecnicos

### 1. "F0 imediatamente" subestima o custo

A Fase 0 e a mais arriscada de todo o roteiro, nao a mais simples. Tratar como "preparacao imediata" cria falsa sensacao de baixo custo. **Recomendacao:** marcar F0 como marco com criterio de saida (todos os dominios gravando evento primeiro + projecao deterministica testada) antes de iniciar F2.

### 2. Topico (`topic_id`) entra sem definicao de fronteira

`topic_id` aparece como coluna obrigatoria, mas o ADR nao define o que e um topico (departamento? entidade? org?). Isso afeta roteamento, particao de log e escopo do admin peer. **Recomendacao:** definir a granularidade de topico explicitamente.

### 3. `author_seq` precisa de semantica de continuidade

Sequencia por autor so detecta lacuna (evento perdido) se for monotonica e sem buraco por device. **Recomendacao:** especificar que o pull detecta gap por `author_seq` e re-puxa o intervalo faltante; definir comportamento em reset de device.

### 4. HLC precisa de regras de persistencia e regressao de relogio

HLC depende de persistir o ultimo timestamp logico e tratar regressao do relogio fisico (NTP corrige para tras, fuso, troca de bateria). **Recomendacao:** documentar persistencia do contador logico e a regra de regressao (nunca emitir HLC menor que o ultimo observado).

### 5. Gatilho de escalada de blobs precisa de numero

"Migrar para swarm se `peers x tamanho x concorrencia` quebrar o HTTP multi-source" e correto, mas sem limiar e inacionavel. **Recomendacao:** definir um numero de gatilho (ex.: throughput por holder, ou N peers puxando blob > X MB simultaneamente) para a decisao nao ficar subjetiva.

## Checklist antes de implementacao

### Bloqueia Aceito (decidir no proprio ADR)

- **B1** — retencao do log, replica de auditoria (>=2 desktops), backup do event store;
- **B2** — contrato de pureza/determinismo + versionamento de projecoes;
- **B3** — chave de assinatura por device + bootstrap de confianca;
- **B4** — contrato da camada de blobs (indice, chunking, estado parcial, GC);
- **B5** — estrategia de escrita atomica evento+projecao + migracao dominio-a-dominio.

### Bloqueia F0/F2 (contratos antes de codificar)

- **#1** — criterio de saida da F0;
- **#2** — granularidade de `topic_id`;
- **#3** — deteccao de gap por `author_seq`;
- **#4** — persistencia HLC + regra de regressao de relogio;
- **#5** — limiar numerico do gatilho de escalada de blobs.

## Recomendacao de status

Manter como **Proposto**. A escolha de arquitetura esta **resolvida e correta** — este ADR supera os dois de origem. O que falta e contrato de execucao: B1-B5 no proprio ADR antes do Aceito; achados 1-5 como criterio antes de iniciar F0/F2.

## Conclusao

O ADR-064 acerta na decisao estrategica: event sourcing pelo requisito de auditoria, REST mesh pela simplicidade em LAN isolada, blobs multi-source sem DHT pelo peer-set ja conhecido. libp2p/IPFS ficam corretamente como reserva.

O risco migrou de arquitetura para execucao. Os pontos mais perigosos — todos de falha silenciosa — sao **determinismo de projecao** (B2), **autoria de evento** (B3) e **escrita dupla na Fase 0** (B5). Resolver esses tres no papel custa pouco agora e evita corrupcao de dado e de auditoria depois que houver log em producao.
