"use client";

import { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getContainerAsync } from '@/src/interface/hooks/catalog/utils';
import { toast } from 'sonner';

interface ViewSyncAlertProps {
  globalViewId: string;
  personalViewId: string;
  userId: string;
  onDismiss: () => void;
}

export function ViewSyncAlert({ globalViewId, personalViewId, userId, onDismiss }: ViewSyncAlertProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const c = await getContainerAsync();
      await c.visuals.copyViewToPersonal.execute(globalViewId, userId);
      onDismiss();
      toast.success('View sincronizada com a versão global');
    } catch (err) {
      console.error('[ViewSyncAlert] Sync error:', err);
      toast.error('Erro ao sincronizar view');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 text-sm">View desatualizada</AlertTitle>
      <AlertDescription className="text-amber-700 text-xs">
        A view global foi atualizada pelo admin.
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar agora
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismiss}>
            <X className="h-3 w-3 mr-1" /> Manter minha versão
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
