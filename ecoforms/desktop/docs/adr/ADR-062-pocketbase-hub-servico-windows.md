# ADR-062 — PocketBase como hub local iniciado pelo Windows

**Status:** Proposto  
**Data:** 2026-06-29  
**Autor:** Marcelo Luiz  
**Contexto externo:** Complementa o POC PocketBase offline-first, mantendo SQLite local como base de operação offline.

---

## Contexto

O EcoForms Desktop opera com SQLite local para garantir uso offline. Ao mesmo tempo, há necessidade de um hub local para troca de dados entre máquinas da mesma rede quando a internet ou serviços externos não estiverem disponíveis com segurança suficiente.

O PocketBase foi avaliado como candidato para esse hub local por oferecer:

- API HTTP simples para catálogos e registros.
- Banco embutido baseado em SQLite.
- Binário único, fácil de distribuir.
- Painel administrativo útil para POC e suporte.

Durante a discussão do POC surgiu uma questão de responsabilidade: o PocketBase deve ser iniciado pelo módulo built-in do app principal ou deve executar no início do Windows, independentemente do app estar aberto?

---

## Problema

Se o app principal for responsável por iniciar o PocketBase:

- O hub só existe quando alguém abre o EcoForms Desktop na máquina servidora.
- Fechar o app pode derrubar a disponibilidade para as demais máquinas.
- O ciclo de vida do app de usuário fica misturado com o ciclo de vida de infraestrutura local.
- Falhas do hub passam a parecer falhas do app principal.
- Outras máquinas podem não encontrar o serviço durante boot, troca de turno ou manutenção.

Se o PocketBase for iniciado junto com o Windows:

- O hub pode estar disponível antes do app principal.
- O serviço pode ser reiniciado automaticamente.
- A responsabilidade fica mais clara: PocketBase é infraestrutura local; EcoForms Desktop é cliente, painel de configuração e consumidor.

---

## Decisão

O PocketBase deve ser tratado como **hub local de infraestrutura** e iniciado no boot do Windows na máquina configurada como servidor/hub.

O EcoForms Desktop não deve depender da abertura do app principal para subir o hub. O app principal deve assumir as responsabilidades de:

- Detectar se há hub configurado.
- Ler o arquivo JSON de descoberta.
- Validar saúde e conectividade do PocketBase.
- Exibir status operacional para o usuário/admin.
- Oferecer fluxo administrativo para configurar esta máquina como hub.
- Escrever ou atualizar o JSON de referência quando a configuração do hub mudar.

O app pode, em uma fase inicial, acionar a instalação/configuração do serviço, mas não deve ser o processo supervisor permanente do PocketBase.

---

## Arquitetura proposta

### Máquina hub

Na máquina definida como hub:

1. PocketBase executa como serviço/tarefa de inicialização do Windows.
2. O serviço escuta em IP e porta conhecidos na rede local.
3. Um arquivo JSON de descoberta é escrito em local compartilhado ou conhecido pela rede.
4. O EcoForms Desktop valida o serviço e mostra o estado do hub.

### Máquinas cliente

Nas demais máquinas:

1. O EcoForms Desktop lê o JSON de descoberta.
2. Testa conectividade com o PocketBase.
3. Continua usando SQLite local como fonte operacional.
4. Replica para o hub quando disponível.
5. Não bloqueia operação local se o hub estiver indisponível.

---

## JSON de descoberta

Formato inicial sugerido:

```json
{
  "version": 1,
  "hub": {
    "type": "pocketbase",
    "host": "192.168.1.20",
    "port": 8090,
    "baseUrl": "http://192.168.1.20:8090",
    "machineName": "PC-ADMIN",
    "serviceName": "EcoFormsPocketBase",
    "updatedAt": "2026-06-29T23:00:00.000Z"
  }
}
```

Regras:

- `baseUrl` é referência inicial, não garantia de disponibilidade.
- Clientes sempre devem executar health check antes de considerar o hub ativo.
- `updatedAt` ajuda a diagnosticar IP antigo ou configuração obsoleta.
- O arquivo pode ficar no mesmo diretório LAN compartilhado usado por outros mecanismos de sincronização.

---

## Health check

O app deve validar o hub antes de usar:

- HTTP acessível.
- Versão ou endpoint esperado.
- Coleções necessárias disponíveis.
- Regras de acesso compatíveis com o modo configurado.

Para o POC, basta validar um endpoint HTTP simples do PocketBase e registrar o status em tela/log. Em produção, a validação deve verificar também schema e autenticação.

---

## Consequências

### Positivas

- Maior disponibilidade para as máquinas cliente.
- Menor acoplamento entre app principal e infraestrutura local.
- Diagnóstico mais claro: serviço hub separado do app.
- Caminho natural para restart automático e observabilidade.
- Mantém a operação offline local baseada em SQLite.

### Negativas

- Exige etapa de instalação/configuração do serviço Windows.
- Exige cuidado com firewall, porta e IP da máquina hub.
- Exige política para mudança de IP ou troca da máquina hub.
- A superfície de segurança do PocketBase precisa ser tratada explicitamente.

---

## Alternativas consideradas

### Iniciar PocketBase ao abrir o app principal

Rejeitada como arquitetura final.

Pode servir para protótipo rápido, mas acopla disponibilidade do hub ao ciclo de vida de uma janela de app. Isso é frágil para ambiente multi-máquina.

### Embutir PocketBase diretamente no módulo built-in do app

Rejeitada como responsabilidade permanente.

O módulo built-in pode configurar, diagnosticar e instalar o hub, mas não deve ser dono permanente do processo. O hub precisa sobreviver ao fechamento do app principal.

### Não usar PocketBase e manter apenas arquivos LAN

Mantida como possibilidade, mas não cobre bem consulta HTTP, painel administrativo e evolução para integrações. Arquivos LAN continuam úteis para descoberta, bootstrap e fallback.

---

## Plano de implementação

### Fase 1 — POC sem instalação de serviço

- Manter o POC atual de repositório híbrido SQLite + PocketBase.
- Criar `HubDiscovery` para ler/escrever o JSON de descoberta.
- Criar `HubHealthCheck` para testar o PocketBase configurado.
- Expor estado do hub em tela administrativa.

### Fase 2 — Serviço Windows

- Definir estratégia de instalação:
  - Windows Service, ou
  - tarefa no Agendador de Tarefas com inicialização no boot.
- Definir diretório do binário PocketBase e dados.
- Configurar firewall/porta.
- Escrever JSON de descoberta após instalação ou alteração de IP/porta.

### Fase 3 — Hardening

- Autenticação segura.
- Validação de schema.
- Rotina de backup do banco do PocketBase.
- Logs e diagnóstico de indisponibilidade.
- Política para troca de hub e IP dinâmico.

---

## Estado final desejado

O EcoForms Desktop continua offline-first:

- SQLite local é a fonte de operação imediata.
- PocketBase é hub local opcional para rede.
- Falha do PocketBase não impede uso local.
- O hub executa no Windows independentemente do app principal.
- O app principal administra descoberta, saúde e configuração, mas não fica responsável por manter o processo vivo.
