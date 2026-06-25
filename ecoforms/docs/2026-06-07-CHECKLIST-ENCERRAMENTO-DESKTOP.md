# EcoSuite Desktop - Checklist de Encerramento

> Tauri Desktop | Auditoria estatica atualizada em **2026-06-14**
>
> Versao declarada: `0.1.8` (`desktop/package.json` e `desktop/src-tauri/tauri.conf.json`)
>
> Estado atual: **NAO PRONTO PARA BUILD DE RELEASE**

## Legenda

- `[x]` verificado no codigo/configuracao atual
- `[~]` parcial, possui ressalva ou evidencia antiga
- `[ ]` pendente, quebrado ou nao comprovado
- `RUNTIME` exige execucao do app/instalador

## Resumo Executivo

O app possui cobertura funcional ampla, CentralCrypto implementado, guards SQL no Rust e
artefatos antigos de export/build. Entretanto, o encerramento esta bloqueado por regressao
da configuracao de export estatico, dependencias frontend indisponiveis no ambiente atual,
bugs criticos no backend de sincronizacao e ausencia de validacao de release reproduzivel.

### Bases do repositorio

| Base | Tecnologia | Proposito | Estado atual |
|---|---|---|---|
| `mobile/` | JavaScript puro + Capacitor + SQLite | App de campo para inspetores em ecopontos | Ativo, funcional e offline-first |
| `desktop/` | TypeScript + Next.js + Tauri + SQLite | App de escritorio para gestao e administracao | Ativo e funcional; validacao de release pendente |
| `src/` | TypeScript | Tentativa incompleta de backend unificado/extraido | Orfao; nao e importado pelo app ativo e nao compila isoladamente |
| `packages/core/` | TypeScript compartilhado | Tipos e logica comuns entre mobile e desktop | Ativo parcialmente; consolidacao incompleta |

A intencao original era transformar `src/` no backend compartilhado. Essa migracao nao foi
concluida. O compartilhamento real ocorre parcialmente por `packages/core/`, enquanto
`mobile/` e `desktop/` ainda mantem implementacoes proprias e divergentes.

Consequencias para este checklist:

- o encerramento do desktop deve validar o codigo em `desktop/`, nao o `src/` orfao;
- codigo util existente em `src/` deve ser tratado como referencia para migracao, nao como implementacao canonica pronta;
- divergencias entre `desktop/`, `mobile/` e `packages/core/` continuam sendo risco de protocolo;
- falhas exclusivas de `src/` nao bloqueiam o runtime atual, mas impedem considera-lo uma base compartilhada funcional.

### Bloqueadores atuais

| Severidade | Bloqueador | Evidencia atual |
|---|---|---|
| CRITICAL | Build Tauri aponta para `../out`, mas Next nao esta configurado para export estatico | `next.config.ts` nao possui `output: 'export'` e voltou a declarar `redirects()` |
| CRITICAL | Build nao possui comando frontend automatico | `tauri.conf.json`: `beforeBuildCommand` vazio |
| CRITICAL | Sync mobile inbound nao aplica eventos | `mobile/www/js/sync/HandlerRegistry.js` usa API IndexedDB; `EventBus.js` entrega adapter SQLite |
| CRITICAL | Evento desktop pode executar SQL por nomes de coluna nao validados | `desktop/src/infrastructure/sync/HandlerRegistry.ts`, handler `manifestacao.criada` |
| HIGH | Handlers desktop usam colunas incompativeis com o schema bootstrap | `registro_dados.setor/criado_por` e `roteiros.tipo_residuo` nao existem em `ensure-columns.ts` |
| HIGH | `SyncOutbox.write()` descarta eventos antes da inicializacao do transport | `desktop/src/infrastructure/sync/SyncOutbox.ts`: `if (!transport) return` |
| HIGH | Checksums mobile/desktop podem divergir | Duas implementacoes de `stableStringify` com tratamento diferente de `undefined` |
| HIGH | Validacao TypeScript nao passa no ambiente atual | `tsc --noEmit` falha por dependencias nao resolvidas (`react`, `next`, `@tauri-apps`, `vitest`, etc.) |
| HIGH | Variaveis de producao nao comprovadas | Apenas `.env.example` foi localizado; `.env.production` nao foi localizado |

---

## 1. Configuracao de Build

- [ ] **Restaurar export estatico do Next**
  - `desktop/next.config.ts` nao possui `output: 'export'`.
  - O arquivo declara `redirects()`, recurso incompativel com export estatico.
  - O status anterior "resolvido" nao corresponde mais ao codigo atual.

- [ ] **Definir `beforeBuildCommand`**
  - `desktop/src-tauri/tauri.conf.json` possui `"beforeBuildCommand": ""`.
  - O build Tauri pode empacotar `desktop/out` antigo sem reconstruir o frontend.

- [~] **Diretorio frontend configurado**
  - `frontendDist: "../out"` esta configurado.
  - `desktop/out` existe, mas e artefato antigo e nao prova que o codigo atual exporta.

