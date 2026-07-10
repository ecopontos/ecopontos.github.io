-- AUTO-GERADO por packages/core/scripts/generate-rbac.mjs — não editar manualmente.
-- Fonte: packages/core/src/permissions/rbac-matrix.ts

INSERT INTO perfis (id, nome, descricao) VALUES
    ('admin','Administrador','Acesso total'),
    ('gerente','Gerente','Gestao de usuarios e relatorios'),
    ('coordenador','Coordenador','Coordenacao de equipe'),
    ('encarregado','Encarregado','Supervisao de campo'),
    ('operador','Operador','Execucao de tarefas'),
    ('campo','Campo','Execucao de tarefas');

INSERT INTO hierarquia_perfis (perfil, nivel, descricao) VALUES
    ('admin',0,'Acesso total'),
    ('gerente',1,'Gestao'),
    ('coordenador',2,'Coordenacao'),
    ('encarregado',3,'Supervisao'),
    ('operador',4,'Execucao'),
    ('campo',4,'Execucao');

INSERT INTO permissoes (perfil, permissao) VALUES ('admin','users.create'),('gerente','users.create');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','users.edit'),('gerente','users.edit');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','users.delete');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','users.view_all'),('gerente','users.view_all');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','users.change_password'),('gerente','users.change_password'),('coordenador','users.change_password'),('campo','users.change_password'),('operador','users.change_password'),('encarregado','users.change_password');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','forms.create'),('gerente','forms.create');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','forms.edit'),('gerente','forms.edit');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','forms.delete');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','forms.assign'),('gerente','forms.assign');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','forms.fill'),('gerente','forms.fill'),('coordenador','forms.fill'),('campo','forms.fill'),('operador','forms.fill'),('encarregado','forms.fill');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.view_all'),('gerente','data.view_all');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.view_own'),('gerente','data.view_own'),('coordenador','data.view_own'),('campo','data.view_own'),('operador','data.view_own'),('encarregado','data.view_own');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.edit_all');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.edit_own'),('gerente','data.edit_own'),('coordenador','data.edit_own'),('campo','data.edit_own'),('operador','data.edit_own'),('encarregado','data.edit_own');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.delete');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.export'),('gerente','data.export');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','data.archive'),('gerente','data.archive');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','system.config');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','system.logs'),('gerente','system.logs');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','system.sync'),('gerente','system.sync');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','system.device_setup'),('gerente','system.device_setup');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','reports.view'),('gerente','reports.view');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','reports.export'),('gerente','reports.export');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','activities.manage'),('gerente','activities.manage');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','tasks.reassign'),('gerente','tasks.reassign'),('encarregado','tasks.reassign');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','clients.view'),('gerente','clients.view'),('coordenador','clients.view');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','clients.create'),('gerente','clients.create');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','clients.edit'),('gerente','clients.edit');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','clients.delete');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','clients.export'),('gerente','clients.export');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','crm.view'),('gerente','crm.view'),('coordenador','crm.view'),('encarregado','crm.view');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','crm.edit'),('gerente','crm.edit'),('coordenador','crm.edit');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','ouvidoria.view'),('gerente','ouvidoria.view'),('coordenador','ouvidoria.view'),('encarregado','ouvidoria.view');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','ouvidoria.create'),('gerente','ouvidoria.create'),('coordenador','ouvidoria.create'),('encarregado','ouvidoria.create');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','ouvidoria.respond'),('gerente','ouvidoria.respond'),('coordenador','ouvidoria.respond');
INSERT INTO permissoes (perfil, permissao) VALUES ('admin','ouvidoria.close'),('gerente','ouvidoria.close');
