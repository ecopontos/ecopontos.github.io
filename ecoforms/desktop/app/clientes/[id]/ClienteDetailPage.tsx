"use client";

import { useState } from "react";
import { useRouteParamOrQuery } from "@/src/interface/hooks/routing/useRouteParamOrQuery";
import { ArrowLeft, Plus, Trash2, Save, User, Phone, Mail, MapPin, Building, Link2, Unlink, NotebookText, Ban, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClienteById, usePfContactsByPj, usePfUnassigned, usePjByPfId, usePjUnassignedToPf } from "@/src/interface/hooks/catalog/clientes";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import type { Cliente } from "@/types/clientes";
import { categoriasPorTipo, type CategoriaCliente, FUNCOES_VINCULO } from "@/types/clientes";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import { maskCep, fetchCep } from "@/src/lib/cep";
import { geocodeFromCep } from "@/src/lib/geocoding";
import { formatGeocodeProvenance } from "@/src/lib/geocodeProvenance";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 14);
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);
}

function maskDocument(value: string, tipo: "PF" | "PJ") {
  const digits = value.replace(/\D/g, "");
  if (tipo === "PF") {
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
  }
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2").slice(0, 18);
}

export default function ClienteDetailPage() {
  const id = useRouteParamOrQuery("id");
  const { cliente, loading } = useClienteById(id);
  const { data: contatos, loading: loadingContatos, refetch: refetchContatos } = usePfContactsByPj(id);
  const { data: pfDisponiveis, loading: loadingDisponiveis, refetch: refetchDisponiveis } = usePfUnassigned();
  const { data: pjVinculados, loading: loadingPjVinculados, refetch: refetchPjVinculados } = usePjByPfId(id);
  const { data: pjDisponiveis, loading: loadingPjDisponiveis, refetch: refetchPjDisponiveis } = usePjUnassignedToPf(id);
  const { save, linkPfToPj, unlinkPfFromPj, updateVinculoFuncao, toggleAtivo, loading: saving } = useClienteMutations();

  const [editMode, setEditMode] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [showAddContato, setShowAddContato] = useState(false);
  const [showSelectContato, setShowSelectContato] = useState(false);
  const [novoContato, setNovoContato] = useState({
    nome: "",
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
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchPf, setSearchPf] = useState("");
  const [showLinkPj, setShowLinkPj] = useState(false);
  const [searchPj, setSearchPj] = useState("");
  const [unlinkPjTarget, setUnlinkPjTarget] = useState<{ pfId: string; pjId: string; nome: string } | null>(null);
  const [linkFuncao, setLinkFuncao] = useState("");

  if (loading) return <p className="p-8">Carregando...</p>;
  if (!cliente) return <p className="p-8">Cliente não encontrado.</p>;

  const isPj = cliente.tipo === "PJ";

  const handleEdit = () => {
    setForm({ ...cliente });
    setEditMode(true);
  };

  const handleSave = async () => {
    try {
      await save({ ...cliente, ...form } as Cliente);
      toast.success("Cliente atualizado");
      setEditMode(false);
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleToggleAtivo = async () => {
    try {
      await toggleAtivo(cliente.id, cliente.ativo);
      toast.success(cliente.ativo ? "Cliente desativado" : "Cliente ativado");
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleCepBlur = async () => {
    const digits = novoContato.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    const data = await fetchCep(novoContato.cep);
    setCepLoading(false);
    if (data) {
      setNovoContato(prev => ({
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

  const handleEditCepBlur = async () => {
    const digits = (form.cep || "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    const data = await fetchCep(form.cep || "");
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
    if (!(form.endereco || cliente.endereco) && !(form.cep || cliente.cep)) {
      toast.error("Preencha o endereço ou CEP primeiro");
      return;
    }
    setGeoLoading(true);
    const result = await geocodeFromCep(
      form.cep || cliente.cep || "",
      form.endereco || cliente.endereco || "",
      form.numero || cliente.numero || null,
      form.bairro || cliente.bairro || null,
      form.cidade || cliente.cidade || null,
      form.estado || cliente.estado || null,
    );
    setGeoLoading(false);
    if (result) {
      setForm(prev => ({
        ...prev,
        latitude: result.latitude,
        longitude: result.longitude,
        geocode_provider: result.provider ?? "nominatim",
        geocode_source_query: result.source_query ?? null,
        geocode_display_name: result.display_name ?? null,
        geocode_precision: result.precision ?? null,
        geocode_at: new Date().toISOString(),
      }));
      toast.success("Coordenadas encontradas");
    } else {
      toast.error("Não foi possível obter as coordenadas");
    }
  };

  /** Usuário digitou lat/lng manualmente em modo de edição — marca proveniência como manual. */
  const handleManualLatChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      latitude: value ? Number(value) : null,
      geocode_provider: "manual",
      geocode_precision: "manual",
      geocode_source_query: null,
      geocode_display_name: null,
      geocode_at: new Date().toISOString(),
    }));
  };

  const handleManualLngChange = (value: string) => {
    setForm(prev => ({
      ...prev,
      longitude: value ? Number(value) : null,
      geocode_provider: "manual",
      geocode_precision: "manual",
      geocode_source_query: null,
      geocode_display_name: null,
      geocode_at: new Date().toISOString(),
    }));
  };

  const handleAddContato = async () => {
    if (!novoContato.nome) { toast.error("Nome é obrigatório"); return; }
    const docDigits = novoContato.documento.replace(/\D/g, "");
    if (docDigits.length !== 11) { toast.error("CPF inválido"); return; }
    try {
      const pfId = uuidv7();
      const now = new Date().toISOString();
      await save({
        id: pfId,
        tipo: "PF",
        categoria: null,
        nome: novoContato.nome,
        documento: novoContato.documento,
        email: novoContato.email || null,
        telefone: novoContato.telefone || null,
        cep: novoContato.cep || null,
        endereco: novoContato.endereco || null,
        numero: novoContato.numero || null,
        bairro: novoContato.bairro || null,
        cidade: novoContato.cidade || null,
        estado: novoContato.estado || null,
        complemento: novoContato.complemento || null,
        pj_id: cliente.id,
        ativo: 1,
        criado_em: now,
        atualizado_em: now,
      } as Cliente);
      await linkPfToPj(pfId, cliente.id);
      toast.success("Contato adicionado");
      setShowAddContato(false);
      setNovoContato({ nome: "", documento: "", email: "", telefone: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", complemento: "" });
      refetchContatos();
      refetchDisponiveis();
    } catch {
      toast.error("Erro ao adicionar contato");
    }
  };

  const handleLinkPf = async (pfId: string) => {
    try {
      await linkPfToPj(pfId, cliente.id);
      toast.success("Contato vinculado");
      setShowSelectContato(false);
      refetchContatos();
      refetchDisponiveis();
    } catch {
      toast.error("Erro ao vincular contato");
    }
  };

  const handleLinkPj = async (pjId: string) => {
    try {
      await linkPfToPj(cliente.id, pjId, linkFuncao || null);
      toast.success("Condomínio vinculado");
      setShowLinkPj(false);
      setLinkFuncao("");
      setSearchPj("");
      refetchPjVinculados();
      refetchPjDisponiveis();
    } catch {
      toast.error("Erro ao vincular condomínio");
    }
  };

  const handleUnlinkPj = (pjId: string, pjNome: string) => {
    setUnlinkPjTarget({ pfId: cliente.id, pjId, nome: pjNome });
  };

  const confirmUnlinkPj = async () => {
    if (!unlinkPjTarget) return;
    try {
      await unlinkPfFromPj(unlinkPjTarget.pfId, unlinkPjTarget.pjId);
      toast.success("Condomínio desvinculado");
      refetchPjVinculados();
      refetchPjDisponiveis();
    } catch {
      toast.error("Erro ao desvincular condomínio");
    } finally {
      setUnlinkPjTarget(null);
    }
  };

  const handleUnlinkPf = (pfId: string) => {
    setUnlinkTarget(pfId);
  };

  const confirmUnlinkPf = async () => {
    if (!unlinkTarget) return;
    try {
      await unlinkPfFromPj(unlinkTarget, cliente.id);
      toast.success("Contato desvinculado");
      refetchContatos();
      refetchDisponiveis();
    } catch {
      toast.error("Erro ao desvincular contato");
    } finally {
      setUnlinkTarget(null);
    }
  };

  const pfFiltrados = searchPf
    ? pfDisponiveis.filter((p: Cliente) =>
        p.nome.toLowerCase().includes(searchPf.toLowerCase()) ||
        (p.documento && p.documento.includes(searchPf)) ||
        (p.email && p.email.toLowerCase().includes(searchPf.toLowerCase()))
      )
    : pfDisponiveis;

  const pjFiltrados = searchPj
    ? pjDisponiveis.filter((p: Cliente) =>
        p.nome.toLowerCase().includes(searchPj.toLowerCase()) ||
        (p.documento && p.documento.includes(searchPj)) ||
        (p.cidade && p.cidade.toLowerCase().includes(searchPj.toLowerCase()))
      )
    : pjDisponiveis;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cliente.nome}</h1>
          <p className="text-sm text-muted-foreground">{cliente.documento || "Sem documento"}</p>
        </div>
        <Badge variant={cliente.ativo ? "default" : "outline"}>{cliente.ativo ? "Ativo" : "Inativo"}</Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleAtivo}
          title={cliente.ativo ? "Desativar cliente" : "Ativar cliente"}
          className={cliente.ativo ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"}
          disabled={saving}
        >
          {cliente.ativo ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
        </Button>
        {!editMode ? (
          <Button onClick={handleEdit} variant="outline">Editar</Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        )}
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          {isPj && <TabsTrigger value="contatos">Contatos ({contatos.length})</TabsTrigger>}
          {!isPj && <TabsTrigger value="vinculos">Condomínios / PJ ({pjVinculados.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Informações Gerais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label><User className="h-4 w-4 inline mr-1" />Nome</Label>
                {editMode ? (
                  <Input value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} />
                ) : (
                  <p>{cliente.nome}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label><Building className="h-4 w-4 inline mr-1" />Tipo</Label>
                {editMode ? (
                  <select
                    value={form.tipo || ""}
                    onChange={e => setForm({ ...form, tipo: e.target.value as "PF" | "PJ" })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="PJ">Pessoa Jurídica</option>
                    <option value="PF">Pessoa Física</option>
                  </select>
                ) : (
                  <p>{cliente.tipo}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                {editMode ? (
                  <select
                    value={form.categoria || ""}
                    onChange={e => setForm({ ...form, categoria: e.target.value as CategoriaCliente })}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">Selecione...</option>
                    {categoriasPorTipo(form.tipo || "PJ").map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <p>{cliente.categoria || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Documento {(form.tipo || cliente.tipo) === "PJ" ? "(CNPJ)" : "(CPF)"}</Label>
                {editMode ? (
                  <Input value={form.documento || ""} onChange={e => setForm({ ...form, documento: maskDocument(e.target.value, (form.tipo || cliente.tipo) as "PF" | "PJ") })} />
                ) : (
                  <p>{cliente.documento || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label><Phone className="h-4 w-4 inline mr-1" />Telefone</Label>
                {editMode ? (
                  <Input value={form.telefone || ""} onChange={e => setForm({ ...form, telefone: e.target.value })} />
                ) : (
                  <p>{cliente.telefone || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label><Mail className="h-4 w-4 inline mr-1" />Email</Label>
                {editMode ? (
                  <Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
                ) : (
                  <p>{cliente.email || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label><MapPin className="h-4 w-4 inline mr-1" />CEP</Label>
                {editMode ? (
                  <div className="flex gap-2">
                    <Input
                      value={form.cep || ""}
                      onChange={e => setForm({ ...form, cep: maskCep(e.target.value) })}
                      onBlur={handleEditCepBlur}
                      onKeyDown={e => e.key === "Enter" && handleEditCepBlur()}
                      placeholder="00000-000"
                      maxLength={9}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleEditCepBlur}
                      disabled={cepLoading || (form.cep || "").replace(/\D/g, "").length !== 8}
                      title="Buscar endereço pelo CEP"
                    >
                      {cepLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p>{cliente.cep || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                {editMode ? (
                  <Input value={form.endereco || ""} onChange={e => setForm({ ...form, endereco: e.target.value })} />
                ) : (
                  <p>{cliente.endereco || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                {editMode ? (
                  <Input value={form.numero || ""} onChange={e => setForm({ ...form, numero: e.target.value })} />
                ) : (
                  <p>{cliente.numero || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                {editMode ? (
                  <Input value={form.bairro || ""} onChange={e => setForm({ ...form, bairro: e.target.value })} />
                ) : (
                  <p>{cliente.bairro || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                {editMode ? (
                  <Input value={form.cidade || ""} onChange={e => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" />
                ) : (
                  <p>{cliente.cidade || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                {editMode ? (
                  <Input value={form.estado || ""} onChange={e => setForm({ ...form, estado: e.target.value })} placeholder="UF" className="w-20" />
                ) : (
                  <p>{cliente.estado || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                {editMode ? (
                  <Input value={form.complemento || ""} onChange={e => setForm({ ...form, complemento: e.target.value })} />
                ) : (
                  <p>{cliente.complemento || "—"}</p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label><NotebookText className="h-4 w-4 inline mr-1" />Observações</Label>
                {editMode ? (
                  <Textarea
                    value={form.observacoes || ""}
                    onChange={e => setForm({ ...form, observacoes: e.target.value })}
                    placeholder="Notas livres sobre o cliente..."
                    rows={3}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{cliente.observacoes || "—"}</p>
                )}
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
                {editMode ? (
                  <Input value={form.territorial || ""} onChange={e => setForm({ ...form, territorial: e.target.value })} placeholder="ID do imóvel na prefeitura" />
                ) : (
                  <p>{cliente.territorial || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                {editMode ? (
                  <Input value={form.latitude?.toString() || ""} onChange={e => handleManualLatChange(e.target.value)} placeholder="-23.550520" type="number" step="any" />
                ) : (
                  <p>{cliente.latitude ?? "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                {editMode ? (
                  <div className="flex gap-2">
                    <Input value={form.longitude?.toString() || ""} onChange={e => handleManualLngChange(e.target.value)} placeholder="-46.633308" type="number" step="any" className="flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeocode}
                      disabled={geoLoading || (!(form.endereco || cliente.endereco) && !(form.cep || cliente.cep))}
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
                ) : (
                  <p>{cliente.longitude ?? "—"}</p>
                )}
              </div>
              {!editMode && (cliente.latitude != null && cliente.longitude != null) && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Fonte da coordenada</Label>
                  <p className="text-sm text-muted-foreground">{formatGeocodeProvenance(cliente)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isPj && (
          <TabsContent value="contatos" className="space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Contatos (Pessoas Físicas)</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Contatos são pessoas físicas vinculadas a esta PJ. Adicione uma nova PF ou vincule uma existente.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowSelectContato(!showSelectContato); setShowAddContato(false); }}>
                    <Link2 className="h-4 w-4 mr-1" />Vincular existente
                  </Button>
                  <Button size="sm" onClick={() => { setShowAddContato(!showAddContato); setShowSelectContato(false); }}>
                    <Plus className="h-4 w-4 mr-1" />Nova PF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showAddContato && (
                  <div className="mb-4 p-4 border rounded-md bg-muted/30 space-y-4">
                    <h3 className="font-medium">Nova Pessoa Física</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input value={novoContato.nome} onChange={e => setNovoContato({ ...novoContato, nome: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input value={novoContato.documento} onChange={e => setNovoContato({ ...novoContato, documento: maskDocument(e.target.value, "PF") })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input value={novoContato.telefone} onChange={e => setNovoContato({ ...novoContato, telefone: maskPhone(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={novoContato.email} onChange={e => setNovoContato({ ...novoContato, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <div className="flex gap-2">
                          <Input
                            value={novoContato.cep}
                            onChange={e => setNovoContato({ ...novoContato, cep: maskCep(e.target.value) })}
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
                            disabled={cepLoading || novoContato.cep.replace(/\D/g, "").length !== 8}
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
                        <Input value={novoContato.endereco} onChange={e => setNovoContato({ ...novoContato, endereco: e.target.value })} disabled={cepLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input value={novoContato.numero} onChange={e => setNovoContato({ ...novoContato, numero: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input value={novoContato.bairro} onChange={e => setNovoContato({ ...novoContato, bairro: e.target.value })} disabled={cepLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input value={novoContato.cidade} onChange={e => setNovoContato({ ...novoContato, cidade: e.target.value })} disabled={cepLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input value={novoContato.estado} onChange={e => setNovoContato({ ...novoContato, estado: e.target.value })} className="w-20" disabled={cepLoading} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setShowAddContato(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleAddContato} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
                    </div>
                  </div>
                )}

                {showSelectContato && (
                  <div className="mb-4 p-4 border rounded-md bg-muted/30 space-y-3">
                    <h3 className="font-medium">Vincular Pessoa Física Existente</h3>
                    <Input
                      placeholder="Buscar por nome, CPF ou email..."
                      value={searchPf}
                      onChange={e => setSearchPf(e.target.value)}
                    />
                    {loadingDisponiveis ? (
                      <p>Carregando...</p>
                    ) : pfFiltrados.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma PF disponível.</p>
                    ) : (
                      <div className="rounded-md border max-h-64 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pfFiltrados.map((p: Cliente) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.nome}</TableCell>
                                <TableCell>{p.documento || "—"}</TableCell>
                                <TableCell>{p.telefone || "—"}</TableCell>
                                <TableCell>{p.email || "—"}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => handleLinkPf(p.id)} disabled={saving}>
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setShowSelectContato(false)}>Fechar</Button>
                    </div>
                  </div>
                )}

                {loadingContatos ? (
                  <p>Carregando...</p>
                ) : contatos.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum contato vinculado.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contatos.map((c: Cliente) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              <Link href={`/clientes/detalhe?id=${c.id}`} className="hover:underline">{c.nome}</Link>
                            </TableCell>
                            <TableCell>{c.documento || "—"}</TableCell>
                            <TableCell>{c.telefone || "—"}</TableCell>
                            <TableCell>{c.email || "—"}</TableCell>
                            <TableCell>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => handleUnlinkPf(c.id)} title="Desvincular">
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!isPj && (
          <TabsContent value="vinculos" className="space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Condomínios / Pessoas Jurídicas</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    PJ às quais esta pessoa está vinculada (síndico, zelador, etc.).
                  </p>
                </div>
                <Button size="sm" onClick={() => { setShowLinkPj(!showLinkPj); setSearchPj(""); }}>
                  <Plus className="h-4 w-4 mr-1" />Vincular PJ
                </Button>
              </CardHeader>
              <CardContent>
                {showLinkPj && (
                  <div className="mb-4 p-4 border rounded-md bg-muted/30 space-y-3">
                    <h3 className="font-medium">Vincular Pessoa Jurídica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Buscar por nome, CNPJ ou cidade..."
                        value={searchPj}
                        onChange={e => setSearchPj(e.target.value)}
                      />
                      <select
                        value={linkFuncao}
                        onChange={e => setLinkFuncao(e.target.value)}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option value="">Função (opcional)</option>
                        {FUNCOES_VINCULO.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    {loadingPjDisponiveis ? (
                      <p>Carregando...</p>
                    ) : pjFiltrados.length === 0 ? (
                      <p className="text-muted-foreground">Nenhuma PJ disponível.</p>
                    ) : (
                      <div className="rounded-md border max-h-64 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>CNPJ</TableHead>
                              <TableHead>Cidade/UF</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pjFiltrados.map((p: Cliente) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.nome}</TableCell>
                                <TableCell>{p.documento || "—"}</TableCell>
                                <TableCell>{[p.cidade, p.estado].filter(Boolean).join(" / ") || "—"}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => handleLinkPj(p.id)} disabled={saving}>
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setShowLinkPj(false); setSearchPj(""); setLinkFuncao(""); }}>Fechar</Button>
                    </div>
                  </div>
                )}

                {loadingPjVinculados ? (
                  <p>Carregando...</p>
                ) : pjVinculados.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum condomínio vinculado.</p>
                ) : (
                  <div className="space-y-3">
                    {pjVinculados.map(v => (
                      <div key={v.id} className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/clientes/detalhe?id=${v.pj_id}`} className="font-medium hover:underline truncate">
                              {v.pj_nome}
                            </Link>
                            {v.funcao && (
                              <Badge variant="secondary" className="text-xs shrink-0">{v.funcao}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {[v.pj_documento, v.pj_cidade, v.pj_estado].filter(Boolean).join(" · ") || "Sem informações"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            value={v.funcao || ""}
                            onChange={async (e) => {
                              try {
                                await updateVinculoFuncao(v.id, e.target.value);
                                toast.success("Função atualizada");
                                refetchPjVinculados();
                              } catch {
                                toast.error("Erro ao atualizar função");
                              }
                            }}
                            className="text-xs border rounded px-1.5 py-1 max-w-[120px]"
                          >
                            <option value="">Sem função</option>
                            {FUNCOES_VINCULO.map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUnlinkPj(v.pj_id, v.pj_nome)} title="Desvincular">
                            <Unlink className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={!!unlinkTarget} onOpenChange={(open) => { if (!open) setUnlinkTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular contato?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlinkPf}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!unlinkPjTarget} onOpenChange={(open) => { if (!open) setUnlinkPjTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular {unlinkPjTarget?.nome}?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlinkPj}>Desvincular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
