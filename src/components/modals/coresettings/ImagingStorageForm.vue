<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div>
    <SettingsPanelHeader
      title="System Images"
      text="Folder on the ULRMM server that stores the system image backups of your devices. Change it here when the disk is mounted somewhere else."
    >
      <q-btn
        unelevated
        no-caps
        color="primary"
        label="Save"
        :disable="!info || !path.trim()"
        :loading="saving"
        @click="save(path.trim(), startOffer && startNew)"
      />
    </SettingsPanelHeader>
    <div v-if="loading" class="q-py-md rmm-muted" role="status">
      <q-spinner size="1em" class="q-mr-sm" />Loading image storage...
    </div>
    <div v-else-if="!info" class="q-py-md">
      <div class="rmm-muted q-mb-sm">{{ errorText }}</div>
      <q-btn
        dense
        no-caps
        outline
        color="primary"
        label="Retry"
        @click="load"
      />
    </div>
    <template v-else>
      <q-banner
        v-if="!info.configured"
        dense
        rounded
        class="rmm-banner-warning q-my-sm"
        role="status"
      >
        <template v-slot:avatar>
          <q-icon name="warning_amber" color="warning" />
        </template>
        The current folder is not ready, so devices cannot store system images
        yet. The checks below show what is missing.
        <div v-if="info.problem">{{ info.problem }}</div>
        <div v-if="info.ok">
          This folder holds the stored images. Save to confirm it as the store.
        </div>
      </q-banner>
      <q-card-section>
        <div>
          Current folder <code>{{ info.current }}</code>
          <span class="rmm-muted">
            ·
            {{
              info.source === "dashboard" ? "set here" : "server default"
            }}</span
          >
        </div>
        <div v-if="info.configured" class="imgstore-hint">
          {{ fmtBytes(info.free_bytes) }} free of
          {{ fmtBytes(info.total_bytes) }}. Backups wait while less than
          {{ fmtBytes(info.reserve_bytes) }} would stay free.
        </div>
        <div class="imgstore-hint">
          {{ info.points }} stored image
          {{ info.points === 1 ? "point" : "points" }}.
          <template v-if="info.source === 'dashboard'">
            Server default: <code>{{ info.server_default }}</code>
          </template>
        </div>
        <q-btn
          v-if="info.source === 'dashboard'"
          flat
          dense
          no-caps
          class="q-mt-xs"
          label="Use server default"
          :disable="saving"
          @click="save('')"
        />
      </q-card-section>
      <q-card-section v-if="info.docker" class="imgstore-hint">
        The folder is inside the containers. To use another disk set
        <code>IMAGING_VOLUME</code> in <code>.env</code> and run
        <code>docker compose up -d</code>.
      </q-card-section>
      <q-card-section class="row items-start q-col-gutter-sm">
        <div class="col">
          <q-input
            v-model="path"
            outlined
            dense
            label="New folder"
            hint="Absolute path on the ULRMM server, e.g. /mnt/backup/rmmimages"
            input-class="rmm-mono"
            :error="!!pathError"
            :error-message="pathError"
            @update:model-value="pathError = ''"
          />
        </div>
        <div class="col-auto">
          <q-btn
            outline
            no-caps
            color="primary"
            label="Check"
            :disable="!path.trim()"
            :loading="checking"
            @click="check()"
          />
        </div>
      </q-card-section>
      <q-card-section v-if="shown">
        <div class="text-subtitle2">
          Checks for <code>{{ shown.path }}</code>
        </div>
        <ul class="imgstore-checks">
          <li v-for="c in shown.checks" :key="c.key">
            <q-icon
              :name="c.ok ? 'check_circle' : 'cancel'"
              :color="c.ok ? 'positive' : 'negative'"
              class="q-mr-xs"
            />
            <span class="sr-only">{{ c.ok ? "Passed:" : "Failed:" }}</span>
            {{ c.text }}
          </li>
        </ul>
        <div class="imgstore-hint">
          <template v-if="shown.ok">
            Ready. {{ fmtBytes(shown.free_bytes) }} free of
            {{ fmtBytes(shown.total_bytes) }}.
            <template v-if="shown.older_copy">
              This is an older copy of the store: points whose data it lacks
              fail when they are checked.
            </template>
          </template>
          <template v-else>Not ready yet.</template>
        </div>
        <q-banner
          v-if="startOffer"
          dense
          rounded
          class="rmm-banner-warning q-mt-sm"
          role="status"
        >
          <template v-slot:avatar>
            <q-icon name="warning_amber" color="warning" />
          </template>
          The current store cannot be read and this folder does not hold its
          backups. If its disk is only not mounted, mount it and reload this
          page instead. If the disk is lost, you can start a new, empty store
          here.
          {{
            shown.points === 0
              ? "The stored backup data becomes"
              : shown.points === 1
                ? "The 1 stored point becomes"
                : `All ${shown.points} stored points become`
          }}
          unusable; this cannot be undone.
          <div>
            <q-checkbox
              v-model="startNew"
              dense
              label="Start a new store and retire the stored points"
            />
          </div>
        </q-banner>
        <q-input
          v-if="shown.fix"
          outlined
          dense
          readonly
          autogrow
          type="textarea"
          class="q-mt-sm"
          :model-value="shown.fix"
          label="Command to fix it"
          input-class="rmm-mono"
          hint="Run it on the ULRMM server, then check again"
        >
          <template v-slot:append>
            <q-btn
              round
              dense
              flat
              size="sm"
              icon="content_copy"
              aria-label="Copy command"
              @click="copyOutput(shown.fix)"
            >
              <q-tooltip>Copy command</q-tooltip>
            </q-btn>
          </template>
        </q-input>
      </q-card-section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useQuasar } from "quasar";
