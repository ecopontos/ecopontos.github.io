import { Suspense } from 'react';
import ModuleVisualsPageClient from './ModuleVisualsPageClient';

export default function ModuleVisualsPage() {
  return (
    <Suspense fallback={<div className="p-6">Carregando...</div>}>
      <ModuleVisualsPageClient />
    </Suspense>
  );
}
