"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, UserPlus, CheckCircle, MessageCircle, ExternalLink } from "lucide-react";
import { ClientePhoneSearch, type SelectedCliente } from "@/components/clientes/ClientePhoneSearch";
import { QuickCreateClientForm } from "@/components/clientes/QuickCreateClientForm";
import { FormRenderer } from "@/components/runtime/FormRenderer";
import { useFormTemplate } from "@/src/interface/hooks/catalog/forms";
import { useServiceSlotById } from "@/src/interface/hooks/catalog/service";
import { useServiceTypes } from "@/src/interface/hooks/catalog/service";
import { useAgendamentoMutations } from "@/src/interface/hooks/catalog/service";
import { useAdminUsers } from "@/src/interface/hooks/catalog/auth";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";
import type { FormContent } from "@/types";
import { formatDateBR } from "@/src/lib/date";
import { toast } from "sonner";

interface BookingModalProps {
    slotId: string;
    open: boolean;
    onClose: (agendamentoId?: string) => void;
}

type Etapa = 1 | 2 | 3;

export function BookingModal({ slotId, open, onClose }: BookingModalProps) {
    const { user } = useAuth();
    const { slot, loading: slotLoading } = useServiceSlotById(slotId || null);
    const { types } = useServiceTypes();
    const serviceType = types.find(t => t.id === slot?.serviceTypeId);
    const { template, loading: formLoading } = useFormTemplate(serviceType?.formId ?? undefined);
    const { criarBooking, findLinkWhatsApp, loading: bookingLoading, error: bookingError } = useAgendamentoMutations();
    const { users } = useAdminUsers();

    const usuarios = users.filter(u => u.ativo).map(u => ({ id: u.id, nome: u.nome }));

    const [etapa, setEtapa] = useState<Etapa>(1);
    const [selectedCliente, setSelectedCliente] = useState<SelectedCliente | null>(null);
    const [responsavelId, setResponsavelId] = useState("");
    const [prefillData, setPrefillData] = useState<Record<string, FormFieldValue>>({});
    const [enderecoDiferente, setEnderecoDiferente] = useState(false);
    const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
    const [waLink, setWaLink] = useState<string | null>(null);
    const [showQuickCreate, setShowQuickCreate] = useState(false);

    useEffect(() => {
        if (open) {
            setEtapa(1);
            setSelectedCliente(null);
            setResponsavelId("");
            setPrefillData({});
            setEnderecoDiferente(false);
            setAgendamentoId(null);
            setWaLink(null);
            setShowQuickCreate(false);
        }
    }, [open, slotId]);

    const handleSelectCliente = (cliente: SelectedCliente | null) => {
        setSelectedCliente(cliente);
        setEnderecoDiferente(false);
        if (cliente) {
            setPrefillData({
                cliente_id:   cliente.id,
                cliente_nome: cliente.nome,
                telefone:     cliente.telefone ?? '',
                email:        cliente.email ?? '',
                bairro:       cliente.bairro ?? '',
                endereco:     buildEnderecoCompleto(cliente),
                cidade:       cliente.cidade ?? '',
                cep:          cliente.cep ?? '',
            });
        } else {
            setPrefillData({});
        }
    };

    const handleEnderecoDiferenteChange = (checked: boolean) => {
        setEnderecoDiferente(checked);
        setPrefillData(prev => {
            if (checked && selectedCliente) {
                const { endereco: _, cidade: __, cep: ___, ...rest } = prev;
                return rest;
            }
            if (!checked && selectedCliente) {
                return {
                    ...prev,
                    endereco: buildEnderecoCompleto(selectedCliente),
                    cidade: selectedCliente.cidade ?? '',
                    cep: selectedCliente.cep ?? '',
                    bairro: selectedCliente.bairro ?? '',
                };
            }
            return prev;
        });
    };

    const handleFormSubmit = async (dados: Record<string, FormFieldValue>) => {
        if (!slot || !user || !selectedCliente) return;
        if (slot.capacidade && slot.vagasOcupadas >= slot.capacidade) {
            toast.error("Slot lotado. Selecione outro horário.");
            return;
        }
        const id = await criarBooking({
            slotId: slot.id,
            clienteId:       selectedCliente.id,
            clienteNome:     selectedCliente.nome ?? (dados.cliente_nome as string) ?? 'Cliente',
            clienteEmail:    selectedCliente.email ?? (dados.email as string) ?? undefined,
            clienteTelefone: selectedCliente.telefone ?? (dados.telefone as string) ?? undefined,
            dadosFormulario: dados,
            vagasSolicitadas: (dados.vagas_solicitadas as number) ?? 1,
            bairro:           (dados.bairro as string) ?? undefined,
            responsavelId:    responsavelId || undefined,
            userId:           user.id,
        });
        setAgendamentoId(id);
        try {
            const link = await findLinkWhatsApp(id);
            setWaLink(link);
        } catch { /* sem notificação — ok */ }
        setEtapa(3);
    };

    const reiniciar = () => {
        setEtapa(1);
        setSelectedCliente(null);
        setResponsavelId("");
        setPrefillData({});
        setEnderecoDiferente(false);
        setAgendamentoId(null);
        setWaLink(null);
    };

    const isLoading = slotLoading || formLoading;
    const dataFormatada = slot ? formatDateBR(slot.dataInicio) : '';

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(agendamentoId ?? undefined); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {slot && serviceType && (
                    <DialogHeader className="pb-0">
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <span>{serviceType.icone ?? '📅'}</span>
                            <span>{serviceType.nome}</span>
                            <span className="text-muted-foreground font-normal">·</span>
                            <span className="text-muted-foreground font-normal text-sm">{slot.titulo} · {dataFormatada}</span>
                        </DialogTitle>
                        {slot.capacidade && (
                            <CapacidadeBadge ocupadas={slot.vagasOcupadas} total={slot.capacidade} />
                        )}
                    </DialogHeader>
                )}

                {isLoading && (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!isLoading && (!slot || !serviceType) && (
                    <p className="text-center text-red-500 py-8">Slot ou tipo de serviço não encontrado.</p>
                )}

                {!isLoading && slot && serviceType && (
                    <>
                        <Stepper etapa={etapa} />

                        {etapa === 1 && (
                            <div className="space-y-4 pt-2">
                                <ClientePhoneSearch selected={selectedCliente} onSelect={handleSelectCliente} />
                                {!selectedCliente && !showQuickCreate && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Cliente não encontrado?</span>
                                        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowQuickCreate(true)}>
                                            <UserPlus className="mr-1 h-3 w-3" />
                                            Cadastrar novo cliente
                                        </Button>
                                    </div>
                                )}
                                {!selectedCliente && showQuickCreate && (
                                    <QuickCreateClientForm
                                        onCreated={(cliente) => {
                                            handleSelectCliente(cliente);
                                            setShowQuickCreate(false);
                                        }}
                                        onCancel={() => setShowQuickCreate(false)}
                                    />
                                )}
                                {selectedCliente && (
                                    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                                        <Checkbox
                                            id="endereco-diferente"
                                            checked={enderecoDiferente}
                                            onCheckedChange={(v) => handleEnderecoDiferenteChange(v === true)}
                                        />
                                        <Label htmlFor="endereco-diferente" className="text-sm cursor-pointer">
                                            Endereço de coleta diferente do cadastro
                                        </Label>
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
                                    <Button onClick={() => setEtapa(2)} disabled={!selectedCliente}>
                                        Próximo →
                                    </Button>
                                </div>
                            </div>
                        )}

                        {etapa === 2 && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Responsável pela execução
                                    </Label>
                                    <Select value={responsavelId} onValueChange={setResponsavelId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecionar (opcional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {usuarios.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {template && serviceType.formId ? (
                                    <FormRenderer
                                        content={template as FormContent}
                                        formType={serviceType.formId}
                                        prefillData={prefillData}
                                        customSubmit={handleFormSubmit}
                                        submitLabel={bookingLoading ? "Confirmando..." : "Confirmar agendamento →"}
                                    />
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        Este tipo de serviço não possui formulário configurado.
                                    </p>
                                )}

                                {bookingError && (
                                    <p className="text-sm text-red-500">{bookingError}</p>
                                )}

                                <Button variant="ghost" onClick={() => setEtapa(1)} disabled={bookingLoading}>
                                    ← Voltar
                                </Button>
                            </div>
                        )}

                        {etapa === 3 && agendamentoId && (
                            <div className="space-y-4 pt-2 text-center">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                                <div>
                                    <p className="font-semibold text-lg">Agendamento confirmado!</p>
                                    <p className="text-sm text-muted-foreground font-mono mt-1">
                                        Protocolo: {agendamentoId}
                                    </p>
                                </div>
                                <div className="text-sm space-y-1 text-muted-foreground">
                                    <p><strong>Cliente:</strong> {selectedCliente?.nome}</p>
                                    <p><strong>Serviço:</strong> {serviceType.nome} · {slot.titulo}</p>
                                    <p><strong>Data:</strong> {dataFormatada}</p>
                                </div>

                                <div className="flex justify-center gap-3 pt-2 flex-wrap">
                                    {waLink && (
                                        <a href={waLink} target="_blank" rel="noopener noreferrer">
                                            <Button variant="outline" size="sm">
                                                <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                                                Enviar WhatsApp
                                                <ExternalLink className="ml-1 h-3 w-3" />
                                            </Button>
                                        </a>
                                    )}
                                    <Button variant="outline" size="sm" onClick={reiniciar}>
                                        Novo agendamento no mesmo slot
                                    </Button>
                                    <Button size="sm" onClick={() => onClose(agendamentoId)}>
                                        Fechar
                                    </Button>
                                </div>
                            </div>
                        )}
                        {etapa === 3 && !agendamentoId && (
                            <div className="space-y-4 pt-2 text-center">
                                <p className="text-red-500 py-4">Erro ao confirmar agendamento. Tente novamente.</p>
                                <Button variant="outline" onClick={reiniciar}>Tentar novamente</Button>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Stepper({ etapa }: { etapa: Etapa }) {
    const steps = ['① Cliente', '② Serviço', '③ Confirmação'];
    return (
        <div className="flex items-center gap-4 text-sm py-1">
            {steps.map((s, i) => (
                <span
                    key={i}
                    className={i + 1 === etapa ? 'font-semibold text-primary' : i + 1 < etapa ? 'text-muted-foreground line-through' : 'text-muted-foreground'}
                >
                    {s}
                </span>
            ))}
        </div>
    );
}

function CapacidadeBadge({ ocupadas, total }: { ocupadas: number; total: number }) {
    const pct = total > 0 ? ocupadas / total : 0;
    const livres = total - ocupadas;
    const variant = pct >= 1 ? 'secondary' : pct >= 0.85 ? 'destructive' : 'outline';
    return (
        <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 1 ? 'bg-muted-foreground' : pct >= 0.85 ? 'bg-red-500' : pct >= 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
            </div>
            <Badge variant={variant} className="text-xs">
                {pct >= 1 ? 'Lotado' : `${livres} vaga${livres !== 1 ? 's' : ''}`}
            </Badge>
        </div>
    );
}

function buildEnderecoCompleto(cliente: SelectedCliente): string {
    const parts: string[] = [];
    if (cliente.endereco) parts.push(cliente.endereco);
    if (cliente.numero) parts.push(cliente.numero);
    const ruaNumero = parts.join(', ');
    const resto: string[] = [];
    if (cliente.complemento) resto.push(cliente.complemento);
    if (cliente.bairro) resto.push(cliente.bairro);
    const cidadeEstado = [cliente.cidade, cliente.estado].filter(Boolean).join('/');
    if (cidadeEstado) resto.push(cidadeEstado);
    if (cliente.cep) resto.push(`CEP: ${cliente.cep}`);
    return [ruaNumero, ...resto].filter(Boolean).join(' - ');
}
