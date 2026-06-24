/**
 * ConnectionRequestService
 * 
 * Serviço para detectar conexão offline e solicitar ao usuário que ative WiFi/dados móveis.
 * 
 * Funcionalidades:
 * - Detecta quando conexão é perdida
 * - Exibe diálogo amigável solicitando conexão
 * - Botão para abrir configurações do sistema (Android/iOS)
 * - Tenta reconectar automaticamente
 * - Notifica quando conexão é restaurada
 */

class ConnectionRequestService {
  constructor() {
    this.isDialogVisible = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectInterval = null;
    this.offlineStartTime = null;
    
    console.log('📡 ConnectionRequestService inicializado');
  }

  /**
   * Inicializa listeners de conexão
   */
  init() {
    // Escutar eventos de conexão
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Verificar estado inicial
    if (!navigator.onLine) {
      setTimeout(() => this.handleOffline(), 1000);
    }
    
    console.log('✅ ConnectionRequestService listeners configurados');
  }

  /**
   * Manipula evento quando conexão é perdida
   */
  handleOffline() {
    console.warn('📴 Conexão perdida - solicitando ao usuário');
    
    this.offlineStartTime = new Date();
    this.reconnectAttempts = 0;
    
    // Exibir diálogo após pequeno delay (evitar falsos positivos)
    setTimeout(() => {
      if (!navigator.onLine) {
        this.showConnectionDialog();
      }
    }, 2000);
  }

  /**
   * Manipula evento quando conexão é restaurada
   */
  handleOnline() {
    console.log('🌐 Conexão restaurada!');
    
    // Fechar diálogo se estiver aberto
    this.hideConnectionDialog();
    
    // Parar tentativas de reconexão
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Calcular tempo offline
    if (this.offlineStartTime) {
      const offlineDuration = Math.floor((new Date() - this.offlineStartTime) / 1000);
      console.log(`📊 Tempo offline: ${offlineDuration}s`);
      this.offlineStartTime = null;
    }
    
    // Notificar usuário
    this.showSuccessNotification();
    
    // Disparar evento customizado
    window.dispatchEvent(new CustomEvent('connection-restored'));
  }

  /**
   * Exibe diálogo solicitando conexão
   */
  showConnectionDialog() {
    if (this.isDialogVisible) return;
    
    this.isDialogVisible = true;
    
    // Criar ou atualizar diálogo
    let dialog = document.getElementById('connection-request-dialog');
    
    if (!dialog) {
      dialog = this.createDialog();
      document.body.appendChild(dialog);
    }
    
    // Mostrar diálogo
    dialog.style.display = 'flex';
    
    // Iniciar tentativas automáticas de reconexão
    this.startReconnectAttempts();
    
    console.log('📱 Diálogo de solicitação de conexão exibido');
  }

  /**
   * Esconde diálogo de conexão
   */
  hideConnectionDialog() {
    const dialog = document.getElementById('connection-request-dialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
    this.isDialogVisible = false;
  }

  /**
   * Cria elemento HTML do diálogo
   */
  createDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'connection-request-dialog';
    dialog.className = 'connection-dialog-overlay';
    
    dialog.innerHTML = `
      <div class="connection-dialog">
        <div class="connection-dialog-icon">
          📡
        </div>
        
        <div class="connection-dialog-content">
          <h2 class="connection-dialog-title">Sem Conexão com a Internet</h2>
          <p class="connection-dialog-message">
            Para continuar usando o EcoForms, você precisa estar conectado à internet.
          </p>
          
          <div class="connection-status">
            <div class="connection-status-item">
              <span class="connection-status-label">WiFi:</span>
              <span class="connection-status-value" id="wifi-status">Desconectado</span>
            </div>
            <div class="connection-status-item">
              <span class="connection-status-label">Dados Móveis:</span>
              <span class="connection-status-value" id="mobile-data-status">Desconectado</span>
            </div>
          </div>
          
          <div class="connection-dialog-tips">
            <p><strong>💡 Dicas:</strong></p>
            <ul>
              <li>Ative o WiFi e conecte-se a uma rede conhecida</li>
              <li>Ou ative os dados móveis do seu aparelho</li>
              <li>Verifique se o modo avião está desativado</li>
            </ul>
          </div>
          
          <div class="connection-reconnect-info" id="reconnect-info" style="display: none;">
            <span class="reconnect-spinner">🔄</span>
            <span id="reconnect-text">Tentando reconectar...</span>
          </div>
        </div>
        
        <div class="connection-dialog-actions">
          <button class="connection-btn connection-btn-primary" onclick="window.connectionRequest.openSettings()">
            ⚙️ Abrir Configurações
          </button>
          <button class="connection-btn connection-btn-secondary" onclick="window.connectionRequest.retryConnection()">
            🔄 Tentar Novamente
          </button>
          <button class="connection-btn connection-btn-tertiary" onclick="window.connectionRequest.continueOffline()">
            📱 Continuar Offline
          </button>
        </div>
      </div>
    `;
    
    return dialog;
  }

