import type { Demanda } from '../../domain/demanda/Demanda';

export interface DemandaViewModel {
    id: string;
    origemTipo: string;
    origemLabel: string;
    solicitanteId: string;
    destinatarioId: string;
    descricao: string | null;
    status: Demanda['status'];
    statusLabel: string;
    statusColor: string;
    politicaConclusao: string;
    autoAceite: boolean;
    aceitoPor: string | null;
    aceitoEm: string | null;
    aceitoEmFormatted: string | null;
    encerradoPor: string | null;
    encerradoEm: string | null;
    criadaEm: string;
    criadaEmFormatted: string;
}

const STATUS_LABELS: Record<Demanda['status'], string> = {
    aberta: 'Aberta',
    aceita: 'Aceita',
    em_campo: 'Em Campo',
    concluida: 'Concluída',
};

const STATUS_COLORS: Record<Demanda['status'], string> = {
    aberta: 'text-yellow-600',
    aceita: 'text-blue-600',
    em_campo: 'text-orange-600',
    concluida: 'text-green-600',
};

const ORIGEM_LABELS: Record<string, string> = {
    ouvidoria: 'Ouvidoria',
    interno: 'Interno',
    proprio: 'Próprio',
};

function formatDate(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function toDemandaViewModel(demanda: Demanda): DemandaViewModel {
    return {
        id: demanda.id,
        origemTipo: demanda.origemTipo,
        origemLabel: ORIGEM_LABELS[demanda.origemTipo] ?? demanda.origemTipo,
        solicitanteId: demanda.solicitanteId,
        destinatarioId: demanda.destinatarioId,
        descricao: demanda.descricao,
        status: demanda.status,
        statusLabel: STATUS_LABELS[demanda.status] ?? demanda.status,
        statusColor: STATUS_COLORS[demanda.status] ?? 'text-gray-600',
        politicaConclusao: demanda.politicaConclusao,
        autoAceite: demanda.autoAceite,
        aceitoPor: demanda.aceitoPor,
        aceitoEm: demanda.aceitoEm,
        aceitoEmFormatted: formatDate(demanda.aceitoEm),
        encerradoPor: demanda.encerradoPor,
        encerradoEm: demanda.encerradoEm,
        criadaEm: demanda.criadaEm,
        criadaEmFormatted: formatDate(demanda.criadaEm) ?? demanda.criadaEm,
    };
}
