# ADR-046: Gaps identificados no módulo Usuários

**Data:** 2026-05-29  
**Status:**Implementado**
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** domain/user, application/user, SqliteUserRepository, AuthContext, login/page, users/page, UserDialog, useAdminUsers, usePermissions, AccessPolicy, AccessFilterBuilder, SupabaseUserSyncService, queries/usuarios.ts  
**ADRs relacionados:** ADR-023 (RBAC), ADR-038/039/041/042 (gaps sistêmicos)

---

## Contexto

O módulo de usuários é a fundação do sistema: todo controle de acesso, visibilidade de dados e auditoria depende do `user` autenticado. A análise cobre desde o domínio (`User.ts`) até as consequências downstream: `AccessFilterBuilder`, `buildTaskAccessFilter`, `buildInboxAccessFilter`, e como o `perfil` do usuário afeta visibilidade de tarefas, inbox, suítes e manifestações em todo o app.

O módulo tem boa estrutura de domínio (entity, repository interface, 4 use cases). Os problemas estão concentrados em **segurança** (hash em localStorage, auto-signup Supabase, debug log), **bypass de arquitetura** (login/page acessa banco bruto, AuthContext instancia repositório fora do container), e **correctness** (N+1 queries, query SQL com coluna inexistente, email não mapeado).

---

## Mapa de Dependências (Downstream)

```
User (autenticado)
  ├── usePermissions(user) → hasPermission, canEditUser, canEditData
  │     └── PermissionActionAdapter (globalPermissionRegistry)
  ├── AuthContext.permissions → usado em ~15 componentes/pages
  ├── AccessFilterBuilder
  │     ├── buildTaskAccessFilter(userId, perfil, sectors)
  │     │     └── SqliteKanbanRepository, SqliteTaskRepository → filtra tarefas visíveis
  │     ├── buildRecordAccessFilter(userId, perfil, sectors)
  │     │     └── SqliteInboxRepository → filtra suítes visíveis
  │     └── buildInboxAccessFilter(userId, perfil, sectors)
  │           └── SqliteInboxRepository → filtra inbox
  ├── SectorQueryUtils.getEffectiveSectors(userId)
  │     └── todos os repositórios que aplicam filtro horizontal de setor
  └── ActionRegistry (ActionContext.userId, ActionContext.targetType)
```

---

## Inventário por Camada

### Domain — ✅ Bem estruturado (com uma ressalva)

| Arquivo | Status |
|---------|--------|
| `User.ts` | ✅ Value object correto; `toggleActive()`, `update()` sem efeitos colaterais |
| `UserRepository.ts` | ✅ Interface pura, 5 métodos |
| `AccessPolicy.ts` | ✅ Funções puras; hierarquia declarativa |

**Ressalva:** `admin` não pode criar outro `admin` (ver Gap 8).

### Application — ⚠️ Use cases corretos; validação duplicada na UI

| Arquivo | Status |
|---------|--------|
| `CreateUserUseCase.ts` | ✅ Valida perfil via `AccessPolicy`; usa `ValidationError`/`ForbiddenError` |
| `UpdateUserUseCase.ts` | ✅ Correto |
| `ToggleUserStatusUseCase.ts` | ✅ |
| `ListUsersUseCase.ts` | ✅ |
| `users/page.tsx` | ❌ Re-implementa validação de perfil do `UpdateUserUseCase` com `as any` |

### Infrastructure — 🔴 N+1 + query com coluna inválida

| Arquivo | Status | Gap |
|---------|--------|-----|
| `SqliteUserRepository.findAll()` | 🔴 | N+1 queries: `fetchSetores` por usuário em loop sequencial |
| `queries/usuarios.ts USUARIOS_POR_SETOR` | 🔴 | `JOIN setores ON s.id = u.setor_id` — coluna `setor_id` não existe em `usuarios` |
| `SqliteUserRepository.save()` (INSERT) | ⚠️ | Cria `syncSalt` com `crypto.getRandomValues` — correto, mas não testável sem mock |

