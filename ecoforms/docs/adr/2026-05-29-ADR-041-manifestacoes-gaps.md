# ADR-041: Gaps identificados no módulo Manifestações (Ouvidoria)

**Data:** 2026-05-29  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** 16 arquivos do módulo ouvidoria/manifestações  
**ADRs relacionados:** ADR-031-desktop (QueryCatalog), ADR-038 (BookingModal gaps)

---

## Contexto

Auditoria completa do módulo de manifestações (ouvidoria) em todas as camadas (domain, application, infrastructure, interface, pages). O módulo possui estrutura de domínio sólida — `StateMachine`, `WorkflowPolicy`, use cases com FSM — mas apresenta gaps nas camadas de persistência, error handling e UI.

---

## Inventário por Camada

### Domain — ✅ Bem estruturado (com exceções)

| Arquivo | Status | Gap |
|---------|--------|-----|
| `ManifestacaoRepository.ts` | ✅ | Interface pura, sem SQL |
| `ManifestacaoStateMachine.ts` | ✅ | Transições declarativas e testáveis |
| `ManifestacaoWorkflowPolicy.ts` | ✅ | Políticas sem side effects |
| `ProtocoloService.ts` | ❌ | **3 queries SQL inline** |
| `SlaCalculator.ts` | ❌ | **1 query SQL inline** |

### Application — ✅ Sem gaps críticos

| Arquivo | Status | Observação |
|---------|--------|-----------|
| `UpdateManifestacaoStatusUseCase.ts` | ✅ | Orquestra FSM corretamente; publica domain event |
| `VerificarPrazosVencidosJob.ts` | ✅ | SQL parametrizado; await correto |
| `encaminhamento.actions.ts` | ⚠️ | Catch aninhado silencioso no log de erro |

### Infrastructure — 🔴 SQL Inline massivo

**`SqliteManifestacaoRepository.ts`** — aproximadamente 30 queries inline espalhadas em:
- `findAll` — SELECT com múltiplos LEFT JOINs (linhas 113–130)
- `findById` — SELECT completo (linhas 164–195)
- `findByProtocolo` — SELECT completo (linhas 197–228)
- `listTramitacoes` — SELECT tramitacoes (linhas 347–362)
- `listRespostas` — SELECT respostas (linhas 382–399)
- `listDespachos` — SELECT despachos (linhas 461–470)
- `listPrazos` — SELECT prazos (linhas 511–529)
- `listHistorico` — SELECT historico_alteracoes + JOIN usuarios (linhas 571–580)

### Interface (Hooks) — ⚠️ Padrões inconsistentes

**`useManifestacaoMutations.ts`:**
- 16+ chamadas `getContainerAsync()` repetidas — uma por callback, sem cache de container

**`useManifestacaoCatalogos.ts`:**
- Constantes `DEFAULT_TIPOS` hardcoded no hook (seed de catálogo deveria ser migration, não runtime)
- SQL inline via `c.sqlite.execute(INSERT OR IGNORE INTO tipos_manifestacao...)`
- Erro silenciado no `finally` — falha de seed não é reportada

### Pages/Components — 🔴 Múltiplos issues

**`ManifestacaoDetailPage.tsx`:**
- Catch silencioso em `handleAddResposta` (linha 132)
- Catch silencioso em `handleDespacho` (linha 170)
- Non-null assertions sem guard (`id!`, `user!.id`)
- Lógica de seleção de setor para devolução inline no componente (linhas 195–197)
- `} as Prazo` — type assertion sem validação (linha 185)

---

## Gaps Detalhados

### Gap 1 — SQL inline em Domain Services (Crítico)

**Arquivos:** `ProtocoloService.ts`, `SlaCalculator.ts`

```typescript
// ProtocoloService.ts — domínio consultando banco diretamente
'SELECT ultimo FROM protocolo_seq WHERE ano = ?'
'INSERT INTO protocolo_seq (ano, ultimo) VALUES (?, ?)'
'UPDATE protocolo_seq SET ultimo = ? WHERE ano = ?'

// SlaCalculator.ts — domínio lendo config do banco
'SELECT prazo_dias_corridos FROM tipos_manifestacao WHERE id = ?'
```

