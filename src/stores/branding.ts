// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { defineStore } from "pinia";

import axios from "axios";
import { getBaseUrl } from "@/boot/axios";

export interface Branding {
  product_name: string;
  company_name: string | null;
  support_url: string | null;
  logo: string | null;
  favicon: string | null;
}

const DEFAULTS: Branding = {
  product_name: "UniversalLocal RMM",
  company_name: null,
  support_url: null,
  logo: null,
  favicon: null,
};

function applyDocument(b: Branding): void {
  document.title = b.product_name || "UniversalLocal RMM";
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  // index.html declares type="image/ico"; a data: URI is a different type and
  // clearing the favicon has to fall back, not keep the old one
  link.type = "";
  link.href = b.favicon || "favicon.ico";
}

export const useBrandingStore = defineStore("branding", {
  state: () => ({ ...DEFAULTS }),
  getters: {
    productName: (state) => state.product_name || "UniversalLocal RMM",
  },
  actions: {
    async load(retry = true) {
      try {
        // public endpoint: works before login and in pop-out windows
        // hard timeout: this runs in a boot file, and quasar awaits boot files
        // before mounting - without it a blackholed API means a white page,
        // including the login page
        const { data } = await axios.get<Branding>(
          `${getBaseUrl()}/core/branding/`,
          { timeout: retry ? 3000 : 15000 },
        );
        // a proxy or SPA fallback answering with index.html would otherwise be
        // merged into the store character by character
        if (data && typeof data.product_name === "string") {
          this.$patch(data);
        } else {
          this.$patch({ ...DEFAULTS });
        }
      } catch (e) {
        // a busy API misses the boot deadline: mount with what the store has
        // and try once more in the background, with a longer timeout
        if (retry) {
          void this.load(false);
          return;
        }
        console.error("branding load failed", e);
        this.$patch({ ...DEFAULTS });
      }
      applyDocument(this.$state);
    },
  },
});
