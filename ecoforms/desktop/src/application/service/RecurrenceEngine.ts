export interface RecorrenciaConfig {
    frequencia: 'diaria' | 'semanal' | 'mensal' | 'anual';
    intervalo: number;
    dias_semana: number[]; // 0=dom ... 6=sab
    fim_recorrencia: string; // "YYYY-MM-DD" ou ""
}

/**
 * Expande uma config de recorrência em pares {dataInicio, dataFim}.
 * A duração de cada ocorrência é igual à do slot-modelo (dataFim − dataInicio).
 * Cap: 365 ocorrências ou 1 ano a partir do início.
 */
export function expandRecurrence(
    dataInicio: string,
    dataFim: string,
    config: RecorrenciaConfig,
): Array<{ dataInicio: string; dataFim: string }> {
    const durationMs = new Date(dataFim).getTime() - new Date(dataInicio).getTime();

    const endDate = config.fim_recorrencia
        ? new Date(config.fim_recorrencia + 'T23:59:59')
        : (() => { const d = new Date(dataInicio); d.setFullYear(d.getFullYear() + 1); return d; })();

    const MAX = 365;
    const occurrences: Array<{ dataInicio: string; dataFim: string }> = [];

    if (config.frequencia === 'semanal' && config.dias_semana.length > 0) {
        // Para cada ciclo de N semanas, gera ocorrências nos dias configurados.
        const startSunday = new Date(dataInicio);
        startSunday.setDate(startSunday.getDate() - startSunday.getDay());

        let weekStart = new Date(startSunday);
        const firstOcc = new Date(dataInicio);

        while (weekStart <= endDate && occurrences.length < MAX) {
            for (const day of [...config.dias_semana].sort((a, b) => a - b)) {
                const occDate = new Date(weekStart);
                occDate.setDate(weekStart.getDate() + day);
                if (occDate >= firstOcc && occDate <= endDate && occurrences.length < MAX) {
                    occurrences.push({
                        dataInicio: occDate.toISOString(),
                        dataFim: new Date(occDate.getTime() + durationMs).toISOString(),
                    });
                }
            }
            weekStart.setDate(weekStart.getDate() + 7 * Math.max(1, config.intervalo));
        }
    } else {
        let current = new Date(dataInicio);
        while (current <= endDate && occurrences.length < MAX) {
            occurrences.push({
                dataInicio: current.toISOString(),
                dataFim: new Date(current.getTime() + durationMs).toISOString(),
            });
            const step = Math.max(1, config.intervalo);
            switch (config.frequencia) {
                case 'diaria':  current.setDate(current.getDate() + step); break;
                case 'semanal': current.setDate(current.getDate() + 7 * step); break;
                case 'mensal':  current.setMonth(current.getMonth() + step); break;
                case 'anual':   current.setFullYear(current.getFullYear() + step); break;
            }
        }
    }

    return occurrences.length > 0 ? occurrences : [{ dataInicio, dataFim }];
}
