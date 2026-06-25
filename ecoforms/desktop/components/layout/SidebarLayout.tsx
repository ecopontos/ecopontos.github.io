"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/src/lib/utils";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ecoforms_sidebar_collapsed");
      if (raw !== null) {
        setCollapsedState(raw === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem("ecoforms_sidebar_collapsed", String(v));
    } catch {
      // ignore
    }
  };

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      <div className={cn("flex min-h-screen bg-background")}>{children}</div>
    </SidebarContext.Provider>
  );
}

export function SidebarMain({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto transition-all duration-300 pt-16 md:pt-0",
        className
      )}
    >
      {children}
    </main>
  );
}
