<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="text-caption rmm-muted q-mb-md">
    Policies that apply to this agent: its own, its site's, its client's and the
    global default. Assign them with Assign automation policy; edit them in the
    Automation Manager.
  </div>
  <div class="rmm-label">Policies</div>
  <q-list separator padding dense>
    <q-item v-for="(policy, key) in agent.applied_policies" :key="key">
      <q-item-section>
        <q-item-label overline>
          {{ capitalize(key).split("_").join(" ") }}
        </q-item-label>
        <q-item-label>{{ policy ? policy.name : "None" }}</q-item-label>
      </q-item-section>
      <q-item-section v-if="policy && !policy.active" side>
        <span class="rmm-pill rmm-pill--neutral">disabled</span>
      </q-item-section>
    </q-item>
  </q-list>

  <div class="rmm-label q-mt-md">Alert Template</div>
  <q-list dense padding>
    <q-item>
      <q-item-section>
        <q-item-label>{{ template ? template.name : "None" }}</q-item-label>
      </q-item-section>
      <q-item-section v-if="template && !template.is_active" side>
        <span class="rmm-pill rmm-pill--neutral">disabled</span>
      </q-item-section>
    </q-item>
  </q-list>

  <div class="row items-center q-gutter-x-xs q-mt-md">
    <div class="rmm-label">Effective Patch Policy</div>
    <HelpTip
      text="The patch settings in force after combining the policy with this agent's own overrides"
    />
  </div>
  <q-list separator padding dense>
    <q-item v-for="row in patchRows" :key="row.label">
      <q-item-section>
        <q-item-label overline>{{ row.label }}</q-item-label>
        <q-item-label>{{ row.text }}</q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
import { computed } from "vue";
import { capitalize } from "@/utils/format";
import { scheduleSummary } from "@/utils/patchSchedule";
import HelpTip from "@/components/ui/HelpTip.vue";

const props = defineProps({ agent: { type: Object, required: true } });

const template = computed(() => props.agent.alert_template);

const setting = (value) =>
  value !== "inherit" ? capitalize(value) : "Not configured";

const patchRows = computed(() => {
  const eff = props.agent.effective_patch_policy;
  const level = (label, key) => ({ label, text: setting(eff[key]) });
  return [
    level("Critical", "critical"),
    level("Important", "important"),
    level("Moderate", "moderate"),
    level("Low", "low"),
    level("Other", "other"),
    { label: "Schedule", text: scheduleSummary(eff) },
    level("Reboot after installation", "reboot_after_install"),
    {
      label: "Failed patch options",
      text: `${
        eff.reprocess_failed
          ? `Retry ${eff.reprocess_failed_times} times`
          : "No automatic retry"
      } · Email on failure: ${eff.email_if_fail ? "Yes" : "No"}`,
    },
  ];
});
</script>
