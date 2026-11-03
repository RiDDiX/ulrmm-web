// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { ref } from "vue";
import { useStore } from "vuex";
import { fetchURLActions } from "@/api/core";
import { fetchPackages } from "@/api/packages";
import { fetchScripts } from "@/api/scripts";

const byName = (a, b) => a.name.localeCompare(b.name);

// Lists the device action menu offers: the software catalog for the
// install entry (a 403 hides that entry), web URL actions and starred
// scripts. Failures leave a list empty.
export function useAgentMenuLists() {
  const store = useStore();
  const catalog = ref(null);
  const catalogDenied = ref(false);
  const catalogFailed = ref(false);
  const webLinks = ref([]);
  const starred = ref([]);

  function loadCatalog() {
    return fetchPackages().then(
      (packages) => {
        catalog.value = packages;
      },
      (err) => {
        if (err?.response?.status === 403) catalogDenied.value = true;
        else catalogFailed.value = true;
      },
    );
  }

  const loadWebLinks = () =>
    fetchURLActions()
      .then((actions) => {
        const web = actions.filter((a) => a.action_type === "web");
        webLinks.value = web.sort(byName);
      })
      .catch((err) => console.error(err));

  function loadStarred() {
    starred.value = [];
    const filters = { showCommunityScripts: store.state.showCommunityScripts };
    return fetchScripts(filters)
      .then((scripts) => {
        const picked = scripts.filter((s) => s.favorite);
        starred.value = picked
          .map(({ id, name }) => ({ id, name }))
          .sort(byName);
      })
      .catch((err) => console.error(err));
  }

  // catalog in parallel, the scripts only after the URL actions
  async function load() {
    loadCatalog();
    await loadWebLinks();
    await loadStarred();
  }

  return { catalog, catalogDenied, catalogFailed, webLinks, starred, load };
}
