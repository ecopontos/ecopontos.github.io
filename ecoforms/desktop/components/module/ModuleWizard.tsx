"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useModules } from '@/src/interface/hooks/queries/useModules';
import { fetchFormsAtivos, fetchDataRegistryTipos } from '@/src/interface/hooks/queries/lookups';
import type { ModuleConfig, ModulePermissionConfig } from '@/src/domain/module/ModuleRegistry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Check, Plus, Trash2,
  Boxes, FileText, Database, LayoutTemplate, GitBranch, Shield, Rocket, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SelectDashboardModal } from '@/components/dashboard-composer/SelectDashboardModal';

interface FormOption {
  form_id: string;
  titulo: string;
}

interface DataCatalogOption {
  tipo: string;
  count: number;
}

interface WizardData {
  slug: string;
  name: string;
  entity_type: string;
  description: string;
  icon: string;
  color: string;
  forms: Array<{
    form_id: string;
    required: boolean;
    default: boolean;
    order: number;
  }>;
  dataCatalogs: Array<{
    catalog_id: string;
    required: boolean;
  }>;
  views: Array<{
    view_id: string;
    context: 'dashboard' | 'mapa' | 'relatorio' | 'modal';
    order: number;
  }>;
  decisions: Array<{
    decision_id: string;
  }>;
  permissions: ModulePermissionConfig[];
}

const STEPS = [
  { id: 1, title: 'Básico', icon: Boxes },
  { id: 2, title: 'Formulários', icon: FileText },
  { id: 3, title: 'Catálogos', icon: Database },
  { id: 4, title: 'Visualizações', icon: LayoutTemplate },
  { id: 5, title: 'Decisões', icon: GitBranch },
  { id: 6, title: 'Permissões', icon: Shield },
];

const DEFAULT_PERMISSIONS: ModulePermissionConfig[] = [
  { profile: 'admin', can_view: true, can_create: true, can_edit: true, can_approve: true, can_delete: true },
  { profile: 'gestor', can_view: true, can_create: true, can_edit: true, can_approve: true, can_delete: false },
  { profile: 'operador', can_view: true, can_create: true, can_edit: false, can_approve: false, can_delete: false },
  { profile: 'campo', can_view: true, can_create: false, can_edit: false, can_approve: false, can_delete: false },
];

