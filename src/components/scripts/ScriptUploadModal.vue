<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 40vw">
      <DialogHeader
        title="Upload script"
        subtitle="Creates a new script from a file on your computer"
      />
      <q-form id="scriptUploadForm" @submit="submit">
        <q-card-section class="q-gutter-y-md">
          <div class="rmm-label">Script</div>
          <q-input
            v-model="form.name"
            label="Name"
            outlined
            dense
            hide-bottom-space
            :rules="[(val) => !!val || '*Required']"
          />
          <q-input
            v-model="form.description"
            label="Description"
            outlined
            dense
          />
          <rmm-select
            v-model="form.category"
            :options="categories"
            label="Category"
            hint="Groups the script in folder view; press Enter or Tab to add a new category"
            outlined
            filterable
            clearable
            new-value-mode="add-unique"
          />
          <q-file
            v-model="file"
            label="Script file"
            outlined
            dense
            counter
            hint="Plain-text file; its content becomes the script body"
            :rules="[(val) => !!val || '*Required']"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>

          <div class="rmm-label q-pt-sm">How it runs</div>
          <rmm-select
            v-model="form.shell"
            :options="shellOptions"
            label="Shell"
            hint="Interpreter the agent runs the script with"
            outlined
            mapOptions
          />
          <rmm-select
            v-model="form.supported_platforms"
            :options="agentPlatformOptions"
            label="Supported platforms"
            hint="Leave empty to offer the script on every platform"
            clearable
            mapOptions
            multiple
          />
          <rmm-select
            v-for="f in listFields"
            :key="f.model"
            v-model="form[f.model]"
            v-bind="f.attrs"
            use-input
            multiple
            hide-dropdown-icon
            input-debounce="0"
            new-value-mode="add"
          />
          <q-input
            v-model.number="form.default_timeout"
            label="Default timeout (seconds)"
            type="number"
            outlined
            dense
            :rules="[(val) => val >= 5 || 'Minimum is 5']"
            hint="How long the agent waits before stopping the script; minimum 5"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Cancel" />
          <q-btn
            v-bind="{ type: 'submit', color: 'primary', unelevated: true }"
            label="Add script"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";
import { notifyError, notifySuccess } from "@/utils/notify";
import { saveScript as uploadScript } from "@/api/scripts";
import { shellOptions } from "@/composables/scripts";
import { agentPlatformOptions } from "@/composables/agents";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";

defineOptions({ name: "ScriptModal" });
defineEmits([...useDialogPluginComponent.emits]);
defineProps({ categories: Array });

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const listFields = [
  {
    model: "args",
    attrs: {
      label: "Default arguments",
      placeholder: "Type an argument and press Enter",
      hint: "One entry per argument; placeholders like {{agent.hostname}} or {{global.KeyName}} are filled in at run time",
    },
  },
  {
    model: "env_vars",
    attrs: {
      label: "Environment variables",
      placeholder: "Type KEY=value and press Enter",
      hint: "One KEY=value pair per entry; the value may use the same placeholders",
    },
  },
];

const form = ref({});
const file = ref(null);
const saving = ref(false);

watch(file, async (f) => {
  form.value.script_body = "";
  if (!f) return;
  try {
    const text = await f.text();
    // a file picked while this one was read wins
    if (file.value === f) form.value.script_body = text;
  } catch {
    if (file.value === f) notifyError("The file could not be read.");
  }
});

async function submit() {
  if (!form.value.script_body) {
    notifyError("The script file is empty or could not be read.");
    return;
  }
  saving.value = true;
  try {
    const res = await uploadScript(form.value);
    onDialogOK();
    notifySuccess(res);
  } catch (e) {
    console.error(e);
  }
  saving.value = false;
}
</script>
