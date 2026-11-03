<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useAccountActions, type AccountEntry } from "./accountActions";

// The signed-in user's menu. At the foot of the rail it shows the avatar
// (and the name while the rail is wide) and tucks the password and 2FA
// resets into an Account submenu; in a pop-out's header it is a flat list.
const props = defineProps<{ inHeader?: boolean; compact?: boolean }>();

const { displayName } = storeToRefs(useAuthStore());
const { preferences, resets } = useAccountActions();

const initial = computed(
  () => (displayName.value || "?").trim().charAt(0).toUpperCase() || "?",
);
const menuLabel = computed(
  () => `User menu for ${displayName.value || "current user"}`,
);
const LOGOUT_ROUTE = { path: "/expired", query: { reason: "logout" } };

// the rail's button is the avatar, the header's an icon with the name
const trigger = computed(() =>
  props.inHeader
    ? {
        class: "user-menu",
        icon: "account_circle",
        label: displayName.value || "",
      }
    : { class: "nav-user__btn", dropdownIcon: "expand_more" },
);

const entries = computed<AccountEntry[]>(() =>
  props.inHeader
    ? [preferences, ...resets]
    : [
        preferences,
        ...(resets.length
          ? [{ key: "account", label: "Account", children: resets }]
          : []),
      ],
);
</script>

<template>
  <div
    :class="
      inHeader
        ? 'toolbar-user-menu'
        : ['nav-user', { 'nav-user--compact': compact }]
    "
  >
    <q-tooltip>Preferences, password, 2FA and log out</q-tooltip>
    <q-btn-dropdown
      flat
      no-caps
      v-bind="trigger"
      :toggle-aria-label="menuLabel"
    >
      <template v-if="!inHeader" #label>
        <span class="nav-user__avatar" aria-hidden="true">{{ initial }}</span>
        <span v-if="!compact" class="nav-user__name">{{
          displayName || "Account"
        }}</span>
      </template>
      <q-list dense class="app-menu-list">
        <template v-for="entry in entries" :key="entry.key">
          <q-item v-if="entry.children" clickable>
            <q-item-section>{{ entry.label }}</q-item-section>
            <q-item-section side
              ><q-icon name="keyboard_arrow_right"
            /></q-item-section>
            <q-menu anchor="top end" self="top start">
              <q-list>
                <q-item
                  v-for="child in entry.children"
                  :key="child.key"
                  v-close-popup
                  v-ripple
                  clickable
                  @click="child.run"
                >
                  <q-item-section>
                    <q-item-label>{{ child.label }}</q-item-label>
                    <q-item-label v-if="child.caption" caption>{{
                      child.caption
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-item>
          <q-item v-else v-close-popup v-ripple clickable @click="entry.run">
            <q-item-section>
              <q-item-label>{{ entry.label }}</q-item-label>
              <q-item-label v-if="entry.caption" caption>{{
                entry.caption
              }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
        <q-item :to="LOGOUT_ROUTE" exact>
          <q-item-section><q-item-label>Logout</q-item-label></q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
  </div>
</template>

<style scoped>
/* the signed-in user at the foot of the rail */
.nav-user {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  height: 60px;
  align-items: center;
  padding: 0 8px;
  border-top: 1px solid var(--rmm-nav-border);
}

.nav-user__btn {
  width: 100%;
  min-height: 44px;
  justify-content: flex-start;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--rmm-nav-text);
}

.nav-user__btn :deep(.q-btn__content) {
  width: 100%;
  justify-content: flex-start;
  gap: 10px;
}

.nav-user__btn :deep(.q-btn-dropdown__arrow) {
  margin-left: auto;
  color: var(--rmm-nav-text-muted);
}

.nav-user--compact .nav-user__btn {
  justify-content: center;
  padding: 0;
}

.nav-user--compact .nav-user__btn :deep(.q-btn__content) {
  justify-content: center;
}

.nav-user--compact .nav-user__btn :deep(.q-btn-dropdown__arrow) {
  display: none;
}

.nav-user__avatar {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #ffffff;
  background: var(--rmm-accent);
  font-size: 0.9rem;
  font-weight: 700;
}

.nav-user__name {
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-user-menu {
  display: flex;
}

.user-menu {
  min-height: 36px;
}

.app-menu-list {
  min-width: 190px;
}
</style>
