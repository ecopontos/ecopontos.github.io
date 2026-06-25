/**
 * outdoor-mode.js
 * Script para alternar o modo de alta visibilidade para uso em campo sob luz solar
 */

document.addEventListener('DOMContentLoaded', function() {
  // Cria o botão de alternância
  const toggleButton = document.createElement('div');
  toggleButton.className = 'outdoor-mode-toggle';
  document.body.appendChild(toggleButton);
  
  // Verifica se há uma preferência salva
  const isOutdoorMode = localStorage.getItem('outdoorMode') === 'true';
  if (isOutdoorMode) {
    document.body.classList.add('outdoor-mode');
  }
  
  // Adiciona evento de clique ao botão
  toggleButton.addEventListener('click', function() {
    document.body.classList.toggle('outdoor-mode');
    // Salva a preferência
    localStorage.setItem('outdoorMode', document.body.classList.contains('outdoor-mode'));
  });
  
  // Detecta automaticamente alta luminosidade (se suportado pelo navegador)
  if ('AmbientLightSensor' in window) {
    try {
      const sensor = new AmbientLightSensor();
      sensor.onreading = () => {
        // Se a luz ambiente for muito alta (lux > 10000), ativa o modo outdoor automaticamente
        if (sensor.illuminance > 10000 && !document.body.classList.contains('outdoor-mode')) {
          document.body.classList.add('outdoor-mode');
          localStorage.setItem('outdoorMode', 'true');
        }
      };
      sensor.start();
    } catch (e) {
      console.log('AmbientLightSensor não está disponível:', e);
    }
  }
});