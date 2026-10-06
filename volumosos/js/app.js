import * as db from './db.js';
import { FORM_VOLUMOSOS, ORIENTACOES_CIDADAO } from './form-volumosos.js';
import { buscarCep } from './cep.js';
import { comprimirFoto } from './fotos.js';
import { caminhoFoto, enviarFoto, testarConexao } from './drive.js';
import { uuidv7 } from './id.js';
import {
    REGRAS_ABERTURA, ROTULO_SITUACAO, formatarData, gerarDatasProgramacao, hojeLocal,
    janelaInscricao, linkWhatsApp, mensagemConfirmacao, montarChecklist, normalizar, protocolo,
    situacaoInscricao, textoChecklist, validarAgendamento, validarRegra, formatarCep,
} from './regras.js';

// ── Helpers de DOM ──────────────────────────────────────────

/** Cria elemento. `attrs` aceita on* (listeners), class, e demais atributos. Filhos string viram texto. */
function h(tag, attrs = {}, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'value' || (k in el && typeof v !== 'string')) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat(Infinity)) {
        if (f == null || f === false) continue;
        el.append(f instanceof Node ? f : document.createTextNode(String(f)));
    }
    return el;
}

const $main = () => document.getElementById('main');

/** Navega para `hash`; se já estiver nele, re-renderiza (hashchange não dispara). */
function navegar(hash) {
    if (location.hash === hash) rotear();
    else location.hash = hash;
}

function toast(msg, tipo = 'ok') {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const el = h('div', { class: `toast toast-${tipo}`, role: 'status' }, msg);
    document.body.append(el);
    setTimeout(() => el.remove(), 3500);
}

function vazio(texto, acao) {
    return h('div', { class: 'vazio' }, h('p', {}, texto), acao);
}

function badge(situacao) {
    return h('span', { class: `badge badge-${situacao}` }, ROTULO_SITUACAO[situacao]);
}

function descreverRegra(regra) {
    return regra.tipo === 'dias_antes' ? `abre ${regra.dias} dia(s) antes` : 'abre na semana anterior';
}

// ── Carregamento de dados ───────────────────────────────────

async function carregarTudo() {
    const [regioes, coletas, agendamentos] = await Promise.all([
        db.listar('regioes'), db.listar('coletas'), db.listar('agendamentos'),
    ]);
    const regiaoPorId = new Map(regioes.map((r) => [r.id, r]));
    const agPorColeta = new Map();
    for (const a of agendamentos) {
        if (!agPorColeta.has(a.coletaId)) agPorColeta.set(a.coletaId, []);
        agPorColeta.get(a.coletaId).push(a);
    }
    const hoje = hojeLocal();
    const coletasInfo = coletas
        .filter((c) => regiaoPorId.has(c.regiaoId))
        .map((c) => {
            const regiao = regiaoPorId.get(c.regiaoId);
            const ags = (agPorColeta.get(c.id) ?? []).filter((a) => a.status !== 'cancelado');
            return {
                coleta: c, regiao, agendamentos: ags,
                janela: janelaInscricao(c.data, regiao.regra),
                situacao: situacaoInscricao(c, regiao, hoje, ags.length),
            };
        })
        .sort((a, b) => a.coleta.data.localeCompare(b.coleta.data) || a.regiao.nome.localeCompare(b.regiao.nome));
    return { regioes: regioes.sort((a, b) => a.nome.localeCompare(b.nome)), coletasInfo, hoje };
}

// ── Tela: Agendar ───────────────────────────────────────────

