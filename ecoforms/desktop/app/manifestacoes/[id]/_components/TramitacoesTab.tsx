import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tramitacao } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { TramitacaoDialog } from "./TramitacaoDialog";

interface TramitacoesTabProps {
  tramitacoes: Tramitacao[];
  isTerminal: boolean;
  userPerfil?: string;
  showTramitacao: boolean;
  setShowTramitacao: (v: boolean) => void;
  tipoEncaminhar: 'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca';
  setTipoEncaminhar: (v: 'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca') => void;
  setActiveTab: (v: string) => void;
  encaminharSetorId: string;
  setEncaminharSetorId: (v: string) => void;
  encaminharObs: string;
  setEncaminharObs: (v: string) => void;
  setorOrigemDevolucao: { deSetorId?: string | null; deSetorNome?: string | null } | null;
  setores: { id: string; nome: string }[];
  manifestacaoSetorId?: string;
  handleEncaminhar: (tramitacoes: Tramitacao[]) => void;
  saving: boolean;
}

export function TramitacoesTab({
  tramitacoes, isTerminal, userPerfil,
  showTramitacao, setShowTramitacao,
  tipoEncaminhar, setTipoEncaminhar,
  setActiveTab,
  encaminharSetorId, setEncaminharSetorId,
  encaminharObs, setEncaminharObs,
  setorOrigemDevolucao, setores, manifestacaoSetorId,
  handleEncaminhar, saving,
}: TramitacoesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Histórico de Tramitações</CardTitle>
            <CardDescription>Movimentações desta manifestação entre setores.</CardDescription>
          </div>
          {!isTerminal && (
            <div className="flex gap-1 flex-wrap">
              {(userPerfil === 'admin' || userPerfil === 'gerente' || userPerfil === 'coordenador') && (
                <Button size="sm" variant="outline" onClick={() => { setTipoEncaminhar('transferencia'); setActiveTab('tramitacoes'); setShowTramitacao(true); }}>
                  Transferir Setorial
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setTipoEncaminhar('encaminhamento'); setActiveTab('tramitacoes'); setShowTramitacao(true); }}>
                Encaminhar Interno
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {tramitacoes.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma tramitação registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tipo</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead><TableHead>Observação</TableHead><TableHead>Usuário</TableHead><TableHead>Data</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {tramitacoes.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {(() => {
                        const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
                          encaminhamento: { label: 'Encaminhamento', variant: 'outline' },
                          transferencia:  { label: 'Transferência',  variant: 'secondary' },
                          devolucao:      { label: 'Devolução',      variant: 'destructive' },
                          cobranca:       { label: 'Cobrança',       variant: 'default' },
                        };
                        const tipo = t.tipoTramitacao ?? 'encaminhamento';
                        const cfg = map[tipo] ?? { label: tipo, variant: 'outline' as const };
                        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>{t.deSetorNome || "—"}</TableCell>
                    <TableCell>{t.paraSetorNome || "—"}</TableCell>
                    <TableCell>{t.observacao}</TableCell>
                    <TableCell>{t.usuarioNome}</TableCell>
                    <TableCell>{new Date(t.criadoEm).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TramitacaoDialog
        open={showTramitacao}
        onOpenChange={setShowTramitacao}
        tipoEncaminhar={tipoEncaminhar}
        setTipoEncaminhar={setTipoEncaminhar}
        encaminharSetorId={encaminharSetorId}
        setEncaminharSetorId={setEncaminharSetorId}
        encaminharObs={encaminharObs}
        setEncaminharObs={setEncaminharObs}
        setorOrigemDevolucao={setorOrigemDevolucao}
        setores={setores}
        manifestacaoSetorId={manifestacaoSetorId}
        onConfirm={handleEncaminhar}
        tramitacoes={tramitacoes}
        saving={saving}
      />
    </div>
  );
}
