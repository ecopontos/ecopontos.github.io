// Função para criar e adicionar os checkboxes dos bairros
document.addEventListener('DOMContentLoaded', function() {
    const bairros = [
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
    ];

    const bairroSelect = document.getElementById('bairro');
    bairros.forEach(bairro => {
        const option = document.createElement('option');
        option.value = bairro;
        option.textContent = bairro;
        bairroSelect.appendChild(option);
    });

    // Restante do código para resíduos e banco de dados
});

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
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'checkbox-container';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = residuo.toLowerCase().replace(/ /g, '_');
        checkbox.name = 'tipo_residuo';
        checkbox.value = residuo;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = residuo;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        container.appendChild(checkboxContainer);
    });
}
    function salvarSelecaoResiduos() {
        const selecionados = [];
        document.querySelectorAll('#residuos-container input[type="checkbox"]:checked').forEach(checkbox => {
            selecionados.push(checkbox.value);
        });
        console.log(selecionados);
    }

    function exportarDadosCSV() {
        const ecoponto = document.getElementById('ecoponto').value;
        const placa = document.getElementById('placa').value;
        const data = document.getElementById('data').value;
        const hora = document.getElementById('hora').value;
        const bairro = document.getElementById('bairro').value;
        
        const residuosSelecionados = [];
        document.querySelectorAll('#residuos-container input[type="checkbox"]:checked').forEach(checkbox => {
            residuosSelecionados.push(checkbox.value);
        });

        const csvContent = [
            ['Ecoponto', 'Placa', 'Data', 'Hora', 'Bairro', 'Resíduos'],
            [ecoponto, placa, data, hora, bairro, residuosSelecionados.join(';')]
        ].map(e => e.join(',')).join('\n');

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        link.download = 'dados_ecoponto.csv';
        link.click();
    }

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

    function criarCookie(nome, valor, dias) {
        var data = new Date();
        data.setTime(data.getTime() + (dias * 24 * 60 * 60 * 1000));
        var expires = "expires=" + data.toUTCString();
        document.cookie = nome + "=" + valor + ";" + expires + ";path=/";
    }

    function carregarSelecaoEcoponto() {
        var ecopontoSelecionado = getCookie("ecopontoSelecionado");
        if (ecopontoSelecionado) {
            document.getElementById("ecoponto").value = ecopontoSelecionado;
        }
    }

    function getCookie(nome) {
        var nomeEQ = nome + "=";
        var ca = document.cookie.split(';');
        for(var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nomeEQ) === 0) return c.substring(nomeEQ.length, c.length);
        }
        return null;
    }

    criarCheckBoxesResiduos();
    carregarSelecaoEcoponto();

    document.getElementById('adicionar').addEventListener('click', adicionarAtendimento);
    document.getElementById('exportar').addEventListener('click', exportarDadosCSV);
    document.getElementById('ecoponto').addEventListener('change', function() {
        criarCookie("ecopontoSelecionado", this.value, 1);
    });

    inicializarBancoDeDados();
});