import { endpoint } from "@/api/http";
import { serverErrors, stepUpCall } from "@/components/vault/stepUp";
import { fmtBytes } from "@/utils/format";
import { copyOutput } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";
import SettingsPanelHeader from "@/components/modals/coresettings/SettingsPanelHeader.vue";

interface StorageCheck {
  key: string;
  ok: boolean;
  text: string;
}

interface Storage {
  path: string;
  current: string;
  source: "dashboard" | "server";
  server_default: string;
  configured: boolean;
  problem: string;
  ok: boolean;
  checks: StorageCheck[];
  fix: string;
  free_bytes: number | null;
  total_bytes: number | null;
  reserve_bytes: number;
  points: number;
  docker: boolean;
  can_start_new?: boolean;
  older_copy?: boolean;
}

const $q = useQuasar();
const api = endpoint("/imaging/storage");
const info = ref<Storage | null>(null);
const checked = ref<Storage | null>(null);
const path = ref("");
const pathError = ref("");
const loading = ref(false);
const checking = ref(false);
const saving = ref(false);
const startNew = ref(false);
const errorText = ref("Image storage could not be loaded.");

// the last checked folder, else the current one while it is not usable
const shown = computed(
  () => checked.value ?? (info.value?.configured ? null : info.value),
);
// only for the folder that is still in the input
const startOffer = computed(
  () =>
    !!checked.value?.can_start_new && checked.value.path === path.value.trim(),
);

async function load() {
  loading.value = true;
  try {
    info.value = await api.get<Storage>("/");
    // a replacement disk at the same place, or the store on a new file system
    // id: offer the new store or the confirmation right away
    if (
      info.value.can_start_new ||
      (!info.value.configured && info.value.ok)
    ) {
      path.value = info.value.current;
      checked.value = info.value;
    }
  } catch (e) {
    info.value = null;
    errorText.value =
      (e as { response?: { status?: number } })?.response?.status === 403
        ? "Your role cannot view the image storage."
        : "Image storage could not be loaded.";
  } finally {
    loading.value = false;
  }
}

async function check(target = path.value.trim()) {
  if (!target) return;
  checking.value = true;
  startNew.value = false;
  try {
    checked.value = await api.get<Storage>("/", { params: { path: target } });
  } catch {
    // the response interceptor shows the error
  } finally {
    checking.value = false;
  }
}

// "" goes back to the server default
async function save(target: string, start = false) {
  saving.value = true;
  pathError.value = "";
  try {
    const saved = await stepUpCall($q, (config: { silent: boolean }) =>
      api.put<Storage>(
        "/",
        start ? { path: target, start_new: true } : { path: target },
        config,
      ),
    );
    if (!saved) return;
    info.value = saved;
    checked.value = null;
    startNew.value = false;
    path.value = "";
    notifySuccess(target ? "Image folder saved" : "Server default restored");
  } catch (e) {
    const { fields, message } = serverErrors(e);
    if (target && fields.path) pathError.value = String(fields.path);
    else notifyError(message);
    // every check and the fix command for the refused folder
    if ((e as { response?: { status?: number } })?.response?.status === 400)
      await check(target || info.value?.server_default);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.imgstore-hint {
  margin-top: 4px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
}

.imgstore-checks {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}

.imgstore-checks li {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
}
</style>
