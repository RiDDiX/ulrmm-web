<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    aria-labelledby="delete-client-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--sm">
      <DialogHeader
        title-id="delete-client-title"
        :title="`Delete ${type} ${object.name}`"
      />
      <q-form @submit="confirm">
        <q-card-section class="q-pb-none">
          <q-banner dense rounded class="bg-negative" role="note">
            <template v-slot:avatar>
              <q-icon name="warning" color="negative" />
            </template>
            This cannot be undone. The agents first move to another site, then
            the {{ type }}
            {{ type === "client" ? "and its sites are" : "is" }} deleted. You
            confirm with the name and a 2FA code.
          </q-banner>
        </q-card-section>
        <q-card-section
          v-if="optionsLoading"
          class="row items-center q-gutter-sm"
        >
          <q-spinner color="primary" size="20px" />
          <span>Loading sites…</span>
        </q-card-section>
        <q-card-section
          v-else-if="optionsError"
          class="row items-center q-gutter-sm"
        >
          <q-icon name="error_outline" color="negative" />
          <span>{{ optionsError }}</span>
          <q-btn
            outline
            dense
            color="primary"
            label="Retry"
            @click="loadSites"
          />
        </q-card-section>
        <q-card-section v-else-if="siteOptions.length === 0" class="rmm-muted">
          {{ noSitesMessage }}
        </q-card-section>
        <q-card-section v-else>
          <rmm-select
            v-model="destination"
            label="Site to move agents to"
            :options="siteOptions"
            :hint="hint"
            :rules="[
              (val) =>
                !!val || 'Select the site that the agents should be moved to',
            ]"
            outlined
            mapOptions
            filterable
          />
        </q-card-section>
        <FormActions
          dense
          icon="delete"
          color="negative"
          label="Delete and move agents"
          :loading="busy"
          :disable="noDestinations"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { fetchClients, removeClient, removeSite } from "@/api/clients";
import { formatSiteOptions } from "@/utils/format";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import ConfirmYesDialog from "@/components/agents/ConfirmYesDialog.vue";
import FormActions from "@/core/ui/FormActions.vue";

const props = defineProps({ object: Object, type: String });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const destination = ref(null);
const siteOptions = ref([]);
const optionsLoading = ref(false);
const optionsError = ref("");
const busy = ref(false);

const hint = computed(
  () =>
    `This ${props.type} still has ${props.object.agent_count} agents. Pick the site they move to.`,
);
const noSitesMessage = computed(() =>
  props.type === "client"
    ? "No other client has a site to move the agents to."
    : "No other site is available to move the agents to.",
);
const noDestinations = computed(
  () =>
    optionsLoading.value ||
    !!optionsError.value ||
    siteOptions.value.length === 0,
);
const destinationLabel = computed(
  () =>
    siteOptions.value.find((o) => o.value === destination.value)?.label ||
    "the selected site",
);

// the site list the agents can move to, without what is being deleted
async function loadSites() {
  optionsLoading.value = true;
  optionsError.value = "";
  try {
    const clients = await fetchClients();
    if (props.type === "client") {
      siteOptions.value = Object.freeze(
        formatSiteOptions(clients.filter((c) => c.id !== props.object.id)),
      );
    } else {
      for (const client of clients) {
        client.sites = client.sites.filter((s) => s.id !== props.object.id);
      }
      siteOptions.value = Object.freeze(formatSiteOptions(clients));
    }
  } catch (e) {
    optionsError.value =
      e?.response?.status === 403
        ? "Your role cannot view sites."
        : "Sites could not be loaded.";
  }
  optionsLoading.value = false;
}

function confirm() {
  const { name, id, agent_count } = props.object;
  $q.dialog({
    component: ConfirmYesDialog,
    componentProps: {
      hostname: name,
      confirmText: name,
      requireTotp: true,
      actionVerb: "deletion",
      title: `Delete ${props.type} ${name}`,
      okLabel: `Delete ${props.type}`,
      consequence: `${agent_count} agents will move to ${destinationLabel.value}.`,
    },
  }).onOk(async (code) => {
    busy.value = true;
    const remove = props.type === "client" ? removeClient : removeSite;
    try {
      notifySuccess(
        await remove(id, { move_to_site: destination.value }, code),
      );
      onDialogOK();
    } catch (e) {
      console.error(e);
    }
    busy.value = false;
  });
}

onMounted(loadSites);
</script>
