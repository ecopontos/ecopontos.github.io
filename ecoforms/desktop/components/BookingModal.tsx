"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, UserPlus, CheckCircle, MessageCircle, ExternalLink, Save, User, MapPin } from "lucide-react";
import { ClientePhoneSearch, type SelectedCliente } from "@/components/clientes/ClientePhoneSearch";
import { FormRenderer } from "@/components/runtime/FormRenderer";
import { useFormTemplate } from "@/src/interface/hooks/queries/useFormTemplate";
import { useServiceSlotById } from "@/src/interface/hooks/queries/useServiceSlots";
import { useServiceTypes } from "@/src/interface/hooks/queries/useServiceTypes";
import { useAgendamentoMutations } from "@/src/interface/hooks/mutations/useAgendamentoMutations";
import { useAdminUsers } from "@/src/interface/hooks/catalog/auth";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import { useAuth } from "@/contexts/AuthContext";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";
import type { FormContent } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uuidv7 } from "ecoforms-core";
import { categoriasPorTipo, type CategoriaCliente } from "@/types/clientes";
import { maskCep, fetchCep } from "@/src/lib/cep";

function maskDocument(value: string, tipo: "PF" | "PJ") {
    const digits = value.replace(/\D/g, "");
    if (tipo === "PF") {
        return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
    }
    return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2").slice(0, 18);
}

function maskPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 10) {
        return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 14);
    }
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);
}