### Auth / Interface — 🔴 Múltiplos problemas de segurança

| Arquivo | Status | Gap |
|---------|--------|-----|
| `AuthContext.tsx` | 🔴 | Persiste `password_hash` em localStorage; cria repositório fora do container |
| `login/page.tsx` | ~~🔴~~ ✅ | ~~Acessa banco via `db_query` raw; retorna `hash_senha` no objeto User~~ → RESOLVIDO em `6724cc8` (P3 batch 1) — agora usa `countUsuarios()` (catalog `USUARIOS_COUNT`) para first-run detection; `getContainerAsync` redundante removido |
| `AuthContext.syncSupabaseAuth` | 🔴 | Auto-provisiona contas Supabase em signIn failure |
| `UserDialog.tsx` | ~~🔴~~ ✅ | ~~`console.log` de debug com dados do usuário; `alert()` 2×; loads setores via `db_query` raw~~ → RESOLVIDO em `1ab74a8` (P3 batch 5a) — agora usa `fetchSetoresAll()` (catalog `SETORES_ALL`) + `fetchEscalas()` (catalog `ESCALAS_LIST`); `useTauriInvoke`/`invoke`/`QueryResult` deletados |
| `users/page.tsx` | ⚠️ | `alert()` 4×; valida perfil duplicando lógica do use case |
| `useAdminUsers.normalizeUser` | ⚠️ | `email` não mapeado do `UserDto` para `User` |

---

## Gaps Detalhados

### Gap 1 — `password_hash` persistido em localStorage (Crítico — Segurança)

**Arquivo:** `login/page.tsx:104–107`, `AuthContext.tsx:103`

```typescript
// login/page.tsx — retorna hash_senha no objeto User
if (!userObj.password_hash && userObj.hash_senha) {
    userObj.password_hash = userObj.hash_senha;  // ← inclui bcrypt hash
}
user = userObj as unknown as User;

// AuthContext.tsx — serializa o objeto User completo no localStorage
localStorage.setItem("ecoforms_user", JSON.stringify(userData));
// ↑ persiste { id, nome, username, perfil, password_hash: "$2b$10$..." }
```

O bcrypt hash da senha fica em `localStorage["ecoforms_user"]` após cada login. Embora bcrypt seja resistente a reversão, expor o hash:
- Permite ataques offline de força bruta sem limite de tentativas
- Persiste indefinidamente (sem TTL) mesmo após logout — `logout()` só faz `removeItem` se o usuário fizer logout explícito; crash ou fechamento sem logout mantém o hash no disco
- Em ambientes de desktop/Tauri, localStorage é um arquivo de texto legível no sistema de arquivos do usuário

**Decisão:** O objeto `User` não deve conter `password_hash`. A verificação de senha é feita pelo Rust (`verify_password`); após a verificação, o hash não precisa ser carregado no contexto React.

```typescript
// login/page.tsx — após verificar senha, remover hash do objeto persistido
const { hash_senha, password_hash, ...safeUser } = userObj;
user = safeUser as User;
login(user, password);  // login salva safeUser (sem hash) no localStorage
```

---

### Gap 2 — ~~Login acessa banco via `db_query` raw, bypassa arquitetura~~ ✅ **RESOLVIDO** em `6724cc8` (P3 batch 1)

**Status:** O componente `app/login/page.tsx` foi migrado em `6724cc8` (P3 batch 1 do refactor P3). O `invoke<QueryResult>('db_query', { sql: 'SELECT COUNT(*) FROM usuarios' })` foi substituído por `countUsuarios()` da fachada `lookups.ts`, que internamente usa o catalog `USUARIOS_COUNT`. `getContainerAsync` redundante removido (a função `countUsuarios` já chama o container internamente), assim como `useTauriInvoke` e a interface inline `QueryResult`.

**Commit:** `6724cc8 refactor(sql): P3 batch 1 — app/login (countUsuarios) + app/forms/edit (fetchFormByIdOrSlug)`

