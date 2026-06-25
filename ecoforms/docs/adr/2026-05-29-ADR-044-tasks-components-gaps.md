# ADR-044: Gaps identificados em `components/tasks/`

**Data:** 2026-05-29  
**Status:**Implementado**
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** `TaskMetricsContent.tsx`, `TasksTableView.tsx`, `useTaskMetrics.ts`, `app/tasks/page.tsx`  
**ADRs relacionados:** ADR-031-desktop (QueryCatalog), ADR-038 (BookingModal), ADR-039 (Manifestações), ADR-040 (Ecopontos)

---

## Contexto

Auditoria dos dois componentes do diretório `components/tasks/` e seus callers diretos. Ambos os componentes são funcionalmente presentes mas apresentam gaps de correctness (filtro ineficaz, handlers ausentes), UX (confirmação de exclusão, estado de carregamento) e manutenção (imports mortos, lógica duplicada).

---

## Inventário

| Arquivo | Callers | Status |
|---------|---------|--------|
| `TaskMetricsContent.tsx` | `app/tasks/page.tsx`, `app/tasks/metrics/page.tsx` | ⚠️ Filtro de período parcialmente ineficaz |
| `TasksTableView.tsx` | `app/tasks/page.tsx`, `components/kanban/KanbanBoard.tsx` | 🔴 Handlers ausentes em `tasks/page.tsx`; imports mortos |
| `useTaskMetrics.ts` | `TaskMetricsContent` (via catalog/kanban) | ⚠️ `daysBack` não propagado para 3 de 4 queries |

---

## Gaps Detalhados

### Gap 1 — `daysBack` não afeta KPIs, usuários nem prioridades (Crítico)

**Arquivo:** `src/interface/hooks/queries/useTaskMetrics.ts:62–73`

```typescript
// ❌ Apenas dailyTrends recebe daysBack
const summaryResult    = await container.tasks.metricsSummary.execute();      // sem período
const byUserResult     = await container.tasks.metricsByUser.execute();       // sem período
const byPriorityResult = await container.tasks.metricsByPriority.execute();   // sem período
const dailyResult      = await container.tasks.metricsDailyTrends.execute(daysBack); // ✅
```

**Efeito:** Quando o usuário muda o seletor de "30 dias" para "7 dias" ou "90 dias", apenas o gráfico de barras atualiza. Os cards de KPI (Total, Concluídas, Em Progresso, Atrasadas), a tabela de produtividade por usuário e o painel de prioridades ficam estáticos — sempre mostram o panorama geral, não o período selecionado.

**Decisão:** Passar `daysBack` para todos os use cases de métricas:

```typescript
const summaryResult    = await container.tasks.metricsSummary.execute(daysBack);
const byUserResult     = await container.tasks.metricsByUser.execute(daysBack);
const byPriorityResult = await container.tasks.metricsByPriority.execute(daysBack);
```

Os use cases precisam aceitar o parâmetro e aplicar `WHERE criado_em >= date('now', ?)` ou equivalente.

---

### Gap 2 — Gráfico de tendência limitado a 7 dias hardcoded (Crítico)

**Arquivo:** `TaskMetricsContent.tsx:43`

```typescript
// ❌ Sempre 7 dias independente do período selecionado
const recentTrends = dailyTrends.slice(-7);
```

O gráfico exibe "Tendência (últimos 7 dias)" com `slice(-7)` mesmo quando `daysBack = 90`. O usuário seleciona 90 dias e o gráfico não muda. Se `dailyTrends` tiver menos de 7 entradas (ex: banco novo), `slice(-7)` retorna o que existe — sem aviso.

**Decisão:**

```typescript
// ✅ Respeitar o período, com máximo razoável para caber no espaço visual
const maxBars = daysBack <= 14 ? daysBack : 30;
const recentTrends = dailyTrends.slice(-maxBars);
// Atualizar o título: `Tendência (últimos ${maxBars} dias)`
```

---

### Gap 3 — `onStatusChange`, `onArchive`, `onDelete` ausentes em `app/tasks/page.tsx` (Crítico)

