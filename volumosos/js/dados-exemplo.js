// Dados de exemplo para demonstração e testes.
//
// `planejarExemplo(hoje)` é pura (sem DOM nem IndexedDB): devolve regiões,
// coletas e agendamentos prontos para gravar, cobrindo todas as situações de
// inscrição (encerrada, aberta, lotada e aguardando) em relação a `hoje`.
// Cada registro vai marcado com `exemplo: true` para que a remoção seja limpa.
//
// As fotos são geradas no navegador (canvas → JPEG "FOTO DE EXEMPLO"); ver
// `fotosExemplo` abaixo — specs puras, o blob é criado pela tela de Ajustes.

import { uuidv7 } from './id.js';
import { addDias, inicioSemana } from './regras.js';

/** CPFs fictícios com dígitos verificadores válidos (passam em cpfValido). */
const CPFS = [
    '123.456.789-09',
    '234.567.890-92',
    '345.678.901-75',
    '456.789.012-49',
    '567.890.123-03',
    '678.901.234-69',
    '789.012.345-05',
    '901.234.567-70',
];

/**
 * Monta o conjunto de exemplo relativo a `hoje` ('YYYY-MM-DD').
 * IDs são estáveis DENTRO de uma chamada (agendamentos referenciam coletas),
 * mas novos a cada carga — gravar duas vezes duplica; a remoção apaga tudo
 * que tiver `exemplo: true`.
 */
export function planejarExemplo(hoje) {
    const regioes = [
        {
            id: uuidv7(), exemplo: true, nome: 'Continente (exemplo)',
            bairros: ['Estreito', 'Capoeiras', 'Coqueiros', 'Itaguaçu'],
            regra: { tipo: 'dias_antes', dias: 3 },
        },
        {
            id: uuidv7(), exemplo: true, nome: 'Centro (exemplo)',
            bairros: ['Centro', 'Agronômica', 'Trindade', 'Saco dos Limões'],
            regra: { tipo: 'semana_anterior' },
        },
    ];
    const [continente, centro] = regioes;

    const coletas = [
        // Já aconteceu: inscrições encerradas, com pontos coletados e pendentes.
        {
            id: uuidv7(), exemplo: true, regiaoId: continente.id, data: addDias(hoje, -5),
            local: 'Pátio da subprefeitura (exemplo)', limite: 10,
        },
        // Daqui a 2 dias: aberta hoje (regra de 3 dias de antecedência).
        {
            id: uuidv7(), exemplo: true, regiaoId: continente.id, data: addDias(hoje, 2),
            local: null, limite: 8,
        },
        // Daqui a 3 dias com limite 2 e 2 agendados: lotada hoje.
        {
            id: uuidv7(), exemplo: true, regiaoId: continente.id, data: addDias(hoje, 3),
            local: null, limite: 2,
        },
        // Segunda-feira daqui a 2 semanas: aguardando abertura (semana anterior).
        {
            id: uuidv7(), exemplo: true, regiaoId: centro.id, data: addDias(inicioSemana(hoje), 14),
            local: 'Praça central (exemplo)', limite: null,
        },
    ];
    const [passada, aberta, lotada, futura] = coletas;

    function agendamento(coleta, i, { bairro, cep, endereco, tipos, descricao, quantidade, status = 'pendente', comFoto = false } = {}) {
        const agora = new Date(`${hoje}T09:${String(i).padStart(2, '0')}:00`).toISOString();
        return {
            id: uuidv7(), exemplo: true, coletaId: coleta.id,
            formId: 'form-agendamento-volumosos', formVersao: 2,
            status, criadoEm: agora, atualizadoEm: agora,
            dados: {
                cliente_nome: ['Maria Souza', 'João Pereira', 'Ana Lima', 'Carlos Nunes', 'Beatriz Rocha', 'Paulo Dias', 'Lúcia Martins', 'Pedro Alves'][i % 8],
                cliente_id: CPFS[i % CPFS.length],
                telefone: `(48) 99123-${1000 + i}`,
                email: `exemplo${i}@email.test`,
                cep, endereco, bairro,
                tipo_residuo: tipos, descricao, quantidade,
                observacoes: 'Agendamento de exemplo — dados fictícios.',
            },
            foto: comFoto ? { nome: `exemplo-${i + 1}.jpg`, legenda: descricao } : null,
        };
    }

    const agendamentos = [
        // Coleta passada: um coletado, um não coletado.
        { ...agendamento(passada, 0, { bairro: 'Estreito', cep: '88070-100', endereco: 'Rua das Acácias, 120 (exemplo)', tipos: ['Móveis'], descricao: '1 sofá de 2 lugares', quantidade: 0.8, status: 'coletado', comFoto: true }) },
        { ...agendamento(passada, 1, { bairro: 'Capoeiras', cep: '88085-200', endereco: 'Servidão do Sol, 45 (exemplo)', tipos: ['Eletrodomésticos'], descricao: '1 geladeira antiga', quantidade: 0.7, status: 'nao_coletado' }) },
        // Coleta aberta hoje: dois pontos pendentes, um com foto.
        { ...agendamento(aberta, 2, { bairro: 'Coqueiros', cep: '88080-300', endereco: 'Av. Litorânea, 900 (exemplo)', tipos: ['Madeiras (separadas de outros materiais)'], descricao: 'Tábuas de um deck pequeno', quantidade: 0.6, comFoto: true }) },
        { ...agendamento(aberta, 3, { bairro: 'Itaguaçu', cep: '88075-400', endereco: 'Rua do Mirante, 33 (exemplo)', tipos: ['Móveis', 'Eletrodomésticos'], descricao: '1 colchão de casal e 1 fogão 4 bocas', quantidade: 1 }) },
        // Coleta lotada: ocupa as 2 vagas.
        { ...agendamento(lotada, 4, { bairro: 'Estreito', cep: '88070-250', endereco: 'Rua dos Coqueirais, 77 (exemplo)', tipos: ['Latas e pneus'], descricao: '4 pneus de carro', quantidade: 0.4 }) },
        { ...agendamento(lotada, 5, { bairro: 'Capoeiras', cep: '88085-350', endereco: 'Rua Bela Vista, 210 (exemplo)', tipos: ['Restos de construção (pequena quantidade, ensacados)'], descricao: '3 sacos de restos de reforma', quantidade: 0.5 }) },
    ];

    return { regioes, coletas, agendamentos };
}

/**
 * Specs das fotos de exemplo (o blob JPEG é gerado no navegador pela UI).
 * Devolve [{ agendamentoId, nome, legenda }] para os agendamentos com foto.
 */
export function fotosExemplo(agendamentos) {
    return agendamentos.filter((a) => a.foto).map((a) => ({ agendamentoId: a.id, ...a.foto }));
}

/** Remove a marca interna `foto` antes de gravar os agendamentos no banco. */
export function semFotoInterna(agendamento) {
    const { foto, ...resto } = agendamento;
    return resto;
}
