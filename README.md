# ecopontos.github.io

Hub operacional da conta `ecopontos`.

Este repositorio sustenta o site principal publicado em GitHub Pages e concentra os artefatos que ainda permanecem no agregador central.

## Papel deste repositorio

- publicar a entrada principal em `https://ecopontos.github.io/`
- manter o PWA/site operacional da frente `ecoponto`
- hospedar projetos ainda nao separados em repositorios proprios
- guardar documentacao de saneamento e inventario de repositorios

## Estrutura atual

- `index.html`, `script.js`, `manifest.json`, `service-worker.js`: app web principal
- `ecoponto/`: modulo operacional mantido no hub
- `gestaoecoponto/`: assets e telas ligados a gestao
- `revista/`, `transbordo/`, `transbordoveo/`: frentes ainda publicadas a partir deste repo
- `docs/`: notas tecnicas e material de consolidacao
- `INVENTARIO_REPOS.md`: inventario operacional dos repositorios da conta

## Repositorios relacionados

- `ecoforms`: formularios de campo com desktop, mobile e core compartilhado
- `checklist`: coleta operacional publicada em `https://ecopontos.github.io/checklist/`
- `mtr`: aplicativo para manifesto de transporte de residuos
- `matching`: projeto de map matching com testes automatizados
- `visita`: experiencia web com panoramas 360 e galeria multimidia

## Operacao local

Nao ha build obrigatorio para a raiz deste hub. Para inspecao local, basta servir os arquivos estaticos do repositorio ou abrir as entradas HTML correspondentes.

## Governanca

- projetos estaveis e autonomos devem migrar para repositorios proprios
- o hub deve manter apenas o que precisa continuar no endereco atual
- antes de criar novo repo, registrar a decisao em `INVENTARIO_REPOS.md`
