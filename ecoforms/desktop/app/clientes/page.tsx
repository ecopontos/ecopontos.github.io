"use client";

import { useState } from "react";
import { Users, Search, Plus, FileSpreadsheet, Ban, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useClientes } from "@/src/interface/hooks/catalog/clientes";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import type { Cliente } from "@/types/clientes";
import { ClienteCsvImport } from "@/components/clientes/ClienteCsvImport";
import { toast } from "sonner";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const { data: clientes, loading, refetch } = useClientes({ searchTerm: search || undefined });
  const { toggleAtivo, loading: toggling } = useClienteMutations();

  const handleToggleAtivo = async (c: Cliente) => {
    try {
      await toggleAtivo(c.id, c.ativo);
      toast.success(c.ativo ? "Cliente desativado" : "Cliente ativado");
      refetch();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestão unificada de pessoas físicas e jurídicas</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, documento, email ou telefone..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Link href="/clientes/novo">
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Importar CSV
              </Button>
            </div>
          </div>
          <CardDescription>{clientes.length} cliente(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c: Cliente) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link href={`/clientes/${c.id}`} className="block">{c.nome}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.tipo === "PF" ? "secondary" : "default"}>{c.tipo}</Badge>
                      </TableCell>
                      <TableCell>{c.categoria || "—"}</TableCell>
                      <TableCell>{c.documento || "—"}</TableCell>
                      <TableCell>{c.telefone || "—"}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>
                        {[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={c.ativo ? "default" : "outline"}>
                            {c.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.preventDefault(); handleToggleAtivo(c); }}
                            title={c.ativo ? "Desativar" : "Ativar"}
                            disabled={toggling}
                          >
                            {c.ativo
                              ? <Ban className="h-3 w-3 text-red-500" />
                              : <CheckCircle className="h-3 w-3 text-green-500" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClienteCsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={() => refetch()}
      />
    </div>
  );
}
