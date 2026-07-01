"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { UnifiedTaskView, KanbanTask } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskOptions } from "@/src/interface/hooks/catalog/kanban";
import { CalendarIcon, User, Layers, Info, FileText, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { canManageByRole } from "@/src/interface/hooks/catalog/auth";

import { fetchFormDefinitionAtivo } from '@/src/interface/hooks/queries/lookups/forms';
import { FormViewer } from "../runtime/FormViewer";
import type { FormFieldValue } from "../runtime/FormFieldRenderer";
import type { FormField } from "@/types";

type EditableFormData = Record<string, FormFieldValue>;

interface FormViewerDefinition {
    titulo?: string;
    descricao?: string;
    campos: FormField[];
}

interface SolicitacaoFormEnvelope {
    campos?: EditableFormData;
    form_data?: EditableFormData;
    payload?: {
        campos?: EditableFormData;
        form_data?: EditableFormData;
    };
    [key: string]: unknown;
}

function getSolicitacaoFormData(value: unknown): EditableFormData {
    if (!value || typeof value !== "object") return {};

    const data = value as SolicitacaoFormEnvelope;
    if (data.campos && typeof data.campos === "object") return data.campos;
    if (data.form_data && typeof data.form_data === "object") return data.form_data;
    if (data.payload?.campos && typeof data.payload.campos === "object") return data.payload.campos;
    if (data.payload?.form_data && typeof data.payload.form_data === "object") return data.payload.form_data;

    return {};
}

function hasSetor(value: unknown): boolean {
    const formData = getSolicitacaoFormData(value);
    return (
        (typeof formData.setor_id === "string" && formData.setor_id.trim() !== "") ||
        (typeof formData.departamento === "string" && formData.departamento.trim() !== "")
    );
}

function isTaskPriority(value: string): value is KanbanTask["prioridade"] {
    return value === "baixa" || value === "media" || value === "alta";
}

interface SolicitacaoReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    solicitation: UnifiedTaskView;
    targetStatus?: string;
    onApprove: (overrides: Partial<KanbanTask>, updatedFormDados?: unknown) => Promise<void>;
    onReject: (motivo: string) => Promise<void>;
}

