/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
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

/** Chaves alternativas aceitas para identificar um participante (bug G). */
const ID_KEYS = ["id", "ID", "Id", "chave", "key", "participant_id", "usuario_id", "user_id"] as const;
const NOME_KEYS = ["nome", "name", "nome_completo", "nomeCompleto", "fullname", "full_name", "label"] as const;
const GALPAO_KEYS = ["galpao", "setor", "area", "departamento", "department"] as const;
const FUNCAO_KEYS = ["funcao", "cargo", "role", "papel", "title"] as const;

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const k of keys) {
        const v = record[k];
        if (typeof v === "string" && v.trim() !== "") return v;
    }
    return undefined;
}

export function PresenceRenderer({ field, value, onChange, readOnly = false }: PresenceRendererProps) {
    // Value structure: { statuses: { userId: 'presente' }, summary: { presente: 1, ... } }
    const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>(value?.statuses || {});
    const [searchTerm, setSearchTerm] = useState("");

    // Bug D: ressincroniza o estado local quando o `value` prop muda externamente
    // (ex.: prefill, restauracao de draft, ou novo registro carregado apos o mount).
    // Antes o useState so lia value no mount inicial, descartando qualquer prefill
    // que chegasse depois.
    useEffect(() => {
        const incoming = value?.statuses || {};
        setStatuses(prev => {
            // So atualiza se divergir, para nao disparar re-render desnecessario.
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(incoming);
            if (prevKeys.length !== nextKeys.length) return incoming;
            for (const k of nextKeys) {
                if (prev[k] !== incoming[k]) return incoming;
            }
            return prev;
        });
    }, [value]);

    // Fetch participants from registry (e.g. source='participantes')
    // Bug C: agora capturamos loading e error para exibir feedback.
    const { data: fetchedParticipants, loading, error, isEmptyFromRegistry } = useDataRegistryAggregated(getRegistrySource(field));

    const rawParticipants = field.participants || field.rawData || [];
    // Merge and prioritize fetched data if available
    const participants: Participant[] = (fetchedParticipants.length > 0 ? fetchedParticipants : rawParticipants).flatMap((participant) => {
        if (!participant || typeof participant !== "object" || Array.isArray(participant)) {
            return [];
        }

        const record = participant as Record<string, unknown>;
        // Bug G: aceita chaves alternativas para id/nome/galpao/funcao.
        const id = pickString(record, ID_KEYS);
        if (!id) {
            return [];
        }

        return [{
            id,
            nome: pickString(record, NOME_KEYS),
            galpao: pickString(record, GALPAO_KEYS),
            funcao: pickString(record, FUNCAO_KEYS),
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
                {loading && <div className="text-center text-sm text-muted-foreground py-4">Carregando participantes…</div>}
                {error && !loading && (
                    <div className="text-center text-sm text-red-600 py-4">
                        Falha ao carregar participantes: {error}
                    </div>
                )}
                {!loading && !error && filteredParticipants.length === 0 && (
                    <div className="text-center text-sm text-gray-500 py-4">
                        {isEmptyFromRegistry
                            ? "Nenhum participante cadastrado no registry para esta fonte."
                            : "Nenhum participante encontrado."}
                    </div>
                )}

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
