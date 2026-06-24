# ADR-016 — Extração da Máquina de Estados da UI: Workflow Definition para Ouvidoria

- **Status**: Implementado
- **Data**: 2026-05-19 (revisado 2026-05-20)
- **Autor**: Engenharia reversa assistida (Claude Code)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito (aprovação do time) → Implementado (critérios de aceitação verificados por `grep`) → Supersedido
- **Pré-requisito**: Nenhum — este ADR é executado **em conjunto** com a Fase B do ADR-014 no domínio `ouvidoria` (eliminação de `useSqlite` direto na mesma página). Ambos compõem um único PR; não é um pré-requisito sequencial.
- **Relacionados**: ADR-013 (ManifestacaoStateMachine), ADR-014 (Adequação Arquitetural), ADR-015 (Motor de Agendamento Compartilhado)
- **Aviso**: ADR-013 é referenciado mas não existe em `docs/adr/` — criar retroativamente ou substituir pela referência a `desktop/src/domain/ouvidoria/ManifestacaoStateMachine.ts`.

---

## Contexto

A máquina de estados da ouvidoria já está formalizada no domínio (`ManifestacaoStateMachine.ts`, ADR-013):

```
aberta → em_analise → em_atendimento → respondida → em_avaliacao → encerrada (terminal)
                    ↘ encaminhado_sema (terminal)
                    ↘ devolvida → em_analise
                    ↘ cancelada (terminal)
aberta → cancelada (terminal)
```

No entanto, a página `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` (~1464 linhas) não consome essa máquina de estados. Em vez disso, codifica manualmente o comportamento de cada status com **~8 condicionais inline** na página de detalhe e **~6 condicionais** na página de lista:

**Na página de detalhe (`ManifestacaoDetailPage.tsx`):**
- `manifestacao.status === 'aberta'` — decide transição automática para `em_analise` (linha 479)
- `manifestacao.status === 'encaminhado_sema'` — decide se mostra badge de encaminhamento (linha 526)
- `manifestacao.status === 'em_atendimento' && !manifestacao.aceiteEm` — decide se mostra botão "Aceitar Manifestação" (linha 609)
- `manifestacao.status === 'respondida'` — decide se mostra botão "Enviar para Avaliação" (linha 622)
- `['respondida','em_avaliacao'].includes(manifestacao.status)` — decide se mostra botão "Encerrar" (linha 627)
- `manifestacao.status === 'em_avaliacao'` — decide se mostra botão "Reabrir para Retrabalho" (linha 632)
- `manifestacao.status === 'devolvida'` — decide se mostra botão "Retornar para Análise" (linha 637)
- `manifestacao.competencia === 'compete' && manifestacao.status === 'em_analise'` — decide se mostra card de classificação (linha 655)
- `!['encerrada','cancelada','encaminhado_sema'].includes(manifestacao.status)` — guarda geral para ações de fluxo e tramitação (linhas 505, 603, 836)

Além disso, a página `app/manifestacoes/page.tsx` (~850 linhas) repete lógica de filtro por status (`em_atendimento`, `devolvida`, `aberta`) em **~6 ocorrências**:

### Problemas causados

1. **Duplicação de conhecimento**: a máquina de estados existe no domínio, mas a UI mantém uma cópia paralela (e inconsistente) das regras — ~8 condicionais na detail + ~6 na list.
2. **Fragilidade**: adicionar um novo status (ex: `suspenso`) exige caçar todos os `includes(...)` e `===` em duas páginas.
3. **Testabilidade**: não é possível testar as regras de visibilidade isoladamente sem montar a página inteira.
4. **Débito técnico documental**: `ManifestacaoStateMachine.isTerminal('encaminhado_sema')` retorna `false` no código (o método só verifica `cancelada` e `encerrada`), mas a UI e a política de negócio tratam `encaminhado_sema` como terminal há tempos. A divergência é puramente documental — o diagrama e o comportamento real da UI estão alinhados; é o `isTerminal` do StateMachine que está incompleto. Este ADR não altera a máquina de estados, mas documenta o débito para correção futura.

---

## Decisão

Extrair a definição do workflow da ouvidoria para um **objeto de configuração centralizado** (`ManifestacaoWorkflowConfig`) que a UI consome em vez de codificar regras inline.

