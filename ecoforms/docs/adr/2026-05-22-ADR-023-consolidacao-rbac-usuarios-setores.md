# ADR-023 — Consolidação RBAC: Perfis de Usuário, Hierarquia, Permissões e Setores

- **Status**: **Decidido**
- **Data**: 2026-05-22 (revisado 2026-05-22 — v2 corrige auditoria anterior)
- **Autor**: Claude Code (auditoria de divergências — v2 auditada contra código real)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-009 (RBAC, referenciado mas inexistente), ADR-010 (Module Registry), ADR-014 (Adequação Arquitetural), ADR-021 (LGPD Conformidade)

---

## Nota de revisão (v2)

A versão anterior deste ADR continha divergências fabricadas a partir do CLAUDE.md desatualizado em vez do código real. Esta versão corrige o diagnóstico após auditoria direta de `scripts/ensure-columns.ts`, `src/infrastructure/persistence/sqlite/SqliteUserRepository.ts`, `src/domain/access/AccessPolicy.ts` e `src-tauri/src/database.rs`.

**Divergências removidas (não existem no código real):**
- ~~Div 2 — prefixo `tbl_` no banco~~ — `ensure-columns.ts` usa os mesmos nomes sem prefixo que o repositório (`usuarios`, `setores`, `usuarios_setores`). Não há divergência.
- ~~Div 3 — colunas `username`/`password_hash` no banco~~ — `ensure-columns.ts` define `nome_usuario`, `hash_senha`, `sal_sync`, idêntico ao repositório. Não há divergência.
- ~~Div 5 — tabelas RBAC ausentes no banco~~ — `perfis`, `hierarquia_perfis`, `permissoes`, `permissoes_modulos` existem em `ensure-columns.ts`. O problema é a ausência de seed, não de tabelas.

---

## Contexto

Auditoria do subsistema de perfis/roles encontrou **quatro divergências estruturais** reais entre o código-fonte e o schema do banco de dados. O sistema opera em `ecoforms_local_desktop.db` em pré-produção.

### Divergência 1 — Hierarquia de perfis: 6 no código, tabela sem seed no banco

**Código** (`src/domain/access/AccessPolicy.ts:8-15`):
```typescript
const ROLE_HIERARCHY: Record<Perfil, number> = {
    admin: 0,
    gerente: 1,
    coordenador: 2,
    encarregado: 3,
    operador: 4,
    campo: 4,
};
```

**Schema** (`scripts/ensure-columns.ts:95-100`):
```sql
CREATE TABLE IF NOT EXISTS hierarquia_perfis (
    perfil    TEXT PRIMARY KEY REFERENCES perfis(id),
    nivel     INTEGER NOT NULL,
    descricao TEXT
)
```

`hierarquia_perfis` é criada mas **não tem seed automático** — a tabela existe vazia. `database.rs` já a consulta nas linhas 177 e 241 (`SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1`), retornando vazio em runtime.

O mesmo vale para `perfis` (`ensure-columns.ts:84-92`): criada sem seed. Como `usuarios.perfil REFERENCES perfis(id)`, qualquer INSERT de usuário falha em sistemas com FK habilitada.

### Divergência 2 — FK `usuarios.perfil → perfis(id)` incompatível com valores armazenados

**Schema** (`ensure-columns.ts:130`):
```sql
perfil TEXT NOT NULL REFERENCES perfis(id)
```

**Repositório** (`SqliteUserRepository.ts:76`):
```typescript
[p.id, p.nome, p.username, p.email ?? null, p.perfil, ...]
// p.perfil = 'admin' | 'gerente' | ... (nome direto)
```

`perfis.id` nunca foi definido como o nome do perfil. A FK referencia `perfis(id)`, mas o repositório insere o nome do perfil como string livre (`'admin'`). Se `perfis` for seedada com `id = 'perfil-admin'`, o INSERT em `usuarios` quebrará. O design precisa decidir: `perfis.id` é o nome do perfil ou um UUID?

SQLite não valida FKs por padrão (`PRAGMA foreign_keys = OFF`) — por isso o sistema funciona agora, mas é uma bomba-relógio.

