# Plano de correcoes da revisao geral do EcoForms Desktop

> **Para agentes/implementadores:** use este documento como checklist. Cada tarefa deve terminar com validacao objetiva antes de avancar para a proxima fase. As alteracoes devem ser pequenas, revisaveis e sem misturar refactors nao relacionados.

**Data:** 2026-06-28

**Escopo:** corrigir os achados da revisao geral do `ecoforms/desktop`: empacotamento Tauri/Next, criptografia local, sessoes Rust, LAN sync, filesystem/export, credenciais externas, boundaries de arquitetura, transacoes SQLite e hardening de Tauri.

**Estado observado na revisao:**

- `npx tsc --noEmit`: passou.
- `cargo check`: passou.
- `npm test`: passou, 30 arquivos e 240 testes.
- `node scripts/audit-db-consistency.js`: passou, 0 issues.
- `npm run build`: passou, mas gerou `.next` e nao gerou `desktop/out`.
- `npm run lint`: falhou com 24 erros e 156 warnings.

**Validacao executada nesta rodada:**

- `cargo check`: passou.
- `cargo test --lib`: passou, 59 testes.
- `npx tsc --noEmit`: passou.
- `npm run lint`: passou com 0 erros e 157 warnings.
- `npm test`: passou, 32 arquivos e 244 testes.
- `node scripts/audit-db-consistency.js`: passou, 0 issues.
- `npm run build`: passou e gerou `desktop/out`.

**Atualizacao de 2026-06-30 — reorganizacao backend local/integracoes:**

- O lote principal de remocao de compatibilidade retroativa foi concluido, porque o app nunca entrou em producao e nao existe base instalada para migrar.
- A auditoria foi ampliada para varrer SQL embutido na UI e separar falso positivo de substring/comentario.
- Os lotes seguintes fecharam os residuos em sync/scripts/testes; `node scripts/audit-architecture-boundaries.js` agora reporta **0** referencias a nomes de tabela fora da convencao lusofona.
- O trabalho restante relevante saiu das Fases B/C/D e ficou concentrado em validacao real; o backlog logico de codigo morto foi esgotado e a poda inicial de dependencias ja foi aplicada.

**Fechamento local de 2026-06-30 — gate final:**

- `npm test`: passou, 34 arquivos e 255 testes.
- `node scripts/audit-db-consistency.js`: passou, 0 issues.
- `cargo check`: passou.
- `cargo test --lib`: passou, 72 testes.
- `npm run build`: passou e gerou `desktop/out`.
- `npm run build:tauri`: passou e gerou `desktop/src-tauri/target/release/app`.

---

## Ordem recomendada

1. Corrigir o artefato de producao Tauri/Next.
2. Remover persistencia da chave criptografica bruta.
3. Fechar o modelo de sessao Rust e comandos sensiveis.
4. Autenticar e restringir o servidor LAN.
5. Confinar filesystem/export.
6. Tirar credenciais PostgreSQL do bundle frontend.
7. Restaurar boundaries de Clean Architecture e lint.
8. Corrigir atomicidade real das transacoes SQLite.
9. Aplicar hardening final de CSP/capabilities e rodar gate completo.

---

## Fase 1: Artefato de producao Tauri/Next

**Problema:** `src-tauri/tauri.conf.json` usa `frontendDist: "../out"`, mas `npm run build` executa apenas `next build` e nao cria `desktop/out`. O build atual contem rotas SSR/dinamicas, entao o empacotamento Tauri de producao fica desalinhado.

**Arquivos principais:**

- `desktop/src-tauri/tauri.conf.json`
- `desktop/next.config.ts`
- `desktop/package.json`
- rotas dinamicas em `desktop/app/**/[id]/**`, `desktop/app/modulo/[slug]/**`

### Tarefas

- [x] Decidir o alvo oficial: **static export** com `output: "export"` e `frontendDist: "../out"`.
- [x] Se escolher static export:
  - [x] Adicionar `output: "export"` em `next.config.ts`.
  - [x] Remover `redirects()` de `next.config.ts`; ja existe redirect client-side em `app/tarefas/[id]/TarefaRedirectClient.tsx`.
  - [x] Converter rotas dinamicas que hoje aparecem como `ƒ` no build para client-only + `generateStaticParams` sentinel, ou substituir por rotas estaticas com parametro lido no cliente.
  - [x] Garantir que paginas que dependem de dados locais nao usam SSR runtime.
  - [x] Rodar `npm run build` e confirmar que `desktop/out` existe.
- [ ] Se escolher sidecar:
  - [ ] Documentar no README do desktop como o servidor Next sera iniciado no app empacotado.
  - [ ] Ajustar `tauri.conf.json` para o fluxo de build real.
  - [ ] Validar instalador em ambiente desktop.

### Criterios de aceite

- [x] `npm run build` gera o artefato esperado pelo Tauri.
- [x] `npm run build:tauri` nao falha por ausencia de `out`.
- [ ] O app empacotado abre `/login`, `/`, uma rota dinamica de task e uma rota dinamica de modulo sem depender do dev server.

**Implementacao concluida localmente nesta rodada:**