**Por que Config Object e não o padrão do ADR-015?**
O ADR-015 usa um `Record<TipoAgendamento, AgendamentoTipoConfig>` estaticamente tipado para agendamentos — também um conjunto fechado na prática. A diferença real não está na mecânica de tipagem (ambos usam `Record`), mas no **domínio**: status de manifestação são decisões de negócio centralizadas na `ManifestacaoStateMachine`, enquanto tipos de agendamento podem evoluir com menos impacto. O `Record<ManifestacaoStatus, ...>` garante exhaustividade em tempo de compilação, o que é o requisito crítico aqui.

A arquitetura consiste em **quatro camadas**, separando regras de domínio, semântica de workflow, apresentação de UI e consumo React:

1. **Domínio (inalterado)**: `ManifestacaoStateMachine` continua como fonte de verdade das transições válidas.
2. **Política de Workflow (novo, domínio)**: `ManifestacaoWorkflowPolicy` define o que cada status *significa* em termos de domínio (`isTerminal`, `canEdit`, `canTramitar`, etc.). Essa camada *não* conhece UI.
3. **Configuração de UI (interface)**: `ManifestacaoWorkflowConfig` consome a política e mapeia ações, seções e filtros de lista. Decisões de aparência (variantes de botão, ícones, labels) vivem em `ManifestacaoWorkflowPresentation`, não misturadas com regras.
4. **Hook de workflow (interface)**: `useManifestacaoWorkflow(manifestacao, userPerfil)` consome política + config + máquina de estados e expõe booleanos computados (`canClassificar`, `canEncerrar`, `isTerminal`, `actionsDisponiveis`, etc.).

---

## Estrutura Proposta

### 1. Política de Workflow (`desktop/src/domain/ouvidoria/ManifestacaoWorkflowPolicy.ts`)

Camada pura de domínio. Define o significado semântico de cada status sem referenciar React, componentes ou variantes de botão.

```typescript
import type { ManifestacaoStatus } from "./ManifestacaoStateMachine";
import { ManifestacaoStateMachine } from "./ManifestacaoStateMachine";

export interface WorkflowPolicy {
    isTerminal: boolean;
    canEdit: boolean;
    canTramitar: boolean;
    canResponder: boolean;
    // Fases do fluxo de atendimento que este status permite
    permiteFase: {
        classificacao: boolean;
        resposta: boolean;
        avaliacao: boolean;
    };
}

/**
 * Fonte de verdade semântica do workflow de manifestação.
 * Qualquer mudança no significado de um status (ex: novo status
 * ou alteração de terminalidade) deve ocorrer aqui primeiro.
 */
export const MANIFESTACAO_POLICY: Record<ManifestacaoStatus, WorkflowPolicy> = {
    aberta: {
        isTerminal: false,
        canEdit: true,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    em_analise: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: true,
        permiteFase: { classificacao: true, resposta: true, avaliacao: false },
    },
    em_atendimento: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: true,
        permiteFase: { classificacao: false, resposta: true, avaliacao: false },
    },
    respondida: {
        isTerminal: false,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: true },
    },
    em_avaliacao: {
        isTerminal: false,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: true },
    },
    devolvida: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: true,
        permiteFase: { classificacao: false, resposta: true, avaliacao: false },
    },
    encaminhado_sema: {
        // Comportamento idêntico a cancelada/encerrada na UI há tempos.
        // Débito técnico: ManifestacaoStateMachine.isTerminal deveria incluir
        // 'encaminhado_sema' para alinhar com esta política.
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    cancelada: {
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    encerrada: {
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
};

export function resolvePolicy(status: ManifestacaoStatus): WorkflowPolicy {
    const policy = MANIFESTACAO_POLICY[status];
    if (!policy) throw new Error(`Status desconhecido: ${status}`);
    return policy;
}

/** Alias para compatibilidade com consumidores que esperam isTerminal do domínio */
export function isManifestacaoTerminal(status: ManifestacaoStatus): boolean {
    return resolvePolicy(status).isTerminal;
}
```

### 2. Apresentação de UI (`desktop/src/interface/workflow/ManifestacaoWorkflowPresentation.ts`)

Decisões de *aparência* isoladas das regras de negócio. Labels, variantes de botão e ícones vivem aqui. Pode ser editado por designers sem tocar em regras de domínio.

