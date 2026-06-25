/**
 * Returns current date/time parts in the Brasília timezone (America/Sao_Paulo).
 */
export function getBrasiliaNow() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {} as Record<string, string>);

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hours: parts.hour,
        minutes: parts.minute,
        seconds: parts.second,
    };
}
