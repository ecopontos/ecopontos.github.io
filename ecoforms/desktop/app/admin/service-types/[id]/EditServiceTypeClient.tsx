"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceTypeById, useServiceTypeMutations } from "@/src/interface/hooks/catalog/service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getContainerAsync } from "@/src/interface/hooks/utils/useContainer";
import type { Setor } from "@/src/domain/setor/Setor";

export default function EditServiceTypeClient() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const { type, loading: fetching } = useServiceTypeById(id ?? null);
    const { updateType, loading } = useServiceTypeMutations(user?.id);
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [formId, setFormId] = useState("");
    const [validatorKey, setValidatorKey] = useState("");
    const [requerFotos, setRequerFotos] = useState(false);
    const [bairrosObrigatorios, setBairrosObrigatorios] = useState(false);
    const [requerMapa, setRequerMapa] = useState(false);
    const [capacidadePadrao, setCapacidadePadrao] = useState("");
    const [icone, setIcone] = useState("");
    const [cor, setCor] = useState("");
    const [ativo, setAtivo] = useState(true);
    const [setorId, setSetorId] = useState("");
    const [setores, setSetores] = useState<Setor[]>([]);

    useEffect(() => {
        getContainerAsync().then(c => c.setorRepository.findAtivos()).then(setSetores).catch(() => {});
    }, []);

    const initialized = useRef(false);
    useEffect(() => {
        if (!type || initialized.current) return;
        initialized.current = true;
        setNome(type.nome);
        setDescricao(type.descricao ?? "");
        setFormId(type.formId ?? "");
        setValidatorKey(type.validatorKey ?? "");
        setRequerFotos(type.requerFotos);
        setBairrosObrigatorios(type.bairrosObrigatorios);
        setRequerMapa(type.requerMapa);
        setCapacidadePadrao(type.capacidadePadrao != null ? String(type.capacidadePadrao) : "");
        setIcone(type.icone ?? "");
        setCor(type.cor ?? "");
        setAtivo(type.ativo);
        setSetorId(type.setorId ?? "");
    }, [type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateType({
                id,
                nome,
                descricao: descricao || null,
                formId: formId || null,
                validatorKey: validatorKey || null,
                requerFotos,
                bairrosObrigatorios,
                requerMapa,
                capacidadePadrao: capacidadePadrao ? parseInt(capacidadePadrao) : null,
                icone: icone || null,
                cor: cor || null,
                ativo,
                setorId: setorId && setorId !== "__none__" ? setorId : null,
            });
            router.push("/admin/service-types");
        } catch (err) {
            toast.error("Erro ao salvar: " + (err as Error).message);
        }
    };

    if (fetching || !type) return <div className="p-8 text-muted-foreground">Carregando...</div>;

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/service-types"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Editar Tipo de Serviço</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        {type.icone} {type.nome}
                        <Badge variant={ativo ? "default" : "secondary"}>
                            {ativo ? "Ativo" : "Inativo"}
                        </Badge>
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Dados do Tipo</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome *</Label>
                            <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descricao">Descrição</Label>
                            <Input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="setorId">Setor</Label>
                            <Select value={setorId} onValueChange={setSetorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o setor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Nenhum</SelectItem>
                                    {setores.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                O setor define quais usuários poderão gerenciar agendas deste tipo de serviço.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="formId">Form ID (registro_formularios)</Label>
                            <Input id="formId" value={formId} onChange={e => setFormId(e.target.value)} placeholder="ex: form-agendamento-museu" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validatorKey">Validator Key</Label>
                            <Input id="validatorKey" value={validatorKey} onChange={e => setValidatorKey(e.target.value)} placeholder="ex: museu, volumosos, evento" />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch id="requerFotos" checked={requerFotos} onCheckedChange={setRequerFotos} />
                                <Label htmlFor="requerFotos">Requer Fotos</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="bairrosObrigatorios" checked={bairrosObrigatorios} onCheckedChange={setBairrosObrigatorios} />
                                <Label htmlFor="bairrosObrigatorios">Bairros Obrigatórios</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="requerMapa" checked={requerMapa} onCheckedChange={setRequerMapa} />
                                <Label htmlFor="requerMapa">Requer Mapa</Label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="capacidadePadrao">Capacidade Padrão</Label>
                            <Input id="capacidadePadrao" type="number" value={capacidadePadrao} onChange={e => setCapacidadePadrao(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="icone">Ícone</Label>
                                <Input id="icone" value={icone} onChange={e => setIcone(e.target.value)} placeholder="🏛️" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cor">Cor</Label>
                                <Input id="cor" value={cor} onChange={e => setCor(e.target.value)} placeholder="#3B82F6" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
                            <Label htmlFor="ativo">Tipo ativo</Label>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button type="submit" disabled={loading}>
                                {loading ? "Salvando..." : "Salvar alterações"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.push("/admin/service-types")}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
