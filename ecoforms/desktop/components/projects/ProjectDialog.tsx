"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StakeholdersSelect } from "@/components/kanban/StakeholdersSelect";
import { KanbanProject, Interessado, ProjetoStatus } from "@/types";
import { useAllUsers } from "@/src/interface/hooks/catalog/auth";

const PROJECT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#6B7280'];

const STATUS_OPTIONS: { value: ProjetoStatus; label: string }[] = [
    { value: 'ativo',     label: 'Ativo' },
    { value: 'pausado',   label: 'Pausado' },
    { value: 'concluido', label: 'Concluído' },
    { value: 'cancelado', label: 'Cancelado' },
];

export interface ProjectDialogData {
    nome: string;
    descricao: string;
    cor: string;
    status: ProjetoStatus;
    data_inicio: string;
    data_fim: string;
    responsavel_id: string;
    interessados: Interessado[];
}

interface ProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    project?: KanbanProject;
    onSave: (data: ProjectDialogData) => Promise<void>;
}

export function ProjectDialog({ open, onOpenChange, mode, project, onSave }: ProjectDialogProps) {
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [cor, setCor] = useState('#3B82F6');
    const [status, setStatus] = useState<ProjetoStatus>('ativo');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [responsavelId, setResponsavelId] = useState('');
    const [interessados, setInteressados] = useState<Interessado[]>([]);
    const [saving, setSaving] = useState(false);

    const { users } = useAllUsers();
    const activeUsers = users.filter(u => u.ativo);

    useEffect(() => {
        if (open) {
            setNome(project?.nome ?? '');
            setDescricao(project?.descricao ?? '');
            setCor(project?.cor ?? '#3B82F6');
            setStatus(project?.status ?? 'ativo');
            setDataInicio(project?.data_inicio ?? '');
            setDataFim(project?.data_fim ?? '');
            setResponsavelId(project?.responsavel_id ?? '');
            setInteressados(project?.interessados ?? []);
        }
    }, [open, project]);

    const handleSave = async () => {
        if (!nome.trim()) return;
        setSaving(true);
        try {
            await onSave({
                nome,
                descricao,
                cor,
                status,
                data_inicio: dataInicio,
                data_fim: dataFim,
                responsavel_id: responsavelId,
                interessados,
            });
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Novo Projeto' : 'Editar Projeto'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Crie um novo projeto para organizar suas tarefas.'
                            : 'Atualize os dados do projeto.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="proj-dialog-name">Nome</Label>
                        <Input
                            id="proj-dialog-name"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Nome do projeto"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="proj-dialog-desc">Descrição (opcional)</Label>
                        <Input
                            id="proj-dialog-desc"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descrição"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as ProjetoStatus)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Responsável</Label>
                            <Select value={responsavelId || '__none__'} onValueChange={(v) => setResponsavelId(v === '__none__' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Nenhum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Nenhum</SelectItem>
                                    {activeUsers.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="proj-data-inicio">Data Início</Label>
                            <Input
                                id="proj-data-inicio"
                                type="date"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="proj-data-fim">Data Fim</Label>
                            <Input
                                id="proj-data-fim"
                                type="date"
                                value={dataFim}
                                onChange={(e) => setDataFim(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Cor</Label>
                        <div className="flex gap-2 flex-wrap">
                            {PROJECT_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`w-7 h-7 rounded-full border-2 transition-transform ${cor === c ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-110'}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setCor(c)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 border-t">
                        <StakeholdersSelect
                            value={interessados}
                            onChange={setInteressados}
                            label="Pessoas Interessadas"
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={!nome.trim() || saving}>
                        {mode === 'create' ? 'Criar Projeto' : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
