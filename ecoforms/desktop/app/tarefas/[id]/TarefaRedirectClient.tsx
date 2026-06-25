"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect client-side /tarefas/:id → /tasks/:id.
 * Substitui o redirects() do next.config (incompatível com output: 'export').
 */
export default function TarefaRedirectClient() {
    const router = useRouter();
    const params = useParams<{ id: string }>();

    useEffect(() => {
        router.replace(`/tasks/${params.id}`);
    }, [router, params.id]);

    return null;
}
