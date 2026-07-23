document.addEventListener('DOMContentLoaded', function() {
    const ecopontosPorId = {
        '1': 'PEV ITACORUBI',
        '2': 'PEV CAPOEIRAS',
        '3': 'PEV MORRO DAS PEDRAS',
        '4': 'PEV MONTE CRISTO (ARESP)',
        '5': 'PEV CANASVIEIRAS',
        '6': 'PEV RIO VERMELHO',
        '7': 'PEV INGLESES',
        '8': 'PEV COSTEIRA',
        '9': 'PEV COLONINHA'
    };

    function obterNomeEcoponto() {
        const nomeSalvo = localStorage.getItem('nomeEcoponto');
        const valorSalvo = localStorage.getItem('ecoponto');
        return nomeSalvo || ecopontosPorId[valorSalvo] || valorSalvo;
    }

    // Recupera o nome do Ecoponto salvo no localStorage
    const nomeEcoponto = obterNomeEcoponto();
    const nomeEcopontoDisplay = document.getElementById('nome-ecoponto-display');

    // Verifica se o Ecoponto foi configurado e exibe o nome no HTML
    if (nomeEcopontoDisplay) {
        nomeEcopontoDisplay.textContent = nomeEcoponto || 'Ecoponto não configurado';
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

    function inicializarBairros() {
        var input = document.getElementById('bairro-input');
        var hidden = document.getElementById('bairro');
        var lista = document.getElementById('bairro-lista');

        function renderBairros(filtro) {
            lista.innerHTML = '';
            var texto = (filtro || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            var filtrados = bairros.filter(function(b) {
                var normalizado = b.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                return texto === '' || normalizado.indexOf(texto) !== -1;
            });

            filtrados.forEach(function(bairro) {
                var btn = document.createElement('div');
                btn.className = 'bairro-opcao' + (hidden.value === bairro ? ' selecionado' : '');
                btn.textContent = bairro;
                btn.addEventListener('click', function() {
                    hidden.value = bairro;
                    input.value = bairro;
                    lista.innerHTML = '';
                });
                lista.appendChild(btn);
            });
        }

        input.addEventListener('input', function() {
            hidden.value = '';
            renderBairros(this.value);
        });

        input.addEventListener('focus', function() {
            if (!hidden.value) renderBairros(this.value);
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.card') || (!e.target.closest('#bairro-input') && !e.target.closest('#bairro-lista'))) {
                lista.innerHTML = '';
            }
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
            var request = indexedDB.open("nomeDoBanco", 2);

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                var objectStore;
                if (!db.objectStoreNames.contains("atendimentos")) {
                    objectStore = db.createObjectStore("atendimentos", { keyPath: "id", autoIncrement: true });
                    objectStore.createIndex("ecoponto", "ecoponto", { unique: false });
                    objectStore.createIndex("placa", "placa", { unique: false });
                    objectStore.createIndex("data", "data", { unique: false });
                    objectStore.createIndex("hora", "hora", { unique: false });
                    objectStore.createIndex("bairro", "bairro", { unique: false });
                    objectStore.createIndex("residuos", "residuos", { unique: false });
                    objectStore.createIndex("horaRegistro", "horaRegistro", { unique: false });
                    objectStore.createIndex("status", "status", { unique: false });
                } else {
                    objectStore = event.target.transaction.objectStore("atendimentos");
                    if (!objectStore.indexNames.contains("status")) {
                        objectStore.createIndex("status", "status", { unique: false });
                    }
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

    function verificarPlacaMesmoDia(placa, data) {
        var placaNormalizada = (placa || '').trim().toUpperCase();
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(["atendimentos"], "readonly");
            var objectStore = transaction.objectStore("atendimentos");
            var request = objectStore.openCursor();

            request.onsuccess = function(event) {
                var cursor = event.target.result;
                if (!cursor) {
                    resolve(false);
                    return;
                }

                var registro = cursor.value;
                var mesmaPlaca = (registro.placa || '').trim().toUpperCase() === placaNormalizada;
                if (mesmaPlaca && registro.data === data) {
                    resolve(true);
                    return;
                }

                cursor.continue();
            };

            request.onerror = function(event) {
                reject(event.target.error);
            };
        });
    }

    function adicionarAtendimento() {
        // Recupera o nome do Ecoponto salvo no localStorage
        const nomeEcoponto = obterNomeEcoponto();

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

        verificarPlacaMesmoDia(placa, data).then(function(jaRegistrado) {
            if (jaRegistrado) {
                alert("Este veículo (placa " + placa.trim().toUpperCase() + ") já possui um registro para esta data. Não é permitido usar o Ecoponto duas vezes no mesmo dia.");
                return;
            }

            const agora = new Date();
            const horaAtual = agora.toLocaleTimeString('pt-BR');

            const idRegistro = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Date.now() + '-' + Math.random().toString(36).slice(2);

            const novoAtendimento = {
                idRegistro: idRegistro,
                ecoponto: nomeEcoponto,
                placa: placa,
                data: data,
                hora: hora,
                bairro: bairro,
                residuos: residuosSelecionados.join(';'),
                horaRegistro: horaAtual,
                status: 'Pendente'
            };

            var transaction = db.transaction(["atendimentos"], "readwrite");
            var objectStore = transaction.objectStore("atendimentos");
            var request = objectStore.add(novoAtendimento);

            request.onsuccess = function(event) {
                var registroId = event.target.result;
                novoAtendimento.id = registroId;
                console.log("Atendimento adicionado com sucesso");
                enviarParaSheets(novoAtendimento, registroId);
                document.getElementById("placa").value = '';
                document.getElementById("data").value = '';
                document.getElementById("hora").value = '';
                document.getElementById("bairro").value = '';
                document.getElementById("bairro-input").value = '';
                document.querySelectorAll('#residuos-container .selecionado').forEach(item => item.classList.remove('selecionado'));
                atualizarDataHora();
            };

            request.onerror = function(event) {
                console.error("Erro ao adicionar atendimento:", event.target.errorCode);
            };
        }).catch(function(erro) {
            console.error("Erro ao verificar duplicidade de placa:", erro);
            alert("Não foi possível verificar registros existentes. Tente novamente.");
        });
    }

    function enviarParaSheets(atendimento, registroId) {
        var url = localStorage.getItem('sheetsUrl');
        if (!url) return;

        garantirIdRegistro(atendimento);

        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(atendimento)
        }).then(function() {
            console.log('Enviado para Google Sheets');
            if (registroId) atualizarStatus(registroId, 'Sincronizado');
            atualizarIndicadorPendentes();
        }).catch(function() {
            adicionarFilaPendente(atendimento);
            atualizarIndicadorPendentes();
        });
    }

    function atualizarStatus(id, novoStatus) {
        var transaction = db.transaction(["atendimentos"], "readwrite");
        var objectStore = transaction.objectStore("atendimentos");
        var request = objectStore.get(id);
        request.onsuccess = function(event) {
            var registro = event.target.result;
            if (registro) {
                registro.status = novoStatus;
                objectStore.put(registro);
            }
        };
    }

    function atualizarStatusPorAtendimento(atendimento, novoStatus) {
        if (atendimento.id) {
            atualizarStatus(atendimento.id, novoStatus);
            return;
        }

        if (!atendimento.idRegistro) return;

        var transaction = db.transaction(["atendimentos"], "readwrite");
        var objectStore = transaction.objectStore("atendimentos");
        var request = objectStore.openCursor();
        request.onsuccess = function(event) {
            var cursor = event.target.result;
            if (!cursor) return;

            var registro = cursor.value;
            if (registro.idRegistro === atendimento.idRegistro) {
                registro.status = novoStatus;
                cursor.update(registro);
            } else {
                cursor.continue();
            }
        };
    }

    function adicionarFilaPendente(atendimento) {
        var fila = JSON.parse(localStorage.getItem('filaPendente') || '[]');
        fila.push(atendimento);
        localStorage.setItem('filaPendente', JSON.stringify(fila));
        console.warn('Sem conexão. Registro na fila de envio (' + fila.length + ' pendente(s)).');
    }

    function garantirIdRegistro(atendimento) {
        if (!atendimento.idRegistro) {
            atendimento.idRegistro = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Date.now() + '-' + Math.random().toString(36).slice(2);
        }
        atendimento.ecoponto = ecopontosPorId[atendimento.ecoponto] || atendimento.ecoponto;
        return atendimento;
    }

    function enviarPendentes() {
        var url = localStorage.getItem('sheetsUrl');
        if (!url) return;

        var fila = JSON.parse(localStorage.getItem('filaPendente') || '[]');
        if (fila.length === 0) return;

        console.log('Reenviando ' + fila.length + ' registro(s) pendente(s)...');
        var restante = [];

        var envios = fila.map(function(atendimento) {
            garantirIdRegistro(atendimento);
            return fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(atendimento)
            }).then(function() {
                atualizarStatusPorAtendimento(atendimento, 'Sincronizado');
            }).catch(function() {
                restante.push(atendimento);
            });
        });

        Promise.all(envios).then(function() {
            localStorage.setItem('filaPendente', JSON.stringify(restante));
            if (restante.length === 0) {
                console.log('Todos os pendentes enviados.');
            } else {
                console.warn(restante.length + ' registro(s) ainda pendente(s).');
            }
        });
    }

    function atualizarIndicadorPendentes() {
        var fila = JSON.parse(localStorage.getItem('filaPendente') || '[]');
        var el = document.getElementById('status-pendente');
        if (!el) return;
        if (fila.length > 0) {
            el.textContent = fila.length + ' registro(s) pendente(s) de envio';
            el.classList.add('visivel');
        } else {
            el.classList.remove('visivel');
        }
    }

    window.addEventListener('online', function() {
        enviarPendentes();
        setTimeout(atualizarIndicadorPendentes, 3000);
    });

    enviarPendentes();
    atualizarIndicadorPendentes();

function exportarDadosCSV() {
    const transaction = db.transaction(["atendimentos"], "readonly");
    const objectStore = transaction.objectStore("atendimentos");
    const request = objectStore.getAll();

    request.onsuccess = function(event) {
        const registros = event.target.result;
        const naoExportados = registros.filter(function(r) { return r.status !== 'Exportado'; });

        if (naoExportados.length === 0) {
            alert("Nenhum registro novo para exportar.");
            return;
        }

        const ecoponto = naoExportados[0].ecoponto;
        const maxRegistro = naoExportados.reduce((max, registro) => {
            const registroDateTime = new Date(`${registro.data} ${registro.hora}`);
            const maxDateTime = new Date(`${max.data} ${max.hora}`);
            return registroDateTime > maxDateTime ? registro : max;
        });

        const maxDataHora = `${maxRegistro.data.replace(/-/g, '')}_${maxRegistro.hora.replace(/:/g, '')}`;

        const csvContent = [
            ['Ecoponto', 'Placa', 'Data', 'Hora', 'Bairro', 'Resíduos', 'Hora Registro', 'Status'],
            ...naoExportados.map(registro => [
                registro.ecoponto,
                registro.placa,
                registro.data,
                registro.hora,
                registro.bairro,
                `"${registro.residuos.split(';').join(',')}"`,
                registro.horaRegistro,
                registro.status || 'Pendente'
            ])
        ]
        .map(e => e.join(','))
        .join('\n');

        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        link.download = `${ecoponto}_${maxDataHora}.csv`;
        link.click();

        const updateTransaction = db.transaction(["atendimentos"], "readwrite");
        const updateStore = updateTransaction.objectStore("atendimentos");
        naoExportados.forEach(function(reg) {
            reg.status = 'Exportado';
            updateStore.put(reg);
        });

        updateTransaction.oncomplete = function() {
            console.log(naoExportados.length + ' registro(s) marcado(s) como Exportado.');
        };
    };

    request.onerror = function(event) {
        console.error("Erro ao ler dados da IndexedDB:", event.target.error);
    };
}


    // Inicializa componentes e configurações
    inicializarBairros();
    criarCheckBoxesResiduos();
    inicializarBancoDeDados();
    atualizarDataHora(); // Atualiza data e hora inicialmente

    // Configura intervalos para atualizar data e hora a cada 10 minutos
    setInterval(atualizarDataHora, 10 * 60 * 1000);

    // Adiciona event listeners
    document.getElementById('adicionar').addEventListener('click', adicionarAtendimento);
    document.getElementById('exportar').addEventListener('click', exportarDadosCSV);
});
