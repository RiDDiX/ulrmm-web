<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="vault-panel">
    <div class="vault-panel__bar">
      <q-tabs
        v-model="section"
        no-caps
        :dense="true"
        align="left"
        :inline-label="true"
        narrow-indicator
        indicator-color="primary"
        active-color="primary"
        class="vault-panel__tabs"
      >
        <q-tab name="documents" icon="description" label="Documents">
          <span class="vault-panel__count rmm-num">{{ documents.length }}</span>
        </q-tab>
        <q-tab name="credentials" icon="password" label="Credentials">
          <span v-if="canViewCredentials" class="vault-panel__count rmm-num">{{
            credentials.length
          }}</span>
        </q-tab>
      </q-tabs>
      <q-space />
      <q-btn
        v-if="section === 'documents' && canWrite.documents"
        unelevated
        dense
        no-caps
        color="primary"
        icon="add"
        label="Add document"
        class="vault-panel__primary"
        @click="editDocument(null)"
      />
      <q-btn
        v-if="section === 'credentials' && canWrite.credentials"
        unelevated
        dense
        no-caps
        color="primary"
        icon="add"
        label="Add credential"
        class="vault-panel__primary"
        @click="editCredential(null)"
      />
      <q-btn
        dense
        flat
        round
        icon="refresh"
        aria-label="Reload the vault"
        @click="load"
      >
        <q-tooltip>Reload documents and credentials</q-tooltip>
      </q-btn>
    </div>

    <q-banner
      v-if="error && loaded"
      dense
      rounded
      class="rmm-banner-warning q-ma-sm"
    >
      <template #avatar>
        <q-icon name="warning_amber" color="warning" />
      </template>
      {{ error }} Showing what was loaded before.
      <template #action>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="load" />
      </template>
    </q-banner>

    <div class="vault-panel__body">
      <q-inner-loading :showing="loading" color="primary" />
      <EmptyState
        v-if="error && !loaded && !loading"
        icon="error_outline"
        title="Unable to load the vault"
        :text="error"
      >
        <q-btn
          outline
          dense
          no-caps
          color="primary"
          label="Retry"
          @click="load"
        />
      </EmptyState>

      <template v-else-if="loaded && section === 'documents'">
        <EmptyState
          v-if="!documents.length"
          icon="description"
          :title="
            canViewDocuments
              ? 'No documents yet'
              : 'Documents are hidden for your role'
          "
          :text="
            canViewDocuments
              ? `Runbooks, contacts or setup notes for this ${noun}. ${INHERIT_TEXT[scope]}`
              : ''
          "
        >
          <q-btn
            v-if="canWrite.documents && canViewDocuments"
            unelevated
            dense
            no-caps
            color="primary"
            icon="add"
            label="Add document"
            @click="editDocument(null)"
          />
        </EmptyState>
        <div v-else class="vault-docs">
          <q-list class="vault-docs__list" aria-label="Documents">
            <q-item
              v-for="doc in documents"
              :key="doc.id"
              clickable
              :active="doc.id === current?.id"
              active-class="vault-docs__item--active"
              @click="selectedId = doc.id"
            >
              <q-item-section side>
                <q-icon
                  :name="doc.pinned ? 'push_pin' : 'description'"
                  size="18px"
                  :aria-label="doc.pinned ? 'Pinned' : undefined"
                  :role="doc.pinned ? 'img' : undefined"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="vault-docs__item-title">{{
                  doc.title
                }}</q-item-label>
                <q-item-label caption>
                  <span
                    v-if="doc.inherited"
                    class="rmm-pill rmm-pill--neutral vault-docs__from"
                    >from {{ doc.inherited }}</span
                  >
                  {{ updated(doc, true) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <section
            v-if="current"
            class="vault-docs__read"
            aria-labelledby="vault-doc-title"
          >
            <div class="vault-docs__head">
              <h2 id="vault-doc-title" class="vault-docs__title">
                {{ current.title }}
              </h2>
              <span v-if="current.pinned" class="rmm-pill rmm-pill--info"
                >Pinned</span
              >
              <span v-if="current.inherited" class="rmm-pill rmm-pill--neutral"
                >from {{ current.inherited }}
                <q-tooltip
                  >Belongs to the {{ current.inherited }}; change it in the
                  {{ current.inherited }}'s vault</q-tooltip
                ></span
              >
              <q-space />
              <template v-if="!current.inherited && canWrite.documents">
                <q-btn
                  flat
                  dense
                  no-caps
                  icon="edit"
                  label="Edit"
                  @click="editDocument(current)"
                />
                <q-btn
                  flat
                  dense
                  no-caps
                  color="negative"
                  icon="delete"
                  label="Delete"
                  @click="deleteDocument(current)"
                />
              </template>
            </div>
            <div class="vault-docs__meta rmm-muted">{{ updated(current) }}</div>
            <pre v-if="current.body" class="vault-docs__body">{{
              current.body
            }}</pre>
            <div v-else class="vault-docs__body rmm-muted">
              This document has no text yet.
            </div>
          </section>
        </div>
      </template>

      <template v-else-if="loaded">
        <EmptyState
          v-if="!credentials.length"
          icon="password"
          :title="
            canViewCredentials
              ? 'No credentials yet'
              : 'Credentials are hidden for your role'
          "
          :text="
            canViewCredentials
              ? `Logins for this ${noun}, such as a local administrator or a BIOS password. Secrets are stored encrypted. ${INHERIT_TEXT[scope]}`
              : 'Your role has no View credentials permission, so none are listed here.'
          "
        >
          <q-btn
            v-if="canWrite.credentials"
            unelevated
            dense
            no-caps
            color="primary"
            icon="add"
            label="Add credential"
            @click="editCredential(null)"
          />
        </EmptyState>
        <q-table
          v-else
          flat
          dense
          class="rmm-table vault-creds"
          :row-key="(r) => r.id"
          :rows="credentials"
          :columns="columns"
          :hide-bottom="true"
          :pagination="{ rowsPerPage: 0 }"
          :rows-per-page-options="[0]"
        >
          <template #body-cell-name="props">
            <q-td :props="props">
              <span class="text-weight-medium">{{ props.row.name }}</span>
              <span
                v-if="props.row.inherited"
                class="rmm-pill rmm-pill--neutral q-ml-sm"
                >from {{ props.row.inherited }}
                <q-tooltip
                  >Belongs to the {{ props.row.inherited }}; change it in the
                  {{ props.row.inherited }}'s vault</q-tooltip
                ></span
              >
            </q-td>
          </template>
          <template #body-cell-username="props">
            <q-td :props="props">
              <template v-if="props.row.username">
                <span class="rmm-mono">{{ props.row.username }}</span>
                <q-btn
                  round
                  flat
                  dense
                  size="sm"
                  icon="content_copy"
                  :aria-label="`Copy user name of ${props.row.name}`"
                  @click="copy(props.row.username, 'User name')"
                >
                  <q-tooltip>Copy the user name</q-tooltip>
                </q-btn>
              </template>
              <span v-else class="rmm-muted">None</span>
            </q-td>
          </template>
          <template #body-cell-secret="props">
            <q-td :props="props">
              <RevealSecret
                v-if="props.row.secret_set"
                :request="(config) => revealCredential(props.row.id, config)"
                :label="`secret of ${props.row.name}`"
              />
              <span v-else class="rmm-muted">Not set</span>
            </q-td>
          </template>
          <template #body-cell-url="props">
            <q-td :props="props" class="vault-creds__url">
              <a
                v-if="isWebUrl(props.row.url)"
                :href="props.row.url"
                target="_blank"
                rel="noopener noreferrer"
                class="rmm-link rmm-ellipsis-cell__text"
                >{{ props.row.url }}</a
              >
              <span v-else class="rmm-ellipsis-cell__text">{{
                props.row.url
              }}</span>
            </q-td>
          </template>
          <template #body-cell-notes="props">
            <q-td :props="props" class="vault-creds__notes">
              <span class="rmm-ellipsis-cell__text">{{ props.row.notes }}</span>
              <q-tooltip v-if="props.row.notes" max-width="420px">{{
                props.row.notes
              }}</q-tooltip>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <RowActions
                v-if="!props.row.inherited && canWrite.credentials"
                :label="`Actions for ${props.row.name}`"
              >
                <q-list dense style="min-width: 160px">
                  <q-item
                    clickable
                    v-close-popup
                    @click="editCredential(props.row)"
                  >
                    <q-item-section side><q-icon name="edit" /></q-item-section>
                    <q-item-section>Edit</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item
                    clickable
                    v-close-popup
                    class="text-negative"
                    @click="deleteCredential(props.row)"
                  >
                    <q-item-section side>
                      <q-icon name="delete" color="negative" />
                    </q-item-section>
                    <q-item-section>Delete</q-item-section>
                  </q-item>
                </q-list>
              </RowActions>
            </q-td>
          </template>
        </q-table>
      </template>
    </div>
  </div>
</template>

<script setup>
// Documents and credentials for one client, site or device, plus the
// read-only ones it inherits. Actions follow the server's "can" block and
// hide after a 403.
import { computed, reactive, ref, watch, onMounted } from "vue";
import { copyToClipboard, useQuasar } from "quasar";
import { useStore } from "vuex";
import {
  fetchVault,
  removeCredential,
  removeDocument,
  revealCredential,
} from "@/api/vault";
import { notifyError, notifySuccess } from "@/utils/notify";
import { relativeTime } from "@/utils/format";
import { isWebUrl } from "@/utils/helpers";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import RevealSecret from "@/components/vault/RevealSecret.vue";
import DocumentForm from "@/components/vault/DocumentForm.vue";
import CredentialForm from "@/components/vault/CredentialForm.vue";

const props = defineProps({
  // client | site | agent
  scope: { type: String, required: true },
  // client/site pk or agent_id
  scopeKey: { type: [String, Number], required: true },
});

const NOUN = { client: "client", site: "site", agent: "device" };
const INHERIT_TEXT = {
  client: "Its sites and devices show them too.",
  site: "Its devices show them too, items of the client show here read-only.",
  agent: "Items of its site and client show here read-only.",
};
const columns = [
  { name: "name", label: "Name", field: "name", align: "left" },
  { name: "username", label: "User name", field: "username", align: "left" },
  { name: "secret", label: "Secret", field: "id", align: "left" },
  { name: "url", label: "Address", field: "url", align: "left" },
  { name: "notes", label: "Notes", field: "notes", align: "left" },
  { name: "actions", label: "", field: "id", align: "right" },
];

const $q = useQuasar();
const store = useStore();
const formatDate = computed(() => store.getters.formatDate);
const noun = computed(() => NOUN[props.scope]);

const section = ref("documents");
const documents = ref([]);
const credentials = ref([]);
const loading = ref(false);
const loaded = ref(false);
const error = ref("");
const selectedId = ref(null);
const canWrite = reactive({ documents: false, credentials: false });
const canViewCredentials = ref(true);
const canViewDocuments = ref(true);
let request = 0;

const current = computed(
  () =>
    documents.value.find((d) => d.id === selectedId.value) ||
    documents.value[0],
);

// the list says "admin · 2 days ago", the read pane the full date
function updated(item, short = false) {
  const by = item.modified_by || item.created_by;
  const at = item.modified_time || item.created_time;
  if (short) return [by, at && relativeTime(at)].filter(Boolean).join(" · ");
  return [by && `Updated by ${by}`, at && formatDate.value(at)]
    .filter(Boolean)
    .join(" · ");
}

async function load() {
  const key = props.scopeKey;
  const mine = ++request;
  loading.value = true;
  try {
    const data = await fetchVault(props.scope, key);
    if (mine !== request) return;
    // pinned first, otherwise the server order (own items, then inherited)
    documents.value = [...data.documents].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned),
    );
    credentials.value = data.credentials;
    canWrite.documents = !!data.can?.manage_documents;
    canWrite.credentials = !!data.can?.manage_credentials;
    canViewCredentials.value = data.can?.view_credentials !== false;
    canViewDocuments.value = data.can?.view_documents !== false;
    loaded.value = true;
    error.value = "";
  } catch (e) {
    if (mine !== request) return;
    error.value =
      e?.response?.status === 403
        ? `Your role has no access to the vault of this ${noun.value}.`
        : "The vault could not be loaded.";
  } finally {
    if (mine === request) loading.value = false;
  }
}

function forbidden(kind) {
  canWrite[kind] = false;
}

function editDocument(doc) {
  $q.dialog({
    component: DocumentForm,
    componentProps: {
      doc,
      scope: props.scope,
      scopeKey: props.scopeKey,
      onForbidden: () => forbidden("documents"),
    },
  }).onOk((saved) => {
    selectedId.value = saved?.id ?? selectedId.value;
    load();
  });
}

function editCredential(credential) {
  $q.dialog({
    component: CredentialForm,
    componentProps: {
      credential,
      scope: props.scope,
      scopeKey: props.scopeKey,
      onForbidden: () => forbidden("credentials"),
    },
  }).onOk(load);
}

function confirmDelete(name, message, remove, kind) {
  $q.dialog({
    title: `Delete ${name}?`,
    message,
    cancel: { flat: true, noCaps: true, label: "Cancel" },
    ok: { unelevated: true, noCaps: true, color: "negative", label: "Delete" },
  }).onOk(async () => {
    try {
      await remove();
      notifySuccess(`${name} was deleted`);
      load();
    } catch (e) {
      if (e?.response?.status === 403) forbidden(kind);
    }
  });
}

function deleteDocument(doc) {
  confirmDelete(
    doc.title,
    "The document is removed for everyone. This cannot be undone.",
    () => removeDocument(doc.id),
    "documents",
  );
}

function deleteCredential(cred) {
  confirmDelete(
    cred.name,
    "The credential and its stored secret are removed. This cannot be undone.",
    () => removeCredential(cred.id),
    "credentials",
  );
}

function copy(text, what) {
  copyToClipboard(text)
    .then(() => notifySuccess(`${what} copied`))
    .catch(() => notifyError("Unable to copy to the clipboard"));
}

watch(
  () => [props.scope, props.scopeKey],
  () => {
    documents.value = [];
    credentials.value = [];
    loaded.value = false;
    error.value = "";
    selectedId.value = null;
    canWrite.documents = canWrite.credentials = false;
    canViewCredentials.value = true;
    canViewDocuments.value = true;
    load();
  },
);
onMounted(load);
</script>

<style scoped>
.vault-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  color: var(--rmm-text);
  background: var(--rmm-bg);
}

.vault-panel__bar {
  display: flex;
  min-height: 44px;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border-bottom: 1px solid var(--rmm-border);
  background: var(--rmm-surface);
}

.vault-panel__tabs {
  min-width: 0;
}

.vault-panel__tabs :deep(.q-tab) {
  min-height: 43px;
  padding: 0 12px;
  color: var(--rmm-text-muted);
}

.vault-panel__tabs :deep(.q-tab--active) {
  color: var(--rmm-accent-text);
}

.vault-panel__count {
  min-width: 22px;
  margin-left: 6px;
  padding: 0 7px;
  border-radius: 999px;
  color: var(--rmm-text-muted);
  background: var(--rmm-surface-3);
  font-size: var(--rmm-fs-xs);
  line-height: 20px;
  text-align: center;
}

.vault-panel__primary {
  padding: 2px 10px;
}

.vault-panel__body {
  position: relative;
  min-height: 200px;
  flex: 1 1 auto;
  overflow: auto;
}

.vault-docs {
  display: flex;
  height: 100%;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
}

.vault-docs__list {
  max-height: 100%;
  flex: 0 1 300px;
  min-width: 220px;
  overflow-y: auto;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
}

.vault-docs__list :deep(.q-item) {
  min-height: 52px;
  color: var(--rmm-text);
}

.vault-docs__item--active {
  background: var(--rmm-accent-soft);
  box-shadow: inset 3px 0 var(--rmm-accent);
}

/* muted grey drops under 4.5:1 on the tint */
.vault-docs__item--active .q-item__label--caption {
  color: var(--rmm-accent-text);
}

.vault-docs__from {
  min-height: 18px;
  margin-right: 4px;
}

.vault-docs__item-title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vault-docs__read {
  display: flex;
  max-height: 100%;
  min-width: 0;
  flex: 1 1 360px;
  flex-direction: column;
  border: 1px solid var(--rmm-border);
  border-radius: var(--rmm-radius);
  background: var(--rmm-surface);
}

.vault-docs__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 0;
}

.vault-docs__title {
  min-width: 0;
  margin: 0;
  font-size: var(--rmm-fs-lg);
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.vault-docs__meta {
  padding: 2px 12px 8px;
  border-bottom: 1px solid var(--rmm-border);
  font-size: var(--rmm-fs-xs);
}

.vault-docs__body {
  min-height: 0;
  flex: 1 1 auto;
  margin: 0;
  padding: 12px;
  overflow: auto;
  font-family: inherit;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.vault-creds {
  background: transparent;
}

.vault-creds td {
  white-space: nowrap;
}

.vault-creds__url,
.vault-creds__notes {
  max-width: 220px;
}
</style>
