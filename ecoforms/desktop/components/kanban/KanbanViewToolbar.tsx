"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LayoutGrid, List, FolderKanban, Pencil, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanProject } from "@/types";
import type { ViewMode } from "@/src/interface/hooks/catalog/kanban";
import Link from "next/link";

interface KanbanViewToolbarProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    projects: KanbanProject[];
    currentProjectValue: string;
    onProjectChange: (value: string) => void;
    showArchived: boolean;
    onToggleArchived: () => void;
    onEditProject: () => void;
    onNewTask: () => void;
    canEditProject: boolean;
    taskCounts?: { aFazer: number; emProgresso: number; concluido: number; solicitacao: number };
}

export function KanbanViewToolbar({
    viewMode,
    onViewModeChange,
    searchTerm,
    onSearchChange,
    projects,
    currentProjectValue,
    onProjectChange,
    showArchived,
    onToggleArchived,
    onEditProject,
    onNewTask,
    canEditProject,
    taskCounts,
}: KanbanViewToolbarProps) {
    return (
        <div className="flex items-center justify-between p-4 bg-white border-b">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Tarefas</h1>

                {taskCounts && !showArchived && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100">
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                            {taskCounts.aFazer} a fazer
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {taskCounts.emProgresso} em progresso
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {taskCounts.concluido} concluídas
                        </span>
                        {taskCounts.solicitacao > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                {taskCounts.solicitacao} pendentes
                            </span>
                        )}
                    </div>
                )}

                <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
                    <TabsList>
                        <TabsTrigger value="kanban" className="flex items-center gap-1">
                            <LayoutGrid className="w-4 h-4" />
                            Kanban
                        </TabsTrigger>
                        <TabsTrigger value="table" className="flex items-center gap-1">
                            <List className="w-4 h-4" />
                            Tabela
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar tarefas..."
                        className="pl-9 pr-8"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                            onClick={() => onSearchChange('')}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <Select value={currentProjectValue} onValueChange={onProjectChange}>
                    <SelectTrigger className="w-62.5">
                        <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            <span className="flex items-center gap-2">
                                <FolderKanban className="w-4 h-4 text-muted-foreground" />
                                Todos os Projetos
                            </span>
                        </SelectItem>
                        <SelectItem value="none">
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                Projeto Geral
                            </span>
                        </SelectItem>
                        {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.cor }} />
                                    <span>{p.nome}</span>
                                    {p.criado_por_nome && (
                                        <span className="text-[10px] text-muted-foreground ml-1">· {p.criado_por_nome}</span>
                                    )}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {canEditProject && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onEditProject} title="Editar projeto">
                        <Pencil className="w-4 h-4" />
                    </Button>
                )}

                <Button variant="outline" size="sm" asChild>
                    <Link href="/projects">
                        <FolderKanban className="w-4 h-4 mr-1" />
                        Gerenciar Projetos
                    </Link>
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onToggleArchived}>
                    {showArchived ? "Mostrar Ativas" : "Mostrar Arquivadas"}
                </Button>
                <Button onClick={onNewTask}>
                    <Plus className="w-4 h-4 mr-1" />
                    Nova Tarefa
                </Button>
            </div>
        </div>
    );
}
