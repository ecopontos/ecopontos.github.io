import { useState, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { useAuth } from "@/contexts/AuthContext";

export function useTaskComments() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addComment = useCallback(
        async (tarefaId: string, comentario: string): Promise<void> => {
            if (!user) throw new Error("Banco ou sessão não disponível.");
            const trimmed = comentario.trim();
            if (!trimmed) throw new Error("Comentário não pode ser vazio.");

            setLoading(true);
            setError(null);
            try {
                const container = await getContainerAsync();
                await container.tasks.addComment.execute(tarefaId, user.id, trimmed);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg);
                throw e;
            } finally {
                setLoading(false);
            }
        },
        [user]
    );

    return { addComment, loading, error };
}
