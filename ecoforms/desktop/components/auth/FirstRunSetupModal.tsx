"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, FolderCheck } from "lucide-react";
import { useTauriInvoke } from "@/src/interface/hooks/catalog/tauri";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { useFirstRunSetup } from "@/src/interface/hooks/catalog/auth";
import type { User } from "@/types";

interface FirstRunSetupModalProps {
    open: boolean;
    onComplete: () => void;
}

type Step = "lan_path" | "select_user" | "create_admin";


interface UserSummary {
    id: string;
    nome: string;
    username: string;
    perfil: string;
    setor?: string;
}

type UserSource = "seed" | "lan";

export function FirstRunSetupModal({ open, onComplete }: FirstRunSetupModalProps) {
    const { login } = useAuth();
    const [step, setStep] = useState<Step>("lan_path");
    const [lanPath, setLanPath] = useState("");
    const [lanPathError, setLanPathError] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    const [users, setUsers] = useState<UserSummary[]>([]);
    const [userSource, setUserSource] = useState<UserSource | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [loginPassword, setLoginPassword] = useState("");

    const [nome, setNome] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const invoke = useTauriInvoke();
    const { saveLanPath, loadUsers, testLanConnection, mirrorAdminToSupabase } = useFirstRunSetup();

    const handleTestAndAdvance = async () => {
        setLanPathError(null);
        setTesting(true);
        try {
            await saveLanPath(lanPath.trim());

            const result = await testLanConnection();
            if (!result.ok) {
                setLanPathError(result.message);
                setTesting(false);
                return;
            }

            const loaded = await loadUsers();
            setUsers(loaded.users);
            setUserSource(loaded.source);
            if (loaded.users.length > 0) {
                setStep("select_user");
            } else {
                setStep("create_admin");
            }
        } catch (e) {
            setLanPathError(`Erro ao conectar: ${String(e)}`);
        } finally {
            setTesting(false);
        }
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const n = nome.trim();
        const u = username.trim();
        const p = password.trim();
        const cp = confirmPassword.trim();

        if (n.length < 2) { setError("Nome completo deve ter pelo menos 2 caracteres."); return; }
        if (u.length < 3) { setError("Username deve ter pelo menos 3 caracteres."); return; }
        if (u.includes(" ")) { setError("Username não pode conter espaços."); return; }
        if (p.length < 8 || !/[a-zA-Z]/.test(p) || !/\d/.test(p)) {
            setError("Senha deve ter pelo menos 8 caracteres, com letras e números.");
            return;
        }
        if (p !== cp) { setError("As senhas não coincidem."); return; }

        setLoading(true);
        try {
            const result = await invoke<{ id: string; username: string }>(
                "create_first_admin",
                { nome: n, username: u, password: p }
            );
            console.log("[FirstRun] Admin criado:", result);

            await mirrorAdminToSupabase(n, u, p);

            onComplete();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithSeed = async () => {
        if (!selectedUserId) { setError("Selecione um usuário."); return; }
        if (!loginPassword.trim()) { setError("Digite a senha."); return; }
        setError(null);
        setLoading(true);
        try {
            const selectedUser = users.find((candidate) => candidate.id === selectedUserId);
            if (!selectedUser) {
                setError("Usuário selecionado não encontrado.");
                setLoading(false);
                return;
            }

            interface LoginResult {
                found: boolean;
                password_valid: boolean;
                user: Record<string, unknown> | null;
            }

            const result = await invoke<LoginResult>("db_login", {
                username: selectedUser.username,
                password: loginPassword.trim(),
            });

            if (!result.found || !result.user) {
                setError("Usuário não encontrado ou sem senha configurada.");
                setLoading(false);
                return;
            }

            if (!result.password_valid) {
                setError("Senha incorreta.");
                setLoading(false);
                return;
            }

            login(result.user as unknown as User, loginPassword.trim());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setError(null);
        if (step === "select_user" || step === "create_admin") {
            setStep("lan_path");
            setUsers([]);
            setUserSource(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <ShieldCheck className="h-6 w-6 text-blue-600" />
                    </div>
                    <DialogTitle className="text-xl">Configuração Inicial</DialogTitle>
                    <DialogDescription>
                        {step === "lan_path" && "Configure o caminho da pasta LAN para acessar os dados existentes."}
                        {step === "select_user" && (userSource === "seed" ? "Usuários encontrados no seed. Selecione para entrar." : "Usuários encontrados no LAN. Selecione para entrar.")}
                        {step === "create_admin" && "Nenhum usuário encontrado. Crie o primeiro administrador."}
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: LAN Path */}
                {step === "lan_path" && (
                    <div className="space-y-4 mt-2">
                        {lanPathError && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {lanPathError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="lan-path">Caminho da pasta LAN</Label>
                            <Input
                                id="lan-path"
                                value={lanPath}
                                onChange={(e) => { setLanPath(e.target.value); }}
                                placeholder={`Ex: \\\\servidor\\compartilhado\\ecoforms`}
                                className="font-mono text-sm"
                                disabled={testing}
                            />
                            <p className="text-xs text-muted-foreground">
                                Windows: <code>\\servidor\pasta</code> · Linux: <code>/mnt/nas/ecoforms</code>
                            </p>
                        </div>

                        <Button onClick={handleTestAndAdvance} className="w-full" disabled={testing || !lanPath.trim()}>
                            {testing ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testando conexão...</>
                            ) : (
                                <><FolderCheck className="mr-2 h-4 w-4" />Testar e Avançar</>
                            )}
                        </Button>

                        <Button variant="ghost" onClick={() => setStep("create_admin")} className="w-full text-sm">
                            Pular — criar administrador local
                        </Button>
                    </div>
                )}

                {/* Step 2: Select User */}
                {step === "select_user" && (
                    <div className="space-y-4 mt-2">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="text-sm text-muted-foreground">
                            {userSource === "seed"
                                ? `Encontrados ${users.length} usuário(s) no seed:`
                                : `Encontrados ${users.length} usuário(s) no LAN:`
                            }
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                            {users.map((u) => (
                                <div
                                    key={u.id}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${
                                        selectedUserId === u.id
                                            ? "bg-blue-100 border border-blue-300"
                                            : "hover:bg-gray-50 border border-transparent"
                                    }`}
                                    onClick={() => setSelectedUserId(u.id)}
                                >
                                    <div className="flex-1">
                                        <span className="font-medium">{u.username}</span>
                                        <span className="text-muted-foreground ml-2">({u.perfil})</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{u.setor}</span>
                                </div>
                            ))}
                        </div>

                        {selectedUserId && (
                            <div className="space-y-2">
                                <Label htmlFor="seed-password">Senha</Label>
                                <Input
                                    id="seed-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleBack} className="flex-1">
                                Voltar
                            </Button>
                            <Button
                                onClick={handleLoginWithSeed}
                                className="flex-1"
                                disabled={loading || !selectedUserId || !loginPassword.trim()}
                            >
                                {loading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
                                ) : (
                                    "Entrar"
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Create Admin */}
                {step === "create_admin" && (
                    <form onSubmit={handleCreateAdmin} className="space-y-4 mt-2">
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="setup-nome">Nome completo</Label>
                            <Input
                                id="setup-nome"
                                type="text"
                                placeholder="João Silva"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="setup-username">Username</Label>
                            <Input
                                id="setup-username"
                                type="text"
                                placeholder="joao.silva"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="setup-password">Senha (mín. 8 caracteres, com letras e números)</Label>
                            <Input
                                id="setup-password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="setup-confirm">Confirmar senha</Label>
                            <Input
                                id="setup-confirm"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                                Voltar
                            </Button>
                            <Button type="submit" className="flex-1" disabled={loading}>
                                {loading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
                                ) : (
                                    "Criar Administrador"
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
