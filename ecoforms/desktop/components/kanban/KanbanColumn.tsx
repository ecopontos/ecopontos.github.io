import { UnifiedTaskView } from "@/types";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanTaskCard } from "./KanbanTaskCard";
import { cn } from "@/src/lib/utils";

interface KanbanColumnProps {
    id: 'solicitacao' | 'a_fazer' | 'em_progresso' | 'concluido' | 'arquivadas';
    title: string;
    tasks: UnifiedTaskView[];
    color: string;
    onTaskClick?: (task: UnifiedTaskView) => void;
    onTaskEdit?: (task: UnifiedTaskView) => void;
    onViewRecords?: (task: UnifiedTaskView) => void;
    onArchive?: (task: UnifiedTaskView) => void;
    onDelete?: (task: UnifiedTaskView) => void;
    onAddTask?: (status: string) => void;
}

export function KanbanColumn({
    id, title, tasks, color, onTaskClick, onTaskEdit, onViewRecords, onArchive, onDelete, onAddTask
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-lg border border-slate-100 min-w-[300px] w-full max-w-[400px]">
            {/* Header */}
            <div className={`p-3 border-b border-slate-100 flex items-center justify-between rounded-t-lg bg-white`}>
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color}`} />
                    <h3 className="font-semibold text-sm text-slate-700">{title}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                        {tasks.length}
                    </span>
                </div>
            </div>

            {/* Droppable Area */}
            <div ref={setNodeRef} className="flex-1 p-2 overflow-y-auto min-h-[150px]">
                <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map(task => (
                        <KanbanTaskCard 
                            key={task.id} 
                            task={task} 
                            onClick={() => onTaskClick?.(task)} 
                            onEdit={() => onTaskEdit?.(task)}
                            onViewRecords={() => onViewRecords?.(task)}
                            onArchive={() => onArchive?.(task)}
                            onDelete={() => onDelete?.(task)}
                        />
                    ))}
                </SortableContext>

                {tasks.length === 0 && (
                    <button
                        type="button"
                        onClick={() => onAddTask?.(id)}
                        className={cn(
                            "w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-xs gap-1 transition-colors",
                            isOver
                                ? "border-blue-400 bg-blue-50 text-blue-500"
                                : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <span className="text-lg">+</span>
                        <span>Adicionar tarefa</span>
                    </button>
                )}
            </div>
        </div>
    );
}
