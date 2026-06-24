# ADR-074 ÔÇö First-Run Setup com Descoberta de Caminho LAN


> **Renumerado** de ADR-061 para ADR-074 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Proposto  
**Data:** 2026-06-11  
**Autor:** Marcelo Luiz  
**Contexto externo:** Substitui o bootstrap admin tempor├írio por configura├º├úo de LAN path no primeiro acesso, com seed opcional via JSON.

---

## Contexto

### O que existe hoje

| Etapa | Comportamento | Problema |
|---|---|---|
| 1. Device novo (SQLite vazio) | `FirstRunSetupModal` cria **admin local tempor├írio** via `create_first_admin` | Admin "fake" serve s├│ para entrar em `/admin/settings` |
| 2. Admin loga | Acessa `/admin/settings` ÔåÆ digita `lan_sync_path` manualmente | Passo manual, propenso a erro, UX ruim |
| 3. Sync LAN inicia | `LanDomainSyncService` puxa `usuarios/index.json` + `{id}.json` | Admins reais do LAN sobrescrevem o fake |
| 4. Device pronto | Usu├írios reais dispon├¡veis | Admin fake descartado implicitamente |

### Problema

- **Duas identidades**: admin tempor├írio (local) vs admins reais (LAN) ÔÇö confus├úo
- **Configura├º├úo manual obrigat├│ria**: admin precisa saber o UNC path (`\\servidor\ecoforms`)
- **Sem valida├º├úo pr├®via**: path inv├ílido s├│ descoberto depois do login
- **Credenciais do LAN n├úo dispon├¡veis no first-run**: snapshots LAN n├úo t├¬m `hash_senha`/`sal_sync` (removidos no `UserSnapshotService`)

---

## Decis├úo

### Novo Fluxo de First-Run (Stepper no `FirstRunSetupModal`)

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé  FIRST-RUN SETUP                                            Ôöé
Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ
Ôöé  Step 1: Conex├úo com Dados                                  Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ   Ôöé
Ôöé  Ôöé Fonte dos dados:  [LAN (rede local)]  [Supabase]    Ôöé   Ôöé
Ôöé  Ôöé                                                     Ôöé   Ôöé
Ôöé  Ôöé Se LAN:                                             Ôöé   Ôöé
Ôöé  Ôöé   Caminho: [\\servidor\ecoforms____________] [Testar]Ôöé   Ôöé
Ôöé  Ôöé                                                     Ôöé   Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ   Ôöé
Ôöé                    [Avan├ºar]                                Ôöé
Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ
Ôöé  Step 2 (se LAN encontrou usu├írios): Selecionar Usu├írio    Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ   Ôöé
Ôöé  Ôöé Encontrados 5 usu├írios no LAN:                      Ôöé   Ôöé
Ôöé  Ôöé  Ôùï joao.silva    (admin)    Setor: TI               Ôöé   Ôöé
Ôöé  Ôöé  Ôùï maria.santos  (operador) Setor: Obras            Ôöé   Ôöé
Ôöé  Ôöé  ...                                                Ôöé   Ôöé
Ôöé  Ôöé                                                     Ôöé   Ôöé
Ôöé  Ôöé Senha: [___________]  [Entrar]                      Ôöé   Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ   Ôöé
Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ
Ôöé  Step 2 (se LAN vazio/erro): Criar Primeiro Admin          Ôöé
Ôöé  (fluxo atual ÔÇö campos: nome, username, senha, confirmar)  Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
```

### Persist├¬ncia

- `lan_sync_path` salvo em `tbl_configuracoes_sistema` (chave `lan_sync_path`) **no Step 1 ao testar com sucesso**
- Device nunca mais pergunta ÔÇö configura├º├úo ├® "para a vida ├║til do device"
- Se usu├írio quiser mudar: `/admin/settings` continua funcionando

### Autentica├º├úo p├│s-pull do LAN

**Op├º├úo A (escolhida): Senha local via bcrypt**
- Usu├írio seleciona usu├írio do LAN ÔåÆ digita senha ÔåÆ app verifica `bcrypt.compare(senha, hash_senha_local)`
- `hash_senha` **n├úo vem do LAN** ÔÇö vem do SQLite local ap├│s o pull
- Fluxo: pull LAN ÔåÆ usu├írios no SQLite ÔåÆ login local normal

**Por que n├úo Supabase Auth (Op├º├úo B)?**
- Requer internet no first-run (LAN pode existir sem internet)
- Adiciona depend├¬ncia externa no momento mais cr├¡tico
- bcrypt local j├í existe e funciona offline

---

## Abordagem H├¡brida: Modal + Seed JSON Opcional

### Fluxo Unificado

```
1. App inicia ÔåÆ SQLite vazio (COUNT(usuarios) = 0)
2. FirstRunSetupModal abre Step 1: LAN path + [Testar]
3. Ao testar com sucesso:
   a) Salva lan_sync_path em tbl_configuracoes_sistema
   b) Tenta ler seed: LAN_PATH/shared/expected_users.json
   c) Se seed EXISTE:
        - L├¬ JSON ÔåÆ cria usu├írios no SQLite (bcrypt hash das senhas)
        - Step 2: Mostra lista dos usu├írios DO SEED para login
   d) Se seed N├âO EXISTE:
        - LanDomainSyncService.pullAllUsers() ÔåÆ puxa usuarios/index.json + {id}.json
        - Step 2: Mostra lista dos usu├írios DO LAN para login
