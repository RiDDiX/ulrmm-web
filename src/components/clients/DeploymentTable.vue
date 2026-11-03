<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="deployments-title"
    @hide="onDialogHide"
  >
    <q-card style="width: min(96vw, 1400px); max-width: none; height: 70vh">
      <DialogHeader
        title-id="deployments-title"
        title="Deployments"
        subtitle="Install links per client and site; each carries a signed enrollment token until it expires, deleting the row revokes it"
      >
        <template #actions>
          <q-btn
            dense
            flat
            no-caps
            icon="add"
            label="New deployment"
            class="q-mr-xs"
            @click="openBuilder()"
          >
            <q-tooltip>Build an installer or an OS image answer file</q-tooltip>
          </q-btn>
          <q-btn
            dense
            flat
            icon="refresh"
            aria-label="Refresh deployments"
            @click="load"
          >
            <q-tooltip>Reload the deployment list</q-tooltip>
          </q-btn>
        </template>
      </DialogHeader>
      <q-table
        v-sortable-headers
        v-bind="tableAttrs"
        :rows="deployments"
        :columns="columns"
        :loading="loading"
        :pagination="{ rowsPerPage: 0, sortBy: 'id', descending: true }"
      >
        <template v-slot:header-cell="head">
          <q-th :props="head">
            {{ head.col.label }}
            <q-tooltip v-if="HEADER_TIPS[head.col.name]">
              {{ HEADER_TIPS[head.col.name] }}
            </q-tooltip>
          </q-th>
        </template>

        <template v-slot:loading>
          <q-inner-loading :showing="true" color="primary" />
        </template>

        <template v-slot:no-data>
          <NoDataPanel
            :loading="loading"
            :error="error"
            icon="link_off"
            title="No deployments"
            text="A deployment gives you install links and OS image answer files for one client and site."
            @retry="load"
          >
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="add"
              label="New deployment"
              @click="openBuilder()"
            />
          </NoDataPanel>
        </template>

        <template v-slot:body="line">
          <q-tr :props="line">
            <q-menu context-menu>
              <RowMenuList with-close :width="220" :items="menuFor(line.row)" />
            </q-menu>
            <q-td key="name" :props="line" class="deploy-table__name">
              {{ line.row.name || "—" }}
              <span
                v-if="line.row.legacy_token"
                class="rmm-pill rmm-pill--neutral q-ml-xs"
                >Legacy token
                <q-tooltip>{{ LEGACY_TIP }}</q-tooltip>
              </span>
            </q-td>
            <q-td key="client" :props="line">{{ line.row.client_name }}</q-td>
            <q-td key="site" :props="line">{{ line.row.site_name }}</q-td>
            <q-td key="mon_type" :props="line">{{ line.row.mon_type }}</q-td>
            <q-td key="policy" :props="line">{{
              line.row.policy_name || "None"
            }}</q-td>
            <q-td key="goarch" :props="line" class="rmm-mono">{{
              line.row.goarch
            }}</q-td>
            <q-td key="expiry" :props="line">
              {{ formatDate(line.row.expiry) }}
              <span
                v-if="isExpired(line.row)"
                class="rmm-pill rmm-pill--neutral q-ml-xs"
                >Expired</span
              >
            </q-td>
            <q-td key="enrollments" :props="line">
              {{ enrollmentsText(line.row) || "—" }}
              <span
                v-if="enrollmentLimitReached(line.row)"
                class="rmm-pill rmm-pill--warning q-ml-xs"
                >Limit reached</span
              >
            </q-td>
            <q-td key="created" :props="line">{{
              formatDate(line.row.created)
            }}</q-td>
            <q-td key="flags" :props="line">{{
              enabledFlags(line.row.install_flags)
            }}</q-td>
            <q-td key="actions" :props="line" @click.stop>
              <RowActions
                :label="`Actions for deployment ${deploymentLabel(line.row)}`"
              >
                <RowMenuList :width="220" :items="menuFor(line.row)" />
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useQuasar, useDialogPluginComponent } from "quasar";
import { useStore } from "vuex";
import { copyOutput } from "@/utils/helpers";
import { notifySuccess } from "@/utils/notify";
import { removeDeployment, fetchDeployments } from "@/api/clients";
import {
  deploymentLabel,
  enrollmentLimitReached,
  enrollmentsText,
  isExpired,
} from "@/utils/deploy";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";
import { confirmDelete } from "@/core/confirm";
import { actionsColumn, textColumn } from "@/core/ui/listTable";
import RowActions from "@/components/ui/RowActions.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import NoDataPanel from "@/core/ui/NoDataPanel.vue";
import RowMenuList from "@/core/ui/RowMenuList.vue";
import DeployBuilder from "@/components/deploy/DeployBuilder.vue";

defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const store = useStore();
const { dialogRef, onDialogHide } = useDialogPluginComponent();
const formatDate = (val) => store.getters.formatDate(val);

const tableAttrs = {
  dense: true,
  flat: true,
  "row-key": "id",
  "binary-state-sort": true,
  "virtual-scroll": true,
  "rows-per-page-options": [0],
  "table-class": "table-bgcolor",
  class: "audit-mgr-tbl-sticky rmm-table",
  style: "max-height: 65vh",
};

const columns = [
  textColumn("name", "Name"),
  textColumn("client", "Client", { field: "client_name" }),
  textColumn("site", "Site", { field: "site_name" }),
  textColumn("mon_type", "Type"),
  textColumn("policy", "Policy", { field: "policy_name" }),
  textColumn("goarch", "Arch"),
  textColumn("expiry", "Expiry"),
  textColumn("enrollments", "Enrollments"),
  textColumn("created", "Created"),
  textColumn("flags", "Flags", { field: "install_flags", sortable: false }),
  actionsColumn,
];

const HEADER_TIPS = {
  mon_type: "Agent type the installer registers: server or workstation",
  policy: "Automation policy every agent enrolled through this link gets",
  goarch: "Default CPU architecture; links pick the architecture per download",
  expiry: "The links and their enrollment token stop working after this time",
  enrollments:
    "Devices enrolled through this deployment / the limit set when it was made",
  flags:
    "Windows install options: power (disable sleep), ping (allow ICMP echo), rdp (enable RDP)",
};

const LEGACY_TIP =
  "Made before signed links. Its install token is not shown again (********); it works until the expiry, deleting the deployment revokes it.";

const deployments = ref([]);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    deployments.value = await fetchDeployments();
  } catch (e) {
    error.value =
      e?.response?.status === 403
        ? "Your role cannot view deployments."
        : "Deployments could not be loaded.";
  }
  loading.value = false;
}

function remove(deployment) {
  confirmDelete($q, "Delete deployment?").onOk(async () => {
    loading.value = true;
    try {
      notifySuccess(await removeDeployment(deployment.id));
      await load();
    } catch (e) {
      console.error(e);
    }
    loading.value = false;
  });
}

function enabledFlags(flags) {
  const on = Object.keys(flags || {}).filter((name) => flags[name]);
  return on.length ? on.join(", ") : "none";
}

function openBuilder(deployment) {
  $q.dialog({
    component: DeployBuilder,
    componentProps: deployment ? { deployment } : {},
  }).onDismiss(load);
}

const menuFor = (deployment) => [
  {
    label: "Open in builder",
    icon: "construction",
    caption: isExpired(deployment)
      ? "Expired: its links no longer work"
      : "Links, one-liners and OS image files",
    disable: isExpired(deployment),
    run: () => openBuilder(deployment),
  },
  {
    label: "Copy link",
    icon: "content_copy",
    caption: "Public installer link of this deployment",
    run: () => copyOutput(deployment.url),
  },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    gap: true,
    caption: "Revokes its links and enrollment tokens",
    run: () => remove(deployment),
  },
];

onMounted(load);
</script>

<style scoped>
/* long names wrap so every column fits without scrolling sideways */
.deploy-table__name {
  min-width: 160px;
  max-width: 320px;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
