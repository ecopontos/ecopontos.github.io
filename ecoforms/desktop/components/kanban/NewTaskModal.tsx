/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KanbanTask } from "@/types";
import { fetchFormPresets, fetchUsuariosAtivos } from '@/src/interface/hooks/queries/lookups';
import { ShieldCheck } from "lucide-react";
import { TaskDateSection, TipoPrazo, RecorrenciaConfig, DEFAULT_RECORRENCIA } from "./TaskDateSection";
import { derivePrazoFromDateConfig, buildDateConfig } from "./taskDateUtils";
import { StakeholdersSelect } from "./StakeholdersSelect";
import { Interessado, KanbanProject } from "@/types";


type NewTaskPayload = Partial<KanbanTask> & {
    payload?: Record<string, unknown>;
    location?: string;
};

interface UserOption {
    id: string;
    nome: string;
}

interface FormOption {
    form_id: string;
    titulo: string;
}
interface NewTaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (task: NewTaskPayload) => Promise<unknown>;
    projects: KanbanProject[];
    defaultProjectId?: string;
    currentProject?: KanbanProject;
    defaultStatus?: 'a_fazer' | 'em_progresso' | 'concluido';
}

export function NewTaskModal({ open, onOpenChange, onCreate, projects, defaultProjectId, currentProject, defaultStatus }: NewTaskModalProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<"baixa" | "media" | "alta">("media");
    const [status, setStatus] = useState<"a_fazer" | "em_progresso" | "concluido">("a_fazer");
    const [dueDate, setDueDate] = useState("");
    const [dueDateFim, setDueDateFim] = useState("");
    const [tipoPrazo, setTipoPrazo] = useState<TipoPrazo>('unico');
    const [recorrencia, setRecorrencia] = useState<RecorrenciaConfig>({ ...DEFAULT_RECORRENCIA });
    const [assigneeId, setAssigneeId] = useState("");
    const [formId, setFormId] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [interessados, setInteressados] = useState<Interessado[]>([]);

    useEffect(() => {
        if (open) {
            setSelectedProjectId(defaultProjectId || (projects.length > 0 ? projects[0].id : ""));
            setInteressados(currentProject?.interessados ?? []);
            if (defaultStatus) {
                setStatus(defaultStatus);
            }
        }
    }, [open, defaultProjectId, projects, currentProject, defaultStatus]);

    // Data Sources
    const [users, setUsers] = useState<UserOption[]>([]);
    const [forms, setForms] = useState<FormOption[]>([]);

    // Monta lista de candidatos a atribuído: interessados do projeto no topo, restante abaixo
    const projectInteressadoIds = new Set(interessados.map(i => i.usuario_id));
    const interessadosUsers = users.filter(u => projectInteressadoIds.has(u.id));
    const otherUsers = users.filter(u => !projectInteressadoIds.has(u.id));

    const shouldPreviewAutoGrant = Boolean(
        assigneeId &&
        assigneeId !== 'unassigned' &&
        formId &&
        formId !== 'none' &&
        (status === 'a_fazer' || status === 'em_progresso')
    );
    const selectedAssignee = users.find((user) => user.id === assigneeId);
    const selectedForm = forms.find((form) => form.form_id === formId);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const fetchData = async () => {
        // Fetch Users
        try {
            const usuarios = await fetchUsuariosAtivos();
            const usersList: UserOption[] = usuarios.map((u) => ({
                id: String(u.id),
                nome: typeof u.nome === 'string' ? u.nome : '',
            }));
            setUsers(usersList);
        } catch (e) { console.error("Error fetching users", e); }

        // Fetch Forms
        try {
            const presets = await fetchFormPresets();
            const formsList: FormOption[] = presets.map((p) => {
                const fid = String(p.form_id || p.slug || '');
                return { form_id: fid, titulo: p.titulo || fid };
            });
            setForms(formsList);
        } catch (e) { console.error("Error fetching forms", e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setLoading(true);
        try {
            const dateConfig = buildDateConfig(tipoPrazo, dueDate, dueDateFim, recorrencia);
            await onCreate({
                titulo: title,
                descricao: description,
                prioridade: priority,
                status: status,
                prazo: derivePrazoFromDateConfig(tipoPrazo, dueDate, dueDateFim),
                prazo_fim: (tipoPrazo === 'periodo' && dueDateFim) ? new Date(dueDateFim).toISOString() : undefined,
                tipo_prazo: tipoPrazo,
                recorrencia: tipoPrazo === 'recorrente' ? JSON.stringify(recorrencia) : undefined,
                payload: { ...(dateConfig ? { dateConfig } : {}) },
                atribuido_para: (assigneeId && assigneeId !== 'unassigned') ? assigneeId : undefined,
                form_registry_id: (formId && formId !== 'none') ? formId : undefined,
                projeto_id: selectedProjectId,
                interessados: interessados,
            });
            onOpenChange(false);
            resetForm();
        } catch (error) {
            console.error("Failed to create task", error);
            const message = error instanceof Error ? error.message : "Erro ao criar tarefa. Verifique o console.";
            alert(message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setPriority("media");
        setStatus("a_fazer");
        setDueDate("");
        setDueDateFim("");
        setTipoPrazo('unico');
        setRecorrencia({ ...DEFAULT_RECORRENCIA });
        setAssigneeId("");
        setFormId("");
        setInteressados([]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-150">
                <DialogHeader>
                    <DialogTitle>Nova Tarefa</DialogTitle>
                    <DialogDescription>
                        Crie uma tarefa para o quadro ou designe uma atividade.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-2 pb-4">
                        {/* Project Selector - NEW */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="project">Projeto</Label>
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                <SelectTrigger id="project">
                                    <SelectValue placeholder="Selecione um projeto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.cor }} />
                                                {p.nome}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Title */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="title">Título <span className="text-destructive">*</span></Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="O que precisa ser feito?"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="desc">Descrição</Label>
                            <Textarea
                                id="desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detalhes da tarefa..."
                                rows={3}
                            />
                        </div>

                        {/* Assignee + Form (side by side) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="assignee">Responsável</Label>
                                <Select value={assigneeId} onValueChange={setAssigneeId}>
                                    <SelectTrigger id="assignee">
                                        <SelectValue placeholder="Sem atribuição" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Ninguém</SelectItem>
                                        {interessadosUsers.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    Interessados do projeto
                                                </div>
                                                {interessadosUsers.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.nome}
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                        {otherUsers.length > 0 && (
                                            <>
                                                {interessadosUsers.length > 0 && (
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                                                        Outros usuários
                                                    </div>
                                                )}
                                                {otherUsers.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.nome}
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="form">Formulário</Label>
                                <Select value={formId} onValueChange={setFormId}>
                                    <SelectTrigger id="form">
                                        <SelectValue placeholder="Vincular formulário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nenhum</SelectItem>
                                        {forms.map((f) => (
                                            <SelectItem key={f.form_id} value={f.form_id}>
                                                {f.titulo || f.form_id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {shouldPreviewAutoGrant && (
                            <Alert>
                                <ShieldCheck className="h-4 w-4" />
                                <AlertTitle>Permissão operacional será ajustada automaticamente</AlertTitle>
                                <AlertDescription>
                                    Ao salvar, {selectedAssignee?.nome || 'o responsável selecionado'} receberá acesso ao formulário {selectedForm?.titulo || formId} se ainda não tiver permissão. A ação será registrada na auditoria local do desktop.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Stakeholders (Interessados) */}
                        <div className="border rounded-lg p-3 bg-muted/30">
                            <StakeholdersSelect 
                                value={interessados} 
                                onChange={setInteressados}
                                label="Pessoas Interessadas"
                            />
                        </div>

                        {/* Priority + Status (side by side) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="priority">Prioridade</Label>
                                <Select value={priority} onValueChange={(v: "baixa" | "media" | "alta") => setPriority(v)}>
                                    <SelectTrigger id="priority">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="baixa">Baixa</SelectItem>
                                        <SelectItem value="media">Média</SelectItem>
                                        <SelectItem value="alta">Alta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="status">Status</Label>
                                <Select value={status} onValueChange={(v: "a_fazer" | "em_progresso" | "concluido") => setStatus(v)}>
                                    <SelectTrigger id="status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="a_fazer">A Fazer</SelectItem>
                                        <SelectItem value="em_progresso">Em Progresso</SelectItem>
                                        <SelectItem value="concluido">Concluído</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Date Section */}
                        <TaskDateSection
                            tipoPrazo={tipoPrazo}
                            onChangeTipoPrazo={setTipoPrazo}
                            prazo={dueDate}
                            onChangePrazo={setDueDate}
                            prazoFim={dueDateFim}
                            onChangePrazoFim={setDueDateFim}
                            recorrencia={recorrencia}
                            onChangeRecorrencia={setRecorrencia}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Criando..." : "Criar Tarefa"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
