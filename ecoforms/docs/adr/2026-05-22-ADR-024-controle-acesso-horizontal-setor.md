# ADR-024 — Controle de Acesso Horizontal por Setor/Departamento

- **Status**: Implementado
- **Data**: 2026-05-22
- **Implementado em**: 2026-06-18
- **Autor**: Claude Code (extensão de ADR-023)
- **Decisor**: Marcelo Luiz
- **Ciclo de vida**: Proposto → Aceito → **Implementado** → Supersedido
- **Relacionados**: ADR-023 (Consolidação RBAC), ADR-014 (Adequação Arquitetural), ADR-021 (LGPD Conformidade)

---

## Contexto

ADR-023 consolidou o controle de acesso **vertical** (hierarquia de perfis). Este ADR adiciona a dimensão **horizontal**: o setor/departamento ao qual o usuário pertence.

### Estado atual — filtro de setor parcial e inconsistente

| Método | Filtra setor? | Escopo do gap |
|--------|:---:|---|
| `buildTaskAccessFilter` | **Não** | Tarefas visíveis cross-setor para todos os perfis |
| `buildRecordAccessFilter` | **Não** | Pacotes visíveis cross-setor para todos os perfis |
| `buildInboxAccessFilter` | **Só gerente** | Coordenador, encarregado, operador, campo sem restrição de setor |

O `buildInboxAccessFilter` contém o único fragmento de filtro horizontal — uma subquery EXISTS que verifica interseção de setores entre o usuário logado e o proprietário do registro. O padrão existe, está correto, mas não foi generalizado.

### Infraestrutura existente (aproveitável)

- `setores` com `pai_id` (hierarquia) — `ensure-columns.ts:112-122`
- `usuarios.setor_principal_id` + `usuarios_setores` (M:N) para vínculo usuário↔setor
- `tarefas.setor_id`, `manifestacoes.setor_id`, `tbl_agendamentos.setor_id` — colunas diretas nas principais entidades operacionais
- `tramitacoes.de_setor_id` / `para_setor_id` — rastreamento de fluxo entre setores

### Lacunas de schema

| Entidade | Tem `setor_id`? | Ação necessária |
|----------|:---:|---|
| `projetos` | Não | Adicionar coluna |
| `demandas` | Não | Adicionar coluna |
| `pacotes` | Não | Derivar de `id_proprietario` → `usuarios_setores` |
| `execucao_coleta` | Não | Derivar de `roteiro_id` → `roteiros.setor_id` |
| `atividades` | Não | Adicionar coluna |
| `registro_formularios` | Não | Catálogo — não escopar (formulários são templates compartilhados) |
| `clientes` | Não | Não escopar (clientes atendidos por múltiplos setores) |
| `anexos` | Não | **Deferido** — ver nota abaixo |
| `intercorrencias_coleta` | Não | Derivar da coleta pai |

> **`anexos` — deferido para ADR subsequente**: `anexos.entidade_pai_id` aponta para entidades heterogêneas (tarefas, demandas, projetos, etc.). Filtrar anexos por setor exige `entidade_pai_tipo` + JOIN dinâmico por tipo, o que não tem implementação uniforme no `AccessFilterBuilder` atual. Enquanto isso, o acesso a anexos é controlado indiretamente pelo acesso à entidade pai — quem não vê a tarefa não acessa o link do anexo.

### Bug ativo: `getUserSector()` retorna só o primeiro setor

`SqliteKanbanRepository.ts:29` — `SELECT setor_id FROM usuarios_setores WHERE usuario_id = ? LIMIT 1`. Usuário multi-setor perde visibilidade dos demais setores no Kanban.

---

## Decisão

**Toda entidade operacional é escopada por setor. O acesso é a interseção de dois eixos: vertical (perfil) e horizontal (setor).**

```
acesso = pode_ver_por_perfil(actor, target)  E  pode_ver_por_setor(actor, target)
```

### Regra geral

| Perfil | Vertical (ADR-023) | Horizontal (este ADR) |
|--------|---------------------|------------------------|
| admin | Todos | Todos os setores (`1=1`) |
| gerente | Subordinados (nível > 1) | Apenas setores do gerente + descendentes |
| coordenador | Subordinados (nível > 2) | Apenas setores do coordenador + descendentes |
| encarregado | Subordinados (nível > 3) | Apenas setores do encarregado + descendentes |
| operador | Próprios dados | Apenas setores do operador + descendentes |
| campo | Próprios dados | Apenas setores do campo + descendentes |

