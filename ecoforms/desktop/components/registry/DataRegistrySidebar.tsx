import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Database } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useDataRegistryTypesNew as useDataRegistryTypes, useDataRegistryTypeCountsNew as useDataRegistryTypeCounts } from "@/src/interface/hooks/catalog/data-registry";

interface DataRegistrySidebarProps {
    selectedType: string | null;
    onSelectType: (type: string) => void;
    onNewType?: (type: string) => void;
}

export function DataRegistrySidebar({ selectedType, onSelectType, onNewType }: DataRegistrySidebarProps) {
    const { types, loading } = useDataRegistryTypes();
    const { counts } = useDataRegistryTypeCounts();
    const [showNewType, setShowNewType] = useState(false);
    const [newTypeName, setNewTypeName] = useState("");

    useEffect(() => {
        if (!selectedType && types.length > 0) {
            onSelectType(types[0]);
        }
    }, [types, selectedType, onSelectType]);

    const handleAddType = () => {
        const name = newTypeName.trim().toLowerCase().replace(/\s+/g, "_");
        if (name) {
            onSelectType(name);
            if (!types.includes(name)) {
                onNewType?.(name);
            }
        }
        setNewTypeName("");
        setShowNewType(false);
    };

    return (
        <div className="w-[250px] border-r border-gray-200 bg-gray-50/50 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <span className="font-semibold text-gray-700 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Tipos
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowNewType(!showNewType)}
                    title="Novo tipo"
                >
                    <Plus className="w-3.5 h-3.5" />
                </Button>
            </div>

            {showNewType && (
                <div className="p-2 border-b border-gray-200 flex gap-1">
                    <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="Nome do tipo"
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleAddType()}
                        autoFocus
                    />
                    <Button size="sm" className="h-8 px-2" onClick={handleAddType}>OK</Button>
                </div>
            )}

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {types.map((type) => (
                        <Button
                            key={type}
                            variant={selectedType === type ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-between text-sm font-normal",
                                selectedType === type ? "bg-white shadow-sm font-medium" : "text-gray-600 hover:bg-gray-200/50"
                            )}
                            onClick={() => onSelectType(type)}
                        >
                            <span className="truncate">{type}</span>
                            {counts.has(type) && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-gray-100 text-gray-500 font-normal">
                                    {counts.get(type)}
                                </Badge>
                            )}
                        </Button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
