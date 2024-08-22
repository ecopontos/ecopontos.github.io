document.addEventListener('DOMContentLoaded', function() {
    // Função para criar e adicionar os checkboxes dos resíduos
    function criarCheckBoxesResiduos() {
        const residuos = [
            "Amianto", "Animal", "Cápsula de Café", "Eletrônico", "Entulhos",
            "Esponja", "Gesso", "Isopor", "Lâmpadas", "Livro/Revista",
            "Madeiras", "Material de Escrita", "Óleo de Cozinha", "Orgânico",
            "Pilhas/Baterias", "Pneus", "Podas", "Reciclável", "Roupas/Calçados",
            "Sucata/Metal", "Vidros", "Volumosos"
        ];

        const container = document.getElementById('residuos-container');

        residuos.forEach(residuo => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = residuo.toLowerCase().replace(/ /g, '_');
            checkbox.name = 'tipo_residuo';
            checkbox.value = residuo;

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = residuo;

            container.appendChild(checkbox);
            container.appendChild(label);
            container.appendChild(document.createElement('br'));
        });
    }

    // Função para salvar a seleção dos resíduos
    function salvarSelecaoResiduos() {
        const selecionados = [];
        document.querySelectorAll('#residuos-container input[type="checkbox"]:checked').forEach(checkbox => {
            selecionados.push(checkbox.value);
        });

        // Aqui você pode fazer o que desejar com os resíduos selecionados
        // Por exemplo, armazená-los em um cookie, localStorage, ou incluir no CSV
        console.log(selecionados);
    }

    // Cria os checkboxes quando o DOM estiver pronto
    criarCheckBoxesResiduos();

    // Adiciona event listener ao botão de enviar
    document.getElementById('adicionar').addEventListener('click', salvarSelecaoResiduos);

    // Adiciona event listener para exportar dados
    document.getElementById('exportar').addEventListener('click', function() {
        // Aqui você pode chamar uma função para exportar os dados em CSV
    });
});


var db;

function inicializarBancoDeDados() {
    return new Promise((resolve, reject) => {
        var request = indexedDB.open("nomeDoBanco", 1);

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            if (!db.objectStoreNames.contains("atendimentos")) {
                var objectStore = db.createObjectStore("atendimentos", { keyPath: "id", autoIncrement: true });
                objectStore.createIndex("ecoponto", "ecoponto", { unique: false });
                objectStore.createIndex("placa", "placa", { unique: false });
                objectStore.createIndex("data", "data", { unique: false });
                objectStore.createIndex("hora", "hora", { unique: false });
                objectStore.createIndex("residuo", "residuo", { unique: false });
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("Banco de dados aberto com sucesso");
            resolve();
        };

        request.onerror = function(event) {
            console.error("Erro ao abrir o banco de dados:", event.target.error);
            reject(event.target.error);
        };
    });
}

function visualizarAtendimentos() {
    if (!db) {
        console.error("Banco de dados não está disponível.");
        return;
    }

    var transaction = db.transaction(["atendimentos"], "readonly");
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.getAll();

    request.onsuccess = function(event) {
        var data = event.target.result;
        console.log("Dados para visualização:", data);
        // Continue com a lógica para visualizar os atendimentos
    };

    request.onerror = function(event) {
        console.error("Erro ao obter dados:", event.target.error);
    };
}

function adicionarAtendimento() {
    var placa = document.getElementById("placa").value;
    var data = document.getElementById("data").value;
    var hora = document.getElementById("hora").value;
    var bairro = document.getElementById("bairro").value;
    var checkboxes = document.querySelectorAll('input[name="residuo"]:checked');

    var ecoponto = localStorage.getItem('ecoponto') || "";

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

function exportarParaCSV() {
    var transaction = db.transaction(["atendimentos"], "readonly");
    var objectStore = transaction.objectStore("atendimentos");
    var request = objectStore.getAll();

    request.onsuccess = function(event) {
        var data = event.target.result;
        if (data.length === 0) {
            alert("Nenhum atendimento encontrado para exportar.");
            return;
        }

        console.log("Dados para exportação:", data);

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

    request.onerror = function(event) {
        console.error("Erro ao obter dados para exportação:", event.target.error);
    };
}

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

function carregarEcoponto() {
    var ecoponto = localStorage.getItem('ecoponto');
    if (ecoponto) {
        document.getElementById('ecoponto').value = ecoponto;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    inicializarBancoDeDados().then(() => {
        visualizarAtendimentos();
        carregarConfiguracoesPWA();
        preencherDataHora();
    }).catch((error) => {
        console.error("Erro ao inicializar o banco de dados:", error);
    });

    document.getElementById("adicionar").addEventListener("click", adicionarAtendimento);
    document.getElementById("exportar").addEventListener("click", exportarParaCSV);
    document.getElementById("ecoponto").addEventListener("change", salvarSelecaoEcoponto);
    carregarSelecaoEcoponto();
});
