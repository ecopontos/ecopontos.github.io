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
            objectStore.createIndex("placa_veiculo", "placa_veiculo", { unique: false });
            objectStore.createIndex("data", "data", { unique: false });
            objectStore.createIndex("hora", "hora", { unique: false });
            objectStore.createIndex("tipo_residuo", "tipo_residuo", { unique: false });
            objectStore.createIndex("bairro", "bairro", { unique: false });
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("Banco de dados aberto com sucesso");
        };

        // Função para adicionar atendimento
        function adicionarAtendimento() {
            var ecoponto = document.getElementById("ecoponto").value;
            var placaVeiculo = document.getElementById("placa_veiculo").value;
            var data = document.getElementById("data").value;
            var hora = document.getElementById("hora").value;
            var bairro = document.getElementById("bairro").value;
            var checkboxes = document.querySelectorAll('input[name="tipo_residuo"]:checked');

            if (ecoponto === "" || placaVeiculo === "" || data === "" || hora === "" || bairro === "" || checkboxes.length === 0) {
                alert("Por favor, preencha todos os campos.");
                return;
            }

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

            var transaction = db.transaction(["atendimentos"], "readwrite");
            var objectStore = transaction.objectStore("atendimentos");

            var request = objectStore.add(newAtendimento);

            request.onsuccess = function(event) {
                console.log("Atendimento adicionado com sucesso");
                document.getElementById("meuFormulario").reset();
                preencherDataHora();
            };

            request.onerror = function(event) {
                console.log("Erro ao adicionar atendimento:", event.target.errorCode);
            };
        }

        // Função para exportar dados para CSV e limpar banco de dados
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

                var dataMaisRecente = data.reduce((max, atendimento) => atendimento.data > max ? atendimento.data : max, data[0].data);

                var csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "Ecoponto,Placa do Veículo,Data,Hora,Tipo de Resíduo,Bairro\n";
                data.forEach(function(atendimento) {
                    var linha = '"' + atendimento.ecoponto + '","' + atendimento.placa_veiculo + '","' + atendimento.data + '","' + atendimento.hora + '","' + atendimento.tipo_residuo.join(", ") + '","' + atendimento.bairro + '"\n';
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

            request.onerror = function(event) {
                console.error("Erro ao buscar dados para exportação:", event.target.error);
            };
        }

        // Função para preencher data e hora com a informação do sistema
        function preencherDataHora() {
            var dataAtual = new Date();
            var dataFormatada = dataAtual.toISOString().split('T')[0];
            var horaFormatada = dataAtual.toTimeString().split(' ')[0];

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
            event.preventDefault(); // Evita o envio padrão do formulário
            adicionarAtendimento(); // Adiciona o atendimento
        });
