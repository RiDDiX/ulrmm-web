<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-layout>
    <q-page-container>
      <q-page class="login-page">
        <LoginStory />

        <div class="login-form-panel">
          <q-card class="login-card" flat>
            <q-card-section>
              <div class="login-form-brand">
                <span v-if="!branding.logo">{{ branding.productName }}</span>
                <img
                  v-else
                  class="login-logo rmm-auth-logo"
                  :src="branding.logo"
                  :alt="`${branding.productName} logo`"
                />
              </div>
              <h1 class="login-welcome">Welcome back</h1>
              <p class="login-description">
                Sign in to your management console.
              </p>
            </q-card-section>

            <q-card-section>
              <q-form
                ref="signInForm"
                class="q-gutter-md"
                @submit.prevent="submitCredentials"
              >
                <q-input
                  v-model="creds.username"
                  autocomplete="username"
                  label="Username"
                  :rules="[filled]"
                  lazy-rules
                  outlined
                />
                <q-input
                  v-model="creds.password"
                  :type="masked ? 'password' : 'text'"
                  autocomplete="current-password"
                  label="Password"
                  :rules="[filled]"
                  lazy-rules
                  outlined
                >
                  <template #append>
                    <q-btn
                      :icon="masked ? 'visibility_off' : 'visibility'"
                      :aria-label="revealHint"
                      :aria-pressed="!masked"
                      dense
                      flat
                      round
                      @click="masked = !masked"
                    >
                      <q-tooltip>{{ revealHint }}</q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
                <div>
                  <q-btn
                    class="login-submit full-width"
                    label="Sign in"
                    icon-right="arrow_forward"
                    :loading="checking"
                    unelevated
                    type="submit"
                    color="primary"
                  />
                </div>
                <div
                  v-if="signInError"
                  role="alert"
                  class="text-negative text-caption"
                >
                  {{ signInError }}
                </div>
              </q-form>
            </q-card-section>

            <LoginProviders />
          </q-card>

          <p class="login-security">
            <q-icon name="lock_outline" /> Local sign-in requires two-factor
            authentication
          </p>
        </div>

        <LoginCodePrompt
          v-model="promptOpen"
          :creds="creds"
          :enrolment="enrolment"
          @hidden="onPromptHidden"
        />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import type { QForm } from "quasar";
import { useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { useBrandingStore } from "@/stores/branding";
import LoginCodePrompt from "@/views/LoginCodePrompt.vue";
import LoginProviders from "@/views/LoginProviders.vue";
import LoginStory from "@/views/LoginStory.vue";

// first sign-in step: username and password. The code prompt, the provider
// list and the left-hand panel live in their own components.
useQuasar().dark.set(false);
const branding = useBrandingStore();
const session = useAuthStore();

const filled = (val: string) => !!val || "This field is required";

const signInForm = ref<QForm | null>(null);
const creds = reactive({ username: "", password: "" });
const masked = ref(true);
const revealHint = computed(() =>
  masked.value ? "Show password" : "Hide password",
);
const checking = ref(false);
const signInError = ref("");

const promptOpen = ref(false);
// set only while a new key is offered; dropped when the prompt closes
const enrolment = ref<{ key: string; uri: string } | null>(null);

function openPrompt(pending: { key: string; uri: string } | null) {
  enrolment.value = pending;
  promptOpen.value = true;
}

// the credential check returns a token that can only enrol a key, and the
// server deletes it along with that key. Any later request with it (logout
// as well) gets a 401, which the interceptor reports as an expired session.
function forgetEnrolToken() {
  Object.assign(session, { token: null, username: null, name: null });
}

function logFailure(err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status;
  console.error("login failed", status);
}

// bad credentials arrive as non_field_errors; anything else (no network and
// the like) shows the fallback
function failureText(err: unknown, fallback: string): string {
  const res = (err as { response?: { status?: number; data?: unknown } })
    ?.response;
  const body = res?.data;
  // the server's own sentence (400), e.g. an unreadable two-factor key; a
  // 502 from the proxy is an HTML page
  if (res?.status === 400 && typeof body === "string" && body) return body;
  const list = (body as { non_field_errors?: unknown } | null | undefined)
    ?.non_field_errors;
  return Array.isArray(list) && typeof list[0] === "string"
    ? list[0]
    : fallback;
}

// no key yet: the server holds a pending one and it is shown in the prompt.
// The first accepted code saves it and completes the sign-in, so nobody ends
// up with a key their authenticator app never got.
async function offerNewKey() {
  try {
    const setup = await session.setupTotp();
    if (setup) {
      const pending = { key: setup.totp_key, uri: setup.qr_url };
      forgetEnrolToken();
      openPrompt(pending);
      return;
    }
    // another session enrolled a key in the meantime, which makes this a
    // regular session token: sign it out and ask for a code instead
    await session.logout();
    openPrompt(null);
  } catch (err) {
    logFailure(err);
    forgetEnrolToken();
    enrolment.value = null;
    signInError.value = failureText(
      err,
      "Two-factor setup could not be started. Try again.",
    );
  }
}

async function submitCredentials() {
  signInError.value = "";
  checking.value = true;
  try {
    const { totp } = await session.checkCredentials(creds);
    if (totp) openPrompt(null);
    else await offerNewKey();
  } catch (err) {
    logFailure(err);
    signInError.value = failureText(err, "Bad credentials");
  } finally {
    checking.value = false;
  }
}

// a cancelled enrolment sends nothing and returns to this form; the server
// keeps a key only once a code was accepted, so the next sign-in offers a
// fresh one
function onPromptHidden() {
  signInForm.value?.reset();
  if (enrolment.value) creds.password = "";
  enrolment.value = null;
}

onBeforeUnmount(() => {
  creds.password = "";
  enrolment.value = null;
});
</script>

<style scoped>
/* the page scrolls: on a short screen the story column is the taller one */
.login-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  background: var(--rmm-surface);
}
.login-form-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 48px 32px;
}
.login-card {
  width: 100%;
  max-width: 420px;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.login-card > .q-card__section {
  padding: 16px 8px;
}
.login-card :deep(.q-list) {
  margin-top: 16px;
  border-radius: 8px;
}
.login-form-brand {
  color: var(--rmm-text-muted);
  font-weight: 600;
  margin-bottom: 36px;
}
.login-welcome {
  margin: 0;
  font-size: 32px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -1px;
}
.login-description {
  margin: 8px 0 0;
  color: var(--rmm-text-muted);
  font-size: 15px;
}
.login-submit {
  min-height: 48px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
}
.login-security {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 26px 0 0;
  color: var(--rmm-text-subtle);
  font-size: 12px;
}
@media (max-width: 700px) {
  .login-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .login-form-panel {
    padding: 36px 24px;
    justify-content: flex-start;
  }
  .login-form-brand {
    display: none;
  }
}
</style>
