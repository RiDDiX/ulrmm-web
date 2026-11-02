<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    ref="dialogRef"
    persistent
    aria-labelledby="baseline-form-title"
    @hide="onDialogHide"
  >
    <q-card class="q-dialog-plugin rmm-dialog--lg">
      <DialogHeader
        title-id="baseline-form-title"
        :title="baseline ? `Edit ${baseline.name}` : 'New baseline'"
        subtitle="Software agents install one item at a time, in this order; the server checks each one afterwards"
      />
      <q-form @submit="save">
        <q-card-section class="q-gutter-y-sm baseline-form__body">
          <div class="row q-col-gutter-sm">
            <q-input
              v-model="form.name"
              class="col-12 col-sm-8"
              label="Name"
              maxlength="255"
              dense
              outlined
              autofocus
              hide-bottom-space
              lazy-rules="ondemand"
              :error="!!err('name')"
              :error-message="err('name')"
              :rules="[(v) => !!v?.trim() || 'Required']"
            />
            <q-select
              v-model="form.plat"
              class="col-12 col-sm-4"
              :options="PLAT_OPTIONS"
              emit-value
              map-options
              dense
              outlined
              options-dense
              label="Platform"
              :hint="items.length ? 'Remove the items to change it' : undefined"
              :disable="items.length > 0"
              hide-bottom-space
              :error="!!err('plat')"
              :error-message="err('plat')"
            />
          </div>
          <q-input
            v-model="form.description"
            label="Description (optional)"
            maxlength="500"
            dense
            outlined
            hide-bottom-space
            :error="!!err('description')"
            :error-message="err('description')"
          />
          <q-toggle
            v-model="form.enabled"
            label="Enabled"
            aria-describedby="baseline-enabled-hint"
          />
          <div
            id="baseline-enabled-hint"
            class="text-caption rmm-muted baseline-form__toggle-hint"
          >
            A disabled baseline installs nothing; its states stay.
          </div>

          <div class="text-subtitle2 q-pt-sm">
            Items
            <span class="rmm-muted rmm-num">{{ items.length }}</span>
          </div>
          <BaselineItemPicker :plat="form.plat" @add="addItem" />
          <div
            v-if="itemsError"
            class="text-caption text-negative"
            role="alert"
          >
            {{ itemsError }}
          </div>
          <div v-if="!items.length" class="text-caption rmm-muted">
            Add the software this baseline installs. Drag the items or use the
            arrows to set the order.
          </div>
          <draggable
            v-model="items"
            item-key="key"
            tag="ol"
            handle=".baseline-item__handle"
            ghost-class="baseline-item--ghost"
            class="baseline-items"
          >
            <template #item="{ element, index }">
              <li class="baseline-item">
                <div class="row items-center no-wrap q-gutter-x-sm">
                  <q-icon
                    name="drag_indicator"
                    size="20px"
                    class="baseline-item__handle"
                  >
                    <q-tooltip>Drag to change the order</q-tooltip>
                  </q-icon>
                  <span class="rmm-num rmm-muted">{{ index + 1 }}.</span>
                  <div class="col baseline-item__text">
                    <div class="text-weight-medium">
                      {{ element.name || element.ref }}
                    </div>
                    <div class="text-caption rmm-muted">
                      {{ SOURCE_META[element.source as BaselineSource].label }}
                      ·
                      <span class="rmm-mono">{{ refText(element) }}</span>
                      · {{ detectionSummary(element.detection) }}
                      <template v-if="element.required === false">
                        · optional</template
                      >
                    </div>
                    <div
                      v-if="itemError(index)"
                      class="text-caption text-negative"
                      role="alert"
                    >
                      {{ itemError(index) }}
                    </div>
                  </div>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="arrow_upward"
                    :disable="index === 0"
                    :aria-label="`Move ${element.name} up`"
                    @click="move(index, -1)"
                  >
                    <q-tooltip>Install it earlier</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="arrow_downward"
                    :disable="index === items.length - 1"
                    :aria-label="`Move ${element.name} down`"
                    @click="move(index, 1)"
                  >
                    <q-tooltip>Install it later</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="tune"
                    :aria-label="`Settings of ${element.name}`"
                    :aria-expanded="open === element.key ? 'true' : 'false'"
                    @click="open = open === element.key ? null : element.key"
                  >
                    <q-tooltip
                      >Detection, time limit and whether it is
                      required</q-tooltip
                    >
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    icon="close"
                    color="negative"
                    :aria-label="`Remove ${element.name}`"
                    @click="removeItem(index)"
                  >
                    <q-tooltip>Remove it from the baseline</q-tooltip>
                  </q-btn>
                </div>
                <div
                  v-if="open === element.key"
                  class="baseline-item__detection"
                >
                  <div class="row items-start q-col-gutter-sm q-mb-sm">
                    <div class="col-12 col-sm-6">
                      <q-toggle
                        :model-value="element.required !== false"
                        label="Required"
                        @update:model-value="(on) => (element.required = on)"
                      />
                      <div
                        class="text-caption rmm-muted baseline-form__toggle-hint"
                      >
                        Off: a failure of this item does not mark the baseline
                        failed
                      </div>
                    </div>
                    <q-input
                      :model-value="(element.timeout ?? ITEM_TIMEOUT) / 60"
                      class="col-12 col-sm-6"
                      type="number"
                      :min="ITEM_MIN_MINUTES"
                      :max="ITEM_MAX_MINUTES"
                      label="Time limit (minutes)"
                      :hint="`Install fails after this; ${ITEM_MIN_MINUTES} to ${ITEM_MAX_MINUTES}`"
                      dense
                      outlined
                      :rules="[timeoutRule]"
                      @update:model-value="
                        (v) => (element.timeout = Math.round(Number(v) * 60))
                      "
                    />
                  </div>
                  <DetectionEditor
                    v-model="element.detection"
                    :plat="form.plat"
                    allow-default
                    :default-text="
                      SOURCE_META[element.source as BaselineSource].defaultRule
                    "
                  />
                </div>
              </li>
            </template>
          </draggable>

          <div class="text-subtitle2 q-pt-sm">Assigned to</div>
          <RmmSelect
            v-model="form.policies"
            :options="policyOptions"
            map-options
            multiple
            filterable
            label="Automation policies"
            hint="Agents under these policies get the baseline, resolved like policy checks and tasks"
            :error="!!err('policies')"
            :error-message="err('policies')"
          />
          <RmmSelect
            v-model="form.deployments"
            :options="deploymentOptions"
            map-options
            multiple
            filterable
            label="Deployments"
            :hint="
              deploymentOptions.length
                ? 'Agents installed with these deployments get it after enrollment'
                : 'No deployment you can see yet'
            "
            :error="!!err('deployments')"
            :error-message="err('deployments')"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            :disable="saving"
            @click="onDialogCancel"
          />
          <q-btn
            unelevated
            color="primary"
            :label="baseline ? 'Save' : 'Create'"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useDialogPluginComponent, useQuasar } from "quasar";
