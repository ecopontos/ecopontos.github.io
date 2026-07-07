# Sync Event Matrix

Date: 2026-07-07

## Summary

- Mobile envelope: `mobile/www/js/sync/EventEnvelope.js` is a reexport of `/js/ecoforms-core.js`.
- Material drift: the only envelope declaration drift is between `packages/core/src/sync/EventEnvelope.ts` and `desktop/src/infrastructure/sync/EventEnvelope.ts`.
- Diff method: unique quoted event-like strings from both EventEnvelope declarations; core import `../utils/uuidv7.js` excluded.
- Divergent events classified: 25.

## Classification Rules

- `canonical`: declared by core and supported by runtime evidence; desktop envelope should converge to core.
- `add-to-core`: desktop-only declaration has handler coverage that appears live; add to core before envelope migration.
- `remove-from-desktop`: desktop-only declaration has no handler or publisher evidence in checked paths.
- `legacy-documented`: drift is likely legacy or uncertain; keep documented and do not migrate envelopes until owner decision.
- `handler-only`: event has handler evidence outside the canonical core envelope; decide whether to promote to core or retire before migration.

## Event Matrix

| Event | Core | Desktop envelope | Desktop handler | Mobile handler | Classification | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `client.atualizado` | yes | no | no | yes | canonical | Core and mobile handle it; add to desktop envelope only if desktop should produce/accept client sync, otherwise document as mobile-only canonical. |
| `client.criado` | yes | no | no | yes | canonical | Core and mobile handle it; add to desktop envelope only if desktop should produce/accept client sync, otherwise document as mobile-only canonical. |
| `data_registry.atualizado` | yes | no | no | no | legacy-documented | No handler evidence in desktop/mobile sync paths; registry appears storage/cache backed, so keep documented until owner confirms removal or replacement. |
| `demanda.tarefa.concluida` | yes | no | no | no | legacy-documented | No handler or publisher evidence found; likely superseded by `task.concluida`, but keep documented until confirmed. |
| `demanda.tarefa.criada` | yes | no | no | no | legacy-documented | No handler or publisher evidence found; likely superseded by `task.criada`, but keep documented until confirmed. |
| `ecoforms.tarefa.concluida` | yes | no | no | no | legacy-documented | No handler or publisher evidence found; likely legacy naming around task completion. |
| `ecoforms.task.snapshot` | yes | no | no | no | legacy-documented | No handler or publisher evidence found; snapshot semantics are unclear, so do not remove without owner decision. |
| `form_registry.atualizado` | yes | no | no | no | legacy-documented | No event handler evidence; `form_registry` appears in storage/cache flows, so keep documented until replacement is explicit. |
| `suite.aprovada` | yes | no | no | yes | canonical | Core and mobile handler/publisher agree; desktop envelope should use `suite.*` naming instead of `pacotes.*`. |
| `suite.devolvida` | yes | no | no | yes | canonical | Core, mobile, and desktop publisher evidence exist; add to desktop envelope before migration. |
| `suite.reencaminhada` | yes | no | no | yes | canonical | Core, mobile, and desktop publisher evidence exist; add to desktop envelope before migration. |
| `suite.rejeitada` | yes | no | no | yes | canonical | Core, mobile, and desktop publisher evidence exist; add to desktop envelope before migration. |
| `suite.solicitada` | yes | no | no | yes | canonical | Core, mobile, and desktop publisher evidence exist; add to desktop envelope before migration. |
| `tarefa.criada` | yes | no | no | no | legacy-documented | No handler or publisher evidence found; likely superseded by `task.criada`, but keep documented until confirmed. |
| `instancias_widgets_usuario.created` | no | yes | yes | yes | add-to-core | Handled in both desktop and mobile; add to core envelope if widget instance sync remains supported. |
| `instancias_widgets_usuario.deleted` | no | yes | yes | yes | add-to-core | Handled in both desktop and mobile; add to core envelope if widget instance sync remains supported. |
| `instancias_widgets_usuario.updated` | no | yes | yes | yes | add-to-core | Handled in both desktop and mobile; add to core envelope if widget instance sync remains supported. |
| `pacotes.aprovada` | no | yes | no | no | remove-from-desktop | No handler or publisher evidence; appears to be legacy alias for `suite.aprovada`. |
| `pacotes.reencaminhada` | no | yes | no | no | remove-from-desktop | No handler or publisher evidence; appears to be legacy alias for `suite.reencaminhada`. |
| `pacotes.rejeitada` | no | yes | no | no | remove-from-desktop | No handler or publisher evidence; appears to be legacy alias for `suite.rejeitada`. |
| `registro_dados.atualizado` | no | yes | no | no | remove-from-desktop | No event handler or publisher evidence in checked paths; registry table usage is not event coverage. |
| `registro_formularios.atualizado` | no | yes | no | no | remove-from-desktop | No event handler or publisher evidence in checked paths; registry table usage is not event coverage. |
| `visuais_modulos.created` | no | yes | yes | no | handler-only | Desktop `ModuleSyncHandler` handles it; no mobile handler or core declaration, so promote to core only if visual sync is still required. |
| `visuais_modulos.deleted` | no | yes | yes | no | handler-only | Desktop `ModuleSyncHandler` handles it; no mobile handler or core declaration, so promote to core only if visual sync is still required. |
| `visuais_modulos.updated` | no | yes | yes | no | handler-only | Desktop `ModuleSyncHandler` handles it; no mobile handler or core declaration, so promote to core only if visual sync is still required. |

## Evidence Notes

- Desktop handler coverage checked in `desktop/src/infrastructure/sync/HandlerRegistry.ts`; visual module events are registered by `desktop/src/infrastructure/sync/module/ModuleSyncHandler.ts`.
- Mobile handler coverage checked in `mobile/www/js/sync/HandlerRegistry.js`.
- Broader evidence checked with fixed-string search under `desktop/src` and `mobile/www/js` for divergent events.