**NOTA:** Gap 2 cobria o padrão de `db_query` raw **para first-run detection** (count usuarios). O concern separado de carregar usuário por username (`SELECT * FROM usuarios WHERE nome_usuario = ?` para auth) continua como oportunidade de improvement (Gap 2-bis) — a auth de login ainda usa `db_login` Tauri command (que é o padrão correto), mas o fetch do objeto User pós-auth passa por `AuthContext` e não pelo repository.

**Arquivo:** `login/page.tsx:85–122`

```typescript
// ❌ Invoke direto ao Tauri, fora de toda a camada de domínio/infra
const result = await invoke<QueryResult>('db_query', {
    sql: `SELECT * FROM usuarios WHERE nome_usuario = ? LIMIT 1`,
    params: [username.trim()]
});
// Faz mapeamento manual de colunas por índice
result.columns.forEach((col, idx) => { userObj[col] = row[idx]; });
```

Problemas:
- Retorna `SELECT *` incluindo `hash_senha`, `sal_sync` — colunas sensíveis que não deveriam chegar ao frontend
- Mapeamento `columns.forEach((col, idx)` é frágil — se a ordem de colunas mudar no schema, o mapeamento silha
- Bypassa `SqliteUserRepository.findById()` que já existe e tem tipagem correta

**Decisão:** Usar `container.userRepository.findById()` após resolver username → id, ou adicionar `findByUsername(username)` ao `UserRepository`:

```typescript
// UserRepository.ts (adicionar)
findByUsername(username: string): Promise<User | null>;

// login/page.tsx
const container = await getContainerAsync();
const user = await container.userRepository.findByUsername(username.trim());
```

A verificação de senha (`verify_password`) continua via Tauri invoke — mas o carregamento do usuário passa pelo repositório tipado.

---

### Gap 3 — `syncSupabaseAuth` auto-provisiona contas em falha de signIn (Crítico — Segurança)

**Arquivo:** `AuthContext.tsx:42–58`

```typescript
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
    // ❌ Cria conta Supabase automaticamente para qualquer usuário local que falhar no signIn
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
}
```

Qualquer usuário local pode criar uma conta Supabase simplesmente fazendo login enquanto online, sem aprovação administrativa. O email sintético `${username}@ecoforms.local` não existe em nenhum domínio controlado.

Consequências:
- Contas Supabase proliferam sem controle — qualquer usuário local cria uma conta Supabase na primeira vez que fizer login online
- Se o Supabase tiver RLS baseado em `auth.uid()`, contas não autorizadas ganham acesso
- Viola o princípio de que usuários são gerenciados pelo admin no desktop

**Decisão:** Remover o `signUp` automático. Se o signIn falhar, apenas logar o aviso:

```typescript
if (signInError) {
    console.warn('[Auth] Supabase signIn failed (não-fatal):', signInError.message);
    // Sem signUp automático — contas Supabase devem ser criadas pelo admin
}
```

---

### Gap 4 — `console.log` de debug persiste em produção com dados sensíveis (Crítico)

**Arquivo:** `UserDialog.tsx:146`

```typescript
console.log("🔍 DEBUG - UserDialog submitting:", JSON.stringify(dataToSave, null, 2));
```

`dataToSave` pode conter `password_hash` se o usuário alterou a senha. Esse log:
- Expõe hash de senha no console (visível em DevTools, capturado por ferramentas de logging)
- Usa emoji — violação da política de estilo
- É explicitamente um debug statement que não deveria estar em produção

**Decisão:** Remover a linha completamente.

---

### Gap 5 — N+1 queries em `SqliteUserRepository.findAll()` (Importante)

**Arquivo:** `SqliteUserRepository.ts:43–53`

```typescript
async findAll(): Promise<User[]> {
    const rows = await this.db.query<UserRow>('SELECT ... FROM usuarios ORDER BY nome');
    for (const row of rows) {
        const setores = await this.fetchSetores(row.id);  // ❌ await em loop
        result.push(rowToUser(row, setores));
    }
}
```

