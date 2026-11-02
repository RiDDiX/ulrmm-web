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
      <q-icon name="lock_clock" size="40px" class="rmm-muted q-mb-sm" />
      <p class="rmm-muted">
        {{
          reason === "logout"
            ? "You have been logged out"
            : "Your session has expired"
        }}
      </p>
      <q-btn color="primary" unelevated class="full-width" to="/login">
        Log in
      </q-btn>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useDashWSConnection } from "@/websocket/websocket";
import { useBrandingStore } from "@/stores/branding";

// setup store
const auth = useAuthStore();
const branding = useBrandingStore();
const route = useRoute();
const reason = route.query.reason;

// setup websocket
const { close } = useDashWSConnection();

onMounted(async () => {
  await auth.logout();
  close();
});
</script>
