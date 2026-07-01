# ADR-063 — Fronteira entre backend local e backends externos

**Status:** Proposto  
**Data:** 2026-06-30  
**Autor:** Marcelo Luiz  
**Contexto externo:** Consolida a arquitetura offline-first após hardening Tauri/Rust, POC PocketBase e revisão de responsabilidades.

---

## Contexto

O EcoForms Desktop deixou de ser apenas uma UI com SQLite. O app possui hoje uma camada local com responsabilidades típicas de backend:

- comandos Rust/Tauri;
- SQLite local;
- sessão/autorização sensível;
- criptografia local;
- filesystem confinado;
- export/import;
- LAN server;
- sync local;
- integração com serviços externos.

Ao mesmo tempo, o projeto também depende ou avalia backends externos:

- Supabase Storage/Auth/Admin;
- PostgreSQL legado para importações;
- PocketBase como hub LAN opcional;
- APIs públicas como ViaCEP/Nominatim.

Isso cria uma ambiguidade arquitetural: o app parece ter um backend local embutido e também uma camada de backend externo. Sem fronteira explícita, há risco de a UI acessar detalhes de integração diretamente, duplicar responsabilidades, expor credenciais ou transformar PocketBase/Supabase em substitutos acidentais do SQLite local.

---

## Problema

Sem uma decisão formal:

- O CRUD local pode começar a competir com APIs externas.
- A UI pode voltar a conhecer credenciais, SQL sensível, paths ou detalhes de sync.
- PocketBase pode ser interpretado como backend principal, enfraquecendo a operação offline.
- Supabase/PostgreSQL/PocketBase podem virar dependências síncronas de fluxos que deveriam funcionar offline.
- Regras de segurança podem se dividir entre frontend, Rust e serviços externos sem autoridade clara.
- A Clean Architecture fica difícil de avaliar, porque `infrastructure` passa a conter tanto backend local quanto adaptadores externos sem fronteira semântica.

---

## Decisão

O EcoForms Desktop adota a seguinte separação:

> O backend local embutido é a autoridade operacional offline. Backends externos são integrações, hubs, distribuição ou sincronização.

### Backend local embutido

É composto por:

- SQLite local;
- comandos Rust/Tauri;
- sessão e autorização sensível em Rust;
- criptografia local;
- filesystem confinado;
- LAN server local;
- repositórios SQLite;
- outbox/sync local;
- validações necessárias para operar sem rede.

Responsabilidade:

- garantir CRUD operacional;
- preservar operação offline;
- proteger credenciais e filesystem;
- controlar sessão/autorização sensível;
- manter consistência local;
- registrar eventos/outbox para sync.

### Backends externos e hubs

Incluem:

- Supabase;
- PostgreSQL legado;
- PocketBase;
- APIs públicas;
- outros serviços HTTP futuros.

Responsabilidade:

- sincronizar;
- importar/exportar;
- publicar snapshots;
- atuar como hub LAN;
- autenticar integrações externas quando necessário;
- disponibilizar dados para outros dispositivos.

Eles não devem ser a autoridade imediata do CRUD local.

---

## Regras de dependência

### UI

A UI deve chamar:

- use cases;
- hooks de aplicação;
- comandos Rust seguros;
- ports explícitos.

A UI não deve:

- conhecer senha/credencial externa;
- montar SQL sensível;
- acessar filesystem arbitrário;
- decidir topologia de sync;
- chamar diretamente SDK externo para fluxos sensíveis;
- depender de PocketBase/Supabase para concluir CRUD local.

### Application

A camada `application` deve depender de:

- domínio;
- ports;
- DTOs;
- serviços puros.

A camada `application` não deve importar `infrastructure`.

### Infrastructure

A camada `infrastructure` pode conter:

- adapters SQLite;
- adapters PocketBase/Supabase/PostgreSQL;
- clients HTTP;
- sync services;
- storage adapters;
- integração Tauri.

Mas cada adapter externo deve implementar uma porta explícita e não vazar detalhes para a UI.

### Rust/Tauri

Rust é parte do backend local, não apenas ponte técnica.

Deve concentrar:

- sessão sensível;
- guards de SQL;
- operações de filesystem;
- criptografia backend;
- credenciais externas;
- operações que exigem isolamento do WebView.

---

## Offline-first

