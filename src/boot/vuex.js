// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { boot } from "quasar/wrappers";
import createStore from "@/store";

// Quasar CLI only wires up Pinia; the dashboard state (src/store) is Vuex
export let store;

export default boot(({ app, router }) => {
  store = createStore();
  store.$router = router;
  app.use(store);
});
