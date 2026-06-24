# ADR-020 — Granular Sync com ID Indexador + Pasta LAN Configurável

- **Status**: Implementado
- **Data**: 2026-05-21
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-014 (Adequação Arquitetural)

---

## Contexto

### Relay atual

O sync entre desktop e mobile usa arquivos JSON monolíticos no Supabase Storage:

```
shared/tasks.json
shared/users.json
shared/form_field_registry.json
shared/data_registry.json
shared/ecoponto_caixas.json
```

Cada ciclo baixa o arquivo completo independente de quantas entidades mudaram.

### Restrições estruturais

| Restrição | Impacto |
|---|---|
| Desktop é offline-first (SQLite local) | Sem coordenador central de estado — relay deve ser passivo |
| Mobile usa anon key | Supabase Realtime inviável como canal primário |
| Criptografia AES-256-GCM ocorre no Rust | Dados operacionais não podem residir em tabelas PostgreSQL visíveis |
| TI muda caminhos de rede sem aviso | Path de rede não pode ser hardcoded — deve ser admin-configurável |

A última restrição vem de incidentes anteriores: alterações sutis na topologia da rede local pela equipe de TI quebraram a sincronização porque o caminho estava fixo no código.

---

## Decisão

### 1. Separação de responsabilidades do relay

| Canal | Responsável por | Quem acessa |
|---|---|---|
| **Pasta LAN** | Dados operacionais (JSONs por domínio) | Desktop apenas |
| **Supabase Storage** | Imagens, arquivos pesados, inbox mobile | Desktop + Mobile |

O Supabase Storage deixa de ser o relay primário de dados operacionais para o desktop. O mobile continua usando o Storage sem mudança.

### 2. Path configurável pelo admin

O caminho da pasta LAN é definido em campo de configuração na interface do desktop — não em variável de ambiente, não hardcoded.

**Armazenamento**: nova tabela `tbl_configuracoes_sistema` no SQLite local:

```sql
CREATE TABLE IF NOT EXISTS tbl_configuracoes_sistema (
    chave   TEXT PRIMARY KEY,
    valor   TEXT NOT NULL,
    descricao TEXT,
    atualizado_em TEXT NOT NULL
);
```

Chave relevante: `lan_sync_path` — valor é o caminho absoluto da pasta (ex: `\\servidor\ecoforms\sync` ou `/mnt/rede/ecoforms/sync`).

O `LanFileStorage` lê essa chave via `invoke('db_query')` a cada operação — não cacheia o path — para refletir mudanças de configuração sem reiniciar o app.

### 3. Granularidade por entidade (Manifest + Granular Pull)

**Todos os UUIDs do sistema são v7** — time-ordered, lexicograficamente ordenados por tempo de criação. Isso tem implicações diretas no design do índice:

- Arquivos `{uuidv7}.json` na pasta são naturalmente ordenados cronologicamente por nome
- O UUID em si é o `created_at` — não precisa ser armazenado separadamente no índice
- Um device pode detectar entidades novas (nunca vistas) apenas comparando UUIDs: qualquer UUID maior que o maior UUID local conhecido é garantidamente novo
- `v` (version) + `hash` ainda são necessários para detectar **atualizações** — o UUIDv7 codifica criação, não modificação

Dentro da pasta LAN, os JSONs seguem a estrutura:

```
{lan_sync_path}/
  tarefas/
    index.json
    {uuidv7}.json
  usuarios/
    index.json
    {uuidv7}.json
  form_field_registry/
    index.json
    {uuidv7}.json
  data_registry/
    index.json
    {uuidv7}.json
  ecoponto_caixas/
    index.json
    {uuidv7}.json
```

**`index.json` por domínio:**

```json
{
  "last_entity_uuid": "01960000-0000-7000-aaa1-...",
  "entities": {
    "01960000-0000-7000-aaa1-...": { "v": 3, "hash": "sha256-abc...", "last_event_id": "01960001-0000-7000-ccc3-..." },
    "01950000-0000-7000-bbb2-...": { "v": 1, "hash": "sha256-def...", "last_event_id": "01950001-0000-7000-ddd4-..." }
  }
}
```

