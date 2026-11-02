<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="col-12 col-sm-6 col-md-4">
    <q-card flat class="rmm-card detail-card">
      <div class="rmm-card__header">
        <div class="rmm-card__title">Asset</div>
        <HelpTip
          text="Purchase and warranty record of this device. The warranty lookup works for Dell (needs the TechDirect keys on the server) and Lenovo"
        />
        <q-space />
        <q-btn
          flat
          dense
          no-caps
          icon="edit"
          label="Edit"
          aria-label="Edit asset details"
          @click="edit"
        />
      </div>
      <div class="rmm-card__body rmm-kv">
        <span>Asset tag</span
        ><span class="rmm-mono">{{ agent.asset_tag || "—" }}</span>
        <span>Vendor</span><span>{{ agent.vendor || "—" }}</span>
        <span>Purchased</span><span>{{ agent.purchase_date || "—" }}</span>
        <span>Price</span
        ><span class="rmm-num">{{
          priceText(agent.purchase_price) || "—"
        }}</span>
        <span>Warranty ends</span>
        <span>
          {{ agent.warranty_end || "—" }}
          <span
            v-if="expiry.text"
            class="rmm-pill q-ml-xs"
            :class="`rmm-pill--${expiry.tone}`"
            >{{ expiry.text }}</span
          >
        </span>
        <template v-if="warranty">
          <span>Lookup</span>
          <span>
            <template v-if="warranty.error">
              <span class="rmm-pill rmm-pill--warning">{{
                warranty.error
              }}</span>
            </template>
            <template v-else>
              {{
                [warranty.provider, warranty.product, warranty.service_level]
                  .filter(Boolean)
                  .join(", ") || "no details"
              }}
            </template>
            <span v-if="warranty.fetched_at" class="rmm-muted">
              ({{ relativeTime(warranty.fetched_at) }})</span
            >
          </span>
        </template>
        <template v-if="agent.lifecycle_notes">
          <span>Notes</span
          ><span class="asset-card__notes">{{ agent.lifecycle_notes }}</span>
        </template>
      </div>
      <q-card-actions>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="verified_user"
          label="Check warranty"
          :loading="checking"
          @click="check"
        >
          <q-tooltip
            >Ask the vendor for the warranty end, using the serial
            number</q-tooltip
          >
        </q-btn>
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { checkAgentWarranty } from "@/api/assets";
import { expiryPill, priceText, warrantyOf } from "@/utils/assets";
import { relativeTime } from "@/utils/format";
import { notifySuccess, notifyWarning } from "@/utils/notify";
import EditAsset from "@/components/modals/agents/EditAsset.vue";
import HelpTip from "@/components/ui/HelpTip.vue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = defineProps<{ agent: Record<string, any> }>();
const emit = defineEmits<{ changed: [] }>();

const $q = useQuasar();
const checking = ref(false);
const warranty = computed(() => warrantyOf(props.agent));
const expiry = computed(() => expiryPill(props.agent.warranty_end));

function edit() {
  $q.dialog({
    component: EditAsset,
    componentProps: { agent: props.agent },
  }).onOk(() => emit("changed"));
}

async function check() {
  checking.value = true;
  try {
    await checkAgentWarranty(props.agent.agent_id);
    emit("changed");
    // the result is in warranty_status after the reload
    notifySuccess("Warranty lookup finished");
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 403) notifyWarning("Your role cannot edit this device");
    // other errors: the response interceptor shows them
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
.asset-card__notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
