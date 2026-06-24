"use client";

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Send, ShieldCheck, XCircle, CheckCircle2, RotateCcw, Lock } from "lucide-react";
import type { ActionPresentation } from "@/src/interface/workflow/ManifestacaoWorkflowPresentation";

const ICON_MAP: Record<string, React.ElementType> = {
    Send,
    ShieldCheck,
    XCircle,
    CheckCircle2,
    RotateCcw,
    Lock,
};

export interface WorkflowActionItem extends ActionPresentation {
    key: string;
}

interface Props {
    actions: WorkflowActionItem[];
    onAction: (key: string) => void;
    disabled?: boolean;
}

export const ManifestacaoWorkflowActions = memo(function ManifestacaoWorkflowActions({
    actions,
    onAction,
    disabled,
}: Props) {
    if (actions.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {actions.map(a => {
                const Icon = a.icon ? ICON_MAP[a.icon] : null;
                return (
                    <Button
                        key={a.key}
                        size="sm"
                        variant={a.variant}
                        onClick={() => onAction(a.key)}
                        disabled={disabled}
                    >
                        {Icon && <Icon className="h-4 w-4 mr-1" />}
                        {a.label}
                    </Button>
                );
            })}
        </div>
    );
});
