// ⚠️ ESPELHO de desktop/src/infrastructure/sync/HandlerRegistry.ts
// Alterações aqui devem ser refletidas lá.
const handlers = {
  'usuario.criado': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('usuarios', 'readwrite');
    const store = tx.objectStore('usuarios');
    await new Promise((resolve, reject) => {
      const req = store.put({
        id: env.aggregate.id,
        nome: d.nome || '',
        username: d.username || '',
        perfil: d.perfil || 'usuario',
        formularios_permitidos: JSON.stringify(d.formularios_permitidos || []),
        ativo: d.ativo ? 1 : 0,
        setor: d.setor || null,
        criado_em: env.time,
        atualizado_em: env.time,
      });
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  },

  'usuario.atualizado': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('usuarios', 'readwrite');
    const store = tx.objectStore('usuarios');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            nome: d.nome ?? existing.nome,
            perfil: d.perfil ?? existing.perfil,
            formularios_permitidos: d.formularios_permitidos
              ? JSON.stringify(d.formularios_permitidos)
              : existing.formularios_permitidos,
            ativo: d.ativo !== undefined ? (d.ativo ? 1 : 0) : existing.ativo,
            setor: d.setor ?? existing.setor,
            atualizado_em: env.time,
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'suite.aprovada': async (env, db) => {
    const tx = db.transaction('suite', 'readwrite');
    const store = tx.objectStore('suite');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'approved', updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'suite.rejeitada': async (env, db) => {
    const tx = db.transaction('suite', 'readwrite');
    const store = tx.objectStore('suite');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'refuted', updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'demanda.criada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tbl_demandas', 'readwrite');
    const store = tx.objectStore('tbl_demandas');
    await new Promise((resolve, reject) => {
      store.put({
        id: env.aggregate.id,
        origem_tipo: d.origem_tipo || d.origemTipo || null,
        solicitante_id: d.solicitante_id || d.solicitanteId || '',
        destinatario_id: d.destinatario_id || d.destinatarioId || '',
        tipo_acao: d.tipo_acao || d.tipoAcao || null,
        descricao: d.descricao || null,
        status: d.status || 'aberta',
        politica_conclusao: d.politica_conclusao || d.politicaConclusao || 'declarado',
        auto_aceite: d.auto_aceite || d.autoAceite ? 1 : 0,
        criada_em: d.criada_em || d.criadaEm || env.time,
        created_at: env.time,
        updated_at: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'demanda.aceita': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tbl_demandas', 'readwrite');
    const store = tx.objectStore('tbl_demandas');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing && existing.status === 'aberta') {
          store.put({
            ...existing,
            status: 'aceita',
            aceito_por: d.aceito_por || d.aceitoPor || null,
            aceito_em: env.time,
            updated_at: env.time,
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'demanda.encerrada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tbl_demandas', 'readwrite');
    const store = tx.objectStore('tbl_demandas');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            status: 'concluida',
            encerrado_por: d.encerrado_por || d.encerradoPor || null,
            encerrado_em: env.time,
            updated_at: env.time,
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },


  'task.concluida': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tarefas', 'readwrite');
    const store = tx.objectStore('tarefas');
    await new Promise((resolve, reject) => {
      const tarefaId = d.tarefa_id || d.tarefaId || env.aggregate.id;
      const getReq = store.get(tarefaId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            status: 'concluido',
            concluido_por: d.concluido_por || d.concluidoPor || null,
            concluido_em: d.concluido_em || d.concluidoEm || env.time,
            updated_at: env.time,
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'task.atualizada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tarefas', 'readwrite');
    const store = tx.objectStore('tarefas');
    await new Promise((resolve, reject) => {
      const tarefaId = d.tarefa_id || d.tarefaId || env.aggregate.id;
      const getReq = store.get(tarefaId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          const novoStatus = d.status || d.novo_status || 'em_progresso';
          const updated = { ...existing, status: novoStatus, updated_at: env.time };
          if (novoStatus === 'em_progresso' && !existing.iniciado_em) {
            updated.iniciado_em = d.started_at || d.startedAt || env.time;
          }
          store.put(updated);
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'task.movida': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tarefas', 'readwrite');
    const store = tx.objectStore('tarefas');
    await new Promise((resolve, reject) => {
      const tarefaId = d.tarefa_id || d.tarefaId || env.aggregate.id;
      const getReq = store.get(tarefaId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing && d.novo_status) {
          const updated = {
            ...existing,
            status: d.novo_status,
            updated_at: env.time,
          };
          if (d.novo_status === 'concluido') {
            updated.concluido_em = d.movido_em || d.movidoEm || env.time;
            updated.concluido_por = d.movido_por || d.movidoPor || null;
          }
          if (d.novo_status === 'em_andamento' && !existing.iniciado_em) {
            updated.iniciado_em = d.movido_em || d.movidoEm || env.time;
          }
          store.put(updated);
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'org.config.atualizado': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('data_registry', 'readwrite');
    const store = tx.objectStore('data_registry');
    await new Promise((resolve, reject) => {
      store.put({
        tipo: 'org_config',
        chave: 'current',
        conteudo: JSON.stringify(d.config || d),
        atualizado_em: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'suite.solicitada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('suite', 'readwrite');
    const store = tx.objectStore('suite');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id || d.novoId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'current', updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'suite.devolvida': async (env, db) => {
    const tx = db.transaction('suite', 'readwrite');
    const store = tx.objectStore('suite');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id || env.aggregate.packageId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'refuted', updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'suite.reencaminhada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('suite', 'readwrite');
    const store = tx.objectStore('suite');
    await new Promise((resolve, reject) => {
      const getReq = store.get(env.aggregate.id || d.packageId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'dispatched', owner_id: d.destinatarioId, updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'task.criada': async (env, db) => {
    const d = env.data;
    if (!d.id && !d.tarefa_id && !d.tarefaId && !env.aggregate.id) {
      console.error('[HandlerRegistry] task.criada: id ausente no envelope. Evento rejeitado.');
      return;
    }
    if (!d.titulo && !d.status) {
      console.warn('[HandlerRegistry] task.criada: campos minimos ausentes (titulo/status). Aplicando com defaults.');
    }
    const tx = db.transaction('tarefas', 'readwrite');
    const store = tx.objectStore('tarefas');
    await new Promise((resolve, reject) => {
      store.put({
        id: d.id || d.tarefa_id || d.tarefaId || env.aggregate.id,
        titulo: d.titulo || '',
        descricao: d.descricao || '',
        status: d.status || 'a_fazer',
        prioridade: d.prioridade || 'media',
        atribuido_para: d.atribuido_para || d.atribuidoPara || '',
        demanda_id: d.demanda_id || d.demandaId || null,
        suite_id: d.suite_id || d.tbl_suite_id || null,
        prazo: d.prazo || null,
        criado_por: d.criado_por || d.criadoPor || '',
        criado_em: d.criado_em || d.criadoEm || env.time,
        updated_at: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'client.criado': async (env, db) => {
    const d = env.data;
    if (!(d.id || d.cliente_id || d.clienteId || env.aggregate.id)) {
      console.error('[HandlerRegistry] client.criado: id ausente. Evento rejeitado.');
      return;
    }
    const tx = db.transaction('tbl_clientes', 'readwrite');
    const store = tx.objectStore('tbl_clientes');
    await new Promise((resolve, reject) => {
      store.put({
        id: d.id || d.cliente_id || d.clienteId || env.aggregate.id,
        nome: d.nome || d.name || '',
        documento: d.documento || d.doc || d.cpf_cnpj || '',
        tipo_pessoa: d.tipo_pessoa || d.tipoPessoa || 'fisica',
        email: d.email || '',
        telefone: d.telefone || d.tel || '',
        celular: d.celular || d.cell || '',
        endereco: d.endereco || d.address || '',
        cidade: d.cidade || '',
        estado: d.estado || d.uf || '',
        cep: d.cep || '',
        ativo: d.ativo !== undefined ? (d.ativo ? 1 : 0) : 1,
        observacao: d.observacao || d.obs || '',
        criado_por: d.criado_por || d.criadoPor || '',
        criado_em: d.criado_em || d.criadoEm || env.time,
        updated_at: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'client.atualizado': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tbl_clientes', 'readwrite');
    const store = tx.objectStore('tbl_clientes');
    await new Promise((resolve, reject) => {
      const entityId = d.id || d.cliente_id || d.clienteId || env.aggregate.id;
      const getReq = store.get(entityId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({
            ...existing,
            nome: d.nome ?? existing.nome,
            documento: d.documento ?? existing.documento,
            tipo_pessoa: d.tipo_pessoa ?? existing.tipo_pessoa,
            email: d.email ?? existing.email,
            telefone: d.telefone ?? existing.telefone,
            celular: d.celular ?? existing.celular,
            endereco: d.endereco ?? existing.endereco,
            cidade: d.cidade ?? existing.cidade,
            estado: d.estado ?? existing.estado,
            cep: d.cep ?? existing.cep,
            ativo: d.ativo !== undefined ? (d.ativo ? 1 : 0) : existing.ativo,
            observacao: d.observacao ?? existing.observacao,
            updated_at: env.time,
          });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'roteiro.criado': async (env, db) => {
    const d = env.data;
    if (!(d.id || d.roteiro_id || d.roteiroId || env.aggregate.id)) {
      console.error('[HandlerRegistry] roteiro.criado: id ausente. Evento rejeitado.');
      return;
    }
    const tx = db.transaction('tbl_roteiros', 'readwrite');
    const store = tx.objectStore('tbl_roteiros');
    await new Promise((resolve, reject) => {
      store.put({
        id: d.id || d.roteiro_id || d.roteiroId || env.aggregate.id,
        nome: d.nome || '',
        descricao: d.descricao || '',
        setor_id: d.setor_id || d.setorId || '',
        usuario_id: d.usuario_id || d.usuarioId || '',
        data: d.data || d.date || '',
        status: d.status || 'planejado',
        pontos_total: d.pontos_total || d.pontosTotal || 0,
        pontos_visitados: d.pontos_visitados || d.pontosVisitados || 0,
        criado_por: d.criado_por || d.criadoPor || '',
        criado_em: d.criado_em || d.criadoEm || env.time,
        updated_at: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'crm.coleta.registrada': async (env, db) => {
    const d = env.data;
    if (!(d.id || d.coleta_id || d.coletaId || env.aggregate.id)) {
      console.error('[HandlerRegistry] crm.coleta.registrada: id ausente. Evento rejeitado.');
      return;
    }
    const tx = db.transaction('tbl_coletas', 'readwrite');
    const store = tx.objectStore('tbl_coletas');
    await new Promise((resolve, reject) => {
      store.put({
        id: d.id || d.coleta_id || d.coletaId || env.aggregate.id,
        roteiro_id: d.roteiro_id || d.roteiroId || '',
        ponto_id: d.ponto_id || d.pontoId || '',
        ponto_nome: d.ponto_nome || d.pontoNome || '',
        tipo_residuo: d.tipo_residuo || d.tipoResiduo || '',
        quantidade: d.quantidade || 0,
        unidade: d.unidade || 'kg',
        observacao: d.observacao || d.obs || '',
        foto_url: d.foto_url || d.fotoUrl || null,
        latitude: d.latitude || d.lat || null,
        longitude: d.longitude || d.lng || null,
        registrado_por: d.registrado_por || d.registradoPor || '',
        registrado_em: d.registrado_em || d.registradoEm || env.time,
        updated_at: env.time,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'ecoponto.remocao.agendada': async (env, db) => {
    const d = env.data;
    const tx = db.transaction('tbl_ecopontos', 'readwrite');
    const store = tx.objectStore('tbl_ecopontos');
    await new Promise((resolve, reject) => {
      const getReq = store.get(d.ecopontoId || env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, status: 'remocao_agendada', updated_at: env.time });
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  'module.publicado': async (env, db) => {
    const d = env.data;
    if (!d || !d.id) {
      console.error('[HandlerRegistry] module.publicado: id ausente. Evento rejeitado.');
      return;
    }
    const tx = db.transaction('tbl_modulos', 'readwrite');
    const store = tx.objectStore('tbl_modulos');
    await new Promise((resolve, reject) => {
      const req = store.put({
        id:           d.id,
        slug:         d.slug || '',
        name:         d.name || d.nome || '',
        entity_type:  d.entity_type || '',
        status:       d.status || 'published',
        version:      d.version || 1,
        config:       typeof d.config === 'string' ? d.config : JSON.stringify(d.config || {}),
        publicado_em: d.publicado_em || env.time,
        updated_at:   env.time,
      });
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  },

  'module.arquivado': async (env, db) => {
    const d = env.data;
    if (!d || !d.id) return;
    const tx = db.transaction('tbl_modulos', 'readwrite');
    const store = tx.objectStore('tbl_modulos');
    await new Promise((resolve, reject) => {
      const getReq = store.get(d.id || env.aggregate.id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          const putReq = store.put({ ...existing, status: 'archived', updated_at: env.time });
          putReq.onsuccess = resolve;
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },
};

export function registerAllHandlers(eventBus) {
  for (const [type, handler] of Object.entries(handlers)) {
    eventBus.onInbound(type, handler);
  }
}