Para N usuários → N+1 queries. Com 50 usuários, `findAll()` executa 51 queries sequenciais — chamado em toda montagem de `users/page.tsx`.

**Decisão:** Single query com JOIN:

```typescript
async findAll(): Promise<User[]> {
    const rows = await this.db.query<UserRow & { setores_ids: string | null }>(
        `SELECT u.${SELECT_COLS},
                GROUP_CONCAT(us.setor_id) AS setores_ids
         FROM usuarios u
         LEFT JOIN usuarios_setores us ON us.usuario_id = u.id
         GROUP BY u.id
         ORDER BY u.nome`,
    );
    return rows.map(row => rowToUser(row, row.setores_ids ? row.setores_ids.split(',') : []));
}
```

Mesmo padrão deve ser aplicado a `findById`.

---

### Gap 6 — `USUARIOS_POR_SETOR` usa coluna inexistente `u.setor_id` (Importante)

**Arquivo:** `src/infrastructure/persistence/sqlite/queries/usuarios.ts:25–40`

```sql
SELECT COALESCE(s.descricao, 'Sem setor') AS setor, COUNT(u.id) AS total
FROM usuarios u
LEFT JOIN setores s ON s.id = u.setor_id   -- ❌ coluna u.setor_id não existe
WHERE u.ativo = 1
GROUP BY u.setor_id
```

`SqliteUserRepository` usa `usuarios_setores (usuario_id, setor_id)` como tabela de junção. A coluna `setor_id` **não existe** em `usuarios`. Esta query retorna `'Sem setor'` para todos os usuários, ou lança erro dependendo da versão SQLite/modo de erro.

**Decisão:**

```sql
SELECT COALESCE(s.nome, 'Sem setor') AS setor, COUNT(DISTINCT u.id) AS total
FROM usuarios u
LEFT JOIN usuarios_setores us ON us.usuario_id = u.id
LEFT JOIN setores s ON s.id = us.setor_id
WHERE u.ativo = 1
GROUP BY s.id
ORDER BY total DESC
```

---

### Gap 7 — `alert()` em 7+ lugares do fluxo de usuários (Importante — Tauri)

**Arquivos:** `users/page.tsx:43,52,63,70`, `UserDialog.tsx:120,154`

```typescript
alert("Você não tem permissão para criar usuários")
alert("Você não tem permissão para editar este usuário")
alert("Erro ao alterar status do usuário")
alert("Preencha campos obrigatórios (Nome, Usuário)")
alert(`Erro ao salvar usuário: ${errorMessage}`)
```

`window.alert()` não funciona de forma confiável em webviews Tauri desktop — o mesmo problema identificado com `window.confirm()` no módulo Clientes (ADR-042 Gap 3).

**Decisão:** Substituir por `toast.error()` do Sonner (já usado no restante do sistema):

```typescript
// ❌
alert("Você não tem permissão para criar usuários")

// ✅
toast.error("Sem permissão para criar usuários")
return
```

---

### Gap 8 — `AuthContext.syncUsersFromSupabase` instancia repositório fora do container (Importante)

**Arquivo:** `AuthContext.tsx:29–35`

```typescript
const container = getContainer();
const userRepo = new SqliteUserRepository(container.sqlite);  // ❌ nova instância
const syncService = new SupabaseUserSyncService(userRepo, container.sqlite);
```

O `SqliteUserRepository` do container registra um `onUserChanged` callback que invalida o cache de setores (`invalidateSectorCache`). A instância criada diretamente em `AuthContext` não tem esse callback — usuários sincronizados via Supabase não invalidam o cache de setores, potencialmente causando dados desatualizados.

**Decisão:** Usar o repositório do container:

```typescript
const container = getContainer();
const syncService = new SupabaseUserSyncService(container.userRepository, container.sqlite);
```