Campos:
- **chave** — UUIDv7 da entidade (carrega o tempo de criação, lexicograficamente ordenável)
- **`v`** — contador de versão local, incrementado a cada escrita
- **`hash`** — SHA-256 do conteúdo — detecta se a entidade foi modificada
- **`last_event_id`** — UUIDv7 do último `EventEnvelope` que tocou a entidade — determina o vencedor do LWW por comparação de string simples (maior UUID = mais recente)
- **`last_entity_uuid`** — maior chave de entidade presente no índice — cursor de fila para detectar entidades novas sem iterar todas as chaves

> `updated_at` não existe no índice — o timestamp está embutido nos UUIDs. O campo `time` do `EventEnvelope` serve apenas para debugging/log.

### 4. Enfileiramento e LWW via UUIDv7

**Todos os UUIDs do sistema são v7** — time-ordered, monotônicos dentro de um device, lexicograficamente comparáveis entre devices.

**Fila natural:** ordenar entidades ou eventos por UUID = ordenar por tempo de criação. `last_entity_uuid` funciona como cursor da fila — tudo acima dele é novo.

**LWW trivial:** ao receber uma entidade remota, comparar `last_event_id` remoto vs local. Maior UUIDv7 vence — sem parsing de timestamp, sem ambiguidade de timezone. O `ConflictResolver` em `ecoforms-core` (atualmente LWW+hash) pode usar diretamente essa comparação de string.

```
conflito detectado: hash remoto ≠ hash local
resolução: if (remote.last_event_id > local.last_event_id) → apply remote
```

### 5. Fluxo de pull (InboundService — desktop)

```
1. Ler lan_sync_path de tbl_configuracoes_sistema
2. GET {path}/{dominio}/index.json
3. Diff em dois passos:
   a. Entidades novas: chaves no index > last_entity_uuid local → fetch direto, sem comparar hash
   b. Entidades atualizadas: chaves conhecidas com hash diferente → fetch seletivo
4. Para cada entidade divergente: GET {path}/{dominio}/{uuidv7}.json
5. LWW: aplicar somente se last_event_id remoto > last_event_id local
6. Atualizar last_entity_uuid local
```

### 6. Fluxo de push (TransportService — desktop)

```
1. Escrita local no SQLite
2. Gerar EventEnvelope com id = uuidv7()  ← já implementado em createEnvelope()
3. PUT {path}/{dominio}/{entity_uuidv7}.json  ← entidade atualizada
4. Read-modify-write em {path}/{dominio}/index.json
   → atualiza somente a chave da entidade alterada (v++, hash recalculado, last_event_id = envelope.id)
   → preserva demais entidades no índice
```

### 7. Resolução de conflito no index.json

O `index.json` é o único ponto de contenção (múltiplos desktops na LAN podem escrever simultaneamente). Estratégia: **LWW por entidade via `last_event_id`** — cada device atualiza somente as chaves que ele próprio alterou, preservando as demais. Conflito no índice é benigno: pior caso é `last_event_id` ligeiramente desatualizado para outra entidade, corrigido no próximo ciclo.

### 7. Sync por intenção (complementar ao polling)

O pull do `index.json` é disparado por eventos de app além do intervalo fixo:

| Trigger | Domínio |
|---|---|
| Login | todos (pull inicial completo) |
| Usuário abre módulo de tarefas | `tarefas` |
| Usuário abre gestão de usuários | `usuarios` |
| App retorna ao foreground | domínios de alta frequência |
| Após escrita local crítica | domínio afetado |

---

## Pontos de toque no código

| Arquivo / Localização | Mudança |
|---|---|
| `scripts/ensure-columns.ts` | Adicionar `tbl_configuracoes_sistema` + seed `lan_sync_path` vazio |
| `docs/db/schema_consolidado_corrigido.sql` | Idem (espelho documental) |
| `src/infrastructure/config/device-config.ts` | Sem mudança — DeviceConfig permanece por device |
| `src/infrastructure/storage/LanFileStorage.ts` | **Novo** — adapter que lê path de SQLite, opera sobre filesystem via `invoke` Rust |
| `src-tauri/src/` | **Novo command** `lan_read_file` / `lan_write_file` — acesso ao filesystem com path dinâmico |
| `src/infrastructure/sync/InboundService.ts` | Trocar pull de Storage por pull de LanFileStorage para domínios operacionais |
| `src/infrastructure/sync/TransportService.ts` | Trocar push de Storage por push de LanFileStorage para domínios operacionais |
| `app/configuracoes/` (ou equivalente) | Campo admin para `lan_sync_path` com validação de acesso |
| `mobile/www/js/sync/` | **Sem mudança** — mobile continua usando Supabase Storage |

