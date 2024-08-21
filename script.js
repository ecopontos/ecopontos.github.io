// Inicializa o IndexedDB
var db;
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
            console.log("Banco de dados aberto com sucesso");
            db = event.target.result;
            carregarSelecaoEcoponto(); // Carregar seleção ao abrir o banco de dados
        };

   function adicionarAtendimento() {
    // Coletar dados dos campos
    var placa = document.getElementById("placa").value;
    var data = document.getElementById("data").value;
    var hora = document.getElementById("hora").value;
    var bairro = document.getElementById("bairro").value;
    var checkboxes = document.querySelectorAll('input[name="residuo"]:checked');

    // Verificar os valores
    console.log("Placa:", placa);
    console.log("Data:", data);
    console.log("Hora:", hora);
    console.log("Bairro:", bairro);
    console.log("Checkboxes selecionados:", checkboxes.length);
    console.log("Checkboxes valores:", Array.from(checkboxes).map(cb => cb.value));

    // Validação do formulário (excluindo o ecoponto)
    if (placa === "" || data === "" || hora === "" || bairro === "" || checkboxes.length === 0) {
        alert("Por favor, preencha todos os campos.");
        return; // Impede a execução do restante do código se algum campo estiver vazio
    }

    // Preparar dados para adicionar ao banco de dados
    var residuos = [];
    checkboxes.forEach(function(checkbox) {
        residuos.push(checkbox.value);
    });

    var newAtendimento = {
        ecoponto: localStorage.getItem('ecoponto') || "", // Usar o valor armazenado do ecoponto
        placa_veiculo: placa,
        data: data,
        hora: hora,
        residuo: residuos,
        bairro: bairro
    };

    // Adicionar atendimento ao banco de dados
    var transaction = db.transaction(["atendimentos"], "readwrite");
    var objectStore = transaction.objectStore("atendimentos");

    var request = objectStore.add(newAtendimento);

    request.onsuccess = function(event) {
        console.log("Atendimento adicionado com sucesso");

        // Limpar o formulário inteiro
        document.getElementById("formularioAtendimento").reset();
        // Recarregar o ecoponto do localStorage
        function carregarEcoponto() {
    var ecoponto = localStorage.getItem('ecoponto');
    if (ecoponto) {
        document.getElementById('ecoponto').value = ecoponto;
    } else {
        console.log("Ecoponto não encontrado no localStorage.");
    }
}

    request.onerror = function(event) {
        console.log("Erro ao adicionar atendimento:", event.target.errorCode);
    };
}
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

                var dataMaisRecente = data.reduce((max, atendimento) => atendimento.data > max ? atendimento.data : max, data[0].data);

                var csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Ecoponto,Placa,Data,Hora,Residuo,Bairro\n";

                data.forEach(function(atendimento) {
                    var linha = '"' + atendimento.ecoponto + '","' + atendimento.placa + '","' + atendimento.data + '","' + atendimento.hora + '","' + atendimento.residuo.join(", ") + '","' + atendimento.bairro + '"\n';
                    csvContent += linha;
                });

                var encodedUri = encodeURI(csvContent);
                var link = document.createElement("a");

                var nomeEcoponto = data[0] ? data[0].ecoponto : "ecoponto";
                var nomeArquivo = nomeEcoponto + "-" + dataMaisRecente + ".csv";

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
            criarCookie("ecopontoSelecionado", ecopontoSelecionado, 7); // O cookie expira em 7 dias
        }

        function preencherDataHora() {
            var dataAtual = new Date();
            document.getElementById("data").value = dataAtual.toISOString().split('T')[0];
            document.getElementById("hora").value = dataAtual.toTimeString().split(' ')[0].substring(0, 5);
        }

        window.onload = function() {
            carregarSelecaoEcoponto();
            preencherDataHora();
        };

// Impõe caixa alta para Placa
document.getElementById('placa').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
});

// Carrega as configurações do sistema
function carregarConfiguracoesPWA() {
    var ecoponto = localStorage.getItem('ecoponto');
    var nomeFuncionario = localStorage.getItem('nomeFuncionario');
    var matricula = localStorage.getItem('matricula');

    // Use esses valores conforme necessário no seu aplicativo
    console.log('Ecoponto:', ecoponto);
    console.log('Nome do Funcionário:', nomeFuncionario);
    console.log('Matrícula:', matricula);
}

// Chame a função quando necessário
carregarConfiguracoesPWA();

// Função para carregar o valor do Ecoponto do localStorage e definir no campo
function carregarEcoponto() {
    var ecoponto = localStorage.getItem('ecoponto');
    if (ecoponto) {
        document.getElementById('ecoponto').value = ecoponto;
    }
}

// Chame a função ao carregar a página
window.onload = function() {
    carregarEcoponto();
};
