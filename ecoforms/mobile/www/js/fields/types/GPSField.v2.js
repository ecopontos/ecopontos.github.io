/**
 * GPSField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo GPS modernizado
 * - Captura de coordenadas
 * - Visualização de localização
 * - Usa Alpine stores
 */
export default class GPSFieldV2 extends BaseField {
    /**
     * @param {FormField} config
     */
    constructor(config) {
        super(config);
    }

    /**
     * Renderiza o input do campo
     * @returns {string} HTML do campo
     */
    renderInput() {
        const fieldId = this.config.id;

        return `
      <div x-data="gpsField_${fieldId}" x-init="init()">
        <!-- Coordenadas capturadas -->
        <div x-show="hasLocation" class="gps-display bg-gray-50 border border-gray-300 rounded p-3 mb-3">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="text-sm text-gray-600 mb-1">📍 Localização capturada</div>
              <div class="font-mono text-sm">
                <span class="text-gray-700">Lat:</span> <span x-text="latitude"></span>,
                <span class="text-gray-700 ml-2">Lng:</span> <span x-text="longitude"></span>
              </div>
              <div x-show="accuracy" class="text-xs text-gray-500 mt-1">
                Precisão: <span x-text="accuracy"></span>m
              </div>
            </div>
            
            <button type="button"
                    @click="clearLocation()"
                    class="text-red-600 hover:text-red-700 text-sm">
              🗑️ Limpar
            </button>
          </div>
        </div>
        
        <!-- Botão de captura -->
        <button type="button"
                @click="captureLocation()"
                :disabled="capturing"
                class="btn-gps px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
          <span x-show="!capturing">📍 Capturar Localização</span>
          <span x-show="capturing">⏳ Capturando...</span>
        </button>
        
        <!-- Auto-capture checkbox -->
        <label class="inline-flex items-center mt-2 ml-2">
          <input type="checkbox" x-model="autoCapture" class="mr-2">
          <span class="text-sm text-gray-700">Capturar automaticamente ao carregar</span>
        </label>
        
        <!-- Error message -->
        <div x-show="error" class="text-sm text-red-500 mt-2" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
        </div>
        
        <!-- Help text -->
        <div class="text-xs text-gray-500 mt-2">
          💡 Permita o acesso à localização quando solicitado pelo navegador
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const autoCapture = field.autoCapture === true;
        const enableHighAccuracy = field.enableHighAccuracy === true; // Default true in previous version, now configurable? Or default false? Desktop defaults to false usually. FormFieldRenderer showed switch.

        return {
            latitude: null,
            longitude: null,
            accuracy: null,
            capturing: false,
            error: null,
            autoCapture: autoCapture,
            enableHighAccuracy: enableHighAccuracy,

            get hasLocation() {
                return this.latitude !== null && this.longitude !== null;
            },

            init() {
                // Carregar valor existente do store
                const formStore = Alpine.store('form');
                const currentValue = formStore.getFieldValue('${field.id}');

                if (currentValue && typeof currentValue === 'object') {
                    this.latitude = currentValue.latitude;
                    this.longitude = currentValue.longitude;
                    this.accuracy = currentValue.accuracy;
                }

                // Auto-captura se configurado
                if (this.autoCapture && !this.hasLocation) {
                    this.captureLocation();
                }

                console.log(`✅ GPSField '${field.id}' initialized`);
            },

            async captureLocation() {
                if (!navigator.geolocation) {
                    this.error = 'Geolocalização não suportada neste navegador';
                    return;
                }

                this.capturing = true;
                this.error = null;

                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: this.enableHighAccuracy,
                            timeout: 10000,
                            maximumAge: 0
                        });
                    });

                    this.latitude = position.coords.latitude.toFixed(6);
                    this.longitude = position.coords.longitude.toFixed(6);
                    this.accuracy = Math.round(position.coords.accuracy);

                    // Atualizar form store
                    const formStore = Alpine.store('form');
                    formStore.setFieldValue('${field.id}', {
                        latitude: this.latitude,
                        longitude: this.longitude,
                        accuracy: this.accuracy,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`📍 GPS captured: ${this.latitude}, ${this.longitude}`);
                } catch (err) {
                    console.error('GPS capture error:', err);

                    if (err.code === 1) {
                        this.error = 'Permissão de localização negada';
                    } else if (err.code === 2) {
                        this.error = 'Localização indisponível';
                    } else if (err.code === 3) {
                        this.error = 'Tempo esgotado ao capturar localização';
                    } else {
                        this.error = 'Erro ao capturar localização: ' + err.message;
                    }
                } finally {
                    this.capturing = false;
                }
            },

            clearLocation() {
                this.latitude = null;
                this.longitude = null;
                this.accuracy = null;

                const formStore = Alpine.store('form');
                formStore.setFieldValue('${field.id}', null);

                console.log(`🗑️ GPS location cleared`);
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.GPSFieldV2 = GPSFieldV2;
}

export { GPSFieldV2 };
