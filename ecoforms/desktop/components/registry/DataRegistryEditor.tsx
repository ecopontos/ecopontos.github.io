/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Code, FormInput } from "lucide-react";
import { DynamicFormEditor } from "./DynamicFormEditor";
import type { FieldSchema } from "@/src/lib/registry-schema";
import type { DataRegistryItemView } from "@/src/interface/hooks/catalog/data-registry";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";

type RegistryContent = Record<string, FormFieldValue>;

interface DataRegistryEditorPayload {
    id?: string;
    tipo: string;
    chave: string;
    versao: number;
    conteudo: RegistryContent;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getStringValue(value: FormFieldValue | undefined, fallback: string = ""): string {
    return typeof value === "string" ? value : fallback;
}

interface DataRegistryEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: DataRegistryItemView | null;
    type: string;
    schema: FieldSchema[];
    onSave: (item: DataRegistryEditorPayload) => Promise<void>;
}

export function DataRegistryEditor({ open, onOpenChange, item, type, schema, onSave }: DataRegistryEditorProps) {
    const [formData, setFormData] = useState({
        nome: "",
        chave: "",
        ativo: true,
        versao: 1,
    });
    const [extraFields, setExtraFields] = useState<RegistryContent>({});
    const [jsonRaw, setJsonRaw] = useState("{\n  \n}");
    const [jsonMode, setJsonMode] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            if (item) {
                const content = item.conteudo || {};
                setFormData({
                    nome: getStringValue(content.nome),
                    chave: item.chave || "",
                    ativo: content.ativo !== false,
                    versao: item.versao || 1,
                });
                // Extract extra fields (everything except nome, ativo, id)
                const extra: RegistryContent = {};
                for (const [k, v] of Object.entries(content)) {
                    if (k !== "nome" && k !== "ativo" && k !== "id") extra[k] = v;
                }
                setExtraFields(extra);
                setJsonRaw(JSON.stringify(content, null, 2));
            } else {
                setFormData({ nome: "", chave: "", ativo: true, versao: 1 });
                setExtraFields({});
                setJsonRaw("{\n  \n}");
            }
            setJsonError(null);
            setJsonMode(false);
        }
    }, [open, item]);

    // Build full conteudo from form fields
    const buildConteudo = (): RegistryContent => {
        const content: RegistryContent = {
            id: formData.chave || undefined,
            nome: formData.nome,
            ativo: formData.ativo,
            ...extraFields,
        };
        return content;
    };

    // Switch between modes — sync data
    const toggleJsonMode = () => {
        if (jsonMode) {
            // Switching JSON → Form: parse JSON and populate fields
            try {
                const parsed = JSON.parse(jsonRaw) as RegistryContent;
                setFormData({
                    nome: typeof parsed.nome === "string" ? parsed.nome : formData.nome,
                    chave: formData.chave,
                    ativo: parsed.ativo !== false,
                    versao: formData.versao,
                });
                const extra: RegistryContent = {};
                for (const [k, v] of Object.entries(parsed)) {
                    if (k !== "nome" && k !== "ativo" && k !== "id") extra[k] = v;
                }
                setExtraFields(extra);
                setJsonError(null);
            } catch (e: unknown) {
                setJsonError("JSON Inválido — corrija antes de voltar ao formulário: " + getErrorMessage(e, "erro desconhecido"));
                return;
            }
        } else {
            // Switching Form → JSON: serialize current fields
            setJsonRaw(JSON.stringify(buildConteudo(), null, 2));
        }
        setJsonMode(!jsonMode);
    };

    const handleSave = async () => {
        setJsonError(null);

        let parsedContent: RegistryContent;
        if (jsonMode) {
            try {
                parsedContent = JSON.parse(jsonRaw) as RegistryContent;
            } catch (e: unknown) {
                setJsonError("JSON Inválido: " + getErrorMessage(e, "erro desconhecido"));
                return;
            }
            // Enforce nome/ativo from form header
            parsedContent.nome = formData.nome;
            parsedContent.ativo = formData.ativo;
        } else {
            parsedContent = buildConteudo();
        }

        if (!formData.nome || !formData.chave) {
            setJsonError("Nome e Chave (ID) são obrigatórios.");
            return;
        }

        if (!parsedContent.id) parsedContent.id = formData.chave;

        setIsSaving(true);
        try {
            const payload: DataRegistryEditorPayload = {
                tipo: type,
                chave: formData.chave,
                versao: formData.versao,
                conteudo: parsedContent,
            };

            if (item && item.id) {
                payload.id = item.id;
            }

            await onSave(payload);
            onOpenChange(false);
        } catch (error: unknown) {
            setJsonError("Erro ao salvar: " + getErrorMessage(error, "erro desconhecido"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{item ? "Editar Item" : "Novo Item"} ({type})</DialogTitle>
                    <DialogDescription>
                        {jsonMode
                            ? "Edite o conteúdo JSON diretamente."
                            : "Preencha os campos do formulário."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
                    {/* Fixed header fields — always visible */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nome">Nome <span className="text-red-500">*</span></Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Centro"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="chave">Chave (ID único) <span className="text-red-500">*</span></Label>
                            <Input
                                id="chave"
                                value={formData.chave}
                                onChange={(e) => setFormData({ ...formData, chave: e.target.value })}
                                placeholder="Ex: centro_fln"
                                disabled={!!item}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="ativo"
                                checked={formData.ativo}
                                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                            />
                            <Label htmlFor="ativo">Ativo</Label>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="versao">Versão</Label>
                            <Input
                                id="versao"
                                type="number"
                                value={formData.versao}
                                onChange={(e) => setFormData({ ...formData, versao: parseInt(e.target.value) || 1 })}
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                        {/* Mode toggle */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                                {jsonMode ? "Conteúdo (JSON)" : "Campos"}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleJsonMode}
                                className="text-xs h-7 gap-1.5"
                            >
                                {jsonMode ? <FormInput className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                                {jsonMode ? "Modo Formulário" : "Modo JSON"}
                            </Button>
                        </div>

                        {jsonMode ? (
                            <Textarea
                                className="font-mono text-xs min-h-[300px] resize-none"
                                value={jsonRaw}
                                onChange={(e) => setJsonRaw(e.target.value)}
                            />
                        ) : (
                            <DynamicFormEditor
                                schema={schema}
                                values={extraFields}
                                onChange={setExtraFields}
                            />
                        )}
                    </div>

                    {jsonError && (
                        <div className="text-red-600 text-sm flex items-center gap-2 bg-red-50 p-2 rounded">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {jsonError}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Salvando..." : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
