<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rmm-auth-page flex flex-center">
    <q-card class="rmm-auth-card text-center q-pa-lg">
      <img
        v-if="branding.logo"
        :src="branding.logo"
        :alt="`${branding.productName} logo`"
        class="rmm-auth-logo q-mb-sm"
      />
      <div class="rmm-auth-product q-mb-lg">{{ branding.productName }}</div>
      <div class="text-h4 text-weight-bold q-mb-sm">404</div>
      <p class="rmm-muted">The page you requested could not be found.</p>
      <q-btn
        color="primary"
        unelevated
        class="full-width"
        @click="$router.push('/')"
      >
        Go to dashboard
      </q-btn>
    </q-card>
  </div>
</template>

<script>
import { useBrandingStore } from "@/stores/branding";

export default {
  name: "NotFound",
  setup() {
    return { branding: useBrandingStore() };
  },
};
</script>
