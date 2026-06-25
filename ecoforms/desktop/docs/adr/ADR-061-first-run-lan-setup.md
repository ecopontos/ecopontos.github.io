# ADR-061 — First-Run Setup com Descoberta de Caminho LAN

**Status:** Proposto  
**Data:** 2026-06-11  
**Autor:** Marcelo Luiz  
**Contexto externo:** Substitui o bootstrap admin temporário por configuração de LAN path no primeiro acesso, com seed opcional via JSON.

---

## Contexto

### O que existe hoje

| Etapa | Comportamento | Problema |
|---|---|---|
| 1. Device novo (SQLite vazio) | `FirstRunSetupModal` cria **admin local temporário** via `create_first_admin` | Admin "fake" serve só para entrar em `/admin/settings` |
| 2. Admin loga | Acessa `/admin/settings` → digita `lan_sync_path` manualmente | Passo manual, propenso a erro, UX ruim |
| 3. Sync LAN inicia | `LanDomainSyncService` puxa `usuarios/index.json` + `{id}.json` | Admins reais do LAN sobrescrevem o fake |
| 4. Device pronto | Usuários reais disponíveis | Admin fake descartado implicitamente |

### Problema

- **Duas identidades**: admin temporário (local) vs admins reais (LAN) — confusão
- **Configuração manual obrigatória**: admin precisa saber o UNC path (`\\servidor\ecoforms`)
- **Sem validação prévia**: path inválido só descoberto depois do login
- **Credenciais do LAN não disponíveis no first-run**: snapshots LAN não têm `hash_senha`/`sal_sync` (removidos no `UserSnapshotService`)

---

## Decisão

### Novo Fluxo de First-Run (Stepper no `FirstRunSetupModal`)

```
┌─────────────────────────────────────────────────────────────┐
│  FIRST-RUN SETUP                                            │
├─────────────────────────────────────────────────────────────┤
│  Step 1: Conexão com Dados                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Fonte dos dados:  [LAN (rede local)]  [Supabase]    │   │
│  │                                                     │   │
│  │ Se LAN:                                             │   │
│  │   Caminho: [\\servidor\ecoforms____________] [Testar]│   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                    [Avançar]                                │
├─────────────────────────────────────────────────────────────┤
│  Step 2 (se LAN encontrou usuários): Selecionar Usuário    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Encontrados 5 usuários no LAN:                      │   │
│  │  ○ joao.silva    (admin)    Setor: TI               │   │
│  │  ○ maria.santos  (operador) Setor: Obras            │   │
│  │  ...                                                │   │
│  │                                                     │   │
│  │ Senha: [___________]  [Entrar]                      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Step 2 (se LAN vazio/erro): Criar Primeiro Admin          │
│  (fluxo atual — campos: nome, username, senha, confirmar)  │
└─────────────────────────────────────────────────────────────┘
```

### Persistência

- `lan_sync_path` salvo em `tbl_configuracoes_sistema` (chave `lan_sync_path`) **no Step 1 ao testar com sucesso**
- Device nunca mais pergunta — configuração é "para a vida útil do device"
- Se usuário quiser mudar: `/admin/settings` continua funcionando

### Autenticação pós-pull do LAN

**Opção A (escolhida): Senha local via bcrypt**
- Usuário seleciona usuário do LAN → digita senha → app verifica `bcrypt.compare(senha, hash_senha_local)`
- `hash_senha` **não vem do LAN** — vem do SQLite local após o pull
- Fluxo: pull LAN → usuários no SQLite → login local normal

**Por que não Supabase Auth (Opção B)?**
- Requer internet no first-run (LAN pode existir sem internet)
- Adiciona dependência externa no momento mais crítico
- bcrypt local já existe e funciona offline

---

## Abordagem Híbrida: Modal + Seed JSON Opcional

### Fluxo Unificado