async function telaAgendar(params) {
    const { coletasInfo, regioes } = await carregarTudo();
    const main = $main();

    let editando = null;
    let fotosExistentes = [];
    if (params.get('ag')) {
        editando = await db.obter('agendamentos', params.get('ag'));
        if (editando) fotosExistentes = await db.porIndice('fotos', 'agendamentoId', editando.id);
    }

    const abertas = coletasInfo.filter((ci) => ci.situacao === 'aberta' || ci.coleta.id === editando?.coletaId);

    if (regioes.length === 0) {
        main.replaceChildren(h('h1', {}, 'Novo agendamento'),
            vazio('Cadastre primeiro as regiões e seus bairros.', h('a', { class: 'btn', href: '#/regioes' }, 'Ir para Regiões')));
        return;
    }
    if (abertas.length === 0) {
        const proximas = coletasInfo.filter((ci) => ci.situacao === 'aguardando').slice(0, 5);
        main.replaceChildren(h('h1', {}, 'Novo agendamento'),
            vazio('Nenhuma coleta com inscrições abertas hoje.',
                h('a', { class: 'btn', href: '#/coletas' }, 'Ver programação')),
            proximas.length ? h('div', { class: 'card' }, h('h2', {}, 'Próximas aberturas'),
                h('ul', {}, proximas.map((ci) => h('li', {},
                    `${ci.regiao.nome} — coleta ${formatarData(ci.coleta.data, true)} · abre ${formatarData(ci.janela.abre)}`)))) : null);
        return;
    }

    const dados = { ...(editando?.dados ?? {}) };
    let coletaId = editando?.coletaId ?? params.get('coleta') ?? (abertas.length === 1 ? abertas[0].coleta.id : '');
    if (!abertas.some((ci) => ci.coleta.id === coletaId)) coletaId = '';
    // fotos: { id, blob, url } — url é objectURL para preview
    let fotos = fotosExistentes.map((f) => ({ id: f.id, blob: f.blob, nome: f.nome, url: URL.createObjectURL(f.blob), driveId: f.driveId }));

    const infoColeta = () => abertas.find((ci) => ci.coleta.id === coletaId);

    const selColeta = h('select', {
        id: 'coleta', required: true,
        onchange: (e) => { coletaId = e.target.value; renderBairro(); renderInfo(); },
    },
    h('option', { value: '' }, '— escolha a coleta —'),
    abertas.map((ci) => h('option', { value: ci.coleta.id, selected: ci.coleta.id === coletaId },
        `${ci.regiao.nome} — ${formatarData(ci.coleta.data, true)}${ci.coleta.local ? ` (${ci.coleta.local})` : ''}`)));

    const info = h('p', { class: 'ajuda' });
    function renderInfo() {
        const ci = infoColeta();
        info.textContent = ci
            ? `Inscrições até ${formatarData(ci.janela.fecha)} · ${ci.agendamentos.length}${ci.coleta.limite != null ? `/${ci.coleta.limite}` : ''} agendado(s)`
            : '';
    }

    const slotBairro = h('div');
    function renderBairro() {
        const ci = infoColeta();
        const lista = ci?.regiao.bairros ?? [];
        const campo = lista.length
            ? h('select', { id: 'f-bairro', required: true, onchange: (e) => { dados.bairro = e.target.value; } },
                h('option', { value: '' }, '— bairro —'),
                lista.map((b) => h('option', { value: b, selected: dados.bairro === b }, b)))
            : h('input', { id: 'f-bairro', type: 'text', required: true, value: dados.bairro ?? '', oninput: (e) => { dados.bairro = e.target.value; } });
        if (lista.length && !lista.includes(dados.bairro)) dados.bairro = '';
        slotBairro.replaceChildren(h('label', { for: 'f-bairro' }, 'Bairro *'), campo);
    }

    function campoForm(c) {
        const rot = h('label', { for: `f-${c.id}` }, c.label + (c.required ? ' *' : ''));
        if (c.type === 'bairro') return slotBairro;
        if (c.type === 'checkboxes') {
            const sel = new Set(Array.isArray(dados[c.id]) ? dados[c.id] : []);
            dados[c.id] = [...sel];
            return h('fieldset', {}, h('legend', {}, rot.textContent),
                h('div', { class: 'chips' }, c.options.map((op) => h('label', { class: 'chip' },
                    h('input', {
                        type: 'checkbox', value: op, checked: sel.has(op),
                        onchange: (e) => { e.target.checked ? sel.add(op) : sel.delete(op); dados[c.id] = c.options.filter((o) => sel.has(o)); },
                    }), op))));
        }
        if (dados[c.id] == null && c.valor_padrao != null) dados[c.id] = c.valor_padrao;
        const comum = {
            id: `f-${c.id}`, name: c.id, required: c.required, value: dados[c.id] ?? '',
            autocomplete: c.autocomplete, inputmode: c.inputmode,
            oninput: (e) => { dados[c.id] = e.target.value; },
        };
        const tipoHtml = { cpf: 'text', cep: 'text' }[c.type] ?? c.type;
        const input = c.type === 'textarea'
            ? h('textarea', { ...comum, rows: 3 })
            : h('input', { ...comum, type: tipoHtml, min: c.min, max: c.max, step: c.step });
        if (c.type === 'cep') input.addEventListener('change', () => preencherPorCep(input.value));
        const ajuda = c.type === 'cep' ? ajudaCep : (c.ajuda ? h('p', { class: 'ajuda' }, c.ajuda) : null);
        return h('div', {}, rot, input, ajuda);
    }

    // CEP → endereço/bairro (ViaCEP). Só preenche o endereço se estiver vazio.
    const ajudaCep = h('p', { class: 'ajuda' });
    async function preencherPorCep(cep) {
        ajudaCep.textContent = '';
        const r = await buscarCep(cep);
        if (!r) return;
        ajudaCep.textContent = [r.logradouro, r.bairro, `${r.cidade}/${r.uf}`].filter(Boolean).join(' · ');
        const endereco = document.getElementById('f-endereco');
        if (endereco && !endereco.value.trim() && r.logradouro) {
            endereco.value = `${r.logradouro}, `;
            dados.endereco = endereco.value;
        }
        const lista = infoColeta()?.regiao.bairros ?? [];
        if (!r.bairro) return;
        if (!lista.length) {
            if (!String(dados.bairro ?? '').trim()) { dados.bairro = r.bairro; renderBairro(); }
            return;
        }
        const achado = lista.find((b) => normalizar(b) === normalizar(r.bairro));
        if (achado) {
            dados.bairro = achado;
            renderBairro();
        } else {
            ajudaCep.textContent += ` — bairro "${r.bairro}" não está na região desta coleta`;
        }
    }

    const galeria = h('div', { class: 'galeria' });
    function renderFotos() {
        galeria.replaceChildren(...fotos.map((f) => h('figure', {},
            h('img', { src: f.url, alt: 'Foto dos resíduos' }),
            h('button', {
                type: 'button', class: 'remover', 'aria-label': 'Remover foto',
                onclick: () => { URL.revokeObjectURL(f.url); fotos = fotos.filter((x) => x !== f); renderFotos(); },
            }, '×'))));
        contadorFotos.textContent = `${fotos.length}/${FORM_VOLUMOSOS.fotos.max}`;
    }
    const contadorFotos = h('span', { class: 'ajuda' });
    const inputFotos = h('input', {
        type: 'file', accept: 'image/*', multiple: true, class: 'oculto',
        onchange: async (e) => {
            const arquivos = [...e.target.files];
            e.target.value = '';
            for (const arq of arquivos) {
                if (fotos.length >= FORM_VOLUMOSOS.fotos.max) { toast(`Máximo de ${FORM_VOLUMOSOS.fotos.max} fotos`, 'erro'); break; }
                try {
                    const blob = await comprimirFoto(arq);
                    fotos.push({ id: uuidv7(), blob, nome: arq.name, url: URL.createObjectURL(blob) });
                } catch (err) {
                    toast(`Não foi possível ler ${arq.name}: ${err.message}`, 'erro');
                }
            }
            renderFotos();
        },
    });

    const form = h('form', {
        class: 'card form', novalidate: true,
        onsubmit: async (e) => {
            e.preventDefault();
            const ci = infoColeta();
            try {
                if (!ci) throw new Error('Escolha a coleta');
                const daColeta = await db.porIndice('agendamentos', 'coletaId', ci.coleta.id);
                validarAgendamento({
                    formulario: FORM_VOLUMOSOS, dados, qtdFotos: fotos.length,
                    coleta: ci.coleta, regiao: ci.regiao, agendamentosDaColeta: daColeta,
                    hoje: hojeLocal(), ignorarId: editando?.id,
                });
                const agora = new Date().toISOString();
                const ag = {
                    ...(editando ?? { id: uuidv7(), criadoEm: agora, status: 'pendente' }),
                    coletaId: ci.coleta.id,
                    formId: FORM_VOLUMOSOS.id,
                    formVersao: FORM_VOLUMOSOS.versao,
                    dados: { ...dados },
                    atualizadoEm: agora,
                };
                await db.gravarAgendamentoComFotos(ag, fotos.map(({ url, ...f }) => f));
                fotos.forEach((f) => URL.revokeObjectURL(f.url));
                toast(editando ? 'Agendamento atualizado' : 'Agendamento registrado');
                navegar(`#/coleta/${ci.coleta.id}`);
            } catch (err) {
                toast(err.message, 'erro');
            }
        },
    },
    h('div', {}, h('label', { for: 'coleta' }, 'Coleta *'), selColeta, info),
    FORM_VOLUMOSOS.campos.map(campoForm),
    h('div', {},
        h('label', {}, `Imagens dos resíduos${FORM_VOLUMOSOS.fotos.min ? ' *' : ' (opcional)'} `, contadorFotos),
        galeria,
        h('button', { type: 'button', class: 'btn btn-sec', onclick: () => inputFotos.click() }, '🖼️ Adicionar imagem'),
        inputFotos),
    h('div', { class: 'acoes' },
        h('button', { type: 'submit', class: 'btn' }, editando ? 'Salvar alterações' : 'Registrar agendamento')));

    renderBairro();
    renderInfo();
    renderFotos();
    main.replaceChildren(h('h1', {}, editando ? 'Editar agendamento' : 'Novo agendamento'), form);
}

