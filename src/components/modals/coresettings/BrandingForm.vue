<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="Branding"
      text="Name, logo and links shown to everyone who uses this dashboard."
    />
    <q-card-section>
      <q-input
        outlined
        dense
        v-model="branding.product_name"
        label="Product Name"
        :error="!!errors.product_name"
        :error-message="errors.product_name"
        hint="Shown on the login page, in the header and as the browser tab title"
      />
    </q-card-section>
    <q-card-section>
      <q-input
        outlined
        dense
        v-model="branding.company_name"
        label="Company Name"
        :error="!!errors.company_name"
        :error-message="errors.company_name"
        hint="Vendor of the Linux .deb and .rpm agent packages built under Deploy"
      />
    </q-card-section>
    <q-card-section>
      <q-input
        outlined
        dense
        v-model="branding.support_url"
        label="Support URL"
        :error="!!errors.support_url"
        :error-message="errors.support_url"
        hint="Adds a Support entry to the Help menu"
      />
    </q-card-section>
    <q-card-section>
      <q-file
        outlined
        dense
        v-model="logoFile"
        label="Logo"
        :error="!!errors.logo"
        :error-message="errors.logo"
        accept="image/png, image/jpeg, image/webp, image/gif"
        hint="Shown in the navigation and on the login page; png/jpeg/webp/gif, max 512 KB"
        clearable
        :max-file-size="512 * 1024"
        @rejected="onRejected"
        @update:model-value="readFile($event, 'logo')"
        @clear="branding.logo = null"
      >
        <template v-slot:prepend><q-icon name="attach_file" /></template>
      </q-file>
      <img
        v-if="branding.logo"
        :src="branding.logo"
        alt="logo preview"
        class="q-mt-sm"
        style="max-height: 60px; max-width: 100%"
      />
    </q-card-section>
    <q-card-section>
      <q-file
        outlined
        dense
        v-model="faviconFile"
        label="Favicon"
        :error="!!errors.favicon"
        :error-message="errors.favicon"
        accept="image/png, image/jpeg, image/webp, image/gif"
        hint="Icon in the browser tab; png/jpeg/webp/gif, max 512 KB"
        clearable
        :max-file-size="512 * 1024"
        @rejected="onRejected"
        @update:model-value="readFile($event, 'favicon')"
        @clear="branding.favicon = null"
      >
        <template v-slot:prepend><q-icon name="attach_file" /></template>
      </q-file>
      <img
        v-if="branding.favicon"
        :src="branding.favicon"
        alt="favicon preview"
        class="q-mt-sm"
        style="max-height: 32px"
      />
    </q-card-section>
    <q-card-section class="row items-center q-gutter-sm">
      <q-btn
        unelevated
        no-caps
        label="Save"
        color="primary"
        :loading="saving"
        @click="save"
      />
      <span class="text-caption rmm-muted">
        Branding saves separately from the other Global Settings tabs.
      </span>
    </q-card-section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { fetchBrandingEdit, editBranding } from "@/api/core";
import { useBrandingStore } from "@/stores/branding";
import { notifyError, notifySuccess } from "@/utils/notify";
import { serverErrors } from "@/components/vault/stepUp";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";

const brandingStore = useBrandingStore();

const branding = ref({
  product_name: "",
  company_name: "",
  support_url: "",
  logo: null as string | null,
  favicon: null as string | null,
});

const logoFile = ref(null);
const faviconFile = ref(null);
const saving = ref(false);
const errors = ref<Record<string, string>>({});

function onRejected() {
  notifyError("Image rejected: max 512 KB, png/jpeg/webp/gif only");
}

function readFile(file: File | null, field: "logo" | "favicon") {
  if (!file) {
    branding.value[field] = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    branding.value[field] = reader.result as string;
  };
  reader.readAsDataURL(file);
}

async function save() {
  saving.value = true;
  errors.value = {};
  try {
    await editBranding(branding.value, { silent: true });
    await brandingStore.load();
    notifySuccess("Branding was updated");
  } catch (e) {
    // field errors go to their fields, anything else into a toast
    const { fields, message } = serverErrors(e);
    errors.value = fields as Record<string, string>;
    if (!Object.keys(fields).some((k) => k in branding.value))
      notifyError(message);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    branding.value = await fetchBrandingEdit();
  } catch (e) {
    console.error(e);
  }
});
</script>
