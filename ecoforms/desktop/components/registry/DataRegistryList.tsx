/* eslint-disable react-hooks/set-state-in-render, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, react-hooks/static-components */
import { useState, useMemo } from "react";
import { useDataRegistryItemsNew as useDataRegistryItems, useDataRegistryUseCases } from "@/src/interface/hooks/catalog/data-registry";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit2, Trash2, Plus, Search, RefreshCw, Filter, Upload, Download, Columns, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FilePlus } from "lucide-react";
import { flattenRegistryItems } from "@/src/lib/registry-schema";
import ExcelJS from "exceljs";
import { useTauriDialog } from "@/src/interface/hooks/catalog/tauri";
import { useTauriFs } from "@/src/interface/hooks/catalog/tauri";
import { toast } from "sonner";
import type { DataRegistryItemView } from "@/src/interface/hooks/catalog/data-registry";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function getNomeValue(item: DataRegistryItemView): string {
    const nome = item.conteudo?.nome;
    return typeof nome === "string" ? nome : "";
}

interface DataRegistryListProps {
    type: string | null;
    onEdit: (item: DataRegistryItemView) => void;
    onDelete: (item: DataRegistryItemView) => void;
    onCreate: () => void;
    onImport: () => void;
}

const PAGE_SIZE = 20;

