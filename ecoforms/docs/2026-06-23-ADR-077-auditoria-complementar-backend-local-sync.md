# ADR-077 — Auditoria Complementar do Backend Local e Sync SQLite

**Status:** Decidido
**Data:** 2026-06-23
**Relacionado:** ADR-076 (auditoria backend local), ADR-075 (sync P2P), ADR-064 (event sourcing / REST mesh)

---

## Contexto

O ADR-076 registrou uma auditoria anterior do backend local e concluiu que a fundacao era solida, com foco principal em schema SQLite, commands Rust, sessao/auth, seguranca e integridade geral.

Na revisao posterior feita antes de empacotar e testar o desktop na pratica, o foco mudou para a capacidade real do backend/banco local sustentar o sync atual e uma futura politica de pacotes Parquet. Essa revisao encontrou problemas adicionais que nao devem ser absorvidos silenciosamente no ADR-076 porque:

- o ADR-076 esta com `Status: Decidido`;
- o proprio ADR-076 colocou o sync pipeline fora do escopo principal;
- os achados novos alteram a ordem de correcao antes de producao;
- alguns achados nao sao apenas sync: envolvem tabelas usadas por hooks e repositorios ativos.

Decisao: manter o ADR-076 como registro historico e criar este ADR posterior como complemento corretivo.

---

## Veredicto

Antes de revisar politica Parquet ou executar validacao manual do build, devemos corrigir a camada backend/banco local em nivel de codigo.

O app tem uma boa base conceitual para sync por eventos, mas a execucao SQLite real ainda nao esta confiavel:

- testes de sync passam com fake SQLite;
- SQLite real falha em SQL/constraints usados pelo inbound;
- ha divergencias entre nomes de tabelas criadas no bootstrap e nomes usados por codigo ativo;
- parte do Rust escreve diretamente em `fila_eventos_sync`, fora do contrato canonico do `TransportService`.

---

## Achados adicionais

### CRITICO (corrigir antes de qualquer teste pratico do sync)

#### C1 — `InboundService` gera SQL invalido ao atualizar cursor

**Arquivo:** `desktop/src/infrastructure/sync/InboundService.ts`

**Problema:** `_updateLocalSeq()` monta:

```sql
ON CONFLICT(id_roteamento) DO UPDATE SET
  SET
  sequencia = excluded.sequencia
```

SQLite real retorna:

```text
SQLITE_ERROR: near "SET": syntax error
```

**Impacto:** o handler inbound pode aplicar o efeito do evento e falhar antes de atualizar `manifesto_sync` e antes de registrar `log_eventos_aplicados`. Na proxima execucao, o mesmo evento pode ser processado de novo.

**Correcao:** remover o segundo `SET` e cobrir com teste SQLite real.

---

#### C2 — `log_gaps_sync.situacao` nao aceita estados usados pelo codigo

**Arquivos:**

- `desktop/scripts/ensure-columns.ts`
- `desktop/src/infrastructure/sync/InboundService.ts`

**Problema:** o schema permite apenas:

```text
pending, resolved, skipped
```

Mas o codigo escreve:

```text
retrying, accepted
```

SQLite real retorna:

```text
SQLITE_CONSTRAINT: CHECK constraint failed
```

**Impacto:** retry/aceite manual de gap quebra em runtime.

**Correcao:** alinhar enum do schema com os estados reais ou reduzir o codigo aos estados existentes. Preferencia: `pending`, `retrying`, `resolved`, `accepted`, `quarantined`.

---

### ALTO (corrigir antes de producao)

#### A1 — Outbox pode inverter ordem causal no indice remoto

**Arquivo:** `desktop/src/infrastructure/sync/TransportService.ts`

**Problema:** `pushPending()` busca eventos por `sequencia ASC`, mas se um evento falha ele marca `failed` e continua enviando os proximos. O RPC remoto (`rpc_push_sync_event`) atribui `seq` remoto por `MAX(seq)+1`, nao pelo `envelope.seq` local.

