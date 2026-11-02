<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" :persistent="!!createdKey" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        :title="title"
        subtitle="Lets scripts and other tools call the API as the chosen user"
      />
      <q-form @submit.prevent="save">
        <SchemaForm v-model="entry" :fields="fields">
          <template v-slot:field-note>
            <div class="text-caption rmm-muted">
              The API key is generated on save and shown once; copy it then.
            </div>
          </template>

          <template v-slot:field-user="{ field, model, set }">
            <rmm-select
              :model-value="model.user"
              :label="field.label"
              :hint="field.hint"
              :options="userOptions"
              :rules="field.rules"
              outlined
              mapOptions
              filterable
              @update:model-value="set"
            />
          </template>

          <template v-slot:field-created>
            <q-input
              :model-value="createdKey"
              label="Key"
              input-class="rmm-mono"
              outlined
              dense
              readonly
              autofocus
            >
              <template v-slot:append>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="content_copy"
                  aria-label="Copy API key to clipboard"
                  @click="copyKey"
                />
              </template>
            </q-input>
            <div class="text-caption text-negative q-mt-xs">
              This key is shown only now and cannot be displayed again. Copy it
              before closing.
            </div>
          </template>
        </SchemaForm>

        <q-card-actions v-if="createdKey" align="right">
          <q-btn unelevated color="primary" label="Done" @click="onDialogOK" />
        </q-card-actions>
        <FormActions v-else :loading="saving" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { copyToClipboard, useDialogPluginComponent, useQuasar } from "quasar";
import { editAPIKey, saveAPIKey } from "@/api/accounts";
import { askChangeCode, useUserDropdown } from "@/composables/accounts";
import { useAuthStore } from "@/stores/auth";
import { notifyError, notifySuccess } from "@/utils/notify";
import * as fmt from "@/utils/format";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import SchemaForm from "@/components/ui/SchemaForm.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({ APIKey: Object });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const { userOptions } = useUserDropdown(true);

const title = props.APIKey ? "Edit API Key" : "Add API Key";
const saving = ref(false);
const createdKey = ref("");

// the date input wants the stored value without its zone suffix
const entry = ref(
  props.APIKey
    ? {
        ...props.APIKey,
        expiration: fmt.formatDateInputField(props.APIKey.expiration),
      }
    : { name: "", expiration: null },
);

const fields = computed(() => [
  { key: "note", type: "text", show: () => !props.APIKey },
  {
    key: "name",
    type: "text",
    label: "Name",
    hint: "Up to 25 characters, so you can tell keys apart",
    rules: [(val) => !!val || "*Required"],
  },
  {
    key: "user",
    type: "text",
    label: "User",
    hint: "The key acts with this user's role; unless you are a superuser you can only pick yourself",
    rules: [(val) => !!val || "User is required"],
  },
  { key: "created", type: "text", show: () => !!createdKey.value },
  {
    key: "expiration",
    type: "datetime",
    label: "Key Expiration",
    hint:
      props.APIKey && !props.APIKey.expiration
        ? "In your local time; leave empty to keep a key that never expires"
        : "In your local time; leave empty for 90 days from now",
  },
]);

async function save() {
  if (createdKey.value) return;

  // keys of other users need the current code
  const me = useAuthStore().username;
  const owner = userOptions.value.find(
    (o) => o.value === entry.value.user,
  )?.label;
  let code;
  if (owner !== me || (props.APIKey && props.APIKey.username !== me)) {
    code = await askChangeCode($q, { title });
    if (code === null) return;
  }

  saving.value = true;
  const body = { ...entry.value };
  // back to a zoned timestamp. A cleared input is "", which the server
  // refuses; null gives 90 days, a key that never expired stays that way
  if (body.expiration) {
    body.expiration = fmt.formatDateStringwithTimezone(body.expiration);
  } else if (props.APIKey && !props.APIKey.expiration) {
    delete body.expiration;
  } else {
    body.expiration = null;
  }

  try {
    if (props.APIKey) {
      notifySuccess(await editAPIKey(body.id, body, code));
      onDialogOK();
    } else {
      createdKey.value = (await saveAPIKey(body, code)).key;
      notifySuccess("API key was created");
    }
  } catch {
    // the request layer already reported it
  }
  saving.value = false;
}

function copyKey() {
  copyToClipboard(createdKey.value)
    .then(() => notifySuccess("Key was copied to clipboard!"))
    .catch(() => notifyError("Unable to copy to clipboard!"));
}
</script>
