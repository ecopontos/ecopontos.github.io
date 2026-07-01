"use client";
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { getContainerAsync } from '@/src/interface/hooks/catalog/utils';
import type { ModuleConfig } from '@/src/domain/module/ModuleRegistry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Eye } from 'lucide-react';
import { VisualPalette } from './VisualPalette';
import { VisualGridCanvas, type VisualItem } from './VisualGridCanvas';
import { ViewListEditor, type ViewItem } from './ViewListEditor';
import { ViewConfigDialog } from './ViewConfigDialog';
import Link from 'next/link';

interface ModuleVisualsConfigProps {
  moduleSlug: string;
}

export function ModuleVisualsConfig({ moduleSlug }: ModuleVisualsConfigProps) {
  const [visuals, setVisuals] = useState<VisualItem[]>([]);
  const [activeVisual, setActiveVisual] = useState<VisualItem | null>(null);
  const [moduleData, setModuleData] = useState<{
    id: string; slug: string; name: string; entity_type: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedVisual, setSelectedVisual] = useState<VisualItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<Record<string, unknown> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    loadModuleData();
  }, [moduleSlug]);

  async function loadModuleData() {
    setLoading(true);
    try {
      const c = await getContainerAsync();
      const allModules = await c.modules.list.execute();
      const mod = allModules.find(m => m.slug === moduleSlug);
      if (!mod) throw new Error('Módulo não encontrado');

      setModuleData({
        id: mod.id,
        slug: mod.slug,
        name: mod.name,
        entity_type: mod.entity_type,
      });

      const existing = ((mod.config as Record<string, unknown>)?.visuais ?? []) as Record<string, unknown>[];

      const loadedVisuals: VisualItem[] = existing.map((v, i) => ({
        id: (v.id as string) ?? `visual-${i}`,
        type: v.type as string,
        title: v.title as string,
        position: (v.position as { w: number; h: number }) ?? { w: 6, h: 4 },
        permissions: (v.permissions as { can_view: string[] }) ?? { can_view: ['admin'] },
        viewConfig: (v.viewConfig as Record<string, unknown>) ?? undefined,
      }));

      setVisuals(loadedVisuals);
    } catch (err) {
      console.error('[ModuleVisualsConfig] Error:', err);
      toast.error('Erro ao carregar módulo');
    } finally {
      setLoading(false);
    }
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.source === 'palette') {
      const type = active.data.current?.type as string;
      if (!type || visuals.some(v => v.id === `visual-${type}`)) return;

      const newVisual: VisualItem = {
        id: `visual-${type}`,
        type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        position: { w: type === 'table' ? 12 : 6, h: 4 },
        permissions: { can_view: ['admin', 'gerente', 'coordenador', 'encarregado', 'operador', 'campo'] },
      };
      setVisuals([...visuals, newVisual]);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = visuals.findIndex(v => v.id === active.id);
      const newIndex = visuals.findIndex(v => v.id === over.id);
      setVisuals(arrayMove(visuals, oldIndex, newIndex));
    }
  }, [visuals]);

  const handleRemove = useCallback((id: string) => {
    setVisuals(visuals.filter(v => v.id !== id));
  }, [visuals]);

  const handleConfigure = useCallback((visual: VisualItem) => {
    setSelectedVisual(visual);
    setEditingView(null);
    setViewDialogOpen(true);
  }, []);

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const c = await getContainerAsync();

      // Carregar configuração atual
      const allModules = await c.modules.list.execute();
      const mod = allModules.find(m => m.slug === moduleSlug);
      if (!mod) throw new Error('Módulo não encontrado');

      const existingConfig = (mod.config ?? {}) as Record<string, unknown>;
      const updatedConfig = {
        ...existingConfig,
        visuais: visuals.map(v => ({
          id: v.id,
          type: v.type,
          title: v.title,
          position: v.position,
          permissions: v.permissions,
          ...(v.viewConfig ? { viewConfig: v.viewConfig } : {}),
        })),
      };

      await c.modules.updateConfig.execute({ id: moduleData!.id, config: updatedConfig as ModuleConfig });
      toast.success('Visuais do módulo salvos');
    } catch (err) {
      console.error('[ModuleVisualsConfig] Save error:', err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }, [moduleSlug, moduleData, visuals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{moduleData?.name}</h1>
            <p className="text-sm text-muted-foreground">
              Configure os visuais do módulo — arraste da paleta e posicione no grid
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/modulo?slug=${moduleSlug}`}>
                <Eye className="h-4 w-4 mr-2" /> Ver módulo
              </Link>
            </Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <VisualPalette
              existingTypes={visuals.map(v => v.type)}
              onAdd={(type) => {
                setVisuals([...visuals, {
                  id: `visual-${type}`,
                  type,
                  title: type.charAt(0).toUpperCase() + type.slice(1),
                  position: { w: type === 'table' ? 12 : 6, h: 4 },
                  permissions: { can_view: ['admin', 'gerente', 'coordenador', 'encarregado', 'operador', 'campo'] },
                }]);
              }}
            />
          </div>

          <div className="flex-1">
            <SortableContext items={visuals.map(v => v.id)}>
              <VisualGridCanvas
                visuals={visuals}
                onRemove={handleRemove}
                onConfigure={handleConfigure}
              />
            </SortableContext>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeVisual ? (
          <Card className="shadow-lg border-primary">
            <CardContent className="p-3">
              <Badge>{activeVisual.type}</Badge>
              <p className="text-sm mt-1">{activeVisual.title}</p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>

      {selectedVisual && (
        <ViewConfigDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          visualType={selectedVisual.type}
          initialConfig={editingView ?? selectedVisual.viewConfig ?? undefined}
          onSave={(config) => {
            setVisuals(prev => prev.map(v =>
              v.id === selectedVisual.id ? { ...v, viewConfig: config } : v
            ));
            setViewDialogOpen(false);
            toast.success('Configuração aplicada — salve para persistir');
          }}
        />
      )}
    </DndContext>
  );
}
