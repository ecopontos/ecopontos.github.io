import { useState } from "react";
import { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/src/lib/utils";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource } from "./option-utils";

type PresenceStatus = "presente" | "ausente" | "desligado";

interface PresenceValue {
    statuses?: Record<string, PresenceStatus>;
    summary?: {
        presente: number;
        ausente: number;
        desligado: number;
    };
    timestamp?: string;
}

interface PresenceRendererProps {
    field: FormField;
    value: PresenceValue | null | undefined;
    onChange: (value: PresenceValue) => void;
    readOnly?: boolean;
}

interface Participant {
    id: string;
    nome?: string;
    name?: string;
    galpao?: string;
    funcao?: string;
}

export function PresenceRenderer({ field, value, onChange, readOnly = false }: PresenceRendererProps) {
    // Value structure: { statuses: { userId: 'presente' }, summary: { presente: 1, ... } }
    const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>(value?.statuses || {});
    const [searchTerm, setSearchTerm] = useState("");

    // Fetch participants from registry (e.g. source='participantes')
    const { data: fetchedParticipants } = useDataRegistryAggregated(getRegistrySource(field));

    const rawParticipants = field.participants || field.rawData || [];
    // Merge and prioritize fetched data if available
    const participants: Participant[] = (fetchedParticipants.length > 0 ? fetchedParticipants : rawParticipants).flatMap((participant) => {
        if (!participant || typeof participant !== "object" || Array.isArray(participant)) {
            return [];
        }

        const record = participant as Record<string, unknown>;
        if (typeof record.id !== "string") {
            return [];
        }

        return [{
            id: record.id,
            nome: typeof record.nome === "string" ? record.nome : undefined,
            name: typeof record.name === "string" ? record.name : undefined,
            galpao: typeof record.galpao === "string" ? record.galpao : undefined,
            funcao: typeof record.funcao === "string" ? record.funcao : undefined,
        }];
    });

    const handleStatusChange = (participantId: string, info: PresenceStatus) => {
        if (readOnly) return;
        // If clicking same status, toggle off? Or just keep it. Let's keep it simple: set status.
        const newStatuses = { ...statuses, [participantId]: info };
        // Toggle off if same clicked?
        if (statuses[participantId] === info) {
            delete newStatuses[participantId];
        }

        setStatuses(newStatuses);
        updateSummary(newStatuses);
    };

    const updateSummary = (currentStatuses: Record<string, PresenceStatus>) => {
        const summary = {
            presente: Object.values(currentStatuses).filter(s => s === 'presente').length,
            ausente: Object.values(currentStatuses).filter(s => s === 'ausente').length,
            desligado: Object.values(currentStatuses).filter(s => s === 'desligado').length,
        };
        onChange({ statuses: currentStatuses, summary, timestamp: new Date().toISOString() });
    };

    const filteredParticipants = participants.filter(p => {
        const term = searchTerm.toLowerCase();
        const name = (p.nome || p.name || "").toLowerCase();
        const galpao = (p.galpao || "").toLowerCase();
        return name.includes(term) || galpao.includes(term);
    });

    return (
        <div className="space-y-4">
            <Input
                placeholder="Buscar participante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />

            <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2">
                {filteredParticipants.length === 0 && <div className="text-center text-sm text-gray-500 py-4">Nenhum participante encontrado.</div>}

                {filteredParticipants.map(participant => {
                    const pId = participant.id;
                    const currentStatus = statuses[pId];

                    return (
                        <div key={pId} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 border-b last:border-0 hover:bg-slate-50">
                            <div className="mb-2 sm:mb-0">
                                <div className="font-medium text-sm">{participant.nome || participant.name || "Sem Nome"}</div>
                                {(participant.galpao || participant.funcao) && (
                                    <div className="text-xs text-muted-foreground">
                                        {participant.galpao} {participant.galpao && participant.funcao && "-"} {participant.funcao}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={currentStatus === 'presente' ? 'default' : 'outline'}
                                    className={cn(currentStatus === 'presente' && "bg-green-600 hover:bg-green-700")}
                                    onClick={() => handleStatusChange(pId, 'presente')}
                                    disabled={readOnly}
                                >
                                    Presente
                                </Button>
                                <Button
                                    size="sm"
                                    variant={currentStatus === 'ausente' ? 'default' : 'outline'}
                                    className={cn(currentStatus === 'ausente' && "bg-red-600 hover:bg-red-700")}
                                    onClick={() => handleStatusChange(pId, 'ausente')}
                                    disabled={readOnly}
                                >
                                    Ausente
                                </Button>
                                <Button
                                    size="sm"
                                    variant={currentStatus === 'desligado' ? 'default' : 'outline'}
                                    className={cn(currentStatus === 'desligado' && "bg-gray-600 hover:bg-gray-700")}
                                    onClick={() => handleStatusChange(pId, 'desligado')}
                                    disabled={readOnly}
                                >
                                    Desligado
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-4 text-sm font-medium pt-2 border-t">
                <span className="text-green-600">Presentes: {Object.values(statuses).filter(s => s === 'presente').length}</span>
                <span className="text-red-600">Ausentes: {Object.values(statuses).filter(s => s === 'ausente').length}</span>
                <span className="text-gray-600">Desligados: {Object.values(statuses).filter(s => s === 'desligado').length}</span>
            </div>
        </div>
    );
}
