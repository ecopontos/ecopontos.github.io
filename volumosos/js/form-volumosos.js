// Formulário de agendamento de volumosos, instalado junto com o app.
//
// Campos e regras seguem a página do serviço da Prefeitura de Florianópolis
// (SMMA — "Agendamento para remoção de resíduos volumosos"): nome completo,
// endereço com CEP, CPF, telefone, e-mail opcional e descrição dos resíduos e
// quantidades; limite de 1 m³ por residência.
//
// Origem: seed `form-agendamento-volumosos` do desktop
// (desktop/scripts/ensure-columns.ts), com `vagas_solicitadas` (que guardava m³)
// renomeado para `quantidade` e `tipo_residuo` como múltipla escolha.
//
// Tipos de campo com validação própria em regras.js: cpf, cep, email, number (min/max).

export const FORM_VOLUMOSOS = {
    id: 'form-agendamento-volumosos',
    versao: 2,
    titulo: 'Agendamento — Coleta de Volumosos',
    campos: [
        { id: 'cliente_nome', type: 'text', label: 'Nome completo', required: true, autocomplete: 'name' },
        { id: 'cliente_id', type: 'cpf', label: 'CPF', required: true, inputmode: 'numeric' },
        { id: 'telefone', type: 'tel', label: 'Telefone para contato', required: true, autocomplete: 'tel' },
        { id: 'email', type: 'email', label: 'E-mail', required: false, autocomplete: 'email' },
        { id: 'cep', type: 'cep', label: 'CEP', required: true, inputmode: 'numeric' },
        { id: 'endereco', type: 'text', label: 'Endereço (rua, número, complemento)', required: true, autocomplete: 'street-address' },
        { id: 'bairro', type: 'bairro', label: 'Bairro', required: true },
        {
            id: 'tipo_residuo', type: 'checkboxes', label: 'Tipo de resíduo', required: true,
            options: [
                'Móveis',
                'Eletrodomésticos',
                'Restos de construção (pequena quantidade, ensacados)',
                'Latas e pneus',
                'Madeiras (separadas de outros materiais)',
            ],
            ajuda: 'Podas não entram: devem ir para a coleta seletiva de verdes.',
        },
        { id: 'descricao', type: 'textarea', label: 'Descrição dos resíduos e quantidades', required: true },
        {
            id: 'quantidade', type: 'number', label: 'Volume estimado (m³)', required: true,
            min: 0.1, max: 1, step: 0.1, valor_padrao: 1,
            ajuda: 'Máximo de 1 m³ por residência — mais ou menos uma caixa d’água de 1.000 litros.',
        },
        { id: 'observacoes', type: 'textarea', label: 'Observações internas (referência, acesso…)', required: false },
    ],
    // Imagens são aceitas (o cidadão pode mandá-las pelo WhatsApp), mas não obrigatórias.
    fotos: { min: 0, max: 5 },
};

/** Orientações repassadas ao cidadão na confirmação. */
export const ORIENTACOES_CIDADAO = [
    'Coloque os resíduos na rua somente na data agendada.',
    'Limite de 1 m³ por residência (cerca de uma caixa d’água de 1.000 litros).',
    'Restos de construção: pequenas quantidades e ensacados. Madeiras separadas de outros materiais.',
    'Podas não são recolhidas nesta coleta: destine à coleta seletiva de verdes.',
];
