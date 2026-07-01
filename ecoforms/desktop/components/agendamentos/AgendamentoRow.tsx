"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, MessageCircle, UserCheck, XCircle } from "lucide-react";
import { podeCancelarAgendamento } from "@/src/domain/service/Agendamento";
import type { BookingRow } from "@/src/interface/hooks/queries/useBookingTasks";
import { toast } from "sonner";

interface AgendamentoRowProps {
    row: BookingRow;
    onCancelar: (id: string) => Promise<void>;
    onReenviarWhatsapp: (id: string) => Promise<string | null>;
}

const STATUS_LABEL: Record<BookingRow["status"], string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    realizado: "Realizado",
    cancelado: "Cancelado",
};

export function AgendamentoRow({ row, onCancelar, onReenviarWhatsapp }: AgendamentoRowProps) {
    const [expanded, setExpanded] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

    const podeCancelar = podeCancelarAgendamento(row.status);
    const formEntries = Object.entries(row.dadosFormulario).filter(
        ([, valor]) => valor !== null && valor !== undefined && valor !== ""
    );

    const confirmCancelar = async () => {
        try {
            await onCancelar(row.id);
            toast.success("Agendamento cancelado");
        } catch (e) {
            toast.error("Erro ao cancelar: " + (e as Error).message);
        } finally {
            setCancelOpen(false);
        }
    };

    const handleReenviarWhatsapp = async () => {
        setSendingWhatsapp(true);
        try {
            const link = await onReenviarWhatsapp(row.id);
            if (!link) {
                toast.error("Nenhum link de WhatsApp disponível para este agendamento.");
                return;
            }
            window.open(link, "_blank", "noopener,noreferrer");
        } catch (e) {
            toast.error("Erro ao gerar link: " + (e as Error).message);
        } finally {
            setSendingWhatsapp(false);
        }
    };

    return (
        <div className="rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="font-medium leading-tight">{row.titulo}</p>
                    {row.atribuidoPara && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <UserCheck className="h-3 w-3" />
                            {row.atribuidoPara}
                        </p>
                    )}
                </div>
                <Badge
                    variant={row.status === "confirmado" ? "default" : row.status === "cancelado" ? "secondary" : "outline"}
                    className="text-xs"
                >
                    {STATUS_LABEL[row.status]}
                </Badge>
            </div>

            <Collapsible open={expanded} onOpenChange={setExpanded}>
                <div className="flex items-center gap-1 mt-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                            {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                            Detalhes
                        </Button>
                    </CollapsibleTrigger>
                    <Button variant="ghost" size="sm" className="h-7 px-2" disabled={sendingWhatsapp} onClick={handleReenviarWhatsapp}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        WhatsApp
                    </Button>
                    {podeCancelar && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setCancelOpen(true)}
                        >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                        </Button>
                    )}
                </div>

                <CollapsibleContent className="mt-2 space-y-1 text-xs text-muted-foreground border-t pt-2">
                    {row.clienteTelefone && <p>Telefone: {row.clienteTelefone}</p>}
                    {row.clienteEmail && <p>E-mail: {row.clienteEmail}</p>}
                    {row.bairro && <p>Bairro: {row.bairro}</p>}
                    <p>Vagas solicitadas: {row.vagasSolicitadas}</p>
                    {formEntries.map(([campo, valor]) => (
                        <p key={campo}>{campo}: {String(valor)}</p>
                    ))}
                </CollapsibleContent>
            </Collapsible>

            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O agendamento de {row.titulo} será cancelado e a vaga voltará a ficar disponível no
                            slot. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCancelar}>Cancelar agendamento</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
