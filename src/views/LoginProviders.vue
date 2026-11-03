<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card-section v-if="providers.length">
    <div class="login-sso-title">Or continue with single sign-on</div>
    <q-separator />
    <q-list class="q-pa-sm" bordered dense>
      <q-item
        v-for="choice in providers"
        :key="choice.id"
        class="q-pa-xs hover-bg"
        :disable="redirecting"
        clickable
        @click="goToProvider(choice.id)"
      >
        <q-item-section class="text-primary" avatar>
          <q-icon size="sm" :name="choice.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ choice.name }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-card-section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { fetchSSOLoginProviders, startSSOLogin } from "@/sso/api";
import type { SSOLoginProvider } from "@/sso/types";
import { useAuthStore } from "@/stores/auth";

// single sign-on choices under the password form; hidden when none are set up
const session = useAuthStore();
const providers = ref<SSOLoginProvider[]>([]);
const redirecting = ref(false);

// the redirect replaces this page, so a second click does nothing
function goToProvider(id: string) {
  if (redirecting.value) return;
  redirecting.value = true;
  session.provider_id = id;
  startSSOLogin(id);
}

// back from the provider, the browser may restore this page from its cache
// with the list still disabled
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) redirecting.value = false;
}

onMounted(async () => {
  window.addEventListener("pageshow", onPageShow);
  try {
    providers.value = await fetchSSOLoginProviders();
  } catch (e) {
    console.error(e);
  }
});

onBeforeUnmount(() => window.removeEventListener("pageshow", onPageShow));
</script>

<style scoped>
.login-sso-title {
  text-align: center;
  font-size: 12px;
  color: var(--rmm-text-subtle);
  margin-bottom: 16px;
}
</style>
