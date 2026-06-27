"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormRegistry, FormContent, FormField } from "@/types";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { VisualEditor } from "./VisualEditor";
import { JsonEditor } from "./JsonEditor";
import { Save, ArrowLeft, Play, PanelLeftClose, PanelLeftOpen, Settings, Eye, Code, Plus, Clock, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { FormAccessModal } from "./FormAccessModal";
import { useDataRegistryTypesNew as useDataRegistryTypes } from "@/src/interface/hooks/catalog/data-registry";
import { fetchFormByIdOrSlug, updateFormRegistry, insertFormRegistry } from "@/src/interface/hooks/queries/lookups";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SchemaEditorProps {
    initialData?: FormRegistry;
    isNew?: boolean;
}

// Field definitions grouped by category
const FIELD_GROUPS = [
    {
        id: "basic",
        label: "Básicos",
        fields: [
            { type: "text", label: "Texto Curto", icon: "T" },
            { type: "textarea", label: "Texto Longo", icon: "📝" },
            { type: "number", label: "Número", icon: "#" },
            { type: "email", label: "Email", icon: "@" },
            { type: "tel", label: "Telefone", icon: "📞" },
            { type: "url", label: "URL", icon: "🔗" },
            { type: "password", label: "Senha", icon: "🔒" },
            { type: "hidden", label: "Campo Oculto", icon: "👁️‍🗨️" },
            { type: "timestamp", label: "Carimbo de Tempo", icon: "⏱️" },
            { type: "date", label: "Data", icon: "📅" },
            { type: "time", label: "Hora", icon: "🕒" },
            { type: "datetime-local", label: "Data e Hora", icon: "⏱" },
            { type: "photo", label: "Foto / Câmera", icon: "📷" },
            { type: "gallery", label: "Galeria de Fotos", icon: "🎞️" },
        ]
    },
    {
        id: "selection",
        label: "Seleção",
        fields: [
            { type: "select", label: "Lista Suspensa", icon: "▼" },
            { type: "radio", label: "Opção Única", icon: "◉" },
            { type: "checkbox", label: "Múltipla Escolha", icon: "☑" },
            { type: "chips", label: "Chips (Seleção)", icon: "🏷️" },
            { type: "chips_multiple", label: "Chips (Múltiplo)", icon: "🏷️" },
        ]
    },
    {
        id: "special",
        label: "Especializados",
        fields: [
            { type: "occupation", label: "Ocupação", icon: "👤" },
            { type: "presence", label: "Presença", icon: "✓" },
            { type: "checklist", label: "Checklist", icon: "☐" },
            { type: "gps", label: "GPS", icon: "📍" },
        ]
    },
    {
        id: "groups",
        label: "Grupos",
        fields: [
            { type: "group", label: "Grupo Estático", icon: "📁" },
            { type: "repeatable_group", label: "Grupo Repetível", icon: "🔄" },
        ]
    }
];

function DataRegistryTypeSelector({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const { types, loading } = useDataRegistryTypes();
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione um tipo"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="">-- Nenhum --</SelectItem>
                {types.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function DataSourcesTabContent({ formId }: { formId: string }) {
    const { types, loading: typesLoading } = useDataRegistryTypes();
    const [dataSourceTypes, setDataSourceTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [newType, setNewType] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!formId) return;
        let cancelled = false;
        setLoading(true);
        getContainerAsync()
            .then(db => db.dataRegistry.resolveFormDataSourceTypes.execute(formId))
            .then(result => {
                if (!cancelled) setDataSourceTypes(result);
            })
            .catch(() => {
                if (!cancelled) setDataSourceTypes([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [formId]);

    const handleCreateType = async () => {
        if (!newType.trim()) return;
        setSaving(true);
        try {
            const db = await getContainerAsync();
            await db.dataRegistry.create.execute({ tipo: newType.trim(), conteudo: {} });
            setNewType("");
            alert(`Tipo "${newType}" criado com sucesso.`);
        } catch (e) {
            alert(`Erro ao criar tipo: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    const usedTypesSet = new Set(dataSourceTypes);
    const unusedTypes = types.filter(t => !usedTypesSet.has(t));

    return (
        <Card className="bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg">Data Sources</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Gerencie tipos do Data Registry usados por este formulário
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Create new type */}
                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Criar Novo Tipo</Label>
                    <div className="flex gap-2">
                        <Input
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            placeholder="Ex: equipamentos, fornecedores"
                            className="h-9"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
                        />
                        <Button onClick={handleCreateType} disabled={saving || !newType.trim()} size="sm">
                            Criar
                        </Button>
                    </div>
                </div>

                {/* Used types */}
                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tipos Usados neste Formulário</Label>
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : dataSourceTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum tipo do Data Registry é usado pelos campos deste formulário.</p>
                    ) : (
                        <div className="space-y-1">
                            {dataSourceTypes.map(t => (
                                <div key={t} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-sm">
                                    <span className="font-mono">{t}</span>
                                    <span className="text-xs text-green-600">✓ em uso</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available types */}
                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tipos Disponíveis (não usados)</Label>
                    {typesLoading ? (
                        <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : unusedTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Todos os tipos estão em uso ou não há tipos cadastrados.</p>
                    ) : (
                        <div className="space-y-1">
                            {unusedTypes.map(t => (
                                <div key={t} className="flex items-center justify-between p-2 bg-muted/30 border rounded text-sm">
                                    <span className="font-mono">{t}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// Flattened list for lookups
const ALL_FIELDS = FIELD_GROUPS.flatMap(group => group.fields);

export function SchemaEditor({ initialData, isNew = false }: SchemaEditorProps) {
    const router = useRouter();
    const { user, permissions } = useAuth();
    const [saving, setSaving] = useState(false);
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
    const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);

    // Form Metadata State
    const [formId, setFormId] = useState(initialData?.form_id || "");
    const [title, setTitle] = useState(initialData?.titulo || "");
    const [version, setVersion] = useState(initialData?.versao || 1);
    const [autoApproval, setAutoApproval] = useState(initialData?.auto_aprovacao || false);
    const [adHoc, setAdHoc] = useState<boolean>(Boolean(initialData?.ad_hoc));
    const [dataId, setDataId] = useState<string>(initialData?.data_id || '');

    // Schema State
    const defaultContent: FormContent = {
        id: initialData?.form_id || "",
        titulo: initialData?.titulo || "",
        campos: [],
        layout: initialData?.conteudo?.layout || { columns: 2, gap: 'md' }
    };

    const [content, setContent] = useState<FormContent>(initialData?.conteudo || defaultContent);
    const [activeTab, setActiveTab] = useState("visual");
    const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
    const [hasDraftRestored, setHasDraftRestored] = useState(false);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const draftKey = `form_draft_${formId || "__new__"}`;

    // Restaurar rascunho ao abrir (apenas se não houver dados iniciais salvos)
    useEffect(() => {
        if (hasDraftRestored) return;
        setHasDraftRestored(true);
        try {
            const raw = localStorage.getItem(draftKey);
            if (!raw) return;
            const draft = JSON.parse(raw);
            const draftDate = new Date(draft._savedAt);
            const initialDate = initialData?.atualizado_em ? new Date(initialData.atualizado_em) : null;
            // Só restaurar se o rascunho é mais recente que o último save do banco
            if (!initialDate || draftDate > initialDate) {
                const confirmed = window.confirm(
                    `Há um rascunho não salvo de ${draftDate.toLocaleString()}.\n\nDeseja restaurá-lo?`
                );
                if (confirmed) {
                    if (draft.title) setTitle(draft.title);
                    if (draft.version) setVersion(draft.version);
                    if (draft.autoApproval !== undefined) setAutoApproval(draft.autoApproval);
                    if (draft.adHoc !== undefined) setAdHoc(draft.adHoc);
                    if (draft.content) setContent(draft.content);
                    setDraftSavedAt(draftDate);
                } else {
                    localStorage.removeItem(draftKey);
                }
            }
        } catch {
            // rascunho corrompido — ignorar
        }
    }, [draftKey, hasDraftRestored, initialData?.atualizado_em]);

    // Auto-save com debounce de 2s
    useEffect(() => {
        if (!hasDraftRestored) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            try {
                const draft = { title, version, autoApproval, adHoc, content, _savedAt: new Date().toISOString() };
                localStorage.setItem(draftKey, JSON.stringify(draft));
                setDraftSavedAt(new Date());
            } catch {
                // quota exceeded — silencioso
            }
        }, 2000);
        return () => {
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        };
    }, [title, version, autoApproval, adHoc, content, draftKey, hasDraftRestored]);

    const handleVisualChange = (newCampos: FormField[]) => {
        setContent({ ...content, campos: newCampos });
    };

    const handleLayoutChange = (newLayout: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' }) => {
        setContent({
            ...content,
            layout: {
                columns: newLayout.columns || content.layout?.columns || 2,
                gap: newLayout.gap || content.layout?.gap || 'md'
            }
        });
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const newCampos = [...content.campos];
        newCampos[index] = { ...newCampos[index], ...updates };
        setContent({ ...content, campos: newCampos });
    };

    const handleJsonChange = (jsonString: string) => {
        try {
            const parsed = JSON.parse(jsonString);
            setContent(parsed);
        } catch (e) {
            // Error handling is done inside JsonEditor
        }
    };

    const addFieldFromPalette = (fieldType: string) => {
        const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const newField: FormField = {
            id: `field_${uid}`,
            type: fieldType,
            label: `Novo ${ALL_FIELDS.find(f => f.type === fieldType)?.label || "Campo"}`,
            required: false
        };
        const newFields = [...(content.campos || []), newField];
        setContent({ ...content, campos: newFields });
        setSelectedFieldIndex(newFields.length - 1);
    };

    const handleSave = async () => {
        if (!formId || !title) {
            alert("Preencha o ID e o Título do formulário.");
            return;
        }

        setSaving(true);

        // Check permissions before attempting to save
        if (!user) {
            alert("Erro: Usuário não autenticado. Faça login para salvar formulários.");
            setSaving(false);
            return;
        }

        if (!permissions.hasPermission("forms.create")) {
            alert("Erro: Você não tem permissão para criar formulários. Contate um administrador.");
            setSaving(false);
            return;
        }

        try {
            // Prepare payload
            const finalContent = { ...content, id: formId, titulo: title };

            const payload = {
                form_id: formId,
                titulo: title,
                versao: version,
                conteudo: JSON.stringify(finalContent), // Stringify for SQLite
                criado_em: initialData?.criado_em || new Date().toISOString(),
                atualizado_em: new Date().toISOString(),
                slug: formId,
                ativo: 1, // boolean to int
                auto_aprovacao: autoApproval ? 1 : 0,
                ad_hoc: adHoc ? 1 : 0,
                data_id: dataId || null,
            };

            // Verifica se já existe (via catalog)
            const existing = await fetchFormByIdOrSlug(formId);
            const exists = existing !== null;

            // Prepare Parameters
            const nowIso = new Date().toISOString();

            if (exists) {
                await updateFormRegistry({
                    titulo: payload.titulo,
                    versao: payload.versao,
                    conteudo: payload.conteudo,
                    atualizado_em: payload.atualizado_em,
                    slug: payload.slug,
                    ativo: payload.ativo,
                    auto_aprovacao: payload.auto_aprovacao,
                    ad_hoc: payload.ad_hoc,
                    data_id: payload.data_id,
                    form_id: formId,
                });
            } else {
                await insertFormRegistry({
                    form_id: payload.form_id,
                    titulo: payload.titulo,
                    versao: payload.versao,
                    conteudo: payload.conteudo,
                    criado_em: payload.criado_em,
                    atualizado_em: payload.atualizado_em,
                    slug: payload.slug,
                    ativo: payload.ativo,
                    auto_aprovacao: payload.auto_aprovacao,
                    ad_hoc: payload.ad_hoc,
                    data_id: payload.data_id,
                });
            }

            // Limpar rascunho após salvar com sucesso
            localStorage.removeItem(draftKey);
            setDraftSavedAt(null);
            alert("Formulário salvo com sucesso!");
            if (isNew) {
                router.push(`/forms/edit?id=${formId}`);
            }
        } catch (error: unknown) {
            console.error("Erro ao salvar:", error);
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            alert(`Erro ao salvar: ${message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="fixed inset-0 flex flex-col bg-background">
            {/* Top Header Bar */}
            <div className="border-b bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/forms">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Separator orientation="vertical" className="h-6" />
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                                title="Toggle Paleta"
                            >
                                {leftSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                            </Button>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Título do Formulário"
                                className="w-64 h-9"
                            />
                            <span className="text-sm text-muted-foreground">v{version}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <TabsList className="h-9">
                            <TabsTrigger value="visual" className="text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                Visual
                            </TabsTrigger>
                            <TabsTrigger value="json" className="text-xs">
                                <Code className="h-3 w-3 mr-1" />
                                JSON
                            </TabsTrigger>
                            <TabsTrigger value="datasources" className="text-xs">
                                <Database className="h-3 w-3 mr-1" />
                                Data Sources
                            </TabsTrigger>
                        </TabsList>
                        <Separator orientation="vertical" className="h-6" />
                        {!isNew && (
                            <FormAccessModal formId={formId} formTitle={title} />
                        )}
                        {!isNew && (
                            <Button variant="outline" size="sm" onClick={() => router.push(`/run?id=${formId}`)}>
                                <Play className="mr-2 h-3 w-3" /> Testar
                            </Button>
                        )}
                        {draftSavedAt && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1" title={`Rascunho local salvo às ${draftSavedAt.toLocaleTimeString()}`}>
                                <Clock className="h-3 w-3" />
                                Rascunho
                            </span>
                        )}
                        <Button onClick={handleSave} disabled={saving} size="sm">
                            <Save className="mr-2 h-3 w-3" />
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                            title="Toggle Propriedades"
                            className="h-9 w-9"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Field Palette */}
                {leftSidebarOpen && (
                    <div className="w-64 border-r bg-card flex flex-col">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-sm flex items-center">
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Campos
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Clique para adicionar ao formulário
                            </p>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-3">
                                <Accordion type="multiple" defaultValue={["basic", "selection", "special"]} className="w-full">
                                    {FIELD_GROUPS.map((group) => (
                                        <AccordionItem key={group.id} value={group.id} className="border-b-0 mb-2">
                                            <AccordionTrigger className="py-2 px-2 hover:bg-muted/50 rounded-md text-sm font-semibold">
                                                {group.label}
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-1 pb-2">
                                                <div className="space-y-1">
                                                    {group.fields.map((fieldType) => (
                                                        <Button
                                                            key={fieldType.type}
                                                            variant="outline"
                                                            className="w-full justify-start h-auto py-2 px-3"
                                                            onClick={() => addFieldFromPalette(fieldType.type)}
                                                        >
                                                            <span className="text-lg mr-3 w-5 text-center">{fieldType.icon}</span>
                                                            <div className="text-left">
                                                                <div className="font-medium text-sm">{fieldType.label}</div>
                                                            </div>
                                                        </Button>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Center - Main Editor */}
                <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
                    <TabsContent value="visual" className="flex-1 m-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="max-w-4xl mx-auto py-6 px-4">
                                <Card className="bg-white shadow-sm">
                                    <CardHeader className="space-y-1">
                                        <CardTitle className="text-2xl">{title || "Novo Formulário"}</CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {content.campos?.length || 0} campos · ID: {formId || "não definido"}
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <VisualEditor
                                            fields={content.campos}
                                            onChange={handleVisualChange}
                                            selectedIndex={selectedFieldIndex}
                                            onSelectField={setSelectedFieldIndex}
                                            formLayout={content.layout}
                                            onFormLayoutChange={handleLayoutChange}
                                        />
                                        {(!content.campos || content.campos.length === 0) && (
                                            <div className="text-center py-12 text-muted-foreground">
                                                <p className="mb-2">Nenhum campo adicionado ainda</p>
                                                <p className="text-sm">Use a paleta à esquerda para adicionar campos</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="json" className="flex-1 m-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="max-w-4xl mx-auto py-6 px-4">
                                <Card className="bg-white shadow-sm">
                                    <CardContent className="p-6">
                                        <JsonEditor
                                            value={JSON.stringify(content, null, 2)}
                                            onChange={handleJsonChange}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="datasources" className="flex-1 m-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="max-w-4xl mx-auto py-6 px-4">
                                <DataSourcesTabContent formId={formId} />
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </div>

                {/* Right Sidebar - Properties Panel */}
                {rightSidebarOpen && (
                    <div className="w-80 border-l bg-card flex flex-col">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-sm flex items-center">
                                <Settings className="h-4 w-4 mr-2" />
                                Configurações
                            </h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6">
                                {/* Form Metadata */}
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase">
                                            Metadados do Formulário
                                        </Label>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label className="text-sm">ID (Slug)</Label>
                                            <Input
                                                value={formId}
                                                onChange={(e) => setFormId(e.target.value)}
                                                disabled={!isNew}
                                                placeholder="ecopontoForm"
                                                className="h-9"
                                            />
                                            {!isNew && (
                                                <p className="text-xs text-muted-foreground">
                                                    Não pode ser alterado
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm">Versão</Label>
                                            <Input
                                                type="number"
                                                value={version}
                                                onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
                                                placeholder="1"
                                                className="h-9"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Incremente para atualizar
                                            </p>

                                        </div>

                                        <div className="flex items-center space-x-2 pt-2">
                                            <Switch
                                                id="auto-approval"
                                                checked={autoApproval}
                                                onCheckedChange={setAutoApproval}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="auto-approval">Auto-Aprovação</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Formulários já nascem aprovados
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 pt-2">
                                            <Switch
                                                id="ad-hoc"
                                                checked={adHoc}
                                                onCheckedChange={setAdHoc}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="ad-hoc">Modo Ad Hoc</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Permite preencher sem vínculo a uma tarefa
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <Label className="text-sm">Output Data Registry (data_id)</Label>
                                            <DataRegistryTypeSelector
                                                value={dataId}
                                                onChange={setDataId}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Vincula este formulário a um tipo do Data Registry para write-back
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Field Properties */}
                                {selectedFieldIndex !== null && content.campos[selectedFieldIndex] ? (
                                    <div className="space-y-6">
                                        <div>
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase">
                                                Campo Selecionado
                                            </Label>
                                            <div className="mt-2 rounded-md border p-3 bg-muted/50">
                                                <p className="text-sm font-medium">
                                                    {content.campos[selectedFieldIndex].label}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Tipo: {content.campos[selectedFieldIndex].type}
                                                </p>
                                            </div>
                                        </div>

                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        Selecione um campo para ver suas propriedades
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )
                }
            </div >
        </Tabs >
    );
}
