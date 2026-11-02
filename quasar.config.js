// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// only the SPA build is used, the other modes keep their defaults
// Options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "#q-app";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { DEV_HOST, DEV_PORT, USE_HTTPS } = process.env;

// bundle variable -> .env key
const BUNDLE_ENV = {
  DEV_API: "DEV_URL",
  PROD_API: "PROD_URL",
  DOCKER_BUILD: "DOCKER_BUILD",
};

// shipped with every build as dist/licenses/*.txt (nginx serves .txt as plain
// text); the About dialog links to them
const LICENSE_FILES = ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES"];

function copyLicenses(distDir) {
  const target = path.join(distDir, "licenses");
  fs.mkdirSync(target, { recursive: true });
  for (const name of LICENSE_FILES) {
    fs.copyFileSync(
      path.join(__dirname, `${name}.md`),
      path.join(target, `${name}.txt`),
    );
  }
}

// hashed names only for the emitted bundle files
const hashedOutput = {
  entryFileNames: "[hash].js",
  chunkFileNames: "[hash].js",
  assetFileNames: "[hash].[ext]",
};

export default defineConfig(() => ({
  boot: ["vuex", "pinia", "axios", "branding", "monaco", "integrations"],
  css: ["app.sass"],
  extras: ["mdi-v7", "fontawesome-v6", "roboto-font", "material-icons"],
  animations: [],

  build: {
    target: { browser: ["es2022"], node: "node20" },
    vueRouterMode: "history",
    distDir: "dist/",
    alias: { "@": path.join(__dirname, "./src") },
    env: Object.fromEntries(
      Object.entries(BUNDLE_ENV).map(([name, key]) => [name, process.env[key]]),
    ),
    extendViteConf(viteConf) {
      viteConf.build.chunkSizeWarningLimit = 1600;
      viteConf.build.rolldownOptions = {
        ...viteConf.build.rolldownOptions,
        output: { ...viteConf.build.rolldownOptions?.output, ...hashedOutput },
      };
    },
    afterBuild: ({ quasarConf }) => copyLicenses(quasarConf.build.distDir),
  },

  devServer: {
    open: false,
    host: DEV_HOST,
    port: DEV_PORT,
    https: USE_HTTPS === "true",
  },

  framework: {
    iconSet: "material-icons",
    lang: "en-US",
    plugins: ["Dialog", "Loading", "LoadingBar", "Meta", "Notify"],
    config: {
      loading: { delay: 50 },
      loadingBar: { size: "4px" },
      notify: {
        position: "top",
        timeout: 2000,
        textColor: "white",
        actions: [{ color: "white", icon: "close" }],
      },
    },
  },
}));
