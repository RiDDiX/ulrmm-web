<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rmm-auth-page flex flex-center">
    <q-card
      v-if="failed"
      class="rmm-auth-card text-center q-pa-lg"
      role="alert"
    >
      <img
        v-if="branding.logo"
        :src="branding.logo"
        :alt="`${branding.productName} logo`"
        class="rmm-auth-logo q-mb-sm"
      />
      <div class="rmm-auth-product q-mb-lg">{{ branding.productName }}</div>
      <q-icon
        name="error_outline"
        size="40px"
        color="negative"
        class="q-mb-sm"
      />
      <p class="text-negative">
        Single sign-on did not complete. Go back and try again, or use another
        login method.
      </p>
      <q-btn color="primary" unelevated class="full-width" to="/login">
        Go back to login
      </q-btn>
    </q-card>
    <div v-else class="column items-center q-gutter-md" role="status">
      <q-spinner color="primary" size="40px" />
      <div class="rmm-muted">Completing single sign-on</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useBrandingStore } from "@/stores/branding";

const auth = useAuthStore();
const branding = useBrandingStore();
const route = useRoute();
const router = useRouter();

const failed = ref(false);

function fail() {
  auth.provider_id = null;
  failed.value = true;
}

onMounted(async () => {
  if ("error" in route.query) {
    fail();
    return;
  }

  if (!auth.loggedIn) {
    try {
      await auth.ssoLogin();
    } catch (err) {
      console.error(err);
      fail();
      return;
    }
  }

  // a full page load: stores and the dashinfo socket start for this user.
  // nextTick lets the session store write token and next first
  const target = auth.takeNext() ?? { name: "Dashboard" };
  await nextTick();
  window.location.replace(router.resolve(target).href);
});
</script>
