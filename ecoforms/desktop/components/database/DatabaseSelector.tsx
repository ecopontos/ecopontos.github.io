'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CheckCircle } from 'lucide-react';

export function DatabaseSelector() {
  return (
    <Card className="w-full max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Conexão com Banco de Dados
        </CardTitle>
        <CardDescription>
          Banco de dados conectado automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">Conectado</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Componente compacto para status da conexão (para navbar)
 */
export function DatabaseStatus() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle className="h-4 w-4 text-green-500" />
      <span className="text-muted-foreground hidden md:inline">Conectado</span>
    </div>
  );
}