// ES build: the bundled one calls new Function, which the CSP refuses
import draggable from "vuedraggable/src/vuedraggable";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import RmmSelect from "@/components/ui/RmmSelect.vue";
import DetectionEditor from "@/components/baselines/DetectionEditor.vue";
import BaselineItemPicker from "@/components/baselines/BaselineItemPicker.vue";
import { createBaseline, updateBaseline } from "@/api/baselines";
import { fetchDeployments } from "@/api/clients";
import { usePolicyNames } from "@/composables/automation";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { notifyError, notifySuccess, notifyWarning } from "@/utils/notify";
import {
  PLAT_OPTIONS,
  SOURCE_META,
  detectionSummary,
  itemsPayload,
  type Baseline,
  type BaselineItem,
  type BaselineSource,
} from "@/utils/baselines";

type Row = BaselineItem & { key: number };
type Deployment = {
  id: number;
  name?: string;
  client_name: string;
  site_name: string;
  expiry: string;
};

const props = withDefaults(defineProps<{ baseline?: Baseline | null }>(), {
  baseline: null,
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();
const $q = useQuasar();

const form = reactive({
  name: props.baseline?.name ?? "",
  description: props.baseline?.description ?? "",
  plat: props.baseline?.plat ?? "windows",
  enabled: props.baseline?.enabled ?? true,
  policies: [...(props.baseline?.policies ?? [])],
  deployments: [...(props.baseline?.deployments ?? [])],
});

let nextKey = 0;
const toRow = (item: BaselineItem): Row => ({ ...item, key: nextKey++ });
const items = ref<Row[]>(
  [...(props.baseline?.items ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toRow),
);
// key of the item whose detection editor is open
const open = ref<number | null>(null);
const saving = ref(false);
const errors = ref<Record<string, unknown>>({});

function addItem(item: BaselineItem) {
  if (items.value.some((i) => i.source === item.source && i.ref === item.ref)) {
    notifyWarning(`${item.name} is in the list already`);
    return;
  }
  items.value.push(toRow(item));
}

function move(index: number, by: number) {
  const list = items.value;
  const [row] = list.splice(index, 1);
  list.splice(index + by, 0, row);
}

function removeItem(index: number) {
  items.value.splice(index, 1);
}

// server: BaselineItem.timeout, 60 s to 4 h, default 30 min
const ITEM_TIMEOUT = 1800;
const ITEM_MIN_MINUTES = 1;
const ITEM_MAX_MINUTES = 240;
const timeoutRule = (v: string | number) => {
  const minutes = Number(v);
  return (
    (minutes >= ITEM_MIN_MINUTES && minutes <= ITEM_MAX_MINUTES) ||
    `${ITEM_MIN_MINUTES} to ${ITEM_MAX_MINUTES} minutes`
  );
};

const refText = (item: BaselineItem) =>
  item.source === "package" ? `package #${item.ref}` : item.ref;

// 400 {items: [{}, {ref: ["..."]}]}: one entry per item, in list order
function itemError(index: number): string {
  const list = errors.value.items;
  const entry = Array.isArray(list) ? list[index] : null;
  if (!entry || typeof entry !== "object") return "";
  const first = Object.values(entry as Record<string, unknown>)[0];
  return String(Array.isArray(first) ? first[0] : (first ?? ""));
}

const err = (key: string) => {
  const value = errors.value[key];
  return typeof value === "string" ? value : "";
};

const itemsError = computed(() => {
  const list = errors.value.items;
  return typeof list === "string" ? list : "";
});

const { policyNames, loadPolicyNames } = usePolicyNames();
const policyOptions = computed(() =>
  Object.entries(policyNames.value as Record<string, string>)
    .map(([id, name]) => ({ value: Number(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);

const deployments = ref<Deployment[]>([]);
const deploymentOptions = computed(() =>
  deployments.value.map((d) => {
    const expired = new Date(d.expiry).getTime() < Date.now();
    const name = d.name || "Deployment";
    return {
      value: d.id,
      label: `${name} · ${d.client_name} / ${d.site_name}${expired ? " (expired)" : ""}`,
    };
  }),
);

async function save() {
  errors.value = {};
  if (!items.value.length) {
    errors.value = { items: "Add at least one item" };
    return;
  }
  saving.value = true;
  const body = {
    name: form.name.trim(),
    description: form.description.trim(),
    plat: form.plat,
    enabled: form.enabled,
    policies: form.policies,
    deployments: form.deployments,
    items: itemsPayload(items.value),
  };
  try {
    const id = props.baseline?.id;
    const saved = await stepUpCall($q, (config: { silent: boolean }) =>
      id === undefined
        ? createBaseline(body, config)
        : updateBaseline(id, body, config),
    );
    if (!saved) return;
    notifySuccess(`${body.name} was saved`);
    onDialogOK(saved);
  } catch (e) {
    const { fields, message } = serverErrors(e);
    errors.value = fields;
    const shown = [
      "name",
      "description",
      "plat",
      "policies",
      "deployments",
      "items",
    ];
    if (!Object.keys(fields).some((k) => shown.includes(k)))
      notifyError(message);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  loadPolicyNames();
  try {
    deployments.value = await fetchDeployments();
  } catch {
    // 403: the role sees no deployments; the hint says so
  }
});
</script>

<style scoped>
.baseline-form__body {
  max-height: 70vh;
  overflow-y: auto;
}

/* starts where the toggle track starts */
.baseline-form__toggle-hint {
  padding-left: 12px;
}

.baseline-items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.baseline-item {
  padding: 6px 8px;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius-sm);
  background: var(--rmm-surface);
}

.baseline-item + .baseline-item {
  margin-top: 6px;
}

.baseline-item--ghost {
  opacity: 0.5;
  background: var(--rmm-accent-soft);
}

.baseline-item__handle {
  color: var(--rmm-text-muted);
}

.baseline-item__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.baseline-item__detection {
  padding: 8px 0 4px 36px;
}
</style>
