"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, RefreshCcw, Server } from "lucide-react";

const LEGACY_API_BASE = "http://localhost:3005";
const SELECT_PLACEHOLDER_LOADING = "__loading";
const SELECT_PLACEHOLDER_EMPTY = "__empty";
const SELECT_NO_FILTER_VALUE = "__no_filter";

type LegacyHealth = {
  status: string;
  mode: string;
  db: string;
};

type LegacyTableResponse = {
  page: number;
  limit: number;
  count: number;
  data: Array<Record<string, unknown>>;
};

type LegacyTableQueryOptions = {
  table: string;
  limit?: number;
  page?: number;
  search?: string;
  searchCol?: string;
};

async function requestLegacy<T>(path: string): Promise<T> {
  const response = await fetch(`${LEGACY_API_BASE}${path}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error || response.statusText || "Erro desconhecido";
    throw new Error(message);
  }

  const json = (await response.json()) as T;
  return json;
}

async function fetchLegacyHealth(): Promise<LegacyHealth> {
  return requestLegacy<LegacyHealth>("/health");
}

async function fetchLegacyTables(): Promise<string[]> {
  return requestLegacy<string[]>("/api/tables");
}

async function fetchLegacyTableData(options: LegacyTableQueryOptions): Promise<LegacyTableResponse> {
  const params = new URLSearchParams();

  params.set("limit", String(options.limit ?? 50));
  params.set("page", String(options.page ?? 1));

  if (options.search && options.searchCol) {
    params.set("search", options.search);
    params.set("searchCol", options.searchCol);
  }

  const encodedTable = encodeURIComponent(options.table);
  const queryString = params.toString();
  return requestLegacy<LegacyTableResponse>(`/api/data/${encodedTable}?${queryString}`);
}

const formatCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return "[objeto]";
    }
  }

  return String(value);
};

export default function LegacyAdminPage() {
  const [health, setHealth] = useState<LegacyHealth | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchColumn, setSearchColumn] = useState("");
  const [dataResponse, setDataResponse] = useState<LegacyTableResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLegacyHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const payload = await fetchLegacyHealth();
      setHealth(payload);
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadLegacyTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const payload = await fetchLegacyTables();
      setTables(payload);
      setSelectedTable((current) => {
        if (current && payload.includes(current)) {
          return current;
        }
        return payload[0] ?? "";
      });
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
      setTables([]);
      setSelectedTable("");
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const refreshLegacyView = useCallback(() => {
    return Promise.all([loadLegacyHealth(), loadLegacyTables()]);
  }, [loadLegacyHealth, loadLegacyTables]);

  useEffect(() => {
    refreshLegacyView();
  }, [refreshLegacyView]);

  const [queryVersion, setQueryVersion] = useState(0);

  useEffect(() => {
    if (!selectedTable) {
      setDataResponse(null);
      setColumns([]);
      return;
    }

    let isCancelled = false;

    const run = async () => {
      setDataLoading(true);
      setError(null);

      try {
        const trimmedSearch = searchTerm.trim();
        const shouldFilter = Boolean(searchColumn && trimmedSearch);
        const payload = await fetchLegacyTableData({
          table: selectedTable,
          limit,
          page,
          search: shouldFilter ? trimmedSearch : undefined,
          searchCol: shouldFilter ? searchColumn : undefined,
        });

        if (isCancelled) return;

        setDataResponse(payload);
        setColumns(payload.data.length ? Object.keys(payload.data[0]) : []);
      } catch (err) {
        if (isCancelled) return;
        if (err instanceof Error) {
          setError(err.message);
        }
        setDataResponse(null);
        setColumns([]);
      } finally {
        if (!isCancelled) {
          setDataLoading(false);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [selectedTable, limit, page, searchColumn, searchTerm, queryVersion]);

  useEffect(() => {
    setPage(1);
  }, [selectedTable, searchColumn, searchTerm]);

  const tableSummary = useMemo(() => {
    if (!dataResponse) return "Nenhuma consulta realizada";

    return `Página ${dataResponse.page} · ${dataResponse.count} registros retornados (${dataResponse.limit} por página)`;
  }, [dataResponse]);

  const availableColumns = useMemo(() => {
    if (!columns.length) return [];
    return columns;
  }, [columns]);

  const renderTableRows = () => {
    if (!dataResponse || !dataResponse.data.length) {
      return (
        <tr>
          <td colSpan={availableColumns.length || 1} className="px-3 py-2 text-sm text-muted-foreground">
            {dataLoading ? "Executando consulta..." : "Nenhum registro disponível"}
          </td>
        </tr>
      );
    }

    return dataResponse.data.map((record, rowIndex) => (
      <tr key={`row-${rowIndex}`} className="even:bg-muted">
        {availableColumns.map((column) => (
          <td key={column} className="px-3 py-2 align-top text-xs text-muted-foreground">
            {formatCell(record[column])}
          </td>
        ))}
        {!availableColumns.length && (
          <td className="px-3 py-2 text-xs text-muted-foreground">Registro sem colunas</td>
        )}
      </tr>
    ));
  };

  return (
    <ProtectedPage permission="system.sync">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitor de API Legada</h1>
            <p className="text-sm text-muted-foreground">
              Conectado ao servidor histórico em http://localhost:3005.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshLegacyView()}>
            <RefreshCcw className="size-4" />
            Atualizar status
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro ao acessar o legado</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status do Gateway</CardTitle>
              <CardDescription>Informações básicas do serviço</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {healthLoading ? (
                <p className="text-muted-foreground">Verificando conectividade...</p>
              ) : health ? (
                <dl className="grid gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="font-semibold">{health.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Modo</dt>
                    <dd className="font-semibold">{health.mode}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Banco</dt>
                    <dd className="font-semibold truncate">{health.db}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted-foreground">Servidor indisponível</p>
              )}
            </CardContent>
            <CardFooter>
              <Button size="sm" className="flex-1" onClick={() => loadLegacyHealth()}>
                <Server className="size-4" />
                Recarregar saúde
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Tabelas públicas</CardTitle>
                  <CardDescription>Listagem visível hoje</CardDescription>
                </div>
                <Database className="size-4 text-muted-foreground" />
              </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total de tabelas</p>
              <div className="text-2xl font-semibold">{tables.length}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tablesLoading ? (
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                ) : tables.length ? (
                  tables.slice(0, 12).map((table) => (
                    <span key={table} className="rounded-full border px-3 py-1 text-xs">
                      {table}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Nenhuma tabela descoberta</span>
                )}
                {tables.length > 12 && (
                  <span className="text-xs text-muted-foreground">+{tables.length - 12} itens</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Consultas recentes</CardTitle>
              <CardDescription>Última resposta no cache</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{tableSummary}</p>
              <p className="text-xs text-muted-foreground">{dataLoading ? "Buscando registros..." : "Resposta em tempo real"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Executar consulta manual</CardTitle>
            <CardDescription>
              Escolha a tabela, limite e filtros. A consulta é enviada diretamente para o servidor legado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tabela</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue placeholder={tablesLoading ? "Carregando..." : "Selecione uma tabela"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tablesLoading && (
                      <SelectItem value={SELECT_PLACEHOLDER_LOADING} disabled>
                        Carregando...
                      </SelectItem>
                    )}
                    {!tablesLoading && tables.length === 0 && (
                      <SelectItem value={SELECT_PLACEHOLDER_EMPTY} disabled>
                        Nenhuma tabela disponível
                      </SelectItem>
                    )}
                    {tables.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Limite</Label>
                <Input
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(event) => setLimit(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>

              <div className="space-y-2">
                <Label>Página</Label>
                <Input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Coluna para filtro</Label>
                <Select
                  value={searchColumn ? searchColumn : SELECT_NO_FILTER_VALUE}
                  onValueChange={(value) => {
                    if (value === SELECT_NO_FILTER_VALUE) {
                      setSearchColumn("");
                      return;
                    }
                    setSearchColumn(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Coluna (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NO_FILTER_VALUE}>Sem filtro</SelectItem>
                    {availableColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Termo de busca</Label>
                <Input
                  disabled={!searchColumn}
                  placeholder={searchColumn ? "Digite um termo" : "Selecione uma coluna"}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{tablesLoading ? "Escolha uma tabela" : "A consulta retorna de forma automática"}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!selectedTable || dataLoading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={!selectedTable || dataLoading} onClick={() => setPage((prev) => prev + 1)}>
                Próxima
              </Button>
              <Button
                size="sm"
                onClick={() => setQueryVersion((prev) => prev + 1)}
                disabled={!selectedTable || dataLoading}
              >
                <RefreshCcw className="size-4" />
                Refazer consulta
              </Button>
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Visualização dos registros retornados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border text-[0.68rem]">
              <table className="min-w-full divide-y divide-border text-left text-[0.8rem]">
                <thead className="bg-muted text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {availableColumns.length ? (
                      availableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-semibold">
                          {column}
                        </th>
                      ))
                    ) : (
                      <th className="px-3 py-2">Colunas</th>
                    )}
                  </tr>
                </thead>
                <tbody>{renderTableRows()}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