4. Se LAN vazio/erro (pull retorna 0 usu├írios):
   - Step 2: Fallback "Criar primeiro admin" (fluxo atual)
5. Usu├írio seleciona + senha ÔåÆ login ÔåÆ sess├úo iniciada
```

### Formato do Seed JSON (`shared/expected_users.json`)

```json
{
  "version": 1,
  "created_at": "2026-06-11T10:00:00Z",
  "users": [
    {
      "id": "018f3a2c-...",           // UUID v7 (opcional, gera se ausente)
      "nome": "Jo├úo Silva",
      "username": "joao.silva",
      "password": "SenhaForte123",   // em claro ÔÇö app faz bcrypt no primeiro load
      "perfil": "admin",
      "setor": "TI",
      "ativo": true
    },
    {
      "id": "019a4b5d-...",
      "nome": "Maria Santos",
      "username": "maria.santos",
      "password": "OutraSenha456",
      "perfil": "operador",
      "setor": "Obras",
      "ativo": true
    }
  ]
}
```

**Regras do seed:**
- `password` em claro ÔåÆ app gera `hash_senha` (bcrypt) + `sal_sync` (random) no primeiro load
- `id` opcional (UUID v7) ÔÇö se ausente, app gera
- Seed ├® **consumido uma vez** ÔÇö ap├│s criar usu├írios, app pode renomear para `expected_users.json.consumed` ou ignorar em runs futuras
- Seed **n├úo substitui** o pull normal do LAN ÔÇö ├® apenas bootstrap inicial para evitar primeiro login manual

### Vantagens da abordagem h├¡brida

| Cen├írio | Comportamento |
|---|---|
| Org com seed preparado | Device novo ÔåÆ path LAN ÔåÆ seed cria usu├írios ÔåÆ login imediato |
| Org sem seed (LAN j├í populado) | Device novo ÔåÆ path LAN ÔåÆ pull normal do LAN ÔåÆ login |
| Primeiro device da hist├│ria | Device novo ÔåÆ path LAN vazio/erro ÔåÆ fallback criar admin local |
| Device offline total | N├úo abre modal (COUNT > 0) ou fallback admin local |

---

## Implementa├º├úo ÔÇö Fases

### Fase 1 ÔÇö Estender `FirstRunSetupModal` com Stepper + Seed (escopo imediato)

| Arquivo | Mudan├ºa |
|---|---|
| `components/auth/FirstRunSetupModal.tsx` | Stepper: Step 1 (LAN path + testar + tentar seed), Step 2 (lista usu├írios do seed OU pull LAN OU criar admin) |
| `infrastructure/storage/LanFileStorage.ts` | Novo `readExpectedUsersSeed(): Promise<SeedUser[]>` ÔÇö l├¬ `shared/expected_users.json`; `listUsersFromLan(): Promise<UserSummary[]>` ÔÇö pull normal via index.json |
| `infrastructure/sync/LanDomainSyncService.ts` | Novo `pullAllUsers(): Promise<User[]>` ÔÇö orquestra pull completo via LanFileStorage |
| `infrastructure/container` | Garantir `LanFileStorage` instanci├ível sem sync ativo (j├í ├® o caso) |
| `app/login/page.tsx` | Callback `onComplete(user)` recebe usu├írio logado para iniciar sess├úo |
| `infrastructure/persistence/sqlite/SqliteUserRepository.ts` | Novo `createUserFromSeed(user: SeedUser): Promise<void>` ÔÇö bcrypt hash + insert |

### Fase 2 ÔÇö Valida├º├úo robusta do path LAN

| Arquivo | Mudan├ºa |
|---|---|
| `src-tauri/src/commands/lan_storage.rs` | Novo comando `lan_test_path(path: String) -> Result<bool>` ÔÇö valida sem side effects |
| `infrastructure/storage/LanFileStorage.testConnection()` | Usar o novo comando Rust (j├í existe l├│gica similar) |

### Fase 3 ÔÇö Fallback Supabase (opcional, futuro)

| Arquivo | Mudan├ºa |
|---|---|
| `FirstRunSetupModal` | Radio: "LAN (rede local)" / "Supabase (nuvem)" |
| Se Supabase: | Tenta `supabase.auth.signInWithPassword()` ÔåÆ se ok, pula LAN |

---

## Perguntas Pendentes (Decis├Áes Necess├írias)

| # | Pergunta | Op├º├Áes | Recomenda├º├úo |
|---|---|---|---|
| **1** | **Autentica├º├úo do usu├írio puxado do LAN**: bcrypt local (A) vs Supabase Auth (B) vs PIN (C) | A: offline, usa infra existente / B: cloud, requer internet / C: novo mecanismo | **A** ÔÇö mant├®m offline-first, bcrypt j├í existe |
| **2** | **Ordem de tentativa**: LAN primeiro, depois Supabase fallback? Ou radio no modal? | Radio expl├¡cito (usu├írio escolhe) / Auto: tenta LAN, falha ÔåÆ Supabase | **Radio expl├¡cito** ÔÇö evita tentativas desnecess├írias, UX clara |
| **3** | **Validar path no Rust vs TypeScript**: `lan_test_path` invoke vs `testConnection()` atual | Rust (acesso real ao FS) / TS (wrapper do invoke) | **Rust** ÔÇö valida├º├úo real, evita false positives |
| **4** | **M├║ltiplos usu├írios no LAN**: mostrar todos ou filtrar por perfil `admin`? | Todos / S├│ admins / Todos com badge de perfil | **Todos com badge** ÔÇö operador pode ser o primeiro a configurar |
| **5** | **Senha do primeiro admin (fallback LAN vazio)**: exigir complexidade atual (8 chars, letras+n├║meros)? | Manter / Simplificar (s├│ 6 chars) | **Manter** ÔÇö seguran├ºa consistente |
| **6** | **Migra├º├úo devices existentes**: devices com `lan_sync_path` j├í salvo pulam o modal? | Sim (comportamento atual correto) | **Sim** ÔÇö `COUNT(usuarios) > 0` j├í evita o modal |
| **7** | **Org config no Supabase**: guardar `lan_sync_path` no `shared/org_config.json` para auto-descoberta futura? | Sim (ADR futuro) / N├úo | **Sim, mas ADR separado** ÔÇö este ADR resolve first-run; auto-descoberta ├® evolu├º├úo |

---

## Rastreabilidade

| Componente Afetado | User Story / Gap |
|---|---|
| `FirstRunSetupModal` | Elimina bootstrap admin tempor├írio |
| `LanFileStorage` / `LanDomainSyncService` | Pull de usu├írios no first-run |
| `tbl_configuracoes_sistema` | `lan_sync_path` persistido no primeiro uso |
| `app/login/page.tsx` | Integra├º├úo do callback de sucesso |

---

## O que N├âO faz parte deste ADR

- **Auto-descoberta de LAN via mDNS/broadcast** ÔÇö complexo em Windows, ADR futuro se necess├írio
- **Supabase como fonte prim├íria de `lan_sync_path`** ÔÇö `StorageBootstrapService` j├í cria `org_config.json`, mas n├úo guarda path LAN; ADR separado
- **Migra├º├úo de dados de devices ├│rf├úos** ÔÇö devices sem LAN nem internet usam fallback (criar admin local)
- **Criptografia do path LAN** ÔÇö path n├úo ├® segredo; armazenado em config local

---

## Crit├®rios de Aceite

1. [ ] Device novo (SQLite vazio) abre modal ÔåÆ Step 1 pede LAN path
2. [ ] Bot├úo "Testar" valida path via Rust ÔåÆ sucesso habilita "Avan├ºar" + salva `lan_sync_path`
3. [ ] Step 1 tenta ler `shared/expected_users.json` (seed)
4. [ ] Se seed existe: cria usu├írios no SQLite (bcrypt hash) ÔåÆ Step 2 lista usu├írios DO SEED
5. [ ] Se seed n├úo existe: `pullAllUsers()` do LAN ÔåÆ Step 2 lista usu├írios DO LAN
6. [ ] Selecionar usu├írio + senha correta ÔåÆ login direto, sess├úo iniciada
7. [ ] `lan_sync_path` salvo em `tbl_configuracoes_sistema`
8. [ ] LAN Sync ativo ap├│s login (pull completo de usu├írios + outros dom├¡nios)
9. [ ] Fallback: LAN vazio/erro (0 usu├írios) ÔåÆ Step 2 mostra "Criar primeiro admin" (fluxo atual)
10. [ ] Device com usu├írios existentes **n├úo** mostra modal
