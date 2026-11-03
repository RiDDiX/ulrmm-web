<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="pkg-install-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--md">
      <DialogHeader
        title-id="pkg-install-title"
        :title="`Install ${driverOnly ? 'a driver' : 'a package'} on ${deviceName(agent)}`"
        subtitle="Runs the package installer on this agent and shows its progress"
      />
      <q-form @submit="submit">
        <q-card-section class="q-gutter-y-sm">
          <rmm-select
            v-model="packageId"
            :options="options"
            label="Package"
            map-options
            filterable
            :hint="
              options.length
                ? undefined
                : driverOnly
                  ? 'No driver package yet. Upload one here or under Settings > Software catalog.'
                  : 'No package for this platform yet. Add one under Settings > Software catalog.'
            "
            :rules="[(v) => !!v || 'Required']"
          />
          <q-btn
            v-if="allowUpload"
            icon="upload_file"
            :label="`Upload new ${driverOnly ? 'driver package' : 'package'}…`"
            color="primary"
            flat
            dense
            no-caps
            :disable="loading"
            @click="upload"
          />
          <template v-if="pkg">
            <q-banner
              v-if="pkg.file_missing"
              dense
              rounded
              class="rmm-banner-warning"
              role="alert"
            >
              The file of this package is not on the server, e.g. after a
              restore without large packages. The install fails until it is
              uploaded again.
            </q-banner>
            <div class="text-caption rmm-muted">
              <span class="rmm-mono">{{ pkg.filename }}</span> ·
              {{ bytes2Human(pkg.size) }} · timeout {{ pkg.timeout }} s
            </div>
            <q-input
              v-if="pkg.kind === 'archive'"
              :model-value="
                [pkg.command, pkg.default_args].filter(Boolean).join(' ')
              "
              label="Command"
              hint="Set on the package; edit the package to change it"
              input-class="rmm-mono"
              hide-bottom-space
              readonly
              dense
              outlined
            />
            <q-input
              v-else-if="pkg.default_args"
              :model-value="pkg.default_args"
              label="Installer arguments"
              hint="Set on the package; edit the package to change them"
              hide-bottom-space
              readonly
              dense
              outlined
            />
            <div v-if="pkg.kind === 'archive'" class="text-caption rmm-muted">
              The agent checks the archive against its SHA-256 before it unpacks
              it.
            </div>
            <q-banner
              v-else-if="pkg.allow_unsigned"
              dense
              rounded
              class="rmm-banner-warning"
              role="status"
            >
              This package also installs an unsigned installer. Tampered or
              untrusted signatures are still refused.
            </q-banner>
            <div v-else class="text-caption rmm-muted">
              {{
                pkg.kind === "driver"
                  ? "Only validly signed driver catalogs are accepted."
                  : "Only a validly signed installer is accepted."
              }}
            </div>
          </template>
          <div>
            <div class="rmm-label">Run as</div>
            <div v-if="driver">
              System. Driver packages always install as system.
            </div>
            <div v-else-if="archive">
              System / Administrator. Archive commands always run as SYSTEM or
              root.
            </div>
            <template v-else-if="agent.plat === 'windows'">
              <q-option-group
                v-model="runAs"
                :options="runAsOptions"
                aria-label="Run as"
                color="primary"
                dense
                inline
              />
              <div class="text-caption rmm-muted q-mt-xs">
                {{ user ? `Logged in: ${user}.` : "Nobody is logged in." }}
                <template v-if="runAs === 'user'">
                  The installer runs in that user's session, with admin rights
                  only if the user is an administrator.
                </template>
              </div>
            </template>
            <div v-else>
              System / Administrator. macOS and Linux packages always install as
              root.
            </div>
          </div>
        </q-card-section>
        <DialogActions
          submit-label="Install"
          :loading="loading"
          @cancel="onDialogCancel"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import DialogActions from "@/components/ui/DialogActions.vue";
import { computed, ref } from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { deviceName } from "@/utils/deviceName";
import DialogWrapper from "@/components/ui/DialogWrapper.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import PackageInstalls from "@/components/packages/PackageInstalls.vue";
import PackageForm from "@/components/packages/PackageForm.vue";
import { installPackage } from "@/api/packages";
import { bytes2Human } from "@/utils/format";
import { RUN_AS_OPTIONS, loggedInUser } from "@/utils/packages";

const props = defineProps({
  agent: { type: Object, required: true },
  // full list; filtered here to the agent's plat
  packages: { type: Array, default: () => [] },
  // "driver": only driver packages are offered
  kind: { type: String, default: "" },
  allowUpload: { type: Boolean, default: false },
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const $q = useQuasar();

const user = loggedInUser(props.agent);
const runAsOptions = RUN_AS_OPTIONS.map((o) => ({
  ...o,
  disable: o.value === "user" && !user,
}));

const driverOnly = computed(() => props.kind === "driver");
const list = ref([...props.packages]);
const options = computed(() =>
  list.value
    .filter(
      (p) =>
        p.plat === props.agent.plat && (!props.kind || p.kind === props.kind),
    )
    .map((p) => ({ value: p.id, label: p.name })),
);
const packageId = ref(
  options.value.length === 1 ? options.value[0].value : null,
);
const pkg = computed(() => list.value.find((p) => p.id === packageId.value));
const runAs = ref("system");
const driver = computed(() => pkg.value?.kind === "driver");
const archive = computed(() => pkg.value?.kind === "archive");
const loading = ref(false);

async function submit() {
  loading.value = true;
  try {
    const { batch } = await installPackage(packageId.value, {
      agent_id: props.agent.agent_id,
      run_as: driver.value || archive.value ? "system" : runAs.value,
    });
    const installs = $q.dialog({
      component: DialogWrapper,
      componentProps: {
        vuecomponent: PackageInstalls,
        title: `${pkg.value.name} on ${deviceName(props.agent)}`,
        size: "lg",
        height: "40",
        componentProps: { batch },
      },
    });
    // callers can follow the progress dialog, e.g. to reload when it closes
    onDialogOK(installs);
  } catch {
    // toast from axios layer
  }
  loading.value = false;
}

function upload() {
  $q.dialog({
    component: PackageForm,
    componentProps: { accept: driverOnly.value ? ".zip,.cab" : "" },
  }).onOk((created) => {
    if (!created?.id) return;
    list.value = [...list.value.filter((p) => p.id !== created.id), created];
    packageId.value = created.id;
  });
}
</script>
