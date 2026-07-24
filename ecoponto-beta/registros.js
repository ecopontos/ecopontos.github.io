document.addEventListener('DOMContentLoaded', function() {
    let db;

    function inicializarBancoDeDados() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("nomeDoBancoBeta", 2);

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

    function exibirRegistros() {
        const lista = document.getElementById('registros-lista');
        const contador = document.getElementById('contador');
        lista.innerHTML = '';

        const transaction = db.transaction(["atendimentos"], "readonly");
        const objectStore = transaction.objectStore("atendimentos");

        const registros = [];
        const request = objectStore.openCursor();
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                registros.push(cursor.value);
                cursor.continue();
            } else {
                if (registros.length === 0) {
                    lista.innerHTML = '<div class="empty-state">Nenhum registro ainda.</div>';
                    contador.textContent = '';
                    return;
                }

                contador.textContent = registros.length + ' atendimento' + (registros.length !== 1 ? 's' : '');

                registros.reverse().forEach(function(reg) {
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
                            '<div class="placa">' + (reg.placa || '—') + '</div>' +
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
        };

        request.onerror = function(event) {
            console.error("Erro ao ler os registros:", event.target.error);
        };
    }

    inicializarBancoDeDados().then(exibirRegistros);
});
