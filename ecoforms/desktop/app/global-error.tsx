"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global error boundary — captura erros no root layout (inclui erros que
 * o app/error.tsx por segmento não alcança).
 * Next.js exige <html> + <body> explícitos no global-error.tsx.
 */
export default function GlobalErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="pt-BR">
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center bg-gray-50">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border border-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Erro crítico na aplicação
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Um erro inesperado impediu o carregamento da aplicação.
                            Recarregue a página ou contate o suporte.
                        </p>
                        {error.digest && (
                            <p className="mt-3 text-xs text-gray-400">
                                Código: {error.digest}
                            </p>
                        )}
                    </div>
                    <Button variant="outline" size="sm" onClick={reset}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tentar novamente
                    </Button>
                </div>
            </body>
        </html>
    );
}