// ── Tela: Coletas (programação) ─────────────────────────────

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function telaColetas(params) {
    const { regioes, coletasInfo, hoje } = await carregarTudo();
    const main = $main();
    const verPassadas = params.get('passadas') === '1';

    if (regioes.length === 0) {
        main.replaceChildren(h('h1', {}, 'Programação de coletas'),
            vazio('Cadastre primeiro as regiões.', h('a', { class: 'btn', href: '#/regioes' }, 'Ir para Regiões')));
        return;
    }

    const prog = { regiaoId: regioes[0].id, inicio: hoje, fim: '', diasSemana: [], intervaloSemanas: 1, local: '', limite: '' };
    const preview = h('p', { class: 'ajuda' });
    function atualizarPreview() {
        try {
            const regiao = regioes.find((r) => r.id === prog.regiaoId);
            const datas = gerarDatasProgramacao({ ...prog, fim: prog.fim || prog.inicio });
            const j = datas.length ? janelaInscricao(datas[0], regiao.regra) : null;
            preview.textContent = datas.length
                ? `${datas.length} coleta(s). Primeira: ${formatarData(datas[0], true)} — inscrições de ${formatarData(j.abre)} a ${formatarData(j.fecha)}.`
                : 'Nenhuma data no período para os dias escolhidos.';
        } catch (err) {
            preview.textContent = err.message;
        }
    }

    const formProg = h('form', {
        class: 'card form',
        oninput: atualizarPreview,
        onchange: atualizarPreview,
        onsubmit: async (e) => {
            e.preventDefault();
            try {
                const datas = gerarDatasProgramacao({ ...prog, fim: prog.fim || prog.inicio });
                const existentes = new Set(coletasInfo.filter((ci) => ci.regiao.id === prog.regiaoId && !ci.coleta.cancelada).map((ci) => ci.coleta.data));
                const novas = datas.filter((d) => !existentes.has(d));
                const limite = String(prog.limite).trim() === '' ? null : Math.max(1, parseInt(prog.limite, 10));
                for (const data of novas) {
                    await db.gravar('coletas', {
                        id: uuidv7(), regiaoId: prog.regiaoId, data, local: prog.local.trim() || null,
                        limite: Number.isFinite(limite) ? limite : null, cancelada: false, criadoEm: new Date().toISOString(),
                    });
                }
                toast(`${novas.length} coleta(s) programada(s)${datas.length > novas.length ? ` · ${datas.length - novas.length} já existia(m)` : ''}`);
                telaColetas(params);
            } catch (err) {
                toast(err.message, 'erro');
            }
        },
    },
    h('h2', {}, 'Programar coletas'),
    h('div', {}, h('label', { for: 'p-regiao' }, 'Região'),
        h('select', { id: 'p-regiao', onchange: (e) => { prog.regiaoId = e.target.value; } },
            regioes.map((r) => h('option', { value: r.id }, `${r.nome} (${descreverRegra(r.regra)})`)))),
    h('div', { class: 'linha' },
        h('div', {}, h('label', { for: 'p-ini' }, 'De'), h('input', { id: 'p-ini', type: 'date', value: prog.inicio, required: true, oninput: (e) => { prog.inicio = e.target.value; } })),
        h('div', {}, h('label', { for: 'p-fim' }, 'Até'), h('input', { id: 'p-fim', type: 'date', oninput: (e) => { prog.fim = e.target.value; } }))),
    h('fieldset', {}, h('legend', {}, 'Dia(s) da coleta'),
        h('div', { class: 'chips' }, DIAS_CURTOS.map((d, i) => h('label', { class: 'chip' },
            h('input', {
                type: 'checkbox',
                onchange: (e) => {
                    prog.diasSemana = e.target.checked ? [...prog.diasSemana, i] : prog.diasSemana.filter((x) => x !== i);
                },
            }), d)))),
    h('div', { class: 'linha' },
        h('div', {}, h('label', { for: 'p-int' }, 'Repetir a cada'),
            h('select', { id: 'p-int', onchange: (e) => { prog.intervaloSemanas = Number(e.target.value); } },
                [1, 2, 3, 4].map((n) => h('option', { value: n }, n === 1 ? 'semana' : `${n} semanas`)))),
        h('div', {}, h('label', { for: 'p-lim' }, 'Limite por coleta'),
            h('input', { id: 'p-lim', type: 'number', min: 1, placeholder: 'sem limite', oninput: (e) => { prog.limite = e.target.value; } }))),
    h('div', {}, h('label', { for: 'p-local' }, 'Local / ponto de encontro (opcional)'),
        h('input', { id: 'p-local', type: 'text', oninput: (e) => { prog.local = e.target.value; } })),
    preview,
    h('div', { class: 'acoes' }, h('button', { type: 'submit', class: 'btn' }, 'Programar')));

    async function cancelar(ci) {
        const n = ci.agendamentos.length;
        if (!confirm(`Cancelar a coleta de ${formatarData(ci.coleta.data)} (${ci.regiao.nome})?${n ? `\n${n} agendamento(s) ficarão sem coleta.` : ''}`)) return;
        await db.gravar('coletas', { ...ci.coleta, cancelada: true });
        telaColetas(params);
    }

    async function remover(ci) {
        if (!confirm(`Excluir a coleta de ${formatarData(ci.coleta.data)} (${ci.regiao.nome})?`)) return;
        await db.remover('coletas', ci.coleta.id);
        telaColetas(params);
    }

    const lista = coletasInfo.filter((ci) => verPassadas || ci.coleta.data >= hoje);
    const tabela = lista.length
        ? h('div', { class: 'lista' }, lista.map((ci) => h('article', { class: `item ${ci.coleta.cancelada ? 'apagado' : ''}` },
            h('div', { class: 'item-topo' },
                h('strong', {}, formatarData(ci.coleta.data, true)),
                badge(ci.situacao)),
            h('div', {}, ci.regiao.nome, ci.coleta.local ? ` · ${ci.coleta.local}` : ''),
            h('div', { class: 'ajuda' },
                `Inscrições ${formatarData(ci.janela.abre)} → ${formatarData(ci.janela.fecha)} · `,
                `${ci.agendamentos.length}${ci.coleta.limite != null ? `/${ci.coleta.limite}` : ''} agendado(s)`),
            h('div', { class: 'acoes' },
                h('a', { class: 'btn btn-sec', href: `#/coleta/${ci.coleta.id}` }, 'Checklist'),
                ci.situacao === 'aberta' ? h('a', { class: 'btn btn-sec', href: `#/agendar?coleta=${ci.coleta.id}` }, '+ Agendar') : null,
                !ci.coleta.cancelada && ci.agendamentos.length > 0 ? h('button', { class: 'btn btn-perigo', onclick: () => cancelar(ci) }, 'Cancelar') : null,
                ci.agendamentos.length === 0 ? h('button', { class: 'btn btn-perigo', onclick: () => remover(ci) }, 'Excluir') : null))))
        : vazio('Nenhuma coleta programada.');

    main.replaceChildren(
        h('h1', {}, 'Programação de coletas'),
        formProg,
        h('div', { class: 'item-topo' }, h('h2', {}, 'Coletas'),
            h('a', { href: verPassadas ? '#/coletas' : '#/coletas?passadas=1' }, verPassadas ? 'Ocultar passadas' : 'Mostrar passadas')),
        tabela);
    atualizarPreview();
}

