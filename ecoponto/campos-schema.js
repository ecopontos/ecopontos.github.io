// Schema de campos do formulário de atendimento.
//
// Formato compatível com o "campos" (FormField[]) usado no formbuilder do
// ecoforms (desktop/mobile): { id, type, label, required, options, ... }.
// Se nada for injetado via configuração, usa o SCHEMA_PADRAO abaixo, que
// reproduz exatamente os campos hardcoded originais deste app.
(function (global) {
    'use strict';

    var CHAVE_LOCALSTORAGE = 'ecoforms_schema';

    var SCHEMA_PADRAO = {
        form_id: 'ecoponto_atendimento',
        titulo: 'Atendimento de Ecoponto',
        versao: 1,
        campos: [
            {
                id: 'placa',
                type: 'text',
                label: 'Placa do veículo',
                required: true,
                placeholder: 'ABC1D23',
                uppercase: true
            },
            {
                id: 'bairro',
                type: 'select',
                label: 'Bairro',
                required: true,
                placeholder: 'Digite para filtrar...',
                options: [
                    "Não Informado", "Abraão", "Agronômica", "Armação do Pântano do Sul", "Balneário", "Barra da Lagoa",
                    "Bom Abrigo", "Cachoeira do Bom Jesus", "Cacupé", "Campeche", "Canasvieiras",
                    "Canto", "Caieira", "Capoeiras", "Carianos",
                    "Carvoeira", "Centro", "Coloninha", "Coqueiros", "Córrego Grande",
                    "Costa de Dentro", "Costeira do Pirajubaé", "Daniela", "Estreito", "Ingleses", "Itacorubi", "Itaguaçu",
                    "Jardim Atlântico", "João Paulo", "José Mendes", "Jurerê", "Jurerê Internacional",
                    "Lagoa da Conceição", "Monte Cristo", "Monte Verde", "Morro das Pedras", "Pantanal", "Pântano do Sul",
                    "Ponta das Canas", "Praia Brava", "Ratones", "Ribeirão da Ilha", "Rio Tavares", "Saco dos Limões", "Saco Grande",
                    "Sambaqui", "Santa Mônica", "Santinho", "Santo Antônio de Lisboa", "Tapera", "Trindade",
                    "Vargem Pequena", "Vargem Grande", "Vargem do Bom Jesus", "Rio Vermelho", "Morro do 25", "Serrinha",
                    "Morro da Cruz", "Morro do Horácio", "Morro do Quilombo", "Monte Serrat", "Morro da Queimada"
                ]
            },
            {
                id: 'residuos',
                type: 'chips_multiple',
                label: 'Resíduos',
                required: false,
                options: [
                    "Amianto", "Animal", "Cápsula de Café", "Eletrônico", "Entulhos",
                    "Esponja", "Gesso", "Isopor", "Lâmpadas", "Livro/Revista",
                    "Madeiras", "Material de Escrita", "Óleo de Cozinha", "Orgânico",
                    "Pilhas/Baterias", "Pneus", "Podas", "Reciclável", "Roupas/Calçados",
                    "Sucata/Metal", "Vidros", "Volumosos"
                ]
            }
        ]
    };

    function schemaValido(schema) {
        return !!schema && Array.isArray(schema.campos) && schema.campos.length > 0 &&
            schema.campos.every(function (campo) {
                return campo && typeof campo.id === 'string' && campo.id.trim() !== '';
            });
    }

    // Lê o schema injetado após a instalação (localStorage, chave CHAVE_LOCALSTORAGE).
    // Se ausente ou inválido, cai no SCHEMA_PADRAO — o app continua funcionando
    // exatamente como antes até que um JSON válido seja injetado.
    function obterSchemaAtivo() {
        var bruto;
        try {
            bruto = localStorage.getItem(CHAVE_LOCALSTORAGE);
        } catch (e) {
            return SCHEMA_PADRAO;
        }

        if (!bruto) return SCHEMA_PADRAO;

        try {
            var schema = JSON.parse(bruto);
            return schemaValido(schema) ? schema : SCHEMA_PADRAO;
        } catch (e) {
            console.error('Schema de campos injetado é inválido, usando padrão embutido:', e);
            return SCHEMA_PADRAO;
        }
    }

    global.EcoformsSchema = {
        CHAVE_LOCALSTORAGE: CHAVE_LOCALSTORAGE,
        SCHEMA_PADRAO: SCHEMA_PADRAO,
        obterSchemaAtivo: obterSchemaAtivo
    };
})(window);
