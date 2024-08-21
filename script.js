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
    var transaction = db.transaction(["atendimentos"], "readwrite"); // Alterado para "readwrite"
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.getAll();

    request.onsuccess = function(event) {
        var data = event.target.result;
        if (data.length === 0) {
            alert("Nenhum atendimento encontrado para exportar.");
            return;
        }

        // Encontrar a data mais recente no campo "data"
        var dataMaisRecente = data.reduce((max, atendimento) => atendimento.data > max ? atendimento.data : max, data[0].data);

        var csvContent = "data:text/csv;charset=utf-8,";

        // Cabeçalhos CSV
        csvContent += "Ecoponto,Placa do Veículo,Data,Hora,Tipo de Resíduo,Bairro\n";

        // Adicionar dados ao CSV
        data.forEach(function(atendimento) {
            var linha = '"' + atendimento.ecoponto + '","' + atendimento.placa_veiculo + '","' + atendimento.data + '","' + atendimento.hora + '","' + atendimento.tipo_residuo.join(", ") + '","' + atendimento.bairro + '"\n';
            csvContent += linha;
        });

        // Criar um link para download do CSV
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");

        // Nome do arquivo com base no nome do Ecoponto e data mais recente
        var nomeEcoponto = data[0] ? data[0].ecoponto : "ecoponto";
        var nomeArquivo = nomeEcoponto + "-" + dataMaisRecente + ".csv";

        link.setAttribute("href", encodedUri);
        link.setAttribute("download", nomeArquivo);
        document.body.appendChild(link);

        // Evento para limpar banco de dados após a exportação
        link.addEventListener("click", function() {
            // Limpar o banco de dados dentro do evento click
            var deleteTransaction = db.transaction(["atendimentos"], "readwrite"); // Alterado para "readwrite"
            var deleteObjectStore = deleteTransaction.objectStore("atendimentos");
            var deleteRequest = deleteObjectStore.clear();

            deleteRequest.onsuccess = function() {
                console.log("Banco de dados limpo após exportação.");
            };

            deleteRequest.onerror = function(event) {
                console.error("Erro ao limpar banco de dados:", event.target.error);
            };
        });

        // Clicar no link para iniciar o download
        link.click();
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

// Função para preencher data e hora com a informação do sistema
function preencherDataHora() {
    var dataAtual = new Date();
    var dataFormatada = dataAtual.toISOString().split('T')[0]; // Formato de data (YYYY-MM-DD)
    var horaFormatada = dataAtual.toTimeString().split(' ')[0]; // Formato de hora (HH:MM:SS)

    document.getElementById('data').value = dataFormatada;
    document.getElementById('hora').value = horaFormatada;
}

// Função para carregar a seleção anterior do Ecoponto
function carregarSelecaoEcoponto() {
    var ecopontoSelecionado = localStorage.getItem('ecopontoSelecionado');
    if (ecopontoSelecionado) {
        document.getElementById('ecoponto').value = ecopontoSelecionado;
    }
}

// Função para salvar a seleção do Ecoponto no localStorage
function salvarSelecaoEcoponto() {
    var ecoponto = document.getElementById('ecoponto').value;
    localStorage.setItem('ecopontoSelecionado', ecoponto);
}

// Preenche a data e hora e carrega a seleção do Ecoponto ao carregar a página
window.onload = function() {
    preencherDataHora();
    carregarSelecaoEcoponto();
};

// Listener para salvar a seleção do Ecoponto ao alterar o dropdown
document.getElementById('ecoponto').addEventListener('change', salvarSelecaoEcoponto);

// Listener para salvar a seleção do Ecoponto ao enviar o formulário
document.getElementById('meuFormulario').addEventListener('submit', function(event) {
    salvarSelecaoEcoponto();
    // Aqui você pode adicionar código para enviar o formulário via AJAX ou similar
});
