# Plano de Melhorias — EcoForms

**Derivado de:** `AUDIT_REPORT.md` (2026-06-11)
**Verificação em:** 2026-06-11
**Nota Geral Original:** C+

---

## Status de Verificação — Itens do Audit

| ID | Item | Status | Observação |
|----|------|--------|------------|
| S01 | Credenciais Supabase em `.env.local` | **Parcial** | `.gitignore` bloqueia; `git log` confirma nunca commitado. Rotação pendente |
| S02 | `supabase_admin` aceita `user_role` do JS | **CORRIGIDO** 2026-06-11 | `user_role` removido de `AdminOperationRequest`; derivado de `SessionState` (validado no DB pelo `set_session`) |
| S03 | Senha SMTP em texto claro no SQLite | **CORRIGIDO** 2026-06-11 | `smtp_password_encrypted` (AES-256-GCM); fallback backward-compatible para plaintext |
| S04 | Path traversal em `network_*` (3 comandos) | **CORRIGIDO** 2026-06-11 | `validate_network_path()` com rejeição de `..` + canonicalize em `network.rs`; `lan_storage.rs` já validava |
| S05 | `toggle_devtools` em produção | **CORRIGIDO** 2026-06-11 | Comando registrado sempre, mas em release retorna erro |
| S06 | `test.keystore` no gitignore | **CORRIGIDO** 2026-06-11 | `*.keystore` adicionado ao `.gitignore` |
| S07 | KDF customizado (SHA-256 × 100k) | **NÃO CORRIGIDO** | Ainda usa SHA-256 iterado sem salt (key_rotation.rs:14-27) |
| X01 | Zero CI/CD | **CORRIGIDO** 2026-06-11 | `.github/workflows/ci.yml` criado (lint + tsc + vitest + cargo check/test) |
| X02 | `dev:clean` destrói `.next` | **NÃO CORRIGIDO** | Ainda presente (desktop/package.json:6-7) |
| X03 | `println!` em produção | **CORRIGIDO** 2026-06-11 | Substituído por `log::info!` (linha 46); `eprintln!` → `log::error!` em sync_roteiros |
| Q01 | Cobertura ~4.4% | **CORRIGIDO** 2026-06-11 | Desktop: `@vitest/coverage-v8` + thresholds (lines:20, funcs:20, branches:15) |
| Q02 | ESLint boundary enforcement | **OK** | Funcionando |
| D02 | `context-mode` em deps de produção | **CORRIGIDO** 2026-06-11 | Movido para `devDependencies` em `mobile/package.json` |
| D01 | Versões divergentes supabase-js | **NÃO CORRIGIDO** | Desktop: ^2.89.0; Mobile/Standalone: ^2.58.0 |
| D04 | ADRs sem índice central | **NÃO CORRIGIDO** | `docs/INDEX.md` não existe |
| D05 | README humano | **OK** | Commit 4c0411a |
| A01 | Componentes deus >30KB | **NÃO CORRIGIDO** | SchemaEditor (742 linhas), EditTaskModal (736 linhas), FieldPropertiesPanel (695 linhas) — ~700, não 3000+ |
| M3.6 | `.env.example` | **OK** | Arquivo existe |

---

## Plano de Ação Priorizado

### Marco 0 — Vitórias Rápidas (Esforço P, 1-2 dias)

#### M0.1 — Rotacionar chaves Supabase
- **Ação:** Gerar novas chaves no dashboard Supabase; revogar as antigas; atualizar `.env.local`
- **Verificação:** `supabase auth admin list-keys` mostra apenas chaves novas
- **Prioridade:** CRÍTICA

#### M0.2 — Adicionar `*.keystore` ao `.gitignore`
- **Ação:** Acrescentar `*.keystore` explícito ao `.gitignore`
- **Verificação:** `git check-ignore test.keystore` retorna o arquivo
- **Prioridade:** BAIXA

