import { invoke } from "@tauri-apps/api/core";

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
}

export interface CepData {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export async function fetchCep(cep: string): Promise<CepData | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  // 1. Tenta via Tauri IPC (desktop)
  try {
    const data = await invoke<CepData | null>("fetch_cep", { cep: digits });
    if (data && (data.localidade || data.logradouro || data.bairro || data.uf)) return data;
  } catch {
    // ignorar — provavelmente está rodando no navegador
  }

  // 2. Fallback: fetch direto no navegador (dev server / web)
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const body = await res.json();
    if (body?.erro) return null;
    return {
      logradouro: body.logradouro,
      bairro: body.bairro,
      localidade: body.localidade,
      uf: body.uf,
    };
  } catch {
    return null;
  }
}
