/**
 * Serviço de Notificações para EcoForms
 * Gerencia notificações de atualizações, mudanças e eventos do sistema
 */
class NotificationService {
    constructor() {
        this.notifications = [];
        this.subscribers = [];
        this.maxNotifications = 50;
        this.permissionGranted = false;
        this.init();
    }

    init() {
        // Verificar permissão para notificações do navegador
        if ('Notification' in window) {
            this.permissionGranted = Notification.permission === 'granted';
            
            // Não solicitar permissão automaticamente na inicialização
            // A permissão será solicitada apenas em resposta a uma ação do usuário
        }

        // Carregar notificações do localStorage
        this.loadNotifications();
        
        console.log('[NotificationService] Inicializado');
    }

    // Solicitar permissão para notificações
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[NotificationService] Notificações não suportadas');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';
            return this.permissionGranted;
        } catch (error) {
            console.error('[NotificationService] Erro ao solicitar permissão:', error);
            return false;
        }
    }

    // Criar notificação
    createNotification(options) {
        const notification = {
            id: this.generateId(),
            title: options.title || 'EcoForms',
            message: options.message || '',
            type: options.type || 'info', // info, success, warning, error, update
            timestamp: new Date().toISOString(),
            read: false,
            persistent: options.persistent || false,
            actions: options.actions || [],
            data: options.data || {}
        };

        // Adicionar à lista
        this.notifications.unshift(notification);
        
        // Limitar número de notificações
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // Salvar no localStorage
        this.saveNotifications();

        // Mostrar notificação do navegador se permitido
        if (this.permissionGranted && options.showBrowserNotification !== false) {
            this.showBrowserNotification(notification);
        }

        // Notificar assinantes
        this.notifySubscribers('new', notification);

        console.log('[NotificationService] Notificação criada:', notification);
        return notification;
    }

    // Mostrar notificação do navegador
    showBrowserNotification(notification) {
        try {
            const browserNotification = new Notification(notification.title, {
                body: notification.message,
                icon: '/img/ecoforms-icon.png', // Adicionar ícone se disponível
                tag: notification.type,
                requireInteraction: notification.persistent
            });

            browserNotification.onclick = () => {
                this.markAsRead(notification.id);
                window.focus();
                browserNotification.close();
            };

            // Auto-fechar após 5 segundos se não for persistente
            if (!notification.persistent) {
                setTimeout(() => {
                    browserNotification.close();
                }, 5000);
            }

        } catch (error) {
            console.error('[NotificationService] Erro ao mostrar notificação do navegador:', error);
        }
    }

    // Notificações específicas do sistema
    notifyFormUpdated(formId, formName, version) {
        return this.createNotification({
            title: 'Formulário Atualizado',
            message: `O formulário "${formName}" foi atualizado para a versão ${version}`,
            type: 'update',
            data: { formId, formName, version, action: 'form_updated' }
        });
    }

    notifyDataUpdated(dataType, dataName) {
        return this.createNotification({
            title: 'Dados Atualizados',
            message: `Os dados "${dataName}" foram atualizados`,
            type: 'update',
            data: { dataType, dataName, action: 'data_updated' }
        });
    }

    notifySyncStarted() {
        return this.createNotification({
            title: 'Sincronização Iniciada',
            message: 'A sincronização de dados foi iniciada',
            type: 'info',
            data: { action: 'sync_started' }
        });
    }

    notifySyncCompleted(success, details = {}) {
        const message = success 
            ? `Sincronização concluída com sucesso. ${details.formsUpdated || 0} formulários e ${details.dataUpdated || 0} dados atualizados.`
            : 'A sincronização falhou. Verifique a conexão e tente novamente.';

        return this.createNotification({
            title: success ? 'Sincronização Concluída' : 'Sincronização Falhou',
            message: message,
            type: success ? 'success' : 'error',
            data: { action: 'sync_completed', success, ...details }
        });
    }

    notifyOfflineMode() {
        return this.createNotification({
            title: 'Modo Offline',
            message: 'Você está em modo offline. Algumas funcionalidades podem estar limitadas.',
            type: 'warning',
            persistent: true,
            data: { action: 'offline_mode' }
        });
    }

    notifyOnlineMode() {
        return this.createNotification({
            title: 'Modo Online',
            message: 'Conexão restaurada. Sistema sincronizado com o servidor.',
            type: 'success',
            data: { action: 'online_mode' }
        });
    }

    notifyNewFormAvailable(formId, formName) {
        return this.createNotification({
            title: 'Novo Formulário Disponível',
            message: `Um novo formulário "${formName}" está disponível para download.`,
            type: 'info',
            actions: [
                { text: 'Baixar', action: 'download_form', formId }
            ],
            data: { formId, formName, action: 'new_form_available' }
        });
    }

    // Gerenciamento de notificações
    getNotifications(filter = {}) {
        let filtered = [...this.notifications];

        if (filter.type) {
            filtered = filtered.filter(n => n.type === filter.type);
        }

        if (filter.unread) {
            filtered = filtered.filter(n => !n.read);
        }

        if (filter.read) {
            filtered = filtered.filter(n => n.read);
        }

        if (filter.since) {
            filtered = filtered.filter(n => new Date(n.timestamp) >= new Date(filter.since));
        }

        return filtered;
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.saveNotifications();
            this.notifySubscribers('read', notification);
            return true;
        }
        return false;
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.notifySubscribers('all_read', null);
    }

    deleteNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            const deleted = this.notifications.splice(index, 1)[0];
            this.saveNotifications();
            this.notifySubscribers('deleted', deleted);
            return true;
        }
        return false;
    }

    clearAll() {
        this.notifications = [];
        this.saveNotifications();
        this.notifySubscribers('cleared', null);
    }

    // Sistema de assinantes
    subscribe(callback) {
        const id = this.generateId();
        this.subscribers.push({ id, callback });
        return id;
    }

    unsubscribe(subscriberId) {
        this.subscribers = this.subscribers.filter(s => s.id !== subscriberId);
    }

    notifySubscribers(event, data) {
        this.subscribers.forEach(subscriber => {
            try {
                subscriber.callback(event, data);
            } catch (error) {
                console.error('[NotificationService] Erro ao notificar assinante:', error);
            }
        });
    }

    // Persistência
    saveNotifications() {
        try {
            localStorage.setItem('ecoforms_notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('[NotificationService] Erro ao salvar notificações:', error);
        }
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('ecoforms_notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
            }
        } catch (error) {
            console.error('[NotificationService] Erro ao carregar notificações:', error);
            this.notifications = [];
        }
    }

    // Utilitários
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getStats() {
        const total = this.notifications.length;
        const unread = this.notifications.filter(n => !n.read).length;
        const byType = {};
        
        this.notifications.forEach(n => {
            byType[n.type] = (byType[n.type] || 0) + 1;
        });

        return {
            total,
            unread,
            byType,
            permissionGranted: this.permissionGranted
        };
    }
}

// Instância global
window.notificationService = new NotificationService();