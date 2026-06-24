"use client";

import { Badge } from "@/components/ui/badge";
import { ProjetoStatus } from "@/types";

const STATUS_CONFIG: Record<ProjetoStatus, { label: string; className: string }> = {
    ativo:     { label: "Ativo",     className: "bg-green-100 text-green-700 border-green-300" },
    pausado:   { label: "Pausado",   className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    concluido: { label: "Concluído", className: "bg-blue-100 text-blue-700 border-blue-300" },
    cancelado: { label: "Cancelado", className: "bg-red-100 text-red-700 border-red-300" },
};

interface ProjectStatusBadgeProps {
    status?: ProjetoStatus | null;
    className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
    const cfg = STATUS_CONFIG[status ?? 'ativo'];
    return (
        <Badge variant="outline" className={`${cfg.className} text-xs font-medium ${className ?? ''}`}>
            {cfg.label}
        </Badge>
    );
}