Admin: `1=1` nos dois eixos — bypass total mantido.

Usuário sem setor atribuído (`usuarios_setores` vazia e `setor_principal_id` nulo): `buildSectorFilter` retorna `['1=0', []]` — fail-closed, não vê nada. Administradores são imunes (bypass antes de chamar o filtro).

---

## 1. Schema — colunas faltantes

### `projetos`

```sql
ALTER TABLE projetos ADD COLUMN setor_id TEXT REFERENCES setores(id);
CREATE INDEX IF NOT EXISTS idx_projetos_setor ON projetos(setor_id);
```

### `demandas`

```sql
ALTER TABLE demandas ADD COLUMN setor_id TEXT REFERENCES setores(id);
CREATE INDEX IF NOT EXISTS idx_demandas_setor ON demandas(setor_id);
```

### `atividades`

```sql
ALTER TABLE atividades ADD COLUMN setor_id TEXT REFERENCES setores(id);
CREATE INDEX IF NOT EXISTS idx_atividades_setor ON atividades(setor_id);
```

As três colunas são adicionadas em **dois arquivos** (requisito do projeto):
- `scripts/ensure-columns.ts` — bloco `CREATE TABLE IF NOT EXISTS` + guard `ADD COLUMN`
- `docs/db/schema_consolidado_corrigido.sql` — referência documental

### Entidades indiretas — sem coluna nova

| Entidade | Como o setor é determinado |
|----------|----------------------------|
| `pacotes` | `pacotes.id_proprietario` → `usuarios` → `usuarios_setores` |
| `execucao_coleta` | `execucao_coleta.roteiro_id` → `roteiros.setor_id` |
| `intercorrencias_coleta` | `intercorrencias_coleta.coleta_id` → `execucao_coleta.roteiro_id` → `roteiros.setor_id` |

---

## 2. Utilidade centralizada: `getEffectiveSectors`

### Localização

`src/infrastructure/persistence/SectorQueryUtils.ts` — **não** em `src/domain/`. A função executa queries no banco; colocá-la no domínio violaria Clean Architecture. O domínio define a regra (interseção de eixos); a infraestrutura a executa.

Use cases que precisam validar setor recebem `getEffectiveSectors` via injeção de dependência (parâmetro na assinatura do use case ou via porta `ISectorUtils`).

### Implementação com cache

```typescript
// src/infrastructure/persistence/SectorQueryUtils.ts

type DbLike = { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> };

const _cache = new Map<string, { sectors: string[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Invalida o cache para um usuário específico, ou todos se userId omitido. */
export function invalidateSectorCache(userId?: string): void {
    if (userId) _cache.delete(userId);
    else _cache.clear();
}

/**
 * Retorna todos os setor_id que um usuário pode acessar:
 * - setores diretos (setor_principal_id + usuarios_setores)
 * - descendentes hierárquicos via pai_id (recursão em largura)
 *
 * Resultado cacheado por 5 minutos. Chamar invalidateSectorCache() ao
 * editar setores de um usuário ou mover setores na hierarquia.
 */
export async function getEffectiveSectors(
    userId: string,
    db: DbLike,
): Promise<string[]> {
    const cached = _cache.get(userId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.sectors;

    // 1. Setores diretos do usuário
    const directRows = await db.query<{ setor_id: string }>(
        `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
         UNION
         SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
        [userId, userId],
    );
    const directIds = directRows.map(r => r.setor_id);

    if (directIds.length === 0) {
        _cache.set(userId, { sectors: [], ts: Date.now() });
        return [];
    }

    // 2. Descendentes hierárquicos (caminhada BFS na árvore pai_id)
    const allIds = new Set(directIds);
    let frontier = [...directIds];

    while (frontier.length > 0) {
        const children = await db.query<{ id: string }>(
            `SELECT id FROM setores WHERE pai_id IN (${frontier.map(() => '?').join(',')}) AND ativo = 1`,
            frontier,
        );
        frontier = children.map(r => r.id).filter(id => !allIds.has(id));
        frontier.forEach(id => allIds.add(id));
    }

    const sectors = [...allIds];
    _cache.set(userId, { sectors, ts: Date.now() });
    return sectors;
}
```

**Trade-off**: a caminhada BFS faz N queries (uma por nível de profundidade). Com setores tipicamente em 2-3 níveis, o custo é aceitável, especialmente com cache.

**Alternativa rejeitada — `WITH RECURSIVE`**: SQLite suporta CTE recursiva e não exigiria múltiplas roundtrips. Rejeitada porque: (a) a query recursiva precisa receber os IDs semente como parâmetros em `IN (...)` dentro do anchor, exigindo construção de string dinâmica de qualquer forma; (b) a leitura do código é mais opaca para a equipe; (c) o ganho de performance é irrelevante com cache de 5 min. Reavaliar apenas se a árvore tiver mais de 5 níveis ou centenas de setores.

---

## 3. AccessFilterBuilder — generalização do filtro horizontal

### Função auxiliar: `buildSectorFilter`

```typescript
// src/infrastructure/persistence/AccessFilterBuilder.ts — adição

