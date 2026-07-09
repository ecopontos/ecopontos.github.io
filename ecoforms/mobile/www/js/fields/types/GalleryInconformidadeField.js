// js/fields/types/GalleryInconformidadeField.js
import BaseField from './BaseField.js';
import { uuidv7 } from '/js/ecoforms-core.js';

const CameraResultType = { DataUrl: 'dataUrl' };
const CameraSource = { Camera: 'CAMERA' };

function resolveCamera() {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
    return window.Capacitor.Plugins.Camera;
  }
  return {
    getPhoto: async () => ({ dataUrl: '' }),
    pickImages: async () => ({ photos: [] }),
  };
}

function base64SizeInBytes(dataUrl) {
  const base64 = (dataUrl || '').split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * GalleryInconformidadeField - Coletor de evidências fotográficas com marcação
 * de inconformidades. Cada sessão de captura pode acumular várias fotos na
 * mesma fila (mesma marcação de inconformidades/observação), gerando uma
 * entrada por foto ao salvar.
 */
export default class GalleryInconformidadeField extends BaseField {
  constructor(config = {}) {
    super(config);

    this.maxFiles = Number(this.config.maxFiles) || 20;
    this.maxFileSizeKb = Number(this.config.maxFileSizeKb) || 5000;
    this.allowGalleryUpload = this.config.allowGalleryUpload === true;
    this.dataSourceKey = this.config.dataSource || null;

    if (!Array.isArray(this.value)) {
      this.value = [];
    }

    this.inconformidadesOptions = [];
    this.modalAberta = false;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
    this.editandoId = null;

    if (!window.fieldInstances) window.fieldInstances = {};
    window.fieldInstances[this.config.id] = this;

    this.carregarInconformidades();
  }

  async carregarInconformidades() {
    if (!this.dataSourceKey) return;
    let data = null;
    try {
      if (typeof window !== 'undefined' && window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
        data = await window.smartCache.loadDataSource(this.dataSourceKey);
      }
    } catch (e) {
      console.warn('GalleryInconformidadeField: falha ao carregar catálogo', e);
    }
    const arr = Array.isArray(data) ? data : [];
    this.inconformidadesOptions = arr
      .filter((item) => item && item.ativo !== false)
      .map((item) => ({ id: item.id, label: item.label || item.nome || item.id }));
    this.updateDOM();
  }

  // ============ Fila de captura ============

  abrirModal() {
    this.modalAberta = true;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
    this.editandoId = null;
    this.updateDOM();
  }

  fecharModal() {
    this.modalAberta = false;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
    this.editandoId = null;
    this.updateDOM();
  }

  async tirarFoto() {
    try {
      const Camera = resolveCamera();
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      if (foto && foto.dataUrl) {
        this._adicionarFotoAFila(foto.dataUrl);
        this.updateDOM();
      }
    } catch (error) {
      console.warn('GalleryInconformidadeField: câmera cancelada ou falhou', error);
    }
  }

  async escolherDaGaleria() {
    if (!this.allowGalleryUpload) return;
    try {
      const Camera = resolveCamera();
      const result = await Camera.pickImages({ quality: 80, limit: this.maxFiles });
      const photos = result && result.photos ? result.photos : [];
      for (const photo of photos) {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        this._adicionarFotoAFila(dataUrl);
      }
      this.updateDOM();
    } catch (error) {
      console.warn('GalleryInconformidadeField: seleção de galeria cancelada ou falhou', error);
    }
  }

  _adicionarFotoAFila(base64DataUrl) {
    const sizeBytes = base64SizeInBytes(base64DataUrl);
    if (sizeBytes / 1024 > this.maxFileSizeKb) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Foto excede o tamanho máximo permitido de ${this.maxFileSizeKb}KB.`);
      }
      return false;
    }
    this.filaFotos.push({ localId: uuidv7(), imagemBase64: base64DataUrl });
    return true;
  }

  removerDaFila(localId) {
    this.filaFotos = this.filaFotos.filter((f) => f.localId !== localId);
    this.updateDOM();
  }

  toggleInconformidade(id) {
    if (this.inconformidadesSelecionadas.includes(id)) {
      this.inconformidadesSelecionadas = this.inconformidadesSelecionadas.filter((i) => i !== id);
    } else {
      this.inconformidadesSelecionadas.push(id);
    }
    this.updateDOM();
  }

  setObservacao(texto) {
    this.observacaoAtual = texto;
  }

  podeAdicionarMais() {
    return this.value.length < this.maxFiles;
  }

  salvarEvidencias() {
    if (this.filaFotos.length === 0) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Adicione ao menos uma foto antes de salvar.');
      }
      return false;
    }
    const currentCount = this.editandoId
      ? this.value.length - 1
      : this.value.length;
    if (currentCount + this.filaFotos.length > this.maxFiles) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Limite de ${this.maxFiles} fotos atingido para este campo.`);
      }
      return false;
    }

    const criadoEm = new Date().toISOString();
    const inconformidades = [...this.inconformidadesSelecionadas];
    const observacao = this.observacaoAtual;

    if (this.editandoId) {
      this.value = this.value.filter((e) => e.id_foto !== this.editandoId);
    }

    this.filaFotos.forEach((foto) => {
      this.value.push({
        id_foto: uuidv7(),
        imagem: foto.imagemBase64,
        criado_em: criadoEm,
        inconformidades,
        observacao,
      });
    });

    this.isDirty = true;
    this.fecharModal();
    return true;
  }

  editarEvidencia(idFoto) {
    const index = this.value.findIndex((e) => e.id_foto === idFoto);
    if (index === -1) return;
    const entry = this.value[index];

    this.editandoId = idFoto;
    this.modalAberta = true;
    this.filaFotos = [{ localId: uuidv7(), imagemBase64: entry.imagem }];
    this.inconformidadesSelecionadas = [...(entry.inconformidades || [])];
    this.observacaoAtual = entry.observacao || '';
    this.isDirty = true;
    this.updateDOM();
  }

  removerEvidencia(idFoto) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('Remover esta evidência fotográfica?')) {
      return;
    }
    this.value = this.value.filter((e) => e.id_foto !== idFoto);
    this.isDirty = true;
    this.updateDOM();
  }

  // ============ Render ============

  render() {
    const { id } = this.config;
    return `
      <div class="space-y-3 w-full" data-field-id="${id}" data-field-type="composite_gallery_collector">
        ${this.renderHeader()}
        ${this.renderErrors()}
        ${this.renderGaleria()}
        ${this.renderBotaoAdicionar()}
        ${this.modalAberta ? this.renderModal() : ''}
      </div>
    `;
  }

  renderHeader() {
    const { label, description, required } = this.config;
    return `
      <div class="mb-2">
        <label class="block text-lg font-semibold text-gray-900 mb-1">${this.escapeHtml(label)}${required ? ' *' : ''}</label>
        ${description ? `<p class="text-sm text-gray-500">${this.escapeHtml(description)}</p>` : ''}
      </div>
    `;
  }

  renderErrors() {
    if (!this.errors || this.errors.length === 0) return '';
    return `
      <div class="bg-orange-50 border border-orange-200 rounded-md p-3 mb-2">
        ${this.errors.map((e) => `<div class="text-xs text-orange-700">• ${this.escapeHtml(e)}</div>`).join('')}
      </div>
    `;
  }

  renderGaleria() {
    if (!this.value.length) {
      return `<div class="p-4 text-center text-gray-500 bg-gray-50 rounded border border-gray-100">Nenhuma evidência registrada ainda.</div>`;
    }
    return `
      <div class="grid grid-cols-2 gap-3">
        ${this.value.map((entry) => this.renderCard(entry)).join('')}
      </div>
    `;
  }

  renderCard(entry) {
    const qtd = entry.inconformidades ? entry.inconformidades.length : 0;
    const badgeText = qtd > 0 ? `⚠️ ${qtd} inconformidade(s)` : '✅ Sem apontamento';
    const badgeClass = qtd > 0 ? 'text-red-600' : 'text-green-600';
    return `
      <div class="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm" data-foto-id="${entry.id_foto}">
        <img src="${entry.imagem}" alt="Evidência fotográfica" class="w-full h-24 object-cover" />
        <div class="p-2">
          <div class="text-xs font-semibold ${badgeClass}">${badgeText}</div>
          ${entry.observacao ? `<div class="text-xs text-gray-500 line-clamp-2 mt-1">${this.escapeHtml(entry.observacao)}</div>` : ''}
        </div>
        <div class="absolute top-2 right-2 flex gap-1">
          <button type="button" class="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'editarEvidencia', '${entry.id_foto}')" aria-label="Editar evidência">✏️</button>
          <button type="button" class="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'removerEvidencia', '${entry.id_foto}')" aria-label="Remover evidência">🗑️</button>
        </div>
      </div>
    `;
  }

  renderBotaoAdicionar() {
    const disabled = !this.podeAdicionarMais();
    return `
      <button
        type="button"
        class="w-full h-10 rounded border-2 border-dashed border-gray-300 text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'}"
        ${disabled ? 'disabled' : ''}
        onclick="${disabled ? '' : `window.galleryInconformidadeHandler('${this.config.id}', 'abrirModal')`}"
      >
        + Adicionar Registro Fotográfico (${this.value.length}/${this.maxFiles})
      </button>
    `;
  }

  renderModal() {
    return `
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onclick="if(event.target===this) window.galleryInconformidadeHandler('${this.config.id}', 'fecharModal')">
        <div class="bg-white rounded-xl w-full max-w-md mx-auto my-8 max-h-[85vh] overflow-y-auto p-6 space-y-3" onclick="event.stopPropagation()">
          <h3 class="text-base font-semibold text-gray-900">Nova Evidência Fotográfica</h3>

          ${this.renderFilaThumbnails()}

          <div class="flex gap-2">
            <button type="button" class="flex-1 h-10 rounded bg-white border border-gray-300 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'tirarFoto')">📷 Tirar Foto</button>
            ${this.allowGalleryUpload ? `<button type="button" class="flex-1 h-10 rounded bg-white border border-gray-300 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'escolherDaGaleria')">🖼️ Da Galeria</button>` : ''}
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Inconformidades Detectadas</label>
            ${this.renderInconformidadesCheckboxes()}
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Observação (opcional)</label>
            <textarea
              class="w-full min-h-[80px] p-3 text-sm border border-gray-300 rounded-md outline-none resize-y"
              placeholder="Detalhes adicionais..."
              onchange="window.galleryInconformidadeHandler('${this.config.id}', 'setObservacao', this.value)"
            >${this.escapeHtml(this.observacaoAtual || '')}</textarea>
          </div>

          <div class="flex justify-between gap-2 pt-2">
            <button type="button" class="flex-1 h-10 rounded bg-gray-100 text-gray-700 text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'fecharModal')">Cancelar</button>
            <button type="button" class="flex-1 h-10 rounded bg-green-600 text-white text-sm font-medium" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'salvarEvidencias')">Salvar (${this.filaFotos.length})</button>
          </div>
        </div>
      </div>
    `;
  }

  renderFilaThumbnails() {
    if (!this.filaFotos.length) {
      return `<div class="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">Nenhuma foto na fila. Toque em "Tirar Foto".</div>`;
    }
    return `
      <div class="flex flex-wrap gap-2">
        ${this.filaFotos.map((foto) => `
          <div class="relative w-20 h-20">
            <img src="${foto.imagemBase64}" alt="Foto pendente" class="w-full h-full object-cover rounded-lg border border-gray-200" />
            <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs" onclick="window.galleryInconformidadeHandler('${this.config.id}', 'removerDaFila', '${foto.localId}')" aria-label="Remover foto da fila">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderInconformidadesCheckboxes() {
    if (!this.inconformidadesOptions.length) {
      return `<div class="text-xs text-gray-400 italic">Nenhuma inconformidade cadastrada no catálogo.</div>`;
    }
    return `
      <div class="space-y-1 max-h-[150px] overflow-y-auto border border-gray-100 rounded p-2">
        ${this.inconformidadesOptions.map((opt) => `
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              ${this.inconformidadesSelecionadas.includes(opt.id) ? 'checked' : ''}
              onchange="window.galleryInconformidadeHandler('${this.config.id}', 'toggleInconformidade', '${opt.id}')"
            />
            ${this.escapeHtml(opt.label)}
          </label>
        `).join('')}
      </div>
    `;
  }

  updateDOM() {
    if (typeof document === 'undefined' || typeof this.render !== 'function') return;
    const container = document.querySelector(`[data-field-id="${this.config.id}"]`);
    if (container) {
      container.outerHTML = this.render();
    }
  }
}

// ============================================
// HANDLER GLOBAL
// ============================================

window.galleryInconformidadeHandler = function (fieldId, action, ...args) {
  const field = window.fieldInstances ? window.fieldInstances[fieldId] : null;
  if (!field) {
    console.error(`GalleryInconformidadeField não encontrado: ${fieldId}`);
    return;
  }

  switch (action) {
    case 'abrirModal': field.abrirModal(); break;
    case 'fecharModal': field.fecharModal(); break;
    case 'tirarFoto': field.tirarFoto(); break;
    case 'escolherDaGaleria': field.escolherDaGaleria(); break;
    case 'removerDaFila': field.removerDaFila(args[0]); break;
    case 'toggleInconformidade': field.toggleInconformidade(args[0]); break;
    case 'setObservacao': field.setObservacao(args[0]); break;
    case 'salvarEvidencias': field.salvarEvidencias(); break;
    case 'editarEvidencia': field.editarEvidencia(args[0]); break;
    case 'removerEvidencia': field.removerEvidencia(args[0]); break;
    default: console.warn(`GalleryInconformidadeField: ação desconhecida ${action}`);
  }
};
