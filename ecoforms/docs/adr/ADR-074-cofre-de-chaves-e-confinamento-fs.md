# ADR-074 — Cofre de chaves e confinamento de filesystem (camada de confiança local)

- **Status:** Proposto
- **Data:** 2026-06-19
- **Relacionado:** Auditoria `docs/security-audit-2026-06-19.md` (C1, S1, A2 parcial). É a **fundação** de [ADR-075](./ADR-075-sessao-autenticada-e-ingestao-confiavel.md) — não comece a 075 antes desta.
- **Substitui parcialmente:** comportamento de `commands/lan_storage.rs`, `network.rs`, `CryptoLayer.ts`.
- **Atualizado por:** [ADR-076](./ADR-076-fronteira-cripto-lan-e-envelope-remoto.md), que pausa a criptografia obrigatoria no sync LAN e desloca criptografia para envelope remoto/web.

## Contexto

Hoje o webview tem duas primitivas que anulam todo o resto do modelo de segurança:

1. **Leitura/escrita arbitrária de arquivos (C1).** `lan_read_file`/`lan_write_file`/`lan_list_dir` (e `network_*`) aceitam **qualquer caminho absoluto** e só bloqueiam `..`. Sem sessão, sem permissão. A `fs:scope` do Tauri (`$APPDATA`) não protege — esses comandos usam `std::fs` direto.
2. **Chave de sync em texto claro (S1).** `CryptoLayer.deriveAndStoreKey` deriva a chave AES com PBKDF2-SHA256 600k (forte) mas **grava os 32 bytes brutos em claro** em `.ecoforms-keys.dat` (Tauri Store) e relê sem senha — anulando o PBKDF2. **Pausado por ADR-076 enquanto a LAN offline nao exigir envelope cifrado local.**

**A cadeia original:** C1 lê `.ecoforms-keys.dat` → obtém a chave org → decifra/forja qualquer evento de sync (a integridade real do sync vem do AES-GCM, não do checksum). A ADR-076 muda a premissa: na LAN offline, a prioridade passa a ser confinamento, sessao/RBAC, schema e allowlist; criptografia fica reservada para envelope remoto/web.

## Decisão

Estabelecer uma **fronteira de confiança local** com dois invariantes:

### D1 — Confinamento de FS a um base-dir configurado, com autorização
- Introduzir `fn resolve_within_base(base: &Path, user_path: &str) -> Result<PathBuf>` em um novo módulo `src-tauri/src/fs_guard.rs`:
  - rejeita vazio e componentes `..`;
  - junta ao `base`, `canonicalize` o resultado, e exige `canonical.starts_with(canonical_base)` (pega symlink/UNC escape);
  - o `base` vem de config explícita (share LAN configurado / `$APPDATA`), nunca do caminho cru do cliente.
- `lan_read_file`/`lan_write_file`/`lan_list_dir`/`network_*` passam a:
  - receber `State<SessionState>` e exigir sessão válida (`validate_against_db`) + permissão (`system.sync` p/ leitura de share, `system.device_setup` p/ escrita);
  - resolver todo caminho via `resolve_within_base`.
- `.ecoforms-keys.dat`, `.env`, `*.sqlite` ficam **fora** de qualquer base permitido (asserção em teste).

### D2 — Chave de sync nunca persistida em claro (**pausado por ADR-076**)
- Remover a persistência da chave bruta em `.ecoforms-keys.dat`.
- **Padrão:** derivar da senha a cada login (PBKDF2 já existe) e manter **somente em memória** (TS `CryptoLayer.cryptoKey` + Rust `CryptoState` via `load_crypto_key`). `loadKey()` deixa de existir como "leitura sem senha".
- **Se persistência for necessária** (reabrir sem re-login): selar a chave com o cofre do SO — DPAPI (Windows), Keychain (macOS), secret-service (Linux) — via um novo comando Rust `seal_key`/`unseal_key`. Nunca array de bytes em claro num Store.
- `sal_sync` continua sendo o salt do PBKDF2; com a chave não-persistida, o vazamento de `sal_sync` (A2) deixa de bastar isoladamente.

> Pausa: estes itens so voltam ao escopo quando houver envelope remoto/web cifrado
> ou decisao explicita de cifrar tambem os snapshots/eventos LAN.

## Plano de execução (fases)

| Fase | Entrega | Arquivos | Aceitação |
|------|---------|----------|-----------|
| 074.1 | `fs_guard.rs` + testes de confinamento | `src-tauri/src/fs_guard.rs`, `lib.rs` | testes: `..`, symlink, UNC fora do base, e `/etc/passwd` → erro; caminho dentro do base → ok |
| 074.2 | Aplicar guard + sessão/permissão nos comandos FS | `lan_storage.rs`, `network.rs`, `session.rs` | comando sem sessão → erro; com sessão sem permissão → erro |
| 074.3 | Config do base-dir (share LAN / appdata) | `setup.rs` ou `org config` | base-dir vem de config, não do cliente |
| 074.4 | `seal_key`/`unseal_key` (cofre do SO) + remover persistência clara | `commands/crypto.rs`, `CryptoLayer.ts` | **Pausado por ADR-076** |
| 074.5 | Migração: apagar `.ecoforms-keys.dat` legado no upgrade | `CryptoLayer.ts` (migração no boot) | **Pausado por ADR-076** |

## Consequências

**Positivas:** fecha C1 e S1; reduz A2 a "defesa em profundidade". A `fs:scope` do Tauri passa a ser redundante com o guard (defesa em camadas).
**Negativas / trade-offs:**
- Reabrir o app passa a exigir re-login (ou suporte a cofre do SO) — UX. **Pausado por ADR-076** enquanto nao houver envelope remoto/web cifrado.
- O share LAN precisa de um base-dir configurado explicitamente; instalações que apontavam para caminhos arbitrários precisam reconfigurar.
- `seal_key` é específico por plataforma — exige `tauri-plugin-stronghold` ou crates de keyring; custo de dependência. **Pausado por ADR-076**.

## Riscos de migração
- Usuários com chave só no `.ecoforms-keys.dat` e **sem** lembrar a senha perdem acesso aos dados cifrados locais → orientar re-sync/recover (`recover_sync_salt` já existe para o salt). **Pausado por ADR-076**.

## Teste de regressão (gate para ADR-075)
- [ ] Nenhum comando FS aceita caminho fora do base.
- [ ] Nenhum arquivo em disco contém a chave AES em claro. **Pausado por ADR-076**.
- [ ] `lan_read_file('/qualquer/.ecoforms-keys.dat')` → erro de confinamento.
