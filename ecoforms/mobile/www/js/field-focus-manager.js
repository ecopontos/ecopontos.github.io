/**
 * field-focus-manager.js
 * Script para gerenciar o foco de campos de formulário para melhorar a experiência mobile
 */

document.addEventListener('DOMContentLoaded', function() {
  // Impedir que o teclado virtual abra automaticamente ao carregar a página
  if (document.activeElement && document.activeElement.tagName !== 'BODY') {
    document.activeElement.blur();
  }
  
  // Encontrar todos os formulários na página
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    // Adicionar evento de submit para focar no próximo campo vazio
    form.addEventListener('submit', function(event) {
      // Verificamos se é uma submissão parcial (ex: botão "Próximo" em formulários multi-etapa)
      const isPartialSubmit = event.submitter && event.submitter.getAttribute('data-partial') === 'true';
      
      if (isPartialSubmit) {
        event.preventDefault();
        focusNextEmptyField(form);
      }
    });
    
    // Adicionar navegação para o próximo campo ao pressionar Enter
    const inputs = form.querySelectorAll('input:not([type="submit"]), select, textarea');
    inputs.forEach(input => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && input.tagName !== 'TEXTAREA') {
          e.preventDefault();
          focusNextField(input);
        }
      });
      
      // Ao terminar de preencher um campo com máscara, avança para o próximo
      if (input.getAttribute('data-mask')) {
        input.addEventListener('input', function() {
          const mask = input.getAttribute('data-mask');
          const value = input.value.replace(/[^0-9]/g, '');
          
          // Se o campo estiver preenchido até o limite da máscara, avança para o próximo
          if (value.length === mask.replace(/[^9]/g, '').length) {
            setTimeout(() => focusNextField(input), 100);
          }
        });
      }
    });
  });
  
  // Função para focar no próximo campo
  function focusNextField(currentField) {
    const form = currentField.closest('form');
    const inputs = Array.from(form.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea'));
    const currentIndex = inputs.indexOf(currentField);
    
    if (currentIndex > -1 && currentIndex < inputs.length - 1) {
      const nextField = inputs[currentIndex + 1];
      nextField.focus();
      
      // Se o próximo campo for do tipo select, abre as opções em mobile
      if (nextField.tagName === 'SELECT' && window.innerWidth <= 768) {
        // Simula um clique para abrir a lista de opções
        nextField.click();
      }
    }
  }
  
  // Função para focar no próximo campo vazio
  function focusNextEmptyField(form) {
    const inputs = Array.from(form.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea'));
    const emptyField = inputs.find(input => !input.value.trim());
    
    if (emptyField) {
      setTimeout(() => {
        emptyField.focus();
        // Rolar a página para o campo
        emptyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
  
  // Melhorar a experiência em campos de geolocalização
  const geoButtons = document.querySelectorAll('.geolocation-button');
  geoButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Adiciona uma classe visual de "carregando"
      button.classList.add('loading');
      button.textContent = 'Obtendo localização...';
      
      // Após obter a localização, removemos a classe
      setTimeout(() => {
        button.classList.remove('loading');
        button.textContent = 'Localização obtida';
      }, 1500); // Simulação - na prática isso seria feito pelo código real de geolocalização
    });
  });
  
  // Melhoria de UX para campos de câmera (fotos)
  const cameraButtons = document.querySelectorAll('.camera-button');
  cameraButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Impedir que o foco fique no botão após tirar a foto
      setTimeout(() => {
        document.activeElement.blur();
      }, 100);
    });
  });
});