```typescript
import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost";

export interface ActionPresentation {
    label: string;
    variant: ButtonVariant;
    icon?: string; // chave no ICON_MAP do componente
}

export const MANIFESTACAO_PRESENTATION: Record<ManifestacaoStatus, {
    badgeVariant: BadgeVariant;
    acoesPadrao: Record<string, ActionPresentation>;
}> = {
    aberta: {
        badgeVariant: "default",
        acoesPadrao: {
            avaliarCompetencia: { label: "Avaliar Competência", variant: "outline" },
            encaminharSema:     { label: "Encaminhar para outra Ouvidoria", variant: "outline", icon: "Send" },
            cancelar:           { label: "Cancelar Manifestação", variant: "ghost" },
        },
    },
    em_analise: {
        badgeVariant: "secondary",
        acoesPadrao: {
            classificar: { label: "Classificar e Encaminhar", variant: "default" },
            cancelar:    { label: "Cancelar", variant: "ghost" },
        },
    },
    em_atendimento: {
        badgeVariant: "secondary",
        acoesPadrao: {
            aceitar:  { label: "Aceitar Manifestação", variant: "secondary" },
            cancelar: { label: "Cancelar", variant: "ghost" },
        },
    },
    respondida: {
        badgeVariant: "outline",
        acoesPadrao: {
            enviarAvaliacao: { label: "Enviar para Avaliação", variant: "default" },
            encerrar:        { label: "Encerrar Manifestação", variant: "outline" },
        },
    },
    em_avaliacao: {
        badgeVariant: "outline",
        acoesPadrao: {
            encerrar: { label: "Encerrar Manifestação", variant: "outline" },
            reabrir:  { label: "Reabrir para Retrabalho", variant: "outline" },
            cancelar: { label: "Cancelar", variant: "ghost" },
        },
    },
    devolvida: {
        badgeVariant: "outline",
        acoesPadrao: {
            reativar: { label: "Retornar para Análise", variant: "default" },
        },
    },
    encaminhado_sema: {
        badgeVariant: "secondary",
        acoesPadrao: {},
    },
    cancelada: {
        badgeVariant: "destructive",
        acoesPadrao: {},
    },
    encerrada: {
        badgeVariant: "destructive",
        acoesPadrao: {},
    },
};
```

### 3. Configuração de UI (`desktop/src/interface/workflow/ManifestacaoWorkflowConfig.ts`)

Mapeia semântica (policy) + apresentação para cada status. Define ações com permissões e visibilidade condicional, além de filtros de lista.

