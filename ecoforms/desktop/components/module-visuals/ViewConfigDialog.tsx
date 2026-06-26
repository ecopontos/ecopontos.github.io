"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

const FILTER_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'] as const;

interface FilterConfig {
  field: string;
  op: string;
  value: string | number | null;
}

interface ViewConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visualType: string;
  initialConfig?: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
}

export function ViewConfigDialog({
  open, onOpenChange, visualType, initialConfig, onSave, onDelete,
}: ViewConfigDialogProps) {
  const [name, setName] = useState('');
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [chartType, setChartType] = useState('');
  const [categoryField, setCategoryField] = useState('');
  const [valueField, setValueField] = useState('');
  const [aggregation, setAggregation] = useState('');
  const [statusField, setStatusField] = useState('');
  const [newColumn, setNewColumn] = useState('');

  useEffect(() => {
    if (!initialConfig) {
      setName('');
      setFilters([]);
      setColumns([]);
      setChartType('');
      setCategoryField('');
      setValueField('');
      setAggregation('');
      setStatusField('');
      return;
    }
    setName((initialConfig.name as string) ?? '');
    setFilters((initialConfig.filters as FilterConfig[]) ?? []);
    setColumns((initialConfig.columns as string[]) ?? []);
    setChartType((initialConfig.chart_type as string) ?? '');
    setCategoryField((initialConfig.category_field as string) ?? '');
    setValueField((initialConfig.value_field as string) ?? '');
    setAggregation((initialConfig.aggregation as string) ?? '');
    setStatusField((initialConfig.status_field as string) ?? '');
  }, [initialConfig]);

  const handleSave = () => {
    const config: Record<string, unknown> = { name };
    if (filters.length > 0) config.filters = filters;
    if (columns.length > 0) config.columns = columns;
    if (visualType === 'chart') {
      config.chart_type = chartType;
      config.category_field = categoryField;
      config.value_field = valueField;
      config.aggregation = aggregation;
    }
    if (visualType === 'kanban') {
      config.status_field = statusField;
    }
    onSave(config);
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', op: '=', value: '' }]);
  };

  const updateFilter = (index: number, key: keyof FilterConfig, val: string) => {
    const updated = filters.map((f, i) => (i === index ? { ...f, [key]: val } : f));
    setFilters(updated);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const addColumn = () => {
    if (newColumn.trim() && !columns.includes(newColumn.trim())) {
      setColumns([...columns, newColumn.trim()]);
      setNewColumn('');
    }
  };

  const removeColumn = (col: string) => {
    setColumns(columns.filter(c => c !== col));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar View — {visualType}</DialogTitle>
          <DialogDescription>
            Defina os filtros, colunas e parâmetros de exibição
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da View</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Minhas inspeções de hoje" />
          </div>

          <div className="space-y-2">
            <Label>Colunas</Label>
            <div className="flex gap-2">
              <Input
                value={newColumn}
                onChange={e => setNewColumn(e.target.value)}
                placeholder="Nome do campo"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColumn())}
              />
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {columns.map(col => (
                <Badge key={col} variant="secondary" className="gap-1">
                  {col}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeColumn(col)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Filtros ({filters.length})</Label>
              <Button variant="ghost" size="sm" onClick={addFilter}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar filtro
              </Button>
            </div>
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="h-8 w-32"
                  placeholder="campo"
                  value={f.field}
                  onChange={e => updateFilter(i, 'field', e.target.value)}
                />
                <Select value={f.op} onValueChange={v => updateFilter(i, 'op', v)}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPERATORS.map(op => (
                      <SelectItem key={op} value={op}>{op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 w-32"
                  placeholder="valor"
                  value={f.value as string}
                  onChange={e => updateFilter(i, 'value', e.target.value)}
                />
                <Button variant="ghost" size="icon-sm" onClick={() => removeFilter(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {visualType === 'chart' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de gráfico</Label>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pie">Pizza</SelectItem>
                    <SelectItem value="bar">Barra</SelectItem>
                    <SelectItem value="line">Linha</SelectItem>
                    <SelectItem value="area">Área</SelectItem>
                    <SelectItem value="donut">Donut</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agregação</Label>
                <Select value={aggregation} onValueChange={setAggregation}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNT">COUNT</SelectItem>
                    <SelectItem value="SUM">SUM</SelectItem>
                    <SelectItem value="AVG">AVG</SelectItem>
                    <SelectItem value="MIN">MIN</SelectItem>
                    <SelectItem value="MAX">MAX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campo categoria (X)</Label>
                <Input value={categoryField} onChange={e => setCategoryField(e.target.value)} placeholder="status" />
              </div>
              <div className="space-y-2">
                <Label>Campo valor (Y)</Label>
                <Input value={valueField} onChange={e => setValueField(e.target.value)} placeholder="id" />
              </div>
            </div>
          )}

          {visualType === 'kanban' && (
            <div className="space-y-2">
              <Label>Campo de status</Label>
              <Input value={statusField} onChange={e => setStatusField(e.target.value)} placeholder="status" />
              <p className="text-xs text-muted-foreground">
                O Kanban exibe 3 colunas fixas: a_fazer, em_progesso, concluido.
                Valores mapeados automaticamente pelo campo de status.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="destructive" onClick={onDelete} className="mr-auto">
              Excluir view
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
