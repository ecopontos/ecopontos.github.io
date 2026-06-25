export interface RecorrenciaConfig {
    frequencia: 'diaria' | 'semanal' | 'mensal' | 'anual';
    intervalo: number;
    dias_semana?: number[];
    fim_recorrencia?: string;
}

export function calculateNextOccurrence(
    currentStartedAt: string,
    config: RecorrenciaConfig | null | undefined
): string | null {
    if (!config) return null;

    const current = new Date(currentStartedAt);
    let next = new Date(current);

    const { frequencia, intervalo = 1, dias_semana = [] } = config;

    switch (frequencia) {
        case 'diaria':
            next.setDate(current.getDate() + intervalo);
            break;

        case 'semanal':
            if (dias_semana.length > 0) {
                let found = false;
                for (let i = 1; i <= 7 * intervalo; i++) {
                    const check = new Date(current);
                    check.setDate(current.getDate() + i);
                    if (dias_semana.includes(check.getDay())) {
                        next = check;
                        found = true;
                        break;
                    }
                }
                if (!found) return null;
            } else {
                next.setDate(current.getDate() + 7 * intervalo);
            }
            break;

        case 'mensal':
            next.setMonth(current.getMonth() + intervalo);
            break;

        case 'anual':
            next.setFullYear(current.getFullYear() + intervalo);
            break;

        default:
            return null;
    }

    if (config.fim_recorrencia) {
        const end = new Date(config.fim_recorrencia);
        end.setHours(23, 59, 59, 999);
        if (next > end) return null;
    }

    return next.toISOString();
}

export function normalizeStatus(status?: string): string {
    if (!status) return 'submitted';
    if (status === 'pendente' || status === 'pending') return 'submitted';
    if (status === 'aprovado') return 'approved';
    if (status === 'rejeitado') return 'rejected';
    if (status === 'concluido') return 'processed';
    return status;
}
