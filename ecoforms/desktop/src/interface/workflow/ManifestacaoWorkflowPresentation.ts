import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost";

export interface ActionPresentation {
    label: string;
    variant: ButtonVariant;
    icon?: string;
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
            enviarAvaliacao: { label: "Enviar para Avaliação do Cidadão", variant: "default" },
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
