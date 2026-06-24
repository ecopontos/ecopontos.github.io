"use client";

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';

interface VisualTableViewProps {
  data: unknown[];
  config: Record<string, unknown>;
}

export function VisualTableView({ data, config }: VisualTableViewProps) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const columns = (config.columns as string[]) ?? [];

  const filtered = useMemo(() => {
    if (!filter) return data;
    return (data as Record<string, unknown>[]).filter((row) =>
      Object.values(row).some(v =>
        String(v ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [data, filter]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered as Record<string, unknown>[];
    return [...(filtered as Record<string, unknown>[])].sort((a, b) => {
      const va = String(a[sortField] ?? '');
      const vb = String(b[sortField] ?? '');
      const cmp = va.localeCompare(vb, 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  const detectedColumns = columns.length > 0 ? columns : Object.keys(data[0] as Record<string, unknown>);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Filtrar..."
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{sorted.length} registros</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {detectedColumns.map(col => (
                <TableHead
                  key={col}
                  className="cursor-pointer select-none"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortField === col ? (
                      sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((row, i) => {
              const r = row as Record<string, unknown>;
              return (
                <TableRow key={i}>
                  {detectedColumns.map(col => (
                    <TableCell key={col} className="max-w-[200px] truncate">
                      {String(r[col] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