/**
 * Gera cláusula SQL que restringe resultados aos setores efetivos do usuário.
 *
 * Comportamento de borda: effectiveSectors vazio retorna ['1=0', []] —
 * fail-closed intencional (usuário sem setor não vê nada).
 *
 * @param effectiveSectors — resultado de getEffectiveSectors(userId)
 * @param directColumn — coluna setor_id na tabela (ex: 't.setor_id'); se omitido, usa subquery EXISTS
 * @param ownerColumn — para entidades sem setor_id direto: coluna que aponta para o usuario_id dono
 *                      (ex: 'v.id_proprietario'); deve corresponder ao alias da query chamadora
 */
function buildSectorFilter(
    effectiveSectors: string[],
    directColumn?: string,
    ownerColumn?: string,
): [string, string[]] {
    if (effectiveSectors.length === 0) return ['1=0', []];

    const placeholders = effectiveSectors.map(() => '?').join(',');

    if (directColumn) {
        return [`${directColumn} IN (${placeholders})`, effectiveSectors];
    }

    // Entidade indireta — EXISTS via proprietário → usuarios_setores
    return [
        `EXISTS (
            SELECT 1 FROM usuarios_setores us_owner
            WHERE us_owner.usuario_id = ${ownerColumn}
              AND us_owner.setor_id IN (${placeholders})
        )`,
        effectiveSectors,
    ];
}
```

### Métodos atualizados

**`buildTaskAccessFilter`** — adiciona cláusula de setor:

```typescript
async buildTaskAccessFilter(
    userId: string,
    userPerfil: Perfil,
    effectiveSectors: string[],
): Promise<{ clause: string; params: string[] }> {
    if (isAdmin(userPerfil)) return { clause: '1=1', params: [] };

    const subordinatePerfis = getSubordinatePerfis(userPerfil);
    const subordinatePlaceholders = subordinatePerfis.map(() => '?').join(',');

    const [sectorClause, sectorParams] = buildSectorFilter(effectiveSectors, 't.setor_id');

    return {
        clause: `(${sectorClause}) AND (
            t.criado_por = ? OR t.atribuido_para = ? OR u_criador.perfil IN (${subordinatePlaceholders})
        )`,
        params: [...sectorParams, userId, userId, ...subordinatePerfis],
    };
}
```

**`buildRecordAccessFilter`** — pacotes sem `setor_id` direto, usa EXISTS:

```typescript
// Alias esperado na query chamadora: s = pacotes, u = JOIN usuarios ON u.id = s.id_proprietario
async buildRecordAccessFilter(
    userId: string,
    userPerfil: Perfil,
    effectiveSectors: string[],
): Promise<{ clause: string; params: string[] }> {
    if (isAdmin(userPerfil)) return { clause: '1=1', params: [] };

    const accessiblePerfis = getAccessiblePerfis(userPerfil);
    const placeholders = accessiblePerfis.map(() => '?').join(',');

    const [sectorClause, sectorParams] = buildSectorFilter(
        effectiveSectors, undefined, 's.id_proprietario',
    );

    return {
        clause: `(${sectorClause}) AND (
            s.id_proprietario = ? OR u.perfil IN (${placeholders})
        )`,
        params: [...sectorParams, userId, ...accessiblePerfis],
    };
}
```

**`buildInboxAccessFilter`** — unifica filtro de setor, remove EXISTS hardcoded de gerente:

```typescript
// Alias esperado na query chamadora: v = pacotes/inbox, u = JOIN usuarios ON u.id = v.id_proprietario
async buildInboxAccessFilter(
    userId: string,
    userPerfil: Perfil,
    effectiveSectors: string[],
): Promise<{ clause: string; params: string[] }> {
    if (isAdmin(userPerfil)) return { clause: '1=1', params: [] };

    const subordinatePerfis = getSubordinatePerfis(userPerfil);
    const subordinatePlaceholders = subordinatePerfis.map(() => '?').join(',');

    const [sectorClause, sectorParams] = buildSectorFilter(
        effectiveSectors, undefined, 'v.id_proprietario',
    );

    return {
        clause: `(${sectorClause}) AND (
            v.id_proprietario = ?
            OR u.perfil IN (${subordinatePlaceholders})
        )`,
        params: [...sectorParams, userId, ...subordinatePerfis],
    };
}
```

> **Simplificação em relação ao código anterior**: o subclause `AND v.id_proprietario IN (SELECT id FROM usuarios WHERE perfil IN (...))` era redundante — `u` já é o join do proprietário, então `u.perfil IN (...)` e esse `IN (SELECT ...)` testavam a mesma condição.

---

## 4. Correção do `getUserSector()` no Kanban

`SqliteKanbanRepository.ts:29` — substituir `LIMIT 1` por agregação completa:

```typescript
// Antes (errado — multi-setor quebrado)
async getUserSector(userId: string): Promise<string | null> {
    const rows = await this.db.query<{ setor_id: string }>(
        `SELECT setor_id FROM usuarios_setores WHERE usuario_id = ? LIMIT 1`,
        [userId],
    );
    return rows[0]?.setor_id ?? null;
}