Requer que `container.userRepository` seja exposto (verificar `container.ts`).

---

### Gap 9 — `email` não mapeado em `normalizeUser` (Importante)

**Arquivo:** `useAdminUsers.ts:18–28`

```typescript
function normalizeUser(user: UserDto): User {
    return {
        id: user.id,
        username: user.username,
        nome: user.nome,
        perfil: normalizePerfil(user.perfil),
        ativo: Boolean(user.ativo),
        created_at: user.criadoEm ?? "",
        setores: user.setores,
        // ❌ email: user.email — ausente
    };
}
```

`UserDto.email` existe, o `User` type em `@/types` tem `email?: string`, mas `normalizeUser` não mapeia o campo. Após carregar a lista de usuários via `useAdminUsers`, todos os `user.email` são `undefined` na UI, mesmo quando cadastrados.

Consequência: `UserDialog` pré-preenche email como `""` (não como o email real do usuário ao editar).

**Decisão:**

```typescript
function normalizeUser(user: UserDto): User {
    return {
        ...
        email: user.email,
        setores: user.setores,
    };
}
```

---

### Gap 10 — Sem verificação de unicidade de `nome_usuario` (Importante)

**Arquivo:** `CreateUserUseCase.ts`, `SqliteUserRepository.ts`

Nenhum ponto do fluxo verifica se o `username` já existe antes de inserir. A constraint de unicidade depende inteiramente do schema SQLite. Se não houver `UNIQUE` index em `usuarios.nome_usuario`, dois usuários com o mesmo username podem ser criados — o login retornará o primeiro com `LIMIT 1`, tornando o segundo inacessível.

**Decisão:** Adicionar ao repositório:

```typescript
// UserRepository.ts
usernameExists(username: string, excludeId?: string): Promise<boolean>;

// CreateUserUseCase.ts
if (await this.repo.usernameExists(input.username)) {
    throw new ValidationError(`Username '${input.username}' já está em uso`);
}
```

---

### Gap 11 — ~~`UserDialog` carrega setores via `db_query` raw~~ ✅ **RESOLVIDO** em `1ab74a8` (P3 batch 5a)

**Status:** O componente `components/users/UserDialog.tsx` foi migrado em `1ab74a8` (P3 batch 5a do refactor P3). O `invoke<QueryResult>('db_query', { sql: 'SELECT id, nome FROM setores ORDER BY nome' })` foi substituído por `fetchSetoresAll()` da fachada `lookups.ts`, que usa o catalog `SETORES_ALL` (sem filtro de ativo, para o editor que precisa ver todos). Similarmente, o `invoke<QueryResult>('db_query', { sql: 'SELECT id, nome FROM escalas ORDER BY nome' })` foi substituído por `fetchEscalas()` (catalog `ESCALAS_LIST` no novo arquivo `escalas.ts`). `useTauriInvoke`, `invoke`, e a interface inline `QueryResult` foram deletados do componente.

**Commit:** `1ab74a8 refactor(sql): P3 batch 5a — components reads (UserDialog, TaskEntries, EditTask, FirstRun)`

```typescript
import { useSetores } from '@/src/interface/hooks/queries/useSetores';
const { data: availableSectors } = useSetores();
```

---

### Gap 12 — Validação de perfil duplicada na UI (Médio)

**Arquivo:** `users/page.tsx:79–96`

```typescript
// ❌ Reimplementação parcial do que UpdateUserUseCase já faz
if (userData.perfil && userData.perfil !== selectedUser.perfil) {
    const newRole = userData.perfil as any;
    const isElevation = ['admin', 'gerente'].includes(newRole);
    if (isElevation && !isAdmin) {
        throw new Error("Apenas administradores podem elevar...");
    }
    if (isManager && !isAdmin && newRole === 'gerente') {
        throw new Error("Gerentes não podem elevar para Gerente...");
    }
}
```

