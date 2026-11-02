<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        :title="role ? 'Edit Role' : 'New Role'"
        subtitle="Tick what users with this role may do; Scope limits which clients and sites they see"
      />
      <q-form @submit="submitRole">
        <q-card-section class="row">
          <q-input
            v-model="draft.name"
            label="Role Name"
            :rules="[hasName]"
            class="col-6"
            dense
            outlined
          />
        </q-card-section>
        <q-card-section class="scroll" style="height: 50vh">
          <div class="rf-section">
            <div class="rf-section__title">Super User</div>
            <div class="rf-section__text">
              Full access to everything; overrides every setting below.
            </div>
          </div>
          <q-card-section class="row">
            <div class="rf-item">
              <q-checkbox v-model="draft.is_superuser" label="Super User" />
              <div class="rf-hint">
                Superuser roles have every permission; the settings below are
                ignored.
              </div>
            </div>
          </q-card-section>

          <template v-for="section in sections" :key="section.title">
            <div class="rf-section">
              <div class="rf-section__title">{{ section.title }}</div>
              <div class="rf-section__text">{{ section.text }}</div>
            </div>
            <q-card-section v-if="section.pickers" class="row q-col-gutter-md">
              <rmm-select
                v-for="pick in section.pickers"
                :key="pick.field"
                v-model="draft[pick.field]"
                :label="pick.label"
                :hint="pick.hint"
                :options="pickerOptions[pick.field]"
                :disable="draft.is_superuser"
                class="col-6"
                filterable
                mapOptions
                multiple
                outlined
              />
            </q-card-section>
            <q-card-section v-else class="rf-grid">
              <div
                v-for="flag in section.flags"
                :key="flag.key"
                class="rf-item"
              >
                <q-checkbox
                  v-model="draft[flag.key]"
                  :label="flag.label"
                  :disable="draft.is_superuser"
                />
                <div class="rf-hint">{{ flag.hint }}</div>
                <div v-if="readMissing(flag)" class="rf-warning">
                  Needs {{ LABELS[flag.needs] }} too, or every read fails.
                </div>
              </div>
            </q-card-section>
          </template>
        </q-card-section>
        <FormActions :loading="saving" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useStore } from "vuex";
import { editRole, saveRole } from "@/api/accounts";
import { ROLE_SECTIONS } from "@/components/accounts/rolePermissions";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import { askChangeCode } from "@/composables/accounts";
import { useClientDropdown, useSiteDropdown } from "@/composables/clients";
import FormActions from "@/core/ui/FormActions.vue";
import { notifySuccess } from "@/utils/notify";

const FLAGS = ROLE_SECTIONS.flatMap((section) => section.flags ?? []);
const PICKERS = ROLE_SECTIONS.flatMap((section) => section.pickers ?? []);
const LABELS = Object.fromEntries(FLAGS.map((flag) => [flag.key, flag.label]));

// a new role starts with every flag off and no scope limit
const emptyRole = () => ({
  name: "",
  is_superuser: false,
  ...Object.fromEntries(FLAGS.map((flag) => [flag.key, false])),
  ...Object.fromEntries(PICKERS.map((pick) => [pick.field, []])),
});

const props = defineProps({ role: Object });
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const draft = ref(props.role ? { ...props.role } : emptyRole());
const saving = ref(false);
const hasName = (val) => !!val || "*Required";

const { siteOptions } = useSiteDropdown(true);
const { clientOptions } = useClientDropdown(true);
const pickerOptions = computed(() => ({
  can_view_clients: clientOptions.value,
  can_view_sites: siteOptions.value,
}));

const $q = useQuasar();
const store = useStore();
const hosted = computed(() => store.state.hosted);

// flags that act on the server itself are not offered on hosted instances
const sections = computed(() =>
  ROLE_SECTIONS.map((section) => ({
    ...section,
    flags: section.flags?.filter((flag) => !hosted.value || !flag.serverOnly),
  })),
);

// a hint only, saving goes ahead either way
function readMissing(flag) {
  return !!flag.needs && !!draft.value[flag.key] && !draft.value[flag.needs];
}

async function submitRole() {
  const code = await askChangeCode($q, {
    title: props.role ? "Save role" : "Add role",
  });
  if (code === null) return;
  saving.value = true;
  try {
    notifySuccess(
      props.role
        ? await editRole(draft.value.id, draft.value, code)
        : await saveRole(draft.value, code),
    );
    onDialogOK();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.rf-section {
  margin: 16px 0 4px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--rmm-border);
}

.rf-section:first-child {
  margin-top: 0;
}

.rf-section__title {
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.rf-section__text {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

.rf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 6px 24px;
  align-items: start;
}

.rf-item {
  display: flex;
  flex-direction: column;
}

.rf-hint,
.rf-warning {
  margin-left: 34px;
  font-size: var(--rmm-fs-xs);
  line-height: 1.3;
}

.rf-hint {
  margin-top: -4px;
  color: var(--rmm-text-muted);
}

.rf-warning {
  margin-top: 2px;
  color: var(--rmm-status-warning);
}
</style>
