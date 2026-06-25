"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uuidv7 } from 'ecoforms-core';
import { useManifestacaoMutations } from "@/src/interface/hooks/catalog/manifestacoes";
import { useManifestacaoCatalogos } from "@/src/interface/hooks/catalog/manifestacoes";
import { useSetores } from "@/src/interface/hooks/catalog/auth";
import { ClientePhoneSearch } from "@/components/clientes/ClientePhoneSearch";
import { toast } from "sonner";
import { maskPhone, digitsOnly } from "@/src/lib/phone";

type SelectedCliente = {
  id: string;
  nome: string;
  tipo: "PF" | "PJ";
  categoria?: string | null;
  bairro?: string | null;
  email?: string | null;
  telefone?: string | null;
  viaContato?: string;
};

export default function NovaManifestacaoPage() {
  const router = useRouter();
  const { save, loading } = useManifestacaoMutations();
  const { tipos, origens, classificacoes, situacoes, loading: catLoading, seedTipos } = useManifestacaoCatalogos();
  const { data: setores, loading: setoresLoading } = useSetores();
  const [selectedCliente, setSelectedCliente] = useState<SelectedCliente | null>(null);
  const [form, setForm] = useState({
    tipo_id: "",
    origem_id: "",
    classificacao_id: "",
    situacao_id: "",
    setor_id: "",
    solicitante_nome: "",
    solicitante_email: "",
    solicitante_telefone: "",
    assunto: "",
    descricao: "",
    status: "aberta",
    prioridade: "normal",
    anonimo: 0,
    sigiloso: 0,
  });

  const handleSubmit = async () => {
    if (!form.assunto) { toast.error("Assunto é obrigatório"); return; }
    if (!form.tipo_id || !form.origem_id || !form.situacao_id) { toast.error("Tipo, Origem e Situação são obrigatórios"); return; }
    try {
      await save({
        id: uuidv7(),
        ...form,
        cliente_id: selectedCliente?.id || null,
      });
      toast.success("Manifestação criada");
      router.push("/manifestacoes");
    } catch {
      toast.error("Erro ao criar manifestação");
    }
  };

  const SelectField = ({ label, value, onChange, options, required, loading: fieldLoading, emptyAction }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; nome: string }[]; required?: boolean; loading?: boolean; emptyAction?: { label: string; onClick: () => void | Promise<void> } }) => (
    <div className="space-y-2">
      <Label>{label}{required ? " *" : ""}</Label>
      {fieldLoading ? (
        <div className="w-full border rounded-md px-3 py-2 bg-background text-muted-foreground">Carregando...</div>
      ) : options.length === 0 && emptyAction ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Nenhum {label.toLowerCase()} cadastrado.</span>
          <Button size="sm" variant="outline" onClick={emptyAction.onClick}>{emptyAction.label}</Button>
        </div>
      ) : (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={fieldLoading} className="w-full border rounded-md px-3 py-2 bg-background">
          <option value="">Selecione...</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manifestacoes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nova Manifestação</h1>
          <p className="text-sm text-muted-foreground">Registrar nova manifestação de ouvidoria</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados da Manifestação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Tipo" value={form.tipo_id} onChange={v => setForm({ ...form, tipo_id: v })} options={tipos} required emptyAction={{ label: 'Criar tipos padrão', onClick: seedTipos }} />
          <SelectField label="Origem" value={form.origem_id} onChange={v => setForm({ ...form, origem_id: v })} options={origens} required />
          <SelectField label="Classificação" value={form.classificacao_id} onChange={v => setForm({ ...form, classificacao_id: v })} options={classificacoes} />
          <SelectField label="Situação" value={form.situacao_id} onChange={v => setForm({ ...form, situacao_id: v })} options={situacoes} required />
          <SelectField label="Setor Responsável" value={form.setor_id} onChange={v => setForm({ ...form, setor_id: v })} options={setores} loading={setoresLoading} />
          <div className="md:col-span-2">
            <ClientePhoneSearch
              selected={selectedCliente}
              onSelect={(c) => {
                setSelectedCliente(c);
                if (c) {
                  setForm(f => ({
                    ...f,
                    solicitante_nome: f.solicitante_nome || c.nome,
                    solicitante_email: f.solicitante_email || c.email || "",
                    solicitante_telefone: f.solicitante_telefone || digitsOnly(c.telefone || ""),
                  }));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Solicitante</Label>
            <Input value={form.solicitante_nome} onChange={e => setForm({ ...form, solicitante_nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email do Solicitante</Label>
            <Input type="email" value={form.solicitante_email} onChange={e => setForm({ ...form, solicitante_email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone do Solicitante</Label>
            <Input
              value={maskPhone(form.solicitante_telefone)}
              onChange={e => setForm({ ...form, solicitante_telefone: digitsOnly(e.target.value) })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })} className="w-full border rounded-md px-3 py-2 bg-background">
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
              <option value="critico">Crítico</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.anonimo === 1} onChange={e => setForm({ ...form, anonimo: e.target.checked ? 1 : 0 })} />
              <span className="text-sm">Anônimo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.sigiloso === 1} onChange={e => setForm({ ...form, sigiloso: e.target.checked ? 1 : 0 })} />
              <span className="text-sm">Sigiloso</span>
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Assunto *</Label>
            <Input value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/manifestacoes"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={handleSubmit} disabled={loading || catLoading || setoresLoading}><Save className="h-4 w-4 mr-2" />Salvar</Button>
      </div>
    </div>
  );
}
