
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Settings, ShieldAlert, Server, FileSearch, Smartphone, Clock, Recycle, Mail, Shield, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
    const router = useRouter();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
                <p className="text-muted-foreground">
                    Selecione um módulo para gerenciar.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/admin/users">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Usuários
                            </CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Gestão</div>
                            <p className="text-xs text-muted-foreground">
                                Criar, editar e gerenciar acessos
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/sectors">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Setores
                            </CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Grupos</div>
                            <p className="text-xs text-muted-foreground">
                                Definir áreas e agrupamentos de acesso
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/service-types">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tipos de Serviço
                            </CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Agendamento</div>
                            <p className="text-xs text-muted-foreground">
                                Configurar tipos dinâmicos de serviço
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/agendamentos">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Slots de Agendamento
                            </CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Slots</div>
                            <p className="text-xs text-muted-foreground">
                                Gerenciar janelas de tempo disponíveis
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/legacy">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Legado
                            </CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">API Histórica</div>
                            <p className="text-xs text-muted-foreground">
                                Consultar e monitorar os dados legados
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Card onClick={() => router.push('/admin/settings')} className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Configurações
                        </CardTitle>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Sistema</div>
                        <p className="text-xs text-muted-foreground">
                            Parâmetros globais e dispositivo
                        </p>
                    </CardContent>
                </Card>

                <Link href="/admin/inspector">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Inspetor
                            </CardTitle>
                            <FileSearch className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Dados</div>
                            <p className="text-xs text-muted-foreground">
                                Parquet de rede e schema SQLite local
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/exportar-mobile">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Exportar Mobile
                            </CardTitle>
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">APK</div>
                            <p className="text-xs text-muted-foreground">
                                Exportar dados para provisionar app mobile
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/prazos">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tipos de Prazo
                            </CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Ouvidoria</div>
                            <p className="text-xs text-muted-foreground">
                                Configurar prazos para manifestações
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/residuos">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tipos de Resíduo
                            </CardTitle>
                            <Recycle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Logística</div>
                            <p className="text-xs text-muted-foreground">
                                Classificar resíduos para coleta
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/email">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                E-mail
                            </CardTitle>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">SMTP</div>
                            <p className="text-xs text-muted-foreground">
                                Configurar servidor de envio de e-mails
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/perfis">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Perfis
                            </CardTitle>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Hierarquia</div>
                            <p className="text-xs text-muted-foreground">
                                Configurar níveis de acesso e permissões
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/seguranca/chaves">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Chaves de Sync
                            </CardTitle>
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Segurança</div>
                            <p className="text-xs text-muted-foreground">
                                Rotacionar e recuperar o salt de sincronização
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Card className="opacity-60 cursor-not-allowed">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Logs
                        </CardTitle>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Auditoria</div>
                        <p className="text-xs text-muted-foreground">
                            Histórico de ações (Em breve)
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