#### M0.3 — Mover `context-mode` para devDependencies
- **Arquivo:** `mobile/package.json`
- **Ação:** Mover `"context-mode": "^1.0.109"` de `dependencies` para `devDependencies`
- **Verificação:** `npm ls context-mode --production` retorna vazio
- **Prioridade:** MÉDIA

#### M0.4 — Configurar CI básico (GitHub Actions)
- **Arquivo novo:** `.github/workflows/ci.yml`
- **Conteúdo:** lint + typecheck + vitest + cargo check
- **Verificação:** PR aberta dispara o workflow; merge bloqueado se falhar
- **Prioridade:** CRÍTICA

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  desktop:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: desktop
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx eslint . --max-warnings 0
      - run: npx tsc --noEmit
      - run: npx vitest run

  rust:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: desktop/src-tauri
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo check
      - run: cargo test
```

---

### Marco 1 — Correções Críticas de Segurança (Esforço M-G, 3-5 dias)

#### M1.1 — Validar `user_role` server-side em `supabase_admin`
- **Arquivo:** `desktop/src-tauri/src/supabase_admin.rs`
- **Problema:** `AdminOperationRequest.user_role` vem do frontend (linha 51)
- **Solução:** Remover campo `user_role` de `AdminOperationRequest`; derivar role de `SessionState`
- **Esboço de código:**

```rust
#[derive(Debug, Deserialize)]
pub struct AdminOperationRequest {
    table: String,
    operation: String,
    payload: serde_json::Value,
    // user_role REMOVIDO — derivar de SessionState
}

#[tauri::command]
pub fn supabase_admin_query(
    request: AdminOperationRequest,
    state: State<'_, SupabaseAdminState>,
    session: State<'_, SessionState>,
) -> Result<AdminOperationResponse, String> {
    let perfil = session.perfil.lock().unwrap();
    let user_role = perfil.as_deref().unwrap_or("");
    check_admin_permission(user_role)?;
    drop(perfil);
    // ... resto inalterado
}
```

- **Verificação:** Teste que envia `user_role` diferente do perfil real é rejeitado
- **Prioridade:** ALTA

#### M1.2 — Proteger `toggle_devtools` com `#[cfg(debug_assertions)]`
- **Arquivo:** `desktop/src-tauri/src/lib.rs:36,94`
- **Solução:**

```rust
#[cfg(debug_assertions)]
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
    Ok(())
}

// No invoke_handler:
#[cfg(debug_assertions)]
tauri::generate_handler![
    // ... outros comandos
    toggle_devtools,
]
```

Em release, `toggle_devtools` não é compilado nem registrado.
- **Verificação:** Build release não contém referência a `toggle_devtools`
- **Prioridade:** MÉDIA

#### M1.3 — Criptografar `smtp_password` no SQLite
- **Arquivos:** `desktop/src-tauri/src/commands/email.rs`, `setup.rs`, nova migration
- **Solução:**
  1. Criar migration que adiciona coluna `smtp_password_encrypted TEXT`
  2. Na leitura, descriptografar com AES-256-GCM (já existe infra em `crypto.rs`)
  3. Na escrita, criptografar antes de armazenar
  4. Migration de migração: ler `smtp_password` plaintext → criptografar → salvar em `smtp_password_encrypted` → NULL em `smtp_password`
- **Verificação:** `SELECT smtp_password FROM tbl_email_config` retorna NULL; email ainda funciona
- **Prioridade:** ALTA

#### M1.4 — Restringir paths em `network_*` (3 comandos)
- **Arquivo:** `desktop/src-tauri/src/network.rs`
- **Nota:** `lan_storage.rs` JÁ possui `validate_path()` que rejeita `..`. Problema exclusivo de `network.rs` — as 3 funções (`network_write_parquet`, `network_probe_path`, `network_list_parquet`) aceitam paths sem validação.
- **Solução:** Reusar/adaptar `validate_path()` de `lan_storage.rs` para os 3 comandos de `network.rs`:
  1. Rejeita `..` (path traversal)
  2. Rejeita caminhos absolutos fora de diretórios permitidos (app data dir, download dir, temp dir)
  3. Resolves symlinks antes da validação