---

## Domínios migrados para LAN

| JSON atual (Storage) | Path LAN novo | Mobile |
|---|---|---|
| `shared/tasks.json` | `tarefas/` | Pull via Storage (sem mudança) |
| `shared/users.json` | `usuarios/` | Pull via Storage (sem mudança) |
| `shared/form_field_registry.json` | `form_field_registry/` | Pull via Storage (sem mudança) |
| `shared/data_registry.json` | `data_registry/` | Pull via Storage (sem mudança) |
| `shared/ecoponto_caixas.json` | `ecoponto_caixas/` | Pull via Storage (sem mudança) |
| `users/{userId}/images/` | **Permanece no Storage** | — |
| `shared/inbox/users/{userId}/` | **Permanece no Storage** | — |

---

## Consequências

### Positivas
- Payloads proporcionais ao que mudou — não ao tamanho total do domínio
- Latência de sync menor na LAN vs round-trip para Supabase (cloud)
- Path configurável protege contra mudanças de rede pela TI sem redeployment
- Mobile não é afetado — zero risco de regressão no canal mobile
- Supabase Storage simplificado: só imagens e dados mobile

### Negativas / Riscos

| Risco | Mitigação |
|---|---|
| Pasta LAN inacessível (TI move o share) | Campo de config na UI + mensagem de erro clara + fallback gracioso (modo leitura local) |
| Concorrência de escrita no index.json entre desktops | LWW por entidade — conflito benigno |
| Acesso ao filesystem via Rust requer commands Tauri adicionais | Isolar em `lan_read_file` / `lan_write_file` com validação de path |
| Mobile perde acesso a dados que migraram para LAN | Mobile nunca acessa LAN — esses dados permanecem espelhados no Storage para mobile |

### Sobre o espelhamento para mobile

Os dados que migram para a LAN ainda precisam chegar ao mobile. Duas estratégias possíveis (a decidir em ADR subsequente):

- **A) Desktop espelha para Storage após escrita na LAN** — TransportService escreve em ambos
- **B) Mobile consome eventos do event log** — InboundService mobile processa `evt_{seq}_{id}.enc` existentes

---

## Hierarquia de canais de sync (resiliência)

O sistema possui três canais em cascata, do mais rápido ao mais resiliente:

```
1. Pasta LAN          ← primário — baixa latência, acesso direto ao filesystem
2. Supabase Storage   ← secundário — fora da rede local, requer internet
3. IMAP / Webmail     ← fallback final — passa qualquer firewall corporativo
```

O canal IMAP foi originalmente desenhado como último recurso e possui propriedades relevantes: IMAP IDLE (notificação push sem polling), inbox como fila garantida pelo servidor, autenticação via credenciais corporativas existentes e rastreabilidade nativa. A tabela `tbl_email_config` no schema reflete esse design prévio.

**Limitação atual:** o módulo IMAP está implementado de forma fechada — não está integrado ao pipeline de sync principal. A integração em cascata automática (LAN falha → Storage → IMAP) fica como trabalho futuro. Por ora, o fallback para IMAP é manual.

---

## Alternativas consideradas

| Alternativa | Descartada por |
|---|---|
| Supabase Realtime como canal de estado | Mobile usa anon key; offline inviabiliza; dados criptografados não podem residir em PostgreSQL visível |
| Manter Storage como relay principal | Latência cloud; payloads monolíticos; sem granularidade por entidade |
| Path hardcoded na LAN | Experiência anterior: TI alterou a rede sem aviso e quebrou o sync |
| Variável de ambiente para path | Requer redeployment para mudança; admin não consegue alterar sem acesso técnico |
| IMAP como canal primário | Latência de email servers; limites de attachment; módulo atualmente isolado — reavaliar quando integração em cascata for implementada |
