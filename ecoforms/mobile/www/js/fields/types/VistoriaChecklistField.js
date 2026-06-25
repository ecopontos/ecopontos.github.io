// js/fields/types/VistoriaChecklistField.js
import BaseField from './BaseField.js';

/**
 * VistoriaChecklistField - Campo moderno de checklist para vistorias (Mobile Aligned)
 * Alinhado com desktop/components/runtime/fields/VistoriaChecklistRenderer.tsx
 *
 * Recursos:
 * - Categorias expansíveis
 * - Status: Conforme / Não Conforme (nao_conforme)
 * - Observações e Fotos para NC
 * - Resumo estatístico
 * - Integração com DataStore e window.rawDataSources
 */
export default class VistoriaChecklistField extends BaseField {
  constructor(config = {}) {
    super(config);

    // Configurações do checklist
    this.dataSourceName = config.dataSource || null;
    this.categorias = config.categorias || [];

    // Tentar carregar dados
    this.resolveDataSource(config);

    this.mostrarResumo = config.mostrarResumo !== false;
    this.permitirFotos = config.permitirFotos !== false;
    this.obrigatorioObservacaoNC = config.obrigatorioObservacaoNC !== false;
    this.obrigatorioFotoNC = config.obrigatorioFotoNC !== false;
    this.maxFotos = config.maxFotos || 5;

    // Estado das categorias (expandido/recolhido)
    this.estadoCategorias = {};
    if (this.categorias) {
      this.categorias.forEach(cat => {
        this.estadoCategorias[cat.id] = false; // Todas recolhidas inicialmente
      });
    }

    // Estrutura de dados: { "item-id": { status, obs, fotos: [] }, ... }
    // Normalizar value se vier no formato antigo ou novo
    if (!this.value || typeof this.value !== 'object') {
      this.value = {};
    } else if (this.value.items) {
      // Se vier no formato completo { items: ... }, usar .items
      this.value = this.value.items;
    }

    // Auto-registro para handlers globais
    if (!window.fieldInstances) window.fieldInstances = {};
    window.fieldInstances[this.config.id] = this;

    console.log(`✅ VistoriaChecklistField: ${this.config.id} inicializado`);
    if (config.rawData) {
      console.log(`📊 VistoriaChecklistField: rawData received with keys:`, Object.keys(config.rawData));
    } else {
      console.warn(`⚠️ VistoriaChecklistField: No rawData received in config`);
    }
  }

  /**
   * Resolve data source logic
   * Priority: 
   * 1. Direct config 'categorias' array
   * 2. Alpine Store ('data')
   * 3. Legacy global window.rawDataSources
   */
  resolveDataSource(config) {
    // 1. Array direto na config
    if (Array.isArray(config.categorias) && config.categorias.length) {
      this.categorias = config.categorias;
      return;
    }

    // 1.1 Check for rawData injected by index.html/FieldFactory (Preloaded Data)
    if (config.rawData) {
      if (config.rawData.categorias && Array.isArray(config.rawData.categorias)) {
        this.categorias = config.rawData.categorias;
        return;
      } else if (Array.isArray(config.rawData)) {
        this.categorias = config.rawData;
        return;
      }
    }

    // Se não tiver dataSource string, não tem o que buscar
    if (typeof config.dataSource !== 'string') return;

    const dsKey = config.dataSource.replace(/\.json$/i, '');

    // 2. Alpine Store (Novo Padrão)
    if (window.Alpine && window.Alpine.store('data')) {
      const store = window.Alpine.store('data');
      const data = store.getData(dsKey); // Pega normalizado
      if (data) {
        // Adaptar estrutura se necessário (visto que o store pode retornar array ou objeto)
        if (data.categorias && Array.isArray(data.categorias)) {
          this.categorias = data.categorias;
        } else if (Array.isArray(data) && data.length) {
          // Assume que já é array de categorias
          this.categorias = data;
        } else if (data[0] && data[0].categorias) {
          this.categorias = data[0].categorias;
        }
        if (this.categorias && this.categorias.length) return;
      }
    }

    // 3. Fallback Legacy window.rawDataSources
    if (typeof window !== 'undefined' && window.rawDataSources && window.rawDataSources[dsKey]) {
      const data = window.rawDataSources[dsKey];
      if (data && typeof data === 'object' && data.categorias) {
        this.categorias = data.categorias;
      } else if (Array.isArray(data)) {
        this.categorias = data;
      }
    }

    console.log(`ℹ️ VistoriaChecklistField: resolveDataSource finished. Categorias found: ${this.categorias ? this.categorias.length : 0}`);
  }

