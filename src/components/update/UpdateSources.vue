<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card flat class="rmm-card">
    <div class="rmm-card__header">
      <div class="rmm-card__title">Release sources</div>
      <q-space />
      <q-btn
        flat
        dense
        no-caps
        icon="refresh"
        label="Re-check"
        :loading="loading"
        @click="load(true)"
      />
    </div>
    <div class="rmm-card__body">
      <div v-if="!data && loading" aria-busy="true">
        <q-skeleton v-for="n in 2" :key="n" height="36px" class="q-mb-sm" />
      </div>
      <div v-else-if="!data" class="rmm-muted">
        The source status could not be loaded.
      </div>
      <template v-else>
        <p class="us-active" role="status">
          <q-icon
            :name="data.active ? 'cloud_done' : 'cloud_off'"
            :color="data.active ? 'positive' : 'negative'"
            size="20px"
          />
          <span>{{ activeText }}</span>
        </p>
        <table class="us-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">State</th>
              <th scope="col">HTTP</th>
              <th scope="col">Latest</th>
              <th scope="col">Checked</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in data.sources" :key="s.name">
              <td>
                <div class="text-weight-medium">{{ label(s.name) }}</div>
                <div class="text-caption rmm-muted us-api">{{ s.api }}</div>
              </td>
              <td>
                <span
                  class="rmm-pill us-pill"
                  :class="s.ok ? 'rmm-pill--positive' : 'rmm-pill--negative'"
                  >{{ s.ok ? "ok" : "error" }}</span
                >
                <div v-if="!s.ok && s.error" class="text-caption us-error">
                  {{ s.error }}
                </div>
              </td>
              <td class="us-mono">{{ s.status ?? "–" }}</td>
              <td class="us-mono">{{ s.latest ?? "–" }}</td>
              <td class="text-caption">{{ when(s.checked_at) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="text-caption rmm-muted q-mt-sm">
          Release signing key id
          <span class="us-mono">{{ data.key_id }}</span>
        </div>
      </template>

      <section class="us-repos" aria-labelledby="us-repos-title">
        <div class="row items-center q-mb-xs">
          <h3 id="us-repos-title" class="us-repos__title">
            Additional repositories
          </h3>
          <q-space />
          <q-btn
            flat
            dense
            no-caps
            icon="add"
            label="Add repository"
            :disable="repos.length >= MAX_REPOS"
            @click="openForm(null)"
          />
        </div>
        <p class="text-caption rmm-muted q-mb-sm">
          For example an alpha repository for sponsors. Every source is asked
          and the newest release wins. A release from any source is only
          installed when its signature matches the key above.
        </p>
        <div v-if="!repos.length" class="rmm-muted text-caption">
          No additional repositories.
        </div>
        <ul v-else class="us-repo-list">
          <li v-for="r in repos" :key="r.id" class="us-repo">
            <div class="us-repo__main">
              <div class="text-weight-medium">{{ r.name }}</div>
              <div class="text-caption rmm-muted us-api">{{ r.repo_url }}</div>
              <div class="text-caption rmm-muted">
                {{ kindLabel(r.kind) }} ·
                {{ r.has_token ? "token stored" : "no token" }}
              </div>
            </div>
            <q-toggle
              :model-value="r.enabled"
              :disable="busy !== null"
              :aria-label="`Use ${r.name}`"
              @update:model-value="(v) => toggle(r, v)"
            />
            <q-btn
              flat
              round
              dense
              icon="edit"
              :aria-label="`Edit ${r.name}`"
              :disable="busy !== null"
              @click="openForm(r)"
            />
            <q-btn
              flat
              round
              dense
              icon="delete"
              :aria-label="`Remove ${r.name}`"
              :disable="busy !== null"
              @click="remove(r)"
            />
          </li>
        </ul>
      </section>
    </div>

    <q-dialog v-model="formOpen">
      <q-card class="us-form">
        <DialogHeader
          :title="editing ? `Edit ${editing.name}` : 'Add repository'"
          subtitle="A further GitHub, Gitea or Forgejo release source"
        />
        <q-form @submit.prevent="save">
          <q-card-section class="q-gutter-y-sm">
            <q-input
              v-model.trim="form.name"
              label="Name"
              outlined
              dense
              :disable="!!editing"
              hint="Lower-case letters, digits and dashes, e.g. alpha"
              :rules="[
                (v) => /^[a-z0-9][a-z0-9-]{0,31}$/.test(v) || 'Invalid name',
              ]"
            />
            <q-input
              v-model.trim="form.repo_url"
              label="Repository URL"
              outlined
              dense
              placeholder="https://github.com/owner/repository"
              hint="GitHub, Gitea or Forgejo, https only"
              :rules="[
                (v) =>
                  /^https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\/?$/.test(v) ||
                  'https://host/owner/repository',
              ]"
            />
            <q-input
              v-model.trim="form.token"
              label="Access token"
              type="password"
              outlined
              dense
              autocomplete="new-password"
              :placeholder="editing?.has_token ? 'unchanged' : ''"
              :disable="clearToken"
              hint="Only for private repositories, read access to its releases is enough"
            />
            <q-checkbox
              v-if="editing?.has_token"
              v-model="clearToken"
              label="Remove the stored token"
              dense
            />
            <q-toggle v-model="form.enabled" label="Use this repository" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup flat no-caps label="Cancel" />
            <q-btn
              type="submit"
              color="primary"
              no-caps
              label="Save"
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useQuasar } from "quasar";
import {
  addReleaseRepo,
  changeReleaseRepo,
  fetchReleaseRepos,
  fetchReleaseSources,
  removeReleaseRepo,
  type ReleaseRepo,
  type ReleaseRepoInput,
  type ReleaseSources,
} from "@/api/server";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import { withStepUp } from "@/components/vault/stepUp";
import { notifyError, notifySuccess } from "@/utils/notify";

