// Solicitar permissão para notificações
function solicitarPermissaoNotificacao() {
    if ('Notification' in window) {
        Notification.requestPermission().then(function(result) {
            if (result === 'granted') {
                console.log('Permissão para notificações concedida.');
            } else {
                console.log('Permissão para notificações negada.');
            }
        });
    } else {
        console.log('Notificações não suportadas neste navegador.');
    }
}

// Mostrar uma notificação
function mostrarNotificacao(mensagem) {
    if (Notification.permission === 'granted') {
        new Notification('Lembrete de Exportação', {
            body: mensagem,
            icon: '/icon/icon.png'
        });
    } else {
        console.log('Permissão para notificações não concedida.');
    }
}

// Agendar uma notificação para um horário específico
function agendarNotificacao(horaNotificacao) {
    const agora = new Date();
    const proximaNotificacao = new Date();

    proximaNotificacao.setHours(horaNotificacao.getHours(), horaNotificacao.getMinutes(), 0, 0);

    if (agora > proximaNotificacao) {
        proximaNotificacao.setDate(proximaNotificacao.getDate() + 1);
    }

    const tempoRestante = proximaNotificacao - agora;

    setTimeout(function() {
        mostrarNotificacao('Boa noite, por favor, exporte os dados de hoje!');
        // Reagende a notificação para o próximo dia
        agendarNotificacao(new Date(proximaNotificacao.getTime() + 24 * 60 * 60 * 1000));
    }, tempoRestante);
}

// Inicializa notificações e agendamento
document.addEventListener('DOMContentLoaded', function() {
    solicitarPermissaoNotificacao();
    const horaNotificacao = new Date();
    horaNotificacao.setHours(19, 0, 0, 0);
    agendarNotificacao(horaNotificacao);
});