  /**
   * Abre configurações do sistema (WiFi/Dados Móveis)
   */
  async openSettings() {
    console.log('⚙️ Tentando abrir configurações do sistema...');
    
    try {
      // Tentar usar Capacitor (Android/iOS)
      if (window.Capacitor && window.Capacitor.Plugins) {
        const { App } = window.Capacitor.Plugins;
        
        if (App && App.openUrl) {
          // Android: Abrir configurações de WiFi
          if (window.Capacitor.getPlatform() === 'android') {
            await App.openUrl({ url: 'android.settings.WIFI_SETTINGS' });
            console.log('✅ Configurações WiFi abertas (Android)');
            return;
          }
          
          // iOS: Abrir configurações do app
          if (window.Capacitor.getPlatform() === 'ios') {
            await App.openUrl({ url: 'app-settings:' });
            console.log('✅ Configurações abertas (iOS)');
            return;
          }
        }
      }
      
      // Fallback: Instruir usuário
      this.showSettingsInstructions();
      
    } catch (error) {
      console.error('❌ Erro ao abrir configurações:', error);
      this.showSettingsInstructions();
    }
  }

  /**
   * Mostra instruções para abrir configurações manualmente
   */
  showSettingsInstructions() {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    
    let instructions = 'Abra as configurações do seu dispositivo e ative WiFi ou dados móveis.';
    
    if (isAndroid) {
      instructions = '📱 Android:\n\n' +
        '1. Abra "Configurações"\n' +
        '2. Toque em "Conexões" ou "Rede e Internet"\n' +
        '3. Ative "WiFi" ou "Dados Móveis"';
    } else if (isIOS) {
      instructions = '📱 iOS:\n\n' +
        '1. Abra "Ajustes"\n' +
        '2. Toque em "WiFi" ou "Dados Celulares"\n' +
        '3. Ative a conexão desejada';
    }
    
    alert(instructions);
  }

  /**
   * Tenta reconectar manualmente
   */
  async retryConnection() {
    console.log('🔄 Tentando reconectar...');
    
    const reconnectInfo = document.getElementById('reconnect-info');
    if (reconnectInfo) {
      reconnectInfo.style.display = 'flex';
    }
    
    // Verificar conexão
    const isConnected = await this.checkConnection();
    
    if (isConnected) {
      this.handleOnline();
    } else {
      // Mostrar feedback
      const reconnectText = document.getElementById('reconnect-text');
      if (reconnectText) {
        reconnectText.textContent = '❌ Ainda sem conexão. Tente novamente.';
      }
      
      setTimeout(() => {
        if (reconnectInfo) {
          reconnectInfo.style.display = 'none';
        }
      }, 3000);
    }
  }

  /**
   * Verifica se há conexão real (não apenas navigator.onLine)
   */
  async checkConnection() {
    try {
      // Tentar fazer request simples
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return true;
      
    } catch (error) {
      console.warn('⚠️ Sem conexão real:', error.message);
      return false;
    }
  }

  /**
   * Inicia tentativas automáticas de reconexão
   */
  startReconnectAttempts() {
    if (this.reconnectInterval) return;
    
    this.reconnectAttempts = 0;
    
    this.reconnectInterval = setInterval(async () => {
      this.reconnectAttempts++;
      
      console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      const isConnected = await this.checkConnection();
      
      if (isConnected) {
        this.handleOnline();
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        console.log('⏹️ Tentativas de reconexão esgotadas');
      }
    }, 10000); // Tentar a cada 10 segundos
  }

  /**
   * Permite continuar em modo offline
   */
  continueOffline() {
    console.log('📱 Usuário optou por continuar offline');
    
    this.hideConnectionDialog();
    
    // Notificar usuário sobre limitações
    if (window.notificationService) {
      window.notificationService.show(
        'Modo Offline: Os dados serão salvos localmente e sincronizados quando houver conexão.',
        'info',
        5000
      );
    }
    
    // Disparar evento customizado
    window.dispatchEvent(new CustomEvent('continue-offline'));
  }

  /**
   * Mostra notificação de sucesso quando reconectar
   */
  showSuccessNotification() {
    if (window.notificationService) {
      window.notificationService.show(
        '✅ Conexão restaurada! Você está online novamente.',
        'success',
        3000
      );
    }
  }

  /**
   * Obtém informações sobre tipo de conexão (se disponível)
   */
  getConnectionInfo() {
    const info = {
      online: navigator.onLine,
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: null,
      rtt: null
    };
    
    // API de Network Information (experimental)
    if ('connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        info.type = connection.type || 'unknown';
        info.effectiveType = connection.effectiveType || 'unknown';
        info.downlink = connection.downlink || null;
        info.rtt = connection.rtt || null;
      }
    }
    
    return info;
  }
}

// Instanciar e expor globalmente
if (!window.connectionRequest) {
  window.connectionRequest = new ConnectionRequestService();
  console.log('✅ ConnectionRequestService disponível globalmente');
}

// Auto-iniciar após carregamento da página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.connectionRequest.init();
  });
} else {
  window.connectionRequest.init();
}
