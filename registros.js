document.addEventListener('DOMContentLoaded', function() {
    let db;

    function inicializarBancoDeDados() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("nomeDoBanco", 1);

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
        const tabela = document.getElementById('registros-tabela').getElementsByTagName('tbody')[0];
        tabela.innerHTML = ''; // Limpa a tabela

        const transaction = db.transaction(["atendimentos"], "readonly");
        const objectStore = transaction.objectStore("atendimentos");

        const request = objectStore.openCursor();
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const row = tabela.insertRow();
                row.insertCell().textContent = cursor.value.ecoponto;
                row.insertCell().textContent = cursor.value.placa;
                row.insertCell().textContent = cursor.value.data;
                row.insertCell().textContent = cursor.value.hora;
                row.insertCell().textContent = cursor.value.bairro;
                row.insertCell().textContent = cursor.value.residuos;
                row.insertCell().textContent = cursor.value.horaRegistro;
                cursor.continue();
            }
        };

        request.onerror = function(event) {
            console.error("Erro ao ler os registros:", event.target.error);
        };
    }

    inicializarBancoDeDados().then(exibirRegistros);
});
