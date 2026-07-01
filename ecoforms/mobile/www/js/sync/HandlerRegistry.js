// SQLite inbound handlers for the mobile runtime.
// EventBus dispatches these handlers with CapacitorSqliteAdapter.

function aggregateId(env, data = env.data || {}) {
  return data.id || data.tarefa_id || data.tarefaId || data.cliente_id || data.clienteId || data.roteiro_id || data.roteiroId || data.coleta_id || data.coletaId || env.aggregate?.id || env.aggregate?.packageId || null;
}

function eventTime(env) {
  return env.time || env.created_at || env.createdAt || new Date().toISOString();
}

function asJson(value) {
  return typeof value === 'string' ? value : JSON.stringify(value || {});
}

function boolInt(value, fallback = 1) {
  if (value === undefined || value === null) return fallback;
  return value ? 1 : 0;
}

async function upsertRegistry(db, tipo, chave, conteudo, time) {
  await db.execute(
    `INSERT INTO registro_dados (id, tipo, chave, conteudo, versao, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tipo = excluded.tipo,
       chave = excluded.chave,
       conteudo = excluded.conteudo,
       versao = registro_dados.versao + 1,
       atualizado_em = excluded.atualizado_em`,
    [`${tipo}:${chave}`, tipo, chave, asJson(conteudo), time, time],
  );
}

async function updateTask(db, id, fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!id || entries.length === 0) return;
  const sets = entries.map(([field]) => `${field} = ?`);
  const params = entries.map(([, value]) => value);
  params.push(id);
  await db.execute(`UPDATE tarefas SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function insertTaskEvent(db, env, tipo, descricao, metadata = {}) {
  const d = env.data || {};
  const tarefaId = d.tarefa_id || d.tarefaId || env.aggregate?.id;
  if (!tarefaId) return;
  await db.execute(
    `INSERT OR IGNORE INTO tarefas_eventos (id, tarefa_id, tipo, descricao, usuario_id, metadata, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [env.id || `${tipo}:${tarefaId}:${eventTime(env)}`, tarefaId, tipo, descricao || null, d.usuario_id || d.usuarioId || null, asJson(metadata), eventTime(env)],
  );
}

