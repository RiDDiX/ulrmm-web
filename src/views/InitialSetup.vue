<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="rmm-auth-page flex flex-center">
    <q-card class="rmm-auth-card">
      <q-card-section class="text-center">
        <img
          v-if="branding.logo"
          :src="branding.logo"
          :alt="`${branding.productName} logo`"
          class="rmm-auth-logo q-mb-sm"
        />
        <div class="rmm-auth-product">{{ branding.productName }}</div>
      </q-card-section>
      <q-card-section class="q-pb-none">
        <div class="text-h6">Initial setup</div>
      </q-card-section>
      <q-form @submit.prevent="submit">
        <!-- one column, one gap; errors take the space only when shown -->
        <q-card-section class="setup-fields">
          <div class="text-caption rmm-muted">
            A client is an organisation you manage, a site is one of its
            locations; more can be added later.
          </div>
          <q-input
            v-model="form.client.name"
            label="Client name"
            :rules="[required]"
            hide-bottom-space
            dense
            outlined
          >
            <template v-slot:prepend>
              <q-icon name="business" />
            </template>
          </q-input>
          <q-input
            v-model="form.site.name"
            label="First site name"
            :rules="[required]"
            hide-bottom-space
            dense
            outlined
          >
            <template v-slot:prepend>
              <q-icon name="apartment" />
            </template>
          </q-input>
          <div>
            <div class="row items-center q-gutter-xs q-mb-xs">
              <span id="default-timezone-label" class="rmm-label">
                Default timezone for agents
              </span>
              <HelpTip
                text="Schedules use this timezone on every agent that has no timezone of its own"
              />
            </div>
            <rmm-select
              v-model="form.timezone"
              :options="timezones"
              aria-labelledby="default-timezone-label"
              filterable
              dense
              options-dense
              outlined
            />
          </div>
          <div>
            <div class="row items-center q-gutter-xs q-mb-xs">
              <span id="company-name-label" class="rmm-label"
                >Company name</span
              >
              <HelpTip
                text='Shown after each user&apos;s name in remote sessions, e.g. "Jane Doe - Example Inc."'
              />
            </div>
            <q-input
              v-model="form.companyname"
              aria-labelledby="company-name-label"
              dense
              outlined
            />
          </div>
        </q-card-section>

        <q-card-actions align="center">
          <q-btn
            type="submit"
            :label="'Finish'"
            color="primary"
            class="full-width"
            unelevated
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import { useQuasar } from "quasar";

import RmmSelect from "@/components/ui/RmmSelect.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { useBrandingStore } from "@/stores/branding";

const $q = useQuasar();
const router = useRouter();
const branding = useBrandingStore();

const timezones = ref([]);
const form = reactive({
  client: { name: "" },
  site: { name: "" },
  timezone: null,
  companyname: "",
});

const required = (val) => !!val || "*Required";

function submit() {
  $q.loading.show();
  axios
    .post("/clients/", { ...form, initialsetup: true })
    .then(() => {
      $q.loading.hide();
      router.push({ name: "Dashboard" });
    })
    .catch(() => $q.loading.hide());
}

onMounted(async () => {
  const { data } = await axios.get("/core/settings/");
  timezones.value = Object.freeze(data.all_timezones);
  form.timezone = data.default_time_zone;
});
</script>

<style scoped>
.setup-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