### Divergência 3 — `setor?: string` legado em `types/index.ts`

**`types/index.ts:207-208`**:
```typescript
setor?: string;    // legado — singular, não usado
setores?: string[];  // atual — M:N via usuarios_setores
```

Duas representações do mesmo conceito convivem. O schema (`ensure-columns.ts:134`) usa `setor_principal_id TEXT REFERENCES setores(id)`, não `setor TEXT` — portanto o campo singular em `types` não tem correspondência nem no schema atual nem no repositório.

### Divergência 4 — Validação de perfil inexistente no backend

`CreateUserUseCase` (`src/application/user/CreateUserUseCase.ts`) e `UpdateUserUseCase` aceitam qualquer string no campo `perfil`. Não há validação de:
- Se o perfil é um valor conhecido (`isKnownPerfil` existe em `AccessPolicy.ts` mas não é chamada)
- Se o criador tem autoridade hierárquica para atribuir aquele perfil

Essas validações existem **apenas no frontend** (`app/admin/users/page.tsx:104`). Um ataque ou bug que contorne a UI permitiria criar um usuário com perfil arbitrário.

**Nota**: a função `canAssignRole` referenciada na versão anterior deste ADR **não existe** em `AccessPolicy.ts`. As funções disponíveis são: `isKnownPerfil`, `canAccessUserData`, `getSubordinatePerfis`, `getAccessiblePerfis`.

---

## Decisão

**Corrigir os quatro problemas reais sem introduzir novas abstrações.**

### 1. Seed de `perfis` e `hierarquia_perfis` no boot

Adicionar seed idempotente em `scripts/ensure-columns.ts` imediatamente após a criação das tabelas:

```sql
-- Seed perfis (id = nome do perfil — simplifica FK e elimina mapeamento)
INSERT OR IGNORE INTO perfis (id, nome, descricao) VALUES
    ('admin',        'admin',        'Administrador — acesso total'),
    ('gerente',      'gerente',      'Gerente — acesso a coordenadores e abaixo'),
    ('coordenador',  'coordenador',  'Coordenador — acesso a encarregados e abaixo'),
    ('encarregado',  'encarregado',  'Encarregado — acesso a operadores'),
    ('operador',     'operador',     'Operador — apenas próprios dados'),
    ('campo',        'campo',        'Campo — mesmo nível que operador');

-- Seed hierarquia_perfis (espelha AccessPolicy.ROLE_HIERARCHY)
INSERT OR IGNORE INTO hierarquia_perfis (perfil, nivel, descricao) VALUES
    ('admin',       0, 'Administrador'),
    ('gerente',     1, 'Gerente'),
    ('coordenador', 2, 'Coordenador'),
    ('encarregado', 3, 'Encarregado'),
    ('operador',    4, 'Operador'),
    ('campo',       4, 'Campo');
```

### 2. Resolução da FK `usuarios.perfil → perfis(id)`

Adotar `id = nome_do_perfil` (ex: `'admin'`, `'gerente'`) — como proposto no seed acima. O repositório já armazena o nome diretamente; a FK passa a ser válida sem alterar o repositório.

Alternativa rejeitada: UUID como `id` de `perfis` — exigiria reescrever o repositório e todas as queries que comparam `perfil = 'admin'`.

### 3. Remoção do `setor` singular legado

- Remover `setor?: string` do type `User` em `types/index.ts`
- `UserProps.setores: string[]` permanece como única representação de vínculo usuário-setor
- Verificar todos os componentes que referenciam `user.setor` (exceto `user.setores`)

### 4. Validação server-side de perfil

`CreateUserUseCase` e `UpdateUserUseCase` passam a validar:

