'use client';

import { ShieldCheck } from 'lucide-react';

export interface TaskPatchFile {
    name?: string;
    id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_accessed_at?: string | null;
    last_modified?: string;
    metadata?: Record<string, unknown> | null;
}

interface PatchHistoryPanelProps {
    patches: TaskPatchFile[];
    loading: boolean;
}

export function PatchHistoryPanel({ patches, loading }: PatchHistoryPanelProps) {
    return (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Histórico de Correções (Patches)</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {loading ? (
                    <div className="text-[10px] text-slate-500 animate-pulse">Carregando histórico...</div>
                ) : (
                    patches.map((patch, idx) => (
                        <div key={idx} className="text-[10px] flex justify-between items-center py-1 border-b border-white/50 last:border-0">
                            <span className="text-slate-600 font-medium">#{idx + 1} - Patch JSON</span>
                            <span className="text-slate-400 font-mono">
                                {new Date(patch.created_at || patch.last_modified || "").toLocaleString()}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
