"use client";

import { useState, useMemo } from "react";
import { useFormTemplate, usePacoteFormTypes, usePacotesAnalise } from "@/src/interface/hooks/catalog/forms";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Search, Filter, Download, MapPin, Camera,
    Calendar, Clock, User, CheckCircle2, AlertCircle,
    MoreHorizontal, ChevronRight, ChevronLeft, LayoutGrid,
    List, Trash2, ExternalLink, XCircle, Minus, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormContent, FormField } from "@/types";
import { useTauriDialog } from "@/src/interface/hooks/catalog/tauri";
import { useTauriFs } from "@/src/interface/hooks/catalog/tauri";

export default function DynamicAnalysisPage() {
    const dialog = useTauriDialog();
    const fs = useTauriFs();
    const [selectedFormType, setSelectedFormType] = useState<string>("");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [searchText, setSearchText] = useState("");
    const [limit, setLimit] = useState(50);

    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const refetch = () => setRefetchTrigger(n => n + 1);

    // 1. Get Available Form Types
    const { formTypes } = usePacoteFormTypes();

    // 2. Get Form Template (Schema)
    const { template, loading: schemaLoading } = useFormTemplate(selectedFormType || undefined);

    // 3. Get Data (Dynamic Query — fully parameterized)
    const { records: recordsData, loading: dataLoading } = usePacotesAnalise(
        selectedFormType, searchText, selectedStatus, limit, refetchTrigger
    );

    // 4. Flatten Columns Logic - include all displayable fields
    const columns = useMemo<FormField[]>(() => {
        if (!template?.campos) return [];

        // Filter out pure layout fields
        return (template.campos as FormField[]).filter((f: FormField) =>
            !['section_header', 'description', 'separator', 'hidden', 'timestamp'].includes(f.type)
        );
    }, [template]);

    // ============================================
    // Universal Field Value Formatters
    // ============================================

    // Helper: Parse JSON safely
    const safeJsonParse = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        if (!value.startsWith('[') && !value.startsWith('{')) return value;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    };

    interface FormOption { value: string; label: string; }
    type FormFieldOption = { options?: Array<string | FormOption> };

    const normalizeOptions = (options: Array<string | FormOption> | undefined): FormOption[] =>
        (options || []).map((option) => typeof option === 'string'
            ? { value: option, label: option }
            : option);

    const formatChipsValue = (value: unknown, field: FormFieldOption): string => {
        value = safeJsonParse(value);
        const options = normalizeOptions(field.options);

        if (!Array.isArray(value)) {
            const opt = options.find((o) => o.value === value);
            if (opt) return opt.label;
            return String(value);
        }

        return (value as unknown[]).map((v: unknown) => {
            const opt = options.find((o) => o.value === v);
            if (opt) return opt.label;
            return String(v);
        }).join(', ');
    };

    const formatGPSValue = (value: unknown): React.ReactNode => {
        if (!value) return '—';
        value = safeJsonParse(value);

        if (typeof value === 'object' && value !== null) {
            const gps = value as Record<string, unknown>;
            const lat = gps.lat || gps.latitude;
            const lng = gps.lng || gps.longitude || gps.lon;
            if (lat !== undefined && lng !== undefined) {
                return (
                    <span className="inline-flex items-center gap-1 text-blue-600" title={`${lat}, ${lng}`}>
                        <MapPin className="h-3 w-3" />
                        {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                    </span>
                );
            }
        }
        return String(value).slice(0, 50);
    };

    // Format images/gallery
    const formatImagesValue = (value: unknown): React.ReactNode => {
        if (!value) return '—';
        const parsed = safeJsonParse(value);
        const images = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);

        if (images.length === 0) return '—';

        interface ImageObject { url?: string; uri?: string; preview?: string; }
        const getBestUrl = (img: unknown) => {
            if (typeof img === 'string') return img.startsWith('http') ? img : null;
            const imgObj = img as ImageObject;
            return imgObj.url || imgObj.uri || imgObj.preview || null;
        };

        const count = images.length;
        const firstUrl = getBestUrl(images[0]);

        return (
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-purple-600 font-medium whitespace-nowrap">
                    <Camera className="h-3 w-3" />
                    {count} foto{count !== 1 ? 's' : ''}
                </span>
                {firstUrl && (
                    <div className="h-8 w-8 rounded border overflow-hidden bg-slate-50 shrink-0 group relative cursor-pointer">
                        <img
                            src={firstUrl}
                            alt="Preview"
                            className="h-full w-full object-cover"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                        />
                        <a
                            href={firstUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="h-3 w-3 text-white" />
                        </a>
                    </div>
                )}
            </div>
        );
    };

    // Format occupation (caixas)
    const formatOccupationValue = (value: unknown): React.ReactNode => {
        if (!value) return '—';
        value = safeJsonParse(value);

        if (!Array.isArray(value) && typeof value === 'object' && value !== null) {
            const map = (value as Record<string, unknown>).ocupacao || value;

            const entries = Object.entries(map as Record<string, unknown>).filter(([k]) => k !== 'removidas' && k !== 'timestamp');

            if (entries.length === 0) return String(JSON.stringify(value));

            return (
                <div className="text-xs space-y-0.5">
                    {entries.slice(0, 6).map(([id, percent], i) => (
                        <div key={i} className="flex items-center gap-1">
                            <span className="font-medium">Caixa {id}:</span>
                            <Badge variant="outline" className="text-[10px] px-1">{String(percent)}%</Badge>
                        </div>
                    ))}
                    {entries.length > 6 && <span className="text-muted-foreground">+{entries.length - 6} mais</span>}
                </div>
            );
        }

        if (!Array.isArray(value)) return String(value);

        interface OccupiedBox { nome?: string; ocupacao?: string; }
        const filled = (value as unknown[]).filter((c: unknown) => (c as OccupiedBox).ocupacao && (c as OccupiedBox).ocupacao !== '');
        if (filled.length === 0) return `${value.length} caixas (vazias)`;

        return (
            <div className="text-xs space-y-0.5">
                {filled.slice(0, 4).map((c: unknown, i: number) => {
                    const box = c as OccupiedBox;
                    return (
                        <div key={i} className="flex items-center gap-1">
                            <span className="font-medium">{box.nome}:</span>
                            <Badge variant="outline" className="text-[10px] px-1">{box.ocupacao}%</Badge>
                        </div>
                    );
                })}
                {filled.length > 4 && <span className="text-muted-foreground">+{filled.length - 4} mais</span>}
            </div>
        );
    };

    const formatPresenceValue = (value: unknown): React.ReactNode => {
        if (!value) return '—';
        value = safeJsonParse(value);

        if (!Array.isArray(value)) return String(value);

        interface PresenceItem { status?: string; }
        const counts: Record<string, number> = {};
        (value as unknown[]).forEach((p: unknown) => {
            const item = p as PresenceItem;
            const status = item.status || 'unknown';
            counts[status] = (counts[status] || 0) + 1;
        });

        const statusColors: Record<string, string> = {
            'status1': 'bg-green-100 text-green-700',
            'status2': 'bg-orange-100 text-orange-700',
            'status3': 'bg-yellow-100 text-yellow-700',
            'status4': 'bg-gray-100 text-gray-700',
        };

        return (
            <div className="flex flex-wrap gap-1">
                {Object.entries(counts).map(([status, count]) => (
                    <Badge key={status} variant="outline" className={`text-[10px] ${statusColors[status] || ''}`}>
                        {status}: {count}
                    </Badge>
                ))}
            </div>
        );
    };

    // Format vistoria_checklist
    const formatVistoriaValue = (value: unknown): React.ReactNode => {
        if (!value) return '—';
        value = safeJsonParse(value);

        if (!Array.isArray(value)) return String(value);

        interface VistoriaItem { value?: string; status?: string; }
        const stats = { ok: 0, nok: 0, na: 0 };
        (value as unknown[]).forEach((item: unknown) => {
            const v = (item as VistoriaItem).value || (item as VistoriaItem).status;
            if (v === 'ok') stats.ok++;
            else if (v === 'nok') stats.nok++;
            else if (v === 'na') stats.na++;
        });

        return (
            <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-0.5 text-green-600">
                    <CheckCircle2 className="h-3 w-3" /> {stats.ok}
                </span>
                <span className="inline-flex items-center gap-0.5 text-red-600">
                    <XCircle className="h-3 w-3" /> {stats.nok}
                </span>
                <span className="inline-flex items-center gap-0.5 text-gray-500">
                    <Minus className="h-3 w-3" /> {stats.na}
                </span>
            </div>
        );
    };

    // Universal field value formatter
    const formatFieldValue = (value: unknown, field: FormField): React.ReactNode => {
        if (value === undefined || value === null || value === '') return '—';

        switch (field.type) {
            case 'text':
            case 'number':
            case 'tel':
            case 'textarea':
                return String(value);

            case 'date':
                try {
                    return new Date(value as string).toLocaleDateString('pt-BR');
                } catch {
                    return String(value);
                }

            case 'time':
                return String(value);

            case 'datetime-local':
                try {
                    return new Date(value as string).toLocaleString('pt-BR');
                } catch {
                    return String(value);
                }

            case 'select':
            case 'radio':
                if (field.options) {
                    const opt = field.options
                        .map((o): FormOption => typeof o === 'string'
                            ? { value: o, label: o }
                            : { value: o.value, label: o.label })
                        .find((o) => o.value === value);
                    if (opt) return opt.label;
                }
                return String(value);

            case 'chips':
            case 'chips_multiple':
                return formatChipsValue(value, field);

            case 'gps':
                return formatGPSValue(value);

            case 'gallery':
            case 'photo':
                return formatImagesValue(value);

            case 'occupation':
                return formatOccupationValue(value);

            case 'presence_compact':
                return formatPresenceValue(value);

            case 'vistoria_checklist':
                return formatVistoriaValue(value);

            default:
                if (typeof value === 'object') {
                    const jsonStr = JSON.stringify(value);
                    return (
                        <span className="text-xs text-muted-foreground" title={jsonStr}>
                            <FileText className="h-3 w-3 inline mr-1" />
                            {jsonStr.length > 40 ? jsonStr.slice(0, 40) + '...' : jsonStr}
                        </span>
                    );
                }
                return String(value);
        }
    };

    type FormDataRecord = Record<string, unknown>;

    const getRawValue = (formData: FormDataRecord, field: FormField) => {
        if (!formData) return undefined;

        let value = formData[field.id];
        const keys = Object.keys(formData);

        if (value === undefined || value === null) {
            if (field.label) {
                const normalizedLabel = field.label.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "_");

                const labelMatch = keys.find(k => {
                    const kNorm = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return k.toLowerCase() === field.label?.toLowerCase() ||
                        kNorm === normalizedLabel ||
                        k === normalizedLabel;
                });

                if (labelMatch) value = formData[labelMatch];
            }
        }

        if (value === undefined || value === null) {
            const idMatch = keys.find(k =>
                k.toLowerCase().includes(field.id.toLowerCase()) ||
                field.id.toLowerCase().includes(k.toLowerCase().replace('field_', ''))
            );
            if (idMatch) value = formData[idMatch];
        }

        if (value === undefined || value === null) {
            const fieldKeys = keys.filter(k => k.startsWith('field_')).sort();
            const fieldIndex = columns.findIndex(c => c.id === field.id);
            if (fieldIndex >= 0 && fieldIndex < fieldKeys.length) {
                value = formData[fieldKeys[fieldIndex]];
            }
        }

        return value;
    };

    interface RecordData { dados?: unknown; usuario?: string; criado_em?: string; id?: string; status?: string; }
    interface FormDataWrapper { form_data?: FormDataRecord; campos?: FormDataRecord; }
    const getValue = (record: RecordData, field: FormField): React.ReactNode => {
        if (!record.dados) return '—';

        try {
            const data = typeof record.dados === 'string' ? JSON.parse(record.dados as string) : record.dados;
            const formData = (data as FormDataWrapper)?.form_data || (data as FormDataWrapper)?.campos || (data as FormDataRecord);

            let value = getRawValue(formData, field);

            if (value === undefined || value === null) {
                if (field.id === 'user_id' || field.id === 'usuario') value = record.usuario;
                if (field.id === 'created_at' || field.id === 'data') value = record.criado_em;
            }

            return formatFieldValue(value, field);
        } catch (e) {
            console.error("Error parsing record data for display:", e);
            return (
                <span className="text-red-500 text-[10px]" title="Erro ao processar JSON">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    Erro
                </span>
            );
        }
    };

    const getValueForExport = (val: unknown, field: FormField): string => {
        if (val === undefined || val === null || val === '') return "";

        switch (field.type) {
            case 'select':
            case 'radio':
                const opt = normalizeOptions(field.options).find((o) => o.value === val);
                return opt?.label || String(val);

            case 'chips':
            case 'chips_multiple':
                return formatChipsValue(val, field);

            case 'date':
                try { return new Date(val as string).toLocaleDateString('pt-BR'); } catch { return String(val); }

            case 'datetime-local':
                try { return new Date(val as string).toLocaleString('pt-BR'); } catch { return String(val); }

            case 'gps':
                if (typeof val === 'object' && val !== null) {
                    const gps = val as Record<string, unknown>;
                    const lat = gps.lat || gps.latitude;
                    const lng = gps.lng || gps.longitude || gps.lon;
                    if (lat !== undefined && lng !== undefined) return `${lat}, ${lng}`;
                }
                return String(val);

            default:
                if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""');
                return String(val).replace(/"/g, '""');
        }
    };

    const handleExport = async () => {
        if (!recordsData || !columns) return;

        try {
            // Generate CSV
            const headers = ["ID", "Data", "Usuário", "Status", ...columns.map((c: FormField) => c.label)];
            const rows = (recordsData as RecordData[]).map((rec) => {
                let rowData: string[] = [];
                try {
                    const data = typeof rec.dados === 'string' && rec.dados ? JSON.parse(rec.dados) : (rec.dados || {});
                    const formData = data.form_data || data.campos || data;
                    
                    const fieldValues = columns.map((col: FormField) => {
                        let val = getRawValue(formData, col);
                        // Heuristic metadata fallback
                        if (val === undefined || val === null) {
                            if (col.id === 'user_id' || col.id === 'usuario') val = rec.usuario;
                            if (col.id === 'created_at' || col.id === 'data') val = rec.criado_em;
                        }
                        return getValueForExport(val, col);
                    });

                    rowData = [
                        rec.id,
                        rec.criado_em ? new Date(rec.criado_em).toLocaleString('pt-BR') : '',
                        rec.usuario || '',
                        rec.status || '',
                        ...fieldValues
                    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
                } catch (err) {
                    console.error("Error processing row for export:", err, rec);
                    rowData = [rec.id || 'unknown', "Erro no registro", rec.usuario || '', rec.status || '', ...columns.map(() => "ERROR")];
                }
                return rowData.join(",");
            });

            const csvContent = "\ufeff" + [headers.map(h => `"${h}"`).join(","), ...rows].join("\n");
            
            // Sanitize filename
            const safeFormType = selectedFormType.replace(/[^a-z0-9]/gi, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            const defaultName = `export_${safeFormType}_${dateStr}.csv`;

            // Use Tauri native save dialog
            const filePath = await dialog.save({
                defaultPath: defaultName,
                filters: [{ name: 'CSV', extensions: ['csv'] }],
                title: 'Exportar CSV',
            });

            if (!filePath) return; // User cancelled

            await fs.writeTextFile(filePath, csvContent);
            alert(`Arquivo exportado com sucesso!\n${filePath}`);
        } catch (globalErr) {
            console.error("Global export error:", globalErr);
            alert("Ocorreu um erro ao gerar o arquivo CSV: " + String(globalErr));
        }
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Análise de Dados</h1>
                    <p className="text-muted-foreground">
                        Visualize e exporte tabelas dinâmicas baseadas nos templates de formulário.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Configuração da Visão</CardTitle>
                    <div className="flex gap-4 items-end flex-wrap">
                        <div className="space-y-2 w-64">
                            <span className="text-sm font-medium">Tipo de Formulário</span>
                            <Select value={selectedFormType} onValueChange={setSelectedFormType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um tipo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {formTypes.map((tipo) => (
                                        <SelectItem key={tipo} value={tipo}>
                                            {tipo}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 w-48">
                            <span className="text-sm font-medium">Status</span>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="synced">Sincronizado</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                    <SelectItem value="approved">Aprovado</SelectItem>
                                    <SelectItem value="rejected">Rejeitado</SelectItem>
                                    <SelectItem value="draft">Rascunho</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedFormType && (
                            <>
                                <div className="space-y-2 flex-1 max-w-sm">
                                    <span className="text-sm font-medium">Filtrar Conteúdo</span>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar em todos os campos..."
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            className="pl-8"
                                        />
                                    </div>
                                </div>
                                <Button variant="outline" onClick={handleExport} disabled={!recordsData?.length}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar CSV
                                </Button>
                            </>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedFormType ? (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                            Selecione um tipo de formulário acima para visualizar a tabela.
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto max-w-[calc(100vw-4rem)]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="w-45 sticky left-0 bg-slate-50 z-10">Metadados</TableHead>
                                        {columns.map(col => (
                                            <TableHead key={col.id} className="min-w-37.5 font-semibold text-slate-700">
                                                <div className="flex flex-col">
                                                    <span>{col.label}</span>
                                                    <span className="text-[10px] font-normal text-muted-foreground">{col.type}</span>
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dataLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                                Carregando dados...
                                            </TableCell>
                                        </TableRow>
                                    ) : recordsData?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                                Nenhum registro encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        (recordsData as RecordData[])?.map((row, rowIndex: number) => (
                                            <TableRow key={row.id || `row-${rowIndex}`} className="hover:bg-slate-50">
                                                <TableCell className="align-top border-r bg-slate-50/50 sticky left-0">
                                                    <div className="space-y-1 text-xs">
                                                        <div className="font-mono text-slate-500">{row.criado_em ? new Date(row.criado_em).toLocaleDateString('pt-BR') : '—'}</div>
                                                        <div className="font-medium text-slate-900">{row.usuario || "Anônimo"}</div>
                                                        <span className={`inline-flex px-1.5 rounded-full text-[10px] font-medium border ${row.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            row.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                            }`}>
                                                            {row.status || 'pending'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                {columns.map((col) => (
                                                    <TableCell key={col.id} className="align-top">
                                                        <div className="max-h-30 overflow-y-auto text-sm">
                                                            {getValue(row as RecordData, col)}
                                                        </div>
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {recordsData && recordsData.length >= limit && (
                        <div className="mt-4 text-center">
                            <Button variant="ghost" onClick={() => setLimit(l => l + 50)} disabled={dataLoading}>
                                Carregar mais registros...
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
