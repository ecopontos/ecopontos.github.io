import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CanalEnvio, Resposta } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface EnviarRespostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manifestacao: ManifestacaoSummary;
  respostas: Resposta[];
  enviarCanal: CanalEnvio;
  setEnviarCanal: (v: CanalEnvio) => void;
  enviarDestinatario: string;
  setEnviarDestinatario: (v: string) => void;
  onConfirm: (respostas: Resposta[]) => void;
  saving: boolean;
}

export function EnviarRespostaDialog({
  open, onOpenChange,
  manifestacao, respostas,
  enviarCanal, setEnviarCanal,
  enviarDestinatario, setEnviarDestinatario,
  onConfirm, saving,
}: EnviarRespostaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onOpenChange(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Resposta ao Cidadão</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {(manifestacao.solicitanteEmail || manifestacao.solicitanteTelefone) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Canais disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {manifestacao.solicitanteEmail && (
                  <Button
                    size="sm"
                    variant={enviarCanal === 'email' ? 'default' : 'outline'}
                    onClick={() => { setEnviarCanal('email'); setEnviarDestinatario(manifestacao.solicitanteEmail!); }}
                  >
                    E-mail — {manifestacao.solicitanteEmail}
                  </Button>
                )}
                {manifestacao.solicitanteTelefone && (
                  <Button
                    size="sm"
                    variant={enviarCanal === 'whatsapp' ? 'default' : 'outline'}
                    onClick={() => { setEnviarCanal('whatsapp'); setEnviarDestinatario(manifestacao.solicitanteTelefone!); }}
                  >
                    WhatsApp — {manifestacao.solicitanteTelefone}
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Canal de envio</Label>
            <Select value={enviarCanal} onValueChange={v => { setEnviarCanal(v as CanalEnvio); setEnviarDestinatario(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="portal">Portal do Cidadão</SelectItem>
                <SelectItem value="impresso">Impresso / Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {enviarCanal === 'email' && (
            <div className="space-y-2">
              <Label>E-mail do destinatário <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={enviarDestinatario}
                onChange={e => setEnviarDestinatario(e.target.value)}
                placeholder="cidadao@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">O e-mail será enviado via SMTP configurado em Configurações.</p>
            </div>
          )}
          {enviarCanal === 'whatsapp' && (
            <div className="space-y-2">
              <Label>Número de WhatsApp <span className="text-destructive">*</span></Label>
              <Input
                type="tel"
                value={enviarDestinatario}
                onChange={e => setEnviarDestinatario(e.target.value)}
                placeholder="(11) 99999-9999"
              />
              <p className="text-xs text-muted-foreground">Abrirá o WhatsApp com a mensagem pré-preenchida para confirmação e envio manual.</p>
            </div>
          )}
          {(enviarCanal === 'portal' || enviarCanal === 'impresso') && (
            <div className="space-y-2">
              <Label>Referência / protocolo externo <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={enviarDestinatario}
                onChange={e => setEnviarDestinatario(e.target.value)}
                placeholder="Ex: número do protocolo no portal..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(respostas)} disabled={saving}>
            <Send className="h-4 w-4 mr-1" />
            {enviarCanal === 'email' ? 'Enviar E-mail' : enviarCanal === 'whatsapp' ? 'Abrir WhatsApp' : 'Registrar Envio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
