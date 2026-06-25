// js/fields/types/GeolocationField.js
import BaseField from './BaseField.js';

export default class GeolocationField extends BaseField {
  constructor(config = {}) {
    super(config);
  }

  renderInput() {
    const id = this.config.id;
    const value = this.value || '';

    return `
      <div class="geolocation-field" x-data="{ loading: false }">
        <input type="text" id="${id}" name="${id}" x-model="formData['${id}']" class="form-input" placeholder="Latitude,Longitude" readonly />
        <button type="button" class="btn btn-secondary" @click.prevent="loading = true; $nextTick(() => { navigator.geolocation.getCurrentPosition(pos => { formData['${id}'] = pos.coords.latitude + ',' + pos.coords.longitude; loading=false }, err => { console.warn('Geolocation error', err); loading=false }) })">
          Obter localização
        </button>
      </div>
    `;
  }

  getDefaultValue() {
    return '';
  }
}

if (typeof window !== 'undefined') window.GeolocationField = GeolocationField;
