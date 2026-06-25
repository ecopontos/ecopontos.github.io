import { useMemo } from "react";
import { MANIFESTACAO_WORKFLOW } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";
import { ManifestacaoStateMachine } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import { MANIFESTACAO_PRESENTATION } from "@/src/interface/workflow/ManifestacaoWorkflowPresentation";
import type { WorkflowContext } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";

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
            showEncaminhadoSemaBadge: resolveSection("encaminhadoSema"),
            badgeVariant: presentation.badgeVariant,
            transicoesPossiveis: transicoes,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(ctx)]);
}
