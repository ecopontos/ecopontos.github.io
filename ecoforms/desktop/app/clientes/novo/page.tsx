"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { ArrowLeft, Save, User, MapPin, NotebookText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import { categoriasPorTipo, type CategoriaCliente, type Cliente } from "@/types/clientes";
import { maskCep, fetchCep } from "@/src/lib/cep";
import { geocodeFromCep } from "@/src/lib/geocoding";

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

export default function NovoClientePage() {
  const { save, loading } = useClienteMutations();
  const router = useRouter();
  const [cepLoading, setCepLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
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
    latitude: null as number | null,
    longitude: null as number | null,
    territorial: "",
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
      toast.success("Endereço encontrado");
    } else {
      toast.error("CEP não encontrado");
    }
  };

  const handleGeocode = async () => {
    if (!form.endereco && !form.cep) {
      toast.error("Preencha o endereço ou CEP primeiro");
      return;
    }
    setGeoLoading(true);
    const result = await geocodeFromCep(form.cep, form.endereco, form.numero || null, form.bairro || null, form.cidade || null, form.estado || null);
    setGeoLoading(false);
    if (result) {
      setForm(prev => ({
        ...prev,
        latitude: result.latitude,
        longitude: result.longitude,
      }));
      toast.success("Coordenadas encontradas");
    } else {
      toast.error("Não foi possível obter as coordenadas");
    }
  };

  const handleSubmit = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const docDigits = form.documento.replace(/\D/g, "");
    if (form.tipo === "PF" && docDigits.length !== 11) { toast.error("CPF inválido"); return; }
    if (form.tipo === "PJ" && docDigits.length !== 14) { toast.error("CNPJ inválido"); return; }
    try {
      const now = new Date().toISOString();
      const cliente: Cliente = {
        id: uuidv7(),
        tipo: form.tipo,
        categoria: form.categoria || null,
        nome: form.nome,
        documento: form.documento || null,
        email: form.email || null,
        telefone: form.telefone || null,
        cep: form.cep || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        complemento: form.complemento || null,
        observacoes: form.observacoes || null,
        latitude: form.latitude,
        longitude: form.longitude,
        territorial: form.territorial || null,
        ativo: 1,
        criado_em: now,
        atualizado_em: now,
      };
      await save(cliente);
      toast.success("Cliente criado");
      router.push("/clientes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar cliente");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Novo Cliente</h1>
          <p className="text-sm text-muted-foreground">Cadastrar novo cliente PF ou PJ</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do Cliente</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as "PF" | "PJ" })} className="w-full border rounded-md px-3 py-2">
              <option value="PJ">Pessoa Jurídica</option>
              <option value="PF">Pessoa Física</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <select
              value={form.categoria}
              onChange={e => setForm({ ...form, categoria: e.target.value as CategoriaCliente })}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="">Selecione...</option>
              {categoriasPorTipo(form.tipo).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label><User className="h-4 w-4 inline mr-1" />Nome *</Label>
            <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Documento {form.tipo === "PJ" ? "(CNPJ)" : "(CPF)"}</Label>
            <Input value={form.documento} onChange={e => setForm({ ...form, documento: maskDocument(e.target.value, form.tipo) })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={e => setForm({ ...form, telefone: maskPhone(e.target.value) })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="md:col-span-2 mt-6 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Endereço</span>
            </div>
            <hr className="mt-2 border-border/50" />
          </div>

          <div className="space-y-2">
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input
                value={form.cep}
                onChange={e => setForm({ ...form, cep: maskCep(e.target.value) })}
                onBlur={handleCepBlur}
                onKeyDown={e => e.key === "Enter" && handleCepBlur()}
                placeholder="00000-000"
                maxLength={9}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCepBlur}
                disabled={cepLoading || form.cep.replace(/\D/g, "").length !== 8}
                title="Buscar endereço pelo CEP"
              >
                {cepLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} disabled={cepLoading} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} disabled={cepLoading} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} disabled={cepLoading} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-20" disabled={cepLoading} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label><NotebookText className="h-4 w-4 inline mr-1" />Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Notas livres sobre o cliente..."
              rows={3}
            />
          </div>

          <div className="md:col-span-2 mt-4 mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Geolocalização</span>
            </div>
            <hr className="mt-2 border-border/50" />
          </div>

          <div className="space-y-2">
            <Label>Territorial (ID Imóvel)</Label>
            <Input value={form.territorial} onChange={e => setForm({ ...form, territorial: e.target.value })} placeholder="ID do imóvel na prefeitura" />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={form.latitude?.toString() || ""} onChange={e => setForm({ ...form, latitude: e.target.value ? Number(e.target.value) : null })} placeholder="-23.550520" type="number" step="any" />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <div className="flex gap-2">
              <Input value={form.longitude?.toString() || ""} onChange={e => setForm({ ...form, longitude: e.target.value ? Number(e.target.value) : null })} placeholder="-46.633308" type="number" step="any" className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocode}
                disabled={geoLoading || (!form.endereco && !form.cep)}
                title="Buscar coordenadas pelo endereço"
              >
                {geoLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <MapPin className="h-4 w-4 mr-1" />
                )}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/clientes"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={handleSubmit} disabled={loading}><Save className="h-4 w-4 mr-2" />Salvar</Button>
      </div>
    </div>
  );
}
