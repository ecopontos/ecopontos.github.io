# Auditoria de Segurança — EcoForms Desktop (backend Rust / Tauri)

**Data:** 2026-06-19 · **Escopo:** `src-tauri/` (29 arquivos, ~4k LOC) + tratamento de credenciais.
**Método:** revisão estática (sem build). Foco: superfície IPC exposta ao webview, auth/sessão, RBAC, cripto, SQL guard, I/O externo.

## Modelo de ameaça
Todo `#[tauri::command]` é invocável por **qualquer JS rodando no webview** (`invoke(...)`). A app carrega um frontend Next.js. Portanto o design só é seguro se: (a) o frontend nunca executa código não-confiável (sem XSS, sem dep comprometida, sem conteúdo remoto), **ou** (b) o backend reimpõe auth/permissão. O código claramente *pretende* (b) — existe `session.rs`/`validate_against_db`/`check_permission` — mas a aplicação é **inconsistente**: vários comandos sensíveis não usam essas defesas.

---

## CRÍTICO

### C1. Leitura/escrita arbitrária de arquivos, sem autenticação — `commands/lan_storage.rs`
`lan_read_file` / `lan_write_file` / `lan_list_dir` aceitam **qualquer caminho absoluto** e só bloqueiam componentes `..`. Um caminho como `/etc/passwd`, `C:\Users\...\.ssh\id_rsa`, o próprio `ecoforms.sqlite` ou `.env` **não tem componente `ParentDir`** → passa na validação.
- Sem `SessionState`, sem `check_permission`. Qualquer chamada IPC lê/escreve/lista o FS do usuário.
- `network.rs` (`network_*`) tem o mesmo padrão (bloqueia `..`, canonicaliza symlink, mas **sem confinamento a um diretório-base**).
- A `fs:scope` do Tauri (`capabilities/default.json`, limitada a `$APPDATA`) **não protege** esses comandos — eles usam `std::fs` direto, fora do plugin `fs`.

**Impacto:** primitiva de leitura/escrita arbitrária exposta ao frontend. Com qualquer XSS vira exfiltração total + RCE-adjacente (sobrescrever arquivos).
**Correção:** confinar a um base-dir configurado (`canonicalize` e verificar `starts_with(base)`); exigir sessão válida + permissão; validar que o caminho final está dentro do share permitido.

### C2. Estabelecimento de sessão desacoplado da autenticação — `session.rs` `set_session`
`db_login` (auth.rs) verifica a senha em Rust mas **só devolve o resultado ao frontend**. A sessão é criada por um comando separado, `set_session(user_id, perfil)`, que valida apenas que `perfil` bate com o do `user_id` no banco — **não exige prova de senha**.
- Qualquer JS no webview pode chamar `set_session(<id_do_admin>, "admin")` e assumir privilégios de admin **sem a senha**.
- A partir daí: `supabase_admin_query` (admin Supabase), mutações em tabelas sensíveis, rotação de salt, etc.

**Impacto:** bypass de autenticação / escalonamento para admin no nível IPC. Não há token ligando `db_login` → `set_session`.
**Correção:** `db_login` deve criar a sessão diretamente (retornar um handle/token de sessão assinado), e `set_session` deixar de aceitar identidade arbitrária do cliente.

---

## ALTO

### A1. RBAC granular não é imposto no `db_execute` — `database.rs`
A tabela `permissoes` + `check_permission()` (rbac.rs) existem, mas `db_execute`/`db_execute_batch` só aplicam um guard **grosso**: bloqueiam mutação nas 6 tabelas sensíveis para não-admin. Para **qualquer outra tabela de negócio** (clientes, demandas, pesagens, roteiros, …) basta ter `perfil` na sessão — nenhuma permissão é checada. Um `operador` pode INSERT/UPDATE/DELETE livremente. RBAC fino é só de fachada (frontend).
**Correção:** mapear tabela+operação → permissão e chamar `check_permission` no caminho genérico, ou abandonar o SQL genérico para comandos de domínio com permissão explícita (como já faz `actions.rs`/`key_rotation.rs`).

### A2. `db_query` vaza `sal_sync` (salt de sync) — `database.rs`
`FORBIDDEN_COLUMNS` em `db_query` cobre só `PASSWORD_HASH`/`HASH_SENHA`. **`sal_sync` não está na lista.** `auth.rs` trata `sal_sync` como sensível e o oculta, mas um `SELECT sal_sync FROM usuarios` genérico passa. Esse salt entra na derivação de chave do sync → vazá-lo enfraquece a criptografia de sincronização.
**Correção:** adicionar `SAL_SYNC` a `FORBIDDEN_COLUMNS` de `db_query` (e ao guard de `db_execute_batch`).

