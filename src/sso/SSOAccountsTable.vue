<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 60vw; max-width: 90vw; min-height: 40vh">
      <DialogHeader
        :title="`Connected Social Accounts for ${user.username}`"
        subtitle="Provider accounts this user signs in with"
      />
      <q-table
        dense
        flat
        table-class="table-bgcolor"
        :style="{ 'max-height': `${$q.screen.height - 24}px` }"
        class="tbl-sticky rmm-table"
        :rows="user.social_accounts"
        :columns="columns"
        :loading="loading"
        v-model:pagination="pagination"
        :row-key="(row) => `${row.provider}:${row.uid}`"
        binary-state-sort
        virtual-scroll
        :rows-per-page-options="[0]"
      >
        <template #header-cell-actions="props">
          <q-th :props="props">
            <span class="sr-only">Actions</span>
          </q-th>
        </template>

        <template #loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="text-right">
            <q-btn
              outline
              dense
              no-caps
              size="sm"
              color="negative"
              label="Disconnect"
              @click="disconnect(props.row)"
            >
              <q-tooltip>Unlinks this provider account from the user</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useStore } from "vuex";
import { useDialogPluginComponent, useQuasar, type QTableColumn } from "quasar";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { useAuthStore } from "@/stores/auth";
import { disconnectSocialAccount } from "@/sso/api";
import { notifySuccess } from "@/utils/notify";

import type { SocialAccount, SSOUser } from "@/sso/types";

const props = defineProps<{ user: SSOUser }>();
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const pagination = ref({
  rowsPerPage: 0,
  sortBy: "display",
  descending: false,
});
const store = useStore();
const $q = useQuasar();
const auth = useAuthStore();
const loading = ref(false);

function sortedColumn(
  name: string,
  label: string,
  extra: Partial<QTableColumn> = {},
): QTableColumn {
  return { name, label, field: name, align: "left", sortable: true, ...extra };
}

const asDate = { format: (val: string) => store.getters.formatDate(val) };

const columns = [
  sortedColumn("display", "Display Name"),
  sortedColumn("provider", "Provider"),
  sortedColumn("last_login", "Last Login", asDate),
  sortedColumn("date_joined", "Date Joined", asDate),
  sortedColumn("actions", "", { field: "uid" }),
];

function disconnect(account: SocialAccount) {
  $q.dialog({
    title: `Disconnect social account: ${account.display}?`,
    cancel: true,
    ok: { label: "Disconnect", color: "negative" },
  }).onOk(async () => {
    loading.value = true;
    // this session signed in through exactly this link
    const ownSession =
      props.user.username === auth.username &&
      account.provider === auth.ssoLoginProvider;
    try {
      await disconnectSocialAccount(account.provider, account.uid);
      notifySuccess("Social account disconnected successfully");
      if (ownSession) {
        loading.value = false;
        onDialogCancel();
        // logout only; the page stays where it is
        await auth.logout();
        return;
      }
    } catch (e) {
      console.error(e);
    }
    loading.value = false;
    // the parent reloads the users either way
    onDialogOK();
  });
}
</script>
