"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary do App Router — captura erros em qualquer rota.
 * Next.js exige 'use client' + reset() callback.
 */
export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[app/error] Erro em rota:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border border-red-100">
                <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <div className="space-y-2 max-w-md">
                <h2 className="text-xl font-semibold text-gray-900">
                    Erro inesperado
                </h2>
                <p className="text-sm text-muted-foreground">
                    Ocorreu um erro ao carregar esta página.
                    Tente novamente ou recarregue a aplicação.
                </p>
                {error.digest && (
                    <p className="mt-3 text-xs text-gray-400">
                        Código: {error.digest}
                    </p>
                )}
            </div>
            <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={reset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                    Recarregar página
                </Button>
            </div>
        </div>
    );
}
