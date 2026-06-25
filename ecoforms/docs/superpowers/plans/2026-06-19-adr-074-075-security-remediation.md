# ADR-074/075/076 Local Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement the active local security decisions after ADR-076: filesystem confinement, real sessions, backend RBAC, validated LAN ingestion, and checksum wording fixes, while leaving local encryption/HMAC/signatures paused.

**Architecture:** Treat the LAN as a controlled offline boundary: data can stay readable, but every local trust boundary must be enforced by Rust commands and schema/allowlist validation. Do not implement key vault, snapshot decrypt, local HMAC, or device signatures in this plan; those controls move to a future remote/web envelope plan.

**Tech Stack:** Rust, Tauri commands, SQLite/rusqlite, TypeScript, Vitest, existing ecoforms-core sync utilities, zod schemas in ../packages/core.

**Execution note:** Run implementation and verification on a build-capable desktop host. This Android-mounted workspace is suitable for planning edits, but not for the full Cargo/Tauri/TypeScript release gate.

---

## Scope

### Active in this plan

- ADR-074.1 to ADR-074.3: filesystem guard and configured base-dir.
- ADR-075.1 to ADR-075.6: login-issued session, RBAC, sensitive read/email gates, LAN schema/allowlist, checksum wording, sequence SQL bug.
- ADR-076.1 to ADR-076.2: pause local crypto items and keep LAN readable but validated.

### Explicitly paused by ADR-076

- Raw key persistence removal as a standalone local-sync task.
- seal_key / unseal_key / OS vault work.
- LAN snapshot decrypt/verify.
- checksum to HMAC for local sync.
- Ed25519/device signatures for local sync.
- Remote/web encrypted envelope implementation. Create a separate plan from ADR-076.3/076.4 when remote export/sync exists.

## File map

