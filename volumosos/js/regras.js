// Regras de agendamento de volumosos — funções puras, sem DOM nem IndexedDB.
//
// Datas são sempre strings locais 'YYYY-MM-DD'. A aritmética é feita em UTC
// sobre essas strings para não sofrer com horário de verão/fuso: o que importa
// é o dia do calendário, não o instante.
//
// Modelo:
//   Regiao  { id, nome, bairros: string[], regra: RegraAbertura }
//   Coleta  { id, regiaoId, data, local?, limite?: number|null, cancelada?: boolean }
//   RegraAbertura
//     { tipo: 'semana_anterior' }        → abre na segunda-feira da semana anterior à semana da coleta
//     { tipo: 'dias_antes', dias: N }    → abre N dias antes da data da coleta
//   Em ambos os casos as inscrições vão até a véspera da coleta (inclusive).

export const REGRAS_ABERTURA = {
    semana_anterior: 'Uma semana antes (segunda-feira da semana anterior)',
    dias_antes: 'N dias antes da coleta',
};

const DIA_MS = 24 * 60 * 60 * 1000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function paraUtc(ymd) {
    if (!YMD.test(String(ymd))) throw new Error(`Data inválida: ${ymd}`);
    const [a, m, d] = ymd.split('-').map(Number);
    const t = Date.UTC(a, m - 1, d);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        throw new Error(`Data inválida: ${ymd}`);
    }
    return t;
}

function deUtc(t) {
    return new Date(t).toISOString().slice(0, 10);
}

