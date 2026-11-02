<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="channel-dialog-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="channel-dialog-title"
        :title="channel ? 'Edit channel' : 'Add channel'"
        subtitle="Where notifications are delivered"
      />
      <q-form @submit="submit">
        <q-card-section class="scroll q-gutter-y-sm" style="max-height: 72vh">
          <q-input
            v-model="form.name"
            label="Name"
            outlined
            dense
            :rules="[(v) => !!v || '*Required']"
          />
          <q-select
            v-model="form.kind"
            :options="kindOptions"
            label="Kind"
            emit-value
            map-options
            outlined
            dense
            options-dense
            :disable="!!channel"
            :hint="channel ? 'The kind cannot change after creation' : ''"
          />
          <q-banner dense rounded class="channel-help" role="note">
            <template #avatar><q-icon name="info" size="20px" /></template>
            {{ kind.help }}
          </q-banner>
          <q-input
            v-for="f in kind.fields"
            :key="f.key"
            v-model="form.config[f.key]"
            :label="f.label"
            :hint="f.hint"
            :placeholder="f.placeholder"
            outlined
            dense
            :rules="f.optional ? [] : [(v) => !!v || '*Required']"
            :error="configError(f.key) ? true : undefined"
            :error-message="configError(f.key)"
          />
          <template v-if="kind.secretLabel">
            <SecretInput
              v-model="form.secret"
              :label="kind.secretLabel"
              v-model:clear="form.secret_clear"
              :stored="!!channel?.secret_set"
              :error="errors.secret ? true : undefined"
              :error-message="errors.secret"
            />
            <div class="text-caption rmm-muted channel-note">
              {{ kind.secretHint }}
            </div>
            <div
              v-if="channel?.secret_set && addressKey"
              class="text-caption rmm-muted channel-note"
            >
              If you change the server address, enter the secret again.
            </div>
          </template>
          <q-select
            v-model="form.min_severity"
            :options="SEVERITIES"
            label="Minimum severity"
            outlined
            dense
            options-dense
            hint="Lower severities are not sent to this channel"
          />
          <div class="row q-col-gutter-x-sm">
            <div class="col-6">
              <q-input
                v-model="form.quiet_start"
                type="time"
                label="Quiet hours from"
                outlined
                dense
                clearable
                stack-label
                hint="Default time zone from Global Settings > General"
              />
            </div>
            <div class="col-6">
              <q-input
                v-model="form.quiet_end"
                type="time"
                label="Quiet hours until"
                outlined
                dense
                clearable
                stack-label
                hint="Held messages go out then as one digest"
                :error="errors.quiet_end ? true : undefined"
                :error-message="errors.quiet_end"
              />
            </div>
          </div>
          <q-toggle v-model="form.enabled" label="Enabled" />
          <div
            v-for="(text, key) in otherErrors"
            :key="key"
            class="text-caption text-negative"
            role="alert"
          >
            {{ NO_FIELD.includes(key) ? text : `${key}: ${text}` }}
          </div>
        </q-card-section>
        <DialogActions :loading="saving" @cancel="onDialogCancel" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import SecretInput from "@/components/ui/SecretInput.vue";
import { saveChannel } from "@/api/notify";
import { CHANNEL_KINDS, SEVERITIES } from "@/utils/notifyChannels";
import { notifyError, notifySuccess } from "@/utils/notify";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";

const props = defineProps({ channel: { type: Object, default: null } });
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const kindOptions = Object.entries(CHANNEL_KINDS).map(([value, k]) => ({
  value,
  label: k.label,
}));

function initialForm() {
  const c = props.channel;
  return {
    name: c?.name || "",
    kind: c?.kind || "matrix",
    config: Object.fromEntries(
      Object.entries(c?.config || {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.join(", ") : v,
      ]),
    ),
    secret: "",
    secret_clear: false,
    min_severity: c?.min_severity || "info",
    quiet_start: c?.quiet_start || null,
    quiet_end: c?.quiet_end || null,
    enabled: c ? c.enabled !== false : true,
  };
}
const form = ref(initialForm());
const saving = ref(false);
const errors = ref({});
// the config key whose change needs the secret again
const addressKey = computed(
  () => ({ matrix: "homeserver", ntfy: "server" })[form.value.kind],
);
// the server names the config key first: "homeserver: https:// address ..."
function configError(key) {
  const text = errors.value.config || "";
  return text.startsWith(`${key}: `) ? text.slice(key.length + 2) : "";
}
const configShown = computed(() =>
  kind.value.fields.some((f) => configError(f.key)),
);
const otherErrors = computed(() =>
  Object.fromEntries(
    Object.entries(errors.value).filter(
      ([k]) =>
        k !== "secret" &&
        k !== "quiet_end" &&
        !(k === "config" && configShown.value),
    ),
  ),
);

// 400 {"field": ["text"]} -> {field: "text"}; these keys name no field
const NO_FIELD = ["non_field_errors", "detail"];
function fieldErrors(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      String(Array.isArray(v) ? v[0] : v),
    ]),
  );
}
const kind = computed(
  () => CHANNEL_KINDS[form.value.kind] || CHANNEL_KINDS.email,
);

async function submit() {
  saving.value = true;
  errors.value = {};
  try {
    // only the fields of the chosen kind go to the server
    const config = {};
    for (const f of kind.value.fields) {
      const v = (form.value.config[f.key] ?? "").toString().trim();
      if (f.list)
        config[f.key] = v
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      else if (v || !f.optional) config[f.key] = v;
    }
    const payload = {
      name: form.value.name,
      kind: form.value.kind,
      config,
      min_severity: form.value.min_severity,
      quiet_start: form.value.quiet_start || null,
      quiet_end: form.value.quiet_end || null,
      enabled: form.value.enabled,
    };
    if (form.value.secret) payload.secret = form.value.secret;
    if (form.value.secret_clear) payload.secret_clear = true;
    const saved = await saveChannel(
      props.channel?.id,
      payload,
      SILENT_REQUEST_CONFIG,
    );
    notifySuccess(props.channel ? "Channel saved" : "Channel added");
    onDialogOK(saved);
  } catch (e) {
    errors.value = fieldErrors(e?.response?.data);
    if (!Object.keys(errors.value).length)
      notifyError("The channel could not be saved.");
  }
  saving.value = false;
}
</script>

<style scoped>
.channel-help {
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
}

/* lines up with the hints under the fields */
.channel-note {
  margin-top: 0;
  padding: 4px 12px 0;
}
</style>
