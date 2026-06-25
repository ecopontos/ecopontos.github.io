"use client";

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, RotateCcw, History, Loader2, ShieldAlert } from "lucide-react";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import { useAdminUsers } from "@/src/interface/hooks/catalog/auth";

interface SaltHistoryEntry {
  id: string;
  salt_hash: string;
  replaced_at: string;
  replaced_by: string;
  reason: string;
}

function ChavesSyncContent() {
  const { users, loading: loadingUsers } = useAdminUsers();

  const [userId, setUserId] = useState<string>("");
  const [rotatePassphrase, setRotatePassphrase] = useState("");
  const [rotateReason, setRotateReason] = useState("");
  const [recoverPassphrase, setRecoverPassphrase] = useState("");
  const [rotating, setRotating] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [history, setHistory] = useState<SaltHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const rows = await invoke<SaltHistoryEntry[]>("list_salt_history", { userId });
      setHistory(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRotate = async () => {
    if (!userId) {
      toast.error("Selecione um usuário");
      return;
    }
    if (rotatePassphrase.length < 8) {
      toast.error("A passphrase de recuperação deve ter ao menos 8 caracteres");
      return;
    }
    setRotating(true);
    try {
      await invoke<string>("rotate_sync_salt", {
        userId,
        recoveryPassphrase: rotatePassphrase,
        reason: rotateReason || null,
      });
      toast.success("Salt rotacionado. O salt anterior foi guardado no escrow.");
      setRotatePassphrase("");
      setRotateReason("");
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRotating(false);
    }
  };

  const handleRecover = async () => {
    if (!userId) {
      toast.error("Selecione um usuário");
      return;
    }
    if (!recoverPassphrase) {
      toast.error("Informe a passphrase de recuperação");
      return;
    }
    setRecovering(true);
    try {
      await invoke<string>("recover_sync_salt", {
        userId,
        recoveryPassphrase: recoverPassphrase,
      });
      toast.success("Salt recuperado e restaurado para o usuário.");
      setRecoverPassphrase("");
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chaves de Sincronização</h1>
        <p className="text-muted-foreground">
          Rotação e recuperação do <code>sync_salt</code> por usuário, com escrow cifrado (AES-256-GCM).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuário</CardTitle>
          <CardDescription>
            Selecione o usuário cuja chave de sincronização será gerenciada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="user-select">Usuário</Label>
            <select
              id="user-select"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={loadingUsers}
            >
              <option value="">— selecione —</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.perfil})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Guarde a passphrase de recuperação em local seguro. Sem ela, o salt anterior no escrow
          <strong> não pode ser recuperado</strong>. A rotação invalida a chave de sync derivada do salt antigo.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" /> Rotacionar salt
            </CardTitle>
            <CardDescription>Gera um novo salt e arquiva o atual cifrado no escrow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="rotate-pass">Passphrase de recuperação</Label>
              <Input
                id="rotate-pass"
                type="password"
                value={rotatePassphrase}
                onChange={(e) => setRotatePassphrase(e.target.value)}
                placeholder="mín. 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rotate-reason">Motivo (opcional)</Label>
              <Input
                id="rotate-reason"
                value={rotateReason}
                onChange={(e) => setRotateReason(e.target.value)}
                placeholder="ex.: chave comprometida"
              />
            </div>
            <Button onClick={handleRotate} disabled={rotating || !userId} className="w-full">
              {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Rotacionar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" /> Recuperar salt
            </CardTitle>
            <CardDescription>Restaura um salt anterior a partir do escrow usando a passphrase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="recover-pass">Passphrase de recuperação</Label>
              <Input
                id="recover-pass"
                type="password"
                value={recoverPassphrase}
                onChange={(e) => setRecoverPassphrase(e.target.value)}
                placeholder="passphrase usada na rotação"
              />
            </div>
            <Button onClick={handleRecover} disabled={recovering || !userId} variant="secondary" className="w-full">
              {recovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Recuperar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de rotações
          </CardTitle>
          <CardDescription>Registros de escrow para o usuário selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          {!userId ? (
            <p className="text-sm text-muted-foreground">Selecione um usuário para ver o histórico.</p>
          ) : loadingHistory ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma rotação registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Quando</th>
                    <th className="py-2 pr-4">Por</th>
                    <th className="py-2 pr-4">Motivo</th>
                    <th className="py-2 pr-4">Hash (salt anterior)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{h.replaced_at}</td>
                      <td className="py-2 pr-4">{h.replaced_by}</td>
                      <td className="py-2 pr-4">{h.reason || "—"}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{h.salt_hash.slice(0, 16)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChavesSyncPage() {
  return (
    <ProtectedPage permission="system.config" redirectTo="/admin">
      <ChavesSyncContent />
    </ProtectedPage>
  );
}