```typescript
import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import { MANIFESTACAO_POLICY } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import { MANIFESTACAO_PRESENTATION } from "./ManifestacaoWorkflowPresentation";

export type PerfilUsuario = 'admin' | 'gerente' | 'coordenador' | 'analista' | 'operador';

export interface WorkflowContext {
    status: ManifestacaoStatus;
    competencia?: string | null;
    aceiteEm?: string | null;
    respostasFormatadas: number;
    userPerfil?: PerfilUsuario;
}

export interface WorkflowActionDef {
    key: string;
    presentationKey: string;
    requiresPermission?: PerfilUsuario[];
    visible?: (ctx: WorkflowContext) => boolean;
}

export interface WorkflowConfigEntry {
    policy: typeof MANIFESTACAO_POLICY[ManifestacaoStatus];
    presentation: typeof MANIFESTACAO_PRESENTATION[ManifestacaoStatus];
    actions: WorkflowActionDef[];
    sections: Record<string, boolean | ((ctx: WorkflowContext) => boolean)>;
    listFilter?: (m: ManifestacaoSummary) => boolean; // null = status não aparece em filtro de lista
}

export interface ManifestacaoSummary {
    id: string;
    status: ManifestacaoStatus;
    aceiteEm?: string | null;
    // outros campos necessários para filtros de lista
}

/**
 * Configuração unificada de workflow: detail + list.
 * O Record<ManifestacaoStatus, ...> garante que um novo status obrigue
 * preenchimento de todas as propriedades em tempo de compilação.
 */
export const MANIFESTACAO_WORKFLOW: Record<ManifestacaoStatus, WorkflowConfigEntry> = {
    aberta: {
        policy: MANIFESTACAO_POLICY.aberta,
        presentation: MANIFESTACAO_PRESENTATION.aberta,
        actions: [
            { key: "avaliarCompetencia", presentationKey: "avaliarCompetencia", requiresPermission: ['admin','gerente','coordenador'] },
            { key: "encaminharSema", presentationKey: "encaminharSema", requiresPermission: ['admin','gerente','coordenador'] },
            { key: "cancelar", presentationKey: "cancelar" },
        ],
        sections: { fluxo: true, classificacao: false, respostas: false },
        listFilter: (m) => m.status === 'aberta',
    },
    em_analise: {
        policy: MANIFESTACAO_POLICY.em_analise,
        presentation: MANIFESTACAO_PRESENTATION.em_analise,
        actions: [
            { key: "classificar", presentationKey: "classificar" },
            { key: "cancelar", presentationKey: "cancelar" },
        ],
        sections: { fluxo: true, classificacao: (ctx) => ctx.competencia === 'compete', respostas: true },
        listFilter: (m) => m.status === 'em_analise',
    },
    em_atendimento: {
        policy: MANIFESTACAO_POLICY.em_atendimento,
        presentation: MANIFESTACAO_PRESENTATION.em_atendimento,
        actions: [
            { key: "aceitar", presentationKey: "aceitar", visible: (ctx) => !ctx.aceiteEm },
            { key: "cancelar", presentationKey: "cancelar" },
        ],
        sections: { fluxo: true, classificacao: false, respostas: true },
        listFilter: (m) => m.status === 'em_atendimento',
    },
    respondida: {
        policy: MANIFESTACAO_POLICY.respondida,
        presentation: MANIFESTACAO_PRESENTATION.respondida,
        actions: [
            { key: "enviarAvaliacao", presentationKey: "enviarAvaliacao" },
            { key: "encerrar", presentationKey: "encerrar" },
        ],
        sections: { fluxo: true, classificacao: false, respostas: true },
        listFilter: (m) => m.status === 'respondida',
    },
    em_avaliacao: {
        policy: MANIFESTACAO_POLICY.em_avaliacao,
        presentation: MANIFESTACAO_PRESENTATION.em_avaliacao,
        actions: [
            { key: "encerrar", presentationKey: "encerrar" },
            { key: "reabrir", presentationKey: "reabrir" },
            { key: "cancelar", presentationKey: "cancelar" },
        ],
        sections: { fluxo: true, classificacao: false, respostas: false },
        listFilter: (m) => m.status === 'em_avaliacao',
    },
    devolvida: {
        policy: MANIFESTACAO_POLICY.devolvida,
        presentation: MANIFESTACAO_PRESENTATION.devolvida,
        actions: [
            { key: "reativar", presentationKey: "reativar" },
        ],
        sections: { fluxo: true, classificacao: false, respostas: true },
        listFilter: (m) => m.status === 'devolvida',
    },
    encaminhado_sema: {
        policy: MANIFESTACAO_POLICY.encaminhado_sema,
        presentation: MANIFESTACAO_PRESENTATION.encaminhado_sema,
        actions: [],
        sections: { fluxo: false, classificacao: false, respostas: false },
        listFilter: (m) => m.status === 'encaminhado_sema',
    },
    cancelada: {
        policy: MANIFESTACAO_POLICY.cancelada,
        presentation: MANIFESTACAO_PRESENTATION.cancelada,
        actions: [],
        sections: { fluxo: false, classificacao: false, respostas: false },
        listFilter: (m) => m.status === 'cancelada',
    },
    encerrada: {
        policy: MANIFESTACAO_POLICY.encerrada,
        presentation: MANIFESTACAO_PRESENTATION.encerrada,
        actions: [],
        sections: { fluxo: false, classificacao: false, respostas: false },
        listFilter: (m) => m.status === 'encerrada',
    },
};

/** Tabs da lista derivadas do workflow — não precisa de registro separado */
export const MANIFESTACAO_LIST_TABS: Record<string, (m: ManifestacaoSummary) => boolean> = {
    todos: () => true,
    novas: MANIFESTACAO_WORKFLOW.aberta.listFilter!,
    aguardando_aceite: (m) => m.status === 'em_atendimento' && !m.aceiteEm,
    devolvidas: MANIFESTACAO_WORKFLOW.devolvida.listFilter!,
    respondidas: MANIFESTACAO_WORKFLOW.respondida.listFilter!,
    em_avaliacao: MANIFESTACAO_WORKFLOW.em_avaliacao.listFilter!,
    encerradas: (m) => m.status === 'encerrada' || m.status === 'cancelada',
    encaminhadas_sema: MANIFESTACAO_WORKFLOW.encaminhado_sema.listFilter!,
};
```

