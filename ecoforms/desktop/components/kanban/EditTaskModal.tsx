'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useTauriInvoke } from '@/src/interface/hooks/catalog/tauri';
import { fetchUsuariosAtivos, fetchFormsAtivos } from '@/src/interface/hooks/queries/lookups';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { UnifiedTaskView, KanbanProject } from '@/types';
import { ShieldCheck, FileText, CheckCircle2, QrCode, CalendarDays } from 'lucide-react';
import { TaskAttachments } from './TaskAttachments';
import { TaskDateSection, TipoPrazo, RecorrenciaConfig, DEFAULT_RECORRENCIA } from './TaskDateSection';
import { derivePrazoFromDateConfig, buildDateConfig, restoreDateState } from './taskDateUtils';
import { StakeholdersSelect } from './StakeholdersSelect';
import { PatchHistoryPanel } from './PatchHistoryPanel';
import { Interessado } from '@/types';
import { ActionBar } from '@/components/ActionBar';
import { useWorkflowActions } from '@/src/interface/hooks/catalog/kanban';
import { useAuth } from '@/contexts/AuthContext';
import { useContainer } from '@/src/interface/hooks/catalog/utils';
import { getContainerAsync } from '@/src/interface/hooks/catalog/utils';
import { useSyncOutbox } from '@/src/interface/hooks/catalog/sync';
import type { TaskPatchFile } from './PatchHistoryPanel';

type TaskModalUpdatePayload = Partial<UnifiedTaskView> & {
    data_config?: ReturnType<typeof buildDateConfig>;
    interessados?: Interessado[];
};


interface EditTaskModalProps {
    task: UnifiedTaskView | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTaskUpdated: (updates: TaskModalUpdatePayload) => Promise<void>;
    onArchiveTask?: (taskId: string, archived: boolean) => void;
    onCancelTask?: (taskId: string, motivo: string) => Promise<void>;
    onUnfreeze?: () => Promise<void>;
    onPatchTask?: (taskId: string, updates: TaskModalUpdatePayload) => Promise<void>;
    getTaskPatches?: (taskId: string) => Promise<TaskPatchFile[]>;
    projects?: KanbanProject[];
}

const PRIORITY_OPTIONS = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
];

const STATUS_OPTIONS = [
    { value: 'a_fazer', label: 'A Fazer' },
    { value: 'em_progresso', label: 'Em Progresso' },
    { value: 'concluido', label: 'Concluído' },
];

function isTaskPriority(value: string): value is UnifiedTaskView['prioridade'] {
    return PRIORITY_OPTIONS.some((option) => option.value === value);
}

function isTaskStatus(value: string): value is UnifiedTaskView['status'] {
    return STATUS_OPTIONS.some((option) => option.value === value) || value === 'solicitacao' || value === 'cancelado';
}

