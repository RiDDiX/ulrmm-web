// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { boot } from "quasar/wrappers";
import { createPinia } from "pinia";

export default boot(({ app }) => {
  const pinia = createPinia();

  app.use(pinia);

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)
});
