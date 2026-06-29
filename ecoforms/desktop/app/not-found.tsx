"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolveStaticRouteFallback } from "@/src/lib/staticRouteFallbacks";

export default function NotFound() {
    const [redirectTarget] = useState<string | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }

        return resolveStaticRouteFallback(window.location.pathname, window.location.search);
    });

    useEffect(() => {
        if (!redirectTarget) {
            return;
        }

        window.location.replace(redirectTarget);
    }, [redirectTarget]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-2xl font-semibold">Página não encontrada</h1>
            {redirectTarget ? (
                <p className="text-sm text-muted-foreground">
                    Redirecionando para a rota estática compatível: <code>{redirectTarget}</code>
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    O endereço solicitado não existe neste build estático.
                </p>
            )}
            <Link href="/" className="text-sm underline underline-offset-4">
                Voltar para a página inicial
            </Link>
        </main>
    );
}
