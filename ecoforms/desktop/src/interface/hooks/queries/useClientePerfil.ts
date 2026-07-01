"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { useSqlite } from "./useSqlite";
import {
  CLIENTE_PERFIL_KPIS,
  CLIENTE_COLETAS,
  CLIENTE_OCORRENCIAS_COLETA,
  CLIENTE_INTERCORRENCIAS,
  CLIENTE_MANIFESTACOES,
  CLIENTE_ROTEIROS,
} from "@/src/application/persistence/sqlite/queries/cliente-perfil";
import type {
  ClientePerfilKpisRow,
  ClienteColetaRow,
  ClienteOcorrenciaRow,
  ClienteIntercorrenciaRow,
  ClienteManifestacaoRow,
  ClienteRoteiroRow,
} from "@/src/application/persistence/sqlite/queries/cliente-perfil";
import { AGENDAMENTOS_BY_USER } from "@/src/application/persistence/sqlite/queries/service";

export interface ClienteAgendamentoRow {
  id: string;
  status: string;
  cliente_nome: string;
  vagas_solicitadas: number;
  criado_em: string;
  slot_titulo: string;
  data_inicio: string;
  tipo_nome: string;
}

const EMPTY_KPIS: ClientePerfilKpisRow = {
  primeira_coleta: null,
  ultima_coleta: null,
  total_coletas: 0,
  total_quantidade: 0,
  manifestacoes_abertas: 0,
  roteiros_ativos: 0,
};

export function useClientePerfilKpis(clienteId: string | null, enabled: boolean = true) {
  const sqlite = useSqlite();
  const [data, setData] = useState<ClientePerfilKpisRow>(EMPTY_KPIS);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clienteId || !enabled) return;
    setLoading(true);
    try {
      const rows = await sqlite.query<ClientePerfilKpisRow>(
        CLIENTE_PERFIL_KPIS.sql,
        [clienteId, clienteId, clienteId, clienteId, clienteId, clienteId],
      );
      setData(rows[0] ?? EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, [clienteId, enabled, sqlite]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

function useClientePerfilList<T>(clienteId: string | null, enabled: boolean, sql: string, paramCount: number = 1) {
  const sqlite = useSqlite();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!clienteId || !enabled) return;
    setLoading(true);
    try {
      const rows = await sqlite.query<T>(sql, Array(paramCount).fill(clienteId));
      setData(rows);
    } finally {
      setLoading(false);
    }
  }, [clienteId, enabled, sql, paramCount, sqlite]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useClienteColetas(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteColetaRow>(clienteId, enabled, CLIENTE_COLETAS.sql);
}

export function useClienteOcorrencias(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteOcorrenciaRow>(clienteId, enabled, CLIENTE_OCORRENCIAS_COLETA.sql);
}

export function useClienteIntercorrencias(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteIntercorrenciaRow>(clienteId, enabled, CLIENTE_INTERCORRENCIAS.sql);
}

export function useClienteManifestacoes(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteManifestacaoRow>(clienteId, enabled, CLIENTE_MANIFESTACOES.sql);
}

export function useClienteRoteiros(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteRoteiroRow>(clienteId, enabled, CLIENTE_ROTEIROS.sql);
}

export function useClienteAgendamentos(clienteId: string | null, enabled: boolean = true) {
  return useClientePerfilList<ClienteAgendamentoRow>(clienteId, enabled, AGENDAMENTOS_BY_USER.sql, 2);
}
