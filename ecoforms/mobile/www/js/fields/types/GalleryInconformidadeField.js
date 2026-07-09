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
    this.updateDOM();
  }

  fecharModal() {
    this.modalAberta = false;
    this.filaFotos = [];
    this.inconformidadesSelecionadas = [];
    this.observacaoAtual = '';
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
    if (this.value.length + this.filaFotos.length > this.maxFiles) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Limite de ${this.maxFiles} fotos atingido para este campo.`);
      }
      return false;
    }

    const criadoEm = new Date().toISOString();
    const inconformidades = [...this.inconformidadesSelecionadas];
    const observacao = this.observacaoAtual;

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
    this.value.splice(index, 1);

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

  updateDOM() {
    if (typeof document === 'undefined' || typeof this.render !== 'function') return;
    const container = document.querySelector(`[data-field-id="${this.config.id}"]`);
    if (container) {
      container.outerHTML = this.render();
    }
  }
}