// ── Tela: Checklist da coleta ───────────────────────────────

async function telaChecklist(coletaId) {
    const main = $main();
    const coleta = await db.obter('coletas', coletaId);
    const regiao = coleta && await db.obter('regioes', coleta.regiaoId);
    if (!coleta || !regiao) {
        main.replaceChildren(vazio('Coleta não encontrada.', h('a', { class: 'btn', href: '#/coletas' }, 'Voltar')));
        return;
    }
    const todos = await db.porIndice('agendamentos', 'coletaId', coletaId);
    const itens = montarChecklist(todos);
    const fotosPorAg = new Map(await Promise.all(itens.map(async (a) => [a.id, await db.porIndice('fotos', 'agendamentoId', a.id)])));
    const hoje = hojeLocal();
    const situacao = situacaoInscricao(coleta, regiao, hoje, itens.length);
    const texto = textoChecklist(coleta, regiao, itens);

    async function marcar(ag, status) {
        await db.gravar('agendamentos', { ...ag, status, atualizadoEm: new Date().toISOString() });
        telaChecklist(coletaId);
    }

    async function confirmarCidadao(ag) {
        const msg = mensagemConfirmacao(coleta, ag, ORIENTACOES_CIDADAO);
        window.open(linkWhatsApp(ag.dados.telefone, msg), '_blank', 'noopener');
        await db.gravar('agendamentos', { ...ag, confirmacaoEnviadaEm: new Date().toISOString() });
        telaChecklist(coletaId);
    }

    async function copiarConfirmacao(ag) {
        try {
            await navigator.clipboard.writeText(mensagemConfirmacao(coleta, ag, ORIENTACOES_CIDADAO));
            toast('Mensagem de confirmação copiada');
        } catch {
            toast('Não foi possível copiar', 'erro');
        }
    }

    async function cancelarAg(ag) {
        if (!confirm(`Cancelar o agendamento de ${ag.dados.cliente_nome}?`)) return;
        await marcar(ag, 'cancelado');
    }

    async function compartilhar() {
        if (navigator.share) {
            try { await navigator.share({ title: `Coleta ${formatarData(coleta.data)}`, text: texto }); return; } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    }

    async function copiar() {
        try { await navigator.clipboard.writeText(texto); toast('Texto copiado'); } catch { toast('Não foi possível copiar', 'erro'); }
    }

    async function enviarDrive(botao) {
        const cfg = await db.lerConfig('drive');
        if (!cfg?.url || !cfg?.token) { toast('Configure o Apps Script em Ajustes', 'erro'); return; }
        const pendentes = [];
        for (const ag of itens) for (const f of fotosPorAg.get(ag.id) ?? []) if (!f.driveId) pendentes.push({ ag, f });
        if (!pendentes.length) { toast('Todas as fotos já estão no Drive'); return; }
        botao.disabled = true;
        let ok = 0;
        try {
            for (const { ag, f } of pendentes) {
                botao.textContent = `Enviando ${ok + 1}/${pendentes.length}…`;
                const r = await enviarFoto(cfg, caminhoFoto(coleta, ag.id, f.id), f.blob);
                await db.gravar('fotos', { ...f, driveId: r.id, driveUrl: r.url ?? null, enviadoEm: new Date().toISOString() });
                ok++;
            }
            toast(`${ok} foto(s) enviada(s) ao Drive`);
        } catch (err) {
            toast(`Falha após ${ok} foto(s): ${err.message}`, 'erro');
        } finally {
            telaChecklist(coletaId);
        }
    }

    const totalFotos = [...fotosPorAg.values()].reduce((n, fs) => n + fs.length, 0);
    const fotosNoDrive = [...fotosPorAg.values()].reduce((n, fs) => n + fs.filter((f) => f.driveId).length, 0);

    main.replaceChildren(
        h('div', { class: 'cabecalho-check' },
            h('h1', {}, `Coleta ${formatarData(coleta.data, true)}`),
            h('p', {}, regiao.nome, coleta.local ? ` · ${coleta.local}` : '', ' · ', badge(situacao)),
            h('p', { class: 'ajuda' }, `${itens.length} ponto(s) · ${itens.filter((a) => a.status === 'coletado').length} coletado(s)`)),
        h('div', { class: 'acoes nao-imprimir' },
            h('button', { class: 'btn', onclick: compartilhar }, '📤 Enviar ao motorista'),
            h('button', { class: 'btn btn-sec', onclick: () => window.print() }, '🖨️ Imprimir'),
            h('button', { class: 'btn btn-sec', onclick: copiar }, 'Copiar texto'),
            totalFotos ? h('button', { class: 'btn btn-sec', onclick: (e) => enviarDrive(e.currentTarget) }, `☁️ Fotos ao Drive (${fotosNoDrive}/${totalFotos})`) : null,
            situacao === 'aberta' ? h('a', { class: 'btn btn-sec', href: `#/agendar?coleta=${coleta.id}` }, '+ Agendar') : null),
        itens.length === 0 ? vazio('Nenhum agendamento nesta coleta.') : h('ol', { class: 'checklist' }, itens.map((a) => {
            const d = a.dados;
            const fotos = fotosPorAg.get(a.id) ?? [];
            return h('li', { class: `ponto ponto-${a.status}` },
                h('div', { class: 'ponto-topo' },
                    h('span', { class: 'caixa', 'aria-hidden': 'true' }, a.status === 'coletado' ? '☑' : a.status === 'nao_coletado' ? '☒' : '☐'),
                    h('div', {},
                        h('strong', {}, d.endereco), h('div', {}, d.bairro, d.cep ? ` · CEP ${formatarCep(d.cep)}` : ''),
                        h('div', {}, `${d.cliente_nome} · `, h('a', { href: `tel:${String(d.telefone).replace(/[^\d+]/g, '')}` }, d.telefone)),
                        h('div', {}, (d.tipo_residuo ?? []).join(', '), d.quantidade ? ` · ~${d.quantidade} m³` : ''),
                        d.descricao ? h('div', {}, d.descricao) : null,
                        d.observacoes ? h('div', { class: 'obs' }, `Obs.: ${d.observacoes}`) : null,
                        h('div', { class: 'ajuda' }, `Protocolo ${protocolo(a)}`,
                            a.confirmacaoEnviadaEm ? ' · confirmação enviada' : ''))),
                fotos.length ? h('div', { class: 'galeria mini' }, fotos.map((f) => {
                    const url = URL.createObjectURL(f.blob);
                    return h('a', { href: url, target: '_blank', rel: 'noopener' }, h('img', { src: url, alt: 'Foto dos resíduos' }));
                })) : null,
                h('div', { class: 'acoes nao-imprimir' },
                    h('button', { class: a.confirmacaoEnviadaEm ? 'btn btn-sec' : 'btn', onclick: () => confirmarCidadao(a) },
                        a.confirmacaoEnviadaEm ? '💬 Reenviar confirmação' : '💬 Confirmar ao cidadão'),
                    h('button', { class: 'btn btn-sec', onclick: () => copiarConfirmacao(a) }, 'Copiar confirmação')),
                h('div', { class: 'acoes nao-imprimir' },
                    h('button', { class: 'btn btn-sec', onclick: () => marcar(a, a.status === 'coletado' ? 'pendente' : 'coletado') }, a.status === 'coletado' ? 'Desfazer' : '✓ Coletado'),
                    a.status !== 'nao_coletado' ? h('button', { class: 'btn btn-sec', onclick: () => marcar(a, 'nao_coletado') }, 'Não coletado') : null,
                    h('a', { class: 'btn btn-sec', href: `#/agendar?ag=${a.id}` }, 'Editar'),
                    h('button', { class: 'btn btn-perigo', onclick: () => cancelarAg(a) }, 'Cancelar')));
        })));
}

// ── Tela: Regiões ───────────────────────────────────────────

async function telaRegioes(params) {
    const main = $main();
    const regioes = (await db.listar('regioes')).sort((a, b) => a.nome.localeCompare(b.nome));
    const editando = params.get('id') ? regioes.find((r) => r.id === params.get('id')) : null;
    const r = editando ?? { nome: '', bairros: [], regra: { tipo: 'semana_anterior' } };
    const estado = { nome: r.nome, bairros: r.bairros.join('\n'), tipo: r.regra.tipo, dias: r.regra.dias ?? 3 };

    const campoDias = h('div', {}, h('label', { for: 'r-dias' }, 'Dias de antecedência'),
        h('input', { id: 'r-dias', type: 'number', min: 1, max: 60, value: estado.dias, oninput: (e) => { estado.dias = e.target.value; } }));
    const mostrarDias = () => { campoDias.hidden = estado.tipo !== 'dias_antes'; };

    const form = h('form', {
        class: 'card form',
        onsubmit: async (e) => {
            e.preventDefault();
            try {
                const nome = estado.nome.trim();
                if (!nome) throw new Error('Informe o nome da região');
                const regra = estado.tipo === 'dias_antes' ? { tipo: 'dias_antes', dias: Number(estado.dias) } : { tipo: 'semana_anterior' };
                validarRegra(regra);
                const bairros = [...new Set(estado.bairros.split('\n').map((b) => b.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
                const conflito = regioes.find((o) => o.id !== editando?.id && o.bairros.some((b) => bairros.includes(b)));
                if (conflito) {
                    const repetidos = conflito.bairros.filter((b) => bairros.includes(b)).join(', ');
                    throw new Error(`Bairro(s) já na região ${conflito.nome}: ${repetidos}`);
                }
                await db.gravar('regioes', { id: editando?.id ?? uuidv7(), nome, bairros, regra });
                toast('Região salva');
                navegar('#/regioes');
            } catch (err) {
                toast(err.message, 'erro');
            }
        },
    },
    h('h2', {}, editando ? `Editar ${editando.nome}` : 'Nova região'),
    h('div', {}, h('label', { for: 'r-nome' }, 'Nome'),
        h('input', { id: 'r-nome', type: 'text', required: true, value: estado.nome, oninput: (e) => { estado.nome = e.target.value; } })),
    h('div', {}, h('label', { for: 'r-regra' }, 'Abertura das inscrições'),
        h('select', { id: 'r-regra', onchange: (e) => { estado.tipo = e.target.value; mostrarDias(); } },
            Object.entries(REGRAS_ABERTURA).map(([k, v]) => h('option', { value: k, selected: k === estado.tipo }, v))),
        h('p', { class: 'ajuda' }, 'As inscrições sempre encerram na véspera da coleta.')),
    campoDias,
    h('div', {}, h('label', { for: 'r-bairros' }, 'Bairros atendidos (um por linha)'),
        h('textarea', { id: 'r-bairros', rows: 6, value: estado.bairros, oninput: (e) => { estado.bairros = e.target.value; } }),
        h('p', { class: 'ajuda' }, 'Deixe vazio para aceitar qualquer bairro digitado.')),
    h('div', { class: 'acoes' },
        h('button', { type: 'submit', class: 'btn' }, 'Salvar'),
        editando ? h('a', { class: 'btn btn-sec', href: '#/regioes' }, 'Cancelar edição') : null));
    mostrarDias();

    async function excluir(reg) {
        const coletas = await db.porIndice('coletas', 'regiaoId', reg.id);
        if (coletas.length) { toast('Região tem coletas programadas — exclua-as antes', 'erro'); return; }
        if (!confirm(`Excluir a região ${reg.nome}?`)) return;
        await db.remover('regioes', reg.id);
        telaRegioes(new URLSearchParams());
    }

    main.replaceChildren(
        h('h1', {}, 'Regiões'),
        form,
        regioes.length ? h('div', { class: 'lista' }, regioes.map((reg) => h('article', { class: 'item' },
            h('div', { class: 'item-topo' }, h('strong', {}, reg.nome), h('span', { class: 'ajuda' }, descreverRegra(reg.regra))),
            h('div', { class: 'ajuda' }, reg.bairros.length ? reg.bairros.join(', ') : 'qualquer bairro'),
            h('div', { class: 'acoes' },
                h('a', { class: 'btn btn-sec', href: `#/regioes?id=${reg.id}` }, 'Editar'),
                h('button', { class: 'btn btn-perigo', onclick: () => excluir(reg) }, 'Excluir'))))) : vazio('Nenhuma região cadastrada.'));
}

// ── Tela: Ajustes ───────────────────────────────────────────

async function telaAjustes() {
    const main = $main();
    const cfg = { url: '', token: '', ...(await db.lerConfig('drive', {})) };

    const formDrive = h('form', {
        class: 'card form',
        onsubmit: async (e) => {
            e.preventDefault();
            await db.gravarConfig('drive', { url: cfg.url.trim(), token: cfg.token.trim() });
            toast('Configuração salva');
        },
    },
    h('h2', {}, 'Google Drive (Apps Script)'),
    h('p', { class: 'ajuda' }, 'Opcional. Usa o Web App do EcoForms com uma credencial por dispositivo que tenha as ações health e uploadFile e o prefixo "volumosos/".'),
    h('div', {}, h('label', { for: 'd-url' }, 'URL do Web App'),
        h('input', { id: 'd-url', type: 'url', value: cfg.url, placeholder: 'https://script.google.com/macros/s/…/exec', oninput: (e) => { cfg.url = e.target.value; } })),
    h('div', {}, h('label', { for: 'd-tok' }, 'Credencial do dispositivo'),
        h('input', { id: 'd-tok', type: 'password', value: cfg.token, autocomplete: 'off', oninput: (e) => { cfg.token = e.target.value; } })),
    h('div', { class: 'acoes' },
        h('button', { type: 'submit', class: 'btn' }, 'Salvar'),
        h('button', {
            type: 'button', class: 'btn btn-sec',
            onclick: async () => {
                try { await testarConexao({ url: cfg.url.trim(), token: cfg.token.trim() }); toast('Conexão OK'); } catch (err) { toast(err.message, 'erro'); }
            },
        }, 'Testar')));

    const inputImport = h('input', {
        type: 'file', accept: 'application/json', class: 'oculto',
        onchange: async (e) => {
            const arq = e.target.files[0];
            e.target.value = '';
            if (!arq) return;
            try {
                await db.importar(JSON.parse(await arq.text()));
                toast('Backup importado');
            } catch (err) {
                toast(err.message, 'erro');
            }
        },
    });

    const backup = h('div', { class: 'card form' },
        h('h2', {}, 'Backup'),
        h('p', { class: 'ajuda' }, 'Os dados ficam só neste aparelho. Exporte regularmente — o arquivo inclui as fotos.'),
        h('div', { class: 'acoes' },
            h('button', {
                class: 'btn',
                onclick: async () => {
                    const dados = await db.exportar();
                    const url = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' }));
                    h('a', { href: url, download: `volumosos-backup-${hojeLocal()}.json` }).click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                },
            }, 'Exportar'),
            h('button', { class: 'btn btn-sec', onclick: () => inputImport.click() }, 'Importar'),
            inputImport));

    main.replaceChildren(h('h1', {}, 'Ajustes'), formDrive, backup);
}

// ── Roteamento ──────────────────────────────────────────────

async function rotear() {
    const [caminho, query = ''] = location.hash.replace(/^#/, '').split('?');
    const params = new URLSearchParams(query);
    const partes = caminho.split('/').filter(Boolean);
    const rota = partes[0] ?? 'agendar';

    document.querySelectorAll('nav a').forEach((a) => {
        a.classList.toggle('ativo', a.dataset.rota === rota || (rota === 'coleta' && a.dataset.rota === 'coletas'));
    });

    try {
        if (rota === 'agendar') await telaAgendar(params);
        else if (rota === 'coletas') await telaColetas(params);
        else if (rota === 'coleta' && partes[1]) await telaChecklist(partes[1]);
        else if (rota === 'regioes') await telaRegioes(params);
        else if (rota === 'ajustes') await telaAjustes();
        else location.hash = '#/agendar';
    } catch (err) {
        console.error(err);
        $main().replaceChildren(vazio(`Erro: ${err.message}`));
    }
    window.scrollTo(0, 0);
}

window.addEventListener('hashchange', rotear);
rotear();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker não registrado', err));
}