**Arquivo:** `app/tasks/page.tsx:41–44`

```typescript
// ❌ Só onTaskClick passado — dropdown de ações é completamente inerte
<TasksTableView
    tasks={tasks}
    onTaskClick={handleTaskClick}
    {/* onStatusChange, onArchive, onDelete: undefined */}
/>
```

Em `TasksTableView`, os `DropdownMenuItem` chamam `onStatusChange?.(...)` e `onDelete?.(...)`. Como os callbacks são `undefined`, clicar em "A Fazer", "Em Progresso", "Concluído", "Arquivar" e "Excluir" na lista de tarefas não faz nada. O menu aparece, o usuário clica, e o estado não muda.

No `KanbanBoard.tsx:348–350` os três callbacks estão corretamente conectados — o bug é exclusivo da page de lista de tarefas.

**Decisão:** Implementar handlers na `TasksPage` e passar ao componente:

```typescript
const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await container.tasks.updateStatus.execute({ taskId, status: newStatus });
    // revalidar tasks
};
```

---

### Gap 4 — `onDelete` sem confirmação (Importante)

**Arquivo:** `TasksTableView.tsx:288–292`, `KanbanBoard.tsx`

```typescript
// ❌ Exclusão imediata sem diálogo
<DropdownMenuItem onClick={() => onDelete?.(task.id)} className="text-red-500">
    <Trash2 className="h-4 w-4 mr-2" /> Excluir
</DropdownMenuItem>
```

Excluir uma tarefa é irreversível. Arquivar é reversível e também não tem confirmação. Padrão consistente com o resto do sistema (ex: `ecoponto.actions.ts` usa `confirmationRequired: true`).

**Decisão:** Envolver em `AlertDialog` antes de propagar para o callback:

```typescript
<AlertDialog>
    <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
    </AlertDialogTrigger>
    <AlertDialogContent>
        <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete?.(task.id)}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
```

---

### Gap 5 — `cancelado` e `solicitacao` sem badge em `getStatusBadge` (Importante)

**Arquivo:** `TasksTableView.tsx:109–120`

`KanbanTask.status` define 5 valores: `'a_fazer' | 'em_progresso' | 'concluido' | 'solicitacao' | 'cancelado'`. O `switch` só trata 3:

```typescript
// ❌ Cai no default — exibe string crua "cancelado" ou "solicitacao"
default:
    return <Badge variant="outline">{status}</Badge>;
```

`KanbanBoard.tsx:341` inclui tarefas com status `solicitacao` no array passado ao `TasksTableView` quando `isTechnicalAdmin`. Essas tarefas aparecem na tabela com badge exibindo o texto literal.

**Decisão:**

```typescript
case 'solicitacao':
    return <Badge className="bg-purple-500"><Star className="h-3 w-3 mr-1" />Solicitação</Badge>;
case 'cancelado':
    return <Badge variant="outline" className="text-gray-400 line-through">Cancelado</Badge>;
```

---

### Gap 6 — Imports mortos em `TasksTableView` (Médio)

**Arquivo:** `TasksTableView.tsx:19,27`

```typescript
import {
    ...
    FolderKanban,   // linha 19 — não usado em JSX nem em lógica
    ...
    ShieldCheck,    // linha 27 — não usado em JSX nem em lógica
    ...
} from "lucide-react";
```

`FolderKanban` e `ShieldCheck` estão importados mas não aparecem em nenhuma referência no arquivo. Provavelmente foram planejados para a coluna "Projeto" e "Acesso" mas não chegaram a ser usados.

**Decisão:** Remover as duas importações.

---

### Gap 7 — `meu_nivel_acesso` sem fallback na coluna "Acesso" (Médio)

**Arquivo:** `TasksTableView.tsx:246–252`

```typescript
// ❌ Se undefined: célula vazia sem indicação
{task.meu_nivel_acesso === 'dono' && <Badge ...>Dono</Badge>}
{task.meu_nivel_acesso === 'edicao' && <Badge ...>Edição</Badge>}
{task.meu_nivel_acesso === 'leitura' && <Badge ...>Leitura</Badge>}
// Se nenhum case bate: nada renderiza
```