- Rotas dinamicas criticas ganharam entradas estaticas equivalentes por query string (`/tasks/detalhe?id=...`, `/modulo?slug=...`, etc.).
- `app/not-found.tsx` redireciona deep links antigos para essas entradas estaticas.
- `npm run build` passou e o artefato exportado contem `out/404.html`, ponto necessario para validar o fallback no binario Tauri.
- `npm run build:tauri` passou e gerou o binario release `src-tauri/target/release/app`.

---

## Fase 2: Criptografia local sem chave bruta persistida

**Problema:** `src/infrastructure/sync/CryptoLayer.ts` persiste `org_crypto_key` em `.ecoforms-keys.dat` como bytes brutos, apesar da documentacao dizer que a chave derivada da senha nao e persistida.

**Arquivos principais:**

- `desktop/src/infrastructure/sync/CryptoLayer.ts`
- `desktop/contexts/AuthContext.tsx`
- `desktop/src-tauri/src/commands/crypto.rs`
- `ecoforms/CLAUDE.md`

### Tarefas

- [x] Remover `store.set(STORE_KEY, Array.from(rawKey))` de `deriveAndStoreKey`.
- [x] Remover ou restringir `generateAndStoreKey`; se ainda for necessario, migrar para cofre do SO/Stronghold, nao store comum.
- [x] Fazer `loadKey()` nao carregar chave bruta persistida; apos restart, exigir novo login para rederivar a chave.
- [x] No logout, apagar tambem qualquer `.ecoforms-keys.dat` legado ou pelo menos remover `org_crypto_key`.
- [x] Manter o envio da chave ao Rust (`load_crypto_key`) apenas no login bem-sucedido, em memoria.
- [x] Atualizar documentacao para refletir PBKDF2 atual: 600.000 iteracoes, salt por usuario, chave nao persistida.
- [x] Criar teste unitario para garantir que `deriveAndStoreKey` nao chama `store.set` com material bruto.

### Criterios de aceite

- [x] Grep por `org_crypto_key` mostra apenas codigo de limpeza/migracao ou nenhum uso persistente.
- [x] Sync criptografado funciona apos login.
- [x] Apos reiniciar o app, operacoes que precisam da chave pedem novo login ou rederivacao explicita.

**Implementacao concluida nesta rodada:**

- `CryptoLayer` nao persiste mais chave raw; `deriveAndStoreKey()` apenas deriva/importa em memoria e faz limpeza best-effort do store legado.
- `loadKey()` nao reidrata a chave; apos cold start, a chave precisa ser rederivada por novo login.
- `AuthContext.logout()` limpa a chave em memoria e remove `org_crypto_key` legado.
- `sync-protocol.test.ts` cobre explicitamente que `deriveAndStoreKey` nao persiste a chave raw.
- `ecoforms/CLAUDE.md` foi alinhado ao comportamento atual: PBKDF2 600k, `sal_sync` por usuario, chave apenas em memoria e `load_crypto_key` validado por sessao.

---

## Fase 3: Sessao Rust como fonte de autorizacao

**Problemas:**

- A UI restaura usuario do `localStorage`, mas nao restaura a sessao Rust em memoria.
- `set_session` aceita `user_id`/`perfil` vindos do JS, validando apenas se o usuario esta ativo. Isso permite reabrir sessao Rust sem senha caso o frontend invoque o comando.

**Arquivos principais:**

- `desktop/src-tauri/src/session.rs`
- `desktop/src-tauri/src/commands/auth.rs`
- `desktop/src-tauri/src/lib.rs`
- `desktop/contexts/AuthContext.tsx`
- `desktop/app/login/page.tsx`

### Tarefas

- [x] Fazer `db_login` validar senha e criar a sessao Rust no mesmo comando.
- [x] Parar de chamar `set_session` no frontend apos login.
- [x] Remover `set_session` do invoke handler publico ou transforma-lo em comando interno/test-only.
- [x] No cold start, nao ressuscitar sessao sensivel apenas por `localStorage`; exigir novo login ou implementar token de sessao emitido pelo Rust com expiracao e validacao.
- [x] Garantir que comandos sensiveis chamam `SessionState::validate_against_db`.
- [x] Adicionar testes Rust para:
  - login cria sessao;
  - usuario inativo nao cria sessao;
  - `set_session` nao permite elevacao sem login, caso continue existindo.
- [x] Atualizar `AuthContext` para armazenar apenas dados nao sensiveis de UX, nao autoridade.

### Criterios de aceite

- [x] Depois de reiniciar o app, comandos protegidos nao ficam em estado inconsistente: ou funcionam com token Rust valido, ou exigem login.
- [x] Nao existe caminho publico para assumir sessao Rust conhecendo apenas `id` e `perfil`.

**Implementacao concluida nesta rodada:**

- `db_login` valida credenciais em Rust e cria a sessao no mesmo comando.
- `set_session` saiu do invoke handler publico.
- `AuthContext` nao ressuscita sessao sensivel de `localStorage`; o cold start volta para login.
- Comandos protegidos validam a sessao Rust contra o banco antes de operar.

---

## Fase 4: LAN sync autenticado e restrito

**Problema:** o servidor LAN escuta em `0.0.0.0`, usa CORS permissivo e expoe endpoints de eventos/arquivos sem autenticacao forte. O websocket aceita `device_id` autodeclarado.

**Arquivos principais:**

