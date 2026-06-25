# ADR-021 — Conformidade LGPD: Arquitetura de Dados Pessoais

- **Status**: Implementado
- **Data**: 2026-05-21
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-020 (Granular Sync + Pasta LAN), ADR-014 (Adequação Arquitetural)

---

## Contexto

A Lei Geral de Proteção de Dados (Lei 13.709/2018) impõe obrigações sobre coleta, armazenamento, tratamento e eliminação de dados pessoais. O sistema Ecoforms processa dados de usuários (nome, perfil, localização de atividades, registros de formulários) em múltiplas camadas: SQLite local, pasta LAN, Supabase Storage e canal IMAP.

Este ADR formaliza como a arquitetura atual atende aos princípios da LGPD e identifica lacunas a resolver.

---

## Mapeamento de dados pessoais por camada

| Camada | Dados pessoais presentes | Controle |
|---|---|---|
| **SQLite local (desktop)** | Usuários, registros, demandas, audit log | Dentro da organização — acesso via RBAC Rust |
| **Pasta LAN** | JSONs de entidades por domínio (usuarios, tarefas, etc.) | Dentro da rede da organização — acesso restrito ao filesystem |
| **Supabase Storage** | Imagens de usuários, inbox mobile, eventos criptografados | Cloud — AES-256-GCM; dados em texto plano mínimos |
| **Supabase PostgreSQL** | `public.profiles` (espelho de auth.users) | Cloud — apenas id, username; sem dados sensíveis operacionais |
| **IndexedDB mobile** | Usuários, tarefas, demandas (subconjunto) | No device do usuário |
| **IMAP / Webmail** | Attachments JSON em trânsito | Infraestrutura corporativa da organização |

---

## Princípios LGPD e atendimento atual

### Finalidade (art. 6º, I)
Dados coletados exclusivamente para operação do sistema (gestão de demandas, tarefas, registros de campo). Sem uso analítico externo ou compartilhamento com terceiros.

**Status: atendido.**

### Necessidade / Minimização (art. 6º, III)
- Granular sync (ADR-020) garante que cada device busca apenas as entidades que mudaram — sem dumps completos desnecessários
- Supabase Storage reduzido a imagens e canal mobile — superfície de exposição mínima no cloud
- `db_query` bloqueia `SELECT` com `password_hash` — dado sensível nunca exposto via query genérica

**Status: atendido em grande parte. Lacuna: definir política de retenção (ver abaixo).**

### Segurança (art. 6º, VII e art. 46)
- **Em repouso**: SQLite local protegido pelo sistema operacional + RBAC Rust
- **Em trânsito (Storage)**: AES-256-GCM via Rust; chave derivada via PBKDF2 (100k iterações, SHA-256), nunca persistida, cleared no logout
- **Acesso**: commands Rust protegidos validam `user_id` + `perfil` em `SessionState` antes de qualquer operação sensível
- **Audit**: `tbl_audit_log` registra actor, ação, tabela, id alvo, valores before/after

**Status: atendido.**

### Responsabilização e prestação de contas (art. 6º, X e art. 50)
- `tbl_audit_log` com cadeia de custódia local
- `EventEnvelope` com `device_id`, `correlation_id`, `causation_id` — rastreabilidade de eventos no pipeline de sync
- Canal IMAP usa infraestrutura corporativa com auditoria nativa de email

**Status: atendido para rastreabilidade técnica. Lacuna: documentação de processos para o encarregado (DPO).**

### Localização dos dados (princípio de soberania)
- Dados operacionais primários na pasta LAN = dentro das instalações da organização
- Cloud (Supabase) restrito a dados não sensíveis em texto plano ou dados criptografados
- IMAP usa servidor de email da própria organização

**Status: atendido pela arquitetura LAN-first do ADR-020.**

---

## Lacunas a resolver

### 1. Política de retenção

Não há prazo definido para dados em:
- `sync_event_queue` — eventos acumulam indefinidamente no SQLite
- Pasta LAN — arquivos `{uuidv7}.json` nunca são removidos automaticamente
- `tbl_audit_log` — log cresce sem truncagem

**Decisão necessária:** definir TTL por camada (ex: eventos processados → 90 dias; audit log → 2 anos; pasta LAN → 1 ano após encerramento da entidade).

**Implementação:** job de limpeza periódico no boot do desktop via `ensure-columns.ts` ou cron Tauri.

### 2. Direito de eliminação do titular (art. 18, VI)

Atualmente não existe procedimento para apagar um usuário de todas as camadas. O fluxo necessário:

```
1. Admin solicita eliminação do titular (user_id)
2. SQLite local: anonimizar/deletar registros vinculados ao user_id
3. Pasta LAN: remover/anonimizar {uuidv7}.json das entidades do usuário
4. Supabase Storage: deletar imagens em users/{userId}/images/
5. Supabase Auth: invocar supabase_admin_query para deletar auth.users
6. public.profiles: deletar registro
7. IndexedDB mobile: limpeza no próximo sync (event handler de eliminação)
8. tbl_audit_log: registrar a eliminação (manter o log da ação, não os dados)
```

**Implementação necessária:** `EliminacaoTitularUseCase` + command Rust protegido (requer `perfil=admin`).

### 3. Direito de portabilidade (art. 18, V)

Não existe exportação estruturada dos dados de um titular. Necessário:
- Endpoint/comando admin que agrega todos os dados vinculados a um `user_id`
- Exportação em formato legível (JSON ou CSV)

**Implementação necessária:** `ExportacaoDadosTitularUseCase`.

### 4. Registro de tratamento (art. 37)

O controlador deve manter registro das operações de tratamento. Necessário documento (fora do código) descrevendo:
- Quais dados são coletados, por quê, por quanto tempo
- Quem tem acesso (perfis RBAC)
- Suboperadores (Supabase como processador)

**Responsável:** Marcelo Luiz (controlador). Documento a ser elaborado separadamente.

---

## Decisões arquiteturais que emergem deste ADR

| Decisão | Impacto |
|---|---|
| Adicionar TTL por camada na política de retenção | `ensure-columns.ts` + job de limpeza no boot |
| Implementar `EliminacaoTitularUseCase` | Novo command Rust protegido + use case no domínio `usuario/` |
| Implementar `ExportacaoDadosTitularUseCase` | Novo use case + rota admin |
| Formalizar DPO interno | Organizacional — fora do escopo do código |

---

## O que NÃO precisa mudar

A arquitetura atual já atende estruturalmente à LGPD nos pontos críticos:
- Dados pessoais não saem das instalações desnecessariamente (LAN-first)
- Criptografia em trânsito para o cloud (AES-256-GCM)
- RBAC com enforcement em Rust — acesso baseado em necessidade
- Audit log local com cadeia de custódia
- Sem analytics externo ou compartilhamento de dados com terceiros