  render() {
    const { id, label, description } = this.config;
    // Recalcular categorias caso tenham sido carregadas assincronamente (embora render seja sincrono, se re-renderizar pega)
    // Na prática, em mobile puro JS, precisaria de um re-render trigger se os dados chegarem depois.
    // Assumimos dados pré-carregados pelo smart-cache/device-setup.

    if (this.categorias.length === 0 && this.dataSourceName) {
      // Tenta resolver de novo caso tenha chegado agora
      this.resolveDataSource(this.config);
    }

    return `
      <div class="space-y-4 w-full" data-field-id="${id}">
        ${this.renderHeader()}
        ${this.mostrarResumo ? this.renderResumo() : ''}
        ${this.renderErrors()}
        ${this.renderCategorias()}
      </div>
    `;
  }

  renderHeader() {
    const { label, description } = this.config;
    // Using standard standard styling if available, but for now we follow the simple text structure commonly found in forms, 
    // or we can wrap it nicely.
    return `
      <div class="mb-4">
        <label class="block text-lg font-semibold text-gray-900 mb-1">${label}</label>
        ${description ? `<p class="text-sm text-gray-500">${description}</p>` : ''}
      </div>
    `;
  }

  renderResumo() {
    const stats = this.getEstatisticas();
    const percentual = stats.total > 0 ? Math.round((stats.preenchidos / stats.total) * 100) : 0;

    return `
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col items-center justify-center text-blue-900 shadow-sm">
          <span class="text-2xl font-bold">${stats.preenchidos}/${stats.total}</span>
          <span class="text-[0.65rem] uppercase tracking-wider opacity-70 font-semibold">Vistoriados</span>
        </div>
        
        ${stats.naoConformes > 0 ? `
          <div class="bg-red-50 border border-red-100 rounded-lg p-3 flex flex-col items-center justify-center text-red-900 animate-pulse shadow-sm">
             <div class="flex items-center gap-2">
                <!-- AlertCircle icon -->
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span class="text-2xl font-bold text-red-600">${stats.naoConformes}</span>
             </div>
             <span class="text-[0.65rem] uppercase tracking-wider opacity-70 font-semibold">Não Conformes</span>
          </div>
        ` : `
          <div class="bg-green-50 border border-green-100 rounded-lg p-3 flex flex-col items-center justify-center text-green-900 shadow-sm">
             <div class="flex items-center gap-2">
                <!-- Check icon -->
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span class="text-2xl font-bold text-green-600">0</span>
             </div>
             <span class="text-[0.65rem] uppercase tracking-wider opacity-70 font-semibold">Não Conformidades</span>
          </div>
        `}
      </div>
    `;
  }

  renderErrors() {
    if (!this.errors || this.errors.length === 0) return '';

    return `
      <div class="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-1 mb-4">
        <div class="text-orange-800 font-semibold text-sm flex items-center gap-2">
            <!-- AlertCircle icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Pendências:
        </div>
        ${this.errors.map(error => `
          <div class="text-xs text-orange-700 ml-6 list-disc">• ${error}</div>
        `).join('')}
      </div>
    `;
  }
  
  renderCategorias() {
    if (!this.categorias || !this.categorias.length) {
      return `<div class="p-4 text-center text-gray-500 bg-gray-50 rounded border border-gray-100">Nenhum item de checklist carregado.</div>`;
    }
    return `
      <div class="space-y-3">
        ${this.categorias.map(cat => this.renderCategoria(cat)).join('')}
      </div>
    `;
  }

  renderCategoria(categoria) {
    const expandido = this.estadoCategorias[categoria.id];
    const stats = this.getEstatisticasCategoria(categoria);
    
    const isComplete = stats.total > 0 && stats.preenchidos === stats.total;
    const hasIssues = stats.naoConformes > 0;

    let borderClass = "border-gray-200";
    let bgClass = "bg-white";
    
    if (hasIssues) {
        borderClass = "border-red-200";
        // bgClass = "bg-red-50"; // Optional: tint the card slightly if desired, but desktop keeps card white usually
    } else if (isComplete) {
        borderClass = "border-green-200";
        bgClass = "bg-green-50/30";
    }

    return `
      <div class="border rounded-lg overflow-hidden transition-all shadow-sm ${borderClass} ${bgClass}" data-categoria-id="${categoria.id}">
        <button
          type="button"
          class="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
          onclick="window.vistoriaChecklistHandler('${this.config.id}', 'toggleCategoria', '${categoria.id}')"
        >
          <div class="flex items-center gap-3 text-left">
            <span class="text-xl" role="img" aria-hidden="true">${categoria.icone || '📋'}</span>
            <div>
              <div class="font-semibold text-gray-800 text-base">${categoria.nome}</div>
              <div class="text-xs text-gray-500 flex gap-2 items-center mt-0.5">
                <span>${stats.preenchidos}/${stats.total} itens</span>
                ${hasIssues ? `<span class="text-red-600 font-bold flex items-center gap-1">• ${stats.naoConformes} NCs</span>` : ''}
              </div>
            </div>
          </div>
          <!-- Chevron icon -->
          ${expandido 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><polyline points="18 15 12 9 6 15"></polyline></svg>` 
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><polyline points="6 9 12 15 18 9"></polyline></svg>`
          }
        </button>

        ${expandido ? `
          <div class="bg-white border-t border-gray-100 p-2 pb-4">
            ${categoria.subcategorias
              ? `<div class="space-y-4 px-2">
                   ${categoria.subcategorias.map(sub => this.renderSubcategoria(sub)).join('')}
                 </div>`
              : `<div class="px-2">
                   ${this.renderItems(categoria.items)}
                 </div>`
            }
          </div>
        ` : ''}
      </div>
    `;
  }

  renderSubcategoria(subcategoria) {
    return `
      <div class="space-y-2">
        <h5 class="font-semibold text-sm text-gray-600 border-b border-gray-100 pb-1 mt-2 uppercase tracking-wide">${subcategoria.nome}</h5>
        <div class="pl-0">
            ${this.renderItems(subcategoria.items)}
        </div>
      </div>
    `;
  }

  renderItems(items) {
    if (!items) return '';
    return `
      <div class="flex flex-col">
        ${items.map(item => this.renderItem(item)).join('')}
      </div>
    `;
  }

  renderItem(item) {
    const itemData = this.value[item.id] || { status: null, obs: '', fotos: [] };
    const { status, obs, fotos } = itemData;
    const isNC = status === 'nao_conforme';
    const isOK = status === 'conforme';
    const qtdFotos = fotos ? fotos.length : 0;

    let bgContainer = "";
    if (isNC) bgContainer = "bg-red-50/30";

    return `
      <div class="border-b border-gray-100 last:border-0 py-4 px-2 hover:bg-gray-50/50 transition-colors ${bgContainer}" data-item-id="${item.id}">
        <div class="flex flex-col gap-3">
            <!-- 1. Descrição do Item -->
            <div class="font-medium text-sm text-gray-800 leading-snug">
                ${item.descricao}
            </div>
            
            <!-- 2. Botões de Ação -->
            <div class="flex gap-2 w-full">
                <!-- Conforme Button -->
                <button
                    type="button"
                    class="flex-1 h-10 rounded text-sm font-medium border flex items-center justify-center gap-1.5 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-green-500 ${isOK
                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300'
                    }"
                    onclick="window.vistoriaChecklistHandler('${this.config.id}', 'setStatus', '${item.id}', 'conforme')"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isOK ? 'text-white' : 'text-gray-500 group-hover:text-green-600'}"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Conforme
                </button>
                
                <!-- Não Conforme Button -->
                <button
                    type="button"
                    class="flex-1 h-10 rounded text-sm font-medium border flex items-center justify-center gap-1.5 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-red-500 ${isNC
                        ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                    }"
                    onclick="window.vistoriaChecklistHandler('${this.config.id}', 'setStatus', '${item.id}', 'nao_conforme')"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${isNC ? 'text-white' : 'text-gray-500 group-hover:text-red-600'}"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    Não Conforme
                </button>
            </div>

            <!-- 3. Detalhes (Fotos e Obs) - Condicional -->
            ${(isNC || (isOK && this.permitirFotos)) ? `
                <div class="mt-2 space-y-3 px-1 animate-in slide-in-from-top-1 fade-in duration-200 ${isNC ? 'block' : (this.permitirFotos ? 'block' : 'hidden')}">
                    
                    <!-- Observação (Apenas NC, mas aqui mantemos flexibilidade para o futuro) -->
                    ${isNC ? `
                        <textarea
                            class="w-full min-h-[80px] p-3 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y bg-white text-gray-800 placeholder-gray-400"
                            placeholder="Descreva a não conformidade..."
                            onchange="window.vistoriaChecklistHandler('${this.config.id}', 'setObs', '${item.id}', this.value)"
                        >${this.escapeHtml(obs || '')}</textarea>
                    ` : ''}
                    
                    <!-- Área de Fotos -->
                    ${this.permitirFotos ? `
                        <div class="space-y-3">
                             <div class="flex items-center gap-2 text-xs text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span>${qtdFotos}/${this.maxFotos} fotos</span>
                             </div>

                            <div class="flex flex-wrap gap-3">
                                ${fotos.map((foto, index) => `
                                    <div class="relative group w-20 h-20">
                                        <img src="${foto}" alt="Evidência ${index+1}" class="w-full h-full object-cover rounded-lg border border-gray-200 shadow-sm" />
                                        <button
                                            type="button"
                                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors z-10"
                                            onclick="window.vistoriaChecklistHandler('${this.config.id}', 'removerFoto', '${item.id}', ${index})"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                `).join('')}
                                
                                ${qtdFotos < this.maxFotos ? `
                                    <div class="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            id="cam-${this.config.id}-${item.id}"
                                            class="hidden"
                                            style="display:none"
                                            onchange="window.vistoriaChecklistHandler('${this.config.id}', 'capturarFoto', '${item.id}', this)"
                                        />
                                        <label
                                            for="cam-${this.config.id}-${item.id}"
                                            class="flex flex-col items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${(isNC && this.obrigatorioFotoNC && qtdFotos === 0)
                                              ? 'border-red-300 bg-red-50/20 hover:bg-red-100/30'
                                              : 'border-gray-300 hover:bg-gray-50'
                                            }"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1 ${ (isNC && this.obrigatorioFotoNC && qtdFotos === 0) ? 'text-red-400' : 'text-gray-400' }"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                            <span class="text-[9px] text-gray-500 text-center px-1 font-medium">
                                                ${(isNC && this.obrigatorioFotoNC && qtdFotos === 0) ? 'Foto Obrig.' : 'Adicionar'}
                                            </span>
                                        </label>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
      </div>
    `;
  }

  // ============================================
  // HANDLERS DE INTERAÇÃO
  // ============================================

  toggleCategoria(categoriaId) {
    this.estadoCategorias[categoriaId] = !this.estadoCategorias[categoriaId];
    this.updateDOM();
  }

  setStatus(itemId, status) {
    // Inicializa item se não existir
    if (!this.value[itemId]) {
      this.value[itemId] = { status: null, obs: '', fotos: [] };
    }

    const currentItem = this.value[itemId];
    currentItem.status = status;

    // Se mudou para conforme, limpa observação (Desktop behavior)
    if (status === 'conforme') {
      currentItem.obs = '';
    }
    // Fotos são mantidas mesmo mudando status, para evitar perda acidental

    this.isDirty = true;
    this.updateDOM();
  }

  setObs(itemId, obs) {
    if (!this.value[itemId]) {
      this.value[itemId] = { status: 'nao_conforme', obs: '', fotos: [] };
    }

    this.value[itemId].obs = obs;
    this.isDirty = true;
  }

  capturarFoto(itemId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    if (!this.value[itemId]) {
      this.value[itemId] = { status: 'nao_conforme', obs: '', fotos: [] };
    }

    if (this.value[itemId].fotos.length >= this.maxFotos) {
      alert(`Máximo de ${this.maxFotos} fotos permitido por item.`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      this.value[itemId].fotos.push(reader.result);
      this.isDirty = true;
      this.updateDOM();
    };
    reader.readAsDataURL(file);
  }

  removerFoto(itemId, index) {
    if (this.value[itemId]) {
      this.value[itemId].fotos.splice(index, 1);
      this.isDirty = true;
      this.updateDOM();
    }
  }

  // ============================================
  // ESTATÍSTICAS E AUXILIARES
  // ============================================

  getTotalItens() {
    let total = 0;
    this.categorias.forEach(cat => {
      if (cat.subcategorias) {
        cat.subcategorias.forEach(sub => {
          total += (sub.items || []).length;
        });
      } else if (cat.items) {
        total += (cat.items || []).length;
      }
    });
    return total;
  }

  getAllItems() {
    const items = [];
    this.categorias.forEach(cat => {
      if (cat.subcategorias) {
        cat.subcategorias.forEach(sub => {
          items.push(...(sub.items || []));
        });
      } else if (cat.items) {
        items.push(...(cat.items || []));
      }
    });
    return items;
  }

  getEstatisticas() {
    const allItems = this.getAllItems();
    const total = allItems.length;
    let preenchidos = 0;
    let naoConformes = 0;

    allItems.forEach(item => {
      const val = this.value[item.id];
      if (val && val.status) {
        preenchidos++;
        if (val.status === 'nao_conforme') naoConformes++;
      }
    });

    return { total, preenchidos, naoConformes };
  }

  getEstatisticasCategoria(categoria) {
    let items = [];
    if (categoria.subcategorias) {
      categoria.subcategorias.forEach(sub => {
        items.push(...(sub.items || []));
      });
    } else if (categoria.items) {
      items = categoria.items || [];
    }

    const total = items.length;
    let preenchidos = 0;
    let naoConformes = 0;

    items.forEach(item => {
      const val = this.value[item.id];
      if (val && val.status) {
        preenchidos++;
        if (val.status === 'nao_conforme') naoConformes++;
      }
    });

    return { total, preenchidos, naoConformes };
  }

  // ============================================
  // VALIDAÇÃO E ENVIO (Alinhado com Desktop)
  // ============================================

  validate() {
    this.errors = [];
    this.isValid = true;

    const allItems = this.getAllItems();

    // 1. Verificar itens não preenchidos
    const stat = this.getEstatisticas();
    if (stat.preenchidos < stat.total) {
      this.errors.push(`${stat.total - stat.preenchidos} item(ns) não vistoriado(s)`);
      this.isValid = false;
    }

    // 2. Verificar NC sem observação (se obrigatório)
    if (this.obrigatorioObservacaoNC) {
      const ncSemObs = allItems.filter(item => {
        const data = this.value[item.id];
        return data && data.status === 'nao_conforme' && (!data.obs || data.obs.trim() === '');
      });

      if (ncSemObs.length > 0) {
        this.errors.push(`${ncSemObs.length} não conformidade(s) sem descrição obrigatória`);
        this.isValid = false;
      }
    }

    // 3. Verificar NC sem foto (se obrigatório)
    if (this.obrigatorioFotoNC && this.permitirFotos) {
      const ncSemFoto = allItems.filter(item => {
        const data = this.value[item.id];
        return data && data.status === 'nao_conforme' && (!data.fotos || data.fotos.length === 0);
      });

      if (ncSemFoto.length > 0) {
        this.errors.push(`${ncSemFoto.length} não conformidade(s) sem foto de evidência`);
        this.isValid = false;
      }
    }

    return this.isValid;
  }

  // Retorna o valor completo, idêntico ao Desktop para consistência no backend
  getValue() {
    // Reconstitui a estrutura completa (items + detalhes + resumo)
    // O 'BaseField' chama getValue() para salvar no formData
    return this.getSubmitData();
  }

  // Compatibilidade com BaseField, mas sobrescrevendo para garantir estrutura
  setValue(value) {
    if (value && typeof value === 'object') {
      // Se vier o objeto completo { items: ... }, pega só items
      // Se vier só o map de items, usa direto
      this.value = value.items || value;
      this.updateDOM();
    }
  }

  getSubmitData() {
    const stats = this.getEstatisticas();
    const detalhes = [];

    // Gerar array plano de detalhes (para fácil query no banco/relatórios)
    this.categorias.forEach(cat => {
      const catName = cat.nome;

      const processItems = (list, prefix) => {
        list.forEach(item => {
          const data = this.value[item.id] || { status: null, obs: '', fotos: [] };
          detalhes.push({
            categoria: prefix,
            item_id: item.id,
            descricao: item.descricao,
            status: data.status,
            observacao: data.obs || '',
            tem_foto: (data.fotos && data.fotos.length > 0),
            qtd_fotos: (data.fotos ? data.fotos.length : 0)
          });
        });
      };

      if (cat.items) {
        processItems(cat.items, catName);
      }
      if (cat.subcategorias) {
        cat.subcategorias.forEach(sub => {
          processItems(sub.items, `${catName} > ${sub.nome}`);
        });
      }
    });

    return {
      items: this.value, // Mapa ID -> State
      detalhes: detalhes, // Array plano rico
      resumo: {
        total_itens: stats.total,
        itens_vistoriados: stats.preenchidos,
        nao_conformidades: stats.naoConformes,
        percentual_completo: stats.total > 0 ? Math.round((stats.preenchidos / stats.total) * 100) : 0
      },
      timestamp: new Date().toISOString()
    };
  }

  resetAll() {
    this.value = {};
    this.errors = [];
    this.isValid = true;
    this.isDirty = false;

    // Recolher todas as categorias
    Object.keys(this.estadoCategorias).forEach(catId => {
      this.estadoCategorias[catId] = false;
    });

    this.updateDOM();
  }

  updateDOM() {
    const container = document.querySelector(`[data-field-id="${this.config.id}"]`);
    if (container) {
      const html = this.render();
      container.outerHTML = html;
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ============================================
// HANDLER GLOBAL
// ============================================

window.vistoriaChecklistHandler = function (fieldId, action, ...args) {
  const field = window.fieldInstances ? window.fieldInstances[fieldId] : null;
  if (!field) {
    console.error(`❌ VistoriaChecklistField não encontrado: ${fieldId}`);
    return;
  }

  switch (action) {
    case 'toggleCategoria':
      field.toggleCategoria(args[0]);
      break;
    case 'setStatus':
      field.setStatus(args[0], args[1]);
      break;
    case 'setObs':
      field.setObs(args[0], args[1]);
      break;
    case 'capturarFoto':
      field.capturarFoto(args[0], args[1]);
      break;
    case 'removerFoto':
      field.removerFoto(args[0], args[1]);
      break;
    default:
      console.warn(`⚠️ Ação desconhecida: ${action}`);
  }
};