- src-tauri/src/fs_guard.rs: new path confinement helpers for existing read/list paths and writable new files.
- src-tauri/src/commands/lan_storage.rs: LAN commands read the configured LAN base from SQLite and accept only relative paths.
- src-tauri/src/network.rs: network parquet commands stop acting as arbitrary file primitives after configuration.
- src-tauri/src/lib.rs: register fs_guard.
- src-tauri/src/session.rs: session tokens issued by login, not identity accepted from JS.
- src-tauri/src/commands/auth.rs: db_login validates password and creates the Rust session/token.
- contexts/AuthContext.tsx: store/use only login-issued session token; stop calling set_session(userId, perfil); force re-login on cold start instead of resurrecting a session from localStorage.
- app/login/page.tsx: extend LoginResult with token.
- src-tauri/src/database.rs: require session for reads (with a bootstrap hatch for pre-login init reads), block sal_sync, enforce domain write permissions.
- src/application/ports/SqlitePort.ts: add optional `{ bootstrap?: boolean }` to query, mirroring execute.
- src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts: thread bootstrap flag into the db_query invoke.
- src/infrastructure/container.ts: mark pre-login init reads (ensureColumns, migratePtBr, CRM/prazos) as bootstrap reads.
- src-tauri/src/commands/rbac.rs: shared permission helpers for database/email/fs commands.
- src-tauri/src/commands/setup.rs: seed any new backend permissions.
- src-tauri/src/commands/email.rs: require session + permission for email commands.
- src/infrastructure/storage/LanFileStorage.ts: call LAN commands with relative paths only.
- src/infrastructure/sync/LanPullService.ts: validate LAN snapshots and apply explicit allowlists.
- src/infrastructure/sync/UserSnapshotService.ts: stop publishing privileged fields to LAN snapshots.
- src/infrastructure/sync/InboundService.ts: fix checksum wording and manifesto_sync upsert SQL.
- src/infrastructure/storage/__tests__/LanFileStorage.test.ts: LAN file adapter regression tests.
- src/infrastructure/sync/__tests__/lan-pull-service.test.ts: LAN ingestion regression tests.
- src/infrastructure/sync/__tests__/sync-protocol.test.ts: checksum wording and sequence upsert regression tests.
- docs/adr/*: final documentation alignment only.

---

### Task 1: Add Filesystem Guard Helpers

**Files:**
- Create: src-tauri/src/fs_guard.rs
- Modify: src-tauri/src/lib.rs

- [ ] **Step 1: Write the failing Rust guard tests**

Create src-tauri/src/fs_guard.rs with stub functions and tests:

~~~rust
use std::path::{Component, Path, PathBuf};

pub fn resolve_existing_within_base(_base: &Path, _rel_path: &str) -> Result<PathBuf, String> {
    Err("not implemented".to_string())
}

pub fn resolve_writable_within_base(_base: &Path, _rel_path: &str) -> Result<PathBuf, String> {
    Err("not implemented".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_base(name: &str) -> PathBuf {
        let base = std::env::temp_dir().join(format!("ecoforms_fs_guard_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        base
    }

    #[test]
    fn resolve_existing_rejects_escape_attempts() {
        let base = temp_base("existing_escape");
        fs::write(base.join("ok.txt"), b"ok").unwrap();

        assert!(resolve_existing_within_base(&base, "../etc/passwd").is_err());
        assert!(resolve_existing_within_base(&base, "/etc/passwd").is_err());
        assert!(resolve_existing_within_base(&base, "").is_err());
        assert!(resolve_existing_within_base(&base, "ok.txt").is_ok());
    }

    #[test]
    fn resolve_writable_allows_new_file_under_existing_parent() {
        let base = temp_base("writable_new");
        fs::create_dir_all(base.join("domain")).unwrap();

        let resolved = resolve_writable_within_base(&base, "domain/new.json").unwrap();
        assert_eq!(resolved.file_name().unwrap(), "new.json");
        assert!(resolved.starts_with(base.canonicalize().unwrap()));
    }

    #[test]
    fn resolve_writable_rejects_absolute_and_parent_escape() {
        let base = temp_base("writable_escape");
        fs::create_dir_all(base.join("domain")).unwrap();

        assert!(resolve_writable_within_base(&base, "/tmp/outside.json").is_err());
        assert!(resolve_writable_within_base(&base, "domain/../../outside.json").is_err());
    }
}
~~~

- [ ] **Step 2: Run the failing tests**

Run:

~~~bash
cargo test fs_guard
~~~

Expected: fail because both functions return "not implemented".

- [ ] **Step 3: Implement the guard**

Replace the two stub functions in src-tauri/src/fs_guard.rs with:

~~~rust
fn validate_relative_path(rel_path: &str) -> Result<PathBuf, String> {
    if rel_path.trim().is_empty() {
        return Err("Path must not be empty".to_string());
    }

    let rel = PathBuf::from(rel_path);
    if rel.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    for component in rel.components() {
        match component {
            Component::ParentDir => return Err("Path traversal ('..') is not allowed".to_string()),
            Component::Prefix(_) | Component::RootDir => {
                return Err("Absolute path components are not allowed".to_string());
            }
            _ => {}
        }
    }

    Ok(rel)
}

pub fn resolve_existing_within_base(base: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel = validate_relative_path(rel_path)?;
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    let candidate = canonical_base.join(rel);
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;

    if !canonical_candidate.starts_with(&canonical_base) {
        return Err("Path escapes configured base directory".to_string());
    }

    Ok(canonical_candidate)
}

pub fn resolve_writable_within_base(base: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel = validate_relative_path(rel_path)?;
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Invalid base directory: {}", e))?;
    let candidate = canonical_base.join(rel);
    let parent = candidate
        .parent()
        .ok_or_else(|| "Writable path has no parent".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("Invalid parent directory: {}", e))?;

    if !canonical_parent.starts_with(&canonical_base) {
        return Err("Path escapes configured base directory".to_string());
    }

    Ok(candidate)
}
~~~

In src-tauri/src/lib.rs, add:

~~~rust
mod fs_guard;
~~~

- [ ] **Step 4: Run the guard tests**

Run:

~~~bash
cargo test fs_guard
~~~

Expected: pass.

- [ ] **Step 5: Commit**

~~~bash
git add src-tauri/src/fs_guard.rs src-tauri/src/lib.rs
git commit -m "feat(security): add filesystem base guard"
~~~

---

### Task 2: Confine LAN Storage Commands to Configured Base

**Files:**
- Modify: src-tauri/src/commands/lan_storage.rs
- Modify: src/infrastructure/storage/LanFileStorage.ts
- Create: src/infrastructure/storage/__tests__/LanFileStorage.test.ts

- [ ] **Step 1: Write the failing adapter tests**

Create src/infrastructure/storage/__tests__/LanFileStorage.test.ts:

~~~ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanFileStorage } from '../LanFileStorage';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

function sqliteWithLanPath(path = '/srv/share'): SqlitePort {
    return {
        query: vi.fn(async () => [{ valor: path }]),
        execute: vi.fn(async () => undefined),
        transaction: vi.fn(async (fn: () => Promise<void>) => fn()),
        all: vi.fn(async () => []),
    } as unknown as SqlitePort;
}

describe('LanFileStorage', () => {
    beforeEach(() => invoke.mockReset());

    it('refuses traversal relPaths before invoking Tauri', async () => {
        const storage = new LanFileStorage(sqliteWithLanPath());
        await expect(storage.readFile('../etc/passwd')).resolves.toBeNull();
        await expect(storage.writeFile('../../secret', new Uint8Array([1]))).resolves.toBeUndefined();
        await expect(storage.listDir('/absolute')).resolves.toEqual([]);
        expect(invoke).not.toHaveBeenCalled();
    });

    it('invokes LAN commands with relative path only', async () => {
        invoke.mockResolvedValueOnce(btoa('ok'));
        const storage = new LanFileStorage(sqliteWithLanPath());
        await storage.readFile('usuarios/index.json');
        expect(invoke).toHaveBeenCalledWith('lan_read_file', { relPath: 'usuarios/index.json' });
    });
});
~~~

- [ ] **Step 2: Run the failing adapter tests**

Run:

~~~bash
npx vitest src/infrastructure/storage/__tests__/LanFileStorage.test.ts -v
~~~

Expected: fail because the adapter still invokes LAN commands with an absolute concatenated path.

- [ ] **Step 3: Update Rust LAN commands**

In src-tauri/src/commands/lan_storage.rs:

- Remove the old validate_path helper.
- Add DbState, SessionState, and fs_guard imports.
- Change command arguments from path to rel_path.
- Read base path from tbl_configuracoes_sistema where chave = 'lan_sync_path'.
- Call session.validate_against_db(conn) before filesystem access.
- Use resolve_existing_within_base for read/list and resolve_writable_within_base for writes.

Use this command shape:

~~~rust
#[tauri::command]
pub fn lan_read_file(
    rel_path: String,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados nao conectado")?;
    session.validate_against_db(conn)?;
    let base = lan_base_dir(conn)?;
    let p = resolve_existing_within_base(&base, &rel_path)?;
    let bytes = fs::read(&p).map_err(|e| format!("lan_read_file: {}", e))?;
    Ok(B64.encode(bytes))
}
~~~

Apply the same pattern to lan_write_file and lan_list_dir.

Before committing, verify no LAN command runs before a session exists. The session gate now rejects pre-login LAN access, so audit the pre-login callers:

~~~bash
rg -n "lan_read_file|lan_write_file|lan_list_dir|listUsersFromLan|readExpectedUsersSeed|CrmSnapshotPublisher|publishAll" app contexts src/infrastructure/container.ts
~~~

For each hit reachable before db_login (e.g. CRM snapshot publish in ensureColumnsIfNeeded, any login-screen LAN seed read): confirm it is either deferred until after a session is set, or already fire-and-forget so a pre-login rejection degrades gracefully (no crash). LAN access does not get a bootstrap hatch — it stays session-gated.

- [ ] **Step 4: Update the TypeScript adapter**

In src/infrastructure/storage/LanFileStorage.ts, add:

~~~ts
function isSafeRelativePath(relPath: string): boolean {
    const trimmed = relPath.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
    return !trimmed.split(/[\\/]+/).some(part => part === '..');
}
~~~

Then update calls:

~~~ts
if (!isSafeRelativePath(relPath)) return null;
const b64 = await invoke<string>('lan_read_file', { relPath });
~~~

~~~ts
if (!isSafeRelativePath(relPath)) return;
await invoke('lan_write_file', { relPath, content: b64 });
~~~

~~~ts
if (!isSafeRelativePath(relPath)) return [];
return await invoke<string[]>('lan_list_dir', { relPath });
~~~

For testConnection, call relPath ".".

- [ ] **Step 5: Run targeted tests**

Run:

~~~bash
npx vitest src/infrastructure/storage/__tests__/LanFileStorage.test.ts -v
cargo test fs_guard
~~~

Expected: pass.

- [ ] **Step 6: Commit**

~~~bash
git add src-tauri/src/commands/lan_storage.rs src/infrastructure/storage/LanFileStorage.ts src/infrastructure/storage/__tests__/LanFileStorage.test.ts
git commit -m "feat(lan): confine LAN storage to configured base"
~~~

---

### Task 3: Issue Rust Sessions from Login

**Files:**
- Modify: src-tauri/src/session.rs
- Modify: src-tauri/src/commands/auth.rs
- Modify: contexts/AuthContext.tsx
- Modify: app/login/page.tsx

- [ ] **Step 1: Write the failing Rust session tests**

In src-tauri/src/session.rs tests:

~~~rust
#[test]
fn set_session_from_token_rejects_unknown_token() {
    let state = SessionState::new();
    assert!(state.set_session_from_token("fake-token").is_err());
}

#[test]
fn issue_token_then_set_session_succeeds() {
    let state = SessionState::new();
    let token = state.issue_token("u1".to_string(), "admin".to_string()).unwrap();
    state.set_session_from_token(&token).unwrap();
    assert_eq!(state.user_id.lock().unwrap().as_deref(), Some("u1"));
    assert_eq!(state.perfil.lock().unwrap().as_deref(), Some("admin"));
}
~~~

- [ ] **Step 2: Run the failing tests**

Run:

~~~bash
cargo test set_session_from_token_rejects_unknown_token issue_token_then_set_session_succeeds
~~~

Expected: fail because token methods do not exist.

- [ ] **Step 3: Implement token issuance**

In src-tauri/src/session.rs:

- Add issued_tokens: Mutex<HashMap<String, SessionInfo>> to SessionState.
- Use rand::rngs::OsRng and hex::encode for 32-byte opaque tokens.
- Add issue_token(user_id, perfil) and set_session_from_token(token).
- Change the Tauri set_session command to accept token only.

Core method shape:

~~~rust
pub fn set_session_from_token(&self, token: &str) -> Result<(), String> {
    let info = self
        .issued_tokens
        .lock()
        .map_err(|e| format!("Lock poisoned: {}", e))?
        .get(token)
        .cloned()
        .ok_or("Token de sessao invalido".to_string())?;
    *self.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(info.user_id);
    *self.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(info.perfil);
    *self.validated_at.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(Instant::now());
    Ok(())
}
~~~

- [ ] **Step 4: Make db_login issue the token**

In src-tauri/src/commands/auth.rs:

- Add session: State<'_, crate::session::SessionState> to db_login.
- Add token: Option<String> to LoginResult.
- When password_valid is true, issue token from user id and perfil.
- Return token: None for user not found or invalid password.

- [ ] **Step 5: Update frontend session flow**

In app/login/page.tsx, extend LoginResult:

~~~ts
interface LoginResult {
    found: boolean;
    password_valid: boolean;
    token: string | null;
    user: Record<string, unknown> | null;
}
~~~

Require token after password validation:

~~~ts
if (!result.token) {
    throw new Error("Sessao local nao foi emitida pelo login.");
}
user = { ...userObj, sessionToken: result.token } as unknown as User;
~~~

In contexts/AuthContext.tsx, replace set_session userId/perfil with:

~~~ts
const token = (userData as unknown as { sessionToken?: string }).sessionToken;
if (token) {
    await invoke("set_session", { token });
}
~~~

Do not persist sessionToken to localStorage.

- [ ] **Step 6: Run verification**

Run:

~~~bash
cargo test session
npx tsc --noEmit
~~~

Expected: pass.

- [ ] **Step 7: Commit**

~~~bash
git add src-tauri/src/session.rs src-tauri/src/commands/auth.rs app/login/page.tsx contexts/AuthContext.tsx
git commit -m "feat(auth): issue sessions from login"
~~~

---

### Task 3.5: Rehydrate Session Before Read Gates

**Files:**
- Modify: src-tauri/src/session.rs
- Modify: src-tauri/src/lib.rs
- Modify: contexts/AuthContext.tsx

**Why this must land before Task 4:** Task 4 makes db_query require an authenticated Rust session. The current AuthContext restore effect reads usuarios before rebuilding the Rust session, so Task 4 would make every restored frontend session fail. Rehydration must happen first, and it must not reintroduce set_session(userId, perfil) trust from JavaScript.

- [ ] **Step 1: Write failing Rust reissue tests**

In src-tauri/src/session.rs tests, add tests for reissuing a token only from an already-active Rust session:

~~~rust
#[test]
fn reissue_token_requires_existing_session() {
    let state = SessionState::new();
    assert!(state.reissue_token_for_current_session("u1").is_err());
}

#[test]
fn reissue_token_rejects_mismatched_user() {
    let state = SessionState::new();
    let token = state.issue_token("u1".to_string(), "admin".to_string()).unwrap();
    state.set_session_from_token(&token).unwrap();

    assert!(state.reissue_token_for_current_session("u2").is_err());
}

#[test]
fn reissue_token_for_current_session_can_restore_from_token() {
    let state = SessionState::new();
    let first = state.issue_token("u1".to_string(), "admin".to_string()).unwrap();
    state.set_session_from_token(&first).unwrap();

    let second = state.reissue_token_for_current_session("u1").unwrap();
    state.clear().unwrap();
    state.set_session_from_token(&second).unwrap();

    assert_eq!(state.user_id.lock().unwrap().as_deref(), Some("u1"));
    assert_eq!(state.perfil.lock().unwrap().as_deref(), Some("admin"));
}
~~~

If Task 3 did not add a reusable clear method, add it before this test or have clear_session call the same method.

- [ ] **Step 2: Run the failing tests**

Run:

~~~bash
cargo test reissue_token_requires_existing_session reissue_token_rejects_mismatched_user reissue_token_for_current_session_can_restore_from_token
~~~

Expected: fail because reissue_token_for_current_session and/or clear do not exist.

- [ ] **Step 3: Implement token reissue from current session only**

In src-tauri/src/session.rs, add a clear helper and a reissue method that reads the current Rust session and refuses mismatched frontend identity:

~~~rust
pub fn clear(&self) -> Result<(), String> {
    *self.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    *self.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    *self.validated_at.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    Ok(())
}

pub fn reissue_token_for_current_session(&self, expected_user_id: &str) -> Result<String, String> {
    let user_id = self
        .user_id
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .clone()
        .ok_or("Sessao local expirada. Faça login novamente.".to_string())?;
    let perfil = self
        .perfil
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .clone()
        .ok_or("Sessao local expirada. Faça login novamente.".to_string())?;

    if user_id != expected_user_id {
        return Err("Sessao local nao corresponde ao usuario restaurado.".to_string());
    }

    self.issue_token(user_id, perfil)
}
~~~

Update clear_session to delegate:

~~~rust
#[tauri::command]
pub fn clear_session(session: State<'_, SessionState>) -> Result<(), String> {
    session.clear()
}
~~~

Add a Tauri command that validates the current Rust session against the DB before returning a fresh token:

~~~rust
#[tauri::command]
pub fn reissue_session_token(
    user_id: String,
    db_state: State<'_, crate::database::DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados nao conectado")?;
    let (current_user_id, _) = session.validate_against_db(conn)?;
    if current_user_id != user_id {
        return Err("Sessao local nao corresponde ao usuario restaurado.".to_string());
    }
    session.reissue_token_for_current_session(&user_id)
}
~~~

Register reissue_session_token in src-tauri/src/lib.rs next to set_session, clear_session, and get_session.

- [ ] **Step 4: Restore Rust session before any gated read**

In contexts/AuthContext.tsx, keep login from persisting sessionToken, but change the localStorage restore effect so it reissues and sets the Rust token before SELECT ativo:

~~~ts
const validate = async () => {
    try {
        const { getContainerAsync } = await import('@/src/infrastructure/container');
        await getContainerAsync();

        const token = await invoke<string>('reissue_session_token', { userId: parsed!.id });
        await invoke('set_session', { token });

        const result = await sqlite.query<{ ativo: number | boolean }>(
            'SELECT ativo FROM usuarios WHERE id = ? LIMIT 1',
            [parsed!.id]
        );
        const row = result[0];
        const ativo = row?.ativo ?? null;
        if (ativo === 1 || ativo === true) {
            lastActivityRef.current = Date.now();
            setUser(parsed);
        } else {
            console.warn('[Auth] User inactive or missing, clearing session');
            localStorage.removeItem('ecoforms_user');
            await invoke('clear_session').catch(() => {});
        }
    } catch (err) {
        console.warn('[Auth] Session restore failed; login required:', err);
        localStorage.removeItem('ecoforms_user');
        await invoke('clear_session').catch(() => {});
    } finally {
        setLoading(false);
    }
};
~~~

Do not call db_query/sqlite.query before reissue_session_token and set_session complete. If reissue_session_token fails because the Tauri process lost its in-memory session, force a fresh login instead of trusting the stored user object.

- [ ] **Step 5: Run verification**

Run:

~~~bash
cargo test reissue_token_requires_existing_session reissue_token_rejects_mismatched_user reissue_token_for_current_session_can_restore_from_token
cargo test session
npx tsc --noEmit
~~~

Expected: pass on a build-capable host.

- [ ] **Step 6: Commit**

~~~bash
git add src-tauri/src/session.rs src-tauri/src/lib.rs contexts/AuthContext.tsx
git commit -m "feat(auth): rehydrate restored sessions before gated reads"
~~~

---

### Task 4: Enforce Session, Sensitive Column, RBAC, and Email Gates

**Files:**
- Modify: src-tauri/src/database.rs
- Modify: src-tauri/src/commands/rbac.rs
- Modify: src-tauri/src/commands/setup.rs
- Modify: src-tauri/src/commands/email.rs
- Modify: src/application/ports/SqlitePort.ts
- Modify: src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts
- Modify: src/infrastructure/container.ts

**Why the bootstrap hatch:** db_query becomes session-gated, but pre-login init reads run before any session exists. getContainerAsync -> ensureColumnsIfNeeded issues reads via sqlite.query (migratePtBr at container.ts ~385, ensureColumns at ~397, CRM/prazos at ~415/~424), and Task 3.5 calls getContainerAsync before reissue_session_token. db_execute already has a `bootstrap: Option<bool>` escape hatch; db_query has none. Without one, gating db_query breaks container init for every returning user. Mirror the db_execute hatch on db_query: skip session validation when bootstrap is true, but keep FORBIDDEN_COLUMNS and the SELECT-only guard unconditional so the hatch can never read credentials or mutate.

- [ ] **Step 1: Write failing database tests**

In src-tauri/src/database.rs tests, add helpers and tests:

~~~rust
fn session_with_user(user_id: &str, perfil: &str) -> SessionState {
    let session = SessionState::new();
    *session.user_id.lock().unwrap() = Some(user_id.to_string());
    *session.perfil.lock().unwrap() = Some(perfil.to_string());
    session
}

#[test]
fn db_query_requires_valid_session() {
    let app = make_app(setup_db(), SessionState::new());
    let result = db_query(
        "SELECT id, nome FROM clientes".to_string(),
        vec![],
        app.state::<DbState>(),
        app.state::<SessionState>(),
        None,
    );
    assert!(result.is_err());
}

#[test]
fn db_query_allows_bootstrap_read_without_session() {
    let app = make_app(setup_db(), SessionState::new());
    let result = db_query(
        "SELECT id FROM usuarios".to_string(),
        vec![],
        app.state::<DbState>(),
        app.state::<SessionState>(),
        Some(true),
    );
    assert!(result.is_ok());
}

#[test]
fn db_query_bootstrap_still_blocks_sal_sync_column() {
    let app = make_app(setup_db(), SessionState::new());
    let result = db_query(
        "SELECT sal_sync FROM usuarios".to_string(),
        vec![],
        app.state::<DbState>(),
        app.state::<SessionState>(),
        Some(true),
    );
    assert!(result.is_err());
}

#[test]
fn db_query_blocks_sal_sync_column() {
    let app = make_app(setup_db(), session_with_user("1", "admin"));
    let result = db_query(
        "SELECT sal_sync FROM usuarios".to_string(),
        vec![],
        app.state::<DbState>(),
        app.state::<SessionState>(),
        None,
    );
    assert!(result.is_err());
}

#[test]
fn db_execute_blocks_domain_write_without_permission() {
    let app = make_app(setup_db(), session_with_user("1", "operador"));
    let result = db_execute(
        "UPDATE demandas SET status = 'fechada' WHERE id = 1".to_string(),
        vec![],
        app.state::<DbState>(),
        app.state::<SessionState>(),
        None,
    );
    assert!(result.is_err());
}
~~~

Make setup_db include ativo, sal_sync, demandas, and permissoes rows needed by these tests.

- [ ] **Step 2: Run the failing tests**

Run:

~~~bash
cargo test db_query_requires_valid_session db_query_allows_bootstrap_read_without_session db_query_bootstrap_still_blocks_sal_sync_column db_query_blocks_sal_sync_column db_execute_blocks_domain_write_without_permission
~~~

Expected: fail until the gate, bootstrap hatch, and sal_sync block are implemented.

- [ ] **Step 3: Add backend permission helper**

In src-tauri/src/commands/rbac.rs:

~~~rust
pub fn require_permission(
    conn: &Connection,
    session: &crate::session::SessionState,
    permissao: &str,
) -> Result<(String, String), String> {
    let (user_id, perfil) = session.validate_against_db(conn)?;
    if is_admin(conn, &perfil)? {
        return Ok((user_id, perfil));
    }
    check_permission(conn, &perfil, permissao)?;
    Ok((user_id, perfil))
}
~~~

- [ ] **Step 4: Gate db_query, add bootstrap hatch, and block sal_sync**

In src-tauri/src/database.rs db_query:

- Rename _session to session.
- Add `bootstrap: Option<bool>` as the last argument (mirroring db_execute).
- Call `session.validate_against_db(conn)?` before preparing results, but skip it when `bootstrap.unwrap_or(false)` is true.
- Keep the SELECT-only guard and FORBIDDEN_COLUMNS check unconditional (they must apply even on bootstrap reads).
- Change forbidden columns to PASSWORD_HASH, HASH_SENHA, SAL_SYNC.

Command shape:

~~~rust
#[tauri::command]
pub fn db_query(
    sql: String,
    params: Vec<serde_json::Value>,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<TauriQueryResult, String> {
    // ... open conn; SELECT-only + FORBIDDEN_COLUMNS guards ALWAYS run ...
    if !bootstrap.unwrap_or(false) {
        session.validate_against_db(conn)?;
    }
    // ... prepare results ...
}
~~~

In src/application/ports/SqlitePort.ts, extend query to mirror execute:

~~~ts
query<T = unknown>(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<T[]>;
~~~

In src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts, thread the flag:

~~~ts
const result = await invoke<TauriQueryResult>('db_query', {
    sql, params, bootstrap: options?.bootstrap ?? false,
});
~~~

In src/infrastructure/container.ts, mark only the pre-login init reads as bootstrap so they bypass the session gate (the read callbacks passed to migratePtBrIfNeeded and ensureColumns, plus any CRM/prazos reads in ensureColumnsIfNeeded):

~~~ts
(sql: string, params?: unknown[]) => sqlite.query(sql, params, { bootstrap: true }),
~~~

Do not mark ordinary application reads as bootstrap — only schema/init reads that must run before login.

- [ ] **Step 5: Gate domain writes**

In database.rs, add required_permission_for_write:

~~~rust
fn required_permission_for_write(table: &str, kind: &crate::sql_guard::StatementKind) -> Option<&'static str> {
    if !matches!(
        kind,
        crate::sql_guard::StatementKind::Insert
            | crate::sql_guard::StatementKind::Update
            | crate::sql_guard::StatementKind::Delete
    ) {
        return None;
    }

    match table {
        "DEMANDAS" | "TAREFAS" | "CLIENTES" | "PROJETOS" | "PESAGENS" | "ROTEIROS" => Some("data.edit_all"),
        "MANIFESTACOES" | "TRAMITACOES" | "RESPOSTAS" => Some("ouvidoria.respond"),
        "TBL_AGENDAMENTOS" | "TBL_SERVICE_SLOTS" | "TBL_SERVICE_TYPES" => Some("data.edit_all"),
        _ => None,
    }
}
~~~

For each mutation target table, call require_permission unless it is handled by bootstrap or the existing sensitive table admin guard.

- [ ] **Step 6: Add email permission**

In src-tauri/src/commands/setup.rs, seed:

~~~rust
"('admin','system.email'),('gerente','system.email')",
~~~

In src-tauri/src/commands/email.rs:

- send_email already takes session: State<SessionState>; add it to test_email_connection and migrate_smtp_password too.
- After opening db, call require_permission(db, &session, "system.email")? in all three.

Also, for consistency, add SAL_SYNC to the db_execute_batch FORBIDDEN_COLUMNS list (database.rs ~300), matching the db_query change.

- [ ] **Step 7: Run verification**

Run:

~~~bash
cargo test db_query_requires_valid_session db_query_blocks_sal_sync_column db_execute_blocks_domain_write_without_permission
cargo test
~~~

Expected: pass.

- [ ] **Step 8: Commit**

~~~bash
git add src-tauri/src/database.rs src-tauri/src/commands/rbac.rs src-tauri/src/commands/setup.rs src-tauri/src/commands/email.rs
git commit -m "feat(security): enforce backend session and permissions"
~~~

---

### Task 5: Validate LAN Snapshots and Ignore Privileged Fields

**Files:**
- Modify: src/infrastructure/sync/LanPullService.ts
- Modify: src/infrastructure/sync/UserSnapshotService.ts
- Create: src/infrastructure/sync/__tests__/lan-pull-service.test.ts

- [ ] **Step 1: Write failing LAN pull tests**

Create src/infrastructure/sync/__tests__/lan-pull-service.test.ts:

~~~ts
import { describe, expect, it, vi } from 'vitest';
import { LanPullService } from '../LanPullService';
import type { LanDomainSyncService } from '../LanDomainSyncService';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

function sqliteFake(): SqlitePort & { executed: Array<{ sql: string; params: unknown[] }> } {
    const executed: Array<{ sql: string; params: unknown[] }> = [];
    return {
        executed,
        query: vi.fn(async () => []),
        execute: vi.fn(async (sql: string, params: unknown[] = []) => {
            executed.push({ sql, params });
        }),
        all: vi.fn(async () => []),
        transaction: vi.fn(async (fn: () => Promise<void>) => fn()),
    } as unknown as SqlitePort & { executed: Array<{ sql: string; params: unknown[] }> };
}

function lanFake(snapshot: Record<string, unknown>): LanDomainSyncService {
    return {
        pullIndex: vi.fn(async () => ({
            last_entity_uuid: 'u1',
            entities: { u1: { v: 1, hash: 'h1', last_event_id: 'evt-1' } },
        })),
        fetchEntity: vi.fn(async () => snapshot),
    } as unknown as LanDomainSyncService;
}

describe('LanPullService', () => {
    it('ignores perfil and credential fields from usuarios LAN snapshots', async () => {
        const sqlite = sqliteFake();
        const service = new LanPullService(lanFake({
            id: 'u1',
            nome: 'Pessoa',
            nome_usuario: 'pessoa',
            email: 'pessoa@example.test',
            perfil: 'admin',
            hash_senha: 'x',
            sal_sync: 'y',
            ativo: 1,
        }), sqlite);

        await service.pullDomain('usuarios');
        const userWrite = sqlite.executed.find(e => e.sql.includes('INSERT INTO usuarios'));
        expect(userWrite?.sql).not.toContain('perfil');
        expect(userWrite?.params).not.toContain('admin');
        expect(userWrite?.params).not.toContain('x');
        expect(userWrite?.params).not.toContain('y');
    });

    it('rejects invalid snapshot before executing SQL', async () => {
        const sqlite = sqliteFake();
        const service = new LanPullService(lanFake({ id: 'u1', nome: 123 }), sqlite);
        await expect(service.pullDomain('usuarios')).resolves.toBe(0);
        expect(sqlite.executed.some(e => e.sql.includes('INSERT INTO usuarios'))).toBe(false);
    });
});
~~~

- [ ] **Step 2: Run failing tests**

Run:

~~~bash
npx vitest src/infrastructure/sync/__tests__/lan-pull-service.test.ts -v
~~~

Expected: fail because perfil is accepted and there is no snapshot validation.

- [ ] **Step 3: Add validation helpers**

In LanPullService.ts, add helpers asString, asNumberFlag, validateUsuarioSnapshot, and validateSnapshot. For usuarios, return only id, nome, nome_usuario, email, ativo, and criado_em.

- [ ] **Step 4: Remove privileged user columns from LAN upsert**

Replace usuarios upsert so it does not mention perfil, hash_senha, sal_sync, permissoes, or hierarquia fields:

~~~ts
sql: 'INSERT INTO usuarios (id, nome, nome_usuario, email, ativo, criado_em, atualizado_em)
      VALUES (?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        nome=excluded.nome, nome_usuario=excluded.nome_usuario,
        email=excluded.email, ativo=excluded.ativo,
        atualizado_em=datetime('now')',
params: [
    s.id,
    s.nome ?? null,
    s.nome_usuario ?? null,
    s.email ?? null,
    s.ativo != null ? (s.ativo as number) : 1,
    s.criado_em ?? null,
],
~~~

- [ ] **Step 5: Stop publishing privileged fields**

In UserSnapshotService.ts, change the destructuring to remove perfil too:

~~~ts
const { hash_senha: _, sal_sync: __, perfil: ___, ...safe } = u;
void _; void __; void ___;
~~~

- [ ] **Step 6: Run tests**

Run:

~~~bash
npx vitest src/infrastructure/sync/__tests__/lan-pull-service.test.ts -v
~~~

Expected: pass.

- [ ] **Step 7: Commit**

~~~bash
git add src/infrastructure/sync/LanPullService.ts src/infrastructure/sync/UserSnapshotService.ts src/infrastructure/sync/__tests__/lan-pull-service.test.ts
git commit -m "fix(lan): validate snapshots and ignore privileged fields"
~~~

---

### Task 6: Fix Checksum Wording and Sequence Upsert

**Files:**
- Modify: src/infrastructure/sync/InboundService.ts
- Modify: src/infrastructure/sync/__tests__/sync-protocol.test.ts

- [ ] **Step 1: Write failing sync tests**

In sync-protocol.test.ts, add tests that assert checksum errors do not include "tampering" and that inbound pull can update manifesto_sync without SQL syntax error.

~~~ts
expect(result.errors.some(e => e.includes('checksum inválido'))).toBe(true);
expect(result.errors.some(e => e.includes('tampering'))).toBe(false);
~~~

- [ ] **Step 2: Run failing tests**

Run:

~~~bash
npx vitest src/infrastructure/sync/__tests__/sync-protocol.test.ts -t "checksum|manifesto_sync" -v
~~~

Expected: fail on wording and/or duplicated SET.

- [ ] **Step 3: Update checksum message**

In InboundService.ts, replace "checksum inválido — possível corrupção ou tampering" with:

~~~ts
row.id + ': checksum inválido — possível corrupção de dados'
~~~

Do not add HMAC in this plan.

- [ ] **Step 4: Fix _updateLocalSeq SQL**

Use:

~~~ts
await this.db.execute(
    'INSERT INTO manifesto_sync (id_roteamento, sequencia, ultimo_id_evento, atualizado_em)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id_roteamento) DO UPDATE SET
       sequencia = excluded.sequencia,
       ultimo_id_evento = excluded.ultimo_id_evento,
       atualizado_em = datetime('now')',
    [routingId, seq, lastEventId],
);
~~~

- [ ] **Step 5: Run sync tests**

Run:

~~~bash
npx vitest src/infrastructure/sync/__tests__/sync-protocol.test.ts -v
~~~

Expected: pass.

- [ ] **Step 6: Commit**

~~~bash
git add src/infrastructure/sync/InboundService.ts src/infrastructure/sync/__tests__/sync-protocol.test.ts
git commit -m "fix(sync): clarify checksum semantics and repair seq upsert"
~~~

---

### Task 7: Align Documentation and Regression Gate

**Files:**
- Modify: docs/adr/ADR-074-cofre-de-chaves-e-confinamento-fs.md
- Modify: docs/adr/ADR-075-sessao-autenticada-e-ingestao-confiavel.md
- Modify: docs/adr/ADR-076-fronteira-cripto-lan-e-envelope-remoto.md
- Modify: docs/adr/README.md
- Modify: docs/superpowers/plans/2026-06-19-adr-074-075-security-remediation.md

- [ ] **Step 1: Verify paused crypto items are not active implementation tasks**

Run:

~~~bash
rg -n "seal_key|unseal_key|buildHmac|verifyHmac|Ed25519|decrypt/verify" docs/superpowers/plans/2026-06-19-adr-074-075-security-remediation.md
~~~

Expected: only paused/out-of-scope mentions, no active local LAN crypto implementation step.

- [ ] **Step 2: Verify ADR cross-links**

Run:

~~~bash
rg -n "ADR-076|Pausado por ADR-076|envelope remoto" docs/adr
~~~

Expected: ADR-074, ADR-075, ADR-076, and README all mention the revised boundary.

- [ ] **Step 3: Run focused regression suite**

Run:

~~~bash
cargo test
npx vitest src/infrastructure/storage/__tests__/LanFileStorage.test.ts src/infrastructure/sync/__tests__/lan-pull-service.test.ts src/infrastructure/sync/__tests__/sync-protocol.test.ts -v
npx tsc --noEmit
~~~

Expected: all pass. cargo test must include the bootstrap-hatch tests (db_query_allows_bootstrap_read_without_session, db_query_bootstrap_still_blocks_sal_sync_column) and the reissue tests (reissue_token_requires_existing_session, reissue_token_rejects_mismatched_user, reissue_token_for_current_session_can_restore_from_token).

- [ ] **Step 4: Commit**

~~~bash
git add docs/adr/ADR-074-cofre-de-chaves-e-confinamento-fs.md docs/adr/ADR-075-sessao-autenticada-e-ingestao-confiavel.md docs/adr/ADR-076-fronteira-cripto-lan-e-envelope-remoto.md docs/adr/README.md docs/superpowers/plans/2026-06-19-adr-074-075-security-remediation.md
git commit -m "docs(plan): align security remediation with ADR-076"
~~~

---

## Self-review

- ADR-074 active filesystem confinement is covered by Tasks 1 and 2.
- ADR-074 local key vault/removal items are explicitly paused and not implemented.
- ADR-075 session issuance is covered by Task 3.
- ADR-075 restored-session rehydration is covered by Task 3.5, which must land before Task 4. Cold start (Tauri process restart, in-memory session lost) cannot reissue and forces a fresh password login; webview reload keeps the live Rust session and rehydrates smoothly. No authenticated session is resurrected from localStorage without the Rust process already holding it.
- ADR-075 session/RBAC/read/email gates are covered by Task 4. Pre-login init reads (container ensureColumns/migratePtBr/CRM/prazos) use the db_query bootstrap hatch; FORBIDDEN_COLUMNS and SELECT-only guards still apply on bootstrap reads so the hatch cannot read credentials or mutate. Authenticated application reads require a validated session.
- ADR-075 LAN validation/allowlist is covered by Task 5.
- ADR-075 checksum wording and sequence bug are covered by Task 6.
- ADR-076 local-readable LAN and future remote envelope boundary are reflected in scope and docs.
- Remote/web encrypted envelope is intentionally out of scope and must receive a separate plan when there is an actual remote file/export integration.
