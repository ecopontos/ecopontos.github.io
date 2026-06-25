import { ArrowRightIcon, Info, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Resposta, EnvioResposta, ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { RespostaFormatadaEditor } from "./RespostaFormatadaEditor";
import { EnviarRespostaDialog } from "./EnviarRespostaDialog";

interface RespostasTabProps {
  respostas: Resposta[];
  envios: EnvioResposta[];
  manifestacao: ManifestacaoSummary;
  canEdit: boolean;
  canResponder: boolean;
  respostaText: string;
  setRespostaText: (v: string) => void;
  handleAddResposta: () => void;
  showEditor: boolean;
  setShowEditor: (v: boolean) => void;
  editorModeloId: string;
  setEditorModeloId: (v: string) => void;
  editorTexto: string;
  setEditorTexto: (v: string) => void;
  modelos: { id: string; titulo: string; corpo: string }[];
  handleSalvarResposta: (marcarRespondida: boolean) => void;
  showEnviar: boolean;
  setShowEnviar: (v: boolean) => void;
  setEnviarRespostaId: (v: string | null) => void;
  enviarCanal: 'email' | 'whatsapp' | 'portal' | 'impresso';
  setEnviarCanal: (v: 'email' | 'whatsapp' | 'portal' | 'impresso') => void;
  enviarDestinatario: string;
  setEnviarDestinatario: (v: string) => void;
  handleEnviarCidadao: (respostas: Resposta[]) => void;
  handleAbrirEditor: (respostaId: string, textoAtual: string) => void;
  saving: boolean;
}

export function RespostasTab({
  respostas, envios, manifestacao, canEdit, canResponder,
  respostaText, setRespostaText, handleAddResposta,
  showEditor, setShowEditor,
  editorModeloId, setEditorModeloId,
  editorTexto, setEditorTexto,
  modelos,   handleSalvarResposta,
  showEnviar, setShowEnviar, setEnviarRespostaId,
  enviarCanal, setEnviarCanal,
  enviarDestinatario, setEnviarDestinatario,
  handleEnviarCidadao, handleAbrirEditor,
  saving,
}: RespostasTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Fluxo de resposta ao cidadão</p>
          <div className="flex items-center gap-2 text-muted-foreground text-xs flex-wrap">
            <span className="rounded bg-background border px-2 py-0.5">1. Rascunho técnico</span>
            <ArrowRightIcon className="h-3 w-3 shrink-0" />
            <span className="rounded bg-background border px-2 py-0.5">2. Formatar para o cidadão</span>
            <ArrowRightIcon className="h-3 w-3 shrink-0" />
            <span className="rounded bg-background border px-2 py-0.5">3. Enviar ao cidadão</span>
          </div>
          <p className="text-muted-foreground text-xs">O rascunho técnico é interno — somente o texto formatado (etapa 2) é enviado ao cidadão.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fase 1 — Rascunho Técnico</CardTitle>
          <CardDescription>Crie o texto base da resposta. Esta etapa é interna.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="rascunho-texto">Texto técnico interno (não vai ao cidadão)</Label>
            <Textarea
              id="rascunho-texto"
              value={respostaText}
              onChange={e => setRespostaText(e.target.value)}
              placeholder="Escreva o rascunho técnico da resposta..."
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAddResposta} disabled={saving || !respostaText.trim()}>
              Salvar rascunho
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Respostas</CardTitle>
            <CardDescription>Histórico e status de cada resposta.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {respostas.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma resposta registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Texto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviada por</TableHead>
                  <TableHead>Revisada por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {respostas.map(r => {
                  const temEnvio = envios.some(e => e.respostaId === r.id);
                  const status = temEnvio ? 'enviada' : r.respostaFormatada ? 'formatada' : 'rascunho';
                  const statusCfg: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
                    rascunho: { label: 'Rascunho', variant: 'secondary' },
                    formatada: { label: 'Formatada', variant: 'outline' },
                    enviada: { label: 'Enviada', variant: 'default' },
                  };
                  const cfg = statusCfg[status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-xs truncate">{r.texto}</TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell>{r.enviadaPor}</TableCell>
                      <TableCell>{r.revisadaPor || "—"}</TableCell>
                      <TableCell>{new Date(r.enviadaEm).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {canResponder && (
                            <Button size="sm" variant="outline" onClick={() => handleAbrirEditor(r.id, r.respostaFormatada || r.texto)}>
                              Formatar
                            </Button>
                          )}
                          {r.respostaFormatada && (
                            <Button size="sm" variant="secondary" onClick={() => { setEnviarRespostaId(r.id); setShowEnviar(true); }}>
                              <Send className="h-3 w-3 mr-1" />Enviar ao Cidadão
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showEditor && (
        <RespostaFormatadaEditor
          modelos={modelos}
          editorModeloId={editorModeloId}
          setEditorModeloId={setEditorModeloId}
          editorTexto={editorTexto}
          setEditorTexto={setEditorTexto}
          onSaveRascunho={() => handleSalvarResposta(false)}
          onSaveRespondida={() => handleSalvarResposta(true)}
          onCancel={() => setShowEditor(false)}
          saving={saving}
        />
      )}

      {envios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Envios ao Cidadão</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {{ email: 'E-mail', whatsapp: 'WhatsApp', portal: 'Portal', impresso: 'Impresso' }[e.canal] ?? e.canal}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.destinatario || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.statusEnvio === 'enviado' ? 'outline' : e.statusEnvio === 'falha' ? 'destructive' : 'secondary'}>
                        {e.statusEnvio}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.dataEnvio ? new Date(e.dataEnvio).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EnviarRespostaDialog
        open={showEnviar}
        onOpenChange={setShowEnviar}
        manifestacao={manifestacao}
        respostas={respostas}
        enviarCanal={enviarCanal}
        setEnviarCanal={setEnviarCanal}
        enviarDestinatario={enviarDestinatario}
        setEnviarDestinatario={setEnviarDestinatario}
        onConfirm={handleEnviarCidadao}
        saving={saving}
      />
    </div>
  );
}
