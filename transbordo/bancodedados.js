// bancodedados.js

var db;

function abrirBancoDeDados() {
    var request = window.indexedDB.open("ChecklistDB", 1);

    request.onerror = function(event) {
        console.log("Erro ao abrir o banco de dados.");
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        var objectStore = db.createObjectStore("checklist", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("data", "data", { unique: false });
        objectStore.createIndex("horaInicial", "horaInicial", { unique: false });
        objectStore.createIndex("horaFinal", "horaFinal", { unique: false });
        objectStore.createIndex("funcionario", "funcionario", { unique: false });
        objectStore.createIndex("ocorrencias", "ocorrencias", { unique: false });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Banco de dados aberto com sucesso.");
    };
}

function salvarDadosNoBanco(dados) {
    var transaction = db.transaction(["checklist"], "readwrite");
    var objectStore = transaction.objectStore("checklist");

    var request = objectStore.add(dados);

    request.onsuccess = function(event) {
        console.log("Dados armazenados com sucesso.");
    };

    request.onerror = function(event) {
        console.log("Erro ao armazenar os dados.");
    };
}

function enviarDados(event) {
    event.preventDefault();

    // Salvar os dados no banco de dados
    var data = document.getElementById("data").value;
    var horaInicial = document.getElementById("horaInicial").value;
    var horaFinal = document.getElementById("horaFinal").value;
    var funcionario = document.getElementById("funcionario").value;
    var ocorrencias = [];

    var trs = document.querySelectorAll("table tr");

    for (var i = 0; i < trs.length; i++) {
        var select = trs[i].querySelector("select");
        var time = trs[i].querySelector("input[type='time']");
        var textarea = trs[i].querySelector("textarea");

        var ocorrencia = {
            tipo: select.value,
            hora: time.value,
            observacao: textarea.value
        };

        ocorrencias.push(ocorrencia);
    }

    var dados = {
        data: data,
        horaInicial: horaInicial,
        horaFinal: horaFinal,
        funcionario: funcionario,
        ocorrencias: ocorrencias
    };

    salvarDadosNoBanco(dados);

    // Gerar o arquivo CSV cumulativo
    gerarCSV();
}
