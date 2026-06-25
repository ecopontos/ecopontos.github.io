import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    entry: [
        // Next.js App Router — pages, layouts, route handlers são entrypoints do framework
        'app/**/{page,layout,loading,error,not-found,route,template,default}.tsx',
        // Scripts (.ts e .js — ex.: seed-local-admin.js usa bcryptjs)
        'scripts/**/*.{ts,js}',
        // Container — ponto de entrada do DI
        'src/infrastructure/container.ts',
        // Config files
        'next.config.*',
    ],
    project: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'contexts/**/*.{ts,tsx}',
        'src/**/*.{ts,tsx}',
        'types/**/*.{ts,tsx}',
        '!**/*.test.{ts,tsx}',
        '!**/*.spec.{ts,tsx}',
        '!**/node_modules/**',
        '!**/_deprecated/**',
    ],
    ignore: [
        // Arquivos de test / fake
        'src/test/**',
    ],
    ignoreDependencies: [
        // Usadas por Next.js/Tauri build, não por imports diretos
        '@tauri-apps/cli',
        'tailwindcss',
        // Peer de runtime do React/Next — sem import direto no código
        'react-dom',
        '@types/react-dom',
        // Pacote local do monorepo (tsconfig paths → ../packages/core/dist),
        // resolve em runtime mas não consta no package.json. Cobre subpaths
        // (ecoforms-core/sync, ecoforms-core/permissions) via regex.
        'ecoforms-core',
        // Plugin do Tailwind v4 carregado via CSS (@plugin em app/globals.css),
        // sem import JS — knip não lê CSS.
        'tailwindcss-animate',
        // Usados em testes (src/test/**, ignorados pelo knip). @testing-library/dom
        // é peer obrigatório do @testing-library/react@16.
        '@testing-library/react',
        '@testing-library/dom',
    ],
    // Binários invocados via scripts/Tauri/cargo. next/eslint constam como deps
    // mas o knip não associa o binário ao pacote — falso positivo.
    ignoreBinaries: ['tauri', 'cargo', 'next', 'eslint'],
    // Regras de plugin para Next.js
    next: {
        entry: [
            'app/**/{page,layout,loading,error,not-found,route,template,default}.tsx',
        ],
    },
};

export default config;
