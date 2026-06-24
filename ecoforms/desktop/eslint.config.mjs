import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Regras de boundaries da Clean Architecture.
// Fase 6: nível `error` — build falha se houver violação de camada.
const boundaryLevel = "error";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [boundaryLevel, {
        patterns: [
          { group: ["react", "react-dom"], message: "domain/ não pode depender de React." },
          { group: ["@tauri-apps/*"], message: "domain/ não pode importar Tauri." },
          { group: ["@supabase/*"], message: "domain/ não pode importar Supabase." },
          { group: ["**/infrastructure/**"], message: "domain/ não pode importar infrastructure/." },
          { group: ["**/application/**"], message: "domain/ não pode importar application/." },
        ],
      }],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [boundaryLevel, {
        patterns: [
          { group: ["react", "react-dom"], message: "application/ não pode depender de React." },
          { group: ["@tauri-apps/*"], message: "application/ não pode importar Tauri." },
          { group: ["@supabase/*"], message: "application/ não pode importar Supabase." },
          { group: ["**/infrastructure/**"], message: "application/ não pode importar infrastructure/." },
        ],
      }],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [boundaryLevel, {
        patterns: [
          { group: ["@tauri-apps/*"], message: "UI não deve chamar Tauri direto — use um hook de src/interface/." },
          { group: ["@supabase/*"], message: "UI não deve importar Supabase direto — use um hook de src/interface/." },
          { group: ["**/lib/supabase", "**/lib/supabase-*"], message: "UI não deve importar @/lib/supabase — use um hook de src/interface/." },
          { group: ["**/lib/sync/**"], message: "UI não deve importar @/lib/sync — use um hook de src/interface/." },
          { group: ["**/src/infrastructure/**"], message: "UI não deve importar src/infrastructure/** direto — use um hook de src/interface/." },
          { group: ["@/hooks/*"], message: "Hooks legados deletados — use @/src/interface/hooks/." },
        ],
      }],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/_deprecated/**/*.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src-tauri/**",
    "node_modules/**",
    // Utility/migration scripts (CommonJS — not app code)
    "*.js",
    "scripts/*.js",
  ]),
]);

export default eslintConfig;
