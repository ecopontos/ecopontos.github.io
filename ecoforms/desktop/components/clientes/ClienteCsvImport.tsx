"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useClienteMutations } from "@/src/interface/hooks/catalog/clientes";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import type { Cliente, CategoriaCliente } from "@/types/clientes";
import { parseCSVText } from "@/lib/import/excel-parser";
import { ImportPreview } from "@/components/registry/ImportPreview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

type Step = "upload" | "mapping" | "validation" | "result";

interface ClienteCsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const TARGET_FIELDS = [
  { key: "tipo", label: "Tipo (PF/PJ)" },
  { key: "categoria", label: "Categoria" },
  { key: "nome", label: "Nome *" },
  { key: "email", label: "Email" },
  { key: "telefone", label: "Telefone" },
  { key: "cep", label: "CEP" },
  { key: "endereco", label: "Endereço" },
  { key: "numero", label: "Número" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado (UF)" },
  { key: "complemento", label: "Complemento" },
  { key: "observacoes", label: "Observações" },
  { key: "territorial", label: "Territorial (ID Imóvel)" },
] as const;

function autoMapColumns(csvColumns: string[]): Record<string, string> {
  const aliases: Record<string, string[]> = {
    tipo: ["tipo", "tipo_pessoa", "tipo_pessoa_fisica_juridica", "pf_pj"],
    categoria: ["categoria", "categoria_cliente"],
    nome: [
      "nome",
      "nome_razao_social",
      "razao_social",
      "razão_social",
      "nome_razaosocial",
      "nome_fantasia",
      "nome_completo",
      "name",
    ],
    email: ["email", "e_mail", "e-mail"],
    telefone: ["telefone", "tel", "fone", "phone", "telefone1", "tel1"],
    cep: ["cep", "cep_endereco"],
    endereco: [
      "endereco",
      "endereço",
      "logradouro",
      "rua",
      "address",
      "endereco_rua",
    ],
    numero: ["numero", "número", "num", "n", "numero_endereco"],
    bairro: ["bairro", "district"],
    cidade: ["cidade", "city", "municipio", "município"],
    estado: ["estado", "uf", "state", "sigla_uf"],
    complemento: ["complemento", "complement", "compl"],
    observacoes: ["observacoes", "observações", "obs", "nota", "notes"],
    territorial: [
      "territorial",
      "id_imovel",
      "id_imovel_prefeitura",
      "inscricao",
      "inscrição",
    ],
  };

  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const col of csvColumns) {
    const colLower = col.toLowerCase().trim();
    let matched = false;
    for (const [target, names] of Object.entries(aliases)) {
      if (usedTargets.has(target)) continue;
      if (
        names.includes(colLower) ||
        colLower.replace(/[^a-z]/g, "") === target
      ) {
        mapping[col] = target;
        usedTargets.add(target);
        matched = true;
        break;
      }
    }
  }

  return mapping;
}

function mapRowToCliente(
  row: Record<string, string>,
  mapping: Record<string, string>,
  index: number
): { cliente: Cliente; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, string> = {};

  for (const [csvCol, targetKey] of Object.entries(mapping)) {
    if (!targetKey) continue;
    mapped[targetKey] = String(row[csvCol] ?? "").trim();
  }

  const nome = mapped.nome || "";
  if (!nome) {
    errors.push(`Linha ${index + 2}: nome é obrigatório`);
  }

  let tipo: "PF" | "PJ" = "PJ";
  if (mapped.tipo) {
    const t = mapped.tipo.toUpperCase().trim();
    if (t === "PF" || t === "F" || t === "FISICA" || t === "FÍSICA") tipo = "PF";
    else if (t === "PJ" || t === "J" || t === "JURIDICA" || t === "JURÍDICA") tipo = "PJ";
  }

  const now = new Date().toISOString();
  const cliente: Cliente = {
    id: uuidv7(),
    tipo,
    categoria: (mapped.categoria || null) as CategoriaCliente | null,
    nome,
    documento: null,
    email: mapped.email || null,
    telefone: mapped.telefone || null,
    cep: mapped.cep || null,
    endereco: mapped.endereco || null,
    numero: mapped.numero || null,
    bairro: mapped.bairro || null,
    cidade: mapped.cidade || null,
    estado: mapped.estado || null,
    complemento: mapped.complemento || null,
    observacoes: mapped.observacoes || null,
    latitude: null,
    longitude: null,
    territorial: mapped.territorial || null,
    pj_id: null,
    ativo: 1,
    criado_em: now,
    atualizado_em: now,
  };

  return { cliente, errors };
}

