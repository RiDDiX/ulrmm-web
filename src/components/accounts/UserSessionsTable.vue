<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 60vw; max-width: 90vw; min-height: 40vh">
      <DialogHeader
        :title="`User Sessions for ${user.username}`"
        subtitle="Each row is a signed-in dashboard session; signing one out ends it immediately"
      />
      <q-table v-bind="tableProps">
        <template #top>
          <div class="rmm-toolbar full-width">
            <span class="rmm-muted rmm-num" role="status"
              >{{ sessions.length }} active
              {{ sessions.length === 1 ? "session" : "sessions" }}</span
            >
            <q-space />
            <q-btn
              outline
              no-caps
              dense
              icon="logout"
              label="Sign out all sessions"
              color="negative"
              @click="signOutAll"
            >
              <q-tooltip
                >Ends every session of this user; they must sign in
                again</q-tooltip
              >
            </q-btn>
          </div>
        </template>

        <template #header-cell-action="head">
          <q-th :props="head">
            <span class="sr-only">Actions</span>
          </q-th>
        </template>

        <template #loading>
          <q-inner-loading :showing="true" color="primary" />
        </template>

        <template #no-data>
          <NoDataPanel
            :loading="loading"
            :error="error"
            icon="devices"
            title="No active sessions"
            text="This user is not signed in to the dashboard anywhere right now."
            @retry="load"
          />
        </template>

        <template #body="line">
          <q-tr>
            <td>{{ formatDate(line.row.created) }}</td>
            <td>{{ formatDate(line.row.expiry) }}</td>
            <td class="text-right">
              <q-btn
                outline
                dense
                no-caps
                size="sm"
                label="Sign out"
                color="negative"
                @click="signOut(line.row)"
              >
                <q-tooltip>Ends this session immediately</q-tooltip>
              </q-btn>
            </td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar, type QTableColumn } from "quasar";
import { notifyError, notifySuccess } from "@/utils/notify";
import { formatDate } from "@/utils/format";
import * as sessionsApi from "@/api/accounts";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";

import type { AuthToken, User } from "@/types/accounts";

const props = defineProps<{ user: User }>();
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tableAttrs = {
  dense: true,
  flat: true,
  "row-key": "id",
  "binary-state-sort": true,
  "virtual-scroll": true,
  "rows-per-page-options": [0],
  "table-class": "table-bgcolor",
  class: "tbl-sticky rmm-table",
};

const tableProps = computed(() => ({
  ...tableAttrs,
  rows: sessions.value,
  columns,
  loading: loading.value,
  pagination: { rowsPerPage: 0, sortBy: "created", descending: true },
  style: { "max-height": `${$q.screen.height - 24}px` },
}));

const sessionColumn = (
  name: string,
  label: string,
  field = name,
): QTableColumn => ({ name, label, field, align: "left", sortable: true });
const columns: QTableColumn[] = [
  sessionColumn("created", "Created"),
  sessionColumn("expiry", "Expires"),
  { ...sessionColumn("action", ""), sortable: false },
];

const sessions = ref<AuthToken[]>([]);
const loading = ref(false);
const error = ref("");

type HttpError = { response?: { status?: number; data?: unknown } };

// a 403 with a plain-text body is the server explaining itself, e.g. that
// only superusers can manage superuser sessions; show that text as sent
function explainForbidden(e: unknown) {
  const { status, data } = (e as HttpError)?.response ?? {};
  if (status === 403 && typeof data === "string") notifyError(data);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    sessions.value = await sessionsApi.fetchUserSessions(props.user.id);
  } catch (e) {
    console.error(e);
    error.value =
      (e as HttpError)?.response?.status === 403
        ? "Your role cannot view sessions."
        : "Sessions could not be loaded.";
  }
  loading.value = false;
}

function askSignOut(title: string, message?: string) {
  return $q.dialog({
    title,
    message,
    cancel: true,
    ok: { color: "negative", label: "Sign out" },
  });
}

async function change(
  request: () => Promise<unknown>,
  done: string,
  after: () => unknown,
) {
  loading.value = true;
  try {
    await request();
    notifySuccess(done);
  } catch (e) {
    console.error(e);
    explainForbidden(e);
  } finally {
    loading.value = false;
    await after();
  }
}

function signOut(token: AuthToken) {
  askSignOut(
    `Sign out session for ${token.user}?`,
    "This user will be signed out immediately.",
  ).onOk(() =>
    change(
      () => sessionsApi.deleteUserSession(token.digest),
      "Login session deleted successfully",
      load,
    ),
  );
}

function signOutAll() {
  askSignOut(`Sign out all sessions for ${props.user.username}?`).onOk(() =>
    change(
      () => sessionsApi.deleteAllUserSessions(props.user.id),
      "Login sessions deleted successfully",
      onDialogHide,
    ),
  );
}

onMounted(load);
</script>