**Violação:** Domain Services não devem conhecer persistência. Ambos os serviços recebem `SqliteAdapter` injetado — mas a injeção não resolve o acoplamento: o domínio passa a depender de detalhe de infraestrutura.

**Decisão:** Extrair as queries para o `QueryCatalog` (ADR-031 desktop). `ProtocoloService` deve receber `ProximoProtocoloPort` (interface); `SlaCalculator` deve receber `TipoManifestacaoPort` ou os dados já resolvidos pelo use case antes da chamada.

```typescript
// Contrato proposto
interface ProximoProtocoloPort {
  getUltimo(ano: number): Promise<number | null>;
  setUltimo(ano: number, valor: number): Promise<void>;
}

interface TipoManifestacaoPort {
  findById(id: string): Promise<TipoManifestacao | null>;
}
```

---

### Gap 2 — Catch silencioso em componentes (Crítico)

**Arquivo:** `ManifestacaoDetailPage.tsx` linhas 132, 170

```typescript
// ❌ Atual — stack trace perdido, estado da operação incerto
try {
  await addResposta({ ... });
  toast.success("Resposta registrada");
} catch {
  toast.error("Erro ao registrar resposta");
}
```

**Problema:** O catch engole o erro original. Não há log, não há stack trace, não há distinção entre erro de rede, erro de validação e erro de banco. O estado do componente (loading, form) pode ficar inconsistente.

**Decisão:**

```typescript
// ✅ Proposto
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Erro desconhecido';
  console.error('[ManifestacaoDetail] addResposta falhou:', err);
  toast.error(`Erro ao registrar resposta: ${msg}`);
  // não re-throw — UX deve continuar; mas erro é visível nos logs
}
```

---

### Gap 3 — Catch aninhado silencioso em action de encaminhamento (Crítico)

**Arquivo:** `encaminhamento.actions.ts` linhas 114–134

```typescript
} catch (err) {
  try {
    await ctx.container.sqlite.execute(
      `INSERT INTO log_acoes ...`,
      [uuidv7(), "encaminhar_para_setor", ..., String(err)]
    );
  } catch {
    // ignore logging errors  ← ❌ log de erro também falha silenciosamente
  }
  return { success: false, message: `Falha ao encaminhar: ${String(err)}` };
}
```

**Problemas:**
- `String(err)` serializa somente a mensagem — stack trace e tipo do erro são perdidos
- O catch interno (falha de log) é silencioso — pode mascarar falha de integridade do banco
- Coluna de log recebe `String(err)` mas campo é provavelmente `TEXT` sem estrutura — dificulta análise posterior

**Decisão:**
- Usar `err instanceof Error ? err.message : String(err)` para mensagem
- Log de audit deve logar `JSON.stringify({ type: err?.constructor?.name, message: err?.message })` para manter estrutura
- Falha de log deve gerar `console.error` mesmo que não propague

---

### Gap 4 — Lógica de negócio inline no componente React (Médio)

**Arquivo:** `ManifestacaoDetailPage.tsx` linhas 195–197

```typescript
// ❌ Cálculo de setor para devolução no render
const setorOrigemDevolucao = tramitacoes
  .filter(t => t.deSetorId && t.deSetorId !== manifestacao?.setorId)
  .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0] ?? null;
```

Esta é uma regra de negócio: "o setor de origem para devolução é o último setor que encaminhou, excluindo o setor atual". Pertence a `ManifestacaoWorkflowPolicy` ou a um use case dedicado.

**Decisão:** Mover para `ManifestacaoWorkflowPolicy.resolveSetorDevolucao(tramitacoes, setorAtualId)`.

---

### Gap 5 — `DEFAULT_TIPOS` hardcoded em hook React (Médio)

**Arquivo:** `useManifestacaoCatalogos.ts`

Seed de catálogo (`tipos_manifestacao`) executado em runtime via hook — a cada montagem do componente que usa o hook. Problemas:

1. Se o schema mudar (nova coluna), o seed falha silenciosamente (`INSERT OR IGNORE` não atualiza)
2. Constantes com `prazo_dias_corridos` (snake_case) divergem da convenção camelCase do domínio
3. Seed é operação de infraestrutura — pertence à camada de migration, não à camada de interface