**Impacto:** se evento local 1 falhar e evento local 2 for enviado, o evento 2 pode virar `seq=1` no indice remoto. Quando o evento 1 for reenviado depois, vira `seq=2`. Isso preserva entrega, mas quebra causalidade.

**Agravante:** o comportamento esta explicitamente testado em `sync-protocol.test.ts` como desejado.

**Correcao:** escolher uma politica:

- parar o batch no primeiro erro por rota; ou
- aceitar fora-de-ordem e remover expectativa causal; ou
- enviar `local_seq` separado e validar `prev_event_id` no destino.

Recomendacao: parar no primeiro erro por rota enquanto o protocolo nao tiver HLC/causalidade formal.

---

#### A2 — Exportacao mobile limpa tabelas antigas de sync, nao as atuais

**Arquivo:** `desktop/src-tauri/src/database.rs`

**Problema:** `db_export_for_mobile()` apaga:

```text
sync_event_queue, sync_device_log, sync_gap_log,
sync_cursor, sync_manifest, sync_status, sync_applied_log
```

Mas o bootstrap atual cria:

```text
fila_eventos_sync, log_dispositivos_sync, log_gaps_sync,
cursor_sync, manifesto_sync, log_eventos_aplicados
```

**Impacto:** exportacao do banco para mobile pode carregar filas/logs atuais de sync, ou dar falsa sensacao de sanitizacao.

**Correcao:** limpar os nomes atuais e manter os antigos apenas como compatibilidade defensiva.

---

#### A3 — Rust `audit.rs` injeta evento sync fora do contrato canonico

**Arquivo:** `desktop/src-tauri/src/commands/audit.rs`

**Problema:** `log_audit()` insere diretamente em `fila_eventos_sync` com envelope manual:

- `seq: 0`;
- `checksum: ""`;
- `routing_id: "default"`;
- erro de insert ignorado.

**Impacto:** evento `audit.registro` pode ficar fora do fluxo canonico usado por `TransportService`, sem checksum e sem sequencia valida.

**Correcao:** remover escrita direta no Rust ou criar um command/porta unica para publicar evento via fluxo canonico. Se auditoria precisar ser best-effort, registrar falha explicitamente.

---

#### A4 — Tabelas usadas por codigo ativo nao sao criadas pelo bootstrap

**Arquivos principais:**

- `desktop/src/infrastructure/persistence/sqlite/queries/system.ts`
- `desktop/src/interface/hooks/utils/useNetworkParquet.ts`
- `desktop/src/interface/hooks/utils/useCEP.ts`
- `desktop/src/infrastructure/persistence/sqlite/queries/data-registry.ts`
- `desktop/src/infrastructure/persistence/sqlite/SqliteDecisionRegistryRepository.ts`

**Problema:** o bootstrap nao cria estas tabelas com os nomes usados:

```text
app_config
cep
data_registry
decision_registry
view_registry
```

Alguns nomes parecem legados e ja foram renomeados para PT-BR (`registro_dados`, `registro_decisoes`, `registro_visualizacoes`). Outros parecem simplesmente ausentes (`app_config`, `cep`).

**Impacto confirmado por uso:**

- `useNetworkParquet` usa `app_config` para salvar caminho de rede.
- `useCEP` consulta `cep`.
- `fetchDataRegistryTipos()` consulta `data_registry`, apesar de o mesmo arquivo tambem ter queries corretas para `registro_dados`.
- `SqliteDecisionRegistryRepository` usa `decision_registry`, mas o bootstrap cria `registro_decisoes`.

**Correcao:** escolher uma fonte de verdade de nomes. Preferencia: corrigir codigo para nomes PT-BR existentes e criar `app_config`/substituir por `tbl_configuracoes_sistema`. Para `cep`, decidir se fica cache local ou se usa apenas command Rust `fetch_cep`.

---

### MEDIO

#### M1 — Testes de sync mascaram SQL real

**Arquivos:**

- `desktop/src/infrastructure/sync/__tests__/sync-protocol.test.ts`
- `desktop/src/test/fakes/InMemorySqlitePort.ts`

