import { useState } from 'react';

export type ViewMode = 'kanban' | 'table';

export function useKanbanViewState() {
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [showAllProjects, setShowAllProjects] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');

    return {
        currentProjectId,
        setCurrentProjectId,
        showAllProjects,
        setShowAllProjects,
        viewMode,
        setViewMode,
    };
}