export function ClienteCsvImport({
  open,
  onOpenChange,
  onComplete,
}: ClienteCsvImportProps) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [validationResult, setValidationResult] = useState<{
    valid: Cliente[];
    errors: { row: number; message: string }[];
  }>({ valid: [], errors: [] });
  const [importResult, setImportResult] = useState<{
    inserted: number;
    errors: string[];
  } | null>(null);

  const { save } = useClienteMutations();

  const mappedFieldLabels = useMemo(() => {
    return Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, f.label]));
  }, []);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setRawRows([]);
    setCsvColumns([]);
    setMapping({});
    setLoading(false);
    setImporting(false);
    setProgress({ current: 0, total: 0 });
    setValidationResult({ valid: [], errors: [] });
    setImportResult(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleTauriFileSelect = useCallback(async () => {
    setLoading(true);
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!selected || typeof selected !== "string") {
        setLoading(false);
        return;
      }

      const filePath: string = selected;
      if (!filePath) {
        toast.error("Nenhum arquivo selecionado");
        setLoading(false);
        return;
      }

      const name = filePath.split(/[\\/]/).pop() || "arquivo.csv";
      const text = await readTextFile(filePath);
      const result = parseCSVText(text);

      if (result.rows.length === 0) {
        toast.error("O arquivo não contém dados.");
        setLoading(false);
        return;
      }

      setCsvColumns(result.columns);
      setRawRows(result.rows as Record<string, string>[]);
      setFileName(name);
      setMapping(autoMapColumns(result.columns));
      setStep("mapping");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao ler arquivo CSV"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleValidate = () => {
    const valid: Cliente[] = [];
    const errors: { row: number; message: string }[] = [];
    const seenNames = new Map<string, number>();

    for (let i = 0; i < rawRows.length; i++) {
      const { cliente, errors: rowErrors } = mapRowToCliente(
        rawRows[i],
        mapping,
        i
      );

      if (rowErrors.length > 0) {
        for (const e of rowErrors) errors.push({ row: i + 1, message: e });
        if (!cliente.nome) continue;
      }

      const nameLower = cliente.nome.toLowerCase().trim();
      if (seenNames.has(nameLower)) {
        errors.push({
          row: i + 1,
          message: `Nome duplicado no CSV: "${cliente.nome}" (linha ${seenNames.get(nameLower)})`,
        });
      } else {
        seenNames.set(nameLower, i + 1);
      }

      valid.push(cliente);
    }

    setValidationResult({ valid, errors });
    setStep("validation");
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress({ current: 0, total: validationResult.valid.length });
    let inserted = 0;
    const importErrors: string[] = [];

    for (let i = 0; i < validationResult.valid.length; i++) {
      try {
        await save(validationResult.valid[i]);
        inserted++;
      } catch (e) {
        importErrors.push(
          `Linha ${i + 2}: ${e instanceof Error ? e.message : "Erro desconhecido"}`
        );
      }
      setProgress({ current: i + 1, total: validationResult.valid.length });
    }

    setImportResult({ inserted, errors: importErrors });
    setStep("result");
    if (importErrors.length === 0) {
      toast.success(`${inserted} cliente(s) importado(s) com sucesso`);
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Clientes via CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Selecione um arquivo CSV para importar clientes."}
            {step === "mapping" &&
              "Mapeie as colunas do arquivo para os campos do cliente."}
            {step === "validation" &&
              "Revise os dados antes de importar."}
            {step === "result" && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          {(
            ["upload", "mapping", "validation", "result"] as Step[]
          ).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : (
                        [
                          "upload",
                          "mapping",
                          "validation",
                          "result",
                        ].indexOf(step) > i
                      )
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
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
            <div className="space-y-4 py-8 text-center">
              <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-300" />
              <p className="text-sm text-gray-600">
                Clique no botão abaixo para selecionar um arquivo CSV do seu
                computador.
              </p>
              <p className="text-xs text-gray-400">
                O arquivo deve conter ao menos a coluna <strong>nome</strong>.
              </p>
              <Button
                onClick={handleTauriFileSelect}
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Lendo arquivo...
                  </>
                ) : (
                  "Selecionar arquivo CSV"
                )}
              </Button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Arquivo: <strong>{fileName}</strong> — {rawRows.length} linhas
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p>
                  <strong>Colunas esperadas no CSV:</strong> nome*, tipo, categoria,
                  email, telefone, cep, endereco, numero, bairro, cidade,
                  estado, complemento, observacoes, territorial
                </p>
                <p>
                  * Campo obrigatório. Os demais são opcionais. Documento
                  (CPF/CNPJ) não é importado.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Mapeamento de colunas
                </Label>
                <div className="border rounded-lg divide-y">
                  {csvColumns.map((col) => (
                    <div
                      key={col}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span className="text-sm font-mono w-[180px] truncate text-gray-600">
                        {col}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                      <Select
                        value={mapping[col] || "__skip__"}
                        onValueChange={(v) =>
                          setMapping({
                            ...mapping,
                            [col]: v === "__skip__" ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">
                            <span className="text-gray-400 italic">
                              Ignorar
                            </span>
                          </SelectItem>
                          {TARGET_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Preview (primeiras 5 linhas)
                </Label>
                <ImportPreview columns={csvColumns} rows={rawRows} />
              </div>
            </div>
          )}

          {step === "validation" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-600" />
                  <div className="text-lg font-semibold text-green-700">
                    {validationResult.valid.length}
                  </div>
                  <div className="text-xs text-green-600">Linhas válidas</div>
                </div>
                {validationResult.errors.length > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <AlertCircle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                    <div className="text-lg font-semibold text-red-700">
                      {validationResult.errors.length}
                    </div>
                    <div className="text-xs text-red-600">
                      Avisos/Erros
                    </div>
                  </div>
                )}
              </div>

              {validationResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg max-h-[150px] overflow-auto">
                  {validationResult.errors.map((err, i) => (
                    <div
                      key={i}
                      className="text-xs px-3 py-1.5 border-b border-red-100 text-red-700"
                    >
                      <strong>Linha {err.row}:</strong> {err.message}
                    </div>
                  ))}
                </div>
              )}

              {validationResult.valid.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Preview dos dados mapeados (primeiros 5)
                  </Label>
                  <div className="border rounded-lg overflow-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nome</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Telefone</TableHead>
                          <TableHead className="text-xs">Cidade/UF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResult.valid.slice(0, 5).map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">
                              {c.nome}
                            </TableCell>
                            <TableCell className="text-xs">{c.tipo}</TableCell>
                            <TableCell className="text-xs">
                              {c.telefone || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {[c.cidade, c.estado]
                                .filter(Boolean)
                                .join(" / ") || "—"}
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
              {importing ? (
                <div className="text-center space-y-3 py-6">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">
                    Importando {progress.current} de {progress.total}...
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          progress.total > 0
                            ? (progress.current / progress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-4 justify-center">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center min-w-[120px]">
                      <div className="text-2xl font-bold text-green-700">
                        {importResult.inserted}
                      </div>
                      <div className="text-xs text-green-600">Importados</div>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center min-w-[120px]">
                        <div className="text-2xl font-bold text-red-700">
                          {importResult.errors.length}
                        </div>
                        <div className="text-xs text-red-600">Erros</div>
                      </div>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="border border-red-200 rounded-lg max-h-[150px] overflow-auto">
                      {importResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="text-xs px-3 py-1.5 border-b border-red-100 text-red-700"
                        >
                          {err}
                        </div>
                      ))}
                    </div>
                  )}

                  {importResult.errors.length === 0 && (
                    <div className="text-center py-4">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                      <p className="text-sm text-gray-600">
                        Importação concluída com sucesso!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

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
            <Button variant="outline" onClick={() => handleClose(false)}>
              {step === "result" ? "Fechar" : "Cancelar"}
            </Button>
            {step === "mapping" && (
              <Button
                onClick={handleValidate}
                disabled={
                  !Object.values(mapping).some((v) => v === "nome")
                }
              >
                Validar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === "validation" && (
              <Button
                onClick={handleImport}
                disabled={importing || validationResult.valid.length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />{" "}
                    Importando...
                  </>
                ) : (
                  `Importar ${validationResult.valid.length} clientes`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
