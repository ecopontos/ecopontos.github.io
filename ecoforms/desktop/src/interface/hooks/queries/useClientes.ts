/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { Cliente, ClienteContato, ClienteFilter, ClientePjVinculo } from '@/types/clientes';

type PjVinculoWithDetails = ClientePjVinculo & { pj_nome: string; pj_documento?: string | null; pj_cidade?: string | null; pj_estado?: string | null };

export function useClientes(filter?: ClienteFilter) {
    const [data, setData] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const filterRef = useRef(filter);
    filterRef.current = filter;
    const filterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const repo = container.clienteRepository;
            const rows = await repo.findAll(filterRef.current);
            setData(rows);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function useClienteById(id: string | null) {
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) { setCliente(null); setLoading(false); } return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const r = await c.clienteRepository.findById(id);
                if (!cancelled) { setCliente(r); setLoading(false); }
            } catch { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id]);

    return { cliente, loading };
}

export function useClienteContatos(clienteId: string | null) {
    const [data, setData] = useState<ClienteContato[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!clienteId) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.clienteRepository.findContatos(clienteId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [clienteId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function usePfContactsByPj(pjId: string | null) {
    const [data, setData] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!pjId) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.clienteRepository.findPfByPjId(pjId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [pjId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export type PhoneSearchCandidate = {
    cliente: Cliente;
    viaContato?: string; // nome da PF cujo telefone levou a esta PJ
};

export function useClientePhoneSearch(telefone: string) {
    const [candidates, setCandidates] = useState<PhoneSearchCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const search = useCallback(async (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 4) { setCandidates([]); setSearched(false); return; }
        setLoading(true);
        setSearched(false);
        try {
            const container = await getContainerAsync();
            const repo = container.clienteRepository;
            const matches = await repo.findByTelefone(cleaned);

            const pjMap = new Map<string, PhoneSearchCandidate>();

            for (const c of matches) {
                if (c.tipo === 'PJ') {
                    if (!pjMap.has(c.id)) pjMap.set(c.id, { cliente: c });
                } else {
                    const vinculos = await repo.findPjByPfId(c.id);
                    if (vinculos.length > 0) {
                        for (const v of vinculos) {
                            if (!pjMap.has(v.pj_id)) {
                                const pj = await repo.findById(v.pj_id);
                                if (pj) pjMap.set(pj.id, { cliente: pj, viaContato: c.nome });
                            }
                        }
                    } else if (c.pj_id) {
                        if (!pjMap.has(c.pj_id)) {
                            const pj = await repo.findById(c.pj_id);
                            if (pj) pjMap.set(pj.id, { cliente: pj, viaContato: c.nome });
                        }
                    } else {
                        if (!pjMap.has(c.id)) pjMap.set(c.id, { cliente: c });
                    }
                }
            }

            setCandidates(Array.from(pjMap.values()));
        } finally {
            setLoading(false);
            setSearched(true);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => search(telefone), 450);
        return () => clearTimeout(timer);
    }, [telefone, search]);

    return { candidates, loading, searched };
}

export function usePfUnassigned() {
    const [data, setData] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.clienteRepository.findPfUnassigned();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function usePjByPfId(pfId: string | null) {
    const [data, setData] = useState<PjVinculoWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!pfId) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.clienteRepository.findPjByPfId(pfId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [pfId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function usePjUnassignedToPf(pfId: string | null) {
    const [data, setData] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!pfId) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.clienteRepository.findPjUnassignedToPf(pfId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [pfId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