- `desktop/src-tauri/src/lan_server/server.rs`
- `desktop/src-tauri/src/lan_server/routes.rs`
- `desktop/src-tauri/src/lan_server/file_routes.rs`
- `desktop/src-tauri/src/lan_server/ws.rs`
- `desktop/src-tauri/src/lan_server/state.rs`
- `desktop/src/infrastructure/sync/LanTransport.ts`
- `desktop/contexts/LanSyncContext.tsx`

### Tarefas

- [x] Criar modelo de pareamento: token compartilhado persistido em `.ecoforms-lan-token` dentro da base configurada para `lan_sync_path`, com fallback seguro para `app_data_dir`/pasta do banco.
- [x] Exigir header de autenticacao em `GET/POST /api/sync/events` e `GET/POST /api/files`.
- [x] Exigir autenticacao no primeiro frame websocket e rejeitar peers nao pareados.
- [x] Trocar `CorsLayer::permissive()` por origem estrita ou remover CORS se o consumo for Tauri/backend.
- [x] Permitir bind `0.0.0.0` apenas quando o modo hub estiver explicitamente habilitado; caso contrario, preferir `127.0.0.1`.
- [x] Adicionar limite de tamanho para payloads/eventos/anexos.
- [x] Validar schema de eventos antes de inserir em `fila_eventos_lan`.
- [x] Registrar auditoria local para eventos rejeitados por autenticacao ou schema.

### Criterios de aceite

- [x] Requisicao LAN sem token recebe 401/403.
- [x] Requisicao LAN com token invalido nao insere evento nem arquivo.
- [x] Peer pareado consegue sincronizar evento valido.
- [x] Testes cobrem HTTP events, files e websocket auth.

**Implementacao concluida nesta rodada:**

- HTTP LAN e arquivos agora exigem `X-Device-Id` + `X-LAN-Token`.
- Websocket autentica no primeiro frame com `auth_ok`/`auth_failed`.
- O servidor usa bind restrito por papel, CORS estrito, limite de corpo e auditoria local de rejeicoes.

---

## Fase 5: Confinamento de filesystem e export

**Problema:** `lan_read_file`, `lan_write_file`, `lan_list_dir` e `db_export_for_mobile` aceitavam paths controlados pelo frontend. O guard original bloqueava `..`, mas nao confinava a uma base segura.

**Arquivos principais:**

- `desktop/src-tauri/src/commands/lan_storage.rs`
- `desktop/src-tauri/src/database.rs`
- `desktop/src-tauri/src/lib.rs`
- `desktop/src/infrastructure/storage/LanFileStorage.ts`
- `desktop/app/admin/exportar-mobile/page.tsx`
- `desktop/src-tauri/capabilities/default.json`

### Tarefas

- [x] Criar helper Rust de path confinement que recebe base canonica e path relativo.
- [x] Fazer comandos LAN lerem a base `lan_sync_path` do SQLite/backend, e aceitarem apenas `relPath`.
- [x] Bloquear paths absolutos vindos da UI.
- [x] Exigir sessao/permissao para leitura, escrita e export mobile.
- [x] Fazer `db_export_for_mobile` exportar somente para `appdata` ou base LAN configurada.
- [x] Remover leitura do arquivo exportado por path absoluto; usar handle/path relativo autorizado.
- [x] Reduzir permissions Tauri `fs:*` ao minimo necessario.

### Criterios de aceite

- [x] Tentativa de ler `/etc/passwd`, `C:\Windows\...` ou path absoluto fora da base falha.
- [x] Tentativa de `../escape` falha.
- [x] Export mobile continua funcionando para destino permitido.
- [x] Testes Rust cobrem leitura, escrita, listagem e export.

**Implementacao concluida nesta rodada:**

- `lan_paths.rs` centraliza canonicalizacao e confinamento relativo.
- `lan_read_file`, `lan_write_file` e `lan_list_dir` operam somente sobre paths relativos da base configurada.
- `db_export_for_mobile` exporta apenas para `appdata` ou `lan` e retorna caminho relativo.
- A tela de exportacao escolhe o destino (`appdata`/`lan`) e baixa o arquivo pelo backend correto.
- `default.json` foi reduzido para acesso AppData + leitura de arquivo escolhido pelo usuario + criacao de diretorio app-specific.

**Validacao desta fase:**

- `cargo check`: passou.
- `cargo test --lib`: passou, 59 testes.
- `npm test`: passou, 30 arquivos e 240 testes.
- `npm run build`: passou e gerou `desktop/out` (inclui TypeScript).

## Fase 6: Credenciais PostgreSQL fora do bundle frontend

**Problema:** `NEXT_PUBLIC_PG_SYNC_PASSWORD` e demais configs externas sao lidas no frontend em `useExternalRoteiroSync.ts`. Variaveis `NEXT_PUBLIC_*` entram no bundle JS.

**Arquivos principais:**

- `desktop/src/interface/hooks/queries/useLegacySyncData.ts`
- `desktop/src/interface/hooks/queries/useExternalRoteiroSync.ts`
- `desktop/src/interface/hooks/queries/useExternalPesagensSync.ts`
- `desktop/src/interface/hooks/queries/useExternalResiduos.ts`
- `desktop/src-tauri/src/commands/legacy_sync.rs`
- `desktop/src-tauri/src/commands/sync_roteiros.rs`
- `desktop/src-tauri/src/commands/sync_pesagens.rs`
- `desktop/src-tauri/src/commands/sync_residuos.rs`
- `desktop/components/admin/PgConfigCard.tsx`
- `desktop/app/admin/legacy-sync/page.tsx`

