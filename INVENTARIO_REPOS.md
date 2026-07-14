# Inventario de repositorios

Inventario operacional dos repositorios da conta `ecopontos`, com foco em organizacao local, manutencao e criterio de clone.

## Clonar sempre

| Repositorio | URL | Papel | Status | Observacoes |
| --- | --- | --- | --- | --- |
| `ecopontos.github.io` | `https://github.com/ecopontos/ecopontos.github.io` | Hub e producao principal | producao | Repo central. Deve permanecer sempre clonado. |
| `ecoforms` | `https://github.com/ecopontos/ecoforms` | Produto autonomo de formularios | ativo | Monorepo proprio com desktop, mobile e core compartilhado. |
| `checklist` | `https://github.com/ecopontos/checklist` | App operacional de coleta | ativo/publicado | Publicado em `https://ecopontos.github.io/checklist/`. |
| `mtr` | `https://github.com/ecopontos/mtr` | Projeto separado do agregador | ativo | Ja saneado e migrado para repo proprio. |
| `matching` | `https://github.com/ecopontos/matching` | Projeto separado do agregador | ativo | Ja extraido e com testes validados na migracao. |
| `visita` | `https://github.com/ecopontos/visita` | Site/app separado | ativo/publicado | Extraido do agregador e mantido como projeto proprio. |

## Clonar sob demanda

| Repositorio | URL | Papel | Status | Observacoes |
| --- | --- | --- | --- | --- |
| `suite` | `https://github.com/ecopontos/suite` | Projeto isolado | arquivo/indefinido | Clonar apenas quando voltar a receber trabalho. |
| `cartaovirtual` | `https://github.com/ecopontos/cartaovirtual` | Projeto isolado | arquivo/indefinido | Sem atividade recente no saneamento. |
| `chamada` | `https://github.com/ecopontos/chamada` | Projeto isolado | arquivo/indefinido | Manter fora do ambiente ativo ate nova demanda. |
| `Abordagem` | `https://github.com/ecopontos/Abordagem` | Projeto isolado | experimental/indefinido | Escopo ainda nao entrou no fluxo recente de organizacao. |

## Fora do GitHub por enquanto

| Projeto | Papel | Status | Observacoes |
| --- | --- | --- | --- |
| `roteiros` | Incubacao/refatoracao | separado para refatoracao | Nao esta pronto para publicacao como app. Deve ficar fora do hub ate ganhar fronteira clara entre app, dados e pipeline. |

## Estrutura local recomendada

```text
github/
  ativos/
    ecopontos.github.io
    ecoforms
    checklist
    mtr
    matching
    visita
  sob-demanda/
    suite
    cartaovirtual
    chamada
    Abordagem
  incubacao/
    roteiros
```

## Regra pratica

- `producao`: manter sempre clonado
- `ativo`: manter clonado
- `arquivo/indefinido`: clonar apenas quando houver tarefa
- `experimental/indefinido`: clonar quando houver retomada tecnica
- `incubacao`: manter separado ate o projeto virar produto claro
