// Função para carregar as configurações do localStorage
function carregarConfiguracao() {
    var ecoponto = localStorage.getItem('beta_ecoponto');
    var nomeFuncionario = localStorage.getItem('beta_nomeFuncionario');
    var matricula = localStorage.getItem('beta_matricula');
    var sheetsUrl = localStorage.getItem('beta_sheetsUrl');

    if (ecoponto) document.getElementById('ecoponto').value = ecoponto;
    if (nomeFuncionario) document.getElementById('nomeFuncionario').value = nomeFuncionario;
    if (matricula) document.getElementById('matricula').value = matricula;
    if (sheetsUrl) document.getElementById('sheetsUrl').value = sheetsUrl;

    var schemaBruto = localStorage.getItem(EcoformsSchema.CHAVE_LOCALSTORAGE);
    var campoSchema = document.getElementById('camposSchema');
    if (schemaBruto && campoSchema) {
        campoSchema.value = formatarJsonLegivel(schemaBruto);
    }
}

function formatarJsonLegivel(bruto) {
    try {
        return JSON.stringify(JSON.parse(bruto), null, 2);
    } catch (e) {
        return bruto;
    }
}

// Grava o schema de campos injetado (ou remove, restaurando o padrão, se o
// campo for deixado em branco). Retorna true se pôde prosseguir com o
// restante do salvamento, false se o JSON é inválido e o usuário precisa corrigir.
function salvarSchemaCampos() {
    var campoSchema = document.getElementById('camposSchema');
    var erroEl = document.getElementById('camposSchemaErro');
    if (!campoSchema) return true;

    var texto = campoSchema.value.trim();
    if (erroEl) erroEl.textContent = '';

    if (texto === '') {
        localStorage.removeItem(EcoformsSchema.CHAVE_LOCALSTORAGE);
        return true;
    }

    try {
        var schema = JSON.parse(texto);
        if (!schema || !Array.isArray(schema.campos) || schema.campos.length === 0) {
            throw new Error('o JSON precisa ter uma lista "campos" com ao menos um item');
        }
        var idsInvalidos = schema.campos.some(function (c) { return !c || typeof c.id !== 'string' || c.id.trim() === ''; });
        if (idsInvalidos) {
            throw new Error('todo campo precisa de um "id" (texto não vazio)');
        }
        localStorage.setItem(EcoformsSchema.CHAVE_LOCALSTORAGE, JSON.stringify(schema));
        return true;
    } catch (e) {
        if (erroEl) erroEl.textContent = 'JSON de campos inválido (' + e.message + '). Os campos do formulário continuam com o valor anterior.';
        return false;
    }
}

function salvarConfiguracao() {
    var schemaOk = salvarSchemaCampos();

    const ecoponto = document.getElementById('ecoponto');
    const ecopontoValor = ecoponto.value;
    const nomeEcoponto = ecoponto.selectedOptions[0].text;
    const nomeFuncionario = document.getElementById('nomeFuncionario').value;
    const matricula = document.getElementById('matricula').value;
    const sheetsUrl = document.getElementById('sheetsUrl').value.trim();

    localStorage.setItem('beta_ecoponto', ecopontoValor);
    localStorage.setItem('beta_nomeEcoponto', nomeEcoponto);
    localStorage.setItem('beta_nomeFuncionario', nomeFuncionario);
    localStorage.setItem('beta_matricula', matricula);
    localStorage.setItem('beta_sheetsUrl', sheetsUrl);

    alert(schemaOk ? 'Configurações salvas com sucesso!' : 'Demais configurações salvas, mas o JSON de campos é inválido — veja o erro acima.');
}

function restaurarCamposPadrao() {
    localStorage.removeItem(EcoformsSchema.CHAVE_LOCALSTORAGE);
    var campoSchema = document.getElementById('camposSchema');
    var erroEl = document.getElementById('camposSchemaErro');
    if (campoSchema) campoSchema.value = '';
    if (erroEl) erroEl.textContent = '';
    alert('Campos restaurados para o padrão (Placa, Bairro, Resíduos).');
}

// Carregar configurações ao carregar a página
window.onload = function() {
    carregarConfiguracao();
};