export function DataRegistryList({ type, onEdit, onDelete, onCreate, onImport }: DataRegistryListProps) {
    const { items: rawItems, loading, refetch } = useDataRegistryItems(type);
    const dr = useDataRegistryUseCases();
    const { save } = useTauriDialog();
    const { writeFile } = useTauriFs();

    const items = useMemo(() => {
        return [...rawItems].sort((a, b) => {
            const nameA = getNomeValue(a);
            const nameB = getNomeValue(b);
            return nameA.localeCompare(nameB);
        });
    }, [rawItems]);

    const [search, setSearch] = useState("");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [filters, setFilters] = useState<{ id: string; field: string; value: string }[]>([]);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Column visibility
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());

    // Sorting
    const [sortColumn, setSortColumn] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    const availableFields = useMemo(() => {
        const keys = new Set<string>();
        items.forEach(item => {
            if (item.conteudo && typeof item.conteudo === 'object') {
                Object.keys(item.conteudo).forEach(key => {
                    if (key !== 'nome' && key !== 'ativo' && key !== 'id') {
                        keys.add(key);
                    }
                });
            }
        });
        const sorted = Array.from(keys).sort();
        // Default: show first 3 extra fields
        if (visibleColumns.size === 0 && sorted.length > 0) {
            setVisibleColumns(new Set(sorted.slice(0, 3)));
        }
        return sorted;
    }, [items]);

    const toggleColumn = (field: string) => {
        const next = new Set(visibleColumns);
        if (next.has(field)) {
            next.delete(field);
        } else {
            next.add(field);
        }
        setVisibleColumns(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredItems.map(i => i.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const confirmed = confirm(`Excluir ${selectedIds.size} item(ns) selecionados?`);
        if (!confirmed) return;
        let successCount = 0;
        let errorCount = 0;
        for (const id of selectedIds) {
            try {
                await dr.delete.execute(id);
                successCount++;
            } catch {
                errorCount++;
            }
        }
        setSelectedIds(new Set());
        if (errorCount === 0) {
            toast.success(`${successCount} item(ns) excluído(s).`);
        } else {
            toast.error(`${successCount} excluído(s), ${errorCount} erro(s).`);
        }
        refetch();
    };

    const handleRefresh = () => {
        refetch();
    };

    const addFilter = () => {
        setFilters([...filters, { id: Math.random().toString(36).substr(2, 9), field: "", value: "" }]);
    };

    const removeFilter = (id: string) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id: string, key: 'field' | 'value', val: string) => {
        setFilters(filters.map(f => f.id === id ? { ...f, [key]: val } : f));
    };

    const filteredItems = useMemo(() => {
        const result = items.filter(item => {
            const nome = getNomeValue(item);
            const chave = item.chave || "";
            const matchesSearch = nome.toLowerCase().includes(search.toLowerCase()) ||
                chave.toLowerCase().includes(search.toLowerCase());
            if (!matchesSearch) return false;
            for (const filter of filters) {
                if (!filter.field) continue;
                const itemValue = item.conteudo?.[filter.field];
                if (itemValue === undefined || itemValue === null) return false;
                const stringVal = String(itemValue).toLowerCase();
                const filterVal = filter.value.toLowerCase();
                if (!stringVal.includes(filterVal)) return false;
            }
            return true;
        });

        // Sort
        result.sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (sortColumn === "nome") {
                valA = getNomeValue(a);
                valB = getNomeValue(b);
            } else if (sortColumn === "chave") {
                valA = a.chave || "";
                valB = b.chave || "";
            } else if (sortColumn === "atualizado_em") {
                valA = a.atualizado_em || "";
                valB = b.atualizado_em || "";
            } else {
                valA = String(a.conteudo?.[sortColumn] ?? "");
                valB = String(b.conteudo?.[sortColumn] ?? "");
            }

            const cmp = typeof valA === "number" && typeof valB === "number"
                ? valA - valB
                : String(valA).localeCompare(String(valB));

            return sortDirection === "asc" ? cmp : -cmp;
        });

        return result;
    }, [items, search, filters, sortColumn, sortDirection]);

    const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
    const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortColumn !== column) return <ChevronLeft className="w-3 h-3 text-gray-400" />;
        return sortDirection === "asc"
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />;
    };

    const sanitizeSheetName = (name: string) => {
        return name.replace(/[:\\?\/\*\[\]]/g, " ").trim().slice(0, 31) || "DataRegistry";
    };

    const sanitizeFileName = (name: string) => {
        return name.replace(/[^a-zA-Z0-9-_ ]+/g, "_").trim().replace(/\s+/g, "_").slice(0, 50) || "data_registry";
    };

    const handleExport = async () => {
        if (!type || filteredItems.length === 0) return;
        try {
            const { columns, rows } = flattenRegistryItems(filteredItems);
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet(sanitizeSheetName(type));
            ws.addRow(columns);
            rows.forEach(row => ws.addRow(columns.map(col => row[col] ?? '')));
            const date = new Date().toISOString().slice(0, 10);
            const defaultName = `${sanitizeFileName(type)}_${date}.xlsx`;
            const filePath = await save({
                defaultPath: defaultName,
                filters: [{ name: "Excel", extensions: ["xlsx"] }],
                title: "Exportar XLSX",
            });
            if (!filePath) return;
            const buffer = await wb.xlsx.writeBuffer();
            await writeFile(filePath, new Uint8Array(buffer as ArrayBuffer));
            toast.success("Arquivo exportado com sucesso.");
        } catch (err: unknown) {
            toast.error("Erro ao exportar: " + getErrorMessage(err, "erro desconhecido"));
        }
    };

    if (!type) {
        return <div className="flex-1 flex items-center justify-center text-gray-400">Selecione um tipo de dado.</div>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white">
            <div className="p-4 border-b border-gray-200 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Buscar por nome ou chave..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                <Trash2 className="w-4 h-4 mr-1" /> Excluir ({selectedIds.size})
                            </Button>
                        )}
                        <Button
                            variant={isFiltersOpen ? "secondary" : "outline"}
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className={filters.length > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : ""}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Filtros
                            {filters.length > 0 && (
                                <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-amber-100 text-amber-700">
                                    {filters.length}
                                </Badge>
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" title="Colunas visíveis">
                                    <Columns className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {availableFields.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground">Nenhum campo extra</div>
                                )}
                                {availableFields.map(field => (
                                    <DropdownMenuCheckboxItem
                                        key={field}
                                        checked={visibleColumns.has(field)}
                                        onCheckedChange={() => toggleColumn(field)}
                                    >
                                        {formatLabel(field)}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="icon" onClick={handleRefresh} title="Atualizar">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleExport} title="Exportar XLSX" disabled={filteredItems.length === 0}>
                            <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" onClick={onImport}>
                            <Upload className="w-4 h-4 mr-2" /> Importar
                        </Button>
                        <Button onClick={onCreate}>
                            <Plus className="w-4 h-4 mr-2" /> Novo Item
                        </Button>
                    </div>
                </div>

                {isFiltersOpen && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-700">Filtros Avançados</h3>
                            <Button variant="ghost" size="sm" onClick={() => { setFilters([]); setCurrentPage(1); }} disabled={filters.length === 0} className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50">
                                Limpar filtros
                            </Button>
                        </div>
                        {filters.length === 0 ? (
                            <div className="text-center py-4 text-sm text-gray-500 italic">
                                Nenhum filtro ativo. Adicione um filtro para refinar os resultados.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filters.map((filter) => (
                                    <div key={filter.id} className="flex items-center gap-2">
                                        <div className="w-[200px]">
                                            <select
                                                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                value={filter.field}
                                                onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                                            >
                                                <option value="" disabled>Selecione um campo</option>
                                                {availableFields.map(field => (
                                                    <option key={field} value={field}>{formatLabel(field)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-400 px-2">contém</div>
                                        <Input
                                            className="flex-1 h-9"
                                            placeholder="Valor do filtro..."
                                            value={filter.value}
                                            onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeFilter(filter.id)} className="h-9 w-9 text-gray-400 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button variant="outline" size="sm" onClick={addFilter} className="mt-2 border-dashed">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Filtro
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>
                                <div className="flex items-center gap-1">Nome <SortIcon column="nome" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("chave")}>
                                <div className="flex items-center gap-1">ID (Chave) <SortIcon column="chave" /></div>
                            </TableHead>
                            {[...visibleColumns].map(col => (
                                <TableHead key={col} className="cursor-pointer select-none" onClick={() => handleSort(col)}>
                                    <div className="flex items-center gap-1">{formatLabel(col)} <SortIcon column={col} /></div>
                                </TableHead>
                            ))}
                            <TableHead className="w-[80px] cursor-pointer select-none" onClick={() => handleSort("atualizado_em")}>
                                <div className="flex items-center gap-1">Atualizado <SortIcon column="atualizado_em" /></div>
                            </TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedItems.map((item, index) => {
                            const nome = getNomeValue(item) || "-";
                            const ativo = item.conteudo?.ativo !== false;
                            const rowKey = item.id ?? `row-${index}`;
                            return (
                                <TableRow key={rowKey} className={selectedIds.has(item.id) ? "bg-blue-50" : ""}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(item.id)}
                                            onCheckedChange={() => toggleSelectItem(item.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={nome}>{nome}</TableCell>
                                    <TableCell className="text-gray-500 font-mono text-xs">{item.chave}</TableCell>
                                    {[...visibleColumns].map(col => {
                                        const val = item.conteudo?.[col];
                                        const display = val === undefined || val === null ? "-" :
                                            typeof val === "object" ? JSON.stringify(val).slice(0, 50) : String(val);
                                        return (
                                            <TableCell key={col} className="max-w-[150px] truncate text-xs text-gray-600" title={String(val ?? "")}>
                                                {display}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-gray-500 text-xs">
                                        {item.atualizado_em ? new Date(item.atualizado_em).toLocaleDateString("pt-BR") : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={ativo ? "default" : "secondary"} className={ativo ? "bg-green-600" : "bg-gray-400"}>
                                            {ativo ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                                                <Edit2 className="w-4 h-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => onDelete(item)}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredItems.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={7 + visibleColumns.size} className="text-center">
                                    <div className="py-12">
                                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                            <FilePlus className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">Nenhum item encontrado</p>
                                        <p className="text-xs text-gray-400 mt-1">Crie o primeiro item ou importe de um arquivo</p>
                                        <div className="flex items-center justify-center gap-2 mt-4">
                                            <Button variant="outline" size="sm" onClick={onCreate}>
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Novo Item
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={onImport}>
                                                <Upload className="w-3.5 h-3.5 mr-1" /> Importar
                                            </Button>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50">
                    <p className="text-xs text-gray-500">
                        {filteredItems.length} item(ns) · Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-gray-600">{currentPage} / {totalPages}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatLabel(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase());
}
