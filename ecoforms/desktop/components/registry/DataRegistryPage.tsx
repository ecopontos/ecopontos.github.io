import { useState, useMemo } from "react";
import { DataRegistrySidebar } from "./DataRegistrySidebar";
import { DataRegistryList } from "./DataRegistryList";
import { DataRegistryEditor } from "./DataRegistryEditor";
import { DataRegistryImport } from "./DataRegistryImport";
import { useDataRegistryUseCases } from "@/src/interface/hooks/catalog/data-registry";
import { useDataRegistryItemsNew as useDataRegistryItems } from "@/src/interface/hooks/catalog/data-registry";
import type { DataRegistryItemView } from "@/src/interface/hooks/catalog/data-registry";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";
import { detectSchemaFromItems } from "@/src/lib/registry-schema";
import { toast } from "sonner";
import { useFormDependencies } from "@/src/interface/hooks/queries/useFormDependencies";

interface DataRegistrySavePayload {
    id?: string;
    tipo: string;
    chave: string;
    versao: number;
    conteudo: Record<string, FormFieldValue>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function DataRegistryPage() {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<DataRegistryItemView | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const dr = useDataRegistryUseCases();

    // Fetch items for the selected type to derive schema
    const { items: currentItems } = useDataRegistryItems(selectedType);

    const { dependencies: formDependencies } = useFormDependencies(selectedType);

    const schema = useMemo(() => detectSchemaFromItems(currentItems), [currentItems]);

    const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

    const handleCreate = () => {
        setEditingItem(null);
        setIsEditorOpen(true);
    };

    const handleEdit = (item: DataRegistryItemView) => {
        setEditingItem(item);
        setIsEditorOpen(true);
    };

    const handleDelete = async (item: DataRegistryItemView) => {
        const itemName = item.conteudo?.nome || item.chave || 'item';

        if (formDependencies.length > 0) {
            const formList = formDependencies.map(f => `• ${f.titulo} (${f.form_id})`).join('\n');
            const confirmed = confirm(
                `⚠️ ATENÇÃO: O tipo "${selectedType}" é usado por ${formDependencies.length} formulário(is):\n\n${formList}\n\nExcluir este item pode causar opções vazias nesses formulários.\n\nDeseja continuar?`
            );
            if (!confirmed) return;
        }

        if (confirm(`Tem certeza que deseja excluir "${itemName}"?`)) {
            try {
                await dr.delete.execute(item.id);
                toast.success("Item excluído com sucesso.");
                triggerRefresh();
            } catch (error: unknown) {
                toast.error("Erro ao excluir: " + getErrorMessage(error, "erro desconhecido"));
            }
        }
    };

    const handleSave = async (itemData: DataRegistrySavePayload) => {
        try {
            await dr.save.execute({ id: itemData.id, tipo: itemData.tipo ?? selectedType ?? 'unknown', conteudo: itemData.conteudo });
            toast.success("Item salvo com sucesso.");
            triggerRefresh();
        } catch (error: unknown) {
            console.error("Save error:", error);
            throw error;
        }
    };

    const handleImport = () => {
        setIsImportOpen(true);
    };

    const handleImportComplete = () => {
        toast.success("Importação concluída.");
        triggerRefresh();
    };

    const handleNewType = (type: string) => {
        toast.info(`Tipo "${type}" criado. Adicione o primeiro item.`);
        setEditingItem(null);
        setIsEditorOpen(true);
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-white">
            <DataRegistrySidebar
                selectedType={selectedType}
                onSelectType={setSelectedType}
                onNewType={handleNewType}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="border-b border-gray-200 p-4 bg-white">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-800">Data Registry</h1>
                        {selectedType && formDependencies.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full" title={`${formDependencies.length} formulário(is) usam este tipo`}>
                                🔗 {formDependencies.length} form{formDependencies.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">Gerenciamento centralizado de dados do sistema</p>
                </div>

                <DataRegistryList
                    key={`${selectedType}-${refreshTrigger}`}
                    type={selectedType}
                    onCreate={handleCreate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onImport={handleImport}
                />
            </div>

            <DataRegistryEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                item={editingItem}
                type={selectedType || "unknown"}
                schema={schema}
                onSave={handleSave}
            />

            {selectedType && (
                <DataRegistryImport
                    open={isImportOpen}
                    onOpenChange={setIsImportOpen}
                    type={selectedType}
                    schema={schema}
                    onComplete={handleImportComplete}
                />
            )}
        </div>
    );
}
