"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useModuleRuntime } from '@/src/interface/hooks/queries/useModuleRuntime';
import { useModuleVisuals } from '@/src/interface/hooks/queries/useModuleVisuals';
import { useActiveViews } from '@/src/interface/hooks/catalog/modules-views';
import { useSuiteUseCases } from '@/src/interface/hooks/domain/useSuiteUseCases';
import type { ModuleRuntimeDto } from '@/src/domain/module/ModuleRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FormRenderer } from '@/components/runtime/FormRenderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FormContent } from '@/types';
import { VisualRenderer, type VisualData } from '@/components/module-runtime/VisualRenderer';

export default function ModuloPageClient() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user } = useAuth();
  const [activeForm, setActiveForm] = useState<ModuleRuntimeDto['forms'][0] | null>(null);

  const { data: moduleData, loading, error } = useModuleRuntime(slug, user?.perfil);
  const { visuals, loading: visualsLoading } = useModuleVisuals(slug, user?.id, user?.perfil);
  const { data: activeViewsData } = useActiveViews(moduleData?.entity_type);
  const suites = useSuiteUseCases();

  useEffect(() => {
    if (!loading && error) toast.error('Erro ao carregar módulo');
  }, [loading, error]);

  const userDashboards = activeViewsData
    .filter(v => v.userId === user?.id || v.isTemplate)
    .map(v => ({ id: v.id, titulo: v.titulo }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!moduleData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h1 className="text-2xl font-bold">Módulo não encontrado</h1>
        <p className="text-muted-foreground">O módulo "{slug}" não existe ou não está publicado.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {moduleData.icon && <span>{moduleData.icon}</span>}
            {moduleData.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {moduleData.description || `Módulo operacional — ${moduleData.entity_type}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={moduleData.status === 'published' ? 'default' : 'secondary'}>
            {moduleData.status}
          </Badge>
          <Badge variant="outline">v{moduleData.version}</Badge>
        </div>
      </div>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Permissões</CardTitle>
          <CardDescription>Suas permissões neste módulo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {moduleData.permissions.can_view && <Badge>Visualizar</Badge>}
            {moduleData.permissions.can_create && <Badge variant="secondary">Criar</Badge>}
            {moduleData.permissions.can_edit && <Badge variant="secondary">Editar</Badge>}
            {moduleData.permissions.can_approve && <Badge variant="secondary">Aprovar</Badge>}
            {moduleData.permissions.can_delete && <Badge variant="destructive">Excluir</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Forms */}
      {moduleData.forms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Formulários ({moduleData.forms.length})</CardTitle>
            <CardDescription>Formulários disponíveis para este módulo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {moduleData.forms.map(form => (
                <div key={form.form_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{form.schema && typeof form.schema === 'object' && 'title' in form.schema ? String(form.schema.title) : form.form_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {form.required ? 'Obrigatório' : 'Opcional'}
                      {form.default && ' • Padrão'}
                    </p>
                  </div>
                  {moduleData.permissions.can_create && (
                    <Button size="sm" variant="outline" onClick={() => setActiveForm(form)}>
                      Novo Registro
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Catalogs */}
      {moduleData.data_catalogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Catálogos de Dados ({moduleData.data_catalogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {moduleData.data_catalogs.map(cat => (
                <div key={cat.catalog_id} className="p-3 border rounded-lg">
                  <p className="font-medium">{cat.catalog_id}</p>
                  <p className="text-sm text-muted-foreground">
                    {cat.items.length} itens • {cat.required ? 'Obrigatório' : 'Opcional'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Views */}
      {moduleData.views.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visualizações ({moduleData.views.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {moduleData.views.map(view => (
                <div key={view.view_id} className="p-3 border rounded-lg">
                  <p className="font-medium">{view.view_id}</p>
                  <p className="text-sm text-muted-foreground">Contexto: {view.context}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visuals (ADR-010) */}
      {visuals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visuais ({visuals.length})</CardTitle>
            <CardDescription>Visualizações de dados configuradas para este módulo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {visuals.map(visual => (
                <VisualRenderer key={visual.id} visual={visual} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboards (ADR-011) */}
      {userDashboards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Meus Dashboards ({userDashboards.length})</CardTitle>
            <CardDescription>Dashboards pessoais e templates globais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {userDashboards.map(d => (
                <div key={d.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <p className="font-medium">{d.titulo}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Decisions */}
      {moduleData.decisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decisões ({moduleData.decisions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {moduleData.decisions.map(dec => (
                <div key={dec.decision_id} className="p-3 border rounded-lg">
                  <p className="font-medium">{dec.decision_id}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={!!activeForm} onOpenChange={open => !open && setActiveForm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeForm?.schema && typeof activeForm.schema === 'object' && 'title' in activeForm.schema
                ? String(activeForm.schema.title)
                : activeForm?.form_id}
            </DialogTitle>
          </DialogHeader>
          {activeForm?.schema && (
            <FormRenderer
              content={activeForm.schema as unknown as FormContent}
              formType={activeForm.form_id}
              customSubmit={async (data) => {
                if (!moduleData || !user?.id) return;
                try {
                  await suites.submit.execute({
                    moduleType: moduleData.entity_type,
                    resourceType: activeForm.form_id,
                    ownerId: user.id,
                    payload: data,
                    entityType: moduleData.entity_type,
                  });
                  toast.success('Registro salvo com sucesso');
                  setActiveForm(null);
                } catch (err) {
                  console.error('[ModuloPage] Submit error:', err);
                  toast.error('Erro ao salvar registro');
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