export function EditTaskModal({
    task,
    open,
    onOpenChange,
    onTaskUpdated,
    onArchiveTask,
    onCancelTask,
    onUnfreeze,
    onPatchTask,
    getTaskPatches,
    projects,
}: EditTaskModalProps) {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [prioridade, setPrioridade] = useState<UnifiedTaskView['prioridade']>('media');
    const [status, setStatus] = useState<UnifiedTaskView['status']>('a_fazer');
    const [atribuidoPara, setAtribuidoPara] = useState<string | null>(null);
    const [projetoId, setProjetoId] = useState<string | null>(null);
    const [formId, setFormId] = useState<string | null>(null);
    const [users, setUsers] = useState<{ value: string; label: string }[]>([]);
    const [forms, setForms] = useState<{ value: string; label: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const invoke = useTauriInvoke();
    const [interessados, setInteressados] = useState<Interessado[]>([]);
    const [patches, setPatches] = useState<TaskPatchFile[]>([]);
    const [loadingPatches, setLoadingPatches] = useState(false);
    const [agendamentoData, setAgendamentoData] = useState<Record<string, unknown> | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelMotivo, setCancelMotivo] = useState('');
    const { user } = useAuth();
    const container = useContainer();
    const eventBus = useSyncOutbox();

    const taskFormData = {
        status: task?.status ?? '',
        prioridade: task?.prioridade ?? '',
        titulo: task?.titulo ?? '',
        atribuidoPara: task?.atribuido_para ?? '',
        projetoId: task?.projeto_id ?? '',
    };
    const workflowActions = useWorkflowActions('task', taskFormData);

    const isSnapshotLocked = Boolean(task?.snap_frozen_at) || (task?.payload != null && task?.status !== 'solicitacao');

    const canEdit = task?.meu_nivel_acesso === 'dono' || task?.meu_nivel_acesso === 'edicao';
    const isDono = task?.meu_nivel_acesso === 'dono';

    const shouldPreviewAutoGrant = Boolean(
        atribuidoPara &&
        formId &&
        (status === 'a_fazer' || status === 'em_progresso')
    );
    const selectedAssignee = users.find((user) => user.value === atribuidoPara);
    const selectedForm = forms.find((form) => form.value === formId);

    // Date state
    const [tipoPrazo, setTipoPrazo] = useState<TipoPrazo>('unico');
    const [prazo, setPrazo] = useState('');
    const [prazoFim, setPrazoFim] = useState('');
    const [recorrencia, setRecorrencia] = useState<RecorrenciaConfig>({ ...DEFAULT_RECORRENCIA });

    useEffect(() => {
        if (task && open) {
            setTitulo(task.titulo ?? '');
            setDescricao(task.descricao ?? '');
            setPrioridade(task.prioridade ?? 'media');
            setStatus(task.status ?? 'a_fazer');
            setAtribuidoPara(task.atribuido_para ?? null);
            setProjetoId(task.projeto_id ?? null);
            setFormId(task.form_registry_id ?? null);
            setErrorMessage(null);
            setIsUnlocked(false);

            const dateState = restoreDateState(task.payload?.dateConfig, task.prazo ?? undefined);
            setTipoPrazo(dateState.tipoPrazo);
            setPrazo(dateState.prazo);
            setPrazoFim(dateState.prazoFim);
            setRecorrencia(dateState.recorrencia);
            setInteressados(task.interessados || []);
            
            if (isSnapshotLocked && getTaskPatches) {
                setLoadingPatches(true);
                getTaskPatches(task.id).then(setPatches).finally(() => setLoadingPatches(false));
            } else {
                setPatches([]);
            }
        }
    }, [task, open, isSnapshotLocked]);

    useEffect(() => {
        if (!open || task?.origem_tipo !== 'agendamento' || !task?.origem_id) {
            setAgendamentoData(null);
            return;
        }
        getContainerAsync().then((c) =>
            c.agendamentoRepo.findByIdWithDetails(task.origem_id!)
        ).then((details) => {
            setAgendamentoData(details as Record<string, unknown> | null);
        }).catch(() => {});
    }, [open, task?.origem_id, task?.origem_tipo]);

    useEffect(() => {
        if (!open) return;

        const loadData = async () => {
            try {
                // Fetch Users
                const usersData = await fetchUsuariosAtivos();
                const mappedUsers = usersData.map((user) => ({
                    value: String(user.id),
                    label: user.nome ?? 'Sem nome',
                }));

                setUsers(mappedUsers);

                // Fetch Forms
                const formsData = await fetchFormsAtivos();
                const mappedForms = formsData.map((form) => ({
                    value: String(form.form_id),
                    label: form.titulo || String(form.form_id),
                }));

                setForms(mappedForms);

            } catch (error) {
                console.error('Erro ao carregar dados', error);
            }
        };

        loadData();
    }, [open]);

    const handleSave = async () => {
        if (!task) return;
        setSaving(true);
        setErrorMessage(null);

        try {
            const dateConfig = buildDateConfig(tipoPrazo, prazo, prazoFim, recorrencia);
            const existingPayload = task?.payload ?? {};
            const updates = {
                titulo,
                descricao,
                prioridade,
                status,
                atribuido_para: atribuidoPara ?? undefined,
                data_config: dateConfig,
                projeto_id: projetoId ?? undefined,
                interessados: interessados,
            };

            if (isSnapshotLocked && !isUnlocked && onPatchTask) {
                // Envio via Patch
                await onPatchTask(task.id, updates);
                if (getTaskPatches) {
                    const nextPatches = await getTaskPatches(task.id);
                    setPatches(nextPatches);
                }
            } else {
                // Update Normal
                await onTaskUpdated(updates);
            }

            onOpenChange(false);
        } catch (error) {
            console.error('Erro ao atualizar tarefa:', error);
            const message = error instanceof Error ? error.message : 'Não foi possível salvar as alterações.';
            setErrorMessage(message);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = (nextOpen: boolean) => {
        if (!nextOpen) {
            setUsers([]);
            setForms([]);
        }
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Editar Tarefa</DialogTitle>
                    <DialogDescription>
                        Atualize as informações desta tarefa.
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto flex-1 pr-1">
                {!task ? (
                    <div className="py-10 text-center text-muted-foreground">
                        Nenhuma tarefa selecionada.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {isSnapshotLocked && !isUnlocked && (
                            <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                                <ShieldCheck className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800 font-bold">Tarefa com Snapshot Operacional</AlertTitle>
                                <AlertDescription className="text-amber-700 space-y-3">
                                    <p className="text-xs">
                                        Esta tarefa já foi enviada para um dispositivo móvel e os dados base (payload/formulário) estão bloqueados para garantir a integridade da operação.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-white border-amber-300 hover:bg-amber-100 text-amber-800 font-semibold"
                                        disabled={isUnlocking}
                                        onClick={async () => {
                                            if (!onUnfreeze) return;
                                            setIsUnlocking(true);
                                            try {
                                                await onUnfreeze();
                                                setIsUnlocked(true);
                                                setErrorMessage(null);
                                            } finally {
                                                setIsUnlocking(false);
                                            }
                                        }}
                                    >
                                        {isUnlocking ? 'Liberando...' : 'Liberar edição'}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="task-title">Título</Label>
                            <Input
                                id="task-title"
                                value={titulo}
                                onChange={(event) => setTitulo(event.target.value)}
                                disabled={saving}
                                placeholder="Título da tarefa"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-description">Descrição</Label>
                            <Textarea
                                id="task-description"
                                value={descricao}
                                onChange={(event) => setDescricao(event.target.value)}
                                disabled={saving}
                                placeholder="Descrição da tarefa"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Prioridade</Label>
                                <Select
                                    value={prioridade}
                                    onValueChange={(value) => {
                                        if (isTaskPriority(value)) setPrioridade(value);
                                    }}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITY_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={status}
                                    onValueChange={(value) => {
                                        if (isTaskStatus(value)) setStatus(value);
                                    }}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="task-assignee">Responsável</Label>
                            <Select
                                value={atribuidoPara ?? 'unassigned'}
                                onValueChange={(value) => setAtribuidoPara(value === 'unassigned' ? null : value)}
                                disabled={saving}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um usuário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Ninguém</SelectItem>
                                    {users.map((user) => (
                                        <SelectItem key={user.value} value={user.value}>
                                            {user.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {task.criador_username && (
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Criado por</Label>
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md border text-sm text-slate-600">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-600 uppercase shrink-0">
                                        {task.criador_username.substring(0, 2)}
                                    </div>
                                    {task.criador_username}
                                </div>
                            </div>
                        )}

                        {projects && projects.length > 0 && (
                            <div className="space-y-2">
                                <Label>Projeto</Label>
                                <Select
                                    value={projetoId ?? 'none'}
                                    onValueChange={(value) => setProjetoId(value === 'none' ? null : value)}
                                    disabled={saving}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um projeto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Projeto Geral</SelectItem>
                                        {projects.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                <span className="flex items-center gap-2">
                                                    <span
                                                        className="w-2 h-2 rounded-full inline-block shrink-0"
                                                        style={{ backgroundColor: p.cor }}
                                                    />
                                                    {p.nome}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="task-form">Formulário</Label>
                            <Select
                                value={formId ?? 'none'}
                                onValueChange={(value) => setFormId(value === 'none' ? null : value)}
                                disabled={saving || (isSnapshotLocked && !isUnlocked)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Vincular formulário (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum</SelectItem>
                                    {forms.map((form) => (
                                        <SelectItem key={form.value} value={form.value}>
                                            {form.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isSnapshotLocked && !isUnlocked && (
                                <p className="text-[10px] text-amber-600 font-medium">
                                    O formulário não pode ser alterado em tarefas já enviadas.
                                </p>
                            )}
                        </div>

                        {/* Histórico de Patches */}
                        {isSnapshotLocked && (patches.length > 0 || loadingPatches) && (
                            <PatchHistoryPanel patches={patches} loading={loadingPatches} />
                        )}

                        {shouldPreviewAutoGrant && (
                            <Alert>
                                <ShieldCheck className="h-4 w-4" />
                                <AlertTitle>Atribuição com grant automático</AlertTitle>
                                <AlertDescription>
                                    Se {selectedAssignee?.label || 'o responsável'} ainda não puder acessar o formulário {selectedForm?.label || formId}, o desktop ajustará a permissão automaticamente ao salvar e deixará a ação registrada na auditoria local.
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

                        <div className="space-y-2">
                            <TaskDateSection
                                tipoPrazo={tipoPrazo}
                                onChangeTipoPrazo={setTipoPrazo}
                                prazo={prazo}
                                onChangePrazo={setPrazo}
                                prazoFim={prazoFim}
                                onChangePrazoFim={setPrazoFim}
                                recorrencia={recorrencia}
                                onChangeRecorrencia={setRecorrencia}
                                disabled={saving}
                            />
                        </div>

                        {/* Attachments Section */}
                        <div className="border-t pt-4 mt-4">
                            <TaskAttachments
                                taskId={task.id}
                                userId={atribuidoPara || 'system'}
                                readOnly={saving}
                            />
                        </div>

                        {/* Linked Record Section */}
                        {task.suite_id && (
                            <div className="border-t pt-4 mt-4 bg-emerald-50/30 p-3 rounded-lg border border-emerald-100">
                                <div className="flex items-center gap-2 mb-2 text-emerald-800 font-semibold text-sm">
                                    <FileText className="w-4 h-4" />
                                    <span>Registro Enviado: {task.form_nome || "Formulário"}</span>
                                    {task.form_status && (
                                        <Badge variant="outline" className="ml-auto bg-white text-[10px] uppercase">
                                            {task.form_status}
                                        </Badge>
                                    )}
                                </div>
                                {task.form_dados ? (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {Object.entries(task.form_dados).map(([key, value]) => {
                                            if (key.startsWith('_')) return null;
                                            if (typeof value === 'object') return null; // Skip complex objects for now
                                            return (
                                                <div key={key} className="text-[11px] flex justify-between border-b border-emerald-100/50 py-1">
                                                    <span className="font-medium text-emerald-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-emerald-900 font-mono">{String(value)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-emerald-600 italic">Nenhum dado disponível no snapshot.</p>
                                )}
                            </div>
                        )}

                        {/* Agendamento Details Section */}
                        {task.origem_tipo === 'agendamento' && agendamentoData && (
                            <div className="border-t pt-4 mt-4 bg-blue-50/30 p-3 rounded-lg border border-blue-100">
                                <div className="flex items-center gap-2 mb-2 text-blue-800 font-semibold text-sm">
                                    <CalendarDays className="w-4 h-4" />
                                    <span>Agendamento: {agendamentoData.service_type_nome as string}</span>
                                    <Badge variant="outline" className="ml-auto bg-white text-[10px] uppercase">
                                        {agendamentoData.status as string}
                                    </Badge>
                                </div>
                                <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                                    {([
                                        ['Cliente', agendamentoData.cliente_nome],
                                        ['E-mail', agendamentoData.cliente_email],
                                        ['Telefone', agendamentoData.cliente_telefone],
                                        ['Bairro', agendamentoData.bairro],
                                        ['Vagas', agendamentoData.vagas_solicitadas],
                                        ['Local', agendamentoData.local],
                                        ['Slot', agendamentoData.slot_titulo],
                                    ] as [string, unknown][]).filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                                        <div key={label} className="text-[11px] flex justify-between border-b border-blue-100/50 py-1">
                                            <span className="font-medium text-blue-700">{label}</span>
                                            <span className="text-blue-900">{String(value)}</span>
                                        </div>
                                    ))}
                                    {(() => {
                                        try {
                                            const dados = JSON.parse(agendamentoData.dados_formulario as string ?? '{}');
                                            return Object.entries(dados)
                                                .filter(([k, v]) => !k.startsWith('_') && v != null && v !== '')
                                                .map(([key, value]) => (
                                                    <div key={key} className="text-[11px] flex justify-between border-b border-blue-100/50 py-1">
                                                        <span className="font-medium text-blue-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                                        <span className="text-blue-900 font-mono text-right max-w-[60%] truncate">{String(value)}</span>
                                                    </div>
                                                ));
                                        } catch { return null; }
                                    })()}
                                </div>
                            </div>
                        )}

                        {errorMessage && !errorMessage.includes('Payload imutavel') && (
                            <p className="text-sm text-destructive">{errorMessage}</p>
                        )}
                    </div>
                )}
                </div>

                {/* Painel de confirmação de cancelamento */}
                {showCancelConfirm && (
                    <div className="px-6 pb-4 border-t pt-4 space-y-2">
                        <p className="text-sm font-medium text-destructive">Confirmar cancelamento da tarefa</p>
                        <textarea
                            className="w-full border rounded p-2 text-sm resize-none"
                            rows={2}
                            placeholder="Motivo do cancelamento (obrigatório)"
                            value={cancelMotivo}
                            onChange={e => setCancelMotivo(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => { setShowCancelConfirm(false); setCancelMotivo(''); }}>Voltar</Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={!cancelMotivo.trim() || saving}
                                onClick={async () => {
                                    if (!task || !onCancelTask) return;
                                    setSaving(true);
                                    try {
                                        await onCancelTask(task.id, cancelMotivo.trim());
                                        onOpenChange(false);
                                    } finally {
                                        setSaving(false);
                                        setShowCancelConfirm(false);
                                        setCancelMotivo('');
                                    }
                                }}
                            >
                                Confirmar cancelamento
                            </Button>
                        </div>
                    </div>
                )}

                {task && workflowActions.length > 0 && (
                    <div className="px-6 py-3 border-t">
                        <ActionBar
                            actions={workflowActions}
                            context={{
                                targetType: 'task',
                                targetId: task.id,
                                task,
                                formData: taskFormData,
                                userId: user?.id ?? '',
                                container,
                                commands: {
                                    invoke,
                                },
                                syncOutbox: {
                                    write: async (type: string, data: Record<string, unknown>) => {
                                        try {
                                            if (eventBus) await eventBus.write(type, data);
                                        } catch {
                                            // ignore
                                        }
                                    },
                                },
                                syncNow: async () => {
                                    // sync não disponível diretamente via lazy-sync sem args
                                    // ações built-in não dependem de sync manual aqui
                                },
                            }}
                        />
                    </div>
                )}

                <DialogFooter>
                    {task && onCancelTask && task.status !== 'cancelado' && task.status !== 'concluido' && isDono && (
                        <Button
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={saving}
                        >
                            Cancelar tarefa
                        </Button>
                    )}
                    {task && onArchiveTask && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                onArchiveTask(task.id, !task.arquivado);
                                onOpenChange(false);
                            }}
                            disabled={saving}
                        >
                            {task.arquivado ? "Restaurar" : "Arquivar"}
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
                        Fechar
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !canEdit} variant={isSnapshotLocked && !isUnlocked ? "secondary" : "default"}>
                        {saving ? 'Salvando...' : !canEdit ? 'Somente Leitura' : (isSnapshotLocked && !isUnlocked ? 'Enviar Correção (Patch)' : 'Salvar alterações')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}