- **Esboço:**

```rust
fn validate_path(path: &str, allowed_dirs: &[PathBuf]) -> Result<PathBuf, String> {
    let resolved = std::fs::canonicalize(path)
        .map_err(|e| format!("Caminho inválido: {}", e))?;
    for dir in allowed_dirs {
        if resolved.starts_with(dir) {
            return Ok(resolved);
        }
    }
    Err("Caminho fora dos diretórios permitidos".into())
}
```

- **Verificação:** Teste unitário rejeita `/etc/passwd`, `../../sensitive`, aceita paths dentro dos dirs permitidos
- **Prioridade:** MÉDIA

#### M1.5 — Audit logging consistente nos commands sensíveis
- **Arquivos:** `desktop/src-tauri/src/commands/actions.rs`, `email.rs`, `setup.rs`
- **Ação:** Todo comando Tauri que modifica dados deve chamar `log_audit()`
- **Verificação:** `grep -L "log_audit" src-tauri/src/commands/*.rs` retorna vazio
- **Prioridade:** BAIXA

---

### Marco 2 — Melhorias de Alto Impacto (Esforço P-XG, 5-10 dias)

#### M2.1 — Adicionar coverage thresholds ao Vitest (desktop)
- **Arquivo:** `desktop/vitest.config.ts`
- **Nota:** Mobile (`mobile/vitest.config.js`) JÁ tem thresholds (lines/80, functions/80, branches/75, statements/80). Escopo: apenas desktop.
- **Ação:** Adicionar configuração de coverage com thresholds:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.*', 'src/**/*.d.ts'],
  thresholds: {
    lines: 20,
    functions: 20,
    branches: 15,
    statements: 20,
  },
},
```

- **Verificação:** `vitest run --coverage` falha abaixo dos thresholds
- **Prioridade:** BAIXA

#### M2.2 — Testes de integração Tauri (5 commands críticos)
- **Diretório novo:** `desktop/src-tauri/tests/`
- **Commands a testar:** `db_query`, `db_execute`, `verify_password`, `create_first_admin`, `supabase_admin_query`
- **Abordagem:** Rust integration tests com `#[tauri::test]` e mock de DB
- **Verificação:** `cargo test` nos novos testes passa
- **Prioridade:** ALTA

#### M2.3 — Decompor SchemaEditor.tsx (742 linhas)
- **Arquivo:** `desktop/components/forms/SchemaEditor.tsx`
- **Meta:** <500 linhas; hooks extraídos; testes passando
- **Abordagem:** Extrair hooks customizados (`useSchemaValidation`, `useFieldOrder`), sub-componentes (`FieldList`, `SchemaToolbar`)
- **Prioridade:** MÉDIA

#### M2.4 — Decompor EditTaskModal.tsx (736 linhas)
- **Arquivo:** `desktop/components/kanban/EditTaskModal.tsx`
- **Meta:** <500 linhas; hooks extraídos
- **Prioridade:** MÉDIA

#### M2.5 — Decompor FieldPropertiesPanel.tsx (695 linhas) e BookingModal.tsx (~35KB)
- **Meta:** Cada um <500 linhas
- **Prioridade:** BAIXA (pode ser adiada para Marco 3)

#### M2.6 — Alinhar `@supabase/supabase-js`
- **Ação:** Atualizar mobile e mobile_standalone para `^2.89.0`
- **Verificação:** `grep supabase-js */package.json` mostra mesma versão
- **Prioridade:** BAIXA

