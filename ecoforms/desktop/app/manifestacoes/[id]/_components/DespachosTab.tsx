import { Info, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Despacho } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface DespachosTabProps {
  despachos: Despacho[];
  userPerfil?: string;
  despachoText: string;
  setDespachoText: (v: string) => void;
  despachoComDemanda: boolean;
  setDespachoComDemanda: (v: boolean) => void;
  demandaSetorId: string;
  setDemandaSetorId: (v: string) => void;
  demandaTipoAcao: string;
  setDemandaTipoAcao: (v: string) => void;
  setores: { id: string; nome: string }[];
  handleAddDespacho: () => void;
  saving: boolean;
}

export function DespachosTab({
  despachos, userPerfil,
  despachoText, setDespachoText,
  despachoComDemanda, setDespachoComDemanda,
  demandaSetorId, setDemandaSetorId,
  demandaTipoAcao, setDemandaTipoAcao,
  setores, handleAddDespacho, saving,
}: DespachosTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div>
          <p className="font-medium">Despachos são diretivas administrativas internas</p>
          <p className="text-muted-foreground text-xs mt-0.5">Não são enviados ao cidadão. Use para registrar decisões formais, orientações entre setores ou o motivo de ações administrativas (ex: cancelamentos, prorrogações).</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Novo Despacho</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="despacho-texto" className="text-muted-foreground text-xs uppercase tracking-wide">
              Nota interna — visível apenas para servidores
            </Label>
            <Textarea
              id="despacho-texto"
              value={despachoText}
              onChange={e => setDespachoText(e.target.value)}
              placeholder="Texto do despacho administrativo..."
              rows={3}
            />
          </div>
          {(userPerfil === 'admin' || userPerfil === 'gerente' || userPerfil === 'coordenador') && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="demanda-switch"
                  checked={despachoComDemanda}
                  onCheckedChange={setDespachoComDemanda}
                />
                <Label htmlFor="demanda-switch" className="cursor-pointer font-medium flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4" />
                  Gerar demanda para equipe
                </Label>
                <span className="text-xs text-muted-foreground">A demanda aparecerá no Kanban do setor selecionado</span>
              </div>
              {despachoComDemanda && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Setor destino <span className="text-destructive">*</span></Label>
                    <select
                      value={demandaSetorId}
                      onChange={e => setDemandaSetorId(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                    >
                      <option value="">Selecione o setor...</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de ação</Label>
                    <Select value={demandaTipoAcao} onValueChange={setDemandaTipoAcao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="analise">Análise</SelectItem>
                        <SelectItem value="execucao">Execução</SelectItem>
                        <SelectItem value="fiscalizacao">Fiscalização</SelectItem>
                        <SelectItem value="remocao">Remoção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleAddDespacho} disabled={saving}>Registrar Despacho</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Despachos</CardTitle></CardHeader>
        <CardContent>
          {despachos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum despacho registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Texto</TableHead><TableHead>Despachado por</TableHead><TableHead>Data</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {despachos.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>{d.texto}</TableCell>
                    <TableCell>{d.despachadoPor}</TableCell>
                    <TableCell>{new Date(d.despachadoEm).toLocaleString()}</TableCell>
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