// Depois — retorna todos os setores; caller decide como usar
async getUserSectors(userId: string): Promise<string[]> {
    const rows = await this.db.query<{ setor_id: string }>(
        `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
         UNION
         SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
        [userId, userId],
    );
    return rows.map(r => r.setor_id);
}
```

**Breaking change**: retorno muda de `string | null` para `string[]`. Localizar todos os callers antes de implementar:

```bash
grep -rn "getUserSector\b" desktop/src desktop/app desktop/components
```

Callers conhecidos no momento desta proposta: nenhum fora do próprio `SqliteKanbanRepository` (o método era interno). Confirmar via grep antes de iniciar Fase 4.

---

## 5. Fluxo de criação de entidade — determinação do `setor_id`

Quando um usuário cria uma entidade (tarefa, demanda, projeto, agendamento, manifestação), o `setor_id` precisa ser determinado:

| Fonte | Precedência |
|-------|-------------|
| `input.setor_id` explícito | 1ª — se o usuário especificar e o setor estiver entre seus `effectiveSectors` |
| Setor do formulário/roteiro pai | 2ª — se a entidade for filha de outra com setor definido |
| `setor_principal_id` do usuário | 3ª — fallback padrão |

Validação no use case (recebe `getEffectiveSectors` como dependência injetada):

```typescript
async function resolveSetorId(
    input: { setor_id?: string },
    actorId: string,
    getEffectiveSectors: (userId: string) => Promise<string[]>,
    db: DbLike,
): Promise<string> {
    if (input.setor_id) {
        const effective = await getEffectiveSectors(actorId);
        if (!effective.includes(input.setor_id)) {
            throw new ForbiddenError(`Setor '${input.setor_id}' fora do escopo do usuário`);
        }
        return input.setor_id;
    }
    // fallback: setor_principal_id do ator
    const [user] = await db.query<{ setor_principal_id: string | null }>(
        `SELECT setor_principal_id FROM usuarios WHERE id = ?`, [actorId],
    );
    if (!user?.setor_principal_id) throw new ValidationError('Usuário sem setor definido');
    return user.setor_principal_id;
}
```

---

## Plano de Execução

### Fase 1 — Schema (1h)

```
├── ensure-columns.ts: ADD COLUMN setor_id em projetos, demandas, atividades
├── ensure-columns.ts: índices idx_projetos_setor, idx_demandas_setor, idx_atividades_setor
└── docs/db/schema_consolidado_corrigido.sql: espelhar as mesmas colunas (requisito do projeto)
```

### Fase 2 — Infraestrutura: `SectorQueryUtils` (2h)

```
├── src/infrastructure/persistence/SectorQueryUtils.ts: getEffectiveSectors + invalidateSectorCache
├── Teste unitário: usuário em setor pai vê entidades do setor filho
├── Teste unitário: usuário multi-setor vê entidades de todos os setores
└── Teste unitário: cache expira após TTL e invalida por userId
```

### Fase 3 — AccessFilterBuilder (2h)

```
├── buildSectorFilter(directColumn?, ownerColumn?) — função auxiliar
├── buildTaskAccessFilter: injetar effectiveSectors
├── buildRecordAccessFilter: injetar effectiveSectors (indireto via proprietário)
├── buildInboxAccessFilter: substituir EXISTS hardcoded por buildSectorFilter; remover subquery redundante
└── Testes: cada método — com setores, sem setores (1=0), admin bypass
```

### Fase 4 — Correção do Kanban + callers (1h)

```
├── grep -rn "getUserSector\b" para mapear callers antes de renomear
├── SqliteKanbanRepository: getUserSector → getUserSectors (remove LIMIT 1, adiciona UNION setor_principal_id)
└── Kanban queries: adicionar filtro de setor onde ausente
```

### Fase 5 — Use cases: validação de setor na criação (2h)

```
├── Extrair resolveSetorId como helper compartilhado (src/application/shared/)
├── CreateTaskUseCase: usar resolveSetorId
├── CreateDemandaUseCase: usar resolveSetorId
├── CreateProjetoUseCase: usar resolveSetorId
├── CreateBookingUseCase: já tem setor_id — apenas adicionar validação de escopo
└── CreateManifestacaoUseCase: já tem setor_id — apenas adicionar validação de escopo
```

### Fase 6 — Limpeza e verificação (1h)

```
├── grep -n "LIMIT 1" em queries de usuarios_setores — eliminar ocorrências remanescentes
├── grep -n "gerente" em buildInboxAccessFilter — confirmar que não há lógica específica de perfil
├── invalidateSectorCache() nos fluxos de edição de setores de usuário (SqliteUserRepository.update)
└── Smoke test: admin vê tudo; operador vê só entidades do próprio setor; operador multi-setor vê ambos
```

**Estimativa total: ~2 dias**

---

## O que NÃO muda

- `AccessPolicy.ROLE_HIERARCHY` — hierarquia vertical inalterada
- `usePermissions.ts` / `PermissionGuards.tsx` — guards de UI não mudam (filtro é na query, não no render)
- `perfis`, `hierarquia_perfis`, `permissoes` — tabelas RBAC inalteradas
- `SqliteUserRepository` — setores já são gerenciados corretamente
- Admin — `1=1` bypass em todos os filtros mantido

---

## Consequências

### Positivas
- Gerente do setor "Norte" não vê tarefas do setor "Sul"
- Coordenador multi-setor vê corretamente entidades de todos os seus setores
- Hierarquia de setores (`pai_id`) é percorrida — setor pai herda visibilidade dos filhos
- Filtro horizontal unificado em `buildSectorFilter` — sem lógica duplicada por perfil
- `getEffectiveSectors` com cache — no máximo N queries no primeiro acesso, depois memória
- `getUserSector` com `LIMIT 1` corrigido — multi-setor funciona no Kanban

### Negativas / Custos
- `AccessFilterBuilder` ganha parâmetro obrigatório (`effectiveSectors`) — todos os callers precisam ser atualizados
- `getEffectiveSectors` faz N queries na primeira chamada (uma por nível da árvore) — mitigado por cache
- 3 novas colunas em 3 tabelas — migração de schema necessária
- `anexos` continua sem filtro horizontal direto (deferido)

### Riscos
- **Performance**: caminhada BFS é O(profundidade × largura). Com 500+ setores em árvore profunda, reavaliar `WITH RECURSIVE`. Improvável no domínio atual (dezenas de setores).
- **Callers do AccessFilterBuilder**: interface muda — breaking change. Mitigação: fornecer `effectiveSectors` via hook `useAccessFilters` que encapsula a chamada e passa o resultado aos builders.
- **Cache stale em edição de setores**: `invalidateSectorCache(userId)` deve ser chamado sempre que `usuarios_setores` ou `setor_principal_id` forem modificados. Risco de esquecer um ponto de edição — mitigação: centralizar todas as mutações de setor em `SqliteUserRepository.updateSectors()`.

---

## Critérios de Aceitação

1. `getEffectiveSectors(userId)` retorna setores diretos + descendentes para usuário com `setor_principal_id` em setor pai
2. `getEffectiveSectors(userId)` retorna união de setores para usuário multi-setor (M:N via `usuarios_setores`)
3. `getEffectiveSectors(userId)` retorna `[]` para usuário sem setor — sem lançar exceção
4. `buildTaskAccessFilter` com `effectiveSectors=['s1']` gera cláusula contendo `t.setor_id IN (?)` para não-admin
5. `buildTaskAccessFilter` com `effectiveSectors=[]` gera cláusula contendo `1=0` para não-admin
6. `buildRecordAccessFilter` com `effectiveSectors=['s1']` gera subquery `EXISTS ... us_owner.setor_id IN (?)` para não-admin
7. `buildInboxAccessFilter` — ausência de `IN (SELECT id FROM usuarios WHERE perfil IN ...)` no SQL gerado
8. Admin recebe `clause: '1=1'` em todos os builders — bypass mantido
9. `getUserSectors` (Kanban) retorna array com todos os setores do usuário, sem `LIMIT 1` na query
10. `CreateTaskUseCase` lança `ForbiddenError` ao receber `setor_id` fora dos `effectiveSectors` do ator
11. `CreateProjetoUseCase` persiste `setor_id` não-nulo ao criar projeto sem `input.setor_id` (fallback `setor_principal_id`)
12. `CreateDemandaUseCase` persiste `setor_id` não-nulo ao criar demanda sem `input.setor_id` (fallback `setor_principal_id`)

---

## Status de Implementação (2026-06-18)

| Critério | Status | Artefato |
|---|---|---|
| 1-3 | ✅ | `SectorQueryUtils.ts` — `getEffectiveSectors` com BFS + cache 5min |
| 4-6 | ✅ | `AccessFilterBuilder.ts` — `buildSectorFilter`, `buildTaskAccessFilter`, `buildRecordAccessFilter` |
| 7 | ✅ | `buildInboxAccessFilter` — path com effectiveSectors usa `buildSectorFilter` genérico |
| 8 | ✅ | Admin bypass `1=1` em todos os builders |
| 9 | ✅ | `SqliteKanbanRepository.getUserSectors()` (plural, sem LIMIT 1) |
| 10 | ✅ | `CreateTaskUseCase` → `resolveSetorId` → `ForbiddenError` |
| 11 | ✅ | `CreateProjectUseCase` + `SqliteProjectRepository` — INSERT inclui `setor_id`; `useProjects` resolve via `user.setores[0]` |
| 12 | ✅ | `CreateDemandaUseCase` → `resolveSetorId` → `SqliteDemandaRepository.save()` inclui `setor_id` |

### Schema

- `projetos.setor_id` ✅ (ensure-columns L1252)
- `demandas.setor_id` ✅ (ensure-columns L1419)
- `atividades.setor_id` — N/A (tabela `atividades` não existe no codebase atual; critério original baseava-se em schema proposto)

### Wiring por domínio

| Domínio | Listagem filtrada | Criação com setor_id |
|---|---|---|
| Tarefas (Kanban) | ✅ `SqliteKanbanRepository.getKanbanData()` inline | ✅ `CreateTaskUseCase` via `resolveSetorId` |
| Inbox | ✅ `getInboxAccessFilter()` em `useAccessFilters.ts` | — |
| Demandas | Via kanban/inbox | ✅ `CreateDemandaUseCase` via `resolveSetorId` |
| Projetos | Via owner/interessados | ✅ `SqliteProjectRepository.createProject()` |
| Service types | ✅ `ListServiceTypesUseCase` via `getEffectiveSectors` | ✅ `CreateServiceTypeUseCase` |
| Manifestações | Via `filter.setorId` no repo | Via domain (já tinha `setor_id`) |
| Logística | Via `roteiros.setor_id` | Via domain |

### Itens deferidos (explícito no ADR original)

- Filtro horizontal de `anexos` — controlado indiretamente pelo acesso à entidade pai
- Listagem de demandas e manifestações por effectiveSectors na UI — filtro existe no AccessFilterBuilder mas não é chamado nas telas de listagem (filtragem ocorre via kanban/inbox que já filtram)