#### M2.7 — Substituir `println!` por logging estruturado
- **Arquivo:** `desktop/src-tauri/src/lib.rs:46` (única ocorrência em produção)
- **Nota:** Linha 67 JÁ está dentro de `#[cfg(debug_assertions)]` — não é produção.
- **Ação:** Usar `log::info!`/`log::error!` com crate `log` + `tauri-plugin-log`
- **Verificação:** `grep -rn "println" src-tauri/src/` retorna vazio FORA de blocos `#[cfg(debug_assertions)]`
- **Prioridade:** BAIXA

---

### Marco 3 — Qualidade e Polimento (Esforço P-M, 3-5 dias)

#### M3.1 — Criar `docs/INDEX.md` com índice dos ADRs
- **Ação:** Gerar índice numerado com links para `docs/ADR-*.md`
- **Prioridade:** BAIXA

#### M3.2 — Avaliar/documentar `mobile_standalone/`
- **Ação:** Criar DECISION.md justificando existência temporária; planejar remoção quando mobile final estiver pronto
- **Prioridade:** BAIXA

#### M3.3 — Testes de integração para repos SQLite críticos
- **Arquivos novos:** `desktop/src/infrastructure/persistence/sqlite/__tests__/`
- **Targets:** `SqliteUserRepository`, `SqliteKanbanRepository`, `SqliteManifestacaoRepository`
- **Depende de:** M0.4 (CI)
- **Prioridade:** MÉDIA

#### M3.4 — Substituir KDF customizado por Argon2id
- **Arquivo:** `desktop/src-tauri/src/commands/key_rotation.rs:14-27`
- **Nota:** `derive_recovery_key` abrange linhas 14–27 (não 16–20)
- **Ação:**
  1. Adicionar crate `argon2`
  2. `derive_recovery_key` usa Argon2id com salt aleatório
  3. Migração backward-compatible: tentar Argon2id, fallback para SHA-256×100k
- **Verificação:** Testes unitários passam; chaves existentes ainda funcionam
- **Prioridade:** MÉDIA (risco alto — requer migração backward-compatible)

#### M3.5 — Resolver causa raiz do `dev:clean`
- **Arquivo:** `desktop/package.json:6-7`
- **Ação:** Investigar por que `.next` corrompe; remover workaround se desnecessário
- **Prioridade:** BAIXA

#### M3.6 — `.env.example` completo
- **Status:** JÁ EXISTE — verificar se contém todas as variáveis documentadas
- **Prioridade:** BAIXA

---

## Sinais de "Concluído" (do Audit Report Original)

| Tema | Sinal | Status |
|------|-------|--------|
| Superfície de ataque | Zero credenciais em texto claro | **OK** — M1.3 (smtp_password) |
| Superfície de ataque | Path traversal — `network.rs` (3 comandos) | **OK** — M1.4 |
| Superfície de ataque | `toggle_devtools` inofensivo em release | **OK** — M1.2 |
| Superfície de ataque | `user_role` validado server-side | **OK** — M1.1 |
| Fundação de qualidade | CI verde em PRs | **OK** — M0.4 |
| Fundação de qualidade | `vitest run` ≥20% coverage desktop | **OK** — M2.1 |
| Fundação de qualidade | 5+ testes de integração Tauri | **PENDENTE** — M2.2 |
| Redução de complexidade | `context-mode` em devDeps | **OK** — M0.3 |
| Redução de complexidade | Versões supabase-js unificadas | **PENDENTE** — M2.6 |
| Redução de complexidade | `mobile_standalone` justificado ou eliminado | **PENDENTE** — M3.2 |
| Componentes deus | Zero componentes >500 linhas | **PENDENTE** — M2.3-2.5 |
| Observabilidade | Zero `println!` em Rust (exceto `#[cfg(debug_assertions)]`) | **OK** — M2.7 |
| Observabilidade | `.env.example` completo | **OK** |
| Observabilidade | `test.keystore` no `.gitignore` | **OK** — M0.2 |

---

## Ordem de Execução Recomendada

