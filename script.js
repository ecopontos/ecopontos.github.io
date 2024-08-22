var db;

function inicializarBancoDeDados() {
    var request = indexedDB.open("ecoponto", 1);

    request.onerror = function(event) {
        console.log("Erro ao abrir o banco de dados:", event.target.errorCode);
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        var objectStore = db.createObjectStore("atendimentos", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("ecoponto", "ecoponto", { unique: false });
        objectStore.createIndex("placa", "placa", { unique: false });
        objectStore.createIndex("data", "data", { unique: false });
        objectStore.createIndex("hora", "hora", { unique: false });
        objectStore.createIndex("residuo", "residuo", { unique: false });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Banco de dados aberto com sucesso");
        carregarSelecaoEcoponto();
    };
}
// Adiciona um atendimento ao banco de dados
function adicionarAtendimento() {
    var placa = document.getElementById("placa").value;
    var data = document.getElementById("data").value;
    var hora = document.getElementById("hora").value;
    var bairro = document.getElementById("bairro").value;
    var checkboxes = document.querySelectorAll('input[name="residuo"]:checked');

    var ecoponto = localStorage.getItem('ecoponto') || ""; // Usar uma string vazia se não houver valor

   if (placa === "" || data === "" || hora === "" || bairro === "") {
   alert("Por favor, preencha todos os campos obrigatórios.");
    return;
    }

    var residuos = [];
    checkboxes.forEach(function(checkbox) {
        residuos.push(checkbox.value);
    });

    var newAtendimento = {
    ecoponto: ecoponto,
    placa: placa,  
    data: data,
    hora: hora,
    residuo: residuos,
    bairro: bairro
};


    var transaction = db.transaction(["atendimentos"], "readwrite");
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.add(newAtendimento);

    request.onsuccess = function(event) {
        console.log("Atendimento adicionado com sucesso");
        document.getElementById("form-atendimento").reset();
        carregarEcoponto();
    };

    request.onerror = function(event) {
        console.log("Erro ao adicionar atendimento:", event.target.errorCode);
    };
}

// Exporta dados para CSV
function exportarParaCSV() {
    var transaction = db.transaction(["atendimentos"], "readwrite");
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.getAll();

    request.onsuccess = function(event) {
        var data = event.target.result;
        if (data.length === 0) {
            alert("Nenhum atendimento encontrado para exportar.");
            return;
        }

        var atendimentoMaisRecente = data.reduce((maisRecente, atendimento) => {
            if (atendimento.data > maisRecente.data || (atendimento.data === maisRecente.data && atendimento.hora > maisRecente.hora)) {
                return atendimento;
            }
            return maisRecente;
        }, data[0]);

        var dataMaisRecente = atendimentoMaisRecente.data;
        var horaMaisRecente = atendimentoMaisRecente.hora.replace(/:/g, '-');

        var csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Ecoponto,Placa,Data,Hora,Residuo,Bairro\n";

       data.forEach(function(atendimento) {
    var residuos = Array.isArray(atendimento.residuo) ? atendimento.residuo.join(", ") : atendimento.residuo;
    var linha = '"' + atendimento.ecoponto + '","' + atendimento.placa + '","' + atendimento.data + '","' + atendimento.hora + '","' + residuos + '","' + atendimento.bairro + '"\n';
    csvContent += linha;
});      

        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");

        var nomeEcoponto = localStorage.getItem('ecoponto') || "ecoponto";
        var nomeArquivo = `${nomeEcoponto}-${dataMaisRecente}-${horaMaisRecente}.csv`;

        link.setAttribute("href", encodedUri);
        link.setAttribute("download", nomeArquivo);
        document.body.appendChild(link);

        link.addEventListener("click", function() {
            var deleteTransaction = db.transaction(["atendimentos"], "readwrite");
            var deleteObjectStore = deleteTransaction.objectStore("atendimentos");
            var deleteRequest = deleteObjectStore.clear();

            deleteRequest.onsuccess = function() {
                console.log("Banco de dados limpo após exportação.");
            };

            deleteRequest.onerror = function(event) {
                console.error("Erro ao limpar banco de dados:", event.target.error);
            };
        });

        link.click();
    };
}

// Funções de manipulação de cookies
function criarCookie(nome, valor, dias) {
    var data = new Date();
    data.setTime(data.getTime() + (dias * 24 * 60 * 60 * 1000));
    var expires = "expires=" + data.toUTCString();
    document.cookie = nome + "=" + valor + ";" + expires + ";path=/";
}

function lerCookie(nome) {
    var nomeEQ = nome + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nomeEQ) === 0) return c.substring(nomeEQ.length, c.length);
    }
    return null;
}

