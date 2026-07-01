"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useServiceTypes } from "@/src/interface/hooks/catalog/service";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import type { Setor } from "@/src/domain/setor/Setor";

function SetorBadge({ setorId, setores }: { setorId: string | null | undefined; setores: Setor[] }) {
    if (!setorId) return null;
    const setor = setores.find(s => s.id === setorId);
    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {setor?.nome ?? setorId}
        </Badge>
    );
}

export default function ServiceTypesAdminPage() {
    const { user } = useAuth();
    const { types, loading } = useServiceTypes(user?.id);
    const [setores, setSetores] = useState<Setor[]>([]);

    useEffect(() => {
        getContainerAsync().then(c => c.setorRepository.findAll()).then(setSetores).catch(() => {});
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tipos de Serviço</h1>
                    <p className="text-muted-foreground">
                        Gerencie os tipos de serviço disponíveis para agendamento.
                    </p>
                </div>
                <Link href="/admin/service-types/novo">
                    <Button><Plus className="mr-2 h-4 w-4" />Novo Tipo</Button>
                </Link>
            </div>

            {loading && <p>Carregando...</p>}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {types.map(type => (
                    <Card key={type.id} className="hover:bg-gray-50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <span className="text-lg">{type.icone ?? '🔧'}</span>
                                {type.nome}
                            </CardTitle>
                            <Badge variant={type.ativo ? "default" : "secondary"}>
                                {type.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground mb-2">
                                {type.descricao ?? 'Sem descrição'}
                            </p>
                            <div className="flex flex-wrap gap-1 text-xs mb-3">
                                <SetorBadge setorId={type.setorId} setores={setores} />
                                {type.formId && <Badge variant="outline">Form: {type.formId}</Badge>}
                                {type.validatorKey && <Badge variant="outline">Validator: {type.validatorKey}</Badge>}
                                {type.requerFotos && <Badge variant="outline">📷 Fotos</Badge>}
                                {type.bairrosObrigatorios && <Badge variant="outline">📍 Bairros</Badge>}
                                {type.capacidadePadrao && <Badge variant="outline">Cap: {type.capacidadePadrao}</Badge>}
                            </div>
                            <Link href={`/admin/service-types/detalhe?id=${type.id}`}>
                                <Button size="sm" variant="outline" className="w-full">Editar</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
