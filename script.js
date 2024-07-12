var db;
var request = indexedDB.open("ecoponto", 1);

request.onerror = function(event) {
    console.log("Erro ao abrir o banco de dados:", event.target.errorCode);
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    var objectStore = db.createObjectStore("atendimentos", { keyPath: "id", autoIncrement: true });
    objectStore.createIndex("ecoponto", "ecoponto", { unique: false });
    objectStore.createIndex("placa_veiculo", "placa_veiculo", { unique: false });
    objectStore.createIndex("data", "data", { unique: false });
    objectStore.createIndex("hora", "hora", { unique: false });
    objectStore.createIndex("tipo_residuo", "tipo_residuo", { unique: false });
};

request.onsuccess = function(event) {
    console.log("Banco de dados aberto com sucesso");
    db = event.target.result;
};

function adicionarAtendimento() {
    // Validação do formulário
    var ecoponto = document.getElementById("ecoponto").value;
    var placaVeiculo = document.getElementById("placa_veiculo").value;
    var data = document.getElementById("data").value;
    var hora = document.getElementById("hora").value;
    var bairro = document.getElementById("bairro").value;
    var checkboxes = document.querySelectorAll('input[name="tipo_residuo"]:checked');

    if (ecoponto === "" || placaVeiculo === "" || data === "" || hora === "" || bairro === "" || checkboxes.length === 0) {
        alert("Por favor, preencha todos os campos.");
        return; // Impede a execução do restante do código se algum campo estiver vazio
    }

    // Preparar dados para adicionar ao banco de dados
    var tipoResiduo = [];
    checkboxes.forEach(function(checkbox) {
        tipoResiduo.push(checkbox.value);
    });

    var newAtendimento = {
        ecoponto: ecoponto,
        placa_veiculo: placaVeiculo,
        data: data,
        hora: hora,
        tipo_residuo: tipoResiduo,
        bairro: bairro
    };

    // Adicionar atendimento ao banco de dados
    var transaction = db.transaction(["atendimentos"], "readwrite");
    var objectStore = transaction.objectStore("atendimentos");

    var request = objectStore.add(newAtendimento);

    request.onsuccess = function(event) {
        console.log("Atendimento adicionado com sucesso");
        document.getElementById("form-atendimento").reset();
    };

    request.onerror = function(event) {
        console.log("Erro ao adicionar atendimento:", event.target.errorCode);
    };
}

      // Função para exportar para CSV e limpar banco de dados após exportação
function exportarParaCSV() {
    // ... código para gerar o CSV ...

    // Criar um link para download do CSV
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");

    // Nome do arquivo com base no nome do Ecoponto e data mais recente
    var nomeEcoponto = data[0].ecoponto; // Supondo que todos os registros são do mesmo Ecoponto
    var nomeArquivo = nomeEcoponto + "-" + dataMaisRecente + ".csv"; // Concatena o nome do Ecoponto com a data mais recente

    link.setAttribute("href", encodedUri);
    link.setAttribute("download", nomeArquivo);
    document.body.appendChild(link);

    // Clicar no link para iniciar o download
    link.click();

    // Evento para limpar banco de dados após a exportação
    link.addEventListener("click", function() {
        limparBancoDeDados();
    });
}

function limparBancoDeDados() {
    var transaction = db.transaction(["atendimentos"], "readwrite");
    var objectStore = transaction.objectStore("atendimentos");
    var clearRequest = objectStore.clear();

    clearRequest.onsuccess = function(event) {
        console.log("Registros removidos do banco de dados após exportação para CSV.");
    };

    clearRequest.onerror = function(event) {
        console.error("Erro ao limpar registros do banco de dados:", event.target.error);
    };
}

// Registro do Service Worker
if (typeof navigator.serviceWorker !== 'undefined') {
    navigator.serviceWorker.register('service-worker.js')
        .then(function(registration) {
            console.log('Service Worker registrado com sucesso:', registration);
        })
        .catch(function(error) {
            console.error('Falha ao registrar Service Worker:', error);
        });
}

// Captura a data atual
var dataAtual = new Date();
var dataFormatada = dataAtual.toISOString().split('T')[0]; // Formata para o formato de data HTML5 (YYYY-MM-DD)

// Captura a hora atual
var horaAtual = dataAtual.toTimeString().split(' ')[0]; // Formata para o formato de hora (HH:MM:SS)

// Verifica se existem valores armazenados no localStorage
var dataArmazenada = localStorage.getItem('dataAtual');
var horaArmazenada = localStorage.getItem('horaAtual');

// Se houver valores armazenados, utiliza esses valores ao invés da data atual
if (dataArmazenada && horaArmazenada) {
    dataFormatada = dataArmazenada;
    horaAtual = horaArmazenada;
}

// Preenche o campo de data com a data atual ou com o valor armazenado
document.getElementById('data').value = dataFormatada;

// Preenche o campo de hora com a hora atual ou com o valor armazenado
document.getElementById('hora').value = horaAtual;

// Armazena os valores atuais no localStorage para persistência
localStorage.setItem('dataAtual', dataFormatada);
localStorage.setItem('horaAtual', horaAtual);
