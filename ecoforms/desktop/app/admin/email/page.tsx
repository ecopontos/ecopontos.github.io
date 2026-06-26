"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { invoke } from "@/src/interface/hooks/tauri/useTauriInvoke";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useEmailConfig } from "@/src/interface/hooks/queries/useEmailConfig";
import { useSaveEmailConfig } from "@/src/interface/hooks/mutations/useSaveEmailConfig";
import { EmailConfig } from "@/src/domain/email-config/EmailConfig";

interface EmailConfigForm {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  enabled: boolean;
}

const PRESETS: Record<string, Partial<EmailConfigForm>> = {
  gmail: { smtp_host: "smtp.gmail.com", smtp_port: 587, use_tls: true },
  outlook: { smtp_host: "smtp.office365.com", smtp_port: 587, use_tls: true },
  yahoo: { smtp_host: "smtp.mail.yahoo.com", smtp_port: 587, use_tls: true },
};

export default function EmailConfigPage() {
  const { data: savedConfig, loading, refetch } = useEmailConfig();
  const { save, saving } = useSaveEmailConfig();
  
  const [config, setConfig] = useState<EmailConfigForm>({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    from_name: "",
    use_tls: true,
    enabled: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (savedConfig) {
      setConfig({
        smtp_host: savedConfig.smtpHost,
        smtp_port: savedConfig.smtpPort,
        smtp_user: savedConfig.smtpUser,
        smtp_password: savedConfig.smtpPassword,
        from_email: savedConfig.fromEmail,
        from_name: savedConfig.fromName,
        use_tls: savedConfig.useTls,
        enabled: savedConfig.enabled,
      });
    }
  }, [savedConfig]);

  const handleSave = async () => {
    try {
      const emailConfig = EmailConfig.fromProps({
        id: "default",
        smtpHost: config.smtp_host,
        smtpPort: config.smtp_port,
        smtpUser: config.smtp_user,
        smtpPassword: config.smtp_password,
        fromEmail: config.from_email,
        fromName: config.from_name,
        useTls: config.use_tls,
        enabled: config.enabled,
        atualizadoEm: null,
      });
      await save(emailConfig);
      await refetch();
      toast.success("Configuração salva");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await handleSave();
      const msg = await invoke<string>("test_email_connection");
      setTestResult({ ok: true, msg });
      toast.success(msg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na conexão";
      setTestResult({ ok: false, msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const applyPreset = (key: string) => {
    setConfig(c => ({ ...c, ...PRESETS[key] }));
    setTestResult(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando configuração...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Configuração de E-mail</h1>
          <p className="text-sm text-muted-foreground">Servidor SMTP para envio de respostas às manifestações</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predefinições</CardTitle>
          <CardDescription>Clique para preencher host e porta automaticamente</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => applyPreset("gmail")}>Gmail</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("outlook")}>Outlook / Office 365</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("yahoo")}>Yahoo Mail</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servidor SMTP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Host</Label>
              <Input
                value={config.smtp_host}
                onChange={e => setConfig(c => ({ ...c, smtp_host: e.target.value }))}
                placeholder="smtp.servidor.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input
                type="number"
                value={config.smtp_port}
                onChange={e => setConfig(c => ({ ...c, smtp_port: Number(e.target.value) }))}
                placeholder="587"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={config.use_tls}
              onCheckedChange={v => setConfig(c => ({ ...c, use_tls: v }))}
            />
            <Label>Usar STARTTLS</Label>
            <span className="text-xs text-muted-foreground">(recomendado para porta 587)</span>
          </div>
          <div className="space-y-2">
            <Label>Usuário SMTP</Label>
            <Input
              value={config.smtp_user}
              onChange={e => setConfig(c => ({ ...c, smtp_user: e.target.value }))}
              placeholder="usuario@servidor.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha / App Password</Label>
            <Input
              type="password"
              value={config.smtp_password}
              onChange={e => setConfig(c => ({ ...c, smtp_password: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Para Gmail: use uma <strong>App Password</strong> (conta Google → Segurança → Senhas de app).
              Para Office 365: pode ser necessário habilitar autenticação básica no tenant.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remetente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do remetente</Label>
            <Input
              value={config.from_name}
              onChange={e => setConfig(c => ({ ...c, from_name: e.target.value }))}
              placeholder="Ouvidoria Municipal"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail de envio</Label>
            <Input
              type="email"
              value={config.from_email}
              onChange={e => setConfig(c => ({ ...c, from_email: e.target.value }))}
              placeholder="ouvidoria@prefeitura.gov.br"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ativar envio</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={v => setConfig(c => ({ ...c, enabled: v }))}
          />
          <Label>{config.enabled ? "Envio ativo — os e-mails serão enviados" : "Envio desativado — nenhum e-mail será enviado"}</Label>
        </CardContent>
      </Card>

      {testResult && (
        <div className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${testResult.ok ? "border-green-300 bg-green-50 text-green-800" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
          {testResult.ok
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <XCircle className="h-4 w-4 shrink-0" />}
          {testResult.msg}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Salvar
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing || saving}>
          {testing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Testar Conexão
        </Button>
      </div>
    </div>
  );
}
