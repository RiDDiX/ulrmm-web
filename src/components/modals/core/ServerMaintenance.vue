<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card class="rmm-dialog--sm">
    <DialogHeader
      title="Server Maintenance"
      subtitle="Housekeeping tasks for the RMM server"
    />
    <q-card-section class="q-pa-none">
      <q-form @submit.prevent="submit">
        <q-card-section>
          <q-select
            v-model="action"
            label="Action"
            :hint="action ? undefined : 'Pick a task to see what it does'"
            :options="TASKS"
            :rules="[(val) => !!val || '*Required']"
            outlined
            dense
            options-dense
            emit-value
            map-options
            @update:model-value="forgetTables"
          >
            <template v-slot:option="{ itemProps, opt }">
              <q-item v-bind="itemProps">
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                  <q-item-label caption>{{ opt.caption }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div v-if="chosen" class="maint-help" role="status">
            {{ chosen.caption }}
          </div>
        </q-card-section>

        <q-card-section v-if="pruning" class="q-pt-none">
          <div class="rmm-label q-mb-xs">Tables to prune</div>
          <q-list dense bordered separator class="maint-tables">
            <q-item v-for="opt in TABLES" :key="opt.value" tag="label">
              <q-item-section side top>
                <q-checkbox v-model="tables" :val="opt.value" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ opt.label }}</q-item-label>
                <q-item-label caption>{{ opt.caption }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <FormActions
          :label="submitLabel"
          :color="pruning ? 'negative' : 'primary'"
          :disable="!canSubmit"
        />
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, ref } from "vue";
import axios from "axios";
import { useQuasar } from "quasar";
import { notifySuccess } from "@/utils/notify";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import FormActions from "@/core/ui/FormActions.vue";

const emit = defineEmits(["close"]);
const $q = useQuasar();

const TASKS = [
  {
    label: "Reload NATS configuration",
    value: "reload_nats",
    caption:
      "Rewrites the NATS config with the current agent credentials and reloads it; try this when agents cannot connect",
  },
  {
    label: "Remove orphaned tasks",
    value: "rm_orphaned_tasks",
    caption:
      "Deletes scheduled tasks the RMM created on online Windows agents but no longer knows about; runs in the background",
  },
  {
    label: "Prune database tables",
    value: "prune_db",
    caption:
      "Permanently deletes the rows of the tables you tick below; asks for confirmation first",
  },
];
const TABLES = [
  {
    value: "audit_logs",
    label: "Check-run audit entries",
    caption: "Deletes stored check-run audit entries",
  },
  {
    value: "pending_actions",
    label: "Pending actions",
    caption: "Deletes completed pending actions",
  },
  {
    value: "alerts",
    label: "Alerts",
    caption:
      "Deletes all alerts, including open and snoozed ones; still-failing conditions will alert again",
  },
];

const action = ref(null);
const tables = ref([]);

const pruning = computed(() => action.value === "prune_db");
const chosen = computed(() => TASKS.find((t) => t.value === action.value));
const canSubmit = computed(
  () => !!action.value && (!pruning.value || tables.value.length > 0),
);
const submitLabel = computed(() => {
  if (pruning.value) {
    const n = tables.value.length;
    return `Prune ${n} table${n === 1 ? "" : "s"}`;
  }
  return chosen.value ? chosen.value.label : "Run";
});
const tableNames = computed(() =>
  TABLES.filter((t) => tables.value.includes(t.value))
    .map((t) => t.label)
    .join(", "),
);

const forgetTables = () => {
  tables.value = [];
};

function submit() {
  if (!pruning.value) return run();
  // alerts are the one table whose loss is felt right away
  if (tables.value.includes("alerts")) {
    $q.dialog({
      component: ConfirmYesDialog,
      componentProps: {
        hostname: tableNames.value,
        actionVerb: "pruning",
        title: "Prune database tables?",
        okLabel: "Prune",
        consequence:
          "Deleted rows cannot be restored. Open and snoozed alerts are removed; still-failing conditions will alert again.",
      },
    }).onOk(run);
  } else {
    $q.dialog({
      title: "Prune database tables?",
      message: `Deletes ${tableNames.value}. This cannot be undone.`,
      cancel: true,
      persistent: true,
      ok: { label: "Prune", color: "negative" },
    }).onOk(run);
  }
}

async function run() {
  $q.loading.show();
  try {
    const { data } = await axios.post("core/servermaintenance/", {
      action: action.value,
      prune_tables: tables.value,
    });
    $q.loading.hide();
    notifySuccess(data);
    emit("close");
  } catch {
    $q.loading.hide();
  }
}
</script>

<style scoped>
.maint-help {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-2);
  font-size: var(--rmm-fs-sm);
  line-height: 1.4;
}

.maint-tables {
  border-radius: var(--rmm-radius-sm);
}
</style>
