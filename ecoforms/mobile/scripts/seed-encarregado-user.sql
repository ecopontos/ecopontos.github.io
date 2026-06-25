-- Seed an example 'encarregado' user for development/testing
INSERT INTO usuarios (id, username, nome, perfil, password_hash, ativo, criado_em)
VALUES (
  '00000000-0000-0000-0000-000000enc1',
  'encarregado1',
  'Encarregado de Teste',
  'encarregado',
  'changeme', -- change this hash in production; use bcrypt or secure password
  1,
  now()
)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, nome = EXCLUDED.nome, perfil = EXCLUDED.perfil, ativo = EXCLUDED.ativo;