class DateUtils {
    combineDateTime(data, hora) {
        if (!data || !hora) return new Date().toISOString();
        try {
            const [ano, mes, dia] = data.split('-');
            const [horas, minutos] = hora.split(':');
            return new Date(ano, mes - 1, dia, horas, minutos).toISOString();
        } catch (error) {
            return new Date().toISOString();
        }
    }
}

const dateUtils = new DateUtils();
if (typeof window !== 'undefined') {
    window.DateUtils = DateUtils;
    window.dateUtils = dateUtils;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DateUtils, dateUtils };
}