### 4. Hook de Workflow (`desktop/src/interface/hooks/utils/useManifestacaoWorkflow.ts`)

Consome política + config + máquina de estados. O `useMemo` usa o objeto `ctx` inteiro como dependência (via JSON stringify ou shallow ref) para evitar sincronização manual de deps.

```typescript
import { useMemo } from "react";
import { MANIFESTACAO_WORKFLOW } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";
import { ManifestacaoStateMachine } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import type { WorkflowContext } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";
import { MANIFESTACAO_PRESENTATION } from "@/src/interface/workflow/ManifestacaoWorkflowPresentation";

export function useManifestacaoWorkflow(ctx: WorkflowContext) {
    const config = MANIFESTACAO_WORKFLOW[ctx.status];
    const presentation = MANIFESTACAO_PRESENTATION[ctx.status];

    return useMemo(() => {
        const policy = config.policy;
        const transicoes = ManifestacaoStateMachine.transicoesPossiveis(ctx.status);

        const resolveSection = (key: string): boolean => {
            const val = config.sections[key];
            return typeof val === "function" ? val(ctx) : !!val;
        };

        const hasPermission = (allowed?: string[]): boolean => {
            if (!allowed || allowed.length === 0) return true;
            if (!ctx.userPerfil) return false;
            return allowed.includes(ctx.userPerfil);
        };

        const actions = config.actions
            .filter(a => !a.visible || a.visible(ctx))
            .filter(a => hasPermission(a.requiresPermission))
            .map(a => ({
                key: a.key,
                ...presentation.acoesPadrao[a.presentationKey],
            }));

        return {
            actions,
            isTerminal: policy.isTerminal,
            canEdit: policy.canEdit,
            canTramitar: policy.canTramitar,
            canResponder: policy.canResponder,
            canClassificar: resolveSection("classificacao"),
            showFluxo: resolveSection("fluxo"),
            showRespostas: resolveSection("respostas"),
            badgeVariant: presentation.badgeVariant,
            transicoesPossiveis: transicoes,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(ctx)]);
}
```

### 5. Componente de Ações (`components/ouvidoria/ManifestacaoWorkflowActions.tsx`)

```tsx
"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Send, ShieldCheck, XCircle, CheckCircle2, RotateCcw, Lock } from "lucide-react";
import type { ActionPresentation } from "@/src/interface/workflow/ManifestacaoWorkflowPresentation";

const ICON_MAP: Record<string, React.ElementType> = {
    Send,
    ShieldCheck,
    XCircle,
    CheckCircle2,
    RotateCcw,
    Lock,
};

export interface WorkflowActionItem extends ActionPresentation {
    key: string;
}

interface Props {
    actions: WorkflowActionItem[];
    onAction: (key: string) => void;
    disabled?: boolean;
}

export const ManifestacaoWorkflowActions = memo(function ManifestacaoWorkflowActions({
    actions,
    onAction,
    disabled,
}: Props) {
    if (actions.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {actions.map(a => {
                const Icon = a.icon ? ICON_MAP[a.icon] : null;
                return (
                    <Button
                        key={a.key}
                        size="sm"
                        variant={a.variant}
                        onClick={() => onAction(a.key)}
                        disabled={disabled}
                    >
                        {Icon && <Icon className="h-4 w-4 mr-1" />}
                        {a.label}
                    </Button>
                );
            })}
        </div>
    );
});
```

### 6. Handler de Ações — evitando switch/case monolítico

Em vez de um grande `switch` no page component, usar um **Action Registry** local:

```typescript
// dentro do page component ou em um hook auxiliar
const workflowHandlers: Record<string, () => Promise<void> | void> = {
    aceitar:            handleAceitar,
    cancelar:           () => setShowCancelar(true),
    classificar:        handleClassificar,
    encaminharSema:     () => { setCompetenciaOpcao('nao_compete'); setShowCompetencia(true); },
    avaliarCompetencia: () => setShowCompetencia(true),
    enviarAvaliacao:    handleEnviarAvaliacao,
    encerrar:           handleEncerrar,
    reabrir:            () => setShowReabrir(true),
    reativar:           handleReativarDevolvida,
};

function handleWorkflowAction(key: string) {
    const handler = workflowHandlers[key];
    if (handler) {
        const result = handler();
        if (result && typeof result.then === 'function') {
            result.catch((e: any) => toast.error(e?.message || `Erro na ação ${key}`));
        }
    } else {
        console.warn(`Ação de workflow não mapeada: ${key}`);
    }
}
```

