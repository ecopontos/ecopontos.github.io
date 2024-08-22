// Função para carregar as configurações do localStorage
function carregarConfiguracao() {
    var ecoponto = localStorage.getItem('ecoponto');
    var nomeFuncionario = localStorage.getItem('nomeFuncionario');
    var matricula = localStorage.getItem('matricula');

    if (ecoponto) document.getElementById('ecoponto').value = ecoponto;
    if (nomeFuncionario) document.getElementById('nomeFuncionario').value = nomeFuncionario;
    if (matricula) document.getElementById('matricula').value = matricula;
}

function salvarConfiguracao() {
    const ecoponto = document.getElementById('ecoponto').value;
    const nomeFuncionario = document.getElementById('nomeFuncionario').value;
    const matricula = document.getElementById('matricula').value;

    // Salva as informações no localStorage
    localStorage.setItem('ecoponto', ecoponto);
    localStorage.setItem('nomeFuncionario', nomeFuncionario);
    localStorage.setItem('matricula', matricula);

    alert('Configurações salvas com sucesso!');
}

// Carregar configurações ao carregar a página
window.onload = function() {
    carregarConfiguracao();
};

