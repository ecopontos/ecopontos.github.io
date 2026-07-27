document.addEventListener('DOMContentLoaded', function() {
    let db;
    let todosRegistros = [];

    const filtroMes = document.getElementById('filtro-mes');
    const filtroDia = document.getElementById('filtro-dia');

    function inicializarBancoDeDados() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("nomeDoBanco", 2);

            request.onsuccess = function(event) {
                db = event.target.result;
                resolve();
            };

            request.onerror = function(event) {
                console.error("Erro ao abrir o banco de dados:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    function extrairMeses() {
        const meses = new Set();
        todosRegistros.forEach(function(reg) {
            if (reg.data && reg.data.length >= 7) {
                meses.add(reg.data.substring(0, 7));
            }
        });
        const ordenados = Array.from(meses).sort().reverse();
        filtroMes.innerHTML = '<option value="">Todos os meses</option>';
        ordenados.forEach(function(m) {
            const partes = m.split('-');
            const nomeMes = partes[1] + '/' + partes[0];
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = nomeMes;
            filtroMes.appendChild(opt);
        });
    }

    function extrairDias(mesSelecionado) {
        const dias = new Set();
        todosRegistros.forEach(function(reg) {
            if (reg.data && reg.data.startsWith(mesSelecionado)) {
                dias.add(reg.data.substring(8, 10));
            }
        });
        const ordenados = Array.from(dias).sort();
        filtroDia.innerHTML = '<option value="">Todos os dias</option>';
        ordenados.forEach(function(d) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            filtroDia.appendChild(opt);
        });
        filtroDia.disabled = false;
    }

    function filtrarRegistros() {
        const mes = filtroMes.value;
        const dia = filtroDia.value;
        return todosRegistros.filter(function(reg) {
            if (!reg.data) return false;
            if (mes && !reg.data.startsWith(mes)) return false;
            if (dia && reg.data.substring(8, 10) !== dia) return false;
            return true;
        });
    }

    function exibirRegistros() {
        const lista = document.getElementById('registros-lista');
        const contador = document.getElementById('contador');
        lista.innerHTML = '';

        const registros = filtrarRegistros();

        if (registros.length === 0) {
            lista.innerHTML = '<div class="empty-state">Nenhum registro encontrado.</div>';
            contador.textContent = '';
            return;
        }

        contador.textContent = registros.length + ' atendimento' + (registros.length !== 1 ? 's' : '');

        registros.slice().reverse().forEach(function(reg) {
            const card = document.createElement('div');
            card.className = 'registro-card';

            var residuosHTML = '';
            if (reg.residuos) {
                var tags = reg.residuos.split(';');
                residuosHTML = '<div class="residuos-tags">' +
                    tags.map(function(r) { return '<span>' + r + '</span>'; }).join('') +
                    '</div>';
            }

            var status = reg.status || 'Pendente';
            var statusClass = 'status-tag ' + (status === 'Sincronizado' ? 'status-sync' : status === 'Exportado' ? 'status-export' : 'status-pendente');

            card.innerHTML =
                '<div class="placa-row">' +
                    '<div class="placa">' + (reg.placa || '\u2014') + '</div>' +
                    '<span class="' + statusClass + '">' + status + '</span>' +
                '</div>' +
                '<div class="meta">' +
                    '<span>' + (reg.data || '') + '</span>' +
                    '<span>' + (reg.hora || '') + '</span>' +
                    '<span>' + (reg.bairro || '') + '</span>' +
                '</div>' +
                residuosHTML;

            lista.appendChild(card);
        });
    }

    function carregarRegistros() {
        const transaction = db.transaction(["atendimentos"], "readonly");
        const objectStore = transaction.objectStore("atendimentos");
        const request = objectStore.openCursor();

        todosRegistros = [];

        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                todosRegistros.push(cursor.value);
                cursor.continue();
            } else {
                extrairMeses();
                exibirRegistros();
            }
        };

        request.onerror = function(event) {
            console.error("Erro ao ler os registros:", event.target.error);
        };
    }

    filtroMes.addEventListener('change', function() {
        if (filtroMes.value) {
            extrairDias(filtroMes.value);
        } else {
            filtroDia.innerHTML = '<option value="">Todos os dias</option>';
            filtroDia.disabled = true;
        }
        filtroDia.value = '';
        exibirRegistros();
    });

    filtroDia.addEventListener('change', function() {
        exibirRegistros();
    });

    inicializarBancoDeDados().then(carregarRegistros);
});
