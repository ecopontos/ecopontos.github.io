"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { LogProvider } from "@/contexts/LogContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { initializeActions } from "@/src/application/actions/initializeActions";
import { useTauriInvoke } from "@/src/interface/hooks/catalog/tauri";
import { initializeContainer } from "@/src/interface/hooks/catalog/utils";
import AppSidebar from "@/components/layout/AppSidebar";
import { SidebarLayout, SidebarMain } from "@/components/layout/SidebarLayout";

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLogin = pathname === "/login";
    const invoke = useTauriInvoke();

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5,
                refetchOnWindowFocus: false,
            },
        },
    }));

    const [dbReady, setDbReady] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);

    useEffect(() => {
        initializeContainer()
            .then(() => {
                initializeActions();
                setDbReady(true);
            })
            .catch((e: Error) => {
                console.error('[ClientLayout] DB init failed:', e);
                setDbError(e.message || 'Falha ao inicializar o banco de dados.');
            });
    }, []);

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.key === "F12") {
                try {
                    await invoke("toggle_devtools");
                } catch {
                    // Não está rodando dentro do Tauri (ex: browser)
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [invoke]);

    if (dbError) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center max-w-md p-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h2 className="text-xl font-semibold mb-2 text-gray-900">Erro de Inicialização</h2>
                    <p className="text-sm text-gray-600 mb-4">{dbError}</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Tentar novamente
                    </Button>
                </div>
            </div>
        );
    }

    if (!dbReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm text-gray-600">Iniciando banco de dados...</p>
                </div>
            </div>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <LogProvider>
                <AuthProvider>
                    <SyncProvider>
                        {isLogin ? (
                            <>
                                {children}
                                <Toaster />
                            </>
                        ) : (
                            <SidebarLayout>
                                <AppSidebar />
                                <SidebarMain>
                                    {children}
                                </SidebarMain>
                                <Toaster />
                            </SidebarLayout>
                        )}
                    </SyncProvider>
                </AuthProvider>
            </LogProvider>
        </QueryClientProvider>
    );
}