### Tarefas

- [x] Remover `NEXT_PUBLIC_PG_SYNC_PASSWORD` e defaults sensiveis do frontend.
- [x] Criar comando Rust para salvar/ler config legacy protegida por sessao/permissao.
- [x] Guardar senha criptografada com chave backend/cofre, ou exigir env var backend nao exposta.
- [x] Fazer `sync_roteiros_*`, `sync_pesagens_*` e `sync_residuos_*` buscarem config no backend, nao em parametros do webview.
- [x] Exigir permissao administrativa/operacional para comandos de sync externo.
- [x] Remover criacao automatica de usuario `system` admin sem governanca ou limitar a migracao idempotente documentada.

### Criterios de aceite

- [x] Grep por `NEXT_PUBLIC_PG_SYNC_PASSWORD` nao retorna codigo runtime.
- [x] Nenhum comando de sync recebe `pg_password` do frontend; o cadastro/rotacao usa `pg_legacy_config_save` para entrega inicial da credencial ao backend.
- [x] Sync externo continua funcionando com config backend.
- [x] Usuario sem permissao nao executa sync externo.

---

## Fase 7: Restaurar boundaries de Clean Architecture

**Problema:** o lint falha porque `src/application/**` importa `src/infrastructure/**`, contrariando a regra em `eslint.config.mjs`.

**Arquivos com imports irregulares observados:**

- `src/application/actions/builtin/*.ts`
- `src/application/ouvidoria/SeedManifestacaoCatalogUseCase.ts`
- `src/application/ouvidoria/VerificarPrazosVencidosJob.ts`
- `src/application/usuario/EliminacaoTitularUseCase.ts`
- `src/application/usuario/ExportacaoDadosTitularUseCase.ts`
- `src/application/views/ViewUseCases.ts`
- `src/application/visuals/GetModuleVisuaisUseCase.ts`

### Tarefas

- [x] Para cada use case, definir se a dependencia correta e:
  - um repository existente;
  - um novo port em `src/application/ports`;
  - um servico de infraestrutura injetado pelo container.
- [x] Mover SQL e detalhes de persistencia para repositories/adapters em `src/infrastructure`.
- [x] Manter `application` dependendo apenas de ports, dominio, DTOs e utilitarios puros.
- [x] Atualizar `container.ts` para injetar os novos ports/adapters.
- [x] Adicionar testes de use case com fakes em `src/test/fakes`.
- [x] Corrigir warnings triviais de unused imports/vars em arquivos tocados.

### Criterios de aceite

- [x] `npm run lint` passa sem erros.
- [x] Nenhum `src/application/**` importa `src/infrastructure/**`.
- [x] Use cases continuam cobertos por testes ou fakes focados.

---

## Fase 8: Atomicidade real das transacoes SQLite

**Problema:** `TauriSqliteAdapter.transaction()` envia `BEGIN`, comandos intermediarios e `COMMIT` como invokes separados sobre uma conexao global. Operacoes concorrentes podem intercalar comandos na mesma transacao.

**Arquivos principais:**

- `desktop/src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts`
- `desktop/src/application/ports/SqlitePort.ts`
- `desktop/src-tauri/src/database.rs`
- repositorios/use cases que usam `.transaction(...)`

### Tarefas

- [x] Criar comando Rust de transacao parametrizada, por exemplo `db_transaction`, que recebe lista de statements + params e executa tudo dentro de `conn.transaction()`.
- [x] Ajustar `SqlitePort` para suportar transacao atomicamente ou um `UnitOfWork`.
- [x] Atualizar repositorios que usam `db.transaction` para gerar batch transacional quando possivel.
- [x] Para callbacks complexos, criar lock/queue no adapter como mitigacao minima, mas preferir transacao Rust real.
- [x] Adicionar teste de concorrencia simulada para garantir que uma mutation externa nao entra entre `BEGIN` e `COMMIT`.

### Criterios de aceite

- [x] Transacoes criticas de agendamento, usuario, modulos e sync sao atomicas no Rust quando usam batch; callbacks complexos ficam serializados no adapter.
- [x] Teste de concorrencia cobre que uma operacao externa nao entra entre `BEGIN` e `COMMIT` no adapter.
- [x] Nao ha regressao nos testes existentes.

**Implementacao concluida nesta rodada:**

- `SqlitePort` agora passa um port transacional para callbacks e aceita `transactionBatch`.
- `TauriSqliteAdapter` ganhou fila interna, proxy transacional e `transactionBatch` via `db_transaction`.
- Rust executa `db_transaction`/`db_execute_batch` dentro de `conn.transaction()` e valida SQL permitido.
- Repositorios de agendamento, usuarios, modulos, widgets, demandas e tasks passaram a usar transacoes/batches nos pontos criticos.
- `tauriSqliteAdapter.test.ts` cobre `db_transaction` e concorrencia durante callback transacional.

---

## Fase 9: Hardening Tauri, CSP e permissions

**Problemas adicionais:** CSP permite `connect-src http:` amplo; capabilities habilitam `fs:default`, writes e `shell:allow-open` de forma ampla.

**Arquivos principais:**