Tarefas sem `meu_nivel_acesso` (campo opcional em `KanbanTask`) deixam a célula completamente vazia — sem traço, sem "—", sem badge.

**Decisão:** Adicionar fallback:

```typescript
{!task.meu_nivel_acesso && <span className="text-muted-foreground text-xs">—</span>}
```

---

### Gap 8 — `formatDate` omite o ano (Médio)

**Arquivo:** `TasksTableView.tsx:122–126`

```typescript
return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
// Resultado: "29/05" — ano invisível
```

Tarefas com prazo em 2027 aparecem iguais a tarefas com prazo em 2026. Em listas longas com prazos variados, o usuário não consegue distinguir o ano sem abrir o detalhe.

**Decisão:** Incluir ano quando diferente do ano atual:

```typescript
const isThisYear = date.getFullYear() === new Date().getFullYear();
return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
    ...(isThisYear ? {} : { year: '2-digit' }),
});
```

---

### Gap 9 — Sem estado de carregamento na tabela (Médio)

**Arquivo:** `TasksTableView.tsx:178–184`, `app/tasks/page.tsx:32–38`

A `TasksPage` tem `isLoading` de `useKanbanData`, mas quando `isLoading = true` mostra texto "Carregando..." e não passa `tasks` ao componente. Quando `isLoading = false` e `tasks = []` (dados carregados mas vazios), `TasksTableView` exibe "Nenhuma tarefa encontrada" — correto.

O problema é que `TasksTableView` não recebe uma prop `isLoading`. Quando usado em outros contextos (futuro), o caller precisa lembrar de tratar o estado de carga externamente.

**Decisão:** Adicionar prop opcional:

```typescript
interface TasksTableViewProps {
    tasks: UnifiedTaskView[];
    isLoading?: boolean;
    // ...
}
// No componente:
if (isLoading) return <SkeletonTable rows={5} cols={10} />;
```

---

### Gap 10 — `parseRecorrencia` definida dentro do componente (Baixo)

**Arquivo:** `TasksTableView.tsx:57–94`

Função pura de parse declarada dentro do corpo do componente — recriada a cada render. Com listas de 100+ tarefas e re-renders frequentes (ex: drag no Kanban que usa o mesmo componente), isso é ruído desnecessário.

**Decisão:** Mover para módulo-nível (fora do componente) ou para `lib/task-utils.ts`.

---

### Gap 11 — `getPriorityBadge` / `formatPriority` duplicados (Baixo)

**Arquivo:** `TasksTableView.tsx:96–107`, `TaskMetricsContent.tsx:29–37`

Mesmo mapeamento de prioridades (`alta/media/baixa/sem_prioridade`) implementado duas vezes com APIs diferentes (JSX vs. `{ label, color }`). Adição de nova prioridade (ex: `urgente`) exige mudança em dois lugares.

**Decisão:** Extrair para `lib/task-priority.ts`:

```typescript
export const PRIORITY_CONFIG: Record<string, { label: string; color: string; variant: string }> = {
    alta: { label: 'Alta', color: 'bg-red-500', variant: 'destructive' },
    media: { label: 'Média', color: 'bg-yellow-500', variant: 'warning' },
    baixa: { label: 'Baixa', color: 'bg-green-500', variant: 'secondary' },
    sem_prioridade: { label: 'Sem Prioridade', color: 'bg-gray-400', variant: 'outline' },
};
```

---

### Gap 12 — Campos `num_comentarios`, `num_anexos`, `num_registros` invisíveis (Baixo)

**Arquivo:** `types/index.ts:305–307`, `TasksTableView.tsx`

`UnifiedTaskView` carrega `num_comentarios`, `num_anexos` e `num_registros` mas a tabela não exibe nenhum deles. A coluna "Monitoramento" mostra apenas `interessados.length`. Usuários não têm como saber pela tabela quais tarefas têm comentários ou anexos pendentes.

**Decisão (sugestão, não bloqueante):** Adicionar ícones compactos na coluna Monitoramento ou numa coluna "Atividade":