const handlers = {
  'usuario.criado': async (env, db) => {
    const d = env.data || {};
    const now = eventTime(env);
    const id = aggregateId(env, d);
    if (!id) return;
    await db.execute(
      `INSERT INTO usuarios
       (id, nome_usuario, hash_senha, nome, perfil, email, telefone, ativo, setor_principal_id, formularios_permitidos, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nome_usuario = excluded.nome_usuario,
         nome = excluded.nome,
         perfil = excluded.perfil,
         email = excluded.email,
         telefone = excluded.telefone,
         ativo = excluded.ativo,
         setor_principal_id = excluded.setor_principal_id,
         formularios_permitidos = excluded.formularios_permitidos,
         atualizado_em = excluded.atualizado_em`,
      [
        id,
        d.nome_usuario || d.username || id,
        d.hash_senha || d.password_hash || '',
        d.nome || d.name || '',
        d.perfil || d.role || 'usuario',
        d.email || null,
        d.telefone || null,
        boolInt(d.ativo, 1),
        d.setor_principal_id || d.setor || null,
        asJson(d.formularios_permitidos || d.allowedForms || []),
        d.criado_em || d.createdAt || now,
        now,
      ],
    );
  },

  'usuario.atualizado': async (env, db) => {
    const d = env.data || {};
    const id = aggregateId(env, d);
    if (!id) return;
    const fields = [];
    const params = [];
    const add = (field, value) => { if (value !== undefined) { fields.push(`${field} = ?`); params.push(value); } };
    add('nome', d.nome ?? d.name);
    add('nome_usuario', d.nome_usuario ?? d.username);
    add('perfil', d.perfil ?? d.role);
    add('email', d.email);
    add('telefone', d.telefone);
    add('ativo', d.ativo === undefined ? undefined : boolInt(d.ativo));
    add('setor_principal_id', d.setor_principal_id ?? d.setor);
    add('formularios_permitidos', d.formularios_permitidos ? asJson(d.formularios_permitidos) : undefined);
    if (!fields.length) return;
    params.push(eventTime(env), id);
    await db.execute(`UPDATE usuarios SET ${fields.join(', ')}, atualizado_em = ? WHERE id = ?`, params);
  },

  'suite.aprovada': async (env, db) => {
    await db.execute(`UPDATE tbl_suite SET status = 'approved' WHERE package_id = ?`, [aggregateId(env)]);
  },

  'suite.rejeitada': async (env, db) => {
    await db.execute(`UPDATE tbl_suite SET status = 'refuted' WHERE package_id = ?`, [aggregateId(env)]);
  },

  'suite.solicitada': async (env, db) => {
    const d = env.data || {};
    await db.execute(`UPDATE tbl_suite SET status = 'current' WHERE package_id = ?`, [env.aggregate?.id || d.novoId || d.packageId]);
  },

  'suite.devolvida': async (env, db) => {
    await db.execute(`UPDATE tbl_suite SET status = 'refuted' WHERE package_id = ?`, [aggregateId(env)]);
  },

  'suite.reencaminhada': async (env, db) => {
    const d = env.data || {};
    await db.execute(`UPDATE tbl_suite SET status = 'dispatched', owner_id = ? WHERE package_id = ?`, [d.destinatarioId || d.destinatario_id || null, aggregateId(env)]);
  },

  'demanda.criada': async (env, db) => {
    const d = env.data || {};
    const now = eventTime(env);
    const id = aggregateId(env, d);
    if (!id) return;
    await db.execute(
      `INSERT INTO demandas
       (id, origem_tipo, origem_id, solicitante_id, destinatario_id, tipo_acao, descricao, status, politica_conclusao, auto_aceite, setor_id, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         origem_tipo = excluded.origem_tipo,
         origem_id = excluded.origem_id,
         solicitante_id = excluded.solicitante_id,
         destinatario_id = excluded.destinatario_id,
         tipo_acao = excluded.tipo_acao,
         descricao = excluded.descricao,
         status = excluded.status,
         politica_conclusao = excluded.politica_conclusao,
         auto_aceite = excluded.auto_aceite,
         setor_id = excluded.setor_id,
         atualizado_em = excluded.atualizado_em`,
      [
        id,
        d.origem_tipo || d.origemTipo || 'sync',
        d.origem_id || d.origemId || null,
        d.solicitante_id || d.solicitanteId || '',
        d.destinatario_id || d.destinatarioId || '',
        d.tipo_acao || d.tipoAcao || null,
        d.descricao || null,
        d.status || 'aberta',
        d.politica_conclusao || d.politicaConclusao || 'declarado',
        boolInt(d.auto_aceite ?? d.autoAceite, 0),
        d.setor_id || d.setorId || null,
        d.criado_em || d.criada_em || d.criadaEm || now,
        now,
      ],
    );
  },

  'demanda.aceita': async (env, db) => {
    const d = env.data || {};
    await db.execute(
      `UPDATE demandas SET status = 'aceita', aceito_por = ?, aceito_em = ?, atualizado_em = ? WHERE id = ? AND status = 'aberta'`,
      [d.aceito_por || d.aceitoPor || null, eventTime(env), eventTime(env), aggregateId(env)],
    );
  },

  'demanda.encerrada': async (env, db) => {
    const d = env.data || {};
    await db.execute(
      `UPDATE demandas SET status = 'concluida', encerrado_por = ?, encerrado_em = ?, atualizado_em = ? WHERE id = ?`,
      [d.encerrado_por || d.encerradoPor || null, eventTime(env), eventTime(env), aggregateId(env)],
    );
  },

  'task.criada': async (env, db) => {
    const d = env.data || {};
    const now = eventTime(env);
    const id = aggregateId(env, d);
    if (!id) return;
    await db.execute(
      `INSERT INTO tarefas
       (id, titulo, descricao, status, prioridade, atribuido_para, criado_por, prazo, suite_id, demanda_id, setor_id, carga, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         titulo = excluded.titulo,
         descricao = excluded.descricao,
         status = excluded.status,
         prioridade = excluded.prioridade,
         atribuido_para = excluded.atribuido_para,
         prazo = excluded.prazo,
         suite_id = excluded.suite_id,
         demanda_id = excluded.demanda_id,
         setor_id = excluded.setor_id,
         carga = excluded.carga,
         atualizado_em = excluded.atualizado_em`,
      [
        id,
        d.titulo || d.title || '',
        d.descricao || null,
        d.status || 'a_fazer',
        d.prioridade || 'media',
        d.atribuido_para || d.atribuidoPara || null,
        d.criado_por || d.criadoPor || 'sync',
        d.prazo || null,
        d.suite_id || d.tbl_suite_id || null,
        d.demanda_id || d.demandaId || null,
        d.setor_id || d.setorId || null,
        asJson(d.carga || d.payload || {}),
        d.criado_em || d.criadoEm || now,
        now,
      ],
    );
  },

  'task.concluida': async (env, db) => {
    const d = env.data || {};
    await updateTask(db, aggregateId(env, d), {
      status: 'concluido',
      atualizado_em: eventTime(env),
    });
    await insertTaskEvent(db, env, 'concluida', 'Tarefa concluida', d);
  },

  'task.atualizada': async (env, db) => {
    const d = env.data || {};
    await updateTask(db, aggregateId(env, d), {
      titulo: d.titulo,
      descricao: d.descricao,
      status: d.status || d.novo_status,
      prioridade: d.prioridade,
      atribuido_para: d.atribuido_para || d.atribuidoPara,
      prazo: d.prazo,
      atualizado_em: eventTime(env),
    });
  },

  'task.movida': async (env, db) => {
    const d = env.data || {};
    await updateTask(db, aggregateId(env, d), {
      status: d.novo_status || d.status,
      atualizado_em: eventTime(env),
    });
  },

  'task.excluida': async (env, db) => {
    await db.execute(`UPDATE tarefas SET deletado_em = ?, atualizado_em = ? WHERE id = ?`, [eventTime(env), eventTime(env), aggregateId(env)]);
  },

  'task.comentario_adicionado': async (env, db) => {
    const d = env.data || {};
    await insertTaskEvent(db, env, 'comentario', d.comentario || d.comment || null, d);
  },

  'org.config.atualizado': async (env, db) => {
    const d = env.data || {};
    await upsertRegistry(db, 'org_config', 'current', d.config || d, eventTime(env));
  },

  'client.criado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'client', id, env.data || {}, eventTime(env));
  },

  'client.atualizado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'client', id, env.data || {}, eventTime(env));
  },

  'roteiro.criado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'roteiro', id, env.data || {}, eventTime(env));
  },

  'crm.coleta.registrada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'coleta', id, env.data || {}, eventTime(env));
  },

  'ecoponto.remocao.agendada': async (env, db) => {
    const id = env.data?.ecopontoId || env.data?.ecoponto_id || aggregateId(env);
    if (id) await upsertRegistry(db, 'ecoponto', id, { ...(env.data || {}), status: 'remocao_agendada' }, eventTime(env));
  },

  'module.publicado': async (env, db) => {
    const d = env.data || {};
    const id = aggregateId(env, d);
    if (!id) return;
    await upsertRegistry(db, 'module', id, d, eventTime(env));
  },

  'module.arquivado': async (env, db) => {
    const d = env.data || {};
    const id = aggregateId(env, d);
    if (!id) return;
    await upsertRegistry(db, 'module', id, { ...d, status: 'archived' }, eventTime(env));
  },
  'ecoforms.registro.criado': async (env, db) => {
    const d = env.data || {};
    const id = aggregateId(env, d);
    if (!id) return;
    await upsertRegistry(db, d.tipo || 'registro', id, d.conteudo || d, eventTime(env));
  },

  'task.arquivada': async (env, db) => {
    await db.execute(`UPDATE tarefas SET arquivado = 1, atualizado_em = ? WHERE id = ?`, [eventTime(env), aggregateId(env)]);
  },

  'task.desarquivada': async (env, db) => {
    await db.execute(`UPDATE tarefas SET arquivado = 0, atualizado_em = ? WHERE id = ?`, [eventTime(env), aggregateId(env)]);
  },

  'demanda.encaminhada': async (env, db) => {
    const d = env.data || {};
    await db.execute(`UPDATE demandas SET destinatario_id = COALESCE(?, destinatario_id), atualizado_em = ? WHERE id = ?`, [d.destinatario_id || d.destinatarioId || null, eventTime(env), aggregateId(env)]);
  },

  'agendamento.criado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'agendamento', id, env.data || {}, eventTime(env));
  },

  'agendamento.confirmado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'agendamento', id, { ...(env.data || {}), status: 'confirmado' }, eventTime(env));
  },

  'agendamento.cancelado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'agendamento', id, { ...(env.data || {}), status: 'cancelado' }, eventTime(env));
  },

  'agendamento.realizado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'agendamento', id, { ...(env.data || {}), status: 'realizado' }, eventTime(env));
  },

  'instancias_widgets_usuario.created': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'widget_instance', id, env.data || {}, eventTime(env));
  },

  'instancias_widgets_usuario.updated': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'widget_instance', id, env.data || {}, eventTime(env));
  },

  'instancias_widgets_usuario.deleted': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'widget_instance', id, { ...(env.data || {}), deleted: true }, eventTime(env));
  },

  'manifestacao.criada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'manifestacao', id, env.data || {}, eventTime(env));
  },

  'manifestacao.status_atualizado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'manifestacao', id, env.data || {}, eventTime(env));
  },

  'tramitacao.registrada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'tramitacao', id, env.data || {}, eventTime(env));
  },

  'resposta.registrada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'resposta', id, env.data || {}, eventTime(env));
  },

  'despacho.registrado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'despacho', id, env.data || {}, eventTime(env));
  },

  'prazo.adicionado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'prazo', id, env.data || {}, eventTime(env));
  },

  'roteiro.atualizado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'roteiro', id, env.data || {}, eventTime(env));
  },

  'execucao.criada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'execucao', id, env.data || {}, eventTime(env));
  },

  'execucao.status_atualizado': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'execucao', id, env.data || {}, eventTime(env));
  },

  'intercorrencia.registrada': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'intercorrencia', id, env.data || {}, eventTime(env));
  },

  'intercorrencia.resolvida': async (env, db) => {
    const id = aggregateId(env);
    if (id) await upsertRegistry(db, 'intercorrencia', id, { ...(env.data || {}), status: 'resolvida' }, eventTime(env));
  },

  'acesso.turno.log': async (env, db) => {
    const id = aggregateId(env) || env.id;
    if (id) await upsertRegistry(db, 'acesso_turno', id, env.data || {}, eventTime(env));
  },
};

export function registerAllHandlers(eventBus) {
  for (const [type, handler] of Object.entries(handlers)) {
    eventBus.onInbound(type, handler);
  }
}
