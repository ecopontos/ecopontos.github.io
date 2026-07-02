# ADR-082 - Tratamento do alerta `glib` no empacotamento Windows

Data: 2026-07-02

Status: Aceito

## Contexto

O Dependabot abriu o alerta `GHSA-wrw7-89jp-8q8g` para o pacote Rust `glib`, referenciado em `ecoforms/desktop/src-tauri/Cargo.lock`.

O lock atual contém:

- `glib v0.18.5`
- Faixa vulnerável: `>=0.15.0, <0.20.0`
- Versão corrigida indicada pelo advisory: `0.20.0`
- Severidade: média

A cadeia de dependência observada é transitiva pela pilha nativa Linux do Tauri:

```text
app
tauri 2.11.4
gtk 0.18.2
glib 0.18.5
```

Também há referências transitivas por `wry`, `webkit2gtk`, `muda`, `tao` e crates GTK relacionados.

Não foi identificado uso direto, no código Rust do app, de `VariantStrIter`, `glib::`, `gtk::`, `webkit2gtk`, `wry::`, `tao::` ou `muda::`.

## Análise

O advisory descreve uma implementação insegura em iteradores de `glib::VariantStrIter`, com risco de comportamento indefinido ou crash em determinadas condições de ponteiros C.

Foi testado um update direto:

```bash
cargo update -p glib --precise 0.20.0 --dry-run
```

O update direto não é resolvível porque `gtk v0.18.2` exige `glib ^0.18`.

Também foi testado:

```bash
cargo update -p tauri --dry-run
```

O update compatível sobe apenas `tauri v2.11.4` para `v2.11.5` e não migra a pilha GTK para `glib >=0.20`.

Portanto, a correção efetiva depende de upstream: uma versão da pilha Tauri/Wry/GTK/WebKit que migre para `gtk-rs`/`glib` corrigidos.

## Decisão

Para o empacotamento de produção Windows, este alerta não bloqueia a entrega.

A justificativa é que o `glib` vulnerável pertence à pilha GTK/WebKit usada pelo alvo Linux do Tauri, não ao runtime nativo final do Windows. Como o app não usa diretamente a API afetada, o risco prático para o binário Windows é tratado como não aplicável.

O alerta deve permanecer monitorado enquanto o repositório mantiver capacidade de build Linux ou lockfile compartilhado com dependências Linux.

## Consequências

- O empacotamento Windows pode prosseguir sem tentar override manual de `glib`.
- Não deve ser aplicado patch local forçando `glib 0.20.0`, pois isso quebra a resolução semver exigida por `gtk v0.18.2`.
- O alerta deve ser reavaliado quando houver atualização upstream de Tauri/Wry/GTK/WebKit compatível com `glib >=0.20`.
- Se o projeto decidir distribuir builds Linux, este ADR deve ser reaberto e a vulnerabilidade deve ser tratada como pendência de empacotamento Linux.