`UpdateUserUseCase.execute(input, actorPerfil)` já lança `ForbiddenError` com a mesma lógica via `AccessPolicy.roleLevel`. A UI duplica a regra com `as any` e lógica manual inconsistente (ex: não cobre `encarregado` → `admin`).

**Decisão:** Remover a validação manual da UI. Deixar o use case lançar `ForbiddenError` e capturá-lo no `catch`:

```typescript
const handleSave = async (userData: Partial<User>) => {
    try {
        if (selectedUser) await updateUser(selectedUser.id, userData);
        else await createUser(userData);
        await loadUsers();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    }
};
```

---

### Gap 13 — `admin` não pode criar outro `admin` (Médio — pode ser by design)

**Arquivo:** `CreateUserUseCase.ts:17–21`

```typescript
if (targetLevel <= actorLevel) {
    throw new ForbiddenError(...);
}
// admin=0, targetLevel(admin)=0, actorLevel(admin)=0 → 0 <= 0 → true → ForbiddenError
```

Um `admin` não pode criar outro `admin` pelo fluxo normal. Apenas o `FirstRunSetupModal` (que usa Tauri `create_admin_user` command direto) pode criar o primeiro admin.

**Decisão:** Se for intencional, documentar explicitamente. Se não, mudar para `targetLevel < actorLevel` (strict less-than) para permitir que admin crie outros admins.

---

### Gap 14 — Session validation lê banco diretamente (Médio)

**Arquivo:** `AuthContext.tsx:166–178`, `193–205`

```typescript
sqlite.query<{ ativo: number | boolean }>(
    'SELECT ativo FROM usuarios WHERE id = ? LIMIT 1',
    [userId]
)
```

A validação periódica de sessão (montagem e a cada 5min) acessa o banco diretamente via `useSqlite()` hook em vez de usar `UserRepository.findById()`. É uma violação de camada — mas o risco é baixo pois é read-only e simples.

**Decisão:** Baixa prioridade. Pode ser deixado como está até que o `UserRepository` seja exposto no contexto de forma mais ergonômica.

---

### Gap 15 — `User` type em `@/types` diverge de `UserProps` em domain (Médio)

`@/types` (Next.js) define `User` com campos como `created_at`, `password`, `password_hash`, `setores`. O domain `User.ts` usa `UserProps` com `criadoEm`, `passwordHash`, `setores`. São dois contratos paralelos para o mesmo conceito — `useAdminUsers.normalizeUser` faz a tradução manualmente.

Consequências: ao adicionar um campo ao domain `User`, é preciso atualizar o `@/types` e `normalizeUser` — três lugares.

**Decisão:** Registrar como dívida técnica a unificar quando o backend Tauri for refatorado. Curto prazo: garantir que `normalizeUser` sempre mapeie todos os campos (corrigir o email do Gap 9).

---

## Consequências Downstream do `user.perfil`

O `perfil` do usuário autenticado afeta as seguintes queries em cascata:

| Componente / Query | Impacto do `perfil` |
|-------------------|---------------------|
| `buildTaskAccessFilter` | `admin` → sem filtro; outros → filtro por `criado_por`, `atribuido_para`, perfis subordinados |
| `buildRecordAccessFilter` | Filtra suítes visíveis por `getAccessiblePerfis(perfil)` |
| `buildInboxAccessFilter` | `admin` → tudo; `gerente` → setor compartilhado; outros → tarefas atribuídas |
| `getEffectiveSectors` (SectorQueryUtils) | Determina setores efetivos para filtro horizontal |
| `usePermissions.hasPermission` | Toda permissão do app passa por aqui |
| `usePermissions.canEditData` | Janela de edição: coordenador=48h, operador/campo=24h, admin/gerente=sempre |
| `ActionRegistry.getAvailableActions` | Filtra ações disponíveis por `requiredRoles` |

