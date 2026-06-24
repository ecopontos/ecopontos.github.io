import { TipoPrazo, RecorrenciaConfig } from "./TaskDateSection";
import { TaskDateConfig } from "@/types";

/**
 * Format an ISO string to a local datetime string (YYYY-MM-DDTHH:mm) 
 * suitable for <input type="datetime-local" />
 */
export function formatToLocalDateTime(isoString?: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
}

/**
 * Derives the effective `prazo` ISO string that gets stored in tarefas.prazo.
 * - unico:      data_inicio
 * - periodo:    data_fim (deadline is the end of the period)
 * - recorrente: data_inicio (first occurrence)
 */
export function derivePrazoFromDateConfig(
    tipo: TipoPrazo,
    prazo: string,
    prazoFim: string
): string | undefined {
    if (tipo === 'periodo') {
        const effective = prazoFim || prazo;
        return effective ? new Date(effective).toISOString() : undefined;
    }
    return prazo ? new Date(prazo).toISOString() : undefined;
}

/**
 * Builds the dateConfig object to store in task payload.
 */
export function buildDateConfig(
    tipo: TipoPrazo,
    prazo: string,
    prazoFim: string,
    recorrencia: RecorrenciaConfig
): TaskDateConfig | undefined {
    if (!prazo && !prazoFim) return undefined;

    const config: TaskDateConfig = { tipo };

    if (prazo) {
        config.data_inicio = new Date(prazo).toISOString();
    }
    if (tipo === 'periodo' && prazoFim) {
        config.data_fim = new Date(prazoFim).toISOString();
    }
    if (tipo === 'recorrente') {
        config.recorrencia = {
            frequencia: recorrencia.frequencia,
            intervalo: recorrencia.intervalo,
            dias_semana: recorrencia.dias_semana,
            fim_recorrencia: recorrencia.fim_recorrencia ? new Date(recorrencia.fim_recorrencia).toISOString() : undefined,
        };
    }

    return config;
}

/**
 * Restores date picker state from a stored TaskDateConfig.
 */
export function restoreDateState(dateConfig: TaskDateConfig | undefined, legacyPrazo?: string): {
    tipoPrazo: TipoPrazo;
    prazo: string;
    prazoFim: string;
    recorrencia: RecorrenciaConfig;
} {
    if (!dateConfig) {
        // Legacy task — treat as single date
        return {
            tipoPrazo: 'unico',
            prazo: legacyPrazo ? formatToLocalDateTime(legacyPrazo) : '',
            prazoFim: '',
            recorrencia: { frequencia: 'semanal', intervalo: 1, dias_semana: [], fim_recorrencia: '' },
        };
    }

    return {
        tipoPrazo: dateConfig.tipo,
        prazo: formatToLocalDateTime(dateConfig.data_inicio),
        prazoFim: formatToLocalDateTime(dateConfig.data_fim),
        recorrencia: dateConfig.recorrencia
            ? {
                frequencia: dateConfig.recorrencia.frequencia,
                intervalo: dateConfig.recorrencia.intervalo,
                dias_semana: dateConfig.recorrencia.dias_semana ?? [],
                fim_recorrencia: dateConfig.recorrencia.fim_recorrencia 
                    ? formatToLocalDateTime(dateConfig.recorrencia.fim_recorrencia).slice(0, 10) 
                    : '',
            }
            : { frequencia: 'semanal', intervalo: 1, dias_semana: [], fim_recorrencia: '' },
    };
}