```typescript
import { isKnownPerfil, roleLevel } from '../../domain/access/AccessPolicy';

// actorPerfil é segundo parâmetro — não pertence ao DTO do comando
async execute(input: CreateUserInput, actorPerfil: string): Promise<UserDto> {

    // 1. Perfil é um valor conhecido
    if (!isKnownPerfil(input.perfil)) {
        throw new ValidationError(`Perfil inválido: ${input.perfil}`);
    }

    // 2. Ator pode atribuir apenas perfis estritamente subordinados
    //    (targetLevel > actorLevel — não permite criar mesmo nível)
    const actorLevel  = roleLevel(actorPerfil);
    const targetLevel = roleLevel(input.perfil);
    if (actorLevel === undefined || targetLevel === undefined || targetLevel <= actorLevel) {
        throw new ForbiddenError(
            `Perfil '${actorPerfil}' não pode atribuir perfil '${input.perfil}'`
        );
    }

    // ... resto do use case
}
```

`isKnownPerfil` e `roleLevel` já existem em `AccessPolicy.ts`.

**Por que não `canAccessUserData`**: usa `targetLevel >= currentLevel` (visibilidade de dados — gerente pode ver dados de outro gerente). Delegação de perfil exige `targetLevel > actorLevel` (subordinação estrita).

**Por que `actorPerfil` é segundo parâmetro e não parte de `CreateUserInput`**: o DTO modela o novo usuário (dado do comando); `actorPerfil` é dado de sessão. O caller (hook `useCreateUser` ou action) já tem `user.perfil` do `AuthContext` e passa explicitamente. Não há `SessionPort` na camada de application — introduzir um port novo apenas para este caso seria over-engineering. Invocar `get_session` (Rust) diretamente no use case tornaria o caso de uso Tauri-aware e não testável fora do runtime.

### 5. Correção de nome de tabela em `queries/usuarios.ts`

`queries/usuarios.ts:31` referencia `tbl_setores` — tabela inexistente. A tabela real é `setores`:

```sql
-- atual (errado)
LEFT JOIN tbl_setores s ON s.id = u.setor_id

-- correto
LEFT JOIN setores s ON s.id = u.setor_id
```

### 6. Correção de nome de coluna em `ExportacaoDadosTitularUseCase`

`ExportacaoDadosTitularUseCase.ts:23` seleciona `username` — coluna inexistente. A coluna real é `nome_usuario`:

```sql
-- atual (errado)
SELECT id, nome, email, username, perfil, ativo, criado_em, atualizado_em FROM usuarios WHERE id = ?

-- correto
SELECT id, nome, email, nome_usuario, perfil, ativo, criado_em, atualizado_em FROM usuarios WHERE id = ?
```

### 7. Vazamento de credenciais em `UserSnapshotService` — CRÍTICO

`UserSnapshotService.ts:105` tenta excluir campos sensíveis antes de enviar ao Supabase Storage:

```typescript
// atual (errado) — desestrutura nomes que não existem no objeto real
const { password_hash: _, sync_salt: __, ...safe } = u as typeof u & { password_hash: string; sync_salt: string };
```

Os campos reais no banco são `hash_senha` e `sal_sync`. O cast `as typeof u & { password_hash; sync_salt }` não altera o objeto em runtime — `safe` continua contendo `hash_senha` e `sal_sync` inteiros, que são enviados ao Supabase Storage.

Correção:

```typescript
// correto — desestrutura os nomes reais das colunas
const { hash_senha: _, sal_sync: __, ...safe } = u as typeof u & { hash_senha: string; sal_sync: string };
```

Adicionalmente, o tipo `UserSnapshotService.ts:18,22` deve ser atualizado:
```typescript
// linhas 18 e 22
hash_senha: string;   // era password_hash
sal_sync:   string;   // era sync_salt
```

---

## Plano de Execução

### Fase 1 — Seed das tabelas RBAC (2h)

```
├── ensure-columns.ts: adicionar INSERT OR IGNORE após CREATE TABLE perfis
├── ensure-columns.ts: adicionar INSERT OR IGNORE após CREATE TABLE hierarquia_perfis
└── Verificar: SELECT COUNT(*) FROM perfis = 6, SELECT COUNT(*) FROM hierarquia_perfis = 6
```

### Fase 2 — Correções críticas de nomenclatura (1h) — URGENTE

```
├── UserSnapshotService.ts:18,22,105 — hash_senha/sal_sync (stop de vazamento de credenciais)
├── queries/usuarios.ts:31 — tbl_setores → setores
└── ExportacaoDadosTitularUseCase.ts:23 — username → nome_usuario
```

