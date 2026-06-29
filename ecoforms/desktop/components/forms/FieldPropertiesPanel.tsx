"use client";

import { FormField } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Link, Info } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { VisibilityRulesEditor } from "./VisibilityRulesEditor";
import { useDataRegistryTypesNew as useDataRegistryTypes } from "@/src/interface/hooks/catalog/data-registry";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { detectSchemaFromItems } from "@/src/lib/registry-schema";
import { useMemo } from "react";
import { getCrmDataSourceNames } from "@/src/interface/hooks/catalog/data-registry";

interface FieldOption {
    label: string;
    value: string;
    [key: string]: unknown;
}

function normalizeFieldOptions(options: FormField["options"]): FieldOption[] {
    return (options || []).map((opt) =>
        typeof opt === "string"
            ? { label: opt, value: opt }
            : { label: String(opt?.label ?? ""), value: String(opt?.value ?? "") }
    );
}

function getDataSourceValue(value: FormField["dataSource"]): string {
    return typeof value === "string" ? value : "";
}

function SourceCodeSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const { types, loading } = useDataRegistryTypes();
    const crmTypes = getCrmDataSourceNames();
    const allTypes = [...new Set([...types, ...crmTypes, 'setores_ativos'])];
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione a fonte de dados"} />
            </SelectTrigger>
            <SelectContent>
                {allTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function DataSourceSchemaPreview({ tipo }: { tipo: string }) {
    const { data: items, loading } = useDataRegistryAggregated(tipo);
    const schema = useMemo(() => {
        if (!items || items.length === 0) return [];
        return detectSchemaFromItems(items.map(c => ({ conteudo: c })));
    }, [items]);

    if (loading) {
        return (
            <div className="border border-dashed border-gray-300 bg-gray-50 p-2 rounded">
                <p className="text-[10px] text-gray-500">Analisando schema...</p>
            </div>
        );
    }

    if (!items || items.length === 0) {
        return (
            <div className="border border-dashed border-amber-300 bg-amber-50 p-2 rounded">
                <p className="text-[10px] text-amber-700">
                    ⚠️ Tipo &quot;{tipo}&quot; não possui dados no registry. As opções aparecerão vazias.
                </p>
            </div>
        );
    }

    return (
        <div className="border border-dashed border-green-300 bg-green-50 p-2 rounded">
            <p className="text-[10px] text-green-700 font-semibold mb-1">
                ✓ Schema detectado ({items.length} itens, {schema.length} campos):
            </p>
            <div className="flex flex-wrap gap-1">
                {schema.slice(0, 6).map((s) => (
                    <span key={s.key} className="text-[9px] bg-white border border-green-200 px-1.5 py-0.5 rounded">
                        {s.key} <span className="text-muted-foreground">({s.type})</span>
                    </span>
                ))}
                {schema.length > 6 && (
                    <span className="text-[9px] text-muted-foreground">+{schema.length - 6}</span>
                )}
            </div>
        </div>
    );
}

interface FieldPropertiesPanelProps {
    field: FormField;
    index: number;
    allFields: FormField[];
    onUpdate: (index: number, updates: Partial<FormField>) => void;
}

/** Derive a suggested filterProperty from the parent field's dataSource. */
function suggestFilterProperty(parentFieldId: string, allFields: FormField[]): string {
    const parentField = allFields.find(f => f.id === parentFieldId);
    const ds = typeof parentField?.dataSource === "string" ? parentField.dataSource : "";
    if (!ds) return "";

    const KNOWN: Record<string, string> = {
        setores_ativos: "setor_id",
        galpoes_crm: "galpao_id",
        catadores_crm: "catador_id",
        pessoas_fisicas_crm: "pessoa_fisica_id",
        clientes_crm: "cliente_id",
        cooperativas_crm: "cooperativa_id",
        ecopontos_crm: "ecoponto_id",
    };
    if (KNOWN[ds]) return KNOWN[ds];

    // Strip common suffixes and singularize (regular Portuguese plurals)
    let entity = ds.replace(/_ativos$|_crm$|_todos$|_atuais$/, "");
    entity = entity.replace(/res$/, "r").replace(/es$/, "e").replace(/s$/, "");
    return entity ? `${entity}_id` : "";
}

/** Detecta se adicionar `parentId` como pai de `fieldId` cria um ciclo. */
function hasCyclicDependency(fieldId: string, parentId: string, allFields: FormField[]): boolean {
    const visited = new Set<string>();
    const dfs = (currentId: string): boolean => {
        if (currentId === fieldId) return true; // ciclo detectado
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        const f = allFields.find(f => f.id === currentId);
        if (!f?.dependency?.fieldId) return false;
        return dfs(f.dependency.fieldId);
    };
    return dfs(parentId);
}

export function FieldPropertiesPanel({ field, index, allFields, onUpdate }: FieldPropertiesPanelProps) {
    const update = (updates: Partial<FormField>) => onUpdate(index, updates);

    return (
        <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">ID do Campo</Label>
                    <Input
                        value={field.id}
                        onChange={(e) => update({ id: e.target.value })}
                        className="h-9"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                        value={field.type}
                        onValueChange={(value) => {
                            const baseUpdate: Partial<FormField> = { type: value };
                            if (value === 'chips') {
                                baseUpdate.multiple = false;
                            } else if (value === 'chips_multiple') {
                                baseUpdate.multiple = true;
                            }
                            update(baseUpdate);
                        }}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Texto Curto</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="tel">Telefone</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                            <SelectItem value="password">Senha</SelectItem>
                            <SelectItem value="hidden">Campo Oculto</SelectItem>
                            <SelectItem value="textarea">Texto Longo</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="checkbox">Checkbox (Sim/Não)</SelectItem>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="time">Hora</SelectItem>
                            <SelectItem value="datetime-local">Data e Hora</SelectItem>
                            <SelectItem value="timestamp">Carimbo de Tempo (Oculto)</SelectItem>
                            <SelectItem value="select">Seleção (Dropdown)</SelectItem>
                            <SelectItem value="select-field">Seleção (Alias: select-field)</SelectItem>
                            <SelectItem value="radio">Rádio (Seleção Única)</SelectItem>
                            <SelectItem value="chips">Chips (Seleção)</SelectItem>
                            <SelectItem value="chips_multiple">Chips (Múltiplo)</SelectItem>
                            <SelectItem value="group">Grupo</SelectItem>
                            <SelectItem value="repeatable_group">Grupo Repetível</SelectItem>
                            <SelectItem value="photo">Foto (Câmera)</SelectItem>
                            <SelectItem value="camera">Foto (Alias: camera)</SelectItem>
                            <SelectItem value="gallery">Galeria de Fotos</SelectItem>
                            <SelectItem value="gps">GPS</SelectItem>
                            <SelectItem value="geolocation">GPS (Alias: geolocation)</SelectItem>
                            <SelectItem value="presence">Presença</SelectItem>
                            <SelectItem value="presence-list">Presença (Lista)</SelectItem>
                            <SelectItem value="presence-compact">Presença (Compacta)</SelectItem>
                            <SelectItem value="occupation">Ocupação (Caixas)</SelectItem>
                            <SelectItem value="vistoria_checklist">Vistoria Checklist</SelectItem>
                            <SelectItem value="vistoria-checklist">Vistoria Checklist (Alias)</SelectItem>
                            <SelectItem value="checklist">Checklist (Alias)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Rótulo (Label)</Label>
                <Input
                    value={field.label}
                    onChange={(e) => update({ label: e.target.value })}
                    className="h-9"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Descrição (Subtítulo)</Label>
                <Input
                    value={field.description || ''}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Ex: Detalhes sobre o que preencher"
                    className="h-9"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Texto de Ajuda (Tooltip)</Label>
                <Input
                    value={field.helpText || ''}
                    onChange={(e) => update({ helpText: e.target.value })}
                    placeholder="Ex: Informação adicional de suporte"
                    className="h-9"
                />
            </div>

            {['text', 'email', 'tel', 'url', 'password', 'number', 'textarea', 'date', 'time', 'datetime-local', 'search'].includes(field.type) && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                        value={field.placeholder || ''}
                        onChange={(e) => update({ placeholder: e.target.value })}
                        placeholder="Ex: Digite aqui..."
                        className="h-9"
                    />
                </div>
            )}

            {field.type === 'hidden' && (
                <div className="space-y-1.5 border border-blue-200 bg-blue-50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <Label className="text-xs font-semibold text-blue-900">Valor do Campo Oculto</Label>
                    </div>
                    <Label className="text-xs text-blue-700">Valor Padrão (será usado automaticamente)</Label>
                    <Input
                        value={field.value || field.defaultValue || ''}
                        onChange={(e) => update({ value: e.target.value, defaultValue: e.target.value })}
                        placeholder="Ex: SOLICITACAO"
                        className="h-9 bg-white"
                    />
                    <p className="text-[10px] text-blue-600">
                        Este campo não será exibido no formulário, mas seu valor será incluído nos dados.
                    </p>
                </div>
            )}

            {field.type === 'timestamp' && (
                <div className="space-y-1.5 border border-purple-200 bg-purple-50 p-3 rounded" style={{ backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <Info className="h-4 w-4 text-purple-600" />
                        <Label className="text-xs font-semibold text-purple-900">Carimbo de Tempo Automático</Label>
                    </div>
                    <p className="text-[11px] text-purple-700 leading-tight">
                        Este campo captura automaticamente a data e hora atual (ISO) quando o formulário é inicializado.
                    </p>
                    <p className="text-[10px] text-purple-600 italic mt-1">
                        O campo ficará totalmente oculto para o operador.
                    </p>
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs">Código Fonte (Source Code)</Label>
                <SourceCodeSelector
                    value={getDataSourceValue(field.dataSource)}
                    onChange={(val) => update({
                        dataSource: val,
                        ...(field.type === 'repeatable_group'
                            ? { sourceMode: val ? (field.sourceMode || 'seed-on-init') : undefined }
                            : {})
                    })}
                />
            </div>

            {(() => {
                const ds = getDataSourceValue(field.dataSource);
                const isRegistryType = ds && !ds.endsWith('_crm') && ds !== 'setores_ativos';
                if (!isRegistryType) return null;

                return <DataSourceSchemaPreview tipo={ds} />;
            })()}

            {field.type === 'repeatable_group' && Boolean(getDataSourceValue(field.dataSource)) && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Modo da Fonte</Label>
                    <Select
                        value={field.sourceMode || 'seed-on-init'}
                        onValueChange={(value) => update({ sourceMode: value as 'manual' | 'seed-on-init' })}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="seed-on-init">Semear ao iniciar</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                        Semear ao iniciar carrega a fonte uma vez quando o grupo estiver vazio. Manual mantém a fonte declarada no schema sem hidratação automática.
                    </p>
                </div>
            )}

            {['select', 'select-field', 'radio', 'chips', 'chips_multiple'].includes(field.type) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Opções</Label>
                        <button
                            type="button"
                            className="text-[10px] text-primary underline"
                            onClick={() => {
                                // Normalizar opções legadas (string[]) para { label, value }[]
                                const normalized = normalizeFieldOptions(field.options);
                                update({ options: [...normalized, { label: '', value: '' }] });
                            }}
                        >
                            + Adicionar
                        </button>
                    </div>
                    {(field.options || []).length === 0 && (
                        <p className="text-[10px] text-muted-foreground">Nenhuma opção ainda. Clique em &quot;+ Adicionar&quot;.</p>
                    )}
                    {normalizeFieldOptions(field.options).map((opt, idx: number) => {
                        const label = opt.label;
                        const value = opt.value;
                        return (
                            <div key={idx} className="flex items-center gap-2">
                                <Input
                                    value={label}
                                    onChange={(e) => {
                                        const newOptions = normalizeFieldOptions(field.options).map((o, i: number) =>
                                            i === idx ? { label: e.target.value, value: o.value } : o
                                        );
                                        update({ options: newOptions });
                                    }}
                                    placeholder="Rótulo"
                                    className="h-8 text-xs flex-1"
                                />
                                <Input
                                    value={value}
                                    onChange={(e) => {
                                        const newOptions = normalizeFieldOptions(field.options).map((o, i: number) =>
                                            i === idx ? { label: o.label, value: e.target.value } : o
                                        );
                                        update({ options: newOptions });
                                    }}
                                    placeholder="Valor"
                                    className="h-8 text-xs w-24"
                                />
                                <button
                                    type="button"
                                    className="text-destructive hover:text-red-700 p-1"
                                    onClick={() => {
                                        update({ options: normalizeFieldOptions(field.options).filter((_, i: number) => i !== idx) });
                                    }}
                                    title="Remover opção"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {['select', 'select-field', 'radio', 'chips', 'chips_multiple'].includes(field.type) && (
                <div className="space-y-1.5">
                    <Label className="text-xs">Resposta Padrão</Label>
                    <Input
                        value={field.defaultValue || ''}
                        onChange={(e) => update({ defaultValue: e.target.value || undefined })}
                        placeholder="Valor pré-selecionado (opcional)"
                        className="h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Informe o valor (não o rótulo) da opção que deve vir pré-selecionada.
                    </p>
                </div>
            )}

            {['select', 'select-field'].includes(field.type) && (
                <div className="border border-dashed p-3 rounded-md bg-muted/20 space-y-3 mt-1">
                    <div className="flex items-center gap-2">
                        <Link className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs font-semibold text-muted-foreground">Dependência (Filtro Dinâmico)</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px]">Dep. de (Campo Pai)</Label>
                            <Select
                                value={field.dependency?.fieldId || 'none'}
                                onValueChange={(val) => {
                                    if (val === 'none') {
                                        update({ dependency: undefined });
                                    } else {
                                        if (hasCyclicDependency(field.id, val, allFields)) {
                                            alert(`Dependência circular detectada!\n"${field.id}" já é dependência de "${val}" (direta ou indiretamente).\n\nEscolha outro campo.`);
                                            return;
                                        }
                                        const suggested = suggestFilterProperty(val, allFields);
                                        update({
                                            dependency: {
                                                fieldId: val,
                                                filterProperty: field.dependency?.filterProperty || suggested,
                                            }
                                        });
                                    }
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Nenhum" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Nenhum --</SelectItem>
                                    {allFields
                                        .filter(f => f.id !== field.id)
                                        .map(f => (
                                            <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px]">Propriedade de Filtro</Label>
                            <Input
                                value={field.dependency?.filterProperty || ''}
                                onChange={(e) => update({
                                    dependency: {
                                        fieldId: field.dependency?.fieldId || '',
                                        filterProperty: e.target.value
                                    }
                                })}
                                placeholder={field.dependency?.fieldId ? suggestFilterProperty(field.dependency.fieldId, allFields) || "bairro_id" : "bairro_id"}
                                className="h-8 text-xs"
                                disabled={!field.dependency?.fieldId}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        * Filtra as opções deste campo baseado no valor selecionado no campo pai.
                    </p>
                </div>
            )}

            <div className="flex items-center space-x-2">
                <Switch
                    id={`required-${field.id}`}
                    checked={field.required}
                    onCheckedChange={(checked) => update({ required: checked })}
                />
                <Label htmlFor={`required-${field.id}`} className="text-sm">Obrigatório</Label>
            </div>

            {['date', 'time', 'datetime-local'].includes(field.type) && (
                <div className="flex items-center space-x-2">
                    <Switch
                        id={`autocurrent-${field.id}`}
                        checked={field.autoCurrent || field.defaultToNow}
                        onCheckedChange={(checked) => update({
                            autoCurrent: checked,
                            defaultToNow: checked
                        })}
                    />
                    <Label htmlFor={`autocurrent-${field.id}`} className="text-sm">
                        {field.type === 'time' ? 'Usar Hora Atual' : 'Usar Data Atual'}
                    </Label>
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs">Largura no Grid</Label>
                <Select
                    value={String(field.config?.layout?.colSpan || 'auto')}
                    onValueChange={(val) => {
                        const colSpan = val === 'auto' ? undefined : Number(val);
                        update({
                            config: {
                                ...field.config,
                                layout: { ...(field.config?.layout || {}), colSpan }
                            }
                        });
                    }}
                >
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Automático</SelectItem>
                        <SelectItem value="1">Metade (6 colunas)</SelectItem>
                        <SelectItem value="2">Largura total (12 colunas)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Automático: detecta pelo tipo do campo</p>
            </div>

            {['group', 'repeatable_group'].includes(field.type) && (
                <div className="space-y-3 border border-dashed p-3 rounded-md bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-semibold text-muted-foreground">Configuração do Grupo</Label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px]">Rótulo do Item</Label>
                            <Input
                                value={field.config?.itemLabel || 'Item'}
                                onChange={(e) => update({ config: { ...field.config, itemLabel: e.target.value || 'Item' } })}
                                placeholder="Ex: Membro, Produto"
                                className="h-8 text-xs"
                            />
                        </div>

                        {field.type === 'repeatable_group' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px]">Mínimo de Itens</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={field.config?.minItems ?? 0}
                                        onChange={(e) => {
                                            const min = parseInt(e.target.value) || 0;
                                            const max = field.config?.maxItems;
                                            if (max !== undefined && max !== Infinity && min > max) {
                                                alert(`Mínimo (${min}) não pode ser maior que o máximo (${max}).`);
                                                return;
                                            }
                                            update({ config: { ...field.config, minItems: min } });
                                        }}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px]">Máximo de Itens</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={field.config?.maxItems && isFinite(field.config.maxItems) ? field.config.maxItems : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            const max = raw === '' ? undefined : parseInt(raw);
                                            const min = field.config?.minItems ?? 0;
                                            if (max !== undefined && max < min) {
                                                alert(`Máximo (${max}) não pode ser menor que o mínimo (${min}).`);
                                                return;
                                            }
                                            update({ config: { ...field.config, maxItems: max } });
                                        }}
                                        placeholder="Ilimitado"
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px]">Texto do Botão Adicionar</Label>
                                    <Input
                                        value={field.config?.addButtonLabel || 'Adicionar Item'}
                                        onChange={(e) => update({ config: { ...field.config, addButtonLabel: e.target.value || 'Adicionar Item' } })}
                                        placeholder="Adicionar Item"
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px]">Texto do Botão Remover</Label>
                                    <Input
                                        value={field.config?.removeButtonLabel || 'Remover'}
                                        onChange={(e) => update({ config: { ...field.config, removeButtonLabel: e.target.value || 'Remover' } })}
                                        placeholder="Remover"
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="space-y-2 mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">
                                Campos do Grupo ({field.campos?.length || 0})
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                                    const newSubField: FormField = {
                                        id: `${field.id}_sub_${uid}`,
                                        type: 'text',
                                        label: 'Novo Campo',
                                        required: false
                                    };
                                    update({ campos: [...(field.campos || []), newSubField] });
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Adicionar Campo
                            </Button>
                        </div>

                        {field.campos && field.campos.length > 0 && (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {field.campos.map((subField, subIndex) => (
                                    <div key={subField.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{subField.label || subField.id}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {subField.type} • {subField.id}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => {
                                                const camposUpdate = [...(field.campos || [])];
                                                camposUpdate.splice(subIndex, 1);
                                                update({ campos: camposUpdate });
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(!field.campos || field.campos.length === 0) && (
                            <p className="text-[10px] text-muted-foreground text-center py-2">
                                Nenhum campo adicionado. Clique em &quot;Adicionar Campo&quot; para criar subcampos.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <Separator className="my-4" />

            <VisibilityRulesEditor
                fields={allFields}
                currentFieldIndex={index}
                rules={field.visibility}
                onChange={(rules) => update({ visibility: rules })}
                label="Condição de Visibilidade"
                description="Campo só aparece quando as condições são atendidas"
                descriptionOff="Campo sempre visível"
            />

            <Separator className="my-4" />

            <VisibilityRulesEditor
                fields={allFields}
                currentFieldIndex={index}
                rules={field.enabled}
                onChange={(rules) => update({ enabled: rules })}
                label="Condição de Habilitação (Read-Only)"
                description="Campo fica editável quando as condições são atendidas"
                descriptionOff="Campo sempre editável"
                sectionLabel="Habilitar quando:"
            />
        </div>
    );
}