function apagarCookie(nome) {
    document.cookie = nome + '=; Max-Age=-99999999;';
}

// Carrega as configurações e seleção de ecoponto
function carregarSelecaoEcoponto() {
    var ecopontoSelecionado = lerCookie("ecopontoSelecionado");
    if (ecopontoSelecionado) {
        document.getElementById("ecoponto").value = ecopontoSelecionado;
    }
}

function salvarSelecaoEcoponto() {
    var ecopontoSelecionado = document.getElementById("ecoponto").value;
    criarCookie("ecopontoSelecionado", ecopontoSelecionado, 7);
}

function preencherDataHora() {
    var dataAtual = new Date();
    document.getElementById("data").value = dataAtual.toISOString().split('T')[0];
    document.getElementById("hora").value = dataAtual.toTimeString().split(' ')[0].substring(0, 5);
}

function carregarConfiguracoesPWA() {
    var ecoponto = localStorage.getItem('ecoponto');
    var nomeFuncionario = localStorage.getItem('nomeFuncionario');
    var matricula = localStorage.getItem('matricula');

    console.log('Ecoponto:', ecoponto);
    console.log('Nome do Funcionário:', nomeFuncionario);
    console.log('Matrícula:', matricula);
}

// Carrega o valor do Ecoponto do localStorage e define no campo
function carregarEcoponto() {
    var ecoponto = localStorage.getItem('ecoponto');
    if (ecoponto) {
        document.getElementById('ecoponto').value = ecoponto;
    }
}

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    inicializarBancoDeDados();
    carregarSelecaoEcoponto();
    preencherDataHora();
    carregarConfiguracoesPWA();

    var ecopontoElement = document.getElementById('ecoponto');
    if (ecopontoElement) {
        carregarEcoponto(); // Certifique-se de que o elemento existe antes de chamar a função
        ecopontoElement.addEventListener('change', salvarSelecaoEcoponto);
    }

    document.getElementById('placa').addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
});

// Exibe Registros no Banco de Dados
function visualizarAtendimentos() {
    var transaction = db.transaction(["atendimentos"], "readonly");
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.getAll();

    request.onsuccess = function(event) {
        var data = event.target.result;
        var table = document.getElementById("tabela-atendimentos");
        table.innerHTML = ""; // Limpa o conteúdo anterior da tabela

        if (data.length > 0) {
            data.forEach(function(atendimento) {
                var row = table.insertRow();
                row.insertCell(0).textContent = atendimento.ecoponto;
                row.insertCell(1).textContent = atendimento.placa;
                row.insertCell(2).textContent = atendimento.data;
                row.insertCell(3).textContent = atendimento.hora;
                row.insertCell(4).textContent = atendimento.residuo.join(", ");
                row.insertCell(5).textContent = atendimento.bairro;
            });
        } else {
            var row = table.insertRow();
            var cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = "Nenhum atendimento encontrado.";
        }
    };

    request.onerror = function(event) {
        console.error("Erro ao visualizar atendimentos:", event.target.errorCode);
    };
}

// Chamando a função quando necessário
visualizarAtendimentos();