Isso evita o antipattern de "mover o switch de lugar" — cada handler permanece uma função nomeada, testável unitariamente.

### 7. Uso na página refatorada

```tsx
const { actions, showFluxo, showRespostas, canClassificar, isTerminal, badgeVariant } = useManifestacaoWorkflow({
    status: manifestacao.status,
    competencia: manifestacao.competencia,
    aceiteEm: manifestacao.aceiteEm,
    respostasFormatadas: respostas.filter(r => r.respostaFormatada).length,
    userPerfil: user?.perfil as PerfilUsuario,
});

// Guarda geral para ações de fluxo — agora derivado do domínio
{showFluxo && (
    <Card>
        <CardHeader><CardTitle>Ações do Fluxo</CardTitle></CardHeader>
        <CardContent>
            <ManifestacaoWorkflowActions
                actions={actions}
                onAction={handleWorkflowAction}
                disabled={saving}
            />
        </CardContent>
    </Card>
)}

{canClassificar && (
    <Card className="border-primary/40">
        <CardHeader><CardTitle>Classificação Administrativa</CardTitle></CardHeader>
        {/* ... */}
    </Card>
)}
```

---

## Refatoração da Lista (`manifestacoes/page.tsx`)

Com `MANIFESTACAO_LIST_TABS` derivado do workflow, os filtros deixam de ser condicionais inline:

```tsx
// ANTES:
devolvidas: manifestacoes.filter(m => m.status === 'devolvida').length,
// ...
case 'aguardando_aceite': items = items.filter(m => m.status === 'em_atendimento' && !m.aceiteEm); break;

// DEPOIS:
import { MANIFESTACAO_LIST_TABS } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";

const tabs = Object.keys(MANIFESTACAO_LIST_TABS);
const counts = Object.fromEntries(
    tabs.map(key => [key, manifestacoes.filter(MANIFESTACAO_LIST_TABS[key]).length])
);
// ...
const filterFn = MANIFESTACAO_LIST_TABS[tabAtiva];
const items = filterFn ? manifestacoes.filter(filterFn) : manifestacoes;
```

**Nota**: `MANIFESTACAO_LIST_TABS` é derivado de `MANIFESTACAO_WORKFLOW`, mas `aguardando_aceite` e `encerradas` são composições que fogem do mapeamento 1:1 status→filtro. Por isso o registro explícito é necessário — mas ele vive no mesmo arquivo do workflow, evitando divergência.

---

## Consequências

### Positivas

1. **Fonte única de verdade**: `ManifestacaoWorkflowPolicy` consolida o significado semântico de cada status; a UI consome política, não recria regras.
2. **Exhaustividade garantida**: `Record<ManifestacaoStatus, ...>` em policy, config e presentation obriga o compilador a avisar se um status ficar sem definição.
3. **Separação domínio/apresentação**: designers podem alterar `badgeVariant` e `variant` de botão em `ManifestacaoWorkflowPresentation.ts` sem tocar em regras de negócio.
4. **Testabilidade**: `useManifestacaoWorkflow` pode ser testado unitariamente com mock de contexto; `ManifestacaoWorkflowPolicy` pode ser testado sem React.
5. **Permissões centralizadas**: `requiresPermission` no config elimina os `if (user?.perfil === 'admin' ...)` inline na página.
6. **Lista unificada**: filtros de tab derivados do mesmo workflow — adicionar um status exige editar um único arquivo de config.
7. **Alinhamento com ADR-013**: a máquina de estados do domínio é consumida explicitamente; divergências futuras serão visíveis.

### Negativas / Custos

1. **Indireção**: desenvolvedores precisam aprender três arquivos (`Policy`, `Presentation`, `Config`) em vez de ler condicionais inline.
2. **Refatoração inicial**: a página `ManifestacaoDetailPage.tsx` (~1464 linhas) precisa ser reescrita cuidadosamente. A granularidade em PRs menores (ver abaixo) mitiga o risco.
3. **useMemo com JSON.stringify**: serializar `ctx` a cada render é aceitável para objetos pequenos, mas ligeiramente mais custoso que deps manuais. A alternativa (deps manuais) é mais rápida mas error-prone; optamos por segurança.
4. **Action Registry no page**: o `workflowHandlers` ainda é um mapa imperativo no componente. Isso é aceitável porque os handlers de fato dependem de estado local (modais, formulários) do page component.

