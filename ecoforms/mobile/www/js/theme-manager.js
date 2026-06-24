/**
 * Theme Manager - EcoForms
 * Gerenciador centralizado de temas e modos de visualização
 */

class ThemeManager {
  constructor() {
    this.outdoorMode = false;
    this.darkMode = false;
    this.highContrast = false;
    
    this.init();
  }
  
  init() {
    this.loadPreferences();
    this.createToggleButton();
    this.detectSystemPreferences();
    this.bindEvents();
  }
  
  loadPreferences() {
    try {
      this.outdoorMode = localStorage.getItem('outdoor-mode') === 'true';
      this.darkMode = localStorage.getItem('dark-mode') === 'true';
      this.highContrast = localStorage.getItem('high-contrast') === 'true';
      
      this.applyTheme();
    } catch (e) {
      console.warn('Não foi possível carregar preferências de tema:', e);
    }
  }
  
  savePreferences() {
    try {
      localStorage.setItem('outdoor-mode', this.outdoorMode.toString());
      localStorage.setItem('dark-mode', this.darkMode.toString());
      localStorage.setItem('high-contrast', this.highContrast.toString());
    } catch (e) {
      console.warn('Não foi possível salvar preferências de tema:', e);
    }
  }
  
  createToggleButton() {
    const toggle = document.createElement('button');
    toggle.className = 'outdoor-toggle';
    toggle.setAttribute('aria-label', 'Alternar modo outdoor');
    toggle.innerHTML = '<span class="sr-only">Modo outdoor</span>';
    
    toggle.addEventListener('click', () => {
      this.toggleOutdoorMode();
    });
    
    document.body.appendChild(toggle);
    this.toggleButton = toggle;
  }
  
  detectSystemPreferences() {
    // Detectar preferência de modo escuro
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('dark-mode')) {
      this.darkMode = true;
    }
    
    // Detectar preferência de alto contraste
    if (window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches && !localStorage.getItem('high-contrast')) {
      this.highContrast = true;
    }
    
    // Monitorar mudanças nas preferências do sistema
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('dark-mode')) {
          this.darkMode = e.matches;
          this.applyTheme();
        }
      });
      
      window.matchMedia('(prefers-contrast: more)').addEventListener('change', (e) => {
        if (!localStorage.getItem('high-contrast')) {
          this.highContrast = e.matches;
          this.applyTheme();
        }
      });
    }
  }
  
  bindEvents() {
    // Detectar condições de alta luminosidade através de eventos de visibilidade
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAmbientLight();
      }
    });
    
    // Detectar orientação da tela (pode indicar uso outdoor)
    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => {
        setTimeout(() => this.checkAmbientLight(), 500);
      });
    }
  }
  
  checkAmbientLight() {
    // Heurística simples: se a tela está muito brilhante, pode ser uso outdoor
    if (window.screen && window.screen.brightness) {
      const brightness = window.screen.brightness;
      if (brightness > 0.8 && !this.outdoorMode) {
        this.suggestOutdoorMode();
      }
    }
  }
  
  suggestOutdoorMode() {
    // Sugerir modo outdoor apenas uma vez por sessão
    if (!sessionStorage.getItem('outdoor-suggested')) {
      const suggestion = confirm('Detectamos alta luminosidade. Deseja ativar o modo outdoor para melhor visibilidade?');
      if (suggestion) {
        this.toggleOutdoorMode();
      }
      sessionStorage.setItem('outdoor-suggested', 'true');
    }
  }
  
  toggleOutdoorMode() {
    this.outdoorMode = !this.outdoorMode;
    this.applyTheme();
    this.savePreferences();
    
    // Feedback para o usuário
    const message = this.outdoorMode ? 'Modo outdoor ativado' : 'Modo outdoor desativado';
    this.showFeedback(message);
  }
  
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    this.applyTheme();
    this.savePreferences();
  }
  
  toggleHighContrast() {
    this.highContrast = !this.highContrast;
    this.applyTheme();
    this.savePreferences();
  }
  
  applyTheme() {
    const body = document.body;
    
    // Remover classes existentes
    body.classList.remove('outdoor-mode', 'dark-mode', 'high-contrast');
    
    // Aplicar classes baseadas no estado atual
    if (this.outdoorMode) {
      body.classList.add('outdoor-mode');
      this.loadOutdoorModeCSS();
    }
    
    if (this.darkMode) {
      body.classList.add('dark-mode');
    }
    
    if (this.highContrast) {
      body.classList.add('high-contrast');
    }
    
    // Atualizar botão de toggle
    if (this.toggleButton) {
      this.toggleButton.classList.toggle('active', this.outdoorMode);
    }
    
    // Emitir evento personalizado para outros componentes
    document.dispatchEvent(new CustomEvent('themeChanged', {
      detail: {
        outdoorMode: this.outdoorMode,
        darkMode: this.darkMode,
        highContrast: this.highContrast
      }
    }));
  }
  
  loadOutdoorModeCSS() {
    // Carregar CSS do modo outdoor apenas quando necessário
    if (!document.getElementById('outdoor-mode-css')) {
      const link = document.createElement('link');
      link.id = 'outdoor-mode-css';
      link.rel = 'stylesheet';
      link.href = 'css/outdoor-mode.css';
      document.head.appendChild(link);
    }
  }
  
  showFeedback(message) {
    // Criar toast de feedback temporário
    const toast = document.createElement('div');
    toast.className = 'theme-feedback';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--md-sys-color-surface-container-highest);
      color: var(--md-sys-color-on-surface);
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--md-sys-shape-corner-medium);
      box-shadow: var(--md-sys-elevation-level3);
      z-index: 10000;
      font-size: var(--md-sys-typescale-body-medium-size);
      font-weight: var(--md-sys-typescale-body-medium-weight);
      animation: fadeIn 0.3s ease-in-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-in-out';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }
  
  // API pública para outros componentes
  getThemeState() {
    return {
      outdoorMode: this.outdoorMode,
      darkMode: this.darkMode,
      highContrast: this.highContrast
    };
  }
  
  setOutdoorMode(enabled) {
    if (this.outdoorMode !== enabled) {
      this.toggleOutdoorMode();
    }
  }
  
  setDarkMode(enabled) {
    if (this.darkMode !== enabled) {
      this.toggleDarkMode();
    }
  }
  
  setHighContrast(enabled) {
    if (this.highContrast !== enabled) {
      this.toggleHighContrast();
    }
  }
}

// Inicializar o gerenciador de temas quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.themeManager = new ThemeManager();
});

// Exportar para uso em outros módulos se necessário
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}