- `desktop/src-tauri/tauri.conf.json`
- `desktop/src-tauri/capabilities/default.json`
- hooks que usam `@tauri-apps/plugin-fs`
- fluxos que abrem URLs externas

### Tarefas

- [x] Trocar `connect-src ... ws: http:` por allowlist concreta:
  - `ipc:`
  - `http://ipc.localhost`
  - Supabase configurado
  - ViaCEP/Nominatim se usados em runtime
  - LAN hub configurado, se aplicavel
- [x] Revisar necessidade de `shell:allow-open`; capability removida em 2026-06-29. A abertura de WhatsApp passou por comando Rust `open_whatsapp_url`, que normaliza/valida numero e constrói somente URL `https://wa.me/...`.
- [x] Remover `fs:default` se os comandos Rust confinados substituirem o plugin fs direto.
- [x] Remover filesystem direto do webview; operações remanescentes passam por comandos Rust confinados.
  - [x] Remover `fs:allow-write-text-file`; export CSV passou a usar comando Rust `write_export_file` com validação de extensão.
  - [x] Migrar export XLSX do Data Registry para comando Rust `write_export_file` com validação de extensão.
  - [x] Migrar cópia de anexos de manifestação para comando Rust `copy_attachment_to_appdata`, removendo `readFile`/`writeFile`/`mkdir` diretos do hook.
  - [x] Migrar import CSV de clientes para comando Rust `read_csv_text_file`, com limite de 10 MB e validação de extensão `.csv`.
  - [x] Migrar download de export mobile para comando Rust `db_read_mobile_export`, reaproveitando validação de sessão/admin, destino (`appdata`/`lan`) e caminho relativo `mobile_exports/ecoforms_mobile_*.db`.
  - [x] Restringir capability `default` apenas à janela `main` em vez de `main` + `*`.
- [x] Validar fluxos de download/export/galeria apos reducao de permissoes por gate automatizado de build/test/lint; validacao manual ainda pendente.

### Criterios de aceite

- [x] App nao precisa de permissao fs ampla para operacoes comuns.
- [x] Links externos continuam abrindo somente para destinos esperados no fluxo revisado de WhatsApp.
- [x] CSP nao permite conexao arbitraria para qualquer `http:`.

**Implementacao parcial nesta rodada:**

- CSP recebeu allowlist concreta: `ipc:`, `http://ipc.localhost`, Supabase, ViaCEP, Nominatim e o endpoint legacy local `http://localhost:3005`; `http:`/`ws:` amplos foram removidos.
- `fs:default` e demais permissoes `fs:*` nao estao mais presentes em `default.json`.
- Correcao aplicada 2026-06-29: `shell:allow-open` removido; fluxo WhatsApp usa comando Rust validado.
- Correcao aplicada 2026-06-29: `fs:allow-write-text-file` removido; export CSV e XLSX usam comando Rust `write_export_file` com validação de extensão (`csv`/`xlsx`).
- Correcao aplicada 2026-06-29: anexos de manifestação usam comando Rust `copy_attachment_to_appdata`, que copia arquivo escolhido para AppData/anexos e retorna caminho/mime ao frontend.
- Correcao aplicada 2026-06-29: import CSV de clientes usa comando Rust `read_csv_text_file`, com limite de 10 MB e validação de extensão `.csv`.
- Correcao aplicada 2026-06-29: download de export mobile usa comando Rust `db_read_mobile_export`, evitando `readFile`/`lan_read_file` no componente e confinando leitura ao arquivo gerado em `mobile_exports`.
- Correcao aplicada 2026-06-29: capability `default` escopada somente para janela `main`.
- Hooks/catalogos de fs foram removidos; `@tauri-apps/plugin-fs` saiu de `package.json`/`package-lock.json` e `tauri_plugin_fs::init()` saiu do bootstrap Rust.

**Pendencias deliberadas:**

- Nenhuma pendencia deliberada restante para CSP/FS amplo nesta fase. O LAN sync HTTP usa comandos Rust (`lan_http_request`/`lan_http_get_bytes`) em vez de `fetch` direto do webview, e websocket LAN permanece via WebView apenas para `ws://<hub>/ws`; se o ambiente exigir CSP estrito tambem para websocket dinamico, o proximo passo e mover esse websocket para Rust.

---

## Revisao de qualidade das fases anteriores

> Revisao feita apos as fases 8/9. Estes itens nao bloqueiam o registro do que ja foi validado, mas impedem considerar as fases anteriores como totalmente fechadas do ponto de vista de seguranca/arquitetura.

### Pendencias criticas para correcao posterior

- [x] **Fase 3 — Sessao Rust e autoridade para SQL generico.**
  - `db_query`, `db_execute`, `db_execute_batch` e `db_transaction` chamam `require_valid_session` com `validate_against_db` em todos os caminhos.
  - Bootstrap bypass restrito a `no_users || INSERT OR IGNORE` — verificado em revisao de codigo 2026-06-28.

- [x] **Fase 2 — Chave JS derivada no login alimenta a instancia de sync.**
  - `AuthContext` usa `ensureCryptoLayer()`/`getCryptoLayer()` (singleton de `lazy-sync.ts`), nao mais `new CryptoLayer()`.
  - Verificado em revisao de codigo 2026-06-28.

