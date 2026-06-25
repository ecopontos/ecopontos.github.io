import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cobranca } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface CobrancasTabProps {
  cobranças: Cobranca[];
}

export function CobrancasTab({ cobranças }: CobrancasTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Cobranças Automáticas</CardTitle>
          <CardDescription>Notificações geradas automaticamente quando prazos venceram sem resposta.</CardDescription>
        </CardHeader>
        <CardContent>
          {cobranças.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma cobrança registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notificado</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobranças.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.usuarioNome || "—"}</TableCell>
                    <TableCell>{c.mensagem}</TableCell>
                    <TableCell>{new Date(c.criadoEm).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
