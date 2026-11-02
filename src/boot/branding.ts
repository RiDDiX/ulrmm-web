// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { boot } from "quasar/wrappers";
import { useBrandingStore } from "@/stores/branding";

// load white-label branding (public endpoint) before the app mounts so the
// login page, document title and favicon are correct on first paint
export default boot(async () => {
  await useBrandingStore().load();
});
