import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import { MANIFESTACAO_POLICY } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import { MANIFESTACAO_PRESENTATION } from "./ManifestacaoWorkflowPresentation";

export type PerfilUsuario = 'admin' | 'gerente' | 'coordenador' | 'analista' | 'encarregado' | 'operador' | 'campo';

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

export interface ManifestacaoSummary {
    id: string;
    status: string;
    aceiteEm?: string | null;
}

export interface WorkflowConfigEntry {
    policy: typeof MANIFESTACAO_POLICY[ManifestacaoStatus];
    presentation: typeof MANIFESTACAO_PRESENTATION[ManifestacaoStatus];
    actions: WorkflowActionDef[];
    sections: Record<string, boolean | ((ctx: WorkflowContext) => boolean)>;
    listFilter: (m: ManifestacaoSummary) => boolean;
}

export const MANIFESTACAO_WORKFLOW: Record<ManifestacaoStatus, WorkflowConfigEntry> = {
    aberta: {
        policy: MANIFESTACAO_POLICY.aberta,
        presentation: MANIFESTACAO_PRESENTATION.aberta,
        actions: [
            { key: "avaliarCompetencia", presentationKey: "avaliarCompetencia", requiresPermission: ['admin', 'gerente', 'coordenador'] },
            { key: "encaminharSema", presentationKey: "encaminharSema", requiresPermission: ['admin', 'gerente', 'coordenador'] },
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
        sections: { fluxo: false, classificacao: false, respostas: false, encaminhadoSema: true },
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

export const MANIFESTACAO_LIST_TABS: Record<string, (m: ManifestacaoSummary) => boolean> = {
    todos:              () => true,
    novas:              MANIFESTACAO_WORKFLOW.aberta.listFilter,
    aguardando_aceite:  (m) => m.status === 'em_atendimento' && !m.aceiteEm,
    devolvidas:         MANIFESTACAO_WORKFLOW.devolvida.listFilter,
    respondidas:        MANIFESTACAO_WORKFLOW.respondida.listFilter,
    em_avaliacao:       MANIFESTACAO_WORKFLOW.em_avaliacao.listFilter,
    encerradas:         (m) => m.status === 'encerrada' || m.status === 'cancelada',
    encaminhadas_sema:  MANIFESTACAO_WORKFLOW.encaminhado_sema.listFilter,
};
