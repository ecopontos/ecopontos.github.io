"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, User, MapPin } from "lucide-react";
import { maskPhone } from "@/src/lib/phone";
import { maskCep, fetchCep } from "@/src/lib/cep";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import { uuidv7 } from "ecoforms-core";
import { categoriasPorTipo, type CategoriaCliente } from "@/types/clientes";
import type { SelectedCliente } from "./ClientePhoneSearch";

function maskDocument(value: string, tipo: "PF" | "PJ") {
    const digits = value.replace(/\D/g, "");
    if (tipo === "PF") {
        return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
    }
    return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2").slice(0, 18);
}

interface QuickCreateClientFormProps {
    onCreated: (cliente: SelectedCliente) => void;
    onCancel: () => void;
}

export function QuickCreateClientForm({ onCreated, onCancel }: QuickCreateClientFormProps) {
    const { save: saveCliente } = useClienteMutations();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cepLoading, setCepLoading] = useState(false);
    const [form, setForm] = useState({
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

    useEffect(() => {
        setForm(prev => ({ ...prev, categoria: "" }));
    }, [form.tipo]);

    const handleCepBlur = async () => {
        const digits = form.cep.replace(/\D/g, "");
        if (digits.length !== 8) return;
        setCepLoading(true);
        const data = await fetchCep(form.cep);
        setCepLoading(false);
        if (data) {
            setForm(prev => ({
                ...prev,
                endereco: data.logradouro || "",
                bairro: data.bairro || "",
                cidade: data.localidade || "",
                estado: data.uf || "",
            }));
        }
    };

    const handleSubmit = async () => {
        if (!form.nome.trim()) return;
        const docDigits = form.documento.replace(/\D/g, "");
        const telDigits = form.telefone.replace(/\D/g, "");
        if (docDigits && docDigits.length !== 11 && docDigits.length !== 14) {
            setError("Documento inválido. Informe CPF (11 dígitos) ou CNPJ (14 dígitos).");
            return;
        }
        if (telDigits && telDigits.length < 10) {
            setError("Telefone inválido. Informe ao menos 10 dígitos (DDD + número).");
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const id = uuidv7();
            const newCliente = {
                id,
                nome: form.nome.trim(),
                tipo: form.tipo,
                categoria: form.categoria || null,
                documento: docDigits,
                email: form.email.trim(),
                telefone: telDigits,
                cep: form.cep.replace(/\D/g, ""),
                endereco: form.endereco.trim(),
                numero: form.numero.trim(),
                bairro: form.bairro.trim(),
                cidade: form.cidade.trim(),
                estado: form.estado.trim(),
                complemento: form.complemento.trim(),
                observacoes: form.observacoes.trim(),
                ativo: 1,
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
            };
            await saveCliente(newCliente);
            onCreated({
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
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Erro ao criar cliente. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3 rounded-md border p-3 max-h-[55vh] overflow-y-auto">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cadastrar novo cliente</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel}>
                    ✕
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                        value={form.tipo}
                        onChange={e => setForm(prev => ({ ...prev, tipo: e.target.value as "PF" | "PJ" }))}
                        className="w-full border rounded-md px-2 py-1 text-sm h-8 bg-background"
                    >
                        <option value="PJ">Pessoa Jurídica</option>
                        <option value="PF">Pessoa Física</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <select
                        value={form.categoria}
                        onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value as CategoriaCliente }))}
                        className="w-full border rounded-md px-2 py-1 text-sm h-8 bg-background"
                    >
                        <option value="">Selecione...</option>
                        {categoriasPorTipo(form.tipo).map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs"><User className="h-3 w-3 inline mr-1" />Nome *</Label>
                    <Input
                        value={form.nome}
                        onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome do cliente"
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Documento {form.tipo === "PJ" ? "(CNPJ)" : "(CPF)"}</Label>
                    <Input
                        value={form.documento}
                        onChange={e => setForm(prev => ({ ...prev, documento: maskDocument(e.target.value, form.tipo) }))}
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                        value={form.telefone}
                        onChange={e => setForm(prev => ({ ...prev, telefone: maskPhone(e.target.value) }))}
                        placeholder="(00) 00000-0000"
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                        value={form.email}
                        onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
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
                            value={form.cep}
                            onChange={e => setForm(prev => ({ ...prev, cep: maskCep(e.target.value) }))}
                            onBlur={handleCepBlur}
                            onKeyDown={e => e.key === "Enter" && handleCepBlur()}
                            placeholder="00000-000"
                            maxLength={9}
                            className="h-8 text-sm flex-1"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleCepBlur}
                            disabled={cepLoading || form.cep.replace(/\D/g, "").length !== 8}
                            title="Buscar endereço pelo CEP"
                        >
                            {cepLoading ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            ) : (
                                <MapPin className="h-3 w-3" />
                            )}
                        </Button>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Endereço</Label>
                    <Input value={form.endereco} onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))} disabled={cepLoading} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Número</Label>
                    <Input value={form.numero} onChange={e => setForm(prev => ({ ...prev, numero: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Bairro</Label>
                    <Input value={form.bairro} onChange={e => setForm(prev => ({ ...prev, bairro: e.target.value }))} disabled={cepLoading} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={form.cidade} onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))} disabled={cepLoading} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Input value={form.estado} onChange={e => setForm(prev => ({ ...prev, estado: e.target.value }))} disabled={cepLoading} className="h-8 text-sm" maxLength={2} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Complemento</Label>
                    <Input value={form.complemento} onChange={e => setForm(prev => ({ ...prev, complemento: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                        value={form.observacoes}
                        onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                        placeholder="Notas livres..."
                        rows={2}
                        className="text-sm"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={!form.nome.trim() || loading}>
                    {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    Salvar
                </Button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}