**Implicação dos gaps 1 e 2:** se `perfil` no `localStorage` for adulterado (o objeto é JSON sem assinatura), o usuário pode escalar privilégios no contexto React — embora o Tauri/Rust valide `perfil` novamente em cada comando via `check_permission`.

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço |
|---|-----|-----------|-----------|---------|
| 1 | `password_hash` em localStorage | Crítico | `login/page.tsx`, `AuthContext.tsx:103` | Baixo |
| 2 | Login via `db_query` raw (SELECT *) | Crítico | `login/page.tsx:85` | Médio |
| 3 | Auto-signup Supabase em falha de login | Crítico | `AuthContext.tsx:46` | Trivial |
| 4 | `console.log` de debug com dados sensíveis | Crítico | `UserDialog.tsx:146` | Trivial |
| 5 | N+1 queries em `findAll()` | Importante | `SqliteUserRepository.ts:44` | Baixo |
| 6 | `USUARIOS_POR_SETOR` coluna inexistente | Importante | `queries/usuarios.ts:25` | Baixo |
| 7 | `alert()` 7× — não funciona em Tauri | Importante | `users/page.tsx`, `UserDialog.tsx` | Baixo |
| 8 | Repositório instanciado fora do container | Importante | `AuthContext.tsx:31` | Baixo |
| 9 | `email` não mapeado em `normalizeUser` | Importante | `useAdminUsers.ts:18` | Trivial |
| 10 | Sem unicidade de `nome_usuario` | Importante | `CreateUserUseCase.ts` | Médio |
| 11 | `UserDialog` carrega setores via `db_query` | Médio | `UserDialog.tsx:73` | Baixo |
| 12 | Validação de perfil duplicada na UI | Médio | `users/page.tsx:79` | Baixo |
| 13 | `admin` não cria outro `admin` | Médio | `CreateUserUseCase.ts:17` | Trivial |
| 14 | Session validation lê DB diretamente | Médio | `AuthContext.tsx:166` | Baixo |
| 15 | Dois tipos `User` divergentes | Médio | `@/types` vs `UserProps` | Alto |

**Gaps 3 e 4 são triviais e devem ser feitos imediatamente — uma linha cada.**  
**Gap 1 é o mais urgente em termos de segurança — o hash de senha não deve sair do processo Rust.**  
**Gap 6 é um bug silencioso que retorna dados errados em qualquer dashboard que use `USUARIOS_POR_SETOR`.**

---

## O que está bem (não tocar)

- `AccessPolicy.ts` — hierarquia declarativa, funções puras, testável
- `AccessFilterBuilder` — `buildTaskAccessFilter`, `buildRecordAccessFilter`, `buildInboxAccessFilter` corretamente parametrizados
- `CreateUserUseCase` / `UpdateUserUseCase` — validação de hierarquia de perfis via `roleLevel` está correta
- `SqliteUserRepository.assignSectors` — usa `transaction()` para atomicidade; invalida cache de setores
- `AuthContext` — timeout de inatividade (30min), revalidação periódica (5min), retry de Supabase ao voltar online
- `SupabaseUserSyncService` — tratamento de erros por perfil com `result.errors[]`; não falha todo o sync por um perfil

## Relação com ADRs Existentes

- **ADR-023 (RBAC Fase 2):** gaps 1 e 2 (hash em localStorage, SELECT * no login) são bloqueantes para qualquer endurecimento de segurança do RBAC — resolver antes da Fase 2
- **ADR-038/039/041/042:** gaps 7 (`alert()`) e 4 (`console.log` debug) seguem o padrão sistêmico identificado nos módulos anteriores
- **PLANO_SQL_DESACOPLAMENTO:** gap 6 (`USUARIOS_POR_SETOR` com SQL inválido) e gap 11 (`db_query` raw no dialog) ~~são candidatos diretos ao QueryCatalog (ADR-031-desktop)~~ → **RESOLVIDO** em `1ab74a8` (P3 batch 5a) via `lookups.ts` fachada (`fetchSetoresAll` + `fetchEscalas` + catalogs `SETORES_ALL` e `ESCALAS_LIST`)
