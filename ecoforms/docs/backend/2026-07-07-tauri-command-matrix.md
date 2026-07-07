# Tauri Command Matrix - 2026-07-07

## Summary

Measured from `ecoforms/desktop/src-tauri/src/lib.rs` `tauri::generate_handler![...]`.

- Registered commands: 63
- Expected count from Task 1: 63
- Difference from expected: none
- `frontend-invoked`: 45
- `rust-internal`: 6
- `reserved-documented`: 12
- `candidate-remove`: 0

This matrix is an inventory for a future removal/review PR. It does not claim that a command is safe to remove unless classified as `candidate-remove`.

## Classification Rules

- `frontend-invoked`: found through a literal frontend call such as `invoke('command_name')`, `invoke("command_name")`, `safeInvoke("command_name")`, or `ctx.commands.invoke("command_name")` under `ecoforms/desktop/src`, `ecoforms/desktop/app`, or `ecoforms/desktop/components`.
- `rust-internal`: no frontend invoke found, but the command is used by Rust tests/internal flows or is required as a state/security bridge for database, session, crypto, migration, or SQL guard behavior.
- `reserved-documented`: no current frontend invoke found, but retained as an intentional operational, migration, storage, LAN, or future-integration hook.
- `candidate-remove`: no frontend invoke, no internal usage, and no operational justification found.

## Matrix

