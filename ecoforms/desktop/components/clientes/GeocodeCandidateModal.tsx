/**
 * Modal de seleção de candidato de geocodificação (Fase 2 — georreferenciamento).
 * Substitui a aceitação silenciosa do primeiro resultado do Nominatim por uma
 * lista de candidatos com display_name, confidence e validação cidade/UF.
 *
 * Modelo: NewTaskModal.tsx (shadcn Dialog controlado).
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, TriangleAlert } from "lucide-react";
import type { GeoConfidence, GeoResult } from "@/src/lib/geocoding";

export interface GeocodeCandidateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    candidates: GeoResult[];
    sourceQuery: string;
    /** Referência do cadastro para validar cidade/UF divergentes. */
    expected?: { cidade?: string | null; estado?: string | null; cep?: string | null };
    /** Chamado quando o usuário confirma um candidato. */
    onSelect: (candidate: GeoResult) => void;
}

const CONFIDENCE_VARIANT: Record<GeoConfidence, "default" | "secondary" | "destructive"> = {
    alta: "default",
    media: "secondary",
    baixa: "destructive",
};

const CONFIDENCE_LABEL: Record<GeoConfidence, string> = {
    alta: "Confiança alta",
    media: "Confiança média",
    baixa: "Confiança baixa",
};

function warningsFor(c: GeoResult, expected?: GeocodeCandidateModalProps["expected"]): string[] {
    if (!expected) return [];
    const w: string[] = [];
    if (expected.estado && c.estado && expected.estado.toUpperCase() !== c.estado) {
        w.push(`UF divergente: cadastro=${expected.estado}, provedor=${c.estado}`);
    }
    if (expected.cidade && c.cidade && expected.cidade.trim().toLowerCase() !== c.cidade.trim().toLowerCase()) {
        w.push(`Cidade divergente: cadastro=${expected.cidade}, provedor=${c.cidade}`);
    }
    return w;
}

export function GeocodeCandidateModal({
    open,
    onOpenChange,
    candidates,
    sourceQuery,
    expected,
    onSelect,
}: GeocodeCandidateModalProps) {
    const incompleteAddress = !sourceQuery || sourceQuery.split(",").filter((p) => p.trim() && p.trim() !== "Brasil").length < 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-150">
                <DialogHeader>
                    <DialogTitle>Escolher coordenada</DialogTitle>
                    <DialogDescription>
                        Selecione o candidato que melhor representa o endereço. O Nominatim pode
                        retornar mais de um resultado — confirme antes de salvar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground">Endereço consultado</p>
                        <p className="text-sm break-words">{sourceQuery || "—"}</p>
                    </div>

                    {incompleteAddress && (
                        <Alert variant="destructive">
                            <TriangleAlert className="h-4 w-4" />
                            <AlertTitle>Endereço incompleto</AlertTitle>
                            <AlertDescription>
                                A consulta não inclui rua, número e cidade. Os candidatos podem estar
                                imprecisos — revise antes de confirmar.
                            </AlertDescription>
                        </Alert>
                    )}

                    {candidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum candidato retornado pelo provedor.</p>
                    ) : (
                        <ul className="space-y-2 max-h-80 overflow-auto">
                            {candidates.map((c, i) => {
                                const warnings = warningsFor(c, expected);
                                return (
                                    <li key={`${c.latitude},${c.longitude},${i}`} className="rounded-md border p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium break-words">{c.display_name || "Sem descrição"}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {c.confidence && (
                                                    <Badge variant={CONFIDENCE_VARIANT[c.confidence]}>
                                                        {CONFIDENCE_LABEL[c.confidence]}
                                                    </Badge>
                                                )}
                                                {c.precision && (
                                                    <span className="text-[10px] text-muted-foreground">{c.precision}</span>
                                                )}
                                            </div>
                                        </div>
                                        {warnings.length > 0 && (
                                            <Alert variant="destructive">
                                                <TriangleAlert className="h-4 w-4" />
                                                <AlertDescription className="text-xs">
                                                    {warnings.join(" · ")}
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        <div className="flex justify-end">
                                            <Button size="sm" onClick={() => { onSelect(c); onOpenChange(false); }}>
                                                <MapPin className="h-4 w-4 mr-1" />
                                                Usar este candidato
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
