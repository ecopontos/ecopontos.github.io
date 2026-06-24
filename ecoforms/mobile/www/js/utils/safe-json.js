/**
 * safe-json.js — Serialização JSON segura para troca mobile-desktop
 * Lida com: BigInt, Date, circular refs, undefined, Symbol, Function
 *
 * Exporta globalmente via window.safeStringify, window.safeParse, window.computeContentHash
 */

(function () {
    'use strict';

    const CIRCULAR_REPLACEMENT = '[Circular]';
    const BIGINT_PREFIX = '__BigInt__:';

    /**
     * Converte qualquer valor em uma representação JSON segura e determinística.
     * - BigInt → string com prefixo "__BigInt__:123"
     * - Date → ISO string
     * - undefined → null (em arrays) / omitido (em objetos)
     * - Function/Symbol → omitido
     * - Referências circulares → "[Circular]"
     * - Chaves de objetos ordenadas alfabeticamente (determinístico)
     */
    function safeStringify(value, space = 0) {
        const seen = new WeakSet();

        function replacer(key, val) {
            // 1. Ignorar functions e symbols
            if (typeof val === 'function' || typeof val === 'symbol') {
                return undefined;
            }

            // 2. BigInt
            if (typeof val === 'bigint') {
                return BIGINT_PREFIX + val.toString();
            }

            // 3. Date → ISO string (não depender de JSON.stringify padrão que chama toJSON)
            if (val instanceof Date) {
                return val.toISOString();
            }

            // 4. Detectar referências circulares
            if (val !== null && typeof val === 'object') {
                if (seen.has(val)) {
                    return CIRCULAR_REPLACEMENT;
                }
                seen.add(val);
            }

            return val;
        }

        // Usar JSON.stringify padrão com replacer, depois ordenar chaves se necessário
        // Para garantir determinismo, usamos um stringify custom que ordena chaves
        return deterministicStringify(value, replacer, space);
    }

    /**
     * Stringify determinístico com chaves ordenadas e replacer customizado
     */
    function deterministicStringify(value, replacer, space) {
        if (value === undefined) {
            return undefined;
        }

        const processed = replacer('', value);

        if (processed === undefined) {
            return undefined;
        }

        return stringifyValue(processed, replacer, space, 0);
    }

    function stringifyValue(val, replacer, space, depth) {
        if (val === null) {
            return 'null';
        }

        const type = typeof val;

        if (type === 'boolean' || type === 'number') {
            return String(val);
        }

        if (type === 'string') {
            return JSON.stringify(val);
        }

        if (type === 'bigint') {
            return JSON.stringify(BIGINT_PREFIX + val.toString());
        }

        if (Array.isArray(val)) {
            const indent = space ? '\n' + ' '.repeat(space * (depth + 1)) : '';
            const closingIndent = space ? '\n' + ' '.repeat(space * depth) : '';
            const items = val.map((item) => {
                const processed = replacer('', item);
                if (processed === undefined) {
                    return 'null';
                }
                return stringifyValue(processed, replacer, space, depth + 1);
            });
            if (space) {
                return '[' + indent + items.join(',' + indent) + closingIndent + ']';
            }
            return '[' + items.join(',') + ']';
        }

        if (type === 'object') {
            const keys = Object.keys(val).sort();
            const indent = space ? '\n' + ' '.repeat(space * (depth + 1)) : '';
            const closingIndent = space ? '\n' + ' '.repeat(space * depth) : '';
            const entries = [];
            for (const key of keys) {
                const processed = replacer(key, val[key]);
                if (processed === undefined) {
                    continue;
                }
                const keyStr = JSON.stringify(key);
                const valueStr = stringifyValue(processed, replacer, space, depth + 1);
                entries.push(keyStr + ':' + (space ? ' ' : '') + valueStr);
            }
            if (space) {
                return '{' + indent + entries.join(',' + indent) + closingIndent + '}';
            }
            return '{' + entries.join(',') + '}';
        }

        // Fallback para tipos inesperados
        return JSON.stringify(val);
    }

    /**
     * Parse reverso: converte strings marcadas de BigInt de volta para BigInt
     * (útil se o desktop também suportar BigInt, ou para debug)
     */
    function safeParse(text) {
        return JSON.parse(text, (key, value) => {
            if (typeof value === 'string' && value.startsWith(BIGINT_PREFIX)) {
                try {
                    return BigInt(value.slice(BIGINT_PREFIX.length));
                } catch (_) {
                    return value;
                }
            }
            return value;
        });
    }

    /**
     * Calcula SHA-256 hex do objeto serializado com safeStringify.
     * Retorna Promise<string>.
     */
    async function computeContentHash(data) {
        if (typeof crypto === 'undefined' || !crypto.subtle) {
            throw new Error('crypto.subtle não disponível para calcular hash');
        }
        const json = safeStringify(data);
        const encoder = new TextEncoder();
        const buffer = encoder.encode(json);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Expor globalmente
    if (typeof window !== 'undefined') {
        window.safeStringify = safeStringify;
        window.safeParse = safeParse;
        window.computeContentHash = computeContentHash;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { safeStringify, safeParse, computeContentHash };
    }
})();
