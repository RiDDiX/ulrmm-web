<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { endpoint } from "@/api/http";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { notifyError, notifySuccess } from "@/utils/notify";
import BackupPolicyDialog from "./BackupPolicyDialog.vue";
import {
  SCOPES,
  deleteMessage,
  fieldLabel,
  returnFocus,
  scopeText,
} from "./backups";

defineProps({ internal: Boolean });
const $q = useQuasar();
const api = endpoint("/imaging");
const policies = ref([]);
const targets = ref([]);
const loading = ref(true);
const loadError = ref("");
const editing = ref(null);
const busy = ref(null);

const grouped = computed(() =>
  Object.keys(SCOPES)
    .map((scope) => ({
      scope,
      rows: policies.value.filter((p) => p.scope === scope),
    }))
    .filter((group) => group.rows.length),
);
// the dialog unmounts on close; the focus goes back to its opener
let restore = null;
function edit(row) {
  restore = returnFocus();
  editing.value = row;
}
function closeEditor() {
  editing.value = null;
  restore?.();
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [rows, list] = await Promise.all([
      api.get("/policies/", { silent: true }),
      api.get("/targets/", { silent: true }).catch(() => []),
    ]);
    policies.value = rows;
    targets.value = list;
  } catch (e) {
    policies.value = [];
    loadError.value =
      e?.response?.status === 403
        ? "Your role cannot manage backup policies."
        : "The backup policies could not be loaded.";
  } finally {
    loading.value = false;
  }
}

function remove(p) {
  const { canDelete, message } = deleteMessage(p);
  $q.dialog({
    title: `Delete backup policy ${p.name}?`,
    message,
    cancel: { label: canDelete ? "Cancel" : "Close", flat: true },
    ok: canDelete
      ? { label: "Delete", color: "negative", noCaps: true }
      : false,
  }).onOk(async () => {
    busy.value = p.id;
    try {
      const done = await stepUpCall($q, (config) =>
        api.delete(`/policies/${p.id}/`, config),
      );
      if (done === null) return;
      notifySuccess("Backup policy deleted");
      await load();
    } catch (e) {
      notifyError(serverErrors(e).message);
    } finally {
      busy.value = null;
    }
  });
}

onMounted(load);
</script>

<template>
  <div>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading...
    </div>
    <div v-else-if="loadError" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ loadError }}</div>
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        label="Retry"
        @click="load"
      />
    </div>
    <template v-else>
      <div class="row items-center q-mb-sm">
        <q-space />
        <q-btn
          dense
          no-caps
          outline
          color="primary"
          icon="add"
          label="New policy"
          @click="edit({})"
        />
      </div>
      <p v-if="policies.every((p) => p.scope === 'global')" class="rmm-muted">
        No policy beyond the global default.
      </p>
      <q-list
        v-for="group in grouped"
        :key="group.scope"
        bordered
        separator
        class="q-mb-md"
      >
        <q-item-label header>{{ SCOPES[group.scope] }}</q-item-label>
        <q-item v-for="p in group.rows" :key="p.id">
          <q-item-section>
            <q-item-label>{{ p.name }}</q-item-label>
            <q-item-label caption
              >{{ scopeText(p) }} · reaches {{ p.reach }}
              {{ p.reach === 1 ? "device" : "devices" }}</q-item-label
            >
            <q-item-label caption>
              {{
                Object.keys(p.config).map(fieldLabel).join(", ") ||
                "Sets nothing yet"
              }}
            </q-item-label>
            <q-item-label v-if="p.enforced.length" caption>
              <q-icon name="lock" size="14px" aria-hidden="true" />
              Enforced: {{ p.enforced.map(fieldLabel).join(", ") }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row no-wrap">
              <q-btn
                dense
                flat
                round
                size="sm"
                icon="edit"
                :aria-label="`Edit backup policy ${p.name}`"
                @click="edit(p)"
              />
              <q-btn
                v-if="p.scope !== 'global'"
                dense
                flat
                round
                size="sm"
                icon="delete_outline"
                :aria-label="`Delete backup policy ${p.name}`"
                :loading="busy === p.id"
                @click="remove(p)"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </template>
    <BackupPolicyDialog
      v-if="editing"
      :policy="editing.id ? editing : null"
      :targets="targets"
      :internal="internal"
      @close="closeEditor"
      @saved="load"
    />
  </div>
</template>
