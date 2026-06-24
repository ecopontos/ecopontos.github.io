// js/fields/ChecklistMigration.js
/**
 * Migration utility for consolidating checklist fields
 * This helps transition from separate checklist files to the unified ChecklistField
 */

/**
 * Migration notes for developers:
 * 
 * BEFORE (Phase 1 - separate files):
 * - InspectionChecklistField.js
 * - VistoriaChecklistField.js  
 * - UnifiedChecklistField.js
 * 
 * AFTER (Phase 1 - consolidated):
 * - ChecklistField.js (handles all three modes)
 * 
 * BACKWARD COMPATIBILITY:
 * All existing field type names continue to work:
 * - 'inspection_checklist' -> ChecklistField (mode: 'inspection')
 * - 'vistoria_checklist' -> ChecklistField (mode: 'vistoria')
 * - 'unified_checklist' -> ChecklistField (mode: 'unified')
 * 
 * CONFIGURATION MIGRATION:
 * No changes needed to existing form configurations.
 * The ChecklistField auto-detects mode based on config properties:
 * - config.states -> inspection mode
 * - config.galpoes/categorias -> vistoria mode
 * - config.mode (explicit) -> use specified mode
 * - fallback -> unified mode
 * 
 * ALPINE.JS DATA COMPATIBILITY:
 * All existing Alpine.js data structures remain compatible.
 * The consolidated field returns the same data format as the original fields.
 */

class ChecklistMigration {
  /**
   * Validate that all checklist configurations work with the new consolidated field
   */
  static validateConfiguration(config) {
    const warnings = [];
    const errors = [];

    try {
      // Check if using deprecated fieldType names (these still work but could be updated)
      if (config.fieldType && config.fieldType !== config.type) {
        warnings.push(`Consider using 'type' instead of 'fieldType' for consistency`);
      }

      // Validate inspection mode configuration
      if (config.states && !Array.isArray(config.states)) {
        errors.push(`config.states must be an array when specified`);
      }

      // Validate vistoria mode configuration  
      if (config.galpoes && !Array.isArray(config.galpoes)) {
        errors.push(`config.galpoes must be an array when specified`);
      }

      if (config.categorias && !Array.isArray(config.categorias)) {
        errors.push(`config.categorias must be an array when specified`);
      }

      // Validate data source configuration
      if (config.dataSource) {
        if (typeof config.dataSource !== 'string' && !Array.isArray(config.dataSource)) {
          errors.push(`config.dataSource must be a string (key) or array (data) when specified`);
        }
      }

      return {
        isValid: errors.length === 0,
        warnings,
        errors
      };

    } catch (e) {
      return {
        isValid: false,
        warnings,
        errors: [...errors, `Validation error: ${e.message}`]
      };
    }
  }

  /**
   * Get migration status for checklist fields in a form
   */
  static getMigrationStatus(formConfig) {
    const results = {
      totalFields: 0,
      checklistFields: 0,
      compatibleFields: 0,
      issuesFound: [],
      summary: ''
    };

    try {
      if (!formConfig || !formConfig.campos) {
        return {
          ...results,
          summary: 'No form configuration provided'
        };
      }

      results.totalFields = formConfig.campos.length;

      formConfig.campos.forEach((campo, index) => {
        const isChecklistField = campo.type && (
          campo.type.includes('checklist') || 
          campo.type.includes('inspection') || 
          campo.type.includes('vistoria')
        );

        if (isChecklistField) {
          results.checklistFields++;

          const validation = this.validateConfiguration(campo);
          if (validation.isValid) {
            results.compatibleFields++;
          } else {
            results.issuesFound.push({
              fieldIndex: index,
              fieldId: campo.id || campo.name || `field_${index}`,
              fieldType: campo.type,
              issues: validation.errors
            });
          }

          if (validation.warnings.length > 0) {
            results.issuesFound.push({
              fieldIndex: index,
              fieldId: campo.id || campo.name || `field_${index}`,
              fieldType: campo.type,
              warnings: validation.warnings
            });
          }
        }
      });

      results.summary = `Found ${results.checklistFields} checklist fields, ${results.compatibleFields} fully compatible`;
      
      if (results.issuesFound.length > 0) {
        results.summary += `, ${results.issuesFound.length} with minor issues`;
      }

      return results;

    } catch (e) {
      return {
        ...results,
        summary: `Error analyzing form: ${e.message}`
      };
    }
  }

  /**
   * Generate migration report for console logging
   */
  static generateReport(formConfig) {
    const status = this.getMigrationStatus(formConfig);
    
    console.group('📋 Checklist Field Migration Report');
    console.log(`📊 Total fields: ${status.totalFields}`);
    console.log(`✅ Checklist fields: ${status.checklistFields}`);
    console.log(`🔄 Compatible: ${status.compatibleFields}`);
    
    if (status.issuesFound.length > 0) {
      console.group('⚠️ Issues Found:');
      status.issuesFound.forEach(issue => {
        console.log(`Field: ${issue.fieldId} (${issue.fieldType})`);
        if (issue.errors) {
          console.error('Errors:', issue.errors);
        }
        if (issue.warnings) {
          console.warn('Warnings:', issue.warnings);
        }
      });
      console.groupEnd();
    }
    
    console.log(`📝 Summary: ${status.summary}`);
    console.groupEnd();

    return status;
  }

  /**
   * Test checklist field creation with consolidated field
   */
  static testChecklistFieldCreation() {
    console.group('🧪 Testing Checklist Field Creation');
    
    try {
      // Test inspection mode
      const inspectionConfig = {
        id: 'test_inspection',
        type: 'inspection_checklist',
        states: [
          { value: 'ok', label: 'OK', icon: '✅', color: '#4CAF50' },
          { value: 'nok', label: 'Não OK', icon: '❌', color: '#F44336' }
        ]
      };
      
      console.log('✅ Inspection config valid:', this.validateConfiguration(inspectionConfig));

      // Test vistoria mode
      const vistoriaConfig = {
        id: 'test_vistoria',
        type: 'vistoria_checklist',
        galpoes: ['ACMR', 'Teste'],
        categorias: []
      };
      
      console.log('✅ Vistoria config valid:', this.validateConfiguration(vistoriaConfig));

      // Test unified mode
      const unifiedConfig = {
        id: 'test_unified',
        type: 'unified_checklist',
        mode: 'inspection'
      };
      
      console.log('✅ Unified config valid:', this.validateConfiguration(unifiedConfig));

    } catch (e) {
      console.error('❌ Test failed:', e.message);
    }
    
    console.groupEnd();
  }
}

export default ChecklistMigration;

// Auto-run validation if in development mode
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
  // Make available globally for debugging
  window.ChecklistMigration = ChecklistMigration;
  
  // Auto-test on load (only in development)
  document.addEventListener('DOMContentLoaded', () => {
    ChecklistMigration.testChecklistFieldCreation();
  });
}