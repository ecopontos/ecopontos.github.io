import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prazo } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface PrazosTabProps {
  prazos: Prazo[];
  prazoData: string;
  setPrazoData: (v: string) => void;
  prazoTipo: string;
  setPrazoTipo: (v: string) => void;
  handleAddPrazo: () => void;
  saving: boolean;
}

export function PrazosTab({
  prazos, prazoData, setPrazoData, prazoTipo, setPrazoTipo, handleAddPrazo, saving,
}: PrazosTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Novo Prazo</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input type="date" value={prazoData} onChange={e => setPrazoData(e.target.value)} />
          <Select value={prazoTipo} onValueChange={setPrazoTipo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo de prazo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resposta">Resposta ao Cidadão</SelectItem>
              <SelectItem value="solucao">Solução do Problema</SelectItem>
              <SelectItem value="prorrogacao">Prorrogação Administrativa</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddPrazo} disabled={saving}>Adicionar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Prazos</CardTitle></CardHeader>
        <CardContent>
          {prazos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum prazo registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tipo</TableHead><TableHead>Data Limite</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {prazos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{{
                      resposta: 'Resposta ao Cidadão',
                      solucao: 'Solução do Problema',
                      prorrogacao: 'Prorrogação Administrativa',
                    }[p.tipoPrazo] ?? p.tipoPrazo}</TableCell>
                    <TableCell>{new Date(p.dataLimite).toLocaleDateString()}</TableCell>
                    <TableCell>{p.status}</TableCell>
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