```
1. App inicia → SQLite vazio (COUNT(usuarios) = 0)
2. FirstRunSetupModal abre Step 1: LAN path + [Testar]
3. Ao testar com sucesso:
   a) Salva lan_sync_path em tbl_configuracoes_sistema
   b) Tenta ler seed: LAN_PATH/shared/expected_users.json
   c) Se seed EXISTE:
        - Lê JSON → cria usuários no SQLite (bcrypt hash das senhas)
        - Step 2: Mostra lista dos usuários DO SEED para login
   d) Se seed NÃO EXISTE:
        - LanDomainSyncService.pullAllUsers() → puxa usuarios/index.json + {id}.json
        - Step 2: Mostra lista dos usuários DO LAN para login
4. Se LAN vazio/erro (pull retorna 0 usuários):
   - Step 2: Fallback "Criar primeiro admin" (fluxo atual)
5. Usuário seleciona + senha → login → sessão iniciada
```

### Formato do Seed JSON (`shared/expected_users.json`)

```json
{
  "version": 1,
  "created_at": "2026-06-11T10:00:00Z",
  "users": [
    {
      "id": "018f3a2c-...",           // UUID v7 (opcional, gera se ausente)
      "nome": "João Silva",
      "username": "joao.silva",
      "password": "SenhaForte123",   // em claro — app faz bcrypt no primeiro load
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
- `password` em claro → app gera `hash_senha` (bcrypt) + `sal_sync` (random) no primeiro load
- `id` opcional (UUID v7) — se ausente, app gera
- Seed é **consumido uma vez** — após criar usuários, app pode renomear para `expected_users.json.consumed` ou ignorar em runs futuras
- Seed **não substitui** o pull normal do LAN — é apenas bootstrap inicial para evitar primeiro login manual

### Vantagens da abordagem híbrida

| Cenário | Comportamento |
|---|---|
| Org com seed preparado | Device novo → path LAN → seed cria usuários → login imediato |
| Org sem seed (LAN já populado) | Device novo → path LAN → pull normal do LAN → login |
| Primeiro device da história | Device novo → path LAN vazio/erro → fallback criar admin local |
| Device offline total | Não abre modal (COUNT > 0) ou fallback admin local |

---

## Implementação — Fases

### Fase 1 — Estender `FirstRunSetupModal` com Stepper + Seed (escopo imediato)

| Arquivo | Mudança |
|---|---|
| `components/auth/FirstRunSetupModal.tsx` | Stepper: Step 1 (LAN path + testar + tentar seed), Step 2 (lista usuários do seed OU pull LAN OU criar admin) |
| `infrastructure/storage/LanFileStorage.ts` | Novo `readExpectedUsersSeed(): Promise<SeedUser[]>` — lê `shared/expected_users.json`; `listUsersFromLan(): Promise<UserSummary[]>` — pull normal via index.json |
| `infrastructure/sync/LanDomainSyncService.ts` | Novo `pullAllUsers(): Promise<User[]>` — orquestra pull completo via LanFileStorage |
| `infrastructure/container` | Garantir `LanFileStorage` instanciável sem sync ativo (já é o caso) |
| `app/login/page.tsx` | Callback `onComplete(user)` recebe usuário logado para iniciar sessão |
| `infrastructure/persistence/sqlite/SqliteUserRepository.ts` | Novo `createUserFromSeed(user: SeedUser): Promise<void>` — bcrypt hash + insert |

### Fase 2 — Validação robusta do path LAN

| Arquivo | Mudança |
|---|---|
| `src-tauri/src/commands/lan_storage.rs` | Novo comando `lan_test_path(path: String) -> Result<bool>` — valida sem side effects |
| `infrastructure/storage/LanFileStorage.testConnection()` | Usar o novo comando Rust (já existe lógica similar) |

### Fase 3 — Fallback Supabase (opcional, futuro)

| Arquivo | Mudança |
|---|---|
| `FirstRunSetupModal` | Radio: "LAN (rede local)" / "Supabase (nuvem)" |
| Se Supabase: | Tenta `supabase.auth.signInWithPassword()` → se ok, pula LAN |

---

## Perguntas Pendentes (Decisões Necessárias)

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| **1** | **Autenticação do usuário puxado do LAN**: bcrypt local (A) vs Supabase Auth (B) vs PIN (C) | A: offline, usa infra existente / B: cloud, requer internet / C: novo mecanismo | **A** — mantém offline-first, bcrypt já existe |
| **2** | **Ordem de tentativa**: LAN primeiro, depois Supabase fallback? Ou radio no modal? | Radio explícito (usuário escolhe) / Auto: tenta LAN, falha → Supabase | **Radio explícito** — evita tentativas desnecessárias, UX clara |
| **3** | **Validar path no Rust vs TypeScript**: `lan_test_path` invoke vs `testConnection()` atual | Rust (acesso real ao FS) / TS (wrapper do invoke) | **Rust** — validação real, evita false positives |
| **4** | **Múltiplos usuários no LAN**: mostrar todos ou filtrar por perfil `admin`? | Todos / Só admins / Todos com badge de perfil | **Todos com badge** — operador pode ser o primeiro a configurar |
| **5** | **Senha do primeiro admin (fallback LAN vazio)**: exigir complexidade atual (8 chars, letras+números)? | Manter / Simplificar (só 6 chars) | **Manter** — segurança consistente |
| **6** | **Migração devices existentes**: devices com `lan_sync_path` já salvo pulam o modal? | Sim (comportamento atual correto) | **Sim** — `COUNT(usuarios) > 0` já evita o modal |
| **7** | **Org config no Supabase**: guardar `lan_sync_path` no `shared/org_config.json` para auto-descoberta futura? | Sim (ADR futuro) / Não | **Sim, mas ADR separado** — este ADR resolve first-run; auto-descoberta é evolução |

---

## Rastreabilidade

| Componente Afetado | User Story / Gap |
|---|---|
| `FirstRunSetupModal` | Elimina bootstrap admin temporário |
| `LanFileStorage` / `LanDomainSyncService` | Pull de usuários no first-run |
| `tbl_configuracoes_sistema` | `lan_sync_path` persistido no primeiro uso |
| `app/login/page.tsx` | Integração do callback de sucesso |

---

## O que NÃO faz parte deste ADR

- **Auto-descoberta de LAN via mDNS/broadcast** — complexo em Windows, ADR futuro se necessário
- **Supabase como fonte primária de `lan_sync_path`** — `StorageBootstrapService` já cria `org_config.json`, mas não guarda path LAN; ADR separado
- **Migração de dados de devices órfãos** — devices sem LAN nem internet usam fallback (criar admin local)
- **Criptografia do path LAN** — path não é segredo; armazenado em config local

---

## Critérios de Aceite

1. [ ] Device novo (SQLite vazio) abre modal → Step 1 pede LAN path
2. [ ] Botão "Testar" valida path via Rust → sucesso habilita "Avançar" + salva `lan_sync_path`
3. [ ] Step 1 tenta ler `shared/expected_users.json` (seed)
4. [ ] Se seed existe: cria usuários no SQLite (bcrypt hash) → Step 2 lista usuários DO SEED
5. [ ] Se seed não existe: `pullAllUsers()` do LAN → Step 2 lista usuários DO LAN
6. [ ] Selecionar usuário + senha correta → login direto, sessão iniciada
7. [ ] `lan_sync_path` salvo em `tbl_configuracoes_sistema`
8. [ ] LAN Sync ativo após login (pull completo de usuários + outros domínios)
9. [ ] Fallback: LAN vazio/erro (0 usuários) → Step 2 mostra "Criar primeiro admin" (fluxo atual)
10. [ ] Device com usuários existentes **não** mostra modal