- [x] **Fase 3 — `load_crypto_key` exige sessao valida.**
  - Comando chama `session.validate_against_db(conn)` (linha 82 de `crypto.rs`) e possui 2 testes Rust.
  - Verificado em revisao de codigo 2026-06-28.

- [ ] **Fase 1 — Validacao final do fallback estatico para deep links ainda pendente no binario.**
  - Correcao aplicada 2026-06-29: deep links dinamicos agora tem rotas estaticas equivalentes por query string e `app/not-found.tsx` redireciona caminhos antigos (`/tasks/:id`, `/modulo/:slug`, etc.) para essas entradas estaticas.
  - Validacao automatizada 2026-06-29: `npm run build` passou; `npm run build:tauri` passou e gerou o binario release `src-tauri/target/release/app`; `out/404.html`, `out/tasks/detalhe.html`, `out/modulo.html`, `out/clientes/detalhe.html`, `out/demandas/detalhe.html` e `out/manifestacoes/detalhe.html` existem.
  - Pendencia: abrir o binario e validar manualmente que o asset loader do WebView entrega `404.html`/`not-found` de forma compativel com o redirecionamento de deep links antigos.
  - Pendencia de ambiente: `bundle.targets` esta em `nsis`; neste host Linux o build gerou binario release, mas nao instalador NSIS. Validar instalador em Windows/CI apropriado.

### Pendencias importantes

- [x] **Fase 5 — Confinamento de filesystem cobre symlink dentro da base.**
  - `confine_relative_path` agora chama `verify_no_symlink_escape`: canonicaliza o alvo existente e verifica `starts_with(base)`; para caminhos novos, canonicaliza o parent.
  - Implementado em `lan_paths.rs` em 2026-06-28.

- [x] **Fase 6 — Sync externo nao cria mais usuario `system` admin em runtime.**
  - `INSERT OR IGNORE INTO usuarios` removido de `sync_roteiros.rs` e `sync_pesagens.rs`.
  - `log_audit` e `criado_por` passam a usar o `user_id`/`perfil` da sessao autenticada.
  - Implementado em 2026-06-28.

- [x] **Fase 4 — Comandos locais do LAN server exigem sessao.**
  - `lan_server_start`, `lan_server_auth_token` e `lan_server_set_role` agora recebem `DbState` + `SessionState` e chamam `validate_against_db`.
  - Implementado em `lan_server/commands.rs` em 2026-06-28.

- [x] **Fase 6 — Criterio do plano sobre `pg_password` foi refinado.**
  - Comandos de sync nao recebem mais senha do frontend.
  - O fluxo de cadastro/rotacao continua usando `pg_legacy_config_save` para entregar a credencial uma unica vez ao backend.
  - Correcao aplicada 2026-06-29: senha PostgreSQL passou a ser salva em `pg_legacy_password_encrypted_v2`, criptografada com chave local do backend (`.ecoforms-pg-legacy.key`) em vez da chave derivada do usuario logado; blobs antigos sao migrados best-effort quando a chave do usuario ainda esta carregada.

- [x] **Bootstrap residual ainda existe apenas para DDL tecnico e alguns seeds nao sensiveis.**
  - Evidencia: o bypass amplo foi removido; seeds RBAC (`perfis`, `hierarquia_perfis`, `permissoes`) sairam do SQL generico e agora passam por `bootstrap_seed_rbac` em Rust.
  - Correcao aplicada 2026-06-28: `db_query` em bootstrap ficou restrito a metadata/schema; first-run usa comandos dedicados (`bootstrap_set_lan_sync_path`, `bootstrap_import_seed_users`); leituras de dados e mutacoes arbitrarias sem sessao foram bloqueadas.
  - Decisao 2026-06-30: manter o bootstrap generico restrito para DDL/metadata e seeds idempotentes nao sensiveis enquanto `ensure-columns.ts` for a fonte de verdade do schema. Fluxos sensiveis seguem em comandos Rust dedicados (`bootstrap_seed_rbac`, `bootstrap_set_lan_sync_path`, `bootstrap_import_seed_users`).
  - Correcao 2026-06-30: IDs persistidos gerados no bootstrap Rust (`bootstrap_import_seed_users`, `create_first_admin` e seed admin dev-only) passaram de `rand::<u128>()` para UUID v7 via `uuid_v7::uuid_v7_string()`.

### Pontos positivos preservados