**Problema:** a suite de sync passa, mas o fake interpreta SQL por regex e nao executa SQLite real. Ele aceita o upsert invalido de `manifesto_sync` e nao aplica o `CHECK` real de `log_gaps_sync`.

**Correcao:** manter o fake para testes unitarios, mas adicionar testes de contrato com `sqlite3` em memoria usando o DDL real de `ensure-columns.ts` ou um schema minimo equivalente.

---

#### M2 — View `vw_inbox_normalizada` e queries legadas precisam de validacao em banco limpo

**Arquivos:**

- `desktop/scripts/ensure-columns.ts`
- `desktop/src/infrastructure/persistence/sqlite/queries/inbox.ts`

**Problema:** a view e criada com `.catch(...)`, entao erro de schema pode ser apenas logado. Como a tabela `pacotes` mistura campos legados e novos, qualquer divergencia fica invisivel ate a tela de inbox consultar.

**Correcao:** criar teste de bootstrap em SQLite real que:

1. rode `ensure-columns`;
2. consulte `sqlite_master` para views/tabelas esperadas;
3. execute `SELECT * FROM vw_inbox_normalizada LIMIT 1`;
4. falhe se qualquer view essencial nao for criada.

---

## Relacao com ADR-076

Este ADR nao substitui o ADR-076. Ele muda a prioridade operacional:

1. Corrigir primeiro os achados CRITICOS deste ADR.
2. Corrigir divergencias de nomes ativos (`app_config`, `data_registry`, `decision_registry`, etc.).
3. Depois retomar os blocos de seguranca e integridade do ADR-076.
4. So entao revisar politica de pacotes Parquet ou testar o build desktop de forma conclusiva.

O item do ADR-076 que dizia que o sync seria refeito pelo ADR-075 permanece valido como direcao arquitetural, mas os bugs deste ADR bloqueiam uso confiavel do app atual e precisam de hotfix antes de depender do build existente.

---

## Ordem de correcao recomendada

### Bloco 0 — Hotfix de runtime SQLite

| Prioridade | Item | Esforco |
|---|---|---|
| 1 | C1 — corrigir `SET SET` no `InboundService` | Baixo |
| 2 | C2 — alinhar enum de `log_gaps_sync.situacao` | Baixo |
| 3 | M1 — adicionar teste SQLite real para os dois casos | Baixo/medio |

### Bloco 1 — Coerencia de schema ativo

| Prioridade | Item | Esforco |
|---|---|---|
| 4 | A4 — substituir `app_config` por `tbl_configuracoes_sistema` ou criar tabela formal | Baixo |
| 5 | A4 — trocar `data_registry` por `registro_dados` | Baixo |
| 6 | A4 — trocar `decision_registry` por `registro_decisoes` ou criar adapter/migration | Medio |
| 7 | A4 — decidir `cep`: tabela local ou command Rust `fetch_cep` | Baixo |

### Bloco 2 — Sync/outbox/export

| Prioridade | Item | Esforco |
|---|---|---|
| 8 | A1 — parar batch no primeiro erro por rota ou documentar quebra causal | Medio |
| 9 | A2 — limpar tabelas atuais no export mobile | Baixo |
| 10 | A3 — remover escrita direta de evento sync em `audit.rs` | Medio |

---

## Evidencia de verificacao

Comando executado:

```sh
npx vitest run src/infrastructure/sync/__tests__/sync-protocol.test.ts
```

Resultado: 24 testes passaram.

Prova adicional em SQLite real confirmou:

```text
manifesto_upsert=SQLITE_ERROR: near "SET": syntax error
gaps_retrying=SQLITE_CONSTRAINT: CHECK constraint failed
ensure_has_app_config=false
ensure_has_cep=false
ensure_has_data_registry=false
ensure_has_decision_registry=false
ensure_has_view_registry=false
```

Conclusao: a suite existente e util, mas insuficiente para validar runtime SQLite real.
