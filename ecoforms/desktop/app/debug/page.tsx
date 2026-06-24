"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebugHealth } from "@/src/interface/hooks/catalog/tauri";
import { useSeedDemo } from "@/src/interface/hooks/catalog/utils";
import { RefreshCw, Database, Sprout } from "lucide-react";

export default function DebugPage() {
  const { tables, loading, dbPath, refetch } = useDebugHealth();
  const { seed, loading: seeding, log } = useSeedDemo();

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Debug / Health Check</h1>
          <p className="text-sm text-muted-foreground">Caminho: {dbPath || "—"}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={refetch} disabled={loading} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
        <Button onClick={seed} disabled={seeding}>
          <Sprout className="h-4 w-4 mr-2" /> Seed Demo
        </Button>
      </div>

      {log.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Log do Seed</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {log.map((l, i) => (
              <p key={i} className="text-sm font-mono">{l}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Tabelas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tables.map(t => (
              <div key={t.name} className="flex items-center justify-between border rounded-md px-3 py-2">
                <span className="text-sm font-medium">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t.ok ? t.count : "—"}</span>
                  <Badge variant={t.ok ? (t.count > 0 ? "default" : "secondary") : "destructive"} className="text-xs">
                    {t.ok ? (t.count > 0 ? "OK" : "vazio") : "falta"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