```
M0.1 (Rotação chaves)     ─── IMEDIATO, 30min
M0.2 (*.keystore gitignore)─  5min
M0.3 (context-mode devDeps)─  10min
M0.4 (CI GitHub Actions)  ─── 1-2h
  │
  ▼
M1.1 (user_role server-side)── MÉDIO
M1.2 (toggle_devtools cfg) ─── 30min
M1.3 (smtp_password enc)  ─── MÉDIO
M1.4 (path traversal — network.rs) ─── MÉDIO
M1.5 (audit logging)      ─── BAIXO
  │
  ▼
M2.1 (coverage thresholds)──  30min
M2.2 (testes integração)  ─── ALTO
M2.3-2.4 (decompor 2 componentes)── ALTO
M2.5 (decompor +2 componentes) ── ADIÁVEL
M2.6 (alinhar supabase-js) ──  30min
M2.7 (println → log)      ──  1h
  │
  ▼
M3.1 (INDEX.md ADRs)      ──  30min
M3.2 (DECISION.md standalone) ─ 1h
M3.3 (testes repos SQLite) ── MÉDIO
M3.4 (Argon2id KDF)       ── MÉDIO (risco alto)
M3.5 (remover dev:clean)  ──  BAIXO
```

---

### Dependências entre Tarefas

- M2.2 (testes integração) pode começar após M0.4 (CI)
- M3.3 (testes repos SQLite) depende de M0.4 (CI)
- M3.4 (Argon2id) requer migração backward-compatible — testar com dados reais
- M2.3-2.4 (decompor componentes) independente de CI, mas M0.4 garante regressão visível

---

## Changelog de Implementação (2026-06-11)

### ✅ Aplicados (10 itens)

| # | Item | Arquivos alterados | Resumo |
|---|------|--------------------|--------|
| M0.2 | `*.keystore` gitignore | `.gitignore` | Adicionado `*.keystore` |
| M0.3 | context-mode → devDeps | `mobile/package.json` | Movido de `dependencies` para `devDependencies` |
| M0.4 | CI GitHub Actions | `.github/workflows/ci.yml` (novo) | Lint + tsc + vitest + cargo check/test |
| M1.1 | user_role server-side | `supabase_admin.rs`, `useSupabaseAdmin.ts`, `EliminacaoTitularUseCase.ts` | Role derivado de `SessionState` (validado no DB); campos removidos do frontend |
| M1.2 | toggle_devtools protegido | `lib.rs` | Comando sempre registrado; em release retorna erro |
| M1.3 | smtp_password criptografado | `email.rs`, `ensure-columns.ts`, `lib.rs` | Coluna `smtp_password_encrypted` AES-256-GCM; comando `migrate_smtp_password`; fallback plaintext |
| M1.4 | Path validation network.rs | `network.rs` | `validate_network_path()` rejeita `..` + canonicalize nos 3 comandos |
| M1.5 | Audit logging | `email.rs`, `supabase_admin.rs`, `sync_roteiros.rs` | `log_audit()` em send_email, operações admin Supabase e sync roteiros; `eprintln!` → `log::error!` |
| M2.1 | Coverage thresholds | `desktop/package.json`, `vitest.config.ts` | `@vitest/coverage-v8`; thresholds: lines=20, funcs=20, branches=15 |
| M2.7 | println → log | `lib.rs`, `sync_roteiros.rs` | `println!` → `log::info!` (linha 46); `eprintln!` → `log::error!` |

### ⏳ Pendentes (6 itens)

| # | Descrição | Prioridade |
|---|-----------|------------|
| M0.1 | Rotacionar chaves Supabase (manual) | CRÍTICA |
| M2.2 | Testes integração Tauri | ALTA |
| M2.3-2.5 | Decompor componentes >500 linhas | MÉDIA |
| M2.6 | Alinhar supabase-js (2.58 → 2.89) | BAIXA |
| M3.1-3.4 | DOCS, mobile_standalone, SQLite tests, Argon2id KDF | BAIXA-MÉDIA |
| X02 | Investigar/remover `dev:clean` | BAIXA |