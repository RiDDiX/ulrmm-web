<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin" style="width: 60vw">
      <DialogHeader
        :title="editing ? 'Edit Policy' : 'Add Policy'"
        subtitle="A policy bundles checks and tasks that every agent it applies to runs"
      />
      <q-form @submit="save">
        <q-card-section v-if="copyPolicy" class="q-pb-none">
          <q-banner dense class="bg-info">
            <template v-slot:avatar>
              <q-icon name="content_copy" class="text-info" />
            </template>
            You are copying checks and tasks from Policy:
            <b>{{ copyPolicy.name }}</b> into a new policy.
          </q-banner>
        </q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-input
            v-model="form.name"
            outlined
            dense
            label="Name"
            :rules="[(val) => !!val || '*Required']"
          />
          <q-input v-model="form.desc" outlined dense label="Description" />
        </q-card-section>
        <q-card-section class="q-pt-none q-gutter-y-sm">
          <div v-for="flag in flags" :key="flag.key">
            <q-toggle v-model="form[flag.key]" :label="flag.label" />
            <div class="text-caption rmm-muted policy-form__caption">
              {{ flag.help }}
            </div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            :label="editing ? 'Save' : 'Create'"
            color="primary"
            type="submit"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive, computed, onMounted } from "vue";
import { useDialogPluginComponent, Loading } from "quasar";
import axios from "axios";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { notifySuccess } from "@/utils/notify";

const props = defineProps({
  policy: Object,
  copyPolicy: Object,
});
defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const flags = [
  {
    key: "active",
    label: "Active",
    help: "Only active policies are applied; an inactive one stays assigned but does nothing.",
  },
  {
    key: "enforced",
    label: "Enforced",
    help: "The policy's checks win over an agent's own checks of the same kind, e.g. the same disk or ping target.",
  },
];

const editing = computed(() => !!props.policy);

const form = reactive({ name: "", desc: "", enforced: false, active: false });
onMounted(() => {
  if (!props.policy) return;
  for (const k of ["id", "name", "desc", "enforced", "active"])
    form[k] = props.policy[k];
});

async function save() {
  Loading.show();
  const body = { ...form };
  try {
    if (editing.value) {
      await axios.put(`/automation/policies/${body.id}/`, body);
    } else {
      if (props.copyPolicy) body.copyId = props.copyPolicy.id;
      await axios.post("/automation/policies/", body);
    }
    Loading.hide();
    onDialogOK();
    notifySuccess(
      editing.value
        ? "Policy edited!"
        : "Policy added. Now you can add Tasks and Checks!",
    );
  } catch {
    Loading.hide();
  }
}
</script>

<style scoped>
.policy-form__caption {
  padding-left: 48px;
}
</style>