| Command | Frontend invoke | Rust internal use | Classification | Decision |
|---|---|---|---|---|
| `db_connect` | `src/infrastructure/container.ts:354` | registered in `src-tauri/src/lib.rs`; opens DB state | frontend-invoked | Keep; active DB bootstrap bridge. |
| `db_query` | `src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts:28` | `src-tauri/src/database.rs`; SQL guard read path | frontend-invoked | Keep; active SQLite adapter read command. |
| `db_execute` | `src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts:40` | `src-tauri/src/database.rs`; SQL guard write path | frontend-invoked | Keep; active SQLite adapter write command. |
| `db_execute_batch` | none found | `src-tauri/src/database.rs`; SQL guard batch path and tests | rust-internal | Keep for now; registered security-controlled batch bridge. |
| `db_transaction` | `src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts:44` | `src-tauri/src/database.rs` | frontend-invoked | Keep; active transaction bridge. |
| `db_has_users` | `app/login/page.tsx:32` | `src-tauri/src/database.rs` | frontend-invoked | Keep; active first-run/login check. |
| `db_last_insert_id` | `src/interface/hooks/tauri/useTauriMutation.ts:49` | `src-tauri/src/database.rs` | frontend-invoked | Keep; active mutation helper. |
| `db_export_for_mobile` | `app/admin/exportar-mobile/page.tsx:124` | `src-tauri/src/database.rs` | frontend-invoked | Keep; active mobile export flow. |
| `db_read_mobile_export` | `app/admin/exportar-mobile/page.tsx:152` | `src-tauri/src/database.rs` | frontend-invoked | Keep; active mobile export download flow. |
| `clear_session` | none found | `src-tauri/src/session.rs`; session state command | rust-internal | Keep for now; session/security bridge retained despite no direct invoke. |
| `get_session` | none found | `src-tauri/src/commands/auth.rs` tests call `get_session`; session state command | rust-internal | Keep for now; session inspection bridge. |
| `db_login` | `app/login/page.tsx:88`; `components/auth/FirstRunSetupModal.tsx:143` | `src-tauri/src/commands/auth.rs`; sets session | frontend-invoked | Keep; active authentication path. |
| `get_or_create_own_sync_salt` | none found | `src-tauri/src/commands/auth.rs`; authenticated salt command and tests | rust-internal | Keep; security/sync salt bridge. |
| `demanda_aceitar` | `src/application/actions/builtin/demanda.actions.ts:22` | `src-tauri/src/commands/actions.rs` | frontend-invoked | Keep; active action registry command. |
| `demanda_encerrar` | none found as invoke; `src/application/actions/builtin/demanda.actions.ts:39` uses action id only | `src-tauri/src/commands/actions.rs` | reserved-documented | Retain for review; registered close-demand command but not currently invoked. |
| `ecoponto_agendar_remocao` | `components/remocao/PainelCaixas.tsx:68`; `src/application/actions/builtin/ecoponto.actions.ts:65` | `src-tauri/src/commands/actions.rs` | frontend-invoked | Keep; active removal scheduling command. |
| `verify_password` | none found | `src-tauri/src/lib.rs`; delegates `check_password` | reserved-documented | Retain for review; legacy/security helper, not enough evidence for removal. |
| `hash_password` | `components/users/UserDialog.tsx:132` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active password creation/update helper. |
| `network_probe_path` | `src/interface/hooks/utils/useNetworkParquet.ts:64` | `src-tauri/src/network.rs` | frontend-invoked | Keep; active network path probe. |
| `network_list_parquet` | `src/interface/hooks/utils/useNetworkParquet.ts:112` | `src-tauri/src/network.rs` | frontend-invoked | Keep; active parquet listing. |
| `network_write_parquet` | none found | `src-tauri/src/network.rs` | reserved-documented | Retain for review; paired network parquet write/export hook. |
| `fetch_cep` | `src/lib/cep.ts:21` | `src-tauri/src/network.rs` | frontend-invoked | Keep; active CEP integration. |
| `supabase_admin_query` | `src/infrastructure/adapters/SupabaseAdminAdapter.ts:18`; `src/interface/hooks/queries/useSupabaseAdmin.ts:31` | `src-tauri/src/supabase_admin.rs` | frontend-invoked | Keep; active Supabase admin bridge. |
| `supabase_admin_status` | none found | `src-tauri/src/supabase_admin.rs` | reserved-documented | Retain for review; admin health/status hook. |
| `load_crypto_key` | none found | `src-tauri/src/commands/crypto.rs`; populates `CryptoState` and `SmtpCryptoState` consumed by sync/email/legacy commands | rust-internal | Keep; crypto state bridge. |
| `create_first_admin` | `components/auth/FirstRunSetupModal.tsx:107` | `src-tauri/src/commands/setup.rs` | frontend-invoked | Keep; active first-run setup. |
| `bootstrap_seed_rbac` | `src/infrastructure/container.ts:393` | `src-tauri/src/commands/setup.rs` | frontend-invoked | Keep; active bootstrap/RBAC seed. |
| `bootstrap_set_lan_sync_path` | `src/interface/hooks/mutations/useFirstRunSetup.ts:22`; `src/interface/hooks/mutations/useFirstRunSetup.ts:30` | `src-tauri/src/commands/setup.rs` | frontend-invoked | Keep; active first-run LAN path setup. |
| `bootstrap_import_seed_users` | `src/interface/hooks/mutations/useFirstRunSetup.ts:41` | `src-tauri/src/commands/setup.rs` | frontend-invoked | Keep; active seed user import. |
| `send_email` | `app/manifestacoes/[id]/_hooks/useManifestacaoDetailModals.ts:276`; `src/application/service/services/NotificacaoService.ts:31` | `src-tauri/src/commands/email.rs` | frontend-invoked | Keep; active email sender. |
| `test_email_connection` | `app/admin/email/page.tsx:92` | `src-tauri/src/commands/email.rs` | frontend-invoked | Keep; active email admin test. |
| `migrate_smtp_password` | none found | `src-tauri/src/commands/email.rs`; SMTP crypto migration command | rust-internal | Keep for now; operational migration bridge. |
| `lan_read_file` | `src/infrastructure/storage/LanFileStorage.ts:64` | `src-tauri/src/commands/lan_storage.rs` | frontend-invoked | Keep; active LAN storage read. |
| `lan_write_file` | `src/infrastructure/storage/LanFileStorage.ts:77` | `src-tauri/src/commands/lan_storage.rs` | frontend-invoked | Keep; active LAN storage write. |
| `lan_list_dir` | `src/infrastructure/storage/LanFileStorage.ts:86`; `src/infrastructure/storage/LanFileStorage.ts:148` | `src-tauri/src/commands/lan_storage.rs` | frontend-invoked | Keep; active LAN storage listing. |
| `pg_legacy_config_get` | `src/interface/hooks/queries/useLegacySyncData.ts:98` | `src-tauri/src/commands/legacy_sync.rs` | frontend-invoked | Keep; active legacy sync configuration. |
| `pg_legacy_config_save` | `src/interface/hooks/queries/useLegacySyncData.ts:119` | `src-tauri/src/commands/legacy_sync.rs` | frontend-invoked | Keep; active legacy sync configuration. |
| `sync_roteiros_externos` | `src/interface/hooks/queries/useExternalRoteiroSync.ts:57`; `src/interface/hooks/queries/useLegacySyncData.ts:195` | `src-tauri/src/commands/sync_roteiros.rs` | frontend-invoked | Keep; active external route sync. |
| `sync_roteiros_status` | `src/interface/hooks/queries/useExternalRoteiroSync.ts:42` | `src-tauri/src/commands/sync_roteiros.rs` | frontend-invoked | Keep; active external route status. |
| `sync_pesagens_externas` | `src/interface/hooks/queries/useExternalPesagensSync.ts:30`; `src/interface/hooks/queries/useLegacySyncData.ts:213` | `src-tauri/src/commands/sync_pesagens.rs` | frontend-invoked | Keep; active external weighing sync. |
| `fetch_residuos_externos` | `src/interface/hooks/queries/useExternalResiduos.ts:44` | `src-tauri/src/commands/sync_residuos.rs` | frontend-invoked | Keep; active external residue fetch. |
| `sync_residuos_externos` | `src/interface/hooks/queries/useExternalResiduos.ts:61` | `src-tauri/src/commands/sync_residuos.rs` | frontend-invoked | Keep; active external residue sync. |
| `rotate_sync_salt` | `app/admin/seguranca/chaves/page.tsx:65` | `src-tauri/src/commands/key_rotation.rs` | frontend-invoked | Keep; active key rotation. |
| `recover_sync_salt` | `app/admin/seguranca/chaves/page.tsx:92` | `src-tauri/src/commands/key_rotation.rs` | frontend-invoked | Keep; active key recovery. |
| `list_salt_history` | `app/admin/seguranca/chaves/page.tsx:41` | `src-tauri/src/commands/key_rotation.rs` | frontend-invoked | Keep; active key history listing. |
| `toggle_devtools` | `components/ClientLayout.tsx:51` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active debug-only utility. |
| `open_whatsapp_url` | `app/manifestacoes/[id]/_hooks/useManifestacaoDetailModals.ts:251` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active WhatsApp launcher. |
| `write_export_file` | `app/analysis/page.tsx:508`; `components/registry/DataRegistryList.tsx:249` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active export writer. |
| `copy_attachment_to_appdata` | `src/interface/hooks/mutations/useAnexoUpload.ts:19` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active attachment storage helper. |
| `read_csv_text_file` | `components/clientes/ClienteCsvImport.tsx:253` | `src-tauri/src/lib.rs` | frontend-invoked | Keep; active CSV import helper. |
| `offline_storage_save_file` | none found | `src-tauri/src/lib.rs`; confined app-data storage command | reserved-documented | Retain for review; offline storage bridge. |
| `offline_storage_read_file` | none found | `src-tauri/src/lib.rs`; confined app-data storage command | reserved-documented | Retain for review; offline storage bridge. |
| `lan_server_start` | none found | `src-tauri/src/lan_server/commands.rs`; wraps LAN server start | reserved-documented | Retain for review; LAN server control surface. |
| `lan_server_stop` | none found | `src-tauri/src/lan_server/commands.rs`; wraps LAN server stop | reserved-documented | Retain for review; LAN server control surface. |
| `lan_server_status` | none found | `src-tauri/src/lan_server/commands.rs`; reports LAN server status | reserved-documented | Retain for review; LAN server control surface. |
| `lan_server_auth_token` | none found | `src-tauri/src/lan_server/commands.rs`; exposes LAN auth token | reserved-documented | Retain for review; LAN security/control surface. |
| `lan_server_set_role` | none found | `src-tauri/src/lan_server/commands.rs`; persists LAN role | reserved-documented | Retain for review; LAN role/control surface. |
| `lan_server_discover_peers` | none found | `src-tauri/src/lan_server/commands.rs`; peer discovery command | reserved-documented | Retain for review; LAN discovery surface. |
| `lan_http_request` | `src/infrastructure/sync/LanTransport.ts:38` | `src-tauri/src/commands/lan_http.rs` | frontend-invoked | Keep; active LAN HTTP transport. |
| `lan_http_get_bytes` | `src/infrastructure/sync/LanTransport.ts:43` | `src-tauri/src/commands/lan_http.rs` | frontend-invoked | Keep; active LAN byte transport. |
| `lan_ws_connect` | `src/infrastructure/sync/LanWebSocketClient.ts:102` | `src-tauri/src/commands/lan_ws.rs` | frontend-invoked | Keep; active LAN websocket client. |
| `lan_ws_send` | `src/infrastructure/sync/LanWebSocketClient.ts:116` | `src-tauri/src/commands/lan_ws.rs` | frontend-invoked | Keep; active LAN websocket client. |
| `lan_ws_disconnect` | `src/infrastructure/sync/LanWebSocketClient.ts:125` | `src-tauri/src/commands/lan_ws.rs` | frontend-invoked | Keep; active LAN websocket client. |