### Fase 3 — Limpeza de tipos (1h)

```
├── Remover setor?: string de types/index.ts
└── grep -r 'user\.setor[^e]' para garantir zero referências residuais
```

### Fase 4 — Validação server-side (2h)

```
├── CreateUserUseCase.execute(input, actorPerfil): isKnownPerfil + roleLevel check
├── UpdateUserUseCase.execute(input, actorPerfil): mesma validação
└── Callers (hooks/actions) extraem actorPerfil de AuthContext e passam como segundo argumento
```

### Fase 5 — Seed de `permissoes` (meio dia, opcional neste ciclo)

```
├── Script que extrai as permissões hardcoded de PermissionActionAdapter.ts
└── INSERT OR IGNORE em permissoes — base para futura UI de administração
```

**Estimativa total: ~1,5 dias** (fases 1-4 obrigatórias; Fase 2 deve rodar primeiro)

---

## O que NÃO muda

- `AccessPolicy.ts` — source of truth da hierarquia em código; inalterado
- `SqliteUserRepository.ts` — queries já corretas contra o schema real
- Nomes de tabelas — `usuarios`, `setores`, `usuarios_setores`, `perfis`, `hierarquia_perfis`, `permissoes` sem prefixo `tbl_`
- `usePermissions.ts` / `PermissionGuards.tsx` — inalterados
- UI de criação/edição de usuários — apenas consome tipos corrigidos
- `SupabaseFileStorage` / `TransportService` — inalterados (o vazamento está no snapshot, não no transporte)

---

## Consequências

### Positivas
- `hierarquia_perfis` seedeada — `database.rs` retorna dados reais (não vazio)
- FK `usuarios.perfil → perfis(id)` válida — sem risco de violação silenciosa
- Validação de perfil no backend — impossível criar usuário com perfil arbitrário
- Remoção de `setor` singular — elimina ambiguidade em `types/index.ts`
- `UserSnapshotService` corrigido — `hash_senha`/`sal_sync` não vazam para Supabase Storage
- `ExportacaoDadosTitularUseCase` corrigido — exportação LGPD funciona contra coluna real
- `queries/usuarios.ts` corrigido — JOIN passa a encontrar tabela existente

### Negativas / Custos
- `ensure-columns.ts` precisa manter seed em sincronia com `AccessPolicy.ROLE_HIERARCHY`
- `CreateUserInput` precisa receber `currentUserPerfil` — pequena mudança de interface

### Riscos
- Se outros repositórios SQLite tiverem `PRAGMA foreign_keys = ON`, INSERTs em `usuarios` com `perfil` não seedado falharão — a Fase 1 deve rodar antes de qualquer Fase 4
- **Vazamento ativo**: enquanto `UserSnapshotService.ts:105` não for corrigido, todo sync de usuário envia `hash_senha` e `sal_sync` para Supabase Storage — Fase 2 é bloqueante

---

## Critérios de Aceitação

1. `SELECT COUNT(*) FROM perfis` retorna 6
2. `SELECT COUNT(*) FROM hierarquia_perfis` retorna 6
3. `SELECT nivel FROM hierarquia_perfis WHERE perfil = 'admin'` retorna 0
4. `SELECT nivel FROM hierarquia_perfis WHERE perfil = 'campo'` retorna 4
5. `SqliteUserRepository.save()` insere em `usuarios` sem violar FK de `perfis`
6. `CreateUserUseCase.execute({ perfil: 'inventado' })` lança `ValidationError`
7. `types/index.ts` não contém `setor?: string` no type `User`
8. `grep -r 'user\.setor[^e]' desktop/src/ desktop/components/ desktop/app/ desktop/contexts/` retorna 0 ocorrências
9. `UserSnapshotService.ts` não contém `password_hash` nem `sync_salt` em nenhuma linha
10. `ExportacaoDadosTitularUseCase.ts` não contém `username` em queries SQL
11. `queries/usuarios.ts` não contém `tbl_setores`
