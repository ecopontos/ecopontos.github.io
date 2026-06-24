/**
 * Exemplos de JSONB Profissional gerado pelo data-service.js
 * 
 * Este arquivo demonstra a nova estrutura profissional de dados
 * que substitui o formato antigo por uma versão mais robusta e escalável.
 */

// ===== EXEMPLO 1: Formulário de Atendimento Ecoponto =====
const exemploAtendimentoProfissional = {
    // Metadados do registro
    metadata: {
        version: "2.0",
        schema: "ecoforms-professional",
        created_at: "2024-01-15T14:30:00.000Z",
        updated_at: "2024-01-15T14:30:00.000Z",
        form_type: "ecopontoForm",
        sync_status: "pending",
        source: "mobile-app",
        quality: {
            completeness: 85, // Percentual de campos preenchidos
            validation_status: "pending",
            review_required: false
        }
    },
    
    // Informações do usuário
    usuario: {
        id: "user_123",
        nome: "João Silva",
        device_id: "device_abc123",
        perfil: "operador"
    },
    
    // Dados do atendimento
    atendimento: {
        identificacao: {
            placa_veiculo: "ABC1234",
            tipo_veiculo: "mercosul", // mercosul | antiga | desconhecido
            ecoponto: {
                id: "ecoponto_001",
                nome: "Ecoponto Centro",
                bairro: "Centro"
            }
        },
        entrega: {
            timestamp: "2024-01-15T14:30:00.000Z",
            residuos: ["entulho", "madeira", "poda"],
            quantidade_total: 3,
            classificacao: "mista" // vazia | simples | mista | complexa
        },
        validacao: {
            placa_valida: true,
            residuos_permitidos: true,
            horario_permitido: true // 7h às 18h
        }
    },
    
    // Dados de inspeção (se aplicável)
    inspecao: {
        // ... dados de inspeção
    },
    
    // Localização
    localizacao: {
        timestamp: "2024-01-15T14:30:00.000Z",
        origem: "manual", // manual | gps | automatica
        confiabilidade: "alta" // alta | media | baixa
    }
};

// ===== EXEMPLO 2: Formulário de Caixas Ecoponto =====
const exemploCaixasProfissional = {
    metadata: {
        version: "2.0",
        schema: "ecoforms-professional",
        created_at: "2024-01-15T15:45:00.000Z",
        updated_at: "2024-01-15T15:45:00.000Z",
        form_type: "ecopontoCaixasForm",
        sync_status: "pending",
        source: "mobile-app",
        quality: {
            completeness: 100,
            validation_status: "validated",
            review_required: false
        }
    },
    
    usuario: {
        id: "user_123",
        nome: "João Silva",
        device_id: "device_abc123",
        perfil: "operador"
    },
    
    inspecao: {
        ecoponto: {
            id: "ecoponto_001",
            nome: "Ecoponto Centro"
        },
        ocupacao: {
            timestamp: "2024-01-15T15:45:00.000Z",
            caixas: [
                {
                    id: 1,
                    nome: "Entulho",
                    cor: "bg-gray-500",
                    ocupacao: "75",
                    status: "ativa",
                    nivel_critico: false
                },
                {
                    id: 2,
                    nome: "Madeira",
                    cor: "bg-amber-600",
                    ocupacao: "90",
                    status: "ativa",
                    nivel_critico: true
                },
                {
                    id: 3,
                    nome: "Poda",
                    cor: "bg-green-600",
                    ocupacao: "",
                    status: "vazia",
                    nivel_critico: false
                }
                // ... outras caixas
            ],
            resumo: {
                total: 7,
                preenchidas: 5,
                criticas: 2,
                removidas: 0,
                taxa_ocupacao: 68
            }
        },
        evento: {
            id: "event_123",
            action: "update",
            caixaId: "2",
            nivel: "90",
            removed: false,
            timestamp: "2024-01-15T15:45:00.000Z"
        }
    },
    
    localizacao: {
        timestamp: "2024-01-15T15:45:00.000Z",
        origem: "manual",
        confiabilidade: "alta"
    }
};

// ===== VANTAGENS DO FORMATO PROFISSIONAL =====

/*
1. **METADADOS ENRIQUECIDOS**
   - Versionamento de schema
   - Métricas de qualidade
   - Status de sincronização
   - Rastreabilidade completa

2. **ESTRUTURA ORGANIZADA**
   - Separação clara entre dados e metadados
   - Agrupamento lógico por contexto
   - Nomenclatura padronizada

3. **VALIDAÇÃO INTELIGENTE**
   - Validação de placas (Mercosul/Antiga)
   - Classificação automática de entregas
   - Detecção de níveis críticos
   - Cálculo de taxas e percentuais

4. **COMPATIBILIDADE**
   - Mantém campos originais para retrocompatibilidade
   - Suporte a múltiplos tipos de formulários
   - Extensível para novos tipos de dados

5. **PERFORMANCE**
   - Reduz redundância de dados
   - Facilita queries no banco de dados
   - Melhora indexação e busca
*/

// ===== MIGRAÇÃO DE DADOS ANTIGOS =====

function migrarDadosAntigos(dadosAntigos) {
    // Função para converter dados no formato antigo para o novo formato profissional
    return {
        ...createProfessionalJSONB(dadosAntigos),
        // Mantém dados originais para compatibilidade
        dados_originais: dadosAntigos
    };
}

console.log("✅ JSONB Profissional implementado com sucesso!");
console.log("📊 Estrutura mais organizada, válida e escalável");