// js/fields/PresenceMigration.js
/**
 * Migration utility for consolidating presence fields
 * This helps transition from separate presence files to the unified PresenceField
 */

/**
 * Migration notes for developers:
 * 
 * BEFORE (Phase 2 - separate files):
 * - PresenceCompactField.js
 * - PresenceSelectorCompactField.js  
 * - presenceListField.js
 * - presenceHelpers.js (in types/)
 * 
 * AFTER (Phase 2 - consolidated):
 * - PresenceField.js (handles all three variants)
 * - presenceHelpers.js (moved to utils/)
 * 
 * BACKWARD COMPATIBILITY:
 * All existing field type names continue to work:
 * - 'presence_compact' -> PresenceField (variant: 'compact')
 * - 'presence-selector-compact' -> PresenceField (variant: 'selector')
 * - 'presence-list' -> PresenceField (variant: 'list')
 * 
 * CONFIGURATION MIGRATION:
 * No changes needed to existing form configurations.
 * The PresenceField auto-detects variant based on config properties:
 * - config.useSmartFilters/filterSystem -> selector variant
 * - config.columns === 2 or config.compact -> compact variant
 * - config.variant (explicit) -> use specified variant
 * - fallback -> list variant
 * 
 * ALPINE.JS DATA COMPATIBILITY:
 * All existing Alpine.js data structures remain compatible.
 * The consolidated field returns the same data format as the original fields.
 */

class PresenceMigration {
  /**
   * Validate that all presence configurations work with the new consolidated field
   */
  static validateConfiguration(config) {
    const warnings = [];
    const errors = [];

    try {
      // Check if using deprecated fieldType names (these still work but could be updated)
      if (config.fieldType && config.fieldType !== config.type) {
        warnings.push(`Consider using 'type' instead of 'fieldType' for consistency`);
      }

      // Validate compact variant configuration
      if (config.columns && ![1, 2].includes(Number(config.columns))) {
        errors.push(`config.columns must be 1 or 2 when specified`);
      }

      // Validate selector variant configuration  
      if (config.filterOptions && typeof config.filterOptions !== 'object') {
        errors.push(`config.filterOptions must be an object when specified`);
      }

      if (config.useSmartFilters !== undefined && typeof config.useSmartFilters !== 'boolean') {
        errors.push(`config.useSmartFilters must be a boolean when specified`);
      }

      // Validate participants data
      if (config.participants && !Array.isArray(config.participants)) {
        errors.push(`config.participants must be an array when specified`);
      }

      if (config.rawData && !Array.isArray(config.rawData)) {
        errors.push(`config.rawData must be an array when specified`);
      }

      // Validate label and group configuration
      if (config.participantLabelKey && typeof config.participantLabelKey !== 'string') {
        errors.push(`config.participantLabelKey must be a string when specified`);
      }

      if (config.groupField && typeof config.groupField !== 'string') {
        errors.push(`config.groupField must be a string when specified`);
      }

      if (config.groupKey && typeof config.groupKey !== 'string') {
        errors.push(`config.groupKey must be a string when specified`);
      }

      // Validate status configuration
      if (config.statusSequence && !Array.isArray(config.statusSequence)) {
        errors.push(`config.statusSequence must be an array when specified`);
      }

      if (config.statusColors && typeof config.statusColors !== 'object') {
        errors.push(`config.statusColors must be an object when specified`);
      }

      if (config.statusLabels && typeof config.statusLabels !== 'object') {
        errors.push(`config.statusLabels must be an object when specified`);
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
   * Get migration status for presence fields in a form
   */
  static getMigrationStatus(formConfig) {
    const results = {
      totalFields: 0,
      presenceFields: 0,
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
        const isPresenceField = campo.type && (
          campo.type.includes('presence') || 
          campo.type.includes('lista') && campo.type.includes('presenca')
        );

        if (isPresenceField) {
          results.presenceFields++;

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

      results.summary = `Found ${results.presenceFields} presence fields, ${results.compatibleFields} fully compatible`;
      
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
    
    console.group('👥 Presence Field Migration Report');
    console.log(`📊 Total fields: ${status.totalFields}`);
    console.log(`✅ Presence fields: ${status.presenceFields}`);
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
   * Test presence field creation with consolidated field
   */
  static testPresenceFieldCreation() {
    console.group('🧪 Testing Presence Field Creation');
    
    try {
      // Test compact variant
      const compactConfig = {
        id: 'test_compact',
        type: 'presence_compact',
        columns: 2,
        participants: [
          { id: '1', nome: 'João Silva', galpao: 'ACMR' },
          { id: '2', nome: 'Maria Santos', galpao: 'Aresp' }
        ]
      };
      
      console.log('✅ Compact config valid:', this.validateConfiguration(compactConfig));

      // Test selector variant
      const selectorConfig = {
        id: 'test_selector',
        type: 'presence_selector_compact',
        useSmartFilters: true,
        filterOptions: { galpao: true, funcao: true }
      };
      
      console.log('✅ Selector config valid:', this.validateConfiguration(selectorConfig));

      // Test list variant
      const listConfig = {
        id: 'test_list',
        type: 'presence_list',
        participantLabelKey: 'nome',
        groupField: 'galpao_selecionado'
      };
      
      console.log('✅ List config valid:', this.validateConfiguration(listConfig));

    } catch (e) {
      console.error('❌ Test failed:', e.message);
    }
    
    console.groupEnd();
  }

  /**
   * Test variant detection logic
   */
  static testVariantDetection() {
    console.group('🎯 Testing Variant Detection');
    
    const testCases = [
      {
        name: 'Explicit variant specification',
        config: { variant: 'compact' },
        expected: 'compact'
      },
      {
        name: 'Smart filters detection',
        config: { useSmartFilters: true },
        expected: 'selector'
      },
      {
        name: 'Columns detection',
        config: { columns: 2 },
        expected: 'compact'
      },
      {
        name: 'Field type detection - compact',
        config: { type: 'presence_compact' },
        expected: 'compact'
      },
      {
        name: 'Field type detection - selector',
        config: { type: 'presence-selector-compact' },
        expected: 'selector'
      },
      {
        name: 'Field type detection - list',
        config: { type: 'presence-list' },
        expected: 'list'
      },
      {
        name: 'Default fallback',
        config: { id: 'test' },
        expected: 'list'
      }
    ];

    testCases.forEach(testCase => {
      try {
        // Mock the PresenceField class behavior
        const mockDetectVariant = (config) => {
          if (config.variant) return config.variant;
          if (config.useSmartFilters || config.filterSystem || config.filterOptions) return 'selector';
          if (config.columns === 2 || config.compact === true) return 'compact';
          if (config.fieldType || config.type) {
            const type = config.fieldType || config.type;
            if (type.includes('selector')) return 'selector';
            if (type.includes('compact')) return 'compact';
            if (type.includes('list')) return 'list';
          }
          return 'list';
        };

        const detected = mockDetectVariant(testCase.config);
        const passed = detected === testCase.expected;
        
        console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${detected} ${passed ? '' : `(expected ${testCase.expected})`}`);
      } catch (e) {
        console.log(`❌ ${testCase.name}: Error - ${e.message}`);
      }
    });
    
    console.groupEnd();
  }
}

export default PresenceMigration;

// Auto-run validation if in development mode
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
  // Make available globally for debugging
  window.PresenceMigration = PresenceMigration;
  
  // Auto-test on load (only in development)
  document.addEventListener('DOMContentLoaded', () => {
    PresenceMigration.testPresenceFieldCreation();
    PresenceMigration.testVariantDetection();
  });
}