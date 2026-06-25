// js/fields/utils/dataValidator.js
/**
 * Utilitário para validação de schemas de dados
 */

class DataValidator {
  /**
   * Valida estrutura de dados de galpões
   */
  static validateGalpoes(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Galpões deve ser um array' };
    }

    for (let i = 0; i < data.length; i++) {
      const galpao = data[i];

      if (typeof galpao === 'string') {
        // Formato antigo aceito
        continue;
      }

      if (typeof galpao === 'object' && galpao !== null) {
        if (!galpao.id || !galpao.nome) {
          return {
            valid: false,
            error: `Galpão ${i + 1}: deve ter 'id' e 'nome' quando for objeto`
          };
        }
      } else {
        return {
          valid: false,
          error: `Galpão ${i + 1}: deve ser string ou objeto com id/nome`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Valida estrutura de categorias de vistoria
   */
  static validateCategorias(data) {
    if (!Array.isArray(data)) {
      return { valid: false, error: 'Categorias deve ser um array' };
    }

    for (let i = 0; i < data.length; i++) {
      const categoria = data[i];

      if (!categoria.id || !categoria.nome) {
        return {
          valid: false,
          error: `Categoria ${i + 1}: deve ter 'id' e 'nome'`
        };
      }

      // Validar subcategorias se existirem
      if (categoria.subcategorias) {
        if (!Array.isArray(categoria.subcategorias)) {
          return {
            valid: false,
            error: `Categoria ${categoria.nome}: subcategorias deve ser array`
          };
        }

        for (let j = 0; j < categoria.subcategorias.length; j++) {
          const sub = categoria.subcategorias[j];

          if (!sub.id || !sub.nome || !sub.items) {
            return {
              valid: false,
              error: `Subcategoria ${j + 1} de ${categoria.nome}: deve ter id, nome e items`
            };
          }

          if (!Array.isArray(sub.items)) {
            return {
              valid: false,
              error: `Subcategoria ${sub.nome}: items deve ser array`
            };
          }

          // Validar items
          for (let k = 0; k < sub.items.length; k++) {
            const item = sub.items[k];
            if (!item.id || !item.descricao) {
              return {
                valid: false,
                error: `Item ${k + 1} de ${sub.nome}: deve ter id e descricao`
              };
            }
          }
        }
      }

      // Validar items diretos se existirem
      if (categoria.items && !categoria.subcategorias) {
        if (!Array.isArray(categoria.items)) {
          return {
            valid: false,
            error: `Categoria ${categoria.nome}: items deve ser array`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Valida estrutura completa de dados de vistoria
   */
  static validateVistoriaData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Dados devem ser um objeto' };
    }

    // Validar galpões
    if (data.galpoes) {
      const galpoesValidation = this.validateGalpoes(data.galpoes);
      if (!galpoesValidation.valid) {
        return galpoesValidation;
      }
    }

    // Validar galpoesEstruturados se existir
    if (data.galpoesEstruturados) {
      const estruturadosValidation = this.validateGalpoes(data.galpoesEstruturados);
      if (!estruturadosValidation.valid) {
        return {
          valid: false,
          error: 'galpoesEstruturados: ' + estruturadosValidation.error
        };
      }
    }

    // Validar categorias
    if (data.categorias) {
      const categoriasValidation = this.validateCategorias(data.categorias);
      if (!categoriasValidation.valid) {
        return categoriasValidation;
      }
    }

    return { valid: true };
  }

  /**
   * Valida dados e lança erro se inválido
   */
  static assertValid(data, type = 'vistoria') {
    let validation;

    switch (type) {
      case 'galpoes':
        validation = this.validateGalpoes(data);
        break;
      case 'categorias':
        validation = this.validateCategorias(data);
        break;
      case 'vistoria':
      default:
        validation = this.validateVistoriaData(data);
        break;
    }

    if (!validation.valid) {
      throw new Error(`Validação falhou: ${validation.error}`);
    }

    return true;
  }
}

export default DataValidator;