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
