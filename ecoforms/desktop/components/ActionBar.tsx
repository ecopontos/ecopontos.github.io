"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aplicarMapeamento, type ActionButtonConfig, type ActionContext, type ActionSyncOutbox } from "@/src/application/actions/ActionRegistry";
import { useSetores } from "@/src/interface/hooks/catalog/auth";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import * as LucideIcons from "lucide-react";

interface ActionBarProps {
  actions: ActionButtonConfig[];
  context: ActionContext;
}

function EncaminharPanel({ context, onAction, onCancel }: {
    context: ActionContext;
    onAction: (values: Record<string, unknown>) => void;
    onCancel: () => void;
}) {
    const [setorDestino, setSetorDestino] = useState("");
    const [tipoAcao, setTipoAcao] = useState("");
    const [descricao, setDescricao] = useState("");
    const { data: rows } = useSetores(true);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Setor destino <span className="text-destructive">*</span></Label>
                <Select value={setorDestino} onValueChange={setSetorDestino}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                        {rows.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Tipo de ação <span className="text-destructive">*</span></Label>
                <Select value={tipoAcao} onValueChange={setTipoAcao}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="analise">Análise</SelectItem>
                        <SelectItem value="execucao">Execução</SelectItem>
                        <SelectItem value="fiscalizacao">Fiscalização</SelectItem>
                        <SelectItem value="remocao">Remoção</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Descrição / motivo <span className="text-destructive">*</span></Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o motivo do encaminhamento" />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button disabled={!setorDestino || !tipoAcao || !descricao} onClick={() => onAction({ setorDestino, tipoAcao, descricao })}>
                    Encaminhar
                </Button>
            </DialogFooter>
        </div>
    );
}

function ReencaminharPanel({ context, onAction, onCancel }: {
    context: ActionContext;
    onAction: (values: Record<string, unknown>) => void;
    onCancel: () => void;
}) {
    const [setorDestino, setSetorDestino] = useState("");
    const [motivo, setMotivo] = useState("");
    const { data: rows } = useSetores(true);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Setor destino</Label>
                <Select value={setorDestino} onValueChange={setSetorDestino}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent>
                        {rows.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Motivo <span className="text-destructive">*</span></Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do reencaminhamento" required />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button variant="destructive" disabled={!setorDestino || !motivo} onClick={() => onAction({ setorDestino, motivo })}>
                    Reencaminhar
                </Button>
            </DialogFooter>
        </div>
    );
}

export function ActionBar({ actions, context }: ActionBarProps) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<ActionButtonConfig | null>(null);
  const [inputAction, setInputAction] = useState<ActionButtonConfig | null>(null);
  const [expandAction, setExpandAction] = useState<ActionButtonConfig | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState<string | null>(null);

  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: ActionButtonConfig) => {
    if (action.confirmationRequired) {
      setConfirmAction(action);
      return;
    }
    if (action.requiresInput) {
      setInputAction(action);
      setInputValues({});
      return;
    }
    if (action.expandPanel) {
      if (action.expandPanel.queryParam && context.targetId) {
        router.push(`/tasks/${context.targetId}?action=${action.expandPanel.panel}`);
        return;
      }
      setExpandAction(action);
      return;
    }
    await executeAction(action, {});
  };

  const executeAction = async (action: ActionButtonConfig, userInput: Record<string, unknown>) => {
    setLoading(action.id);
    try {
      const mapped = aplicarMapeamento(action.fieldMapping, context);
      // ADR-020 §2 — garante que eventBus nunca é undefined no ActionContext
      const syncOutbox: ActionSyncOutbox = context.syncOutbox ?? (await getContainerAsync()).syncOutbox;
      const ctxWithInput: ActionContext = {
        ...context,
        syncOutbox,
        input: { ...mapped, ...userInput },
      };
      const result = await action.handler(ctxWithInput);
      if (result.success) {
        toast.success(result.message);
        if (result.redirect) {
          router.push(result.redirect);
        }
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(`Erro na ação: ${String(err)}`);
    } finally {
      setLoading(null);
      setConfirmAction(null);
      setInputAction(null);
    }
  };

  const renderIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[iconName];
    if (!Icon) return null;
    return <Icon className="h-4 w-4 mr-2" />;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.color === "destructive" ? "destructive" : action.color === "outline" ? "outline" : "default"}
          size="sm"
          onClick={() => handleAction(action)}
          disabled={loading === action.id}
          className={action.color && !["destructive", "outline"].includes(action.color) ? `bg-${action.color}-600 hover:bg-${action.color}-700` : undefined}
        >
          {loading === action.id ? (
            <LucideIcons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            renderIcon(action.icon)
          )}
          {action.label}
          {action.expandPanel && <span className="ml-1 opacity-60">›</span>}
        </Button>
      ))}

      {/* Modal de confirmação */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar ação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.confirmationMessage || `Deseja executar "${confirmAction?.label}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancelar
            </Button>
            <Button
              variant={confirmAction?.color === "destructive" ? "destructive" : "default"}
              onClick={() => confirmAction && executeAction(confirmAction, {})}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Painel de decisão (expandPanel) */}
      <Dialog open={!!expandAction} onOpenChange={() => setExpandAction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{expandAction?.label}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2">
            {expandAction?.expandPanel?.panel === "encaminhar" && (
              <EncaminharPanel context={context} onAction={(values) => {
                executeAction(expandAction!, values);
              }} onCancel={() => setExpandAction(null)} />
            )}
            {expandAction?.expandPanel?.panel === "reencaminhar" && (
              <ReencaminharPanel context={context} onAction={(values) => {
                executeAction(expandAction!, values);
              }} onCancel={() => setExpandAction(null)} />
            )}
            {!expandAction?.expandPanel?.panel && (
              <p className="text-sm text-muted-foreground">
                Configuração de painel não encontrada para esta ação.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de input */}
      <Dialog open={!!inputAction} onOpenChange={() => setInputAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inputAction?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {inputAction?.requiresInput?.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-destructive"> *</span>}
                </Label>
                {field.type === "select" ? (
                  <Select
                    value={(inputValues[field.id] as string) ?? ""}
                    onValueChange={(val) =>
                      setInputValues((prev) => ({ ...prev, [field.id]: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={(inputValues[field.id] as string) ?? ""}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInputAction(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => inputAction && executeAction(inputAction, inputValues)}
              disabled={inputAction?.requiresInput?.fields.some(
                (f) => f.required && !inputValues[f.id]
              )}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
