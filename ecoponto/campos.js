// Renderer genérico de campos a partir de um schema JSON (ver campos-schema.js).
//
// Suporta um subconjunto tocável/mobile-first dos tipos de campo do
// formbuilder do ecoforms: text, select (lista filtrável), chips,
// chips_multiple, date, time. Cada renderizador devolve o elemento DOM
// pronto e um controller { get, set?, reset } usado pelo script.js para
// coletar/limpar valores sem conhecer o tipo concreto do campo.
(function (global) {
    'use strict';

    function normalizarTexto(texto) {
        return (texto || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    function normalizarOpcoes(options) {
        return (options || []).map(function (opcao) {
            if (typeof opcao === 'string') return { label: opcao, value: opcao };
            return { label: opcao.label != null ? String(opcao.label) : String(opcao.value), value: opcao.value };
        });
    }

    function criarWrapperCard(campo) {
        var card = document.createElement('div');
        card.className = 'card';
        var label = document.createElement('label');
        label.setAttribute('for', 'campo-' + campo.id);
        label.textContent = campo.label || campo.id;
        card.appendChild(label);
        return card;
    }

    function criarCampoTexto(campo) {
        var card = criarWrapperCard(campo);
        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'campo-' + campo.id;
        input.placeholder = campo.placeholder || '';
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.spellcheck = false;
        input.setAttribute('autocapitalize', campo.uppercase ? 'characters' : 'words');
        if (campo.uppercase) {
            input.addEventListener('keyup', function () { input.value = input.value.toUpperCase(); });
        }
        card.appendChild(input);

        return {
            elemento: card,
            controller: {
                get: function () { return input.value.trim(); },
                reset: function () { input.value = ''; }
            }
        };
    }

    function criarCampoSelecaoFiltravel(campo, multipla) {
        var card = criarWrapperCard(campo);
        var opcoes = normalizarOpcoes(campo.options);
        var selecionados = [];

        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'campo-' + campo.id;
        input.placeholder = campo.placeholder || 'Digite para filtrar...';
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.autocapitalize = 'words';
        input.spellcheck = false;
        card.appendChild(input);

        var lista = document.createElement('div');
        lista.className = 'opcoes-lista';
        card.appendChild(lista);

        function renderLista(filtro) {
            lista.innerHTML = '';
            var texto = normalizarTexto(filtro);
            var filtradas = opcoes.filter(function (opcao) {
                return texto === '' || normalizarTexto(opcao.label).indexOf(texto) !== -1;
            });

            filtradas.forEach(function (opcao) {
                var marcado = selecionados.indexOf(opcao.value) !== -1;
                var item = document.createElement('div');
                item.className = 'opcao-item' + (marcado ? ' selecionado' : '');
                item.textContent = opcao.label;
                item.addEventListener('click', function () {
                    if (multipla) {
                        var idx = selecionados.indexOf(opcao.value);
                        if (idx === -1) selecionados.push(opcao.value); else selecionados.splice(idx, 1);
                        renderLista(input.value);
                    } else {
                        selecionados = [opcao.value];
                        input.value = opcao.label;
                        lista.innerHTML = '';
                    }
                });
                lista.appendChild(item);
            });
        }

        input.addEventListener('input', function () {
            if (!multipla) selecionados = [];
            renderLista(input.value);
        });
        input.addEventListener('focus', function () {
            if (multipla || selecionados.length === 0) renderLista(input.value);
        });
        document.addEventListener('click', function (e) {
            if (e.target !== input && !lista.contains(e.target)) {
                lista.innerHTML = '';
            }
        });

        return {
            elemento: card,
            controller: {
                get: function () {
                    if (multipla) return selecionados.slice();
                    if (selecionados.length) return selecionados[0];
                    // Resolve por texto digitado exatamente igual a alguma opção,
                    // caso o usuário não tenha tocado na sugestão.
                    var texto = normalizarTexto(input.value);
                    if (!texto) return '';
                    var achada = opcoes.filter(function (o) { return normalizarTexto(o.label) === texto; })[0];
                    if (achada) { selecionados = [achada.value]; return achada.value; }
                    return '';
                },
                reset: function () { selecionados = []; input.value = ''; lista.innerHTML = ''; }
            }
        };
    }

    function criarCampoChips(campo, multipla) {
        var wrapper = document.createElement('div');

        var titulo = document.createElement('div');
        titulo.className = 'section-title';
        titulo.textContent = campo.label || campo.id;
        wrapper.appendChild(titulo);

        var grid = document.createElement('div');
        grid.className = 'chips-grid';
        grid.id = 'campo-' + campo.id;
        wrapper.appendChild(grid);

        var opcoes = normalizarOpcoes(campo.options);
        var selecionados = [];

        opcoes.forEach(function (opcao) {
            var item = document.createElement('div');
            item.className = 'chip-item';
            item.textContent = opcao.label;
            item.addEventListener('click', function () {
                if (multipla) {
                    var idx = selecionados.indexOf(opcao.value);
                    if (idx === -1) { selecionados.push(opcao.value); item.classList.add('selecionado'); }
                    else { selecionados.splice(idx, 1); item.classList.remove('selecionado'); }
                } else {
                    selecionados = [opcao.value];
                    Array.prototype.forEach.call(grid.querySelectorAll('.chip-item.selecionado'), function (el) {
                        el.classList.remove('selecionado');
                    });
                    item.classList.add('selecionado');
                }
            });
            grid.appendChild(item);
        });

        return {
            elemento: wrapper,
            controller: {
                get: function () { return multipla ? selecionados.slice() : (selecionados[0] || ''); },
                reset: function () {
                    selecionados = [];
                    Array.prototype.forEach.call(grid.querySelectorAll('.chip-item.selecionado'), function (el) {
                        el.classList.remove('selecionado');
                    });
                }
            }
        };
    }

    function criarCampoDataHora(campo, tipo) {
        var card = criarWrapperCard(campo);
        var input = document.createElement('input');
        input.type = tipo;
        input.id = 'campo-' + campo.id;
        card.appendChild(input);
        return {
            elemento: card,
            controller: {
                get: function () { return input.value; },
                set: function (valor) { input.value = valor; },
                reset: function () { input.value = ''; }
            }
        };
    }

    var RENDERIZADORES = {
        text: function (campo) { return criarCampoTexto(campo); },
        select: function (campo) { return criarCampoSelecaoFiltravel(campo, false); },
        chips: function (campo) { return criarCampoChips(campo, false); },
        chips_multiple: function (campo) { return criarCampoChips(campo, true); },
        date: function (campo) { return criarCampoDataHora(campo, 'date'); },
        time: function (campo) { return criarCampoDataHora(campo, 'time'); }
    };

    // Renderiza schema.campos dentro de `container` e devolve um mapa
    // { [campo.id]: controller } para leitura/reset genérico dos valores.
    function renderizarCampos(schema, container) {
        container.innerHTML = '';
        var controllers = {};
        (schema.campos || []).forEach(function (campo) {
            var renderizar = RENDERIZADORES[campo.type] || RENDERIZADORES.text;
            var resultado = renderizar(campo);
            container.appendChild(resultado.elemento);
            controllers[campo.id] = resultado.controller;
        });
        return controllers;
    }

    global.EcoformsCampos = {
        renderizarCampos: renderizarCampos,
        normalizarTexto: normalizarTexto
    };
})(window);
