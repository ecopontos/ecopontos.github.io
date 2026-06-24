import { useState, useCallback } from 'react';
import { uuidv7 } from 'ecoforms-core';
import { getContainerAsync } from '@/src/infrastructure/container';

export function useSeedDemo() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (msg: string) => setLog(prev => [...prev, msg]);

  const seed = useCallback(async () => {
    setLoading(true);
    setLog([]);
    try {
      const c = await getContainerAsync();
      const now = new Date().toISOString();

      // 1. Seed catálogos se vazios
      const ensureCatalogo = async (table: string, items: { id: string; nome: string }[]) => {
        const existing = await c.sqlite.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`, []);
        if ((existing[0]?.count ?? 0) === 0) {
          for (const item of items) {
            await c.sqlite.execute(`INSERT INTO ${table} (id, nome) VALUES (?, ?)`, [item.id, item.nome]);
          }
          pushLog(`✅ ${table}: ${items.length} seeds`);
        } else {
          pushLog(`ℹ️ ${table}: já possui dados`);
        }
      };

      await ensureCatalogo('tipos_manifestacao', [
        { id: 'reclamacao', nome: 'Reclamação' },
        { id: 'solicitacao', nome: 'Solicitação' },
        { id: 'elogio', nome: 'Elogio' },
        { id: 'denuncia', nome: 'Denúncia' },
      ]);
      await ensureCatalogo('origens', [
        { id: 'web', nome: 'Web' },
        { id: 'telefone', nome: 'Telefone' },
        { id: 'presencial', nome: 'Presencial' },
      ]);
      await ensureCatalogo('classificacoes', [
        { id: 'alta', nome: 'Alta' },
        { id: 'media', nome: 'Média' },
        { id: 'baixa', nome: 'Baixa' },
      ]);
      await ensureCatalogo('situacoes', [
        { id: 'nova', nome: 'Nova' },
        { id: 'analise', nome: 'Em Análise' },
        { id: 'encerrada', nome: 'Encerrada' },
      ]);

      // 2. Seed clientes
      const clientes = await c.sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM clientes', []);
      if ((clientes[0]?.count ?? 0) === 0) {
        const c1 = uuidv7();
        const c2 = uuidv7();
        await c.sqlite.execute(
          'INSERT INTO clientes (id, tipo, nome, documento, email, telefone, cidade, estado, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [c1, 'PJ', 'EcoTech Soluções Ambientais Ltda', '12.345.678/0001-90', 'contato@ecotech.com', '(11) 98765-4321', 'São Paulo', 'SP', 1, now, now]
        );
        await c.sqlite.execute(
          'INSERT INTO clientes (id, tipo, nome, documento, email, telefone, cidade, estado, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [c2, 'PF', 'Maria Silva', '123.456.789-00', 'maria@email.com', '(21) 91234-5678', 'Rio de Janeiro', 'RJ', 1, now, now]
        );
        pushLog(`✅ clientes: 2 seeds`);
      } else {
        pushLog(`ℹ️ clientes: já possui dados`);
      }

      // 3. Seed manifestacao
      const manifestacoes = await c.sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM manifestacoes', []);
      if ((manifestacoes[0]?.count ?? 0) === 0) {
        const m1 = uuidv7();
        const cid = (await c.sqlite.query<{ id: string }>('SELECT id FROM clientes LIMIT 1', []))[0]?.id;
        await c.sqlite.execute(
          'INSERT INTO manifestacoes (id, protocolo, tipo_id, origem_id, classificacao_id, solicitante_nome, solicitante_email, assunto, descricao, status, situacao_id, cliente_id, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [m1, 'M-2026-0001', 'reclamacao', 'web', 'alta', 'João Pereira', 'joao@email.com', 'Coleta não realizada no prazo', 'Solicito verificação do roteiro de coleta da semana passada.', 'aberta', 'nova', cid || null, now, now]
        );
        await c.sqlite.execute(
          'INSERT INTO tramitacoes (id, manifestacao_id, para_setor_id, observacao, usuario_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv7(), m1, 'setor-1', 'Encaminhado para análise da equipe de logística.', 'user-1', now]
        );
        await c.sqlite.execute(
          'INSERT INTO respostas (id, manifestacao_id, texto, enviada_por, enviada_em) VALUES (?, ?, ?, ?, ?)',
          [uuidv7(), m1, 'Prezado, estamos verificando o ocorrido e retornaremos em breve.', 'user-1', now]
        );
        await c.sqlite.execute(
          'INSERT INTO prazos (id, manifestacao_id, tipo_prazo_id, data_limite, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv7(), m1, 'resposta', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 'pendente', now]
        );
        pushLog(`✅ manifestacoes + workflow: 1 demo`);
      } else {
        pushLog(`ℹ️ manifestacoes: já possui dados`);
      }

      // 4. Seed roteiro
      const roteiros = await c.sqlite.query<{ count: number }>('SELECT COUNT(*) as count FROM roteiros', []);
      if ((roteiros[0]?.count ?? 0) === 0) {
        const r1 = uuidv7();
        await c.sqlite.execute(
          'INSERT INTO roteiros (id, nome, descricao, tipo_residuo, periodicidade, turno, base, situacao, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [r1, 'Roteiro Centro-Oeste', 'Coleta residencial — região Centro-Oeste', 'Resíduos domésticos', 'semanal', 'manha', 'Base 1', 'ativo', 'user-1', now, now]
        );
        const cid = (await c.sqlite.query<{ id: string }>('SELECT id FROM clientes LIMIT 1', []))[0]?.id;
        if (cid) {
          await c.sqlite.execute(
            'INSERT INTO roteiro_clientes (id, roteiro_id, cliente_id, ordem, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv7(), r1, cid, 1, 1, now]
          );
        }
        await c.sqlite.execute(
          'INSERT INTO execucao_coleta (id, roteiro_id, data_execucao, status, criado_em) VALUES (?, ?, ?, ?, ?)',
          [uuidv7(), r1, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 'agendada', now]
        );
        pushLog(`✅ roteiros + execucao: 1 demo`);
      } else {
        pushLog(`ℹ️ roteiros: já possui dados`);
      }

      pushLog('🎉 Seed demo concluído');
    } catch (e: unknown) {
      pushLog(`❌ Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return { seed, loading, log };
}
