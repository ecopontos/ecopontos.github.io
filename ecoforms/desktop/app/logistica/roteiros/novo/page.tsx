"use client";

import { useState } from "react";
import { ArrowLeft, Save, Route } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import { useAuth } from "@/contexts/AuthContext";

const PERIODICIDADES = ["Diária", "Semanal", "Quinzenal", "Mensal"];
const TURNOS = ["Manhã", "Tarde", "Noite", "Integral"];

export default function NovoRoteiroPage() {
  const { user } = useAuth();
  const { saveRoteiro, loading } = useLogisticsMutations();
  const router = useRouter();

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipoResiduo: "",
    periodicidade: "",
    turno: "",
    base: "",
    distrito: "",
  });

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      const now = new Date().toISOString();
      await saveRoteiro({
        id: uuidv7(),
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        tipoResiduo: form.tipoResiduo || null,
        periodicidade: form.periodicidade || null,
        turno: form.turno || null,
        base: form.base || null,
        distrito: form.distrito || null,
        situacao: "ativo",
        criadoPor: user?.id ?? "",
        criadoEm: now,
        atualizadoEm: now,
      });
      toast.success("Roteiro criado");
      router.push("/logistica");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar roteiro");
    }
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/logistica">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6 text-primary" />
            Novo Roteiro
          </h1>
          <p className="text-sm text-muted-foreground">Cadastrar roteiro de coleta</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Roteiro</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Roteiro Centro - Segunda"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Resíduo</Label>
            <Input
              value={form.tipoResiduo}
              onChange={(e) => set("tipoResiduo", e.target.value)}
              placeholder="Ex: Domiciliar, Seletiva..."
            />
          </div>

          <div className="space-y-2">
            <Label>Periodicidade</Label>
            <select
              value={form.periodicidade}
              onChange={(e) => set("periodicidade", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            >
              <option value="">Selecione...</option>
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Turno</Label>
            <select
              value={form.turno}
              onChange={(e) => set("turno", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            >
              <option value="">Selecione...</option>
              {TURNOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Base</Label>
            <Input
              value={form.base}
              onChange={(e) => set("base", e.target.value)}
              placeholder="Garagem / base de saída"
            />
          </div>

          <div className="space-y-2">
            <Label>Distrito</Label>
            <Input
              value={form.distrito}
              onChange={(e) => set("distrito", e.target.value)}
              placeholder="Ex: Zona Norte, Bairro X..."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Observações sobre o roteiro..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/logistica">
          <Button variant="outline">Cancelar</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
