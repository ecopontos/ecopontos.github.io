"use client";

import { useState } from "react";
import { Search, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientePhoneSearch } from "@/src/interface/hooks/catalog/clientes";
import type { Cliente } from "@/types/clientes";
import { maskPhone, digitsOnly } from "@/src/lib/phone";

export interface SelectedCliente {
    id: string;
    nome: string;
    tipo: "PF" | "PJ";
    categoria?: string | null;
    bairro?: string | null;
    email?: string | null;
    telefone?: string | null;
    viaContato?: string;
    endereco?: string | null;
    numero?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    complemento?: string | null;
}

interface ClientePhoneSearchProps {
    onSelect: (cliente: SelectedCliente | null) => void;
    selected: SelectedCliente | null;
}

export function ClientePhoneSearch({ onSelect, selected }: ClientePhoneSearchProps) {
    const [telefone, setTelefone] = useState("");
    const { candidates, loading, searched } = useClientePhoneSearch(selected ? "" : telefone);

    function handleSelect(cliente: Cliente, viaContato?: string) {
        onSelect({
            id: cliente.id,
            nome: cliente.nome,
            tipo: cliente.tipo,
            categoria: cliente.categoria,
            bairro: cliente.bairro,
            email: cliente.email,
            telefone: cliente.telefone,
            viaContato,
            endereco: cliente.endereco,
            numero: cliente.numero,
            cidade: cliente.cidade,
            estado: cliente.estado,
            cep: cliente.cep,
            complemento: cliente.complemento,
        });
        setTelefone("");
    }

    function handleClear() {
        onSelect(null);
        setTelefone("");
    }

    if (selected) {
        return (
            <div className="space-y-2">
                <Label>Cliente vinculado</Label>
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selected.nome}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-xs h-4 px-1">{selected.tipo}</Badge>
                            {selected.categoria && (
                                <span className="text-xs text-muted-foreground">{selected.categoria}</span>
                            )}
                            {selected.bairro && (
                                <span className="text-xs text-muted-foreground">· {selected.bairro}</span>
                            )}
                            {selected.viaContato && (
                                <span className="text-xs text-muted-foreground">via {selected.viaContato}</span>
                            )}
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={handleClear}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <Label>Buscar cliente por telefone</Label>
            <div className="relative">
                {loading ? (
                    <Loader2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                    placeholder="(00) 00000-0000"
                    className="pl-8"
                    value={maskPhone(telefone)}
                    onChange={(e) => setTelefone(digitsOnly(e.target.value))}
                />
            </div>

            {searched && !loading && telefone && (
                <div className="rounded-md border bg-background shadow-sm">
                    {candidates.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Nenhum cliente encontrado com este telefone
                        </div>
                    ) : candidates.length === 1 ? (
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => handleSelect(candidates[0].cliente, candidates[0].viaContato)}
                        >
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{candidates[0].cliente.nome}</p>
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="text-xs h-4 px-1">{candidates[0].cliente.tipo}</Badge>
                                    {candidates[0].cliente.categoria && (
                                        <span className="text-xs text-muted-foreground">{candidates[0].cliente.categoria}</span>
                                    )}
                                    {candidates[0].viaContato && (
                                        <span className="text-xs text-muted-foreground">via {candidates[0].viaContato}</span>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">Selecionar</span>
                        </button>
                    ) : (
                        <div>
                            <p className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                                {candidates.length} clientes encontrados — selecione um:
                            </p>
                            {candidates.map(({ cliente, viaContato }) => (
                                <button
                                    key={cliente.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors border-b last:border-0"
                                    onClick={() => handleSelect(cliente, viaContato)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{cliente.nome}</p>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-xs h-4 px-1">{cliente.tipo}</Badge>
                                            {cliente.categoria && (
                                                <span className="text-xs text-muted-foreground">{cliente.categoria}</span>
                                            )}
                                            {viaContato && (
                                                <span className="text-xs text-muted-foreground">via {viaContato}</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
