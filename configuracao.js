// Função para carregar as configurações do localStorage
function carregarConfiguracao() {
    var ecoponto = localStorage.getItem('ecoponto');
    var nomeFuncionario = localStorage.getItem('nomeFuncionario');
    var matricula = localStorage.getItem('matricula');

    if (ecoponto) document.getElementById('ecoponto').value = ecoponto;
    if (nomeFuncionario) document.getElementById('nomeFuncionario').value = nomeFuncionario;
    if (matricula) document.getElementById('matricula').value = matricula;
}

// Função para salvar as configurações no localStorage
function salvarConfiguracao() {
    var ecoponto = document.getElementById('ecoponto').value;
    var nomeFuncionario = document.getElementById('nomeFuncionario').value;
    var matricula = document.getElementById('matricula').value;

    if (ecoponto === "" || nomeFuncionario === "" || matricula === "") {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    localStorage.setItem('ecoponto', ecoponto);
    localStorage.setItem('nomeFuncionario', nomeFuncionario);
    localStorage.setItem('matricula', matricula);

    alert("Configurações salvas com sucesso!");
}

// Carregar configurações ao carregar a página
window.onload = function() {
    carregarConfiguracao();
};

