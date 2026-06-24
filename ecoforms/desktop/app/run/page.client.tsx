/**
 * Página de execução de formulário - Client Component
 */

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormRegistry } from "@/types";
import { FormRenderer } from "@/components/runtime/FormRenderer";
import { useFormPermissions } from "@/src/interface/hooks/catalog/auth";
import { useFormTemplate } from "@/src/interface/hooks/catalog/forms";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function RunFormContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id') ?? '';
    const { template, loading } = useFormTemplate(id || undefined);
    const formPermissions = useFormPermissions();

    if (loading) return <div className="p-8 text-center">Carregando formulário...</div>;
    if (!template) return <div className="p-8 text-center text-red-500">Formulário não encontrado.</div>;
    if (!formPermissions.canAccessForm(id)) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Você não tem permissão para acessar este formulário.
                <br />
                <span className="text-sm">Acesso a formulários é concedido via tarefas atribuídas.</span>
            </div>
        );
    }

    const form = { conteudo: template, form_id: id } as unknown as FormRegistry;

    return (
        <div className="container mx-auto py-10 max-w-3xl space-y-6">
            <div className="flex items-center space-x-4 mb-6">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/forms">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-muted-foreground">Executar Formulário</h1>
                </div>
            </div>

            <FormRenderer
                content={form.conteudo}
                formType={form.form_id}
            />
        </div>
    );
}

export default function RunFormPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <RunFormContent />
        </Suspense>
    );
}
