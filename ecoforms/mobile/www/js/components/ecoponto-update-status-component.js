/**
 * Componente Alpine.js para exibir status de atualização de ecopontos
 * 
 * Uso:
 * <div x-data="ecopontoUpdateStatusComponent()"></div>
 */

function ecopontoUpdateStatusComponent() {
  return {
    // Estado
    visible: false,
    minimized: true,
    statusSummary: null,
    ecopontosOverdue: [],
    refreshInterval: null,

    // Inicialização
    init() {
      console.log('🔔 Inicializando componente de status de atualização');

      // Aguardar serviço estar disponível
      this.waitForService().then(() => {
        this.refreshStatus();
        this.startAutoRefresh();
        this.setupEventListeners();
      });
    },

    // Aguardar serviço estar disponível
    async waitForService() {
      let attempts = 0;
      const maxAttempts = 20;

      while (!window.ecopontoUpdateReminder && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!window.ecopontoUpdateReminder) {
        console.error('❌ EcopontoUpdateReminderService não disponível após espera');
        return;
      }

      console.log('✅ EcopontoUpdateReminderService disponível');
    },

    // Atualizar status
    refreshStatus() {
      if (!window.ecopontoUpdateReminder) return;

      try {
        this.statusSummary = window.ecopontoUpdateReminder.getStatusSummary();
        this.ecopontosOverdue = this.statusSummary.overdue || [];

        console.log('📊 Status atualizado:', this.statusSummary);

        // Auto-mostrar se houver ecopontos atrasados e ainda estiver minimizado
        if (this.ecopontosOverdue.length > 0 && this.minimized && !this.visible) {
          this.minimized = true;
          this.visible = true;
        }
      } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
      }
    },

    // Iniciar atualização automática
    startAutoRefresh() {
      // Atualizar a cada 5 minutos
      this.refreshInterval = setInterval(() => {
        this.refreshStatus();
      }, 5 * 60 * 1000);

      console.log('🔄 Auto-refresh iniciado (5 minutos)');
    },

    // Parar atualização automática
    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
        console.log('⏹️ Auto-refresh parado');
      }
    },

    // Configurar listeners de eventos
    setupEventListeners() {
      // Escutar evento customizado de atualização de ecoponto
      window.addEventListener('ecoponto-updated', (event) => {
        console.log('📡 Evento de atualização recebido:', event.detail);
        this.refreshStatus();
      });

      // Cleanup ao desmontar
      this.$watch('$root', (value) => {
        if (!value) {
          this.stopAutoRefresh();
        }
      });
    },

    // Obter classe CSS baseada no status
    getStatusClass() {
      if (!this.statusSummary) return '';

      if (this.statusSummary.needsUpdate > 0) {
        // Verificar se algum está muito atrasado (mais de 6h)
        const veryOverdue = this.ecopontosOverdue.some(e => e.hoursOverdue > 6);
        return veryOverdue ? 'danger' : 'warning';
      }

      return '';
    },

    // Mostrar/esconder painel
    togglePanel() {
      if (this.minimized) {
        this.minimized = false;
        this.visible = true;
      } else {
        this.minimized = true;
      }
    },

    // Fechar completamente
    close() {
      this.visible = false;
      this.minimized = true;
    },

    // Abrir formulário de atualização para ecoponto específico
    updateEcoponto(ecopontoId) {
      console.log(`📝 Abrindo formulário para atualização do ecoponto: ${ecopontoId}`);

      // Redirecionar para formulário de caixas com ecoponto pré-selecionado
      const formUrl = `index.html?form=ecopontoCaixasForm.json&ecoponto=${ecopontoId}`;
      window.location.href = formUrl;
    },

    // Ver detalhes de todos os ecopontos
    viewAllDetails() {
      console.log('📊 Abrindo visão detalhada de todos os ecopontos');
      this.minimized = false;
      this.visible = true;
    },

    // Formatar tempo para exibição amigável
    formatTimeInfo(ecoponto) {
      if (!ecoponto || !ecoponto.hoursOverdue) return '';

      const hours = ecoponto.hoursOverdue;
      const minutes = ecoponto.minutes || 0;

      if (hours >= 1) {
        return `${hours}h ${minutes}min atrasado`;
      }

      return `${minutes}min atrasado`;
    },

    // Obter ícone de status
    getStatusIcon() {
      if (!this.statusSummary) return '🔔';

      if (this.statusSummary.needsUpdate > 0) {
        const veryOverdue = this.ecopontosOverdue.some(e => e.hoursOverdue > 72);
        return veryOverdue ? '🚨' : '⚠️';
      }

      return '✅';
    },

    // Obter contagem para badge
    getOverdueCount() {
      return this.statusSummary?.needsUpdate || 0;
    },

    // Verificar se tem atualizações pendentes
    hasUpdates() {
      return this.statusSummary && this.statusSummary.needsUpdate > 0;
    },

    // Obter detalhes de um ecoponto específico
    getEcopontoDetails(ecopontoId) {
      if (!this.statusSummary || !this.statusSummary.details) return null;
      return this.statusSummary.details[ecopontoId];
    },

    // Formatar última atualização
    formatLastUpdate(isoString) {
      try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const remainingMinutes = diffMinutes % 60;

        if (diffHours < 1) {
          return `há ${diffMinutes} minutos`;
        }

        if (diffHours < 24) {
          return `há ${diffHours}h ${remainingMinutes}min`;
        }

        const diffDays = Math.floor(diffHours / 24);
        const remainingHoursInDay = diffHours % 24;
        return `há ${diffDays} dia${diffDays > 1 ? 's' : ''} e ${remainingHoursInDay}h`;
      } catch (error) {
        return isoString;
      }
    },

    // Obter nome amigável do ecoponto
    getEcopontoName(ecopontoId) {
      // Tentar buscar do selectorData se disponível
      if (window.formData && window.selectorData && window.selectorData.ecoponto) {
        const ecoponto = window.selectorData.ecoponto.find(e => e.value === ecopontoId || e.id === ecopontoId);
        if (ecoponto) return ecoponto.label || ecoponto.nome || ecopontoId;
      }

      return ecopontoId;
    }
  };
}

// Expor globalmente IMEDIATAMENTE para uso em templates
// Isso deve acontecer ANTES de qualquer tentativa de registro com Alpine
if (typeof window !== 'undefined') {
  window.ecopontoUpdateStatusComponent = ecopontoUpdateStatusComponent;
  console.log('✅ ecopontoUpdateStatusComponent exposto globalmente');
}

// Registrar com Alpine.data() quando Alpine estiver disponível
// Isso garante que o componente esteja registrado antes do Alpine processar x-data
if (typeof Alpine !== 'undefined') {
  Alpine.data('ecopontoUpdateStatusComponent', ecopontoUpdateStatusComponent);
  console.log('✅ ecopontoUpdateStatusComponent registrado com Alpine (síncrono)');
} else {
  document.addEventListener('alpine:init', () => {
    if (typeof Alpine !== 'undefined') {
      Alpine.data('ecopontoUpdateStatusComponent', ecopontoUpdateStatusComponent);
      console.log('✅ ecopontoUpdateStatusComponent registrado com Alpine (alpine:init)');
    }
  });
}
