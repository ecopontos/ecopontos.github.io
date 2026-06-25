/**
 * Página de formulário - Client Component
 */

"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFormByIdOrSlug } from "@/src/interface/hooks/queries/lookups";
import { FormRegistry } from "@/types";
import { SchemaEditor } from "@/components/forms/SchemaEditor";

function FormEditorContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [formData, setFormData] = useState<FormRegistry | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const fetchForm = useCallback(async (formId: string) => {
    try {
      setLoading(true);
      const registry = await fetchFormByIdOrSlug(formId);
      if (!registry) {
        throw new Error("Formulário não encontrado");
      }
      setFormData(registry);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao carregar formulário";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isNew && id) {
      fetchForm(id);
    }
  }, [id, isNew, fetchForm]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-4"></div>
          <div className="text-lg">Carregando formulário...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">Erro: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <SchemaEditor
        initialData={formData}
        isNew={isNew}
      />
    </div>
  );
}

export default function FormPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center">Carregando...</div>}>
      <FormEditorContent />
    </Suspense>
  );
}