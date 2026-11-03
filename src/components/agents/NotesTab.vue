<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div v-if="!selectedAgent" class="q-pa-sm rmm-muted">No agent selected</div>
  <div v-else>
    <StaleBanner
      v-if="error && notes.length > 0"
      :message="errorMessage"
      :loaded-at="lastLoadedAt"
      :format-date="formatDate"
      @retry="load"
    />
    <q-table
      v-model:pagination="pagination"
      class="tabs-tbl-sticky rmm-table notes-table"
      :style="{ 'max-height': tabHeight }"
      row-key="pk"
      :loading="loading"
      v-bind="cardTable"
      :rows="notes"
      :columns="columns"
    >
      <template #top>
        <TabToolbar title="Notes" :count="notes.length">
          <q-btn
            class="notes-tab__primary"
            icon="add"
            label="Add note"
            color="primary"
            unelevated
            no-caps
            dense
            @click="addNote"
          >
            <q-tooltip
              >Leave a note about this device for other admins</q-tooltip
            >
          </q-btn>
          <q-space />
          <ExportTableBtn :data="notes" :columns="columns" />
          <q-btn
            icon="refresh"
            aria-label="Refresh notes"
            dense
            flat
            round
            @click="load"
          >
            <q-tooltip>Refresh notes</q-tooltip>
          </q-btn>
        </TabToolbar>
      </template>

      <template #loading>
        <q-inner-loading showing color="primary" />
      </template>

      <template #no-data>
        <div v-if="!loading" class="full-width">
          <LoadFailed
            v-if="error"
            title="Unable to load notes"
            :message="errorMessage"
            @retry="load"
          />
          <EmptyState
            v-else
            icon="sticky_note_2"
            title="No notes yet"
            text="Notes keep context for other admins, such as a known issue or a contact on site."
          >
            <q-btn
              icon="add"
              label="Add note"
              color="primary"
              unelevated
              dense
              no-caps
              @click="addNote"
            />
          </EmptyState>
        </div>
      </template>

      <template #item="card">
        <q-card flat class="rmm-card notes-card q-ma-xs">
          <div class="rmm-card__header notes-card__header">
            <div class="notes-card__meta">
              <div class="notes-card__author">{{ card.row.username }}</div>
              <div class="rmm-muted notes-card__time">
                {{ formatDate(card.row.entry_time) }}
              </div>
            </div>
            <q-btn
              class="notes-card__menu"
              icon="more_vert"
              :aria-label="`Actions for note from ${card.row.username}`"
              round
              flat
              dense
            >
              <q-tooltip v-if="menuNote !== card.row"
                >Edit or delete this note</q-tooltip
              >
              <q-menu
                cover
                auto-close
                @show="menuNote = card.row"
                @hide="menuNote = null"
              >
                <q-list dense style="min-width: 160px">
                  <template v-for="(item, i) in noteActions" :key="item.label">
                    <q-separator v-if="i > 0" />
                    <q-item
                      v-close-popup
                      clickable
                      :class="{ 'text-negative': item.danger }"
                      @click="item.run(card.row)"
                    >
                      <q-item-section side>
                        <q-icon
                          :name="item.icon"
                          :color="item.danger ? 'negative' : undefined"
                        />
                      </q-item-section>
                      <q-item-section>{{ item.label }}</q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
          <div class="rmm-card__body notes-card__body scroll">
            <pre>{{ card.row.note }}</pre>
          </div>
        </q-card>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useQuasar } from "quasar";
import {
  fetchAgentNotes,
  saveAgentNote,
  removeAgentNote,
  editAgentNote as updateAgentNote,
} from "@/api/agents";
import { notifySuccess } from "@/utils/notify";
import ExportTableBtn from "@/components/ui/ExportTableBtn.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import TabToolbar from "@/components/agents/TabToolbar.vue";
import { flatTable } from "@/components/agents/tableProps";
import StaleBanner from "@/components/agents/StaleBanner.vue";
import LoadFailed from "@/components/agents/LoadFailed.vue";
import { useAgentTab } from "@/components/agents/useAgentTab";

defineOptions({ name: "NotesTab" });

const columns = [
  ["entry_time", "Date"],
  ["username", "User"],
  ["note", "Note"],
].map(([name, label]) => ({ name, label, field: name }));

const $q = useQuasar();
// hidePagination, not hideBottom: the bottom also holds the no-data slot
const cardTable = { ...flatTable, grid: true, hidePagination: true };

const notes = ref([]);
// the note whose menu is open; the tooltip would cover the menu
const menuNote = ref(null);
const pagination = ref({ rowsPerPage: 0, sortBy: null, descending: false });

const {
  selectedAgent,
  tabHeight,
  formatDate,
  loading,
  error,
  errorMessage,
  lastLoadedAt,
  load,
} = useAgentTab({
  fetch: fetchAgentNotes,
  // the API sends no order; newest first puts a warning left for the next
  // admin in the first card
  accept: (result) =>
    (notes.value = [...result].sort(
      (a, b) => new Date(b.entry_time) - new Date(a.entry_time),
    )),
  clear: () => (notes.value = []),
  forbidden: "Your role cannot view notes for this agent.",
  failed: "Notes could not be loaded.",
});

async function change(call) {
  loading.value = true;
  try {
    notifySuccess(await call());
    await load();
  } catch (e) {
    console.error(e);
  }
  loading.value = false;
}

function askForText(options, save) {
  $q.dialog({
    prompt: { type: "textarea", isValid: (val) => !!val, ...options.prompt },
    style: "width: 90vw; max-width: 90vw",
    cancel: true,
    title: options.title,
    ok: { label: options.ok },
  }).onOk(save);
}

function addNote() {
  const draft = ref("");
  askForText({ title: "Add Note", ok: "Add", prompt: { model: draft } }, () =>
    change(() =>
      saveAgentNote({ agent_id: selectedAgent.value, note: draft.value }),
    ),
  );
}

function editNote(note) {
  askForText(
    { title: "Edit Note", ok: "Save", prompt: { model: note.note } },
    (text) => change(() => updateAgentNote(note.pk, { note: text })),
  );
}

const noteActions = [
  { label: "Edit", icon: "edit", run: (note) => editNote(note) },
  {
    label: "Delete",
    icon: "delete",
    danger: true,
    run: (note) => deleteNote(note),
  },
];

function deleteNote(note) {
  $q.dialog({
    title: "Delete note?",
    cancel: true,
    ok: { label: "Delete", color: "negative" },
  }).onOk(() => change(() => removeAgentNote(note.pk)));
}
</script>

<style lang="sass" scoped>
.notes-card
  width: 100%
  min-width: 280px
  max-width: 360px

.notes-card__header
  min-height: 48px

.notes-card__meta
  min-width: 0
  flex: 1

.notes-card__author
  overflow: hidden
  font-weight: 600
  text-overflow: ellipsis
  white-space: nowrap

.notes-card__time
  font-size: var(--rmm-fs-xs)

.notes-card__menu
  color: var(--rmm-text-subtle)

.notes-card__body
  max-height: 20vh

.notes-card__body pre
  margin: 0
  font-family: inherit
  white-space: pre-wrap
  overflow-wrap: anywhere

.notes-tab__primary
  padding: 2px 10px

.notes-table :deep(.q-table__grid-content)
  padding: 4px
</style>
