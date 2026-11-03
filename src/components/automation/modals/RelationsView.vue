<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup>
import { ref, computed, onMounted } from "vue";
import { useDialogPluginComponent, Loading } from "quasar";
import axios from "axios";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { deviceName } from "@/utils/deviceName";

const props = defineProps({
  policy: { type: Object, required: true },
});
defineEmits(useDialogPluginComponent.emits);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const tabOpts = {
  dense: true,
  noCaps: true,
  align: "left",
  inlineLabel: true,
  narrowIndicator: true,
  activeColor: "primary",
  indicatorColor: "primary",
};

const tab = ref("clients");
const related = ref({});

const thumbStyle = {
  right: "2px",
  borderRadius: "5px",
  backgroundColor: "var(--rmm-accent)",
  width: "5px",
  opacity: 0.75,
};

// one row per assignment, servers first
function assignments(serverKey, workstationKey, withClient) {
  const make = (list, suffix, side) =>
    (related.value[list] || []).map((item) => ({
      key: item.id + suffix,
      title: item.name,
      sub: withClient ? item.client_name : "",
      side,
    }));
  return [
    ...make(serverKey, "servers", "Applied to Servers"),
    ...make(workstationKey, "workstations", "Applied to Workstations"),
  ];
}

const tabs = computed(() => [
  {
    name: "clients",
    title: "Clients",
    rows: assignments("server_clients", "workstation_clients", false),
    empty: {
      icon: "business",
      title: "Not assigned to any client",
      text: "Use Assign Automation Policy on a client to apply it to all of its agents.",
    },
  },
  {
    name: "sites",
    title: "Sites",
    rows: assignments("server_sites", "workstation_sites", true),
    empty: {
      icon: "apartment",
      title: "Not assigned to any site",
      text: "Use Assign Automation Policy on a site to apply it to the agents there.",
    },
  },
  {
    name: "agents",
    title: "Agents",
    rows: (related.value.agents || []).map((a) => ({
      key: a.id,
      title: deviceName(a),
      bold: true,
      rich: [a.client, a.site],
    })),
    empty: {
      icon: "computer",
      title: "Not assigned to any agent directly",
      text: "Agents that get it through a client, site or default policy are not listed here.",
    },
  },
]);

const defaultBanners = computed(() => {
  const out = [];
  if (related.value.default_server_policy)
    out.push(
      "This policy is set as the Default Server Policy, so every server gets it unless inheritance is blocked.",
    );
  if (related.value.default_workstation_policy)
    out.push(
      "This policy is set as the Default Workstation Policy, so every workstation gets it unless inheritance is blocked.",
    );
  return out;
});

onMounted(async () => {
  Loading.show();
  try {
    const { data } = await axios.get(
      `/automation/policies/${props.policy.id}/related/`,
    );
    related.value = data;
  } catch {
    // reported by the axios boot
  }
  Loading.hide();
});
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: 60vw">
      <DialogHeader
        :title="`${policy.name} Relations`"
        subtitle="Where this policy is assigned directly; agents below those levels inherit it"
      />
      <q-card-section v-if="defaultBanners.length" class="q-gutter-y-sm">
        <q-banner v-for="b in defaultBanners" :key="b" dense class="bg-info">
          <template v-slot:avatar>
            <q-icon name="info" class="text-info" />
          </template>
          {{ b }}
        </q-banner>
      </q-card-section>
      <q-card-section>
        <q-tabs v-model="tab" v-bind="tabOpts">
          <q-tab
            v-for="t in tabs"
            :key="t.name"
            :name="t.name"
            :label="`${t.title} (${t.rows.length})`"
          />
        </q-tabs>

        <q-separator />
        <q-scroll-area :thumb-style="thumbStyle" style="height: 50vh">
          <q-tab-panels v-model="tab" :animated="false">
            <q-tab-panel v-for="t in tabs" :key="t.name" :name="t.name">
              <q-list v-if="t.rows.length" separator padding>
                <q-item v-for="row in t.rows" :key="row.key">
                  <q-item-section>
                    <q-item-label
                      :class="row.bold ? 'text-weight-medium' : ''"
                      >{{ row.title }}</q-item-label
                    >
                    <q-item-label v-if="row.sub" caption>{{
                      row.sub
                    }}</q-item-label>
                    <q-item-label v-else-if="row.rich" caption>
                      <b>{{ row.rich[0] }}</b>
                      {{ row.rich[1] }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section v-if="row.side" side>
                    <q-item-label caption>{{ row.side }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <EmptyState
                v-else
                :icon="t.empty.icon"
                :title="t.empty.title"
                :text="t.empty.text"
              />
            </q-tab-panel>
          </q-tab-panels>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