- [x] **Identidade do app**
  - `productName`: `EcoSuite Desktop`
  - `version`: `0.1.8`
  - `identifier`: `com.ecoforms.desktop`
  - target: `nsis`

- [ ] **Dimensoes minimas da janela**
  - `width: 1400`, `height: 900`, `center: true` e `resizable: true` existem.
  - `minWidth` e `minHeight` nao existem mais no `tauri.conf.json`.

- [x] **Icones de bundle**
  - Icones PNG, ICO, ICNS e logos Windows Store presentes em `desktop/src-tauri/icons/`.

- [ ] **Auto-updater**
  - ADR-073 documenta a decisao (renumerado de ADR-060 em 2026-06-18 — ver `docs/adr/2026-06-09-ADR-073-auto-updater-tauri.md`).
  - Nenhuma dependencia/configuracao de updater foi localizada no app atual.

---

## 2. Ambiente e Segredos

- [ ] **Criar e validar `.env.production`**
  - Apenas `.env.example` foi localizado na raiz.
  - Validar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` durante o build.

- [x] **Cliente Supabase usa variaveis de ambiente**
  - `desktop/src/infrastructure/persistence/supabase/supabaseClient.ts` le URL e anon key de env.

- [~] **Service role fora do frontend principal**
  - Uso de `SUPABASE_SERVICE_ROLE_KEY` localizado no Rust e em scripts administrativos.
  - Verificar o conteudo final de `out/` antes da distribuicao.

- [ ] **URL do servidor legado externalizada**
  - Regressao: `desktop/app/admin/legacy/page.tsx` voltou a usar
    `const LEGACY_API_BASE = "http://localhost:3005"`.
  - A tela tambem exibe a URL hardcoded.

- [x] **Padroes sensiveis ignorados**
  - `.env`, `*.keystore` e `*.sqlite` constam no `.gitignore`.

- [ ] **Remover banco legado versionado/distribuido**
  - `BD_Flex_v2007.sqlite` continua presente na raiz.
  - O status anterior "removido" estava incorreto.

---

## 3. Seguranca

- [x] **CentralCrypto implementado**
  - Nove arquivos em `desktop/src-tauri/src/crypto/`.
  - Comandos de inicializacao, limpeza, rotacao e revogacao registrados.
  - `ensure_crypto_tables()` executado durante `db_connect`.
  - Logout chama `crypto_clear`.

- [~] **Capabilities Tauri**
  - Escopo de filesystem limitado a `$APPDATA`.
  - `fs:default`, escrita de arquivos e `shell:allow-open` continuam amplos.
  - Revisar menor privilegio antes do release.

- [x] **Guard SQL no Rust**
  - `db_query`, `db_execute` e `db_execute_batch` usam `sql_guard`.
  - `db_query` aceita apenas SELECT; mutacoes possuem verificacoes adicionais.

- [ ] **Validar bypass do guard SQL**
  - Executar testes adversariais contra comentarios, strings, multiplas statements e tabelas protegidas.

- [ ] **Sanitizar colunas no sync inbound**
  - `desktop/src/infrastructure/sync/HandlerRegistry.ts` usa `Object.keys(d)` diretamente no SQL.
  - Aplicar whitelist de colunas para `manifestacao.criada`.

- [ ] **Revisar RLS do `sync-bucket`**
  - Validar isolamento entre organizacoes e remover acesso anonimo desnecessario.

- [ ] **Assinatura de codigo**
  - Definir certificado para o instalador NSIS ou aceitar formalmente o alerta SmartScreen.

---

## 4. Dados e Sincronizacao

- [ ] **Corrigir handlers mobile inbound**
  - Handlers usam transacoes IndexedDB, mas recebem `CapacitorSqliteAdapter`.
  - Fluxo inbound mobile nao deve ser aprovado antes de teste de integracao real.

- [ ] **Unificar `EventEnvelope` e `stableStringify`**
  - Core e desktop mantem implementacoes/tipos divergentes.
  - Testar checksum bit-identico entre mobile e desktop, incluindo `undefined`.
  - Consolidar em `packages/core/`; nao adotar automaticamente a implementacao orfa em `src/`.

- [ ] **Impedir descarte silencioso no SyncOutbox**
  - Eventos sao descartados quando o transport ainda nao foi inicializado.

- [ ] **Corrigir schema drift dos handlers desktop**
  - Handler escreve `registro_dados.setor` e `registro_dados.criado_por`; bootstrap nao cria essas colunas.
  - Handler escreve `roteiros.tipo_residuo`; bootstrap cria `roteiros.tipo_residuo_id`.

- [ ] **Corrigir recovery de gaps**
  - `InboundService` registra gaps, mas nao possui mecanismo efetivo de reparo.

- [ ] **Validar migrations idempotentes**
  - Executar bootstrap duas vezes sobre banco limpo e banco atualizado.

- [ ] **Validar backup/restore**
  - Testar recuperacao de SQLite corrompido e export sem dados sensiveis.

- [~] **Migracao UUIDv7**
  - Desktop usa `uuidv7()` amplamente.
  - Permanecem usos de `crypto.randomUUID()` no mobile.

- [ ] **Definir destino do `src/` orfao**
  - `src/infrastructure/sync/HandlerRegistry.ts` possui zero importers ativos, imports inexistentes e referencia `uuidv7()` sem import.
  - Antes de remover, revisar handlers adicionais que podem precisar ser migrados para `desktop/` ou `packages/core/`.

---

## 5. Funcionalidade e UX

- [x] **Rotas principais presentes**
  - Formularios, demandas, manifestacoes, clientes, tarefas, projetos, logistica,
    agendamentos, remocao, data registry e modulos possuem rotas.

- [x] **Error boundaries**
  - `desktop/components/ErrorBoundary.tsx`
  - `desktop/app/error.tsx`
  - `desktop/app/global-error.tsx`

- [~] **Protecao de rotas**
  - Guards client-side e RBAC em commands Rust existem.
  - Nao ha middleware server-side, coerente com export estatico.
  - Auditar cada rota administrativa para garantir guard local.

- [ ] **Remover logs de desenvolvimento**
  - Permanecem logs em componentes e servicos de producao, incluindo
    `FormRenderer.tsx`, `AuthContext.tsx`, `SyncContext.tsx` e storage/sync.
  - Preservar loggers oficiais e logs de scripts administrativos.

- [ ] **Auditoria visual e de acoes**
  - RUNTIME: revisar estados vazios, loading, toasts, botoes sem acao e navegacao direta.

- [ ] **Login/logout sem estado residual**
  - RUNTIME: validar sessao Supabase, SQLite, CentralCrypto e caches apos logout/restart.

---

## 6. Validacao Automatizada

| Comando | Estado em 2026-06-14 | Observacao |
|---|---|---|
| `tsc --version` | PASS | TypeScript `6.0.3` |
| `tsc --noEmit` em `desktop/` | FAIL | Dependencias frontend nao resolvidas; resultado nao esta limpo |
| `npm run lint` | NAO EXECUTADO | Dependencias frontend indisponiveis no ambiente atual |
| `npm run test --prefix desktop` | NAO EXECUTADO | Dependencias frontend indisponiveis no ambiente atual |
| `cargo test --package app --lib` | NAO EXECUTADO | `cargo` nao esta disponivel no PATH atual |
| `npm run build --prefix desktop` | BLOQUEADO | Configuracao atual nao possui export estatico e dependencias nao estao resolvidas |
| `npm run tauri build` | BLOQUEADO | Build frontend/release ainda nao reproduzivel |

O resultado historico de **43 testes Rust passando** pode ser mantido como evidencia antiga,
mas nao deve ser tratado como validacao do estado atual ate nova execucao.

---

## 7. Testes de Runtime Obrigatorios

- [ ] Instalar o NSIS em maquina Windows limpa, sem Node/Rust.
- [ ] Abrir o app sem servidor Next/dev.
- [ ] Executar primeiro acesso e descartar credencial temporaria.
- [ ] Validar login, logout, restart e ausencia de estado residual.
- [ ] Criar demanda/caso, gerar tarefa, fechar e reabrir o app.
- [ ] Executar sync desktop -> mobile e mobile -> desktop.
- [ ] Simular falha de rede, acumular fila e reconciliar ao voltar online.
- [ ] Testar conflito concorrente e gap de sequencia.
- [ ] Rotacionar master key e validar dados criptografados existentes.
- [ ] Revogar dispositivo e confirmar bloqueio de sync.
- [ ] Validar banco limpo, banco legado e upgrade de schema.

---

## 8. Ordem de Encerramento

1. Restaurar `output: 'export'`, remover `redirects()` e definir `beforeBuildCommand`.
2. Corrigir `LEGACY_API_BASE`, `minWidth/minHeight` e ambiente de producao.
3. Corrigir bugs criticos de sync e schema drift.
4. Instalar/resolver dependencias e obter `tsc`, lint e testes frontend limpos.
5. Executar novamente os testes Rust.
6. Gerar export estatico novo e confirmar ausencia de segredos.
7. Gerar instalador NSIS e executar a matriz de runtime.
8. Assinar/aprovar formalmente o release.

## Criterio de Liberacao

Release permitido somente quando:

- todos os itens CRITICAL e HIGH estiverem resolvidos;
- `tsc`, lint, testes frontend e testes Rust passarem no mesmo commit;
- `out/` for regenerado pelo build atual;
- instalador for validado em maquina limpa;
- sync bidirecional e persistencia apos restart forem comprovados.

## Historico

| Data | Alteracao |
|---|---|
| 2026-06-07 a 2026-06-11 | Auditorias e correcoes iniciais; resultados historicos preservados no repositorio |
| 2026-06-14 | Checklist revalidado contra o app atual; regressoes de build/config, sync e schema incorporadas |
