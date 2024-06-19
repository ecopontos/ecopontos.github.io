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
        objectStore.createIndex("funcionario", "funcionario", { unique: false });
        objectStore.createIndex("periodo", "periodo", { unique: false });
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

    var data = document.getElementById("data").value;
    var funcionario = document.getElementById("funcionario").value;
    var periodo = document.getElementById("periodo").value;
    var ocorrencias = [];

    var divs = document.querySelectorAll(".ocorrencia");

    for (var i = 0; i < divs.length; i++) {
        var select = divs[i].querySelector("select");
        var selectedOption = select.options[select.selectedIndex];
        var time = divs[i].querySelector("input[type='time']");
        var textarea = divs[i].querySelector("textarea");

        if (selectedOption.value !== "" && time.value !== "" && textarea.value !== "") {
            var ocorrencia = {
                tipo: selectedOption.text,
                hora: time.value,
                observacao: textarea.value
            };

            ocorrencias.push(ocorrencia);

            select.selectedIndex = 0;
            time.value = "";
            textarea.value = "";
        }

        location.reload();
    }

    if (ocorrencias.length > 0) {
        var dados = {
            data: data,
            funcionario: funcionario,
            periodo: periodo,
            ocorrencias: ocorrencias
        };

        salvarDadosNoBanco(dados);

        alert("Dados enviados com sucesso!");

        document.getElementById("data").value = "";
        document.getElementById("funcionario").value = "";
        document.getElementById("periodo").value = "";

        divs.forEach(function(div) {
            var select = div.querySelector("select");
            var time = div.querySelector("input[type='time']");
            var textarea = div.querySelector("textarea");

            select.selectedIndex = 0;
            time.value = "";
            textarea.value = "";
        });
    } else {
        alert("Por favor, preencha pelo menos uma ocorrência antes de enviar.");
    }
}

function exportarCSVPorData() {
    var dataSelecionada = document.getElementById("data").value;

    if (dataSelecionada) {
        var transaction = db.transaction(["checklist"], "readonly");
        var objectStore = transaction.objectStore("checklist");
        var index = objectStore.index("data");
        var range = IDBKeyRange.only(dataSelecionada);

        var registros = [];

        index.openCursor(range).onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                registros.push(cursor.value);
                cursor.continue();
            } else {
                if (registros.length > 0) {
                    gerarCSV(registros, dataSelecionada);
                } else {
                    alert("Nenhum registro encontrado para a data selecionada.");
                }
            }
        };
    } else {
        alert("Por favor, selecione uma data para exportar.");
    }
}

function gerarCSV(registros, dataSelecionada) {
    var csvContent = "data:text/csv;charset=utf-8,";

    // Cabeçalhos dos campos
    var headers = [
        "Data",
        "Funcionário",
        "Período",
        "Tipo de Ocorrência",
        "Hora",
        "Observação"
    ];

    csvContent += headers.join(",") + "\r\n";

    registros.forEach(function(registro) {
        registro.ocorrencias.forEach(function(ocorrencia) {
            var row = [
                registro.data,
                registro.funcionario,
                registro.periodo,
                ocorrencia.tipo,
                ocorrencia.hora,
                ocorrencia.observacao.replace(/[\r\n]/g, " ")  // Remover quebras de linha do campo de observação
            ].join(",");

            csvContent += row + "\r\n";
        });
    });

    var formattedDate = dataSelecionada.replace(/[\s/:]+/g, '_');
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "checklist_" + formattedDate + ".csv"); // Nome do arquivo com a data
    document.body.appendChild(link);

    link.click();
}

window.onload = function() {
    abrirBancoDeDados();
};


function atualizarPlaceholder(opcaoSelecionada, idObservacao) {
    let placeholder = '';

    switch (opcaoSelecionada) {
        case '1':
            placeholder = 'Descreva detalhes sobre o acidente ocorrido.';
            break;
        case '2':
            placeholder = 'Explique a situação da ausência do supervisor.';
            break;
       
        case '13':
            placeholder = 'Informe o nome, a função desempenhada e quais EPI faltantes';
            break;


	 case '21':
            placeholder = 'Informe o nome e a função desempenhada por ele no dia ';
            break;


        // Adicione mais casos conforme necessário para cada opção de ocorrência
        default:

            placeholder = 'Observação';
            break;
    }

    document.getElementById(idObservacao).setAttribute('placeholder', placeholder);
}

