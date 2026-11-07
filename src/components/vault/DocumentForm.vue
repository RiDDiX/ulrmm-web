<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="vault-doc-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="vault-doc-form-title"
        :title="doc ? `Edit ${doc.title}` : 'New document'"
        subtitle="Plain text; line breaks are kept, nothing is rendered as markup"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <div class="row items-start q-col-gutter-md">
            <q-input
              v-model="form.title"
              class="col"
              label="Title"
              maxlength="120"
              dense
              outlined
              autofocus
              :rules="[(v) => !!v?.trim() || 'Required']"
            />
            <q-toggle v-model="form.pinned" class="col-auto" label="Pinned">
              <q-tooltip>Pinned documents are listed first</q-tooltip>
            </q-toggle>
          </div>
          <q-input
            v-model="form.body"
            type="textarea"
            label="Text"
            outlined
            input-class="vault-doc-form__body"
            :error="tooLarge"
            :error-message="`${fmtBytes(bytes)} of 100 KB, shorten the text to save`"
            :hint="`${fmtBytes(bytes)} of 100 KB`"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            :disable="saving"
            @click="onDialogCancel"
          />
          <q-btn
            unelevated
            color="primary"
            :label="doc ? 'Save' : 'Create'"
            type="submit"
            :loading="saving"
            :disable="tooLarge"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { saveDocument } from "@/api/vault";
import { notifySuccess } from "@/utils/notify";
import { fmtBytes } from "@/utils/format";

const props = defineProps({
  // null => new document in scope/scopeKey
  doc: { type: Object, default: null },
  scope: { type: String, required: true },
  scopeKey: { type: [String, Number], required: true },
});
const emit = defineEmits([...useDialogPluginComponent.emits, "forbidden"]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// the server counts utf-8 bytes
const MAX_BYTES = 100 * 1024;
const encoder = new TextEncoder();

const form = reactive({
  title: props.doc?.title ?? "",
  body: props.doc?.body ?? "",
  pinned: props.doc?.pinned ?? false,
});
const saving = ref(false);
const bytes = computed(() => encoder.encode(form.body).length);
const tooLarge = computed(() => bytes.value > MAX_BYTES);

async function submit() {
  if (tooLarge.value) return;
  saving.value = true;
  const payload = {
    title: form.title.trim(),
    body: form.body,
    pinned: form.pinned,
  };
  if (!props.doc) payload[props.scope] = props.scopeKey;
  try {
    const saved = await saveDocument(props.doc?.id, payload);
    notifySuccess(`${saved.title} was saved`);
    onDialogOK(saved);
  } catch (e) {
    // the toast comes from the axios boot; the text stays in the form
    if (e?.response?.status === 403) emit("forbidden");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.q-textarea :deep(.vault-doc-form__body) {
  min-height: 40vh;
  max-height: 55vh;
  line-height: 1.5;
}
</style>
