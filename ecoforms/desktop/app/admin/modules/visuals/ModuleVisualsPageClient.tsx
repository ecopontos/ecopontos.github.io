"use client";

import { useSearchParams } from 'next/navigation';
import { ModuleVisualsConfig } from '@/components/module-visuals/ModuleVisualsConfig';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ModuleVisualsPageClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');

  if (!slug) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <h1 className="text-2xl font-bold">Módulo não especificado</h1>
        <p className="text-muted-foreground">Informe o slug do módulo na URL: ?slug=inspecoes</p>
        <Button variant="outline" asChild>
          <Link href="/admin/modules">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para Módulos
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/modules">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar para Módulos
          </Link>
        </Button>
      </div>
      <ModuleVisualsConfig moduleSlug={slug} />
    </div>
  );
}
