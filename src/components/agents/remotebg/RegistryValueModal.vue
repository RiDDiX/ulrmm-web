<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="(val) => emit('update:modelValue', val)"
    persistent
  >
    <q-card class="rmm-dialog--sm">
      <DialogHeader
        :title="`${row.isNew ? 'New' : 'Edit'} ${typeLabel}`"
        subtitle="Saving writes the value to the selected key on the agent"
      />

      <q-card-section class="q-pb-none">
        <q-input
          v-model="localRow.name"
          ref="nameInputRef"
          label="Value name"
          dense
          outlined
          :readonly="!row.isNew"
          :disable="!row.isNew"
          :autofocus="row.isNew"
          :placeholder="row.isNew ? undefined : '(Default)'"
          :hint="
            row.isNew
              ? 'Leave empty to set the key\'s default value'
              : undefined
          "
          class="q-pb-sm"
        />
      </q-card-section>
      <q-card-section>
        <q-input
          v-if="kind === 'multi'"
          v-model="multiStringData"
          label="Value data"
          type="textarea"
          dense
          outlined
          :autofocus="!row.isNew"
          hint="One string per line; empty lines are dropped"
        />
        <div
          v-else-if="kind === 'number'"
          class="row items-start q-col-gutter-lg"
        >
          <div class="col-7">
            <q-input
              v-model="formattedValue"
              label="Value data"
              dense
              outlined
              autofocus
              input-class="rmm-mono"
              :error="!!numericError"
              :error-message="numericError"
              :hint="
                row.type === 'REG_DWORD'
                  ? '32-bit number, up to 4,294,967,295'
                  : '64-bit number, up to 9,007,199,254,740,991'
              "
              @keypress="onKeyPress"
            />
          </div>
          <div class="col-5 q-py-none">
            <div class="row items-center q-gutter-xs q-mb-xs">
              <span class="rmm-label">Base</span>
              <HelpTip
                text="Only changes how the number is shown and typed; the stored value stays the same"
              />
            </div>
            <q-option-group
              v-model="localBase"
              :options="baseOptions"
              type="radio"
              dense
              inline
              class="q-gutter-sm"
            />
          </div>
        </div>
        <q-input
          v-else
          v-model="stringValue"
          label="Value data"
          dense
          outlined
          autofocus
          :hint="
            row.type === 'REG_EXPAND_SZ'
              ? 'Variables such as %SystemRoot% are expanded when the value is read'
              : undefined
          "
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup flat no-caps label="Cancel" :disable="isSaving" />
        <q-btn
          unelevated
          no-caps
          color="primary"
          label="Save"
          :disable="isSaving"
          :loading="!!isSaving"
          @click="onSave"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { RegistryValue } from "@/types/agents";
import { QInput } from "quasar";
import HelpTip from "@/components/ui/HelpTip.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";

type Base = "hex" | "dec";

const props = defineProps<{ modelValue: boolean; row: RegistryValue }>();
const emit = defineEmits<{
  (e: "save", row: RegistryValue & { base?: Base }): void;
  (e: "update:modelValue", value: boolean): void;
}>();

const TYPE_LABELS: Record<string, string> = {
  REG_DWORD: "DWORD (32-bit) value",
  REG_QWORD: "QWORD (64-bit) value",
  REG_MULTI_SZ: "multi-string value",
  REG_EXPAND_SZ: "expandable string value",
};
const baseOptions = [
  { label: "Hexadecimal", value: "hex" },
  { label: "Decimal", value: "dec" },
];
const NUMBER_LIMITS: Record<string, { max: number; message: string }> = {
  REG_DWORD: {
    max: 0xffffffff,
    message: "DWORD (32-bit) value cannot exceed 4,294,967,295.",
  },
  REG_QWORD: {
    max: Number.MAX_SAFE_INTEGER,
    message: "QWORD (64-bit) value cannot exceed 9,007,199,254,740,991.",
  },
};

const typeLabel = computed(() => TYPE_LABELS[props.row.type] ?? "string value");
const kind = computed(() => {
  if (props.row.type === "REG_MULTI_SZ") return "multi";
  return props.row.type in NUMBER_LIMITS ? "number" : "text";
});

const nameInputRef = ref();
const numericError = ref("");
const isSaving = ref(false);
const localRow = ref<RegistryValue>({ ...props.row });
const localBase = ref<Base>("hex");
const stringValue = ref("");
const multiStringData = ref("");
const numericValue = ref(0);

// numbers arrive as numbers, "0x1F", "0x1F (31)" or plain digit strings
function toNumber(data: unknown): number {
  if (typeof data === "number") return data;
  if (typeof data !== "string") return 0;
  const hex = data.match(/0x[0-9a-fA-F]+/);
  if (hex) return parseInt(hex[0], 16);
  const dec = data.match(/\((\d+)\)/);
  if (dec) return parseInt(dec[1], 10);
  return /^\d+$/.test(data) ? parseInt(data, 10) : 0;
}

function renderHex(n: number) {
  return "0x" + n.toString(16).toUpperCase().padStart(8, "0");
}

watch(
  () => props.row,
  (next) => {
    localRow.value = { ...next };
    if (next.type in NUMBER_LIMITS) {
      numericValue.value = toNumber(next.data);
      localBase.value = "hex";
    }
    if (next.type === "REG_MULTI_SZ" && Array.isArray(next.data))
      multiStringData.value = next.data.join("\n");
    if (typeof next.data === "string") stringValue.value = next.data;
  },
  { deep: true, immediate: true },
);

const formattedValue = computed({
  get: () =>
    localBase.value === "hex"
      ? renderHex(numericValue.value)
      : String(numericValue.value),
  set(text: string) {
    numericValue.value =
      localBase.value === "hex"
        ? parseInt(text.replace(/^0x/i, ""), 16) || 0
        : parseFloat(text) || 0;
  },
});

function onKeyPress(e: KeyboardEvent) {
  const allowed = localBase.value === "hex" ? /[0-9a-fA-Fx]/ : /[0-9]/;
  if (!allowed.test(e.key)) e.preventDefault();
}

function checkNumber(): boolean {
  const limit = NUMBER_LIMITS[localRow.value.type];
  if (!limit) return true;
  if (numericValue.value < 0) {
    numericError.value = "Value cannot be negative.";
  } else if (numericValue.value > limit.max) {
    numericError.value = limit.message;
  }
  return !numericError.value;
}

function collectData(): RegistryValue["data"] {
  const type = localRow.value.type;
  if (type in NUMBER_LIMITS)
    return localBase.value === "hex"
      ? renderHex(numericValue.value)
      : numericValue.value.toString();
  if (type === "REG_MULTI_SZ")
    return multiStringData.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  return stringValue.value;
}

async function onSave() {
  numericError.value = "";
  const input: QInput | null = nameInputRef.value;
  if (input && !(input.validate?.() ?? true)) return;
  if (!checkNumber()) return;

  isSaving.value = true;
  try {
    emit("save", {
      ...localRow.value,
      data: collectData(),
      base: localBase.value,
    });
    emit("update:modelValue", false);
  } finally {
    isSaving.value = false;
  }
}
</script>
