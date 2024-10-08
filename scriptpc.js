document.addEventListener('DOMContentLoaded', function() {
    // Recupera o nome do Ecoponto salvo no localStorage
    const ecoponto = localStorage.getItem('ecoponto');
    const nomeEcopontoDisplay = document.getElementById('nome-ecoponto-display');

    // Verifica se o Ecoponto foi configurado e exibe o nome no HTML
    if (nomeEcopontoDisplay) {
        nomeEcopontoDisplay.textContent = ecoponto || 'Ecoponto não configurado';
    }

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

    const residuos = [
        "Amianto", "Animal", "Cápsula de Café", "Eletrônico", "Entulhos",
        "Esponja", "Gesso", "Isopor", "Lâmpadas", "Livro/Revista",
        "Madeiras", "Material de Escrita", "Óleo de Cozinha", "Orgânico",
        "Pilhas/Baterias", "Pneus", "Podas", "Reciclável", "Roupas/Calçados",
        "Sucata/Metal", "Vidros", "Volumosos"
    ];

    let db;

    function preencherListaDeBairros() {
        const selectBairro = document.getElementById('bairro');
        bairros.forEach(bairro => {
            const option = document.createElement('option');
            option.value = bairro;
            option.textContent = bairro;
            selectBairro.appendChild(option);
        });
    }

    function criarCheckBoxesResiduos() {
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
                    objectStore.createIndex("bairro", "bairro", { unique: false });
                    objectStore.createIndex("residuos", "residuos", { unique: false });
                    objectStore.createIndex("horaRegistro", "horaRegistro", { unique: false });
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

  function atualizarDataHora() {
    const agora = new Date();

    // Formata a data no formato YYYY-MM-DD
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
    const dia = String(agora.getDate()).padStart(2, '0');
    const dataAtual = `${ano}-${mes}-${dia}`;

    // Formata a hora no formato HH:MM
    const horas = String(agora.getHours()).padStart(2, '0');
    const minutos = String(agora.getMinutes()).padStart(2, '0');
    const horaAtual = `${horas}:${minutos}`;

    // Atualiza os campos de data e hora no formulário
    document.getElementById('data').value = dataAtual;
    document.getElementById('hora').value = horaAtual;
}

// Chama a função atualizarDataHora imediatamente para definir a data e a hora inicial
atualizarDataHora();

// Configura o intervalo para atualizar a data e a hora a cada minuto (60.000 milissegundos)
setInterval(atualizarDataHora, 60 * 1000);

    function adicionarAtendimento() {
        // Recupera o nome do Ecoponto salvo no localStorage
        const ecoponto = localStorage.getItem('ecoponto');
        const nomeEcopontoDisplay = document.getElementById('nome-ecoponto-display');

        // Se o nome do Ecoponto estiver disponível, use-o, senão mostre uma mensagem de erro
        const nomeEcoponto = nomeEcopontoDisplay ? nomeEcopontoDisplay.textContent : ecoponto;

        const placa = document.getElementById('placa').value;
        const data = document.getElementById('data').value;
        const hora = document.getElementById('hora').value;
        const bairro = document.getElementById('bairro').value;

        const residuosSelecionados = Array.from(document.querySelectorAll('#residuos-container .selecionado'))
                                          .map(item => item.dataset.residuo);

        if (!nomeEcoponto || placa === "" || data === "" || hora === "" || bairro === "") {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const agora = new Date();
        const horaAtual = agora.toLocaleTimeString('pt-BR');

        const novoAtendimento = {
            ecoponto: nomeEcoponto,
            placa: placa,
            data: data,
            hora: hora,
            bairro: bairro,
            residuos: residuosSelecionados.join(';'),
            horaRegistro: horaAtual
        };

        var transaction = db.transaction(["atendimentos"], "readwrite");
        var objectStore = transaction.objectStore("atendimentos");
        var request = objectStore.add(novoAtendimento);

        request.onsuccess = function(event) {
            console.log("Atendimento adicionado com sucesso");
            document.getElementById("placa").value = '';
            document.getElementById("data").value = '';
            document.getElementById("hora").value = '';
            document.getElementById("bairro").value = '';
            document.querySelectorAll('#residuos-container .selecionado').forEach(item => item.classList.remove('selecionado'));
            atualizarDataHora(); // Atualiza a data e hora após a submissão
        };

        request.onerror = function(event) {
            console.error("Erro ao adicionar atendimento:", event.target.errorCode);
        };
    }

     //Exporta dados em CSV
function exportarDadosCSV() {
    const transaction = db.transaction(["atendimentos"], "readonly");
    const objectStore = transaction.objectStore("atendimentos");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        const registros = event.target.result;

        if (registros.length === 0) {
            console.warn("Nenhum registro encontrado.");
            return;
        }

        // Encontra o ecoponto e o registro com a data e hora máxima
        const ecoponto = registros[0].ecoponto; // Supondo que todos os registros tenham o mesmo ecoponto
        const maxRegistro = registros.reduce((max, registro) => {
            const registroDateTime = new Date(`${registro.data} ${registro.hora}`);
            const maxDateTime = new Date(`${max.data} ${max.hora}`);
            return registroDateTime > maxDateTime ? registro : max;
        });

        const maxDataHora = `${maxRegistro.data.replace(/-/g, '')}_${maxRegistro.hora.replace(/:/g, '')}`;

        // Cria o conteúdo do CSV
        const csvContent = [
            ['Ecoponto', 'Placa', 'Data', 'Hora', 'Bairro', 'Resíduos', 'Hora Registro'],
            ...registros.map(registro => [
                registro.ecoponto,
                registro.placa,
                registro.data,
                registro.hora,
                registro.bairro,
                `"${registro.residuos.split(';').join(',')}"`,
                registro.horaRegistro
            ])
        ]
        .map(e => e.join(','))
        .join('\n');

        // Cria um link para download do arquivo CSV
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        link.download = `${ecoponto}_${maxDataHora}.csv`;
        link.click();

        // Limpa o banco de dados após a exportação
        const deleteTransaction = db.transaction(["atendimentos"], "readwrite");
        const deleteObjectStore = deleteTransaction.objectStore("atendimentos");
        const clearRequest = deleteObjectStore.clear();

        clearRequest.onsuccess = function(event) {
            console.log("Banco de dados limpo com sucesso.");
        };

        clearRequest.onerror = function(event) {
            console.error("Erro ao limpar o banco de dados:", event.target.error);
        };
    };

    request.onerror = function(event) {
        console.error("Erro ao ler dados da IndexedDB:", event.target.error);
    };
}


    // Inicializa componentes e configurações
    preencherListaDeBairros();
    criarCheckBoxesResiduos();
    inicializarBancoDeDados();
    atualizarDataHora(); // Atualiza data e hora inicialmente

    // Configura intervalos para atualizar data e hora a cada 10 minutos
    setInterval(atualizarDataHora, 10 * 60 * 1000);

    // Adiciona event listeners
    document.getElementById('adicionar').addEventListener('click', adicionarAtendimento);
    document.getElementById('exportar').addEventListener('click', exportarDadosCSV);
});