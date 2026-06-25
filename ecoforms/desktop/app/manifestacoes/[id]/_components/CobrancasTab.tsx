import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Cobranca {
  id: string;
  usuario_nome?: string;
  mensagem: string;
  criado_em: string;
}

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
                    <TableCell>{c.usuario_nome || "—"}</TableCell>
                    <TableCell>{c.mensagem}</TableCell>
                    <TableCell>{new Date(c.criado_em).toLocaleString()}</TableCell>
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
