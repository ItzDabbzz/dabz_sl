import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  // Global linter options
  {
    linterOptions: {
      // Avoid reporting unused eslint-disable directives globally to keep CI clean
      reportUnusedDisableDirectives: "off",
    },
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Too noisy for this codebase; TS + build catches the important cases
      "@typescript-eslint/no-unused-vars": "off",
      // Next/React specific: allow <img> in debug areas without warning
      "@next/next/no-img-element": "off",
      // Exhaustive deps often noisy for controlled effects/memos in this app; rely on reviews
      "react-hooks/exhaustive-deps": "off",
      // React Compiler lint rules (eslint-plugin-react-hooks v6) — the codebase
      // predates them and uses the classic effects/data-fetch patterns they flag.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Existing relaxed settings
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default eslintConfig;
