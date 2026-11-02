<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog v-model="open" persistent @hide="onHidden">
    <q-card class="rmm-card rmm-dialog--sm" :aria-labelledby="TITLE_ID">
      <DialogHeader
        :title="wording.title"
        :subtitle="wording.subtitle"
        :title-id="TITLE_ID"
      />
      <q-form ref="codeForm" @submit.prevent="submitCode">
        <q-card-section v-if="enrolment">
          <div class="q-mb-md">
            Scan the code with your authenticator app, then enter the current
            6-digit code to confirm within 10 minutes. Keep the manual key
            somewhere safe. If you close this before a code is accepted, the
            next sign-in starts setup again with a new key.
          </div>
          <div class="text-center q-mb-md">
            <img
              v-if="keyQr"
              class="enrol-qr"
              :src="keyQr"
              alt="QR code holding the two-factor setup key"
            />
          </div>
          <div class="text-caption rmm-muted">Manual key</div>
          <div class="row items-center no-wrap">
            <span class="col rmm-mono ellipsis">{{ enrolment.key }}</span>
            <q-btn
              icon="content_copy"
              aria-label="Copy manual key"
              dense
              flat
              round
              @click="copyOutput(enrolment.key)"
            >
              <q-tooltip>Copy manual key</q-tooltip>
            </q-btn>
          </div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="code"
            class="rmm-otp"
            label="Authentication code"
            inputmode="numeric"
            autocomplete="one-time-code"
            :error="!!codeError"
            :error-message="codeError"
            :rules="[filled]"
            autofocus
            hide-bottom-space
            outlined
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup label="Cancel" flat />
          <q-btn
            label="Submit"
            color="primary"
            type="submit"
            unelevated
            :loading="busy"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { QForm } from "quasar";
import { useRouter } from "vue-router";
import { useQRCode } from "@vueuse/integrations/useQRCode";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useAuthStore } from "@/stores/auth";
import { copyOutput } from "@/utils/helpers";

// the second sign-in step: the code prompt, which during enrolment also shows
// the new key. The key is never stored or logged; the parent drops it when
// the prompt closes and the QR image goes with it here.
const props = defineProps<{
  creds: { username: string; password: string };
  enrolment: { key: string; uri: string } | null;
}>();
const emit = defineEmits<{ hidden: [] }>();
const open = defineModel<boolean>({ required: true });

const TITLE_ID = "two-factor-title";
const filled = (val: string) => !!val || "This field is required";

const session = useAuthStore();
const router = useRouter();

const codeForm = ref<QForm | null>(null);
const code = ref("");
const codeError = ref("");
const busy = ref(false);
const keyQr = useQRCode(computed(() => props.enrolment?.uri ?? ""));

const wording = computed(() =>
  props.enrolment
    ? {
        title: "Set up two-factor authentication",
        subtitle:
          "Scan the QR code with your authenticator app, then enter the 6-digit code the app shows",
      }
    : {
        title: "Two-factor code",
        subtitle: "Enter the 6-digit code from your authenticator app",
      },
);

// each opening starts with an empty field
watch(open, (isOpen) => {
  if (!isOpen) return;
  code.value = "";
  codeError.value = "";
});

async function submitCode() {
  codeError.value = "";
  busy.value = true;
  try {
    await session.login({ ...props.creds, twofactor: code.value });
    router.push(session.takeNext() ?? { name: "Dashboard" });
    // only an accepted code closes the prompt; after a rejected one it stays
    // open, so onHidden never sees that case
    open.value = false;
  } catch (err) {
    const res = (err as { response?: LoginFailure })?.response;
    console.error("login failed", res?.status);
    codeError.value = failureText(res);
    code.value = "";
  } finally {
    busy.value = false;
  }
}

type LoginFailure = { status: number; data?: unknown };

// the login request is silent, so this is the only place the reason shows
function failureText(res?: LoginFailure): string {
  if (!res) return "The server cannot be reached; try again";
  if (res.status >= 500) return "The server returned an error; try again";
  const { data } = res;
  if (res.status === 429) {
    return (data as { detail?: string })?.detail ?? "Too many attempts";
  }
  // a sentence other than the plain rejection, e.g. an unreadable key
  if (typeof data === "string" && data !== "Bad credentials") return data;
  return "Invalid code";
}

// after an accepted code and on Cancel
function onHidden() {
  codeForm.value?.reset();
  code.value = "";
  codeError.value = "";
  keyQr.value = "";
  emit("hidden");
}

onBeforeUnmount(() => {
  keyQr.value = "";
});
</script>

<style scoped>
.enrol-qr {
  width: 200px;
  max-width: 100%;
  height: auto;
}
</style>
