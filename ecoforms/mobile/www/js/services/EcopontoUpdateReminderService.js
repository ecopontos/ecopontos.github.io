/**
 * EcopontoUpdateReminderService
 * 
 * Serviço para monitorar atualizações de caixas de ecopontos e notificar
 * operadores quando o tempo desde a última atualização exceder um limite.
 * 
 * Funcionalidades:
 * - Monitora última atualização de cada ecoponto
 * - Calcula tempo decorrido desde última atualização
 * - Exibe notificações quando limite for atingido
 * - Persiste estado de notificações para evitar repetições
 * - Suporta configuração de intervalo personalizado por ecoponto
 */

class EcopontoUpdateReminderService {
  constructor() {
    this.storageKey = 'ecoforms_ecoponto_update_reminders';
    this.notificationStateKey = 'ecoforms_notification_state';
    this.defaultIntervalHours = 2; // 2 horas padrão
    this.checkIntervalMinutes = 15; // Verificar a cada 15 minutos
    this.checkTimerInterval = null;
    this.reminderState = this.loadReminderState();
    this.notificationState = this.loadNotificationState();
    this.enabled = true;
    
    console.log('🔔 EcopontoUpdateReminderService inicializado');
  }

  /**
   * Carrega estado de lembretes do localStorage
   */
  loadReminderState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Erro ao carregar estado de lembretes:', error);
      return {};
    }
  }

  /**
   * Salva estado de lembretes no localStorage
   */
  saveReminderState() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.reminderState));
      console.log('💾 Estado de lembretes salvo');
    } catch (error) {
      console.error('❌ Erro ao salvar estado de lembretes:', error);
    }
  }

  /**
   * Carrega estado de notificações (para evitar repetições)
   */
  loadNotificationState() {
    try {
      const stored = localStorage.getItem(this.notificationStateKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Erro ao carregar estado de notificações:', error);
      return {};
    }
  }

  /**
   * Salva estado de notificações
   */
  saveNotificationState() {
    try {
      localStorage.setItem(this.notificationStateKey, JSON.stringify(this.notificationState));
    } catch (error) {
      console.error('❌ Erro ao salvar estado de notificações:', error);
    }
  }

  /**
   * Registra atualização de um ecoponto
   * @param {string} ecopontoId - ID do ecoponto
   * @param {number} intervalHours - Intervalo customizado em horas (opcional)
   */
  registerUpdate(ecopontoId, intervalHours = null) {
    const now = new Date().toISOString();
    
    this.reminderState[ecopontoId] = {
      lastUpdate: now,
      intervalHours: intervalHours || this.defaultIntervalHours,
      notified: false
    };
    
    // Limpar estado de notificação quando houver atualização
    if (this.notificationState[ecopontoId]) {
      delete this.notificationState[ecopontoId];
      this.saveNotificationState();
    }
    
    this.saveReminderState();
    console.log(`✅ Atualização registrada para ecoponto ${ecopontoId} às ${now}`);
  }

  /**
   * Obtém informações de atualização de um ecoponto
   * @param {string} ecopontoId - ID do ecoponto
   * @returns {object|null} Informações de atualização ou null
   */
  getUpdateInfo(ecopontoId) {
    return this.reminderState[ecopontoId] || null;
  }

  /**
   * Calcula tempo decorrido desde última atualização
   * @param {string} ecopontoId - ID do ecoponto
   * @returns {object} { hours, minutes, needsUpdate, overdue }
   */
  getTimeSinceUpdate(ecopontoId) {
    const updateInfo = this.getUpdateInfo(ecopontoId);
    
    if (!updateInfo || !updateInfo.lastUpdate) {
      return {
        hours: null,
        minutes: null,
        needsUpdate: true,
        overdue: true,
        message: 'Nenhuma atualização registrada'
      };
    }

    const lastUpdate = new Date(updateInfo.lastUpdate);
    const now = new Date();
    const diffMs = now - lastUpdate;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    const intervalHours = updateInfo.intervalHours || this.defaultIntervalHours;
    const needsUpdate = diffHours >= intervalHours;
    const hoursOverdue = needsUpdate ? diffHours - intervalHours : 0;

    return {
      hours: diffHours,
      minutes: remainingMinutes,
      needsUpdate,
      overdue: needsUpdate,
      hoursOverdue,
      intervalHours,
      lastUpdate: updateInfo.lastUpdate,
      message: this.formatTimeSinceUpdate(diffHours, remainingMinutes, needsUpdate, hoursOverdue)
    };
  }

  /**
   * Formata mensagem de tempo decorrido
   */
  formatTimeSinceUpdate(hours, minutes, needsUpdate, hoursOverdue) {
    if (needsUpdate) {
      if (hoursOverdue >= 1) {
        return `⚠️ Atrasado ${hoursOverdue}h ${minutes}min`;
      }
      return `⚠️ Atrasado ${minutes}min`;
    }
    
    if (hours === 0) {
      return `✅ Atualizado há ${minutes} minutos`;
    }
    
    return `✅ Atualizado há ${hours}h ${minutes}min`;
  }

  /**
   * Verifica todos os ecopontos e notifica se necessário
   * @returns {Array} Lista de ecopontos que precisam de atualização
   */
  async checkAllEcopontos() {
    if (!this.enabled) {
      console.log('🔕 Serviço de lembretes desabilitado');
      return [];
    }

    const ecopontosNeedingUpdate = [];
    const now = new Date();

    for (const [ecopontoId, updateInfo] of Object.entries(this.reminderState)) {
      const timeInfo = this.getTimeSinceUpdate(ecopontoId);
      
      if (timeInfo.needsUpdate) {
        ecopontosNeedingUpdate.push({
          ecopontoId,
          ...timeInfo
        });

        // Verificar se já notificou recentemente (evitar spam)
        const notificationKey = `${ecopontoId}_${now.toISOString().split('T')[0]}`;
        if (!this.notificationState[notificationKey]) {
          await this.notifyUpdateNeeded(ecopontoId, timeInfo);
          this.notificationState[notificationKey] = {
            notifiedAt: now.toISOString(),
            hoursOverdue: timeInfo.hoursOverdue
          };
          this.saveNotificationState();
        }
      }
    }

    if (ecopontosNeedingUpdate.length > 0) {
      console.log(`⚠️ ${ecopontosNeedingUpdate.length} ecoponto(s) precisam de atualização:`, ecopontosNeedingUpdate);
    }

    return ecopontosNeedingUpdate;
  }

  /**
   * Exibe notificação para atualização necessária
   */
  async notifyUpdateNeeded(ecopontoId, timeInfo) {
    const title = `🔔 Atualização de Ecoponto Necessária`;
    const hoursOverdue = timeInfo.hoursOverdue || 0;
    const minutesOverdue = timeInfo.minutes || 0;
    
    let overdueText = '';
    if (hoursOverdue >= 1) {
      overdueText = `${hoursOverdue}h ${minutesOverdue}min`;
    } else {
      overdueText = `${minutesOverdue} minutos`;
    }
    
    const message = `O ecoponto ${ecopontoId} está ${overdueText} atrasado.\n\nÚltima atualização: ${this.formatDate(timeInfo.lastUpdate)}`;

    console.log(`📢 NOTIFICAÇÃO:`, { ecopontoId, timeInfo });

    // Tentar usar NotificationService se disponível
    if (window.notificationService) {
      try {
        window.notificationService.show(message, 'warning', 10000);
      } catch (error) {
        console.error('❌ Erro ao exibir notificação via NotificationService:', error);
      }
    }

    // Tentar usar Web Notifications API
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: `ecoponto-update-${ecopontoId}`,
          requireInteraction: true
        });
      } catch (error) {
        console.error('❌ Erro ao exibir Web Notification:', error);
      }
    }

    // Fallback: console log destacado
    console.warn(`%c${title}\n${message}`, 'font-size: 16px; color: orange; font-weight: bold;');
  }

  /**
   * Formata data para exibição
   */
  formatDate(isoString) {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return isoString;
    }
  }

  /**
   * Inicia monitoramento automático
   */
  startMonitoring() {
    if (this.checkTimerInterval) {
      console.log('⚠️ Monitoramento já está ativo');
      return;
    }

    console.log(`🔄 Iniciando monitoramento automático (verificação a cada ${this.checkIntervalMinutes} minutos)`);
    
    // Verificação imediata
    this.checkAllEcopontos();

    // Verificações periódicas
    this.checkTimerInterval = setInterval(() => {
      this.checkAllEcopontos();
    }, this.checkIntervalMinutes * 60 * 1000);

    // Configurar listeners de eventos
    this.setupEventListeners();

    this.enabled = true;
  }

  /**
   * Configura listeners para detectar atualizações via eventos
   * Substitui a integração direta/polling com EcopontoCaixasSync
   */
  setupEventListeners() {
    // Escutar evento disparado pelo OccupationField.js
    window.addEventListener('ecoponto-caixas:change', (event) => {
      this.handleEcopontoChange(event);
    });

    // Escutar outros eventos de atualização se necessário (ex: form-submit que contenha dados de ecoponto)
    // window.addEventListener('form-submission-success', ...);
    
    console.log('📡 Listeners de atualização de ecoponto configurados');
  }

  /**
   * Processa evento de mudança em caixa de ecoponto
   */
  handleEcopontoChange(event) {
    try {
      if (!event || !event.detail) return;

      const { ecopontoValue, ecopontoId } = event.detail;
      // Usar ecopontoValue ou ecopontoId conforme disponível no evento
      const id = ecopontoValue || ecopontoId;

      if (id) {
        // Registrar atualização silenciosa (sem log excessivo se for frequente)
        this.registerUpdate(id);
      }
    } catch (error) {
      console.warn('Erro ao processar evento de atualização de ecoponto:', error);
    }
  }

  /**
   * Para monitoramento automático
   */
  stopMonitoring() {
    if (this.checkTimerInterval) {
      clearInterval(this.checkTimerInterval);
      this.checkTimerInterval = null;
      console.log('⏹️ Monitoramento automático parado');
    }
    this.enabled = false;
  }

  /**
   * Solicita permissão para Web Notifications
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Web Notifications não suportadas neste navegador');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('✅ Permissão para notificações já concedida');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('⚠️ Permissão para notificações negada pelo usuário');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permissão para notificações concedida');
        return true;
      } else {
        console.warn('⚠️ Permissão para notificações negada');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao solicitar permissão para notificações:', error);
      return false;
    }
  }

  /**
   * Obtém resumo do status de todos os ecopontos
   */
  getStatusSummary() {
    const summary = {
      total: 0,
      upToDate: 0,
      needsUpdate: 0,
      overdue: [],
      details: {}
    };

    for (const ecopontoId of Object.keys(this.reminderState)) {
      summary.total++;
      const timeInfo = this.getTimeSinceUpdate(ecopontoId);
      summary.details[ecopontoId] = timeInfo;

      if (timeInfo.needsUpdate) {
        summary.needsUpdate++;
        summary.overdue.push({
          ecopontoId,
          hoursOverdue: timeInfo.hoursOverdue,
          message: timeInfo.message
        });
      } else {
        summary.upToDate++;
      }
    }

    return summary;
  }

  /**
   * Limpa histórico de notificações antigas (mais de 7 dias)
   */
  cleanupOldNotifications() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [key, value] of Object.entries(this.notificationState)) {
      const notifiedAt = new Date(value.notifiedAt);
      if (notifiedAt < sevenDaysAgo) {
        delete this.notificationState[key];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveNotificationState();
      console.log(`🧹 Limpeza: ${cleaned} notificação(ões) antiga(s) removida(s)`);
    }
  }
}

// Instanciar e expor globalmente
if (!window.ecopontoUpdateReminder) {
  window.ecopontoUpdateReminder = new EcopontoUpdateReminderService();
  console.log('✅ EcopontoUpdateReminderService disponível globalmente');
}

// Auto-iniciar monitoramento após carregamento da página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ecopontoUpdateReminder.requestNotificationPermission();
    window.ecopontoUpdateReminder.startMonitoring();
  });
} else {
  window.ecopontoUpdateReminder.requestNotificationPermission();
  window.ecopontoUpdateReminder.startMonitoring();
}
