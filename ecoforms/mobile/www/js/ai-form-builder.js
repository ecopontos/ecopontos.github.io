/**
 * AI Form Builder Service
 * Integrates with OpenRouter API to generate forms using AI chat
 */

class AIFormBuilderService {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://openrouter.ai/api/v1';
        this.model = 'anthropic/claude-3-haiku'; // Fast and cost-effective model
        this.conversationHistory = [];
    }

    /**
     * Initialize the service with API key
     */
    async initialize() {
        // Try to get API key from various sources
        this.apiKey = this.getApiKey();
        if (!this.apiKey) {
            throw new Error('OpenRouter API key not found. Please configure it in system settings.');
        }
    }

    /**
     * Get API key from various sources
     */
    getApiKey() {
        // Check localStorage first
        let key = localStorage.getItem('openrouter_api_key');

        // Check environment variables (if available)
        if (!key && typeof process !== 'undefined' && process.env) {
            key = process.env.OPENROUTER_API_KEY;
        }

        // Check meta tags
        if (!key) {
            const metaTag = document.querySelector('meta[name="openrouter-api-key"]');
            if (metaTag) {
                key = metaTag.getAttribute('content');
            }
        }

        return key;
    }

    /**
     * Set API key
     */
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('openrouter_api_key', key);
    }

    /**
     * Send a message to the AI and get a response
     */
    async sendMessage(message, context = {}) {
        if (!this.apiKey) {
            await this.initialize();
        }

        const messages = this.buildMessages(message, context);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'EcoForms Form Builder'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenRouter API error: ${error.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const aiMessage = data.choices[0]?.message?.content;

            if (!aiMessage) {
                throw new Error('No response from AI');
            }

            // Add to conversation history
            this.conversationHistory.push({ role: 'user', content: message });
            this.conversationHistory.push({ role: 'assistant', content: aiMessage });

            return aiMessage;
        } catch (error) {
            console.error('AI Form Builder error:', error);
            throw error;
        }
    }

    /**
     * Build messages array with system prompt and context
     */
    buildMessages(userMessage, context) {
        const systemPrompt = `Você é um assistente especializado em criar formulários JSON para o sistema EcoForms.

INSTRUÇÕES IMPORTANTES:
- Sempre responda APENAS com JSON válido do formulário
- Use o formato específico do EcoForms (veja exemplo abaixo)
- Campos devem ter: id, label, type, required (opcional)
- Para campos select/radio: adicione "options" como array de strings
- Para campos especiais: use os tipos disponíveis no sistema
- Mantenha os IDs únicos e em snake_case
- Seja conciso mas completo

FORMATO ESPERADO:
{
  "id": "nome_do_formulario",
  "titulo": "Título do Formulário",
  "descricao": "Descrição breve",
  "campos": [
    {
      "id": "campo_exemplo",
      "label": "Campo de Exemplo",
      "type": "text",
      "required": true
    }
  ]
}

TIPOS DE CAMPO DISPONÍVEIS:
- text, email, number, date, time, textarea, file
- select, checkbox, radio
- occupation-selector (seletor de ocupação de caixas)

EXEMPLO COMPLETO:
{
  "id": "cadastro_usuario",
  "titulo": "Cadastro de Usuário",
  "descricao": "Formulário para cadastro de novos usuários",
  "campos": [
    {
      "id": "nome_completo",
      "label": "Nome Completo",
      "type": "text",
      "required": true
    },
    {
      "id": "email",
      "label": "E-mail",
      "type": "email",
      "required": true
    },
    {
      "id": "departamento",
      "label": "Departamento",
      "type": "select",
      "options": ["Recursos Humanos", "TI", "Financeiro", "Operacional"],
      "required": true
    }
  ]
}`;

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history (last 10 messages to avoid token limits)
        const recentHistory = this.conversationHistory.slice(-10);
        messages.push(...recentHistory);

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }

    /**
     * Generate a form based on a description
     */
    async generateForm(description) {
        const prompt = `Crie um formulário completo baseado nesta descrição: "${description}"

Gere um JSON válido seguindo o formato EcoForms. Inclua todos os campos necessários para capturar as informações solicitadas.`;

        return await this.sendMessage(prompt);
    }

    /**
     * Modify an existing form
     */
    async modifyForm(existingFormJson, modificationRequest) {
        const prompt = `Modifique este formulário existente baseado na solicitação: "${modificationRequest}"

FORMULÁRIO ATUAL:
${existingFormJson}

Retorne apenas o JSON do formulário modificado.`;

        return await this.sendMessage(prompt);
    }

    /**
     * Validate and parse AI response as JSON
     */
    parseFormJson(aiResponse) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const formData = JSON.parse(jsonMatch[0]);

            // Basic validation
            if (!formData.id || !formData.titulo || !Array.isArray(formData.campos)) {
                throw new Error('Invalid form structure');
            }

            return formData;
        } catch (error) {
            throw new Error(`Failed to parse form JSON: ${error.message}`);
        }
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }
}

// Global instance
window.AIFormBuilderService = new AIFormBuilderService();