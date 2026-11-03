// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Quasar feature flag for the store typings; Quasar regenerates it if missing
import "quasar/dist/types/feature-flag";

declare module "quasar/dist/types/feature-flag" {
  interface QuasarFeatureFlags {
    store: true;
  }
}
