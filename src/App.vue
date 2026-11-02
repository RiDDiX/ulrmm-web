<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <router-view />
</template>

<script setup>
defineOptions({ name: "App" });
</script>

<style lang="sass">
body
  overflow-y: hidden

a
  color: var(--rmm-accent)

// header row stays put while the body scrolls
=sticky-head($max-height: null)
  max-height: $max-height
  thead tr th
    position: sticky
    z-index: 1
  thead tr:first-child th
    top: 0

.tbl-sticky, .tabs-tbl-sticky, .agents-tbl-sticky
  +sticky-head
.remote-bg-tbl-sticky
  +sticky-head(70vh)
.audit-mgr-tbl-sticky
  +sticky-head(75vh)
.settings-tbl-sticky
  +sticky-head(60vh)

.table-bgcolor
  .q-table__top, .q-table__bottom, thead tr:first-child th
    background-color: var(--rmm-surface-2)

.highlight
  background-color: var(--rmm-accent-soft)

.min-width
  min-width: 0px !important
</style>
