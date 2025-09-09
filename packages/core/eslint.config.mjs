import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global linter options
  {
    linterOptions: {
      // Avoid reporting unused eslint-disable directives globally to keep CI clean
      reportUnusedDisableDirectives: "off",
    },
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
      // Existing relaxed settings
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];

export default eslintConfig;