const MAX_REPOS = 10;

const $q = useQuasar();
const data = ref<ReleaseSources | null>(null);
const loading = ref(false);
const repos = ref<ReleaseRepo[]>([]);
const busy = ref<number | null>(null);
const formOpen = ref(false);
const saving = ref(false);
const editing = ref<ReleaseRepo | null>(null);
const clearToken = ref(false);
const form = reactive({ name: "", repo_url: "", token: "", enabled: true });

const kindLabel = (kind: string | null) =>
  kind === "github" ? "GitHub" : kind === "gitea" ? "Gitea / Forgejo" : "–";

const label = (name: string) =>
  name === "github" ? "GitHub" : name === "gitea" ? "Gitea" : name;

const activeText = computed(() => {
  const d = data.value;
  if (!d?.active) return "No release source is reachable right now.";
  const first = d.sources[0];
  const base = `Releases are fetched from: ${label(d.active)}`;
  if (!first || d.active === first.name) return base;
  // the newest release wins, so this is no fallback order
  return first.ok
    ? `${base} (newest release)`
    : `${base} (${label(first.name)} unavailable)`;
});

function when(iso: string) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}

async function load(refresh = false) {
  loading.value = true;
  try {
    data.value = await fetchReleaseSources(refresh);
  } catch {
    notifyError("The release sources could not be checked.");
  } finally {
    loading.value = false;
  }
}

async function loadRepos() {
  try {
    repos.value = await fetchReleaseRepos();
  } catch {
    notifyError("The additional repositories could not be loaded.");
  }
}

function openForm(r: ReleaseRepo | null) {
  editing.value = r;
  clearToken.value = false;
  Object.assign(form, {
    name: r?.name ?? "",
    repo_url: r?.repo_url ?? "",
    token: "",
    enabled: r?.enabled ?? true,
  });
  formOpen.value = true;
}

// sources changed: reload the list and probe again
async function changed(message: string) {
  notifySuccess(message);
  await Promise.all([loadRepos(), load(true)]);
}

async function save() {
  const body: ReleaseRepoInput = {
    repo_url: form.repo_url,
    enabled: form.enabled,
  };
  // no token key keeps the stored one, an empty one removes it
  if (clearToken.value) body.token = "";
  else if (form.token) body.token = form.token;
  saving.value = true;
  try {
    const id = editing.value?.id;
    const done = await withStepUp($q, (config: { silent: boolean }) =>
      id === undefined
        ? addReleaseRepo(
            { ...body, name: form.name, position: repos.value.length },
            config,
          )
        : changeReleaseRepo(id, body, config),
    );
    if (done === null) return;
    formOpen.value = false;
    form.token = "";
    await changed(id === undefined ? "Repository added." : "Repository saved.");
  } finally {
    saving.value = false;
  }
}

async function toggle(r: ReleaseRepo, enabled: boolean) {
  busy.value = r.id;
  try {
    const done = await withStepUp($q, (config: { silent: boolean }) =>
      changeReleaseRepo(r.id, { enabled }, config),
    );
    if (done !== null)
      await changed(enabled ? `${r.name} is used.` : `${r.name} is paused.`);
  } finally {
    busy.value = null;
  }
}

function remove(r: ReleaseRepo) {
  $q.dialog({
    title: `Remove ${r.name}?`,
    message: "Its stored token is deleted as well.",
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    busy.value = r.id;
    try {
      const done = await withStepUp($q, (config: { silent: boolean }) =>
        removeReleaseRepo(r.id, config),
      );
      if (done !== null) await changed(`${r.name} was removed.`);
    } finally {
      busy.value = null;
    }
  });
}

defineExpose({ load, data });
onMounted(() => {
  load();
  loadRepos();
});
</script>

<style scoped>
.us-active {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-weight: 500;
}
.us-table {
  width: 100%;
  border-collapse: collapse;
}
.us-table th {
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  font-weight: 500;
  text-align: left;
}
.us-table th,
.us-table td {
  padding: 8px 8px 8px 0;
  border-bottom: 1px solid var(--rmm-border);
  vertical-align: top;
}
.us-table tbody tr:last-child td {
  border-bottom: 0;
}
.us-api {
  word-break: break-all;
}
.us-mono {
  font-family: var(--rmm-mono);
  font-size: var(--rmm-fs-sm);
}
/* the source keeps room for its URL; a long error wraps under the pill */
.us-table td:first-child {
  width: 45%;
}
.us-pill {
  white-space: nowrap;
}
.us-error {
  margin-top: 4px;
  color: var(--rmm-status-negative);
  overflow-wrap: anywhere;
}
.us-repos {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--rmm-border);
}
.us-repos__title {
  margin: 0;
  font-size: var(--rmm-fs-sm);
  font-weight: 600;
}
.us-repo-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.us-repo {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--rmm-border);
}
.us-repo:last-child {
  border-bottom: 0;
}
.us-repo__main {
  flex: 1;
  min-width: 0;
}
.us-form {
  width: min(520px, 92vw);
}
@media (max-width: 599px) {
  .us-table th:nth-child(5),
  .us-table td:nth-child(5) {
    display: none;
  }
}
</style>
