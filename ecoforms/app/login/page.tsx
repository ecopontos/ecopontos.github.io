"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useTauriInvoke } from "@/src/interface/hooks/catalog/tauri";
import { ConsolePanel } from "@/components/ConsolePanel";
import { FirstRunSetupModal } from "@/components/auth/FirstRunSetupModal";
import { toast } from "sonner";

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [checkingFirstRun, setCheckingFirstRun] = useState(true);
    const invoke = useTauriInvoke();

    useEffect(() => {
        const checkFirstRun = async () => {
            try {
                interface QueryResult {
                    columns: string[];
                    rows: unknown[][];
                }
                const result = await invoke<QueryResult>('db_query', {
                    sql: 'SELECT COUNT(*) as count FROM usuarios',
                    params: []
                });
                const count = result.rows[0]?.[0];
                if (count === 0 || count === '0') {
                    setShowSetup(true);
                }
            } catch (err) {
                // Se a tabela não existir ainda, também mostrar setup
                console.warn('[Login] First-run check failed (tabela pode nao existir):', err);
                setShowSetup(true);
            } finally {
                setCheckingFirstRun(false);
            }
        };
        checkFirstRun();
    }, [invoke]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Check connectivity or offline mode preference
            const isOffline = !navigator.onLine;
            let user: User | null = null;

            // 1. Try Supabase first (if online) -> DISABLED
            /*
            if (navigator.onLine) {
                try {
                    const { data, error: userError } = await supabase
                        .from("usuarios")
                        .select("*")
                        .eq("username", username.trim())
                        .single();

                    if (!userError && data) {
                        user = data;
                    }
                } catch (netError) {
                    console.warn("Supabase unreachable, trying local...", netError);
                }
            }
            */

            // 2. Fallback to Tauri Local SQLite (Desktop Persistence)
            if (!user) {
                try {
                    interface QueryResult {
                        columns: string[];
                        rows: unknown[][];
                    }

                    const result = await invoke<QueryResult>('db_query', {
                        sql: `SELECT id, nome, nome_usuario, email, perfil, ativo, hash_senha, id_organizacao, setor_id, criado_em, atualizado_em FROM usuarios WHERE nome_usuario = ? LIMIT 1`,
                        params: [username.trim()]
                    });


                    if (result && result.rows.length > 0) {
                        const row = result.rows[0];
                        const userObj: Record<string, unknown> = {};
                        result.columns.forEach((col, idx) => {
                            userObj[col] = row[idx];
                        });
                        // mapeia coluna do banco para o campo esperado pelo tipo User
                        if (!userObj.password_hash && userObj.hash_senha) {
                            userObj.password_hash = userObj.hash_senha;
                        }

                        if (userObj.ativo === 'true' || userObj.ativo === 1 || userObj.ativo === true) {
                            userObj.ativo = true;
                        } else if (userObj.ativo === 'false' || userObj.ativo === 0 || userObj.ativo === false) {
                            userObj.ativo = false;
                        } else {
                            userObj.ativo = userObj.ativo == null ? true : userObj.ativo;
                        }

                        user = userObj as unknown as User;
                    }
                } catch (tauriError) {
                    console.error("Erro ao verificar usuário no banco local:", tauriError);
                    throw new Error("Erro ao conectar com o banco de dados local.");
                }
            }

            if (!user) {
                throw new Error("Usuário não encontrado ou credenciais inválidas.");
            }

            if (user.ativo === false) {
                throw new Error("Usuário inativo. Contate o administrador.");
            }


            // 2. Verify password using Rust backend (supports bcrypt + SHA-256)
            const hashSenha = user.password_hash;
            if (!hashSenha) {
                throw new Error("Erro de configuração de segurança do usuário.");
            }


            let isValid = false;
            try {
                isValid = await invoke<boolean>('verify_password', {
                    password: password,
                    hash: hashSenha
                });
            } catch (verifyError) {
                console.error("Erro ao verificar senha via Tauri:", verifyError);
                throw new Error("Erro ao verificar senha.");
            }


            if (!isValid) {
                throw new Error("Senha incorreta.");
            }

            // Remove o hash da senha (e colunas sensíveis) antes de persistir o usuário.
            // A verificação já ocorreu via Rust; o hash não deve trafegar no contexto React nem no localStorage.
            const { password_hash: _ph, hash_senha: _hs, sal_sync: _ss, ...safeUser } =
                user as unknown as Record<string, unknown>;
            void _ph; void _hs; void _ss;
            login(safeUser as unknown as User, password);

        } catch (err: unknown) {
            console.error("Login error:", err);
            const errorMessage = err instanceof Error ? err.message : "Erro ao realizar login";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (checkingFirstRun) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm text-gray-600">Verificando configuracao inicial...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <FirstRunSetupModal
                open={showSetup}
                onComplete={() => {
                    setShowSetup(false);
                    toast.success("Administrador criado com sucesso. Faca login para continuar.");
                }}
            />
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <Image src="/logo-pmf.png" alt="Prefeitura Municipal de Florianópolis" width={80} height={80} />
                    </div>
                    <CardTitle className="text-2xl font-bold">EcoSuite Login</CardTitle>
                    <CardDescription>Prefeitura de Florianópolis - Gestão Ambiental</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="username">Usuário</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="usuario.sistema"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-2">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Entrar"}
                        </Button>
                        <Dialog open={consoleOpen} onOpenChange={setConsoleOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Mostrar Console
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                    <DialogTitle>Console de Depuração</DialogTitle>
                                </DialogHeader>
                                <ConsolePanel />
                            </DialogContent>
                        </Dialog>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