export function addDias(ymd, n) {
    return deUtc(paraUtc(ymd) + n * DIA_MS);
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(ymd) {
    return new Date(paraUtc(ymd)).getUTCDay();
}

/** Segunda-feira da semana que contém `ymd`. */
export function inicioSemana(ymd) {
    const dow = diaSemana(ymd);
    return addDias(ymd, dow === 0 ? -6 : 1 - dow);
}

/** Data local de hoje como 'YYYY-MM-DD'. */
export function hojeLocal(agora = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export function validarRegra(regra) {
    if (!regra || !REGRAS_ABERTURA[regra.tipo]) throw new Error('Regra de abertura inválida');
    if (regra.tipo === 'dias_antes') {
        const n = Number(regra.dias);
        if (!Number.isInteger(n) || n < 1 || n > 60) {
            throw new Error('Antecedência deve ser um número inteiro de 1 a 60 dias');
        }
    }
}

/** Janela de inscrição { abre, fecha } (ambas inclusivas) de uma coleta. */
export function janelaInscricao(dataColeta, regra) {
    validarRegra(regra);
    const fecha = addDias(dataColeta, -1);
    const abre = regra.tipo === 'semana_anterior'
        ? addDias(inicioSemana(dataColeta), -7)
        : addDias(dataColeta, -Number(regra.dias));
    return { abre, fecha };
}

/**
 * Situação das inscrições de uma coleta num dado dia.
 * @returns {'cancelada'|'aguardando'|'aberta'|'lotada'|'encerrada'}
 */
export function situacaoInscricao(coleta, regiao, hoje, totalAgendados = 0) {
    if (coleta.cancelada) return 'cancelada';
    const { abre, fecha } = janelaInscricao(coleta.data, regiao.regra);
    if (hoje < abre) return 'aguardando';
    if (hoje > fecha) return 'encerrada';
    if (coleta.limite != null && totalAgendados >= coleta.limite) return 'lotada';
    return 'aberta';
}

export const ROTULO_SITUACAO = {
    cancelada: 'Cancelada',
    aguardando: 'Aguardando abertura',
    aberta: 'Inscrições abertas',
    lotada: 'Lotada',
    encerrada: 'Inscrições encerradas',
};

/**
 * Gera as datas de uma programação semanal: todo dia da semana em `diasSemana`
 * (0=dom…6=sáb) entre `inicio` e `fim` (inclusivos), a cada `intervaloSemanas`.
 */
export function gerarDatasProgramacao({ inicio, fim, diasSemana, intervaloSemanas = 1 }) {
    if (!Array.isArray(diasSemana) || diasSemana.length === 0) throw new Error('Escolha ao menos um dia da semana');
    if (fim < inicio) throw new Error('A data final deve ser igual ou posterior à inicial');
    const passo = Math.max(1, Number(intervaloSemanas) || 1);
    if ((paraUtc(fim) - paraUtc(inicio)) / DIA_MS > 400) throw new Error('Programação limitada a ~1 ano por vez');

    // O ciclo de N semanas conta a partir da semana da primeira coleta do período.
    let semanaBase = null;
    const datas = [];
    for (let d = inicio; d <= fim; d = addDias(d, 1)) {
        if (!diasSemana.includes(diaSemana(d))) continue;
        semanaBase ??= inicioSemana(d);
        const semanas = Math.round((paraUtc(inicioSemana(d)) - paraUtc(semanaBase)) / (7 * DIA_MS));
        if (semanas % passo === 0) datas.push(d);
    }
    return datas;
}

export function somenteDigitos(v) {
    return String(v ?? '').replace(/\D/g, '');
}

/** CPF com dígitos verificadores válidos (aceita com ou sem pontuação). */
export function cpfValido(valor) {
    const d = somenteDigitos(valor);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = (n) => {
        let soma = 0;
        for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
        const r = (soma * 10) % 11;
        return r === 10 ? 0 : r;
    };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatarCep(valor) {
    const d = somenteDigitos(valor);
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : String(valor ?? '');
}

/** Normaliza texto para comparação: minúsculas, sem acentos e espaços extras. */
export function normalizar(v) {
    return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Chave da residência (CEP + endereço) — o limite de 1 m³ é por residência. */
function chaveResidencia(dados) {
    return `${somenteDigitos(dados.cep)}|${normalizar(dados.endereco).replace(/[.,;]/g, '')}`;
}

/** Valida o formato de um campo preenchido conforme seu tipo; lança Error. */
function validarCampo(campo, v) {
    if (v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)) return;
    if (campo.type === 'cpf' && !cpfValido(v)) throw new Error('CPF inválido.');
    if (campo.type === 'cep' && somenteDigitos(v).length !== 8) throw new Error('CEP deve ter 8 dígitos.');
    if (campo.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) throw new Error('E-mail inválido.');
    if (campo.type === 'tel' && somenteDigitos(v).length < 10) throw new Error('Telefone deve ter DDD + número.');
    if (campo.type === 'number') {
        const n = Number(String(v).replace(',', '.'));
        if (!Number.isFinite(n)) throw new Error(`${campo.label}: valor inválido.`);
        if (campo.min != null && n < campo.min) throw new Error(`${campo.label}: mínimo ${campo.min}.`);
        if (campo.max != null && n > campo.max) throw new Error(`${campo.label}: máximo ${campo.max}.`);
    }
}

/**
 * Valida um agendamento antes de gravar. Lança Error com mensagem para o usuário.
 * @param {object} p
 * @param {object} p.formulario  definição do formulário (form-volumosos.js)
 * @param {object} p.dados       valores preenchidos
 * @param {number} p.qtdFotos
 * @param {object} p.coleta
 * @param {object} p.regiao
 * @param {object[]} p.agendamentosDaColeta  agendamentos já gravados nessa coleta
 * @param {string} p.hoje
 * @param {string} [p.ignorarId]  id do próprio agendamento, ao editar
 */
export function validarAgendamento({ formulario, dados, qtdFotos, coleta, regiao, agendamentosDaColeta, hoje, ignorarId }) {
    const outros = agendamentosDaColeta.filter((a) => a.id !== ignorarId && a.status !== 'cancelado');

    // Ao editar, o próprio agendamento já ocupa a vaga — não conta como lotação.
    const situacao = situacaoInscricao(coleta, regiao, hoje, outros.length);
    if (situacao !== 'aberta') {
        throw new Error(`Coleta de ${formatarData(coleta.data)} — ${ROTULO_SITUACAO[situacao].toLowerCase()}.`);
    }

    for (const campo of formulario.campos) {
        const v = dados[campo.id];
        if (campo.required) {
            const vazio = Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '';
            if (vazio) throw new Error(`Preencha: ${campo.label}`);
        }
        validarCampo(campo, v);
    }

    if (regiao.bairros.length > 0 && !regiao.bairros.includes(dados.bairro)) {
        throw new Error(`O bairro "${dados.bairro}" não pertence à região ${regiao.nome}.`);
    }

    const { min = 0, max = Infinity } = formulario.fotos ?? {};
    if (qtdFotos < min) throw new Error(min === 1 ? 'Anexe ao menos 1 foto dos resíduos.' : `Anexe ao menos ${min} fotos.`);
    if (qtdFotos > max) throw new Error(`No máximo ${max} fotos por agendamento.`);

    const doc = somenteDigitos(dados.cliente_id);
    if (doc && outros.some((a) => somenteDigitos(a.dados.cliente_id) === doc)) {
        throw new Error('Este CPF já tem agendamento nesta coleta.');
    }
    if (dados.cep && dados.endereco) {
        const chave = chaveResidencia(dados);
        if (outros.some((a) => chaveResidencia(a.dados) === chave)) {
            throw new Error('Este endereço já tem agendamento nesta coleta (limite de 1 m³ por residência).');
        }
    }
}

/** Ordena os agendamentos para o roteiro do motorista: bairro, depois endereço. */
export function montarChecklist(agendamentos) {
    const cmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' });
    return agendamentos
        .filter((a) => a.status !== 'cancelado')
        .slice()
        .sort((a, b) => cmp(a.dados.bairro, b.dados.bairro) || cmp(a.dados.endereco, b.dados.endereco));
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function formatarData(ymd, comDia = false) {
    const [a, m, d] = ymd.split('-');
    return comDia ? `${DIAS[diaSemana(ymd)]}, ${d}/${m}/${a}` : `${d}/${m}/${a}`;
}

function residuos(d) {
    return Array.isArray(d.tipo_residuo) ? d.tipo_residuo.join(', ') : (d.tipo_residuo ?? '');
}

/** Texto do checklist pronto para WhatsApp/compartilhamento. */
export function textoChecklist(coleta, regiao, agendamentos) {
    const itens = montarChecklist(agendamentos);
    const linhas = [
        `*Coleta de Volumosos — ${regiao.nome}*`,
        `${formatarData(coleta.data, true)}${coleta.local ? ` · ${coleta.local}` : ''}`,
        `${itens.length} ponto(s)`,
        '',
    ];
    itens.forEach((a, i) => {
        const d = a.dados;
        linhas.push(`☐ ${i + 1}. ${d.endereco} — ${d.bairro}${d.cep ? ` · CEP ${formatarCep(d.cep)}` : ''}`);
        linhas.push(`   ${d.cliente_nome} · ${d.telefone}`);
        linhas.push(`   ${residuos(d)}${d.quantidade ? ` · ~${d.quantidade} m³` : ''}`);
        if (d.descricao) linhas.push(`   ${d.descricao}`);
        if (d.observacoes) linhas.push(`   Obs.: ${d.observacoes}`);
        linhas.push('');
    });
    return linhas.join('\n').trimEnd();
}

/** Mensagem de confirmação para responder ao cidadão (WhatsApp da central). */
export function mensagemConfirmacao(coleta, agendamento, orientacoes) {
    const d = agendamento.dados;
    const primeiroNome = String(d.cliente_nome ?? '').trim().split(/\s+/)[0] ?? '';
    return [
        `Olá, ${primeiroNome}! Sua coleta de resíduos volumosos está *agendada para ${formatarData(coleta.data, true)}*.`,
        '',
        `Endereço: ${d.endereco} — ${d.bairro}${d.cep ? `, CEP ${formatarCep(d.cep)}` : ''}`,
        `Resíduos: ${residuos(d)}${d.quantidade ? ` (~${d.quantidade} m³)` : ''}`,
        '',
        ...orientacoes.map((o) => `• ${o}`),
        '',
        `Protocolo: ${protocolo(agendamento)}`,
    ].join('\n');
}

/** Protocolo curto e legível derivado do id (UUID v7). */
export function protocolo(agendamento) {
    return String(agendamento.id).replace(/-/g, '').slice(-8).toUpperCase();
}

/** Link wa.me para o telefone do cidadão (assume Brasil quando não houver DDI). */
export function linkWhatsApp(telefone, texto) {
    let n = somenteDigitos(telefone);
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
