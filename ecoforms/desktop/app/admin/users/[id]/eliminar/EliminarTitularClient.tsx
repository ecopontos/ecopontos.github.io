"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRouteParamOrQuery } from "@/src/interface/hooks/routing/useRouteParamOrQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import Link from "next/link";
import type { EliminacaoTitularResult } from "@/src/application/usuario/EliminacaoTitularUseCase";

export default function EliminarTitularClient() {
    const id = useRouteParamOrQuery("id");
    const router = useRouter();
    const { user } = useAuth();

    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EliminacaoTitularResult | null>(null);
    const [fatalError, setFatalError] = useState<string | null>(null);

    const handleEliminar = async () => {
        if (!user || !id) return;
        setLoading(true);
        setFatalError(null);
        try {
            const c = await getContainerAsync();
            const r = await c.eliminacaoTitularUseCase.execute(id, user.perfil);
            setResult(r);
        } catch (e) {
            setFatalError(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedPage permission="users.edit">
            <div className="space-y-6 max-w-xl">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            Eliminação de Dados do Titular
                        </h1>
                        <p className="text-sm text-muted-foreground">LGPD Art. 18, VI — ação irreversível</p>
                    </div>
                </div>

                {!result && (
                    <Card className="border-red-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-red-700">
                                <AlertTriangle className="h-4 w-4" />
                                Atenção: esta ação é permanente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm space-y-1 text-muted-foreground">
                                <p>Serão eliminados todos os dados vinculados ao usuário <code className="font-mono bg-muted px-1 rounded">{id}</code>:</p>
                                <ul className="list-disc list-inside mt-2 space-y-0.5">
                                    <li>Tarefas (criadas e atribuídas)</li>
                                    <li>Agendamentos</li>
                                    <li>Manifestações</li>
                                    <li>Log de ações e log de auditoria</li>
                                    <li>Imagens no Storage</li>
                                    <li>Perfil e conta no Supabase Auth</li>
                                    <li>Registro local (tabela usuários)</li>
                                </ul>
                            </div>

                            <div className="space-y-1.5">
                                <p className="text-sm font-medium">
                                    Para confirmar, digite <strong>ELIMINAR</strong> abaixo:
                                </p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder="ELIMINAR"
                                    className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                                />
                            </div>

                            {fatalError && (
                                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{fatalError}</p>
                            )}

                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="destructive"
                                    disabled={confirmText !== "ELIMINAR" || loading}
                                    onClick={handleEliminar}
                                    className="flex-1"
                                >
                                    {loading
                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando...</>
                                        : <><Trash2 className="mr-2 h-4 w-4" />Eliminar todos os dados</>
                                    }
                                </Button>
                                <Button variant="outline" onClick={() => router.push("/admin/users")}>
                                    Cancelar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {result.erros.length === 0
                                    ? <><CheckCircle2 className="h-4 w-4 text-green-600" />Eliminação concluída</>
                                    : <><AlertTriangle className="h-4 w-4 text-yellow-600" />Concluída com avisos</>
                                }
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="font-medium mb-1">Tabelas limpas:</p>
                                <div className="flex flex-wrap gap-1">
                                    {result.tabelas.map(t => (
                                        <Badge key={t} variant="outline">{t}</Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <StatusRow label="Storage removido" ok={result.storageRemovido} />
                                <StatusRow label="Perfil Supabase removido" ok={result.supabasePerfilRemovido} />
                                <StatusRow label="Auth Supabase removido" ok={result.supabaseAuthRemovido} />
                            </div>
                            {result.erros.length > 0 && (
                                <div className="space-y-1">
                                    <p className="font-medium text-yellow-700">Avisos (não fatais):</p>
                                    {result.erros.map((e, i) => (
                                        <p key={i} className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">{e}</p>
                                    ))}
                                </div>
                            )}
                            <Button className="w-full mt-2" variant="outline" onClick={() => router.push("/admin/users")}>
                                Voltar para usuários
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </ProtectedPage>
    );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            {ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
            <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
        </div>
    );
}
