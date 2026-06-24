"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, LayoutDashboard } from 'lucide-react';
import { useActiveViews } from '@/src/interface/hooks/catalog/modules-views';

interface SelectDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  moduleType?: string;
  onSelect: (dashboardId: string) => void;
}

export function SelectDashboardModal({
  open, onOpenChange, userId, moduleType, onSelect,
}: SelectDashboardModalProps) {
  const { data: allViews, loading } = useActiveViews(moduleType);
  const dashboards = allViews.filter(v => v.userId === userId || v.isTemplate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar Dashboard</DialogTitle>
          <DialogDescription>
            Escolha um dashboard para associar a este módulo
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum dashboard disponível</p>
            <p className="text-xs mt-1">Crie um dashboard pessoal primeiro</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {dashboards.map(d => (
              <Card
                key={d.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => { onSelect(d.id); onOpenChange(false); }}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{d.titulo}</span>
                  </div>
                  {d.isTemplate && <Badge variant="outline" className="text-xs">Template</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
