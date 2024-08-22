var db; // Defina db fora das funções para garantir que ele seja acessível globalmente

function inicializarBancoDeDados() {
    return new Promise((resolve, reject) => {
        var request = indexedDB.open("nomeDoBanco", 1);

        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains("atendimentos")) {
                var objectStore = db.createObjectStore("atendimentos", { keyPath: "id", autoIncrement: true });
                objectStore.createIndex("ecoponto", "ecoponto", { unique: false });
                objectStore.createIndex("placa", "placa", { unique: false });
                objectStore.createIndex("data", "data", { unique: false });
                objectStore.createIndex("hora", "hora", { unique: false });
                objectStore.createIndex("bairro", "bairro", { unique: false });
                objectStore.createIndex("residuos", "residuos", { unique: false });
                objectStore.createIndex("horaRegistro", "horaRegistro", { unique: false });
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result; // Atribui o banco de dados ao db global
            console.log("Banco de dados aberto com sucesso");
            resolve();
        };

        request.onerror = function(event) {
            console.error("Erro ao abrir o banco de dados:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Teste a função de inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarBancoDeDados().then(() => {
        console.log("Banco de dados inicializado com sucesso.");
    }).catch(error => {
        console.error("Erro na inicialização do banco de dados:", error);
    });
});

function criarBairros() {
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
}

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
        const item = document.createElement('div');
        item.className = 'residuo-item';
        item.dataset.residuo = residuo;
        item.textContent = residuo;

        item.addEventListener('click', function() {
            this.classList.toggle('selecionado');
        });

        container.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    criarCheckBoxesResiduos();
    criarBairros();
    definirDataHoraAtual();
    setInterval(atualizarHoraAtual, 1000); // Atualiza a hora a cada segundo
    document.getElementById('exportar').addEventListener('click', exportarDadosCSV);
    inicializarBancoDeDados().catch(error => {
        console.error("Erro ao inicializar o banco de dados:", error);
    });
    exibirNomeEcoponto();
});

