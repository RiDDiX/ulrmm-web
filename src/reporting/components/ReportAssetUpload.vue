<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title="Upload Files"
        subtitle="Files go into the selected folder; a name that exists gets a new one"
      />
      <q-form @submit="submit">
        <q-card-section>
          <q-file
            label="Select files"
            v-model="files"
            multiple
            outlined
            dense
            use-chips
            :clearable="!uploading"
            :accept="ASSET_TYPES"
            @rejected="onRejected"
            :rules="[(value) => (value && value.length > 0) || '*Required']"
          >
            <template #prepend>
              <q-icon name="attach_file" />
            </template>
            <template #file="{ file }">
              <q-chip square class="full-width q-my-xs">
                <q-avatar>
                  <q-icon name="insert_drive_file" />
                </q-avatar>
                <div class="ellipsis relative-position">{{ file.name }}</div>
                <q-tooltip>{{ file.name }}</q-tooltip>
              </q-chip>
            </template>
          </q-file>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" @click="onDialogCancel" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Upload"
            type="submit"
            :loading="uploading"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { notifyError, notifySuccess } from "@/utils/notify";
import { uploadReportAssets } from "@/reporting/api";

const props = defineProps<{ parentPath: string }>();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// the server enforces the same list and a size limit
const ASSET_TYPES =
  ".png,.jpg,.jpeg,.gif,.webp,.svg,.ico,.woff,.woff2,.ttf,.otf,.css,.pdf,.csv,.txt";

const files = ref<File[] | null>(null);

function onRejected(rejected: { file: File }[]) {
  notifyError(
    `Not an allowed asset type: ${rejected.map(({ file }) => file.name).join(", ")}`,
  );
}

const uploading = ref(false);

async function submit() {
  if (!files.value?.length) return;
  uploading.value = true;
  try {
    const response = await uploadReportAssets(files.value, props.parentPath);
    notifySuccess("Files uploaded successfully");
    onDialogOK({ files: files.value, response });
  } catch (e) {
    console.error(e);
  }
  uploading.value = false;
}
</script>
