<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-menu anchor="top end" self="top start">
    <q-list dense style="min-width: 180px">
      <q-item
        v-for="item in $integrations[`${type}MenuIntegrations`]"
        :key="item.name"
        v-close-popup
        clickable
        dense
        :to="item.type === 'route' ? item.uri : undefined"
        @click="open(item)"
      >
        <q-item-section side>
          <q-icon
            :name="
              item.icon ||
              (item.type === 'route' ? 'arrow_forward' : 'summarize')
            "
            size="xs"
          />
        </q-item-section>
        <q-item-section>{{ item.name }}</q-item-section>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";

const props = defineProps<{
  type: "client" | "agent" | "site";
  id: string | number;
}>();

interface Entry {
  type: string;
  component?: unknown;
  props?: (id: string | number, type: string) => Record<string, unknown>;
}

const $q = useQuasar();

// route entries navigate through :to, only dialogs need opening here
function open(item: Entry) {
  if (item.type !== "dialog") return;
  $q.dialog({
    component: item.component as never,
    componentProps: item.props ? item.props(props.id, props.type) : undefined,
  });
}
</script>