- [x] `set_session` nao esta no invoke handler publico; `db_login` valida senha em Rust e cria a sessao.
- [x] `CryptoLayer` nao persiste mais `org_crypto_key`; ha limpeza best-effort do store legado.
- [x] HTTP LAN e websocket passaram a exigir token compartilhado e origem restrita no servidor LAN.
- [x] `fs:default` e permissoes diretas `fs:*` foram removidas das capabilities; filesystem comum passa por comandos Rust confinados.
- [x] Boundaries de `src/application` nao apresentam imports diretos de `src/infrastructure` em codigo runtime.
- [x] `lan_server_start`, `lan_server_auth_token` e `lan_server_set_role` exigem sessao Rust valida (2026-06-28).
- [x] `sync_roteiros`, `sync_pesagens`, `sync_residuos` auditam com o ator real da sessao; sem seed de usuario `system` admin (2026-06-28).
- [x] `lan_paths::confine_relative_path` verifica escape via symlink apos join (2026-06-28).
- [x] `db_execute`/`db_execute_batch`/`db_transaction` bloqueiam mutacao em `usuarios` independente do flag bootstrap (2026-06-28).
- [x] `db_login` nao retorna mais dados do usuario em senha invalida; migracao de hash legacy e criacao/leitura de `sal_sync` do proprio usuario passaram para comandos Rust dedicados (2026-06-29).
- [x] `TauriSqliteAdapter` passou a serializar callbacks transacionais por fila estatica compartilhada entre instancias, com teste cobrindo concorrencia multi-instancia (2026-06-29).
- [x] `shell:allow-open` removido das capabilities; WhatsApp passa por comando Rust restrito `open_whatsapp_url` (2026-06-29).
- [x] `fs:allow-write-text-file` removido; export CSV/XLSX passa por comando Rust `write_export_file` e capability `default` ficou restrita à janela `main` (2026-06-29).
- [x] Anexos de manifestação passam por comando Rust `copy_attachment_to_appdata`, removendo uso direto de plugin-fs no hook de upload (2026-06-29).
- [x] Import CSV de clientes passa por comando Rust `read_csv_text_file`, removendo `readTextFile` direto do componente (2026-06-29).
- [x] Download de export mobile passa por comando Rust `db_read_mobile_export`, removendo `readFile`/`lan_read_file` direto da tela e confinando a leitura ao arquivo exportado (2026-06-29).


### Correcoes adicionais aplicadas em 2026-06-30

- [x] Helper Rust `uuid_v7::uuid_v7_string()` criado e testado.
- [x] IDs persistidos que ainda usavam `rand::<u128>()`, `Date.now()`/`Math.random()` ou UUID v4 foram migrados para UUID v7 nos fluxos de anexos de tarefas, camadas geo, fallback de importacao de terrenos, bootstrap de usuarios/admin, auditoria, acao de remocao de ecoponto, sync externo de roteiros/residuos/pesagens, upload de anexos LAN e escrow de salt.
- [x] Auditorias de codigo morto, nomenclatura SQL e UUID v7 documentadas em `desktop/AUDITORIA_CODIGO_MORTO.md`, `desktop/AUDITORIA_NOMENCLATURA_TABELAS.md` e `desktop/AUDITORIA_UUID_V7.md`.
- [x] ADR-062 documenta PocketBase como hub local iniciado pelo Windows, mantendo SQLite offline-first.
- [x] ADR-063 documenta a fronteira entre backend local embutido e backends externos.
- [x] Plano operacional `desktop/docs/PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md` criado para consolidar nomenclatura SQL lusofona, reduzir adapters chamados pela UI, classificar integracoes externas legadas e transformar auditorias em fases.
- [x] Fase A ganhou automacao via `npm run audit:architecture`, com relatorio em `desktop/docs/AUDITORIA_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md` e linha de base inicial de 237 imports de infraestrutura na UI/interface e 193 referencias SQL fora da convencao.
- [x] Fase C teve os primeiros fluxos sensiveis encapsulados: `useSupabaseAdmin` agora busca `profiles` via backend Rust, `FirstRunSetupModal` migrou para `useFirstRunSetup`, `GalleryGrid` migrou para `useGalleryStorage` e `useKanbanMutations` migrou patches para `useTaskPatchStorage`.
- [x] Fase C fechou o sublote de query packs: `src/interface/**` deixou de importar `src/infrastructure/persistence/sqlite/queries/**` diretamente, os catalogos usados pela interface foram promovidos para `src/application/persistence/sqlite/queries` e o residual da auditoria ficou concentrado em pontes de `container`, Supabase e helpers legados (111 imports de infraestrutura no total, 0 desvios SQL).
- [x] Fase C aplicou o lote de reducao do residual de `container` e adapters de suporte: hooks simples migraram para `useSqlite`/`useTauriQuery`/use cases, os imports remanescentes de `@/src/infrastructure/container` foram concentrados em `useContainer.ts`, `AccessFilterBuilder` e `supabaseClient` ficaram encapsulados em utilitarios da interface, e a auditoria caiu de 111 para 15 imports de infraestrutura na UI, mantendo 0 desvios SQL.
- [x] Fase C foi efetivamente fechada: `ActionBar` e `app/admin/settings/page.tsx` deixaram de importar infraestrutura direta, as pontes finais foram catalogadas em `src/interface/gateways` e `node scripts/audit-architecture-boundaries.js` voltou para **0 imports de infraestrutura na UI** e **0 desvios SQL**, com `npx tsc --noEmit` e `npm run lint` passando em **0 erros / 147 warnings**.
- [x] Fase D foi formalizada em runtime e documentacao: [ExternalIntegrationsCatalog.ts](/root/ecopontos.github.io/ecoforms/desktop/src/application/config/ExternalIntegrationsCatalog.ts:1) virou a fonte de verdade das integracoes externas/legadas, [REGISTRO_INTEGRACOES_EXTERNAS.md](/root/ecopontos.github.io/ecoforms/desktop/docs/REGISTRO_INTEGRACOES_EXTERNAS.md:1) consolidou finalidade/credencial/fallback/dono tecnico, e `postgres_legacy_sync` passou a estar marcado como `deprecated` com plano de retirada.
- [~] Fase E avancou em quatro lotes de limpeza: [EPICOS_LIMPEZA_FASE_E.md](/root/ecopontos.github.io/ecoforms/desktop/docs/EPICOS_LIMPEZA_FASE_E.md:1) consolidou os epicos, vinte arquivos mortos/órfãos foram removidos, `@tauri-apps/plugin-shell`, `@types/bcryptjs` e `@types/proj4` sairam do frontend desktop sem regressao em `tsc`/`lint`, e o baseline de lint caiu para **146 warnings**.
- [x] Fase B teve o primeiro lote de rename aplicado: `sync_salt_history -> historico_sal_sync` e `geo_layers -> camadas_geo`, com compatibilidade idempotente no bootstrap/migrate-ptbr e queda da auditoria SQL de 193 para 173 ocorrencias.
- [x] Fase B teve o segundo lote aplicado no modulo de agendamentos: `tbl_service_types -> tipos_servico`, `tbl_service_slots -> janelas_agendamento`, `tbl_agendamentos -> agendamentos` e `tbl_agendamento_notificacoes -> notificacoes_agendamento`, com compatibilidade idempotente no bootstrap/migrate-ptbr e queda da auditoria SQL de 173 para 67 ocorrencias.
- [x] Fase B teve o terceiro lote aplicado em configuracoes: `tbl_configuracoes_sistema -> configuracoes_sistema`, `tbl_email_config -> configuracao_email` e eliminacao do desvio `app_config` no runtime, com queda da auditoria SQL de 67 para 24 ocorrencias.
- [x] Fase B recebeu ajustes complementares no mesmo dia: `geo_layers.ts -> camadas_geo.ts` e `suite_fts -> pacotes_fts`, reduzindo a auditoria SQL de 24 para 20 ocorrencias, todas concentradas em compatibilidade de transicao.