Fluxos de CRUD devem seguir a ordem:

1. Validar regra local.
2. Persistir no SQLite local.
3. Registrar evento/outbox quando aplicável.
4. Tentar replicação externa de forma assíncrona ou best-effort.

Falha externa não deve invalidar a operação local já aceita, salvo quando o fluxo for explicitamente uma integração externa.

Exemplos:

- Criar agendamento: SQLite primeiro; sync depois.
- Salvar tipo de resíduo: SQLite primeiro; PocketBase best-effort quando configurado.
- Importar PostgreSQL legado: depende da integração externa, mas grava resultado local.
- Export mobile: backend local gera e confina arquivo.

---

## PocketBase

PocketBase deve ser tratado como hub externo/LAN opcional.

Ele pode:

- receber replicação;
- servir outras máquinas;
- apoiar descoberta e distribuição;
- expor API HTTP para sincronização.

Ele não deve:

- substituir o SQLite local como fonte operacional imediata;
- ser chamado diretamente pela UI para CRUD principal;
- exigir disponibilidade para o app operar.

Essa decisão complementa o ADR-062.

---

## Supabase

Supabase permanece como backend externo para:

- Storage;
- Auth/Admin quando necessário;
- snapshots;
- sincronização remota.

Credenciais e operações administrativas devem ficar no backend local/Rust ou em adapters protegidos, nunca no bundle frontend.

---

## PostgreSQL legado

PostgreSQL legado é fonte externa de importação/sincronização.

Regras:

- credenciais ficam fora do WebView;
- sync é comandado pelo backend local;
- dados importados são convertidos para schema local;
- IDs novos persistidos localmente seguem UUID v7.

---

## Consequências

### Positivas

- Responsabilidade clara entre operação local e integração externa.
- Mantém offline-first como princípio central.
- Reduz risco de vazamento de credenciais no frontend.
- Facilita testar adapters externos isoladamente.
- Evita que PocketBase/Supabase virem dependências síncronas do CRUD.

### Negativas

- Exige mais ports/adapters explícitos.
- Pode parecer mais verboso que chamar SDK/API direto na UI.
- Algumas integrações antigas precisarão ser reclassificadas e movidas.
- Requer disciplina em novos módulos para não furar a fronteira.

---

## Diretrizes para novos módulos

Ao criar um módulo novo, responder:

1. Qual é a fonte operacional local?
2. Qual tabela SQLite local representa o estado?
3. Quais eventos/outbox são emitidos?
4. Existe integração externa? Ela é importação, exportação, hub ou sync?
5. O fluxo precisa funcionar offline?
6. Quais comandos Rust são necessários para segurança?
7. A UI conhece apenas ports/use cases ou está chamando infraestrutura direta?

Se a resposta exigir disponibilidade externa para CRUD local, o desenho deve ser revisto.

---

## Relação com ADRs anteriores

- ADR-058: reforça orquestração direta e substituição de bridges excessivos por `SyncOutbox`.
- ADR-061: first-run LAN continua configuração local, não autoridade externa.
- ADR-062: PocketBase é hub local iniciado pelo Windows, não backend principal do app.

---

## Estado atual

O código já segue parte dessa decisão:

- SQLite local é usado pelos repositórios principais.
- Sessão sensível e guards de SQL ficam em Rust.
- Credenciais PostgreSQL foram removidas do bundle frontend.
- Filesystem amplo foi substituído por comandos Rust confinados.
- POC PocketBase usa repositório híbrido SQLite primeiro, PocketBase best-effort.

Ainda precisa de revisão contínua:

- consolidar nomenclatura SQL lusófona;
- reduzir adapters chamados diretamente pela UI;
- classificar integrações externas legadas;
- transformar achados das auditorias em plano de fases;
- validar manualmente fluxos desktop empacotados e LAN real.

Esses pontos foram convertidos em plano operacional em desktop/docs/PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md.

---

## Critério de aceite arquitetural

Um fluxo está alinhado com este ADR quando:

- funciona localmente sem rede quando sua natureza permite;
- persiste primeiro no SQLite local;
- chama serviços externos por adapter/port explícito;
- não expõe credenciais ao frontend;
- não depende de PocketBase/Supabase/PostgreSQL para concluir CRUD local;
- tem fallback ou erro claro quando a função é explicitamente uma integração externa.
