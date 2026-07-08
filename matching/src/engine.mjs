import { runMatchingJS } from './engine-js.mjs';
import { buildSummary } from './summary.mjs';

export async function runMatching(trajeto, network, opts = {}) {
  const { engine = 'js', duckdbFn = null, onFallback = null } = opts;
  let base;
  if (engine === 'duckdb' && duckdbFn) {
    try {
      base = await duckdbFn(trajeto, network);
    } catch (err) {
      if (onFallback) {
        try {
          onFallback(err);
        } catch (_ignored) {
          // onFallback nao pode impedir o fallback para JS
        }
      }
      base = runMatchingJS(trajeto, network);
    }
  } else {
    base = runMatchingJS(trajeto, network);
  }
  const resumo = buildSummary(trajeto, base.segmentos, base.pontos_casados);
  return { ...base, resumo };
}