```tsx
<div className="flex gap-2 text-xs text-muted-foreground">
    {task.num_comentarios > 0 && <span><MessageSquare className="h-3 w-3 inline" /> {task.num_comentarios}</span>}
    {task.num_anexos > 0 && <span><Paperclip className="h-3 w-3 inline" /> {task.num_anexos}</span>}
</div>
```

---

### Gap 13 — Sem ordenação, filtro de status ou paginação (Baixo / Roadmap)

**Arquivo:** `TasksTableView.tsx`

A tabela não possui:
- Ordenação por coluna (prazo, prioridade, status)
- Filtro de status rápido (ex: mostrar só "atrasadas")
- Paginação ou virtualização

Para listas grandes (Kanban com centenas de tarefas no modo lista), o componente renderiza tudo. `KanbanBoard.tsx` já faz filtragem por `searchTerm` antes de passar ao componente, mas `tasks/page.tsx` passa o array completo sem filtro.

**Decisão:** Fora do escopo imediato, mas registrar como roadmap para quando o volume de tarefas justificar.

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo | Esforço |
|---|-----|-----------|---------|---------|
| 1 | `daysBack` não filtra KPIs, usuários, prioridades | Crítico | `useTaskMetrics.ts`, use cases | Médio |
| 2 | Gráfico hardcoded em 7 dias | Crítico | `TaskMetricsContent.tsx:43` | Baixo |
| 3 | Dropdown de ações inerte em `tasks/page.tsx` | Crítico | `app/tasks/page.tsx:41` | Médio |
| 4 | `onDelete` sem confirmação | Importante | `TasksTableView.tsx:288` | Baixo |
| 5 | `cancelado`/`solicitacao` sem badge | Importante | `TasksTableView.tsx:109` | Baixo |
| 6 | Imports mortos (`FolderKanban`, `ShieldCheck`) | Médio | `TasksTableView.tsx:19,27` | Trivial |
| 7 | `meu_nivel_acesso` sem fallback "—" | Médio | `TasksTableView.tsx:246` | Trivial |
| 8 | `formatDate` sem ano | Médio | `TasksTableView.tsx:122` | Baixo |
| 9 | Sem prop `isLoading` na tabela | Médio | `TasksTableView.tsx` | Baixo |
| 10 | `parseRecorrencia` dentro do componente | Baixo | `TasksTableView.tsx:57` | Trivial |
| 11 | `getPriorityBadge` duplicado | Baixo | ambos os componentes | Baixo |
| 12 | `num_comentarios/anexos` ignorados | Baixo | `TasksTableView.tsx` | Baixo |
| 13 | Sem sort/filtro/paginação | Roadmap | `TasksTableView.tsx` | Alto |

**Gaps 3, 6 e 7 são triviais/baixo esforço e devem ser feitos imediatamente.**  
**Gap 1 é o mais impactante para o usuário — o seletor de período parece funcionar mas não funciona.**  
**Gap 4 e 5 devem acompanhar qualquer trabalho nos handlers (gap 3).**

---

## O que está bem (não tocar)

- `renderDateCell` — lógica de exibição de prazo único/período/recorrente é correta e bem estruturada
- `useTaskMetrics` — error handling com `err instanceof Error` correto (sem catch silencioso)
- `TasksTableView` — `stopPropagation` na célula de ações evita ativar `onTaskClick` ao abrir o dropdown
- `TaskMetricsContent` — display de erro não bloqueia o resto da UI; seletor de período com `useRouter`-less state (local) é simples e adequado
- `KanbanBoard` usa `TasksTableView` com todos os handlers corretamente conectados

## Relação com ADRs Existentes

- **ADR-038/039/040 (gaps sistêmicos):** gap 3 (handlers ausentes) e gap 4 (sem confirmação) seguem padrão já identificado de side effects silenciosos na camada de interface
- **ADR-031-desktop (QueryCatalog):** gap 1 (`useTaskMetrics` com SQL direto via container) entra na lista de migrações; os use cases `metricsSummary`, `metricsByUser`, `metricsByPriority` precisam aceitar `daysBack` — mudança coordenada com QueryCatalog