**Decisão:** Mover `DEFAULT_TIPOS` para migration SQL (arquivo `migrations/`). Hook passa a apenas ler tipos, não inserir. Se bootstrapping for necessário, criar `SeedManifestacaoCatalogUseCase` chamado uma única vez na inicialização do container.

---

### Gap 6 — `getContainerAsync()` chamado 16× sem cache (Baixo)

**Arquivo:** `useManifestacaoMutations.ts`

Cada callback recria a referência ao container — embora `getContainerAsync` seja idempotente (retorna singleton), a chamada repetida é ruído semântico e cria dependência implícita de implementação.

**Decisão:** Encapsular em `useContainer()` hook (já proposto no ADR-038 gap 5) ou resolver o container uma vez no topo do hook com `useEffect`:

```typescript
const containerRef = useRef<Container | null>(null);
useEffect(() => {
  getContainerAsync().then(c => { containerRef.current = c; });
}, []);
```

---

### Gap 7 — Non-null assertions sem guard (Baixo)

**Arquivo:** `ManifestacaoDetailPage.tsx`

```typescript
manifestacaoId: id!,     // id vem de useParams — pode ser undefined
enviadaPorId: user!.id,  // user vem de useAuth — pode ser null durante hidratação
```

**Decisão:** Guards explícitos no topo do handler:

```typescript
if (!id || !user) return;
```

---

### Gap 8 — Ausência de validação de comprimento em texto livre (Baixo)

**Arquivo:** `ManifestacaoDetailPage.tsx` — campos de resposta e despacho

Apenas `respostaText.trim()` é verificado. Sem limite de comprimento — usuário pode submeter texto de vários MB que passa pela mutation sem truncamento.

**Decisão:** Adicionar validação `respostaText.length <= 5000` com contador de caracteres visível no UI (feedback imediato).

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo | Esforço |
|---|-----|-----------|---------|---------|
| 1 | SQL inline em Domain Services | Crítico | `ProtocoloService.ts`, `SlaCalculator.ts` | Médio |
| 2 | Catch silencioso em page | Crítico | `ManifestacaoDetailPage.tsx:132,170` | Baixo |
| 3 | Catch aninhado silencioso em action | Crítico | `encaminhamento.actions.ts:129` | Baixo |
| 4 | Lógica de negócio inline no React | Médio | `ManifestacaoDetailPage.tsx:195` | Baixo |
| 5 | Seed de catálogo em hook React | Médio | `useManifestacaoCatalogos.ts` | Médio |
| 6 | `getContainerAsync()` repetido | Baixo | `useManifestacaoMutations.ts` | Baixo |
| 7 | Non-null assertions sem guard | Baixo | `ManifestacaoDetailPage.tsx` | Baixo |
| 8 | Sem validação de comprimento | Baixo | `ManifestacaoDetailPage.tsx` | Baixo |

**Itens 2 e 3 são correções de uma linha — devem ser feitos imediatamente.**  
**Item 1 é bloqueante para o QueryCatalog (ADR-031 desktop) e deve entrar na Fase 2.**  
**Item 5 requer coordenação com migrations — planejar no próximo ciclo.**

---

## O que está bem (não tocar)

- `ManifestacaoStateMachine` — transições declarativas, cobertas implicitamente pelos use cases
- `UpdateManifestacaoStatusUseCase` — orquestra FSM + domain event corretamente
- `ManifestacaoWorkflowConfig` — configuração declarativa sem lógica dinâmica perigosa
- `useManifestacaoWorkflow` — puro, sem side effects, usa `useMemo` corretamente
- `VerificarPrazosVencidosJob` — SQL parametrizado, sem SQL injection, await correto

## Relação com ADRs Existentes

- **ADR-031 (desktop) QueryCatalog:** gap 1 (`ProtocoloService`, `SlaCalculator`) deve entrar na **Fase 2** do plano de migração — são as violações de maior gravidade (domain com SQL)
- **ADR-038 (BookingModal):** gaps 2, 3, 6 e 7 seguem o mesmo padrão identificado no BookingModal — sugerem problema sistêmico de tratamento de erros na camada de interface, não isolado a um componente
- **PLANO_OUVIDORIA.md:** verificar se encaminhamento, aditamento e reabertura planejados no plano consideram os ports propostos no gap 1 antes de adicionar mais SQL inline nos novos use cases