interface UsuarioOption { id: string; nome: string; }

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
    const { save: saveCliente, loading: clienteSaving } = useClienteMutations();

    // usuários ativos para o select de responsável
    const usuarios: UsuarioOption[] = users.filter(u => u.ativo).map(u => ({ id: u.id, nome: u.nome }));

    const [etapa, setEtapa] = useState<Etapa>(1);
    const [selectedCliente, setSelectedCliente] = useState<SelectedCliente | null>(null);
    const [responsavelId, setResponsavelId] = useState("");
    const [prefillData, setPrefillData] = useState<Record<string, FormFieldValue>>({});
    const [enderecoDiferente, setEnderecoDiferente] = useState(false);
    const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
    const [waLink, setWaLink] = useState<string | null>(null);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickForm, setQuickForm] = useState({
        nome: "",
        tipo: "PJ" as "PF" | "PJ",
        categoria: "" as CategoriaCliente | "",
        documento: "",
        email: "",
        telefone: "",
        cep: "",
        endereco: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "",
        complemento: "",
        observacoes: "",
    });
    const [quickCepLoading, setQuickCepLoading] = useState(false);
    const [quickCreateLoading, setQuickCreateLoading] = useState(false);
    const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

    // Reset ao abrir
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
            setQuickCreateError(null);
            setQuickForm({ nome: "", tipo: "PJ", categoria: "", documento: "", email: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", complemento: "", observacoes: "" });
        }
    }, [open, slotId]);

    // Reset categoria ao trocar tipo
    useEffect(() => {
        setQuickForm(prev => ({ ...prev, categoria: "" }));
    }, [quickForm.tipo]);

    const handleQuickCepBlur = async () => {
        const digits = quickForm.cep.replace(/\D/g, "");
        if (digits.length !== 8) return;
        setQuickCepLoading(true);
        const data = await fetchCep(quickForm.cep);
        setQuickCepLoading(false);
        if (data) {
            setQuickForm(prev => ({
                ...prev,
                endereco: data.logradouro || "",
                bairro: data.bairro || "",
                cidade: data.localidade || "",
                estado: data.uf || "",
            }));
        }
    };

    const handleSelectCliente = (cliente: SelectedCliente | null) => {
        setSelectedCliente(cliente);
        setEnderecoDiferente(false);
        if (cliente) {
            const enderecoCompleto = buildEnderecoCompleto(cliente);
            setPrefillData({
                cliente_id:   cliente.id,
                cliente_nome: cliente.nome,
                telefone:     cliente.telefone ?? '',
                email:        cliente.email ?? '',
                bairro:       cliente.bairro ?? '',
                endereco:     enderecoCompleto,
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
                const enderecoCompleto = buildEnderecoCompleto(selectedCliente);
                return {
                    ...prev,
                    endereco: enderecoCompleto,
                    cidade: selectedCliente.cidade ?? '',
                    cep: selectedCliente.cep ?? '',
                    bairro: selectedCliente.bairro ?? '',
                };
            }
            return prev;
        });
    };

    const handleQuickCreate = async () => {
        if (!quickForm.nome.trim()) return;

        const docDigits = quickForm.documento.replace(/\D/g, "");
        const telDigits = quickForm.telefone.replace(/\D/g, "");
        if (docDigits && docDigits.length !== 11 && docDigits.length !== 14) {
            setQuickCreateError("Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).");
            return;
        }
        if (telDigits && telDigits.length < 10) {
            setQuickCreateError("Telefone inválido. Informe ao menos 10 dígitos (DDD + número).");
            return;
        }
        setQuickCreateError(null);
        setQuickCreateLoading(true);
        try {
            const id = uuidv7();
            const newCliente = {
                id,
                nome: quickForm.nome.trim(),
                tipo: quickForm.tipo,
                categoria: quickForm.categoria || null,
                documento: docDigits,
                email: quickForm.email.trim(),
                telefone: telDigits,
                cep: quickForm.cep.replace(/\D/g, ""),
                endereco: quickForm.endereco.trim(),
                numero: quickForm.numero.trim(),
                bairro: quickForm.bairro.trim(),
                cidade: quickForm.cidade.trim(),
                estado: quickForm.estado.trim(),
                complemento: quickForm.complemento.trim(),
                observacoes: quickForm.observacoes.trim(),
                ativo: 1,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
            };
            await saveCliente(newCliente);
            handleSelectCliente({
                id: newCliente.id,
                nome: newCliente.nome,
                tipo: newCliente.tipo,
                categoria: newCliente.categoria,
                bairro: newCliente.bairro || undefined,
                email: newCliente.email || undefined,
                telefone: newCliente.telefone || undefined,
                viaContato: "telefone",
                endereco: newCliente.endereco || undefined,
                numero: newCliente.numero || undefined,
                cidade: newCliente.cidade || undefined,
                estado: newCliente.estado || undefined,
                cep: newCliente.cep || undefined,
                complemento: newCliente.complemento || undefined,
            });
            setShowQuickCreate(false);
        } catch (e: unknown) {
            setQuickCreateError(e instanceof Error ? e.message : "Erro ao criar cliente. Tente novamente.");
        } finally {
            setQuickCreateLoading(false);
        }
    };

    const handleFormSubmit = async (dados: Record<string, FormFieldValue>) => {
        if (!slot || !user || !selectedCliente) return;
        if (slot.capacidade && slot.vagasOcupadas >= slot.capacidade) {
            alert("Slot lotado. Selecione outro horário.");
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
    const dataFormatada = slot ? formatDate(slot.dataInicio) : '';

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(agendamentoId ?? undefined); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header fixo com info do slot */}
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
                        {/* Stepper */}
                        <Stepper etapa={etapa} />

                        {/* Etapa 1 — Identificação do cliente */}
                        {etapa === 1 && (
                            <div className="space-y-4 pt-2">
                                <ClientePhoneSearch selected={selectedCliente} onSelect={handleSelectCliente} />
                                {!selectedCliente && !showQuickCreate && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-muted-foreground">Cliente não encontrado?</span>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="h-auto p-0"
                                            onClick={() => setShowQuickCreate(true)}
                                        >
                                            <UserPlus className="mr-1 h-3 w-3" />
                                            Cadastrar novo cliente
                                        </Button>
                                    </div>
                                )}
                                {!selectedCliente && showQuickCreate && (
                                    <div className="space-y-3 rounded-md border p-3 max-h-[55vh] overflow-y-auto">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Cadastrar novo cliente</span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowQuickCreate(false)}>
                                                ✕
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Tipo</Label>
                                                <select
                                                    value={quickForm.tipo}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, tipo: e.target.value as "PF" | "PJ" }))}
                                                    className="w-full border rounded-md px-2 py-1 text-sm h-8 bg-background"
                                                >
                                                    <option value="PJ">Pessoa Jurídica</option>
                                                    <option value="PF">Pessoa Física</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Categoria</Label>
                                                <select
                                                    value={quickForm.categoria}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, categoria: e.target.value as CategoriaCliente }))}
                                                    className="w-full border rounded-md px-2 py-1 text-sm h-8 bg-background"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {categoriasPorTipo(quickForm.tipo).map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs"><User className="h-3 w-3 inline mr-1" />Nome *</Label>
                                                <Input
                                                    value={quickForm.nome}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, nome: e.target.value }))}
                                                    placeholder="Nome do cliente"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Documento {quickForm.tipo === "PJ" ? "(CNPJ)" : "(CPF)"}</Label>
                                                <Input
                                                    value={quickForm.documento}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, documento: maskDocument(e.target.value, quickForm.tipo) }))}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Telefone</Label>
                                                <Input
                                                    value={quickForm.telefone}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, telefone: maskPhone(e.target.value) }))}
                                                    placeholder="(00) 00000-0000"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Email</Label>
                                                <Input
                                                    value={quickForm.email}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, email: e.target.value }))}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="md:col-span-2 mt-3 mb-1">
                                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>Endereço</span>
                                                </div>
                                                <hr className="mt-1 border-border/50" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">CEP</Label>
                                                <div className="flex gap-1">
                                                    <Input
                                                        value={quickForm.cep}
                                                        onChange={e => setQuickForm(prev => ({ ...prev, cep: maskCep(e.target.value) }))}
                                                        onBlur={handleQuickCepBlur}
                                                        onKeyDown={e => e.key === "Enter" && handleQuickCepBlur()}
                                                        placeholder="00000-000"
                                                        maxLength={9}
                                                        className="h-8 text-sm flex-1"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0"
                                                        onClick={handleQuickCepBlur}
                                                        disabled={quickCepLoading || quickForm.cep.replace(/\D/g, "").length !== 8}
                                                        title="Buscar endereço pelo CEP"
                                                    >
                                                        {quickCepLoading ? (
                                                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                        ) : (
                                                            <MapPin className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Endereço</Label>
                                                <Input value={quickForm.endereco} onChange={e => setQuickForm(prev => ({ ...prev, endereco: e.target.value }))} disabled={quickCepLoading} className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Número</Label>
                                                <Input value={quickForm.numero} onChange={e => setQuickForm(prev => ({ ...prev, numero: e.target.value }))} className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Bairro</Label>
                                                <Input value={quickForm.bairro} onChange={e => setQuickForm(prev => ({ ...prev, bairro: e.target.value }))} disabled={quickCepLoading} className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Cidade</Label>
                                                <Input value={quickForm.cidade} onChange={e => setQuickForm(prev => ({ ...prev, cidade: e.target.value }))} disabled={quickCepLoading} className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Estado</Label>
                                                <Input value={quickForm.estado} onChange={e => setQuickForm(prev => ({ ...prev, estado: e.target.value }))} disabled={quickCepLoading} className="h-8 text-sm" maxLength={2} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Complemento</Label>
                                                <Input value={quickForm.complemento} onChange={e => setQuickForm(prev => ({ ...prev, complemento: e.target.value }))} className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1 md:col-span-2">
                                                <Label className="text-xs">Observações</Label>
                                                <Textarea
                                                    value={quickForm.observacoes}
                                                    onChange={e => setQuickForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                                    placeholder="Notas livres..."
                                                    rows={2}
                                                    className="text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <Button variant="outline" size="sm" onClick={() => setShowQuickCreate(false)}>Cancelar</Button>
                                            <Button size="sm" onClick={handleQuickCreate} disabled={!quickForm.nome.trim() || quickCreateLoading}>
                                                {quickCreateLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                                Salvar
                                            </Button>
                                        </div>
                                        {quickCreateError && (
                                            <p className="text-xs text-red-500">{quickCreateError}</p>
                                        )}
                                    </div>
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

                        {/* Etapa 2 — Dados do serviço */}
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

                        {/* Etapa 3 — Confirmação */}
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

// ── Sub-componentes ──────────────────────────────────────────────

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

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