## Plano de reorganizacao arquitetural pos-ADR-063

> Este bloco acompanha `desktop/docs/PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md`. Ele nao substitui o plano detalhado; serve como checklist executivo dentro da revisao geral.

- [x] **Fase A — Inventario executavel.** Medir imports diretos de `src/infrastructure/**` na UI/interface e tabelas nao lusofonas em bootstrap, queries, Rust e migrations.
- [x] **Fase B — Schema SQL lusofono.** Concluida sem camada de compatibilidade retroativa, convergindo os modulos priorizados para nomes canonicos em portugues.
- [x] **Fase C — UI sem adapter direto.** Concluida no boundary atual: app/componentes e hooks da interface nao importam `src/infrastructure/**` diretamente; bridges internos ficaram catalogados em `src/interface/gateways` e excecoes temporarias seguem auditadas.
- [x] **Fase D — Integracoes externas classificadas.** Concluida com catalogo runtime e registro documental cobrindo PostgreSQL legado, Supabase, PocketBase, APIs publicas, pasta LAN e LAN server.
- [~] **Fase E — Auditorias viram epicos.** Backlog consolidado e limpo no plano logico; resta a validacao real fora do ambiente local.

## Gate final de validacao

Rodar da pasta `ecoforms/desktop` salvo quando indicado:

```bash
npx tsc --noEmit
npm run lint
npm test
node scripts/audit-db-consistency.js
npm run build
```

Rodar de `ecoforms/desktop/src-tauri`:

```bash
cargo check
cargo test --lib
```

Quando o ambiente tiver toolchain Tauri completo:

```bash
npm run build:tauri
```

### Criterios finais

- [x] Gate automatizado disponivel passou: `npx tsc --noEmit`, `npm run lint`, `npm test`, `node scripts/audit-db-consistency.js`, `npm run build`, `cargo check` e `cargo test --lib`.
- [x] Validacao adicional 2026-06-29: `cargo test --lib` passou (69 testes), `npx tsc --noEmit` passou, Vitest focado de `tauriSqliteAdapter.test.ts` passou, ESLint focado nos arquivos TS alterados passou, `node scripts/audit-db-consistency.js` passou, `npm run build` passou e `npm run build:tauri` gerou `src-tauri/target/release/app`.
- [x] Validacao hardening 2026-06-29: `cargo check` passou, `npx tsc --noEmit` passou, ESLint focado dos arquivos alterados passou sem erros, e grep confirmou ausencia de `shell:allow-open`, `@tauri-apps/plugin-shell`, `writeTextFile`, `fs:allow-write-text-file`, `@tauri-apps/plugin-fs` em `package.json`/`package-lock.json` e `tauri_plugin_fs::init()` no bootstrap Rust. Export CSV/XLSX validado por typecheck/lint/Rust via `write_export_file`; hook de anexos validado por typecheck/lint e Rust via `copy_attachment_to_appdata`; import CSV validado por typecheck/lint e Rust via `read_csv_text_file`; download de export mobile validado por typecheck/lint e Rust via `db_read_mobile_export`.
- [ ] `npm run build:tauri` produz instalador/binario funcional. Binario release validado em Linux; instalador NSIS pendente em Windows/CI apropriado.
- [ ] Login, logout, cold start, export mobile, sync externo, LAN hub/spoke e rotas dinamicas foram testados manualmente.
- [x] Documentacao (`README.md`, `CLAUDE.md`, ADRs relevantes) reflete o comportamento real para as correcoes aplicadas nesta rodada. Atualizado em 2026-06-30 com static export, bootstrap restrito, UUID v7 e PocketBase hub opcional.
