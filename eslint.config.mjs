// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      // build output and installed packages
      "dist/",
      ".quasar/",
      "node_modules/",
      // folders of Quasar modes this app does not build
      "src-capacitor/",
      "src-cordova/",
      "src-ssr/",
    ],
  },

  // order matters: prettier has to come last to switch off style rules
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  prettier,

  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      // vue-eslint-parser (from plugin:vue) hands <script> blocks to this parser
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...Object.fromEntries(
          [
            "Capacitor",
            "__QUASAR_SSR_CLIENT__",
            "__QUASAR_SSR_PWA__",
            "__QUASAR_SSR_SERVER__",
            "__QUASAR_SSR__",
            "__statics",
            "chrome",
            "cordova",
            "ga",
            "process",
          ].map((name) => [name, "readonly"]),
        ),
      },
    },
    rules: {
      quotes: ["warn", "double", { avoidEscape: true }],
      "prefer-promise-reject-errors": "off",
      // type definitions trip the core rule
      "no-unused-vars": "off",
      // render functions and CommonJS config files
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    },
  },
);
