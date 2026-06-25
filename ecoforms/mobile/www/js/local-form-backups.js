(function () {
  const buildField = (id, label, type, props = {}) => ({
    id,
    label,
    type,
    ...props
  });

  const buildSelectField = (id, label, options, props = {}) => ({
    id,
    label,
    type: 'select',
    options: options.map(option =>
      typeof option === 'string' ? { value: option, label: option } : option
    ),
    showEmptyOption: true,
    emptyOptionValue: '',
    emptyOptionLabel: 'Selecione...',
    ...props
  });

  const createForm = (id, title, description, fields) => ({
    id,
    titulo: title,
    descricao: description,
    version: '1.0',
    campos: fields
  });

  const fallbackForms = {
    ecopontoCaixasForm: createForm(
      'ecopontoCaixasForm',
      'Caixas de Ecoponto',
      'Registro rapido do status das caixas no ecoponto.',
      [
        buildField('ecoponto', 'Ecoponto', 'text', { placeholder: 'Nome do ecoponto' }),
        buildField('data', 'Data', 'date', { required: true }),
        buildField('quantidade_caixas', 'Quantidade de caixas ocupadas', 'number'),
        buildSelectField('nivel_ocupacao', 'Nivel de ocupacao', [
          { value: '0', label: 'Vazia (0%)' },
          { value: '50', label: 'Meio cheia (50%)' },
          { value: '75', label: 'Quase cheia (75%)' },
          { value: '100', label: 'Cheia (100%)' }
        ]),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    ecopontoForm: createForm(
      'ecopontoForm',
      'Atendimento em Ecoponto',
      'Formulario simplificado para registrar atendimentos realizados no ecoponto.',
      [
        buildField('operador', 'Operador responsavel', 'text', { required: true, placeholder: 'Nome do operador' }),
        buildField('ecoponto', 'Ecoponto atendido', 'text'),
        buildField('data', 'Data', 'date', { required: true }),
        buildField('hora', 'Hora', 'time', { required: true }),
        buildField('residuos', 'Residuos entregues', 'textarea')
      ]
    ),

    galpaoChamadaForm: createForm(
      'galpaoChamadaForm',
      'Chamada de Triadores',
      'Controle de presenca dos participantes de um galpao.',
      [
        buildField('galpao', 'Galpao', 'text', { required: true }),
        buildField('participantes_presentes', 'Participantes presentes', 'number'),
        buildSelectField('status_chamada', 'Status da chamada', ['Aguardando', 'Em andamento', 'Concluida']),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    educacaoAmbientalForm: createForm(
      'educacaoAmbientalForm',
      'Educacao Ambiental',
      'Registro das acoes de educacao ambiental realizadas em campo.',
      [
        buildField('data', 'Data da acao', 'date', { required: true }),
        buildField('hora', 'Hora de inicio', 'time'),
        buildField('local', 'Local da atividade', 'text'),
        buildSelectField('tipo_acao', 'Tipo de acao', ['Palestra', 'Oficina', 'Mutirao', 'Outra']),
        buildField('publico_alvo', 'Publico-alvo', 'textarea'),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    colocacaoCaixasForm: createForm(
      'colocacaoCaixasForm',
      'Colocacao de Caixas',
      'Documenta cada nova caixa instalada nos ecopontos.',
      [
        buildField('ecoponto', 'Ecoponto', 'text', { required: true }),
        buildSelectField('tipo_caixa', 'Tipo de caixa', ['Reciclavel', 'Organico', 'Rejeito', 'Outros']),
        buildField('quantidade', 'Quantidade', 'number'),
        buildField('responsavel', 'Responsavel pela instalacao', 'text'),
        buildField('observacoes', 'Observacoes adicionais', 'textarea')
      ]
    ),

    remocaoForm: createForm(
      'remocaoForm',
      'Remocao de Residuos',
      'Registra remocoes de residuos irregulares em campo.',
      [
        buildField('data', 'Data', 'date', { required: true }),
        buildField('hora', 'Hora', 'time', { required: true }),
        buildField('localizacao', 'Localizacao ou referencia', 'text', { placeholder: 'Ex: Rua XXX, bairro YYY' }),
        buildField('descricao', 'Descricao do material removido', 'textarea'),
        buildField('quantidade', 'Quantidade estimada', 'text'),
        buildSelectField('status', 'Status', ['Planejada', 'Em execucao', 'Concluida'])
      ]
    ),

    galpaochecklistForm: createForm(
      'galpaochecklistForm',
      'Checklist de Galpao',
      'Checklist basico para vistorias em galpoes.',
      [
        buildField('galpao', 'Galpao', 'text'),
        buildField('fiscal', 'Fiscal responsavel', 'text'),
        buildSelectField('checklist_status', 'Resultado geral', ['Aprovado', 'Ajustes necessarios', 'Reprovado']),
        buildField('observacoes', 'Observacoes da vistoria', 'textarea')
      ]
    ),

    inspecaoCompleta: createForm(
      'inspecaoCompleta',
      'Inspecao Completa de Galpao',
      'Modelo simplificado da inspecao completa.',
      [
        buildField('titulo_inspecao', 'Titulo da inspecao', 'text'),
        buildField('galpao', 'Galpao', 'text'),
        buildField('data', 'Data', 'date'),
        buildField('resultado', 'Resumo do resultado', 'textarea')
      ]
    ),

    exemploChecklistHierarquico: createForm(
      'exemploChecklistHierarquico',
      'Checklist Hierarquico',
      'Exemplo de formulario hierarquico.',
      [
        buildField('titulo_inspecao', 'Titulo da inspecao', 'text'),
        buildField('data', 'Data', 'date'),
        buildField('observacoes', 'Observacoes gerais', 'textarea')
      ]
    ),

    ecopontoRemocao: createForm(
      'ecopontoRemocao',
      'Remocao em Ecoponto',
      'Painel para acompanhamento das remocoes de caixas.',
      [
        buildField('ecoponto', 'Ecoponto', 'text'),
        buildField('status', 'Status atual', 'text'),
        buildField('justificativa', 'Justificativa da remocao', 'textarea')
      ]
    ),

    testeFORM: createForm(
      'testeFORM',
      'Teste Form',
      'Formulario de teste simplificado.',
      [
        buildField('comentario', 'Comentario', 'textarea'),
        buildField('nota', 'Nota', 'number')
      ]
    ),

    ProactivaForm: createForm(
      'ProactivaForm',
      'Proactiva',
      'Registro de acoes proativas.',
      [
        buildField('acao', 'Acao realizada', 'text'),
        buildField('impacto', 'Impacto esperado', 'textarea'),
        buildField('responsavel', 'Responsavel', 'text')
      ]
    ),

    ecoForm: createForm(
      'ecoForm',
      'Eco Form',
      'Formulario generico de sugestoes ecologicas.',
      [
        buildField('sugestao', 'Sugestao', 'textarea'),
        buildField('impacto', 'Impacto estimado', 'text')
      ]
    ),

    teste2Form: createForm(
      'teste2Form',
      'Teste 2',
      'Segundo formulario de teste.',
      [
        buildField('resumo', 'Resumo', 'textarea'),
        buildField('status', 'Status', 'text')
      ]
    ),

    cadastroflexForm: createForm(
      'cadastroflexForm',
      'Cadastro Flexivel',
      'Cadastro rapido de colaboradores.',
      [
        buildField('nome', 'Nome completo', 'text'),
        buildField('documento', 'Documento', 'text'),
        buildField('telefone', 'Telefone de contato', 'text')
      ]
    ),

    educacaoambientalForm: createForm(
      'educacaoambientalForm',
      'Educacao Ambiental (variante)',
      'Versao alternativa de educacao ambiental.',
      [
        buildField('data', 'Data', 'date'),
        buildField('local', 'Local', 'text'),
        buildSelectField('tipo_acao', 'Tipo de acao', ['Sensibilizacao', 'Mutirao', 'Evento']),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    praialixobombonasForm: createForm(
      'praialixobombonasForm',
      'Praia Lixo Bombonas',
      'Registro de limpeza com bombonas.',
      [
        buildField('localizacao', 'Localizacao', 'text'),
        buildField('quantidade_bombonas', 'Bombonas coletadas', 'number'),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    praialixozeroForm: createForm(
      'praialixozeroForm',
      'Praia Lixo Zero',
      'Registro de forca-tarefa praia lixo zero.',
      [
        buildField('acao', 'Acao realizada', 'text'),
        buildField('qtd_voluntarios', 'Numero de voluntarios', 'number'),
        buildField('observacoes', 'Observacoes', 'textarea')
      ]
    ),

    solicitacaoGeralForm: createForm(
      'solicitacaoGeralForm',
      'Solicitacao Geral',
      'Formulario generico para solicitacoes.',
      [
        buildField('titulo', 'Titulo', 'text'),
        buildField('descricao', 'Descricao da demanda', 'textarea'),
        buildSelectField('prioridade', 'Prioridade', ['Baixa', 'Media', 'Alta'])
      ]
    )
  };

  window.localFormBackups = window.localFormBackups || {};
  window.localFormBackups.forms = window.localFormBackups.forms || fallbackForms;
})();