### Não muda

- `ManifestacaoStateMachine.ts` permanece inalterado — este ADR adiciona uma camada acima, não modifica a máquina.
- `UpdateManifestacaoStatusUseCase.ts` permanece inalterado.
- As mutações (`addTramitacao`, `addResposta`, etc.) permanecem inalteradas.
- O schema do banco permanece inalterado.

---

## Ordem de Execução e Coordenação com ADR-014

**Este ADR não é independente** — é parte da **Fase B do ADR-014 no domínio `ouvidoria`** (eliminação de `useSqlite` direto + extração de workflow). Ambos alteram `ManifestacaoDetailPage.tsx` (~1464 linhas) e devem compor **um único PR** no domínio ouvidoria para evitar conflito de merge e testes duplicados.

### Dentro do PR do domínio ouvidoria (ADR-014 Fase B + ADR-016)

A entrega interna ocorre em commits incrementais e reversíveis:

```
Commit 1 — Criar ManifestacaoWorkflowPolicy.ts + testes unitários           ~3 horas
           (dead code, não consumido pela UI ainda)

Commit 2 — Criar ManifestacaoWorkflowPresentation.ts + ManifestacaoWorkflowConfig.ts
           + useManifestacaoWorkflow.ts + testes                             ~4 horas
           (dead code, não consumido pela UI ainda)

Commit 3 — Criar ManifestacaoWorkflowActions.tsx + Action Registry          ~2 horas
           (dead code)

Commit 4 — Refatorar badges de status na detail page para usar useManifestacaoWorkflow
           ~2 horas
           (primeiro ponto de contato vivo com a UI — escopo mínimo, fácil rollback)

Commit 5 — Refatorar card "Ações do Fluxo" na detail page                     ~4 horas
           (substituir os ~5 condicionais de botão pelo componente + action registry)

Commit 6 — Refatorar card "Classificação Administrativa" na detail page       ~2 horas
           (substituir competencia === 'compete' && status === 'em_analise' por canClassificar)

Commit 7 — Refatorar guardas de tramitação (linhas 836+) na detail page       ~2 horas
           (substituir !['encerrada','cancelada','encaminhado_sema'].includes por !isTerminal)

Commit 8 — Refatorar filtros da lista (page.tsx) para MANIFESTACAO_LIST_TABS  ~3 horas

Commit 9 — Remover dead code: maps inline de badge, condicionais obsoletos   ~2 horas

Commit 10 — Eliminar useSqlite direto da detail/list page (ADR-014 Fase B)   ~4 horas

Commit 11 — Testes de regressão end-to-end (todos os status/fluxos)          ~1 dia
```

**Estimativa total do PR ouvidoria**: ~1.5 semanas.

**Não separar em PRs independentes**: o ADR-016 depende da limpeza de `useSqlite` na mesma página (ADR-014 Fase B). Tentar entregar ADR-016 sem ADR-014 Fase B deixa a página em estado híbrido (workflow refatorado, mas acesso a dados ainda direto), criando mais dívida técnica em vez de reduzi-la.

---

## Critérios de Aceitação

1. `grep -r "status === '" app/manifestacoes/` retorna **zero resultados** nas páginas de detalhe e lista (exceto no hook `useManifestacaoWorkflow`, na configuração e na policy).
2. `grep -r "\['encerrada','cancelada','encaminhado_sema'\].includes" app/manifestacoes/` retorna **zero resultados**.
3. `grep -r "user?.perfil === " app/manifestacoes/` retorna **zero resultados** — permissões devem ser filtradas pelo hook.
4. Adicionar um novo status à ouvidoria exige editar **apenas** `ManifestacaoWorkflowPolicy.ts`, `ManifestacaoWorkflowPresentation.ts`, `ManifestacaoWorkflowConfig.ts` e `ManifestacaoStateMachine.ts`.
5. `ManifestacaoWorkflowPolicy` tem cobertura de teste unitário para todos os status.
6. `useManifestacaoWorkflow` tem cobertura de teste unitário para todos os status × contextos.
7. Todos os fluxos de regressão passam: aberta → em_analise → em_atendimento → respondida → em_avaliacao → encerrada, incluindo devolução, cancelamento e encaminhamento à SEMA.
