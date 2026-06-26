import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useDataRegistryBulkInsert } from "@/src/interface/hooks/catalog/data-registry";
import { useDataRegistryItemsNew as useDataRegistryItems } from "@/src/interface/hooks/catalog/data-registry";
import { similarityScore } from "@/src/lib/registry-schema";
import type { FieldSchema } from "@/src/lib/registry-schema";
import { parseSpreadsheetFile } from "@/lib/import/excel-parser";
import { FileUploadArea } from "./FileUploadArea";
import { ImportPreview } from "./ImportPreview";

type Step = "upload" | "mapping" | "validation" | "result";

interface DataRegistryImportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: string;
    schema: FieldSchema[];
    onComplete: () => void;
}

export function DataRegistryImport({ open, onOpenChange, type, schema, onComplete }: DataRegistryImportProps) {
    const [step, setStep] = useState<Step>("upload");
    const [fileName, setFileName] = useState("");
    const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
    const [csvColumns, setCsvColumns] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [keyColumn, setKeyColumn] = useState<string>("");
    const [validationResult, setValidationResult] = useState<{
        valid: { chave: string; conteudo: Record<string, unknown> }[];
        errors: { row: number; message: string }[];
    }>({ valid: [], errors: [] });
    const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
    const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
    const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const { bulkInsert, loading: importing } = useDataRegistryBulkInsert();
    const { items: existingItems } = useDataRegistryItems(type);

    const targetFields = useMemo(() => {
        const base = [
            { key: "nome", label: "Nome" },
            { key: "ativo", label: "Ativo" },
        ];
        const fromSchema = schema.map((s) => ({ key: s.key, label: s.label }));
        return [...base, ...fromSchema];
    }, [schema]);

    const reset = () => {
        setStep("upload");
        setFileName("");
        setRawRows([]);
        setCsvColumns([]);
        setMapping({});
        setKeyColumn("");
        setValidationResult({ valid: [], errors: [] });
        setImportResult(null);
        setExistingKeys(new Set());
        setShowOverwriteWarning(false);
        setFileError(null);
    };

    const handleClose = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleFileError = useCallback((message: string) => {
        setFileError(message);
        setTimeout(() => setFileError(null), 5000);
    }, []);

    const handleFileSelect = useCallback(
        (file: File) => {
            parseSpreadsheetFile(
                file,
                ({ rows, columns }) => {
                    setCsvColumns(columns);
                    setRawRows(rows);
                    setFileName(file.name);

                    // Auto-map columns by name similarity
                    const autoMap: Record<string, string> = {};
                    for (const col of columns) {
                        let bestField = "";
                        let bestScore = 0;
                        for (const tf of targetFields) {
                            const score = similarityScore(col, tf.key);
                            if (score > bestScore && score >= 0.6) {
                                bestScore = score;
                                bestField = tf.key;
                            }
                        }
                        if (bestField) autoMap[col] = bestField;
                    }
                    setMapping(autoMap);

                    const keyCandidate = columns.find(
                        (c) => c.toLowerCase() === "chave" || c.toLowerCase() === "id" || c.toLowerCase() === "key"
                    );
                    setKeyColumn(keyCandidate || columns[0]);

                    setStep("mapping");
                },
                (errMsg) => alert(errMsg)
            );
        },
        [targetFields]
    );

    const handleValidate = () => {
        const valid: { chave: string; conteudo: Record<string, unknown> }[] = [];
        const errors: { row: number; message: string }[] = [];

        for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            const chave = String(row[keyColumn] || "").trim();

            if (!chave) {
                errors.push({ row: i + 1, message: `Chave vazia (coluna "${keyColumn}")` });
                continue;
            }

            const conteudo: Record<string, unknown> = {};
            for (const [csvCol, targetKey] of Object.entries(mapping)) {
                if (!targetKey) continue;
                let val = row[csvCol];
                if (val === "true" || val === "TRUE") val = true;
                else if (val === "false" || val === "FALSE") val = false;
                else if (val !== "" && !isNaN(Number(val)) && typeof val === "string" && val.trim() !== "") {
                    const trimmed = String(val).trim();
                    if (/^\d+$/.test(trimmed) || /^\d+\.\d+$/.test(trimmed)) {
                        val = Number(trimmed);
                    }
                }
                conteudo[targetKey] = val;
            }

            if (!conteudo.nome) {
                const nameCol = Object.entries(mapping).find(([, v]) => v === "nome")?.[0];
                if (!nameCol) {
                    conteudo.nome = chave;
                }
            }

            if (conteudo.ativo === undefined) conteudo.ativo = true;
            conteudo.id = chave;

            valid.push({ chave, conteudo });
        }

        setValidationResult({ valid, errors });

        const existingKeysSet = new Set(existingItems.map(item => item.id));
        const keysToUpdate = valid.filter(item => existingKeysSet.has(item.chave)).map(item => item.chave);
        setExistingKeys(new Set(keysToUpdate));

        if (keysToUpdate.length > 0) {
            setShowOverwriteWarning(true);
        } else {
            setStep("validation");
        }
    };

    const handleImport = async () => {
        const result = await bulkInsert(type, validationResult.valid);
        setImportResult(result);
        setStep("result");
        if (result.errors.length === 0) {
            onComplete();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Importar dados — {type}
                    </DialogTitle>
                    <DialogDescription>
                        {step === "upload" && "Selecione um arquivo CSV ou Excel para importar."}
                        {step === "mapping" && "Mapeie as colunas do arquivo para os campos do registro."}
                        {step === "validation" && "Revise a validação antes de importar."}
                        {step === "result" && "Resultado da importação."}
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicators */}
                <div className="flex items-center gap-2 px-1">
                    {(["upload", "mapping", "validation", "result"] as Step[]).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                    step === s
                                        ? "bg-blue-600 text-white"
                                        : (["upload", "mapping", "validation", "result"].indexOf(step) > i
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-400")
                                }`}
                            >
                                {i + 1}
                            </div>
                            {i < 3 && <div className="w-8 h-px bg-gray-200" />}
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                    {step === "upload" && (
                        <div className="space-y-3">
                            {fileError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{fileError}</p>
                                </div>
                            )}
                            <FileUploadArea onFile={handleFileSelect} onError={handleFileError} />
                        </div>
                    )}

                    {step === "mapping" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">
                                    Arquivo: <strong>{fileName}</strong> — {rawRows.length} linhas
                                </span>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                                <Label className="text-sm font-medium text-amber-800">
                                    Coluna da Chave (identificador único) <span className="text-red-500">*</span>
                                </Label>
                                <Select value={keyColumn} onValueChange={setKeyColumn}>
                                    <SelectTrigger className="w-[250px] bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {csvColumns.map((col) => (
                                            <SelectItem key={col} value={col}>{col}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">Mapeamento de colunas</Label>
                                <div className="border rounded-lg divide-y">
                                    {csvColumns.map((col) => (
                                        <div key={col} className="flex items-center gap-3 px-3 py-2">
                                            <span className="text-sm font-mono w-[180px] truncate text-gray-600">{col}</span>
                                            <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                                            <Select
                                                value={mapping[col] || "__skip__"}
                                                onValueChange={(v) =>
                                                    setMapping({ ...mapping, [col]: v === "__skip__" ? "" : v })
                                                }
                                            >
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__skip__">
                                                        <span className="text-gray-400 italic">Ignorar</span>
                                                    </SelectItem>
                                                    {targetFields.map((f) => (
                                                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700">Preview (primeiras 5 linhas)</Label>
                                <ImportPreview columns={csvColumns} rows={rawRows} />
                            </div>
                        </div>
                    )}

                    {step === "validation" && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                    <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                                    <div className="text-lg font-semibold text-green-700">{validationResult.valid.length}</div>
                                    <div className="text-xs text-green-600">Linhas válidas</div>
                                </div>
                                {validationResult.errors.length > 0 && (
                                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                        <AlertCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                                        <div className="text-lg font-semibold text-red-700">{validationResult.errors.length}</div>
                                        <div className="text-xs text-red-600">Linhas com erro</div>
                                    </div>
                                )}
                            </div>

                            {validationResult.errors.length > 0 && (
                                <div className="border border-red-200 rounded-lg max-h-[150px] overflow-auto">
                                    {validationResult.errors.map((err, i) => (
                                        <div key={i} className="text-xs px-3 py-1.5 border-b border-red-100 text-red-700">
                                            <strong>Linha {err.row}:</strong> {err.message}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {validationResult.valid.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-gray-700">
                                        Preview dos dados mapeados (primeiras 5)
                                    </Label>
                                    <div className="border rounded-lg overflow-auto max-h-[200px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs">Chave</TableHead>
                                                    <TableHead className="text-xs">Nome</TableHead>
                                                    <TableHead className="text-xs">Conteúdo</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {validationResult.valid.slice(0, 5).map((item, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="text-xs font-mono">{item.chave}</TableCell>
                                                        <TableCell className="text-xs">{String(item.conteudo.nome ?? "")}</TableCell>
                                                        <TableCell className="text-xs text-gray-500 max-w-[300px] truncate">
                                                            {JSON.stringify(item.conteudo)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === "result" && importResult && (
                        <div className="space-y-4 py-4">
                            <div className="flex gap-4 justify-center">
                                {importResult.inserted > 0 && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center min-w-[120px]">
                                        <div className="text-2xl font-bold text-green-700">{importResult.inserted}</div>
                                        <div className="text-xs text-green-600">Inseridos</div>
                                    </div>
                                )}
                                {importResult.updated > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center min-w-[120px]">
                                        <div className="text-2xl font-bold text-blue-700">{importResult.updated}</div>
                                        <div className="text-xs text-blue-600">Atualizados</div>
                                    </div>
                                )}
                                {importResult.errors.length > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center min-w-[120px]">
                                        <div className="text-2xl font-bold text-red-700">{importResult.errors.length}</div>
                                        <div className="text-xs text-red-600">Erros</div>
                                    </div>
                                )}
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="border border-red-200 rounded-lg max-h-[150px] overflow-auto">
                                    {importResult.errors.map((err, i) => (
                                        <div key={i} className="text-xs px-3 py-1.5 border-b border-red-100 text-red-700">
                                            {err}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {importResult.errors.length === 0 && (
                                <div className="text-center py-4">
                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                    <p className="text-sm text-gray-600">Importação concluída com sucesso!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {showOverwriteWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-medium text-amber-900 mb-1">
                                    Atenção: {existingKeys.size} registro(s) já existe(m)
                                </h4>
                                <p className="text-sm text-amber-800 mb-3">
                                    Os seguintes registros serão atualizados (sobrescritos):
                                </p>
                                <div className="max-h-[120px] overflow-auto bg-white border border-amber-300 rounded p-2">
                                    <ul className="text-xs font-mono space-y-0.5">
                                        {Array.from(existingKeys).slice(0, 20).map(key => (
                                            <li key={key} className="text-amber-900">• {key}</li>
                                        ))}
                                        {existingKeys.size > 20 && (
                                            <li className="text-amber-600 italic">... e mais {existingKeys.size - 20}</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex items-center justify-between">
                    {step !== "upload" && step !== "result" && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (step === "mapping") setStep("upload");
                                if (step === "validation") setStep("mapping");
                            }}
                            className="mr-auto"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                        </Button>
                    )}
                    <div className="flex gap-2 ml-auto">
                        {showOverwriteWarning ? (
                            <>
                                <Button variant="outline" onClick={() => setShowOverwriteWarning(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={() => { setShowOverwriteWarning(false); setStep("validation"); }}>
                                    Continuar mesmo assim
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => handleClose(false)}>
                                    {step === "result" ? "Fechar" : "Cancelar"}
                                </Button>
                                {step === "mapping" && (
                                    <Button onClick={handleValidate} disabled={!keyColumn}>
                                        Validar <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                )}
                                {step === "validation" && (
                                    <Button onClick={handleImport} disabled={importing || validationResult.valid.length === 0}>
                                        {importing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importando...
                                            </>
                                        ) : (
                                            `Importar ${validationResult.valid.length} itens`
                                        )}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
