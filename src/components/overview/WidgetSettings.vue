<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="widget-settings-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="widget-settings-title"
        :title="`${title} settings`"
        subtitle="Saved with your overview layout"
      />
      <q-form @submit="save">
        <q-card-section class="widget-settings__body">
          <template v-for="field in fields" :key="field.key">
            <q-input
              v-if="field.kind === 'int'"
              v-model.number="form[field.key]"
              type="number"
              outlined
              dense
              :label="field.label"
              :min="field.min"
              :max="field.max"
              :hint="`${field.min} to ${field.max}`"
              :error="!!fieldError(field.key)"
              :error-message="fieldError(field.key)"
            />
            <q-select
              v-else-if="field.kind === 'choice'"
              v-model="form[field.key]"
              outlined
              dense
              emit-value
              map-options
              :label="field.label"
              :options="
                field.choices.map((value) => ({
                  value,
                  label: RANGE_LABELS[value] || value,
                }))
              "
            />
            <q-select
              v-else-if="field.kind === 'choices'"
              v-model="form[field.key]"
              outlined
              dense
              multiple
              use-chips
              emit-value
              map-options
              :label="field.label"
              hint="None picked shows every type"
              :options="
                field.choices.map((value) => ({
                  value,
                  label: typeMeta(value).label,
                }))
              "
              :error="!!fieldError(field.key)"
              :error-message="fieldError(field.key)"
            />
            <q-select
              v-else-if="field.kind === 'ids'"
              v-model="form[field.key]"
              outlined
              dense
              multiple
              use-chips
              emit-value
              map-options
              :label="field.label"
              :options="idOptions"
              :max-values="field.max"
              :loading="idsLoading"
              :hint="idsError || ID_SOURCES[field.source].hint(field.max)"
              :error="!!fieldError(field.key)"
              :error-message="fieldError(field.key)"
            />
            <q-input
              v-else-if="field.kind === 'text'"
              v-model="form[field.key]"
              type="textarea"
              outlined
              autogrow
              counter
              autofocus
              :label="field.label"
              :maxlength="field.max"
              :input-style="{ minHeight: '160px', maxHeight: '50vh' }"
              hint="Plain text, line breaks are kept"
              :error="!!fieldError(field.key)"
              :error-message="fieldError(field.key)"
            />
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            type="submit"
            :disable="invalid"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { fetchGroups } from "@/api/groups";
import { fetchClients } from "@/api/clients";
import { SILENT_REQUEST_CONFIG } from "@/constants/constants";
import {
  RANGE_LABELS,
  cleanSettings,
  settingsError,
  widgetMeta,
  type Widget,
} from "@/utils/overview";
import { typeMeta } from "@/utils/timeline";

const props = defineProps<{ widget: Widget; title: string }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

const fields = computed(() => widgetMeta(props.widget.type)?.settings ?? []);

// defaults, then the stored values as they are, so a value the server
// would refuse shows up with its error
const form = reactive<Record<string, unknown>>({
  ...cleanSettings(props.widget.type),
  ...Object.fromEntries(
    Object.entries(props.widget.settings || {}).filter(([key]) =>
      fields.value.some((f) => f.key === key),
    ),
  ),
});

function fieldError(key: string) {
  const error = settingsError(props.widget.type, { [key]: form[key] });
  return error ? error.replace(`${key}: `, "") : "";
}

const invalid = computed(() => !!settingsError(props.widget.type, form));

const ID_SOURCES = {
  groups: {
    load: () => fetchGroups(SILENT_REQUEST_CONFIG),
    noun: "group",
    failed: "The device groups could not be loaded.",
    hint: (max: number) => `None picked shows the first ${max} groups by name`,
  },
  clients: {
    load: () => fetchClients(SILENT_REQUEST_CONFIG),
    noun: "client",
    failed: "The clients could not be loaded.",
    hint: () => "None picked shows every client",
  },
};

// a widget has at most one id list
const idsField = computed(() => {
  const field = fields.value.find((f) => f.kind === "ids");
  return field?.kind === "ids" ? field : null;
});
const items = ref<{ id: number; name: string }[]>([]);
const idsLoading = ref(false);
const idsError = ref("");

// chosen ids that are gone stay visible, so they can be taken out
const idOptions = computed(() => {
  const field = idsField.value;
  if (!field) return [];
  const noun = ID_SOURCES[field.source].noun;
  const options = items.value.map((g) => ({ value: g.id, label: g.name }));
  const chosen = Array.isArray(form[field.key])
    ? (form[field.key] as number[])
    : [];
  for (const id of chosen)
    if (!items.value.some((g) => g.id === id))
      options.push({
        value: id,
        label:
          idsLoading.value || idsError.value
            ? `${noun[0].toUpperCase()}${noun.slice(1)} #${id}`
            : `Deleted ${noun} #${id}`,
      });
  return options;
});

onMounted(async () => {
  const field = idsField.value;
  if (!field) return;
  idsLoading.value = true;
  try {
    const data = await ID_SOURCES[field.source].load();
    items.value = Array.isArray(data) ? data : [];
  } catch {
    idsError.value = ID_SOURCES[field.source].failed;
  } finally {
    idsLoading.value = false;
  }
});

function save() {
  if (invalid.value) return;
  onDialogOK(cleanSettings(props.widget.type, form));
}
</script>

<style scoped>
.widget-settings__body {
  display: grid;
  gap: 14px;
}
</style>
