"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TblSuiteRecord, FormRegistry } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { FormRenderer } from "@/components/runtime/FormRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle, XCircle, Edit, AlertTriangle, Save, X } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

import { useSubmissionData } from "@/src/interface/hooks/catalog/forms";
import {
  fetchPacoteById,
  fetchFormByIdOrSlug,
  updatePacoteStatus,
  updatePacoteDados,
} from "@/src/interface/hooks/queries/lookups";

type QueryRow = Record<string, unknown>;

type SubmissionViewRecord = TblSuiteRecord & {
    localizacao?: unknown;
    synced_at?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonIfNeeded(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === "string" && error.trim() !== "") {
        return error;
    }

    return fallback;
}

function toStringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function toOptionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function toNullableString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function toNumberValue(value: unknown): number {
    if (typeof value === "number") {
        return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toBooleanOrNumber(value: unknown): boolean | number {
    if (typeof value === "boolean" || typeof value === "number") {
        return value;
    }

    return false;
}

function toFormContent(value: unknown): FormRegistry["conteudo"] {
    if (!isRecord(value)) {
        return {
            id: "",
            titulo: "",
            campos: [],
        };
    }

    const layout = isRecord(value.layout)
        ? (() => {
            let columns: 1 | 2 | 3 | 4 = 1;
            if (value.layout.columns === 2 || value.layout.columns === 3 || value.layout.columns === 4) {
                columns = value.layout.columns;
            }

            const gap: "sm" | "md" | "lg" | undefined =
                value.layout.gap === "sm" || value.layout.gap === "md" || value.layout.gap === "lg"
                    ? value.layout.gap
                    : undefined;

            return { columns, gap };
        })()
        : undefined;

    return {
        id: toStringValue(value.id),
        titulo: toStringValue(value.titulo),
        campos: Array.isArray(value.campos)
            ? (value.campos as unknown as FormRegistry["conteudo"]["campos"])
            : [],
        layout,
    };
}

function toSubmissionViewRecord(record: QueryRow): SubmissionViewRecord {
    const parsedDados = parseJsonIfNeeded(record.dados);

    return {
        id: toStringValue(record.id),
        criado_em: toStringValue(record.criado_em),
        atualizado_em: toStringValue(record.atualizado_em),
        user_id: toNullableString(record.user_id),
        tipo_form: toStringValue(record.tipo_form),
        ativo: Boolean(record.ativo),
        dados: isRecord(parsedDados) ? parsedDados : {},
        status: toOptionalString(record.status),
        revisor_id: toOptionalString(record.revisor_id),
        revisado_em: toOptionalString(record.revisado_em),
        motivo_rejeicao: toOptionalString(record.motivo_rejeicao),
        notas_revisao: toOptionalString(record.notas_revisao),
        processado_em: toOptionalString(record.processado_em),
        arquivado_em: toOptionalString(record.arquivado_em),
        prazo_correcao: toOptionalString(record.prazo_correcao),
        usuario_nome_completo: toOptionalString(record.usuario_nome_completo),
        sync_status: typeof record.sync_status === "string" || record.sync_status === null
            ? record.sync_status
            : null,
        localizacao: record.localizacao,
        synced_at: typeof record.synced_at === "string" || record.synced_at === null
            ? record.synced_at
            : undefined,
    };
}

function toFormRegistryRecord(record: QueryRow): FormRegistry {
    return {
        form_id: toStringValue(record.form_id),
        titulo: toStringValue(record.titulo),
        versao: toNumberValue(record.versao),
        conteudo: toFormContent(parseJsonIfNeeded(record.conteudo)),
        criado_em: toStringValue(record.criado_em),
        atualizado_em: toStringValue(record.atualizado_em),
        ativo: toBooleanOrNumber(record.ativo),
        auto_aprovacao: typeof record.auto_aprovacao === "boolean" ? record.auto_aprovacao : undefined,
        ad_hoc: typeof record.ad_hoc === "boolean" ? record.ad_hoc : undefined,
        slug: toOptionalString(record.slug),
        autor: toOptionalString(record.autor),
    };
}

function formatFieldValue(value: unknown, fieldType: string): string {
    if (value === undefined || value === null) return "";

    if (Array.isArray(value)) {
        return value
            .map((item) => (isRecord(item) || Array.isArray(item) ? JSON.stringify(item) : String(item)))
            .join(", ");
    }

    if (isRecord(value)) {
        return JSON.stringify(value);
    }

    if (typeof value === "boolean") {
        return value ? "Sim" : "Não";
    }

    if (fieldType === "date" || fieldType === "datetime-local") {
        try {
            if (typeof value === "string" || typeof value === "number") {
                return new Date(value).toLocaleDateString("pt-BR");
            }

            return String(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
}


export default function ViewSubmissionClient({ paramsId }: { paramsId?: string } = {}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    // Prioriza paramsId (rota /view/[id]) sobre query-param (rota /view?id=xxx)
    const id = paramsId || searchParams.get('id') as string;
    const { user: currentUser, permissions } = useAuth();
    const [submission, setSubmission] = useState<SubmissionViewRecord | null>(null);
    const [formConfig, setFormConfig] = useState<FormRegistry | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Review dialog state
    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [reviewAction, setReviewAction] = useState<'approved' | 'rejected' | null>(null);
    const [reviewMotivo, setReviewMotivo] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // Use our new robust hook for data extraction
    const formFields = formConfig?.conteudo?.campos || [];
    const fieldDataMap = useSubmissionData(submission?.dados, formFields);

    // Convert the map to an array with labels for display
    const fieldDataArray = formFields.map((field) => ({
        id: field.id,
        label: field.label || field.id,
        value: formatFieldValue(fieldDataMap[field.id], field.type)
    })).filter((field) => field.value !== undefined && field.value !== null && field.value !== '');


    useEffect(() => {
        if (id) {
            loadSubmission(id);
        }
    }, [id]);

    async function loadSubmission(ticketId: string) {
        setLoading(true);
        setError(null);

        try {
            // 1. Load submission from pacotes
            const pacoteRow = await fetchPacoteById(ticketId);

            if (!pacoteRow) throw new Error("Registro não encontrado");

            const submissionData = toSubmissionViewRecord(pacoteRow);

            setSubmission(submissionData);

            // 2. Load form configuration from form_registry
            // submissionData.tipo_form maps to slug or form_id
            const formRow = await fetchFormByIdOrSlug(submissionData.tipo_form);

            if (!formRow) throw new Error("Formulário não encontrado para tipo: " + submissionData.tipo_form);

            const formData = toFormRegistryRecord(formRow as unknown as QueryRow);

            setFormConfig(formData);
        } catch (err: unknown) {
            logger.error("Error loading submission:", err);
            setError(getErrorMessage(err, "Erro ao carregar registro"));
        } finally {
            setLoading(false);
        }
    }

    // Open review dialog
    const openReviewDialog = (action: 'approved' | 'rejected') => {
        setReviewAction(action);
        setReviewMotivo('');
        setReviewDialogOpen(true);
    };

    // Execute the review action
    const executeReview = async () => {
        if (!submission || !currentUser || !reviewAction) {
            return;
        }

        // Require reason for rejections
        if (reviewAction === 'rejected' && !reviewMotivo.trim()) {
            toast.warning("Por favor, informe o motivo da rejeição.");
            return;
        }

        setIsSubmittingReview(true);

        logger.info("Attempting review:", {
            submissionId: submission.id,
            newStatus: reviewAction,
            userId: currentUser.id,
            currentStatus: submission.status,
            motivo: reviewMotivo || null
        });

        try {
            // Logic to replace RPC 'transition_status'
            // RPC likely updates status and logs to history.

            // 1. Update status
            await updatePacoteStatus(submission.id, reviewAction);

            // 2. Log logic (optional, ver TODO suite_historico)

            // Close dialog and reload
            setReviewDialogOpen(false);
            setReviewAction(null);
            setReviewMotivo('');

            await loadSubmission(submission.id);
            toast.success(`Registro ${reviewAction === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`);
        } catch (err: unknown) {
            logger.error("Error applying review:", err);
            toast.error("Erro ao atualizar status: " + getErrorMessage(err, "Erro desconhecido"));
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDataUpdate = async (newData: unknown) => {
        if (!submission) return;

        try {
            // Serialize data if needed
            const jsonStr = typeof newData === 'string' ? newData : JSON.stringify(newData);

            await updatePacoteDados(submission.id, jsonStr);

            // Reload
            await loadSubmission(submission.id);
            setIsEditing(false);
            toast.success("Dados atualizados com sucesso!");
        } catch (err: unknown) {
            toast.error("Erro ao atualizar dados: " + getErrorMessage(err, "Erro desconhecido"));
        }
    };

    if (!id) return <div className="p-8 text-center">ID do registro não fornecido</div>;
    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );
    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
        </div>
    );
    if (!submission || !formConfig) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="font-semibold text-lg">{formConfig.titulo}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>#{submission.id.substring(0, 8)}</span>
                                <span>•</span>
                                <span>{format(new Date(submission.criado_em), "dd/MM/yyyy HH:mm")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>
                                <X className="h-4 w-4 mr-2" /> Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

                {/* Status Card */}
                <Card>
                    <CardHeader className="py-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-base font-medium">Status da Solicitação</CardTitle>
                                <Badge className={
                                    submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        submission.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                }>
                                    {submission.status === 'submitted' ? 'Submetido' :
                                        submission.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                                </Badge>
                            </div>
                            {/* Review actions for admins on pending items - inline with status */}
                            {permissions.isAdmin() && submission.status === 'submitted' && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit className="h-4 w-4 mr-1" /> Editar Dados
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                        onClick={() => openReviewDialog('rejected')}
                                    >
                                        <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => openReviewDialog('approved')}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                </Card>

                {/* Content */}
                {isEditing ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Editando Registro</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FormRenderer
                                content={formConfig.conteudo}
                                formType={submission.tipo_form}
                                prefillData={fieldDataMap}
                                customSubmit={handleDataUpdate}
                                submitLabel="Salvar Alterações"
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Data Display */}
                        <div className="md:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Dados do Formulário</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {fieldDataArray.map((field) => (
                                        <div key={field.id} className="border-b pb-4 last:border-0 last:pb-0">
                                            <div className="text-sm font-medium text-gray-500 mb-1">
                                                {field.label}
                                            </div>
                                            <div className="text-gray-900 whitespace-pre-wrap">
                                                {field.value}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Location Map if available */}
                            {Boolean(submission.localizacao) && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Localização</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                                            {/* Integration with map component would go here */}
                                            <span>Mapa indisponível (Coords: {JSON.stringify(submission.localizacao)})</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Metadata Sidebar */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Detalhes</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-sm">
                                    <div>
                                        <span className="block text-gray-500">ID do Registro</span>
                                        <span className="font-mono text-xs">{submission.id}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Criado em</span>
                                        <span>{format(new Date(submission.criado_em), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                                    </div>
                                    <div>
                                        <span className="block text-gray-500">Autor</span>
                                        <span>{submission.user_id}</span>
                                    </div>
                                    {submission.synced_at && (
                                        <div>
                                            <span className="block text-gray-500">Sincronizado</span>
                                            <span>{formatDistanceToNow(new Date(submission.synced_at), { addSuffix: true, locale: ptBR })}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>

            {/* Review Confirmation Dialog */}
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {reviewAction === 'approved' ? (
                                <>
                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                    Confirmar Aprovação
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-5 w-5 text-red-600" />
                                    Confirmar Rejeição
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {reviewAction === 'approved'
                                ? 'Você está prestes a aprovar este registro. Deseja adicionar uma observação?'
                                : 'Você está prestes a rejeitar este registro. Por favor, informe o motivo da rejeição.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {reviewAction === 'approved' ? 'Observação (opcional)' : 'Motivo da Rejeição *'}
                        </label>
                        <Textarea
                            value={reviewMotivo}
                            onChange={(e) => setReviewMotivo(e.target.value)}
                            placeholder={reviewAction === 'approved'
                                ? 'Adicione uma observação opcional...'
                                : 'Descreva o motivo da rejeição...'}
                            rows={3}
                            className={reviewAction === 'rejected' && !reviewMotivo.trim()
                                ? 'border-red-300 focus:border-red-500'
                                : ''}
                        />
                        {reviewAction === 'rejected' && !reviewMotivo.trim() && (
                            <p className="text-sm text-red-500 mt-1">
                                O motivo é obrigatório para rejeição.
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setReviewDialogOpen(false)}
                            disabled={isSubmittingReview}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={executeReview}
                            disabled={isSubmittingReview || (reviewAction === 'rejected' && !reviewMotivo.trim())}
                            className={reviewAction === 'approved'
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'}
                        >
                            {isSubmittingReview ? (
                                <>
                                    <span className="animate-spin mr-2">⟳</span>
                                    Processando...
                                </>
                            ) : (
                                <>
                                    {reviewAction === 'approved' ? (
                                        <><CheckCircle className="h-4 w-4 mr-2" /> Aprovar</>
                                    ) : (
                                        <><XCircle className="h-4 w-4 mr-2" /> Rejeitar</>
                                    )}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
