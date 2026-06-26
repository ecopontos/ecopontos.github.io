"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ShowForManager, HideForRole } from "@/components/auth/PermissionGuards";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { DatabaseStatus } from "@/components/database/DatabaseSelector";
import { usePendingSolicitacoesCount } from "@/src/interface/hooks/queries/usePendingSolicitacoesCount";


import { useModules } from "@/src/interface/hooks/catalog/modules-views";
import { useSidebar } from "./SidebarLayout";
import { cn } from "@/src/lib/utils";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import {
  Home,
  FileText,
  Database,
  BarChart3,
  Package,
  KanbanSquare,
  FolderKanban,
  Inbox,
  Image as ImageIcon,
  LineChart,
  Shield,
  Users,
  MessageSquareWarning,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ChevronDown,
  Menu,
  Box,
  Calendar,
  HardHat,
  Send,
} from "lucide-react";

function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
  badge,
  dot,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  collapsed: boolean;
  active: boolean;
  badge?: number;
  dot?: boolean;
}) {
  const inner = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <span className="relative">
        <Icon className="h-5 w-5 shrink-0" />
        {dot && collapsed && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </span>
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white animate-pulse">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
      {!collapsed && dot && !badge && (
        <span className="h-2 w-2 rounded-full bg-red-500" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

function NavGroup({
  title,
  children,
  collapsed,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return <div className="py-1 space-y-0.5">{children}</div>;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
          <span>{title}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function AppSidebar() {
  const { user, logout, permissions } = useAuth();
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [adminOpen, setAdminOpen] = useState(false);

  const isManager = permissions.isAdmin() || permissions.isManager();

  const { data: pendingCountData } = usePendingSolicitacoesCount(
    isManager && !permissions.isAdmin() ? (user?.setores?.[0] || null) : null,
    { enabled: !!user && isManager, refetchInterval: 30000 },
  );

  const pendingCount = pendingCountData?.[0]?.total || 0;
  const { modules: publishedModules } = useModules('published');

  if (!user) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        <Link href="/" className="flex items-center gap-2 overflow-hidden">
          <Image src="/logo-pmf.png" alt="PMF" width={32} height={32} className="shrink-0" />
          {!collapsed && (
            <span className="truncate text-lg font-bold text-sidebar-foreground">
              EcoSuite
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(true)}
            className="h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {collapsed && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-2">
          <NavGroup title="Operacional" collapsed={collapsed} defaultOpen={isActive("/") || isActive("/kanban") || isActive("/minhas-solicitacoes") || isActive("/demandas")}>
            <NavItem
              href="/"
              icon={Home}
              label="Início"
              collapsed={collapsed}
              active={isActive("/")}
            />
            <NavItem
              href="/kanban"
              icon={KanbanSquare}
              label="Tarefas"
              collapsed={collapsed}
              active={isActive("/kanban")}
              badge={isManager ? pendingCount : undefined}
              dot={!isManager && pendingCount > 0}
            />
            <HideForRole roles={["operador"]}>
              <NavItem
                href="/minhas-solicitacoes"
                icon={Inbox}
                label="Minhas Solicitações"
                collapsed={collapsed}
                active={isActive("/minhas-solicitacoes")}
              />
            </HideForRole>
            <NavItem
              href="/demandas"
              icon={Send}
              label="Demandas"
              collapsed={collapsed}
              active={isActive("/demandas")}
            />
            <HideForRole roles={["admin", "gerente"]}>
              <NavItem
                href="/minhas-tarefas-campo"
                icon={HardHat}
                label="Tarefas de Campo"
                collapsed={collapsed}
                active={isActive("/minhas-tarefas-campo")}
              />
            </HideForRole>
          </NavGroup>

          <Separator className="my-2 bg-sidebar-border/50" />

          <HideForRole roles={["operador"]}>
            <NavGroup title="Gestão" collapsed={collapsed} defaultOpen={isActive("/forms") || isActive("/data-registry") || isActive("/analysis") || isActive("/remocao") || isActive("/projects")}>
              <NavItem
                href="/forms"
                icon={FileText}
                label="Form Builder"
                collapsed={collapsed}
                active={isActive("/forms")}
              />
              <NavItem
                href="/data-registry"
                icon={Database}
                label="Data Registry"
                collapsed={collapsed}
                active={isActive("/data-registry")}
              />
              <NavItem
                href="/analysis"
                icon={BarChart3}
                label="Análise"
                collapsed={collapsed}
                active={isActive("/analysis")}
              />
              <NavItem
                href="/remocao"
                icon={Package}
                label="Remoção"
                collapsed={collapsed}
                active={isActive("/remocao")}
              />
              <NavItem
                href="/projects"
                icon={FolderKanban}
                label="Projetos"
                collapsed={collapsed}
                active={isActive("/projects")}
              />
            </NavGroup>

            <Separator className="my-2 bg-sidebar-border/50" />
          </HideForRole>

          <HideForRole roles={["operador", "campo"]}>
            <NavGroup title="Relacionamento" collapsed={collapsed} defaultOpen={isActive("/history") || isActive("/clientes") || isActive("/manifestacoes") || isActive("/logistica") || isActive("/agendamentos")}>
              <NavItem
                href="/clientes"
                icon={Users}
                label="Clientes"
                collapsed={collapsed}
                active={isActive("/clientes")}
              />
              <NavItem
                href="/manifestacoes"
                icon={MessageSquareWarning}
                label="Manifestações"
                collapsed={collapsed}
                active={isActive("/manifestacoes")}
              />
              <NavItem
                href="/logistica"
                icon={Box}
                label="Logística"
                collapsed={collapsed}
                active={isActive("/logistica")}
              />
              <NavItem
                href="/agendamentos"
                icon={Calendar}
                label="Agendamentos"
                collapsed={collapsed}
                active={isActive("/agendamentos")}
              />
              <NavItem
                href="/history"
                icon={History}
                label="Histórico"
                collapsed={collapsed}
                active={isActive("/history")}
              />
            </NavGroup>

            <Separator className="my-2 bg-sidebar-border/50" />
          </HideForRole>

          {publishedModules.length > 0 && (
            <>
              <Separator className="my-2 bg-sidebar-border/50" />
              <NavGroup title="Módulos" collapsed={collapsed} defaultOpen={false}>
                {publishedModules.map(mod => (
                  <ModuleNavItem
                    key={mod.slug}
                    href={`/modulo/${mod.slug}`}
                    icon={mod.icon || undefined}
                    label={mod.name}
                    collapsed={collapsed}
                    active={isActive(`/modulo/${mod.slug}`)}
                  />
                ))}
              </NavGroup>
            </>
          )}

          <ShowForManager>
            <NavGroup title="Administração" collapsed={collapsed} defaultOpen={isActive("/gallery") || isActive("/tasks") || isActive("/admin")}>
              <NavItem
                href="/gallery"
                icon={ImageIcon}
                label="Galeria"
                collapsed={collapsed}
                active={isActive("/gallery")}
              />
              <NavItem
                href="/tasks?tab=metricas"
                icon={LineChart}
                label="Métricas"
                collapsed={collapsed}
                active={isActive("/tasks")}
              />

              {collapsed ? (
                <NavItem
                  href="/admin"
                  icon={Shield}
                  label="Administração"
                  collapsed={collapsed}
                  active={isActive("/admin")}
                />
              ) : (
                <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive("/admin")
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <Shield className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">Administração</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          adminOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                      <AdminSubItem href="/admin" label="Visão Geral" active={isActive("/admin") && pathname === "/admin"} />
                      <AdminSubItem href="/admin/agendamentos" label="Agendamentos" active={isActive("/admin/agendamentos")} />
                      <AdminSubItem href="/admin/service-types" label="Tipos de Serviço" active={isActive("/admin/service-types")} />
                      <AdminSubItem href="/admin/users" label="Usuários" active={isActive("/admin/users")} />
                      <AdminSubItem href="/admin/sectors" label="Setores" active={isActive("/admin/sectors")} />
                      <AdminSubItem href="/admin/escalas" label="Escalas de Turno" active={isActive("/admin/escalas")} />
                      <AdminSubItem href="/admin/modules" label="Módulos" active={isActive("/admin/modules")} />
                      <AdminSubItem href="/admin/inspector" label="Inspetor de Dados" active={isActive("/admin/inspector")} />
                      <AdminSubItem href="/admin/settings" label="Configurações" active={isActive("/admin/settings")} />
                      <AdminSubItem href="/admin/email" label="Configurar E-mail" active={isActive("/admin/email")} />
                      <AdminSubItem href="/admin/perfis" label="Perfis" active={isActive("/admin/perfis")} />
                      <AdminSubItem href="/admin/prazos" label="Tipos de Prazo" active={isActive("/admin/prazos")} />
                      <AdminSubItem href="/admin/residuos" label="Tipos de Resíduo" active={isActive("/admin/residuos")} />
                      <AdminSubItem href="/admin/exportar-mobile" label="Exportar Mobile" active={isActive("/admin/exportar-mobile")} />
                      <AdminSubItem href="/admin/seguranca/chaves" label="Segurança / Chaves" active={isActive("/admin/seguranca/chaves")} />
                      <AdminSubItem href="/admin/legacy-sync" label="Sync Legado (PG)" active={isActive("/admin/legacy-sync")} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </NavGroup>
          </ShowForManager>
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div className="flex items-center gap-2">
            <SyncStatusIndicator />
            <DatabaseStatus />
          </div>
          {!collapsed && (
            <span className="text-xs text-sidebar-foreground/60 truncate flex-1">
              Olá, <strong>{user.nome}</strong>
            </span>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="h-8 w-8 shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>Sair</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-300 border-r border-sidebar-border bg-sidebar",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile trigger */}
      <div className="md:hidden fixed top-4 left-4 z-40">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="h-10 w-10 bg-background shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="h-full" onClick={() => setMobileOpen(false)}>
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function ModuleNavItem({
  href,
  icon,
  label,
  collapsed,
  active,
}: {
  href: string;
  icon?: string;
  label: string;
  collapsed: boolean;
  active: boolean;
}) {
  const inner = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <span className="h-5 w-5 shrink-0 flex items-center justify-center text-base leading-none">
        {icon || <Box className="h-5 w-5" />}
      </span>
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

function AdminSubItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
      )}
    >
      {label}
    </Link>
  );
}