### A3. Leitura de DB e envio de e-mail sem sessão/permissão
- `db_query`: recebe `SessionState` mas **ignora** (`_session`). Leitura completa do banco (clientes, dados pessoais, auditoria) sem login.
- `send_email`/`test_email_connection`: nenhum `check_permission`; basta `config.enabled`. Qualquer caller dispara e-mails pelo SMTP configurado (vetor de spam/phishing pela infra da prefeitura), sem rate-limit. `send_email` nem exige sessão (usa `unwrap_or_default` só para log).
**Correção:** exigir sessão + permissão (`data.view_*`, `system.*`) nesses comandos.

---

## MÉDIO

### M1. Fallback de senha SHA-256 sem salt — `lib.rs check_password`
Hashes que não começam com `$2` são verificados como **SHA-256 hex puro, sem salt** (suscetível a rainbow tables). `verify_password` ainda é exposto como comando genérico. Aceitável só como ponte de migração; deve ser eliminado e os hashes legados re-hasheados em bcrypt no próximo login.

### M2. `db_execute` (single) não bloqueia escrita na coluna de senha
`db_execute_batch` bloqueia `HASH_SENHA`/`PASSWORD_HASH` para todos; o `db_execute` single **não tem** essa checagem. Um admin (ou bootstrap) pode `UPDATE usuarios SET hash_senha=...` direto, contornando o `bcrypt` de `hash_password`/`create_first_admin`. Severidade limitada (admin), mas inconsistente.

### M3. Trilha de auditoria forjável — `supabase_admin.rs`
O ator registrado (`request.user_id`) é **fornecido pelo cliente** e usado direto no `log_audit`, enquanto a autorização real usa `session.perfil`. Permite registrar ações com identidade de ator falsa. Usar sempre o `user_id` da sessão validada.

### M4. Credenciais reais no `.env.local`
O arquivo (presente na cópia local, fora do dump) contém **anon key (JWT) e URL do projeto Supabase reais** (`vnnimekczkxkpckrydnc`) e um **caminho UNC interno** (`\\192.168.12.1\...`) que revela topologia de rede. O service-role key está corretamente ausente, e a anon key é por design pública (RLS é a defesa) — mas confirme: (1) RLS habilitado em todas as tabelas Supabase; (2) este arquivo está no `.gitignore` e nunca foi commitado; (3) considere rotacionar a anon key se já vazou em histórico.

---

## OK / Pontos fortes
- **`sql_guard.rs`**: parsing estrutural (strip de comentários/strings, statement único, tabela-alvo, colunas do SET) em vez de match por substring. Bem testado — bloqueia multi-statement, smuggling, falsos positivos em comentário. Bom.
- **Queries parametrizadas** em todo lugar (rusqlite `?n`); sem concatenação de input em SQL.
- **`key_rotation.rs`**: Argon2id (64 MiB/3/4), AES-256-GCM com nonce aleatório, escrow cifrado, permissão `system.config` + sessão validada. Sólido.
- **`crypto.rs`**: HKDF/HMAC-SHA256 implementados corretamente (separação de domínio para chave SMTP). *Smell* de cripto artesanal, mas a construção confere.
- **`setup.rs`**: bcrypt custo 12, política de senha (≥8, alfa+dígito), `create_first_admin` idempotente; seed de admin padrão (`admin/admin`) só em debug **com** opt-in `ECOFORMS_SEED_ADMIN=1` — release nunca semeia.
- **`supabase_admin.rs`**: service-role key só no backend (env), whitelist de tabelas/operações, `check_admin_permission`.
- **`toggle_devtools`/log**: devtools e logging só em debug.
- **`db_export_for_mobile`**: zera `hash_senha`/`sal_sync` e limpa tabelas de sync/auditoria antes de exportar.

---

---

# Infra de Sync (TS ↔ Rust) — acoplada aos achados acima

**Escopo:** `packages/core/src/sync/*`, `ecoforms/src/infrastructure/sync/*`, `CryptoLayer.ts`, `commands/crypto.rs`.
**Modelo de confiança do sync:** dois nós trocam eventos via um índice/share comum (Supabase `sync_event_index` e/ou share LAN `\\192.168.12.1\...`). A segurança depende inteiramente do segredo de **uma chave AES org-wide**.

## S1. CRÍTICO (encadeia com C1) — chave de sync persistida em texto claro
`CryptoLayer.ts` deriva a chave por **PBKDF2-SHA256 600k** (`deriveAndStoreKey`, salt = `sal_sync`) — KDF forte — mas em seguida **grava a chave bruta de 32 bytes em claro** em `.ecoforms-keys.dat` (Tauri Store, array JSON de bytes). `loadKey()` a lê de volta **sem senha**. Resultado: o PBKDF2 é anulado — a chave AES fica em claro no disco.
- A integridade real dos eventos vem do **AES-GCM (AEAD)**, não do `checksum`. Quem tem a chave decifra E forja.
- **Encadeia com C1** (`lan_read_file` lê qualquer caminho): ler `.ecoforms-keys.dat` → obter a chave org → **decifrar e forjar qualquer evento de sync**. C1 + S1 = comprometimento total da cripto de sync.
- Relação com A2 (`sal_sync`): com a chave já em claro, o sigilo do salt importa pouco; mas com `sal_sync` (vazável por A2) + senha do usuário (ou hash legado SHA-256 fraco) também se deriva a chave sem o arquivo.
**Correção:** não persistir a chave bruta. Derivar da senha a cada login (já há PBKDF2) e manter só em memória; ou selar em keychain do SO. Se precisar persistir, cifrar com chave do SO (DPAPI/Keychain/secret-service).