export default function ModuleWizard() {
  const router = useRouter();
  const { user } = useAuth();
  const { createModule } = useModules();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOption[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ tipo: string; count: number }>>([]);
  const [dashboardModalOpen, setDashboardModalOpen] = useState(false);
  const [editingViewIndex, setEditingViewIndex] = useState<number | null>(null);

  const [data, setData] = useState<WizardData>({
    slug: '',
    name: '',
    entity_type: '',
    description: '',
    icon: '',
    color: '',
    forms: [],
    dataCatalogs: [],
    views: [],
    decisions: [],
    permissions: DEFAULT_PERMISSIONS,
  });

  useEffect(() => {
    fetchFormsAtivos().then(rows => setFormOptions(rows));
    fetchDataRegistryTipos().then(rows => setCatalogOptions(rows));
  }, []);

  const updateField = useCallback(<K extends keyof WizardData>(field: K, value: WizardData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleForm = useCallback((formId: string) => {
    setData(prev => {
      const exists = prev.forms.find(f => f.form_id === formId);
      if (exists) {
        return { ...prev, forms: prev.forms.filter(f => f.form_id !== formId) };
      }
      return { ...prev, forms: [...prev.forms, { form_id: formId, required: false, default: false, order: prev.forms.length + 1 }] };
    });
  }, []);

  const updateFormField = useCallback((formId: string, field: 'required' | 'default' | 'order', value: boolean | number) => {
    setData(prev => ({
      ...prev,
      forms: prev.forms.map(f => f.form_id === formId ? { ...f, [field]: value } : f),
    }));
  }, []);

  const toggleCatalog = useCallback((catalogId: string) => {
    setData(prev => {
      const exists = prev.dataCatalogs.find(c => c.catalog_id === catalogId);
      if (exists) {
        return { ...prev, dataCatalogs: prev.dataCatalogs.filter(c => c.catalog_id !== catalogId) };
      }
      return { ...prev, dataCatalogs: [...prev.dataCatalogs, { catalog_id: catalogId, required: false }] };
    });
  }, []);

  const addView = useCallback(() => {
    setData(prev => ({
      ...prev,
      views: [...prev.views, { view_id: '', context: 'dashboard', order: prev.views.length + 1 }],
    }));
  }, []);

  const removeView = useCallback((index: number) => {
    setData(prev => ({ ...prev, views: prev.views.filter((_, i) => i !== index) }));
  }, []);

  const updateView = useCallback((index: number, field: keyof WizardData['views'][0], value: string | number) => {
    setData(prev => ({
      ...prev,
      views: prev.views.map((v, i) => i === index ? { ...v, [field]: value } : v),
    }));
  }, []);

  const addDecision = useCallback(() => {
    setData(prev => ({
      ...prev,
      decisions: [...prev.decisions, { decision_id: '' }],
    }));
  }, []);

  const removeDecision = useCallback((index: number) => {
    setData(prev => ({ ...prev, decisions: prev.decisions.filter((_, i) => i !== index) }));
  }, []);

  const updateDecision = useCallback((index: number, value: string) => {
    setData(prev => ({
      ...prev,
      decisions: prev.decisions.map((d, i) => i === index ? { ...d, decision_id: value } : d),
    }));
  }, []);

  const updatePermission = useCallback((profile: string, field: keyof ModulePermissionConfig, value: boolean) => {
    setData(prev => ({
      ...prev,
      permissions: prev.permissions.map(p => p.profile === profile ? { ...p, [field]: value } : p),
    }));
  }, []);

  const canProceed = () => {
    switch (step) {
      case 1: return data.slug && data.name && data.entity_type;
      case 2: return true;
      case 3: return true;
      case 4: return data.views.every(v => v.view_id.trim() !== '');
      case 5: return data.decisions.every(d => d.decision_id.trim() !== '');
      case 6: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createModule({
        slug: data.slug,
        name: data.name,
        entity_type: data.entity_type,
        description: data.description,
        icon: data.icon || undefined,
        color: data.color || undefined,
        config: {
          forms: data.forms,
          data_catalogs: data.dataCatalogs,
          views: data.views,
          decisions: data.decisions,
        },
        permissions: data.permissions,
      });
      toast.success('Módulo criado com sucesso');
      router.push('/admin/modules');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar módulo');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input placeholder="fiscalizacao" value={data.slug} onChange={e => updateField('slug', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Entity Type *</Label>
                <Input placeholder="fiscalizacao" value={data.entity_type} onChange={e => updateField('entity_type', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Fiscalização Ambiental" value={data.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição do módulo..." value={data.description} onChange={e => updateField('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone (emoji)</Label>
                <Input placeholder="🌿" value={data.icon} onChange={e => updateField('icon', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cor (hex)</Label>
                <Input placeholder="#22c55e" value={data.color} onChange={e => updateField('color', e.target.value)} />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione os formulários disponíveis para este módulo.</p>
            {formOptions.length === 0 && <p className="text-sm text-muted-foreground">Nenhum formulário encontrado.</p>}
            <div className="space-y-2">
              {formOptions.map(form => {
                const selected = data.forms.find(f => f.form_id === form.form_id);
                return (
                  <div key={form.form_id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox checked={!!selected} onCheckedChange={() => toggleForm(form.form_id)} />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-sm">{form.titulo || form.form_id}</p>
                      {selected && (
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={selected.required} onCheckedChange={v => updateFormField(form.form_id, 'required', v as boolean)} />
                            Obrigatório
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={selected.default} onCheckedChange={v => updateFormField(form.form_id, 'default', v as boolean)} />
                            Padrão
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            Ordem:
                            <Input type="number" className="w-16 h-7" value={selected.order} onChange={e => updateFormField(form.form_id, 'order', parseInt(e.target.value) || 0)} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecione os catálogos de dados disponíveis.</p>
            {catalogOptions.length === 0 && <p className="text-sm text-muted-foreground">Nenhum catálogo encontrado.</p>}
            <div className="space-y-2">
              {catalogOptions.map(cat => {
                const selected = data.dataCatalogs.find(c => c.catalog_id === cat.tipo);
                return (
                  <div key={cat.tipo} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox checked={!!selected} onCheckedChange={() => toggleCatalog(cat.tipo)} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cat.tipo}</p>
                      <p className="text-xs text-muted-foreground">{cat.count} itens</p>
                      {selected && (
                        <label className="flex items-center gap-2 text-sm mt-2">
                          <Checkbox checked={selected.required} onCheckedChange={v => setData(prev => ({ ...prev, dataCatalogs: prev.dataCatalogs.map(c => c.catalog_id === cat.tipo ? { ...c, required: v as boolean } : c) }))} />
                          Obrigatório
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Defina as visualizações do módulo.</p>
              <Button size="sm" variant="outline" onClick={addView}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {data.views.map((view, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start text-left"
                    onClick={() => { setEditingViewIndex(idx); setDashboardModalOpen(true); }}
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2 text-muted-foreground" />
                    {view.view_id || 'Selecionar dashboard...'}
                  </Button>
                  <Select value={view.context} onValueChange={v => updateView(idx, 'context', v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Dashboard</SelectItem>
                      <SelectItem value="mapa">Mapa</SelectItem>
                      <SelectItem value="relatorio">Relatório</SelectItem>
                      <SelectItem value="modal">Modal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Ordem" value={view.order} onChange={e => updateView(idx, 'order', parseInt(e.target.value) || 0)} className="w-20" />
                  <Button size="icon" variant="ghost" onClick={() => removeView(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {data.views.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma visualização adicionada.</p>}
            </div>

            <SelectDashboardModal
              open={dashboardModalOpen}
              onOpenChange={setDashboardModalOpen}
              userId={user?.id ?? ''}
              moduleType={data.entity_type}
              onSelect={(dashboardId) => {
                if (editingViewIndex !== null) {
                  updateView(editingViewIndex, 'view_id', dashboardId);
                }
              }}
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Defina as árvores de decisão do módulo.</p>
              <Button size="sm" variant="outline" onClick={addDecision}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
            <div className="space-y-2">
              {data.decisions.map((dec, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Input placeholder="decision_id" value={dec.decision_id} onChange={e => updateDecision(idx, e.target.value)} className="flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => removeDecision(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {data.decisions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma decisão adicionada.</p>}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Permissões por Perfil</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Perfil</th>
                      <th className="px-4 py-2 text-center">Ver</th>
                      <th className="px-4 py-2 text-center">Criar</th>
                      <th className="px-4 py-2 text-center">Editar</th>
                      <th className="px-4 py-2 text-center">Aprovar</th>
                      <th className="px-4 py-2 text-center">Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.permissions.map(p => (
                      <tr key={p.profile} className="border-t">
                        <td className="px-4 py-2 capitalize font-medium">{p.profile}</td>
                        {(['can_view', 'can_create', 'can_edit', 'can_approve', 'can_delete'] as const).map(field => (
                          <td key={field} className="px-4 py-2 text-center">
                            <Checkbox
                              checked={p[field]}
                              onCheckedChange={v => updatePermission(p.profile, field, v as boolean)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h3 className="font-semibold">Revisão</h3>
              <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-48">
                <pre>{JSON.stringify({
                  slug: data.slug,
                  name: data.name,
                  entity_type: data.entity_type,
                  icon: data.icon,
                  forms: data.forms.length,
                  catalogs: data.dataCatalogs.length,
                  views: data.views.length,
                  decisions: data.decisions.length,
                }, null, 2)}</pre>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/modules')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary bg-primary/10 text-primary",
                  !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={cn("text-xs", isActive && "font-medium text-primary", isCompleted && "text-primary", !isActive && !isCompleted && "text-muted-foreground")}>
                  {s.title}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 mx-2", isCompleted ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS.find(s => s.id === step)?.title}</CardTitle>
          <CardDescription>
            Passo {step} de {STEPS.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep(Math.min(STEPS.length, step + 1))} disabled={!canProceed()}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading || !canProceed()}>
            <Rocket className="h-4 w-4 mr-1" />
            {loading ? 'Criando...' : 'Criar Módulo'}
          </Button>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
