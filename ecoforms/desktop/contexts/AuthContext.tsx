"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User } from "@/types";
import { useRouter, usePathname } from "next/navigation";
import { usePermissions, UsePermissionsReturn } from "@/src/interface/hooks/catalog/auth";
import { useSqlite } from "@/src/interface/hooks/catalog/tauri";
import { invoke } from "@tauri-apps/api/core";
import { supabase } from "@/src/infrastructure/persistence/supabase/supabaseClient";
import { getCryptoLayer } from "@/src/infrastructure/sync/lazy-sync";

interface AuthContextType {
    user: User | null;
    login: (user: User, password?: string) => void;
    logout: () => void;
    loading: boolean;
    permissions: UsePermissionsReturn;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

async function syncUsersFromSupabase(): Promise<void> {
    try {
        const { supabase: sb } = await import('@/src/infrastructure/persistence/supabase/supabaseClient');
        const { data: profiles, error } = await sb.from('profiles').select('id, nome, email, perfil, ativo, org_id');
        if (error || !profiles?.length) return;

        const { getContainer } = await import('@/src/infrastructure/container');
        const { SqliteUserRepository } = await import('@/src/infrastructure/persistence/sqlite/SqliteUserRepository');
        const { SupabaseUserSyncService } = await import('@/src/infrastructure/sync/SupabaseUserSyncService');

        const container = getContainer();
        const userRepo = new SqliteUserRepository(container.sqlite);
        const syncService = new SupabaseUserSyncService(userRepo, container.sqlite);
        const result = await syncService.syncFromSupabase(profiles);
        console.log(`[Auth] Supabase users synced: ${result.synced} total, ${result.created} created, ${result.updated} updated`);
    } catch (e) {
        console.warn('[Auth] User sync from Supabase failed (non-fatal):', e);
    }
}

async function syncSupabaseAuth(email: string, password: string): Promise<void> {
    try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            // Não faz signUp automático — contas Supabase são gerenciadas pelo admin
            console.warn('[Auth] Supabase signIn failed (non-fatal):', signInError.message);
        } else {
            console.log('[Auth] Supabase session established:', email);
        }
    } catch (netErr) {
        console.warn('[Auth] Supabase unreachable (non-fatal):', netErr);
    }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const lastActivityRef = useRef<number | null>(null);
    const pendingSupabaseAuthRef = useRef<{ email: string; password: string } | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const sqlite = useSqlite();

    const permissions = usePermissions(user);

    // Declared before effects so effects can reference them without forward-ref violations.
    const logout = async () => {
        setUser(null);
        localStorage.removeItem("ecoforms_user");
        try {
            await invoke("clear_session");
        } catch (e) {
            console.warn("Failed to clear Rust session:", e);
        }
        try {
            const cryptoLayer = getCryptoLayer();
            if (cryptoLayer) {
                cryptoLayer.clearKey();
            }
        } catch (e) {
            console.warn("Failed to clear crypto key:", e);
        }
        try {
            await supabase.auth.signOut();
            console.log('[Auth] Supabase session cleared');
        } catch (e) {
            console.warn("Failed to clear Supabase session:", e);
        }
        router.push("/login");
    };

    const login = async (userData: User, password?: string) => {
        // Defesa em profundidade: nunca manter hash de senha em memória nem no localStorage.
        const { password_hash: _ph, hash_senha: _hs, sal_sync: _ss, ...safe } =
            userData as unknown as Record<string, unknown>;
        void _ph; void _hs; void _ss;
        const safeUser = safe as unknown as User;
        setUser(safeUser);
        lastActivityRef.current = Date.now();
        localStorage.setItem("ecoforms_user", JSON.stringify(safeUser));
        try {
            await invoke("set_session", { userId: userData.id, perfil: userData.perfil });
        } catch (e) {
            console.warn("Failed to set Rust session:", e);
        }

        // Derivar chave criptográfica PBKDF2 a partir da senha (não persistir)
        if (password) {
            try {
                const { CryptoLayer } = await import("@/src/infrastructure/sync/CryptoLayer");
                const cryptoLayer = new CryptoLayer();
                let userSalt: string;
                try {
                    const rows = await sqlite.query<{ sal_sync: string }>(
                        'SELECT sal_sync FROM usuarios WHERE id = ? LIMIT 1',
                        [userData.id]
                    );
                    userSalt = rows[0]?.sal_sync || '';
                    if (!userSalt) {
                        // Gerar sync_salt individual para este usuário
                        userSalt = crypto.randomUUID();
                        await sqlite.execute(
                            'UPDATE usuarios SET sal_sync = ? WHERE id = ?',
                            [userSalt, userData.id]
                        );
                    }
                } catch {
                    userSalt = crypto.randomUUID();
                    await sqlite.execute(
                        'UPDATE usuarios SET sal_sync = ? WHERE id = ?',
                        [userSalt, userData.id]
                    ).catch(() => {});
                }
                await cryptoLayer.deriveAndStoreKey(password, userSalt);

                // Carregar chave no Rust CryptoState para operações server-side
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const stored = await cryptoLayer['store']?.get('org_crypto_key') as number[] | null;
                    if (stored) {
                        await invoke('load_crypto_key', { keyBytes: Array.from(stored) });
                    }
                } catch {
                    // Non-fatal: crypto state not needed until SMTP or sync operations
                }
            } catch (e) {
                console.warn("[Auth] Falha ao derivar chave criptográfica:", e);
            }
        }

        // Rehash automático: upgrade SHA-256 legacy → bcrypt
        if (password && userData.password_hash && !userData.password_hash.startsWith('$2')) {
            try {
                const newHash = await invoke<string>('hash_password', { password });
                await sqlite.execute(
                    'UPDATE usuarios SET hash_senha = ? WHERE id = ?',
                    [newHash, userData.id]
                );
                console.log('[Auth] Senha migrada de SHA-256 para bcrypt');
            } catch (e) {
                console.warn('[Auth] Falha ao migrar hash para bcrypt (non-fatal):', e);
            }
        }

        // Fase C1: Supabase Auth paralela (non-fatal)
        if (password) {
            const syntheticEmail = `${userData.username}@ecoforms.local`;
            if (navigator.onLine) {
                await syncSupabaseAuth(syntheticEmail, password);
                syncUsersFromSupabase();
            } else {
                pendingSupabaseAuthRef.current = { email: syntheticEmail, password };
            }
        }

        router.push("/");
    };

    useEffect(() => {
        const storedUser = localStorage.getItem("ecoforms_user");
        if (!storedUser) {
            setLoading(false);
            return;
        }
        let parsed: User | null = null;
        try {
            parsed = JSON.parse(storedUser);
        } catch (e) {
            console.error("Failed to parse stored user", e);
            localStorage.removeItem("ecoforms_user");
            setLoading(false);
            return;
        }
        if (!parsed) {
            setLoading(false);
            return;
        }
        // Valida se o usuário ainda existe e está ativo no banco local
        // AGUARDA container init antes de validar (garante que tabelas existam)
        const validate = async () => {
            try {
                const { getContainerAsync } = await import('@/src/infrastructure/container');
                await getContainerAsync();
                const result = await sqlite.query<{ ativo: number | boolean }>(
                    'SELECT ativo FROM usuarios WHERE id = ? LIMIT 1',
                    [parsed!.id]
                );
                const row = result[0];
                const ativo = row?.ativo ?? null;
                if (ativo === 1 || ativo === true) {
                    lastActivityRef.current = Date.now();
                    setUser(parsed);
                } else {
                    console.warn('[Auth] User inactive or missing, clearing session');
                    localStorage.removeItem("ecoforms_user");
                }
            } catch (err) {
                // Tabela não existe ou DB não pronto — limpa sessão stale
                console.warn('[Auth] User validation failed (table missing or DB not ready):', err);
                localStorage.removeItem("ecoforms_user");
            } finally {
                setLoading(false);
            }
        };
        validate();
    }, []);

    // Re-validar sessão periodicamente (a cada 5 min)
    useEffect(() => {
        if (!user) return;

        const check = () => {
            sqlite.query<{ ativo: number | boolean }>(
                'SELECT ativo FROM usuarios WHERE id = ? LIMIT 1',
                [user.id]
            ).then(result => {
                const row = result[0];
                const ativo = row?.ativo ?? null;
                if (ativo !== 1 && ativo !== true) {
                    console.warn('⚠️ User deactivated, logging out');
                    logout();
                }
            }).catch(() => {
                // DB still not available — ignore
            });
        };

        check();
        const interval = setInterval(check, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    // Retry Supabase auth quando voltar online após login offline
    useEffect(() => {
        if (!user) return;
        const handleOnline = () => {
            const pending = pendingSupabaseAuthRef.current;
            if (!pending) return;
            pendingSupabaseAuthRef.current = null;
            syncSupabaseAuth(pending.email, pending.password).then(() => syncUsersFromSupabase());
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [user]);

    // Fix #3: lastActivityRef não muda identidade — o effect só roda quando `user` muda,
    // eliminando a recriação do interval a cada evento de mouse/teclado.
    useEffect(() => {
        if (!user) return;

        const checkInactivity = setInterval(() => {
            const last = lastActivityRef.current;
            if (last !== null && Date.now() - last > SESSION_TIMEOUT_MS) {
                logout();
            }
        }, 60000);

        const handleActivity = () => { lastActivityRef.current = Date.now(); };
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('keydown', handleActivity);

        return () => {
            clearInterval(checkInactivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('keydown', handleActivity);
        };
    }, [user]);

    // Protect routes
    useEffect(() => {
        if (!loading) {
            if (!user && pathname !== "/login") {
                router.push("/login");
            }
            // Se existe user mas a tabela não existe (DB corrompido/recriado),
            // limpa tudo e força login fresh
            if (!user && pathname === "/login") {
                // LoginPage checkFirstRun vai cuidar do FirstRunSetupModal
            }
        }
    }, [user, loading, pathname, router]);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, permissions }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