## S2. ALTO — sem autenticação de remetente (chave simétrica compartilhada)
Não há chave de **assinatura por dispositivo**. A chave AES é org-wide; todo nó a possui. AES-GCM garante integridade do blob, mas **não autenticidade de origem**. Qualquer nó (ou qualquer um que leia a chave via S1/C1) forja eventos com qualquer `source.routing_id`/`device_id` → impersonação de qualquer setor/usuário, sem não-repúdio.
**Correção:** assinatura assimétrica por dispositivo (Ed25519) sobre o envelope, com chaves públicas distribuídas por device; verificar no inbound.

## S3. CRÍTICO — `LanPullService`: ingestão não autenticada/não cifrada/sem schema, grava em tabelas sensíveis
`LanPullService.pullDomain` lê **snapshots JSON em claro** do share LAN (`lan.fetchEntity` → `lan_read_file`/`network_*`) e faz **UPSERT direto** em `usuarios` (com `perfil=excluded.perfil`), `demandas`, `manifestacoes`, `tarefas`, `tbl_agendamentos`, `setores`. Nessa via **não há**: decrypt, checksum, nem `validatePayload` (zod). `snapshot: Record<string,unknown>` vai direto pro upsert.
- Quem tiver **escrita no share** controla esses dados em **todo nó que faz pull**.
- `usuarios.perfil` → escalonamento de privilégio. (O guard Rust de `db_execute` bloqueia `usuarios` para sessão não-admin — mas **não** bloqueia demandas/manifestacoes/setores/tarefas/agendamentos, que não são tabelas sensíveis → injeção livre por qualquer sessão. **Explora exatamente A1.**)
- Combinado com **C2** (`set_session` vira admin sem senha) → o upsert de `usuarios` também passa.
- SQL é **parametrizado** (sem SQLi), mas o *dado* é 100% confiado.
- **Contraste:** a via de eventos (`InboundService._dispatch`) **chama `validatePayload`** (zod, `payloadSchemas.ts`) antes do handler. `LanPull` não. Duas portas de entrada, só uma valida.
**Correção:** validar schema (zod) e exigir assinatura/decrypt também na via LAN; restringir tabelas-alvo; nunca aceitar `perfil`/campos de autorização via snapshot.

## S4. MÉDIO — checksum decorativo + comentário enganoso
`buildChecksum` = `SHA-256(stableStringify(data))` **sem chave**. O inbound rejeita mismatch com a mensagem "checksum inválido — possível **tampering**", sugerindo proteção anti-adulteração que um SHA-256 keyless **não oferece** (o atacante recalcula). A proteção real é o GCM. Trocar por **HMAC** com a chave org, ou assumir o GCM explicitamente e renomear para "detecção de corrupção".

## S5. BUG (confiabilidade → segurança) — `InboundService._updateLocalSeq` SQL malformado
O `ON CONFLICT ... DO UPDATE SET` tem **`SET` duplicado**:
```
DO UPDATE SET
  SET
  sequencia = excluded.sequencia, ...
```
Erro de sintaxe → o update de sequência **falha em conflito**. Efeito colateral em rastreio de seq/gaps e idempotência (reprocessamento). Corrigir removendo o segundo `SET`.

## S6. BAIXO — `purgeOldSentEvents` interpola `days` no SQL
`'-${Math.max(1, Math.round(days))} days'` interpola direto, mas `Math.round` força inteiro → **sem injeção**. Anotado; preferir bind param por consistência.

## OK / Pontos fortes (sync)
- Push cifra o **envelope inteiro** (`pushEventToIndex` com `crypto`); inbound decifra o blob completo (AEAD cobre checksum/source).
- Idempotência via `log_eventos_aplicados` (`_isApplied`/`_markApplied`).
- Detecção de gap de sequência + retry com backoff + quarentena.
- Via de **eventos** valida payload (zod) e tipo canônico (`isEcoFormsEventType`).
- Queries de sync **parametrizadas** em ambos os lados.

---

## Prioridade de correção
1. **C1 + S1** — FS arbitrário + chave de sync em claro: juntos quebram toda a cripto de sync. Maior prioridade.
2. **C2** (bypass de sessão) e **S3** (`LanPull` grava tabelas sensíveis sem validação) — escalonamento de privilégio.
3. **A1** (impor permissão no caminho de escrita genérico) — habilitante de S3.
4. **A2 / S4 / S5** — vazamento de `sal_sync`, checksum→HMAC, bug de seq.
5. **S2** — assinatura por dispositivo (mudança estrutural, médio prazo).
6. **A3 / M1–M4** — sessão/permissão em leitura+e-mail, higiene de credenciais.
