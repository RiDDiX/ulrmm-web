<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="scroll" style="max-height: calc(100vh - 260px)">
    <q-card flat>
      <q-card-section>
        <q-input
          v-model="t.name"
          label="Name"
          dense
          outlined
          class="q-mb-none tpl-name"
          hide-bottom-space
          :rules="[(val) => !!val || '*Required']"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-toggle v-model="t.is_active" label="Enabled" left-label />
        <div class="text-caption rmm-muted">
          A disabled template is skipped; its agents use the next template that
          applies, if any.
        </div>
      </q-card-section>

      <div class="tpl-section">Email settings</div>
      <div class="tpl-caption">
        Overrides the global email settings for alerts under this template;
        leave empty to use the global ones.
      </div>

      <q-card-section>
        <q-input
          v-model="t.email_from"
          label="Email From address"
          hint="Sender address for these alerts; empty uses the global sender"
          class="q-mb-sm"
          outlined
          dense
        />
      </q-card-section>

      <TemplateRecipients
        title="Email recipients"
        :items="t.email_recipients"
        remove-tip="Remove this recipient"
        empty-text="No recipients; the global email recipients get these alerts."
        add-label="Add email"
        @add="addEmail"
        @remove="dropFrom('email_recipients', $event)"
      />

      <div class="tpl-section">SMS settings</div>
      <div class="tpl-caption">
        Overrides the global SMS settings for alerts under this template; leave
        empty to use the global ones.
      </div>

      <TemplateRecipients
        mono
        gap="q-mb-md"
        title="SMS recipients"
        :items="t.text_recipients"
        remove-tip="Remove this number"
        empty-text="No recipients; the global SMS recipients get these alerts."
        add-label="Add SMS number"
        @add="addNumber"
        @remove="dropFrom('text_recipients', $event)"
      />
    </q-card>
  </div>
</template>

<script setup>
import { toRef } from "vue";
import { useQuasar } from "quasar";
import { isValidEmail } from "@/utils/validation";
import TemplateRecipients from "@/components/modals/alerts/TemplateRecipients.vue";

const props = defineProps({ template: { type: Object, required: true } });
const $q = useQuasar();
const t = toRef(props, "template");

const E164 = /^\+[1-9]\d{6,14}$/;
const E164_HELP =
  "Use E.164 format: must have the <b>+</b> symbol and <span class='text-red'>country code</span>, followed by the <span class='text-green'>phone number</span> e.g. <b>+<span class='text-red'>1</span><span class='text-green'>2131231234</span></b>";

function addEmail() {
  $q.dialog({
    title: "Add email",
    prompt: { model: "", isValid: isValidEmail, type: "email" },
    cancel: true,
    ok: { label: "Add", color: "primary" },
    persistent: false,
  }).onOk((email) => t.value.email_recipients.push(email));
}

function addNumber() {
  $q.dialog({
    title: "Add number",
    message: E164_HELP,
    prompt: { model: "", isValid: (val) => E164.test(val) },
    html: true,
    cancel: true,
    ok: { label: "Add", color: "primary" },
    persistent: false,
  }).onOk((num) => t.value.text_recipients.push(num));
}

function dropFrom(field, value) {
  t.value[field] = t.value[field].filter((k) => k !== value);
}
</script>