export function SolicitacaoReviewModal({
    open,
    onOpenChange,
    solicitation,
    targetStatus,
    onApprove,
    onReject
}: SolicitacaoReviewModalProps) {
    const { users, projects, forms } = useTaskOptions();
    const { user } = useAuth();
    const [isRejecting, setIsRejecting] = useState(false);
    const [motivoRejeicao, setMotivoRejeicao] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [formDefinition, setFormDefinition] = useState<FormViewerDefinition | null>(null);
    const [editableFormDados, setEditableFormDados] = useState<EditableFormData>({});

    // Form fields for modification before approval
    const [titulo, setTitulo] = useState(solicitation.titulo);
    const [descricao, setDescricao] = useState(solicitation.descricao);
    const [projetoId, setProjetoId] = useState<string | null>(solicitation.projeto_id || null);
    const [atribuidoPara, setAtribuidoPara] = useState<string | null>(null);
    const [prioridade, setPrioridade] = useState<KanbanTask['prioridade']>(solicitation.prioridade || 'media');
    const [prazo, setPrazo] = useState<string | null>(solicitation.prazo || null);
    const [formRegistryId, setFormRegistryId] = useState<string | null>(solicitation.form_nome || null);

    useEffect(() => {
        if (solicitation) {
            setTitulo(solicitation.titulo);
            setDescricao(solicitation.descricao);
            setPrioridade(solicitation.prioridade || 'media');
            
            // Inicializar projeto: se a solicitação não tem projeto e não há projeto atual, 
            // tentamos pegar o primeiro disponível na lista
            if (!solicitation.projeto_id && !projetoId && projects.length > 0) {
                // Tenta priorizar o "Projeto Geral" se existir na lista
                const generalProj = projects.find(p => p.label === 'Projeto Geral');
                setProjetoId(generalProj ? generalProj.value : projects[0].value);
            } else if (solicitation.projeto_id) {
                setProjetoId(solicitation.projeto_id);
            }

            // Inicializar dados editáveis
            setEditableFormDados(getSolicitacaoFormData(solicitation.form_dados));

            // Buscar definição do formulário
            if (solicitation.form_nome) {
                fetchFormDefinition(solicitation.form_nome);
            }
        }
    }, [solicitation, projects]);

    const fetchFormDefinition = async (formId: string) => {
        if (!formId) return;
        try {
            const conteudoStr = await fetchFormDefinitionAtivo(formId);

            if (conteudoStr != null) {
                try {
                    const conteudo = typeof conteudoStr === 'string' ? JSON.parse(conteudoStr) : conteudoStr;
                    setFormDefinition(conteudo as FormViewerDefinition);
                } catch (e) {
                    console.error("Erro ao parsear definição do form:", e);
                }
            }
        } catch (error) {
            console.error("Erro ao buscar definição do form:", error);
        }
    };

    const handleApprove = async () => {
        try {
            setIsLoading(true);
            const existingFormDados = solicitation.form_dados && typeof solicitation.form_dados === "object"
                ? solicitation.form_dados as Record<string, unknown>
                : {};
            await onApprove({
                titulo,
                descricao,
                projeto_id: projetoId === null ? undefined : projetoId,
                atribuido_para: atribuidoPara === null ? undefined : atribuidoPara,
                prioridade,
                prazo: prazo === null ? undefined : prazo,
                form_registry_id: formRegistryId === null ? undefined : formRegistryId,
                status: targetStatus as 'a_fazer' | 'em_progresso' | 'concluido' | undefined
            }, {
                ...existingFormDados,
                campos: editableFormDados
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!motivoRejeicao.trim()) {
            toast.error("Por favor, descreva o motivo da rejeição.");
            return;
        }
        try {
            setIsLoading(true);
            await onReject(motivoRejeicao);
        } finally {
            setIsLoading(false);
            setIsRejecting(false);
        }
    };

    const formDados = solicitation.form_dados;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden outline-none border-none shadow-2xl">
                {/* Header fixo */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                            Solicitação Pendente
                        </Badge>
                        <span className="text-xs text-slate-400">
                            ID: {solicitation.id}
                        </span>
                    </div>
                    <DialogTitle className="text-xl">Revisar Solicitação</DialogTitle>
                    <DialogDescription>
                        Revise os dados, ajuste as configurações da tarefa e aprove ou rejeite a solicitação.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden">
                    <Tabs defaultValue="solicitacao" className="flex flex-col h-full">
                        <div className="px-6 py-2 border-b bg-slate-50/50">
                            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                                <TabsTrigger value="solicitacao" className="gap-2">
                                    <FileText className="w-4 h-4" />
                                    Dados da Solicitação
                                </TabsTrigger>
                                <TabsTrigger value="tarefa" className="gap-2">
                                    <Settings className="w-4 h-4" />
                                    Configurar Tarefa
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
                            <TabsContent value="solicitacao" className="space-y-6 mt-0">
                                {/* Metadados da Solicitação */}
                                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Solicitante</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {(solicitation.atribuido_username || 'S')[0].toUpperCase()}
                                            </div>
                                            <p className="font-semibold text-sm">{solicitation.atribuido_username || 'Sistema'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Data de Envio</Label>
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <CalendarIcon className="w-4 h-4" />
                                            <p className="text-sm">
                                                {solicitation.created_at ? format(new Date(solicitation.created_at), 'Pp', { locale: ptBR }) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Conteúdo do Formulário */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b">
                                        <div className="p-1 px-2 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                                            Formulário Original
                                        </div>
                                        <span className="text-xs text-slate-500 font-medium">
                                            ID do Form: {solicitation.form_nome}
                                        </span>
                                    </div>

                                    {formDefinition ? (
                                        <FormViewer
                                            formDefinition={formDefinition}
                                            formData={editableFormDados || {}}
                                            readOnly={false}
                                            onChange={(fieldId, value) => {
                                                setEditableFormDados((prev) => ({ ...prev, [fieldId]: value }));
                                            }}
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            <Label className="text-[10px] uppercase text-slate-400 font-bold">Conteúdo da Submissão</Label>
                                            <pre className="text-xs bg-slate-100 p-4 rounded-lg overflow-x-auto max-h-96 border border-slate-200">
                                                {JSON.stringify(formDados, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="tarefa" className="space-y-6 mt-0">
                                {(!hasSetor(formDados) && user?.perfil && canManageByRole(user.perfil)) && (
                                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded flex gap-3">
                                        <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-800">
                                            <strong>Atenção:</strong> Esta solicitação não possui setor definido. Se esta solicitação pertence à sua equipe, por favor, defina o setor aprovando a tarefa e editando em seguida.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-semibold">Configuração Básica</h3>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="rev-titulo">Título da Tarefa</Label>
                                        <Input
                                            id="rev-titulo"
                                            value={titulo}
                                            onChange={(e) => setTitulo(e.target.value)}
                                            placeholder="Defina um título claro para a tarefa"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="rev-desc">Descrição / Observações</Label>
                                        <Textarea
                                            id="rev-desc"
                                            className="h-32"
                                            value={descricao}
                                            onChange={(e) => setDescricao(e.target.value)}
                                            placeholder="Instruções adicionais para o executor..."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Settings className="w-4 h-4 text-primary" />
                                            <h3 className="text-sm font-semibold">Classificação</h3>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label>Prioridade</Label>
                                            <Select value={prioridade} onValueChange={(value) => {
                                                if (isTaskPriority(value)) setPrioridade(value);
                                            }}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="baixa">Baixa</SelectItem>
                                                    <SelectItem value="media">Média</SelectItem>
                                                    <SelectItem value="alta">Alta</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Projeto</Label>
                                            <Select value={projetoId || 'none'} onValueChange={(v) => setProjetoId(v === 'none' ? null : v)}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Projeto Geral</SelectItem>
                                                    {projects.map(p => (
                                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-primary" />
                                            <h3 className="text-sm font-semibold">Execução</h3>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Responsável</Label>
                                            <Select value={atribuidoPara || 'unassigned'} onValueChange={(v) => setAtribuidoPara(v === 'unassigned' ? null : v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione um executor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                                                    {users.map(u => (
                                                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Prazo para Conclusão</Label>
                                            <Input
                                                type="datetime-local"
                                                value={prazo || ''}
                                                onChange={(e) => setPrazo(e.target.value || null)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                    <Label className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-primary" />
                                        Vínculo com Formulário de Execução
                                    </Label>
                                    <Select value={formRegistryId || 'none'} onValueChange={(v) => setFormRegistryId(v === 'none' ? null : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um Form" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum Formulário</SelectItem>
                                            {forms.map(f => (
                                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-500 italic">
                                        Define qual formulário o operador deverá preencher para concluir esta tarefa no mobile.
                                    </p>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    {/* Seção de rejeição — largura total, fora das tabs */}
                    {isRejecting && (
                        <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center space-y-4">
                            <div className="bg-red-50 p-6 rounded-xl border border-red-100 max-w-lg w-full space-y-3 shadow-lg">
                                <Label className="text-red-700 font-bold text-lg">Rejeitar Solicitação</Label>
                                <p className="text-sm text-red-600">Por favor, descreva o motivo para o solicitante:</p>
                                <Textarea 
                                    className="bg-white border-red-200 focus:ring-red-500 h-32" 
                                    placeholder="Explique por que esta solicitação está sendo recusada..."
                                    value={motivoRejeicao}
                                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={isLoading}>
                                        Confirmar Rejeição
                                    </Button>
                                    <Button className="flex-1" variant="outline" onClick={() => setIsRejecting(false)} disabled={isLoading}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer fixo */}
                <DialogFooter className="px-6 py-4 border-t shrink-0">
                    {!isRejecting && (
                        <>
                            <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setIsRejecting(true)} disabled={isLoading}>
                                Rejeitar
                            </Button>
                            <Button onClick={handleApprove} disabled={isLoading} className="gap-2">
                                {isLoading ? "Aprovando..." : "Aprovar Tarefa"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
