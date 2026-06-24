import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Notificacao {
  id: string;
  canal: string;
  status: string;
  enviadoEm: string | null;
  conteudo: string;
}

interface NotificacoesTabProps {
  notificacoes: Notificacao[];
}

export function NotificacoesTab({ notificacoes }: NotificacoesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notificações ao Solicitante</CardTitle>
          <CardDescription>Histórico de comunicações enviadas ao cidadão.</CardDescription>
        </CardHeader>
        <CardContent>
          {!notificacoes || notificacoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma notificação enviada ao solicitante.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Conteúdo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notificacoes.map(n => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium capitalize">{n.canal}</TableCell>
                    <TableCell>
                      <Badge variant={
                        n.status === 'enviado' ? 'default' :
                        n.status === 'falhou' ? 'destructive' : 'secondary'
                      }>
                        {n.status === 'enviado' ? 'Enviado' :
                         n.status === 'falhou' ? 'Falhou' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.enviadoEm ? new Date(n.enviadoEm).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{n.conteudo}</TableCell>
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
