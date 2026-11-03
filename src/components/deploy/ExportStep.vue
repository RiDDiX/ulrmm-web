<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <div class="deploy-step">
    <h2 id="deploy-step-4" tabindex="-1" class="deploy-step__title">
      Preview &amp; export
    </h2>
    <p class="deploy-step__lead">
      {{
        deployment.name || `${deployment.client_name} / ${deployment.site_name}`
      }}
      · valid until {{ formatDate(deployment.expiry) }}. Deleting the deployment
      revokes its links and tokens.
    </p>

    <template v-if="installer">
      <q-banner
        v-if="!matrix.dist_ok"
        class="bg-warning q-mb-md"
        role="status"
        rounded
        dense
      >
        <template #avatar><q-icon name="warning" /></template>
        The agent build does not carry the current enrollment key yet. Run
        update.sh on the server; until then these links answer with an error.
      </q-banner>

      <section
        class="rmm-card deploy-export"
        aria-labelledby="deploy-link-title"
      >
        <div class="rmm-card__header">
          <h3 id="deploy-link-title" class="rmm-card__title">
            {{ installer.label }}
          </h3>
        </div>
        <div class="rmm-card__body column q-gutter-y-sm">
          <div class="deploy-line">
            <code class="deploy-line__code">{{ link }}</code>
            <q-btn
              flat
              dense
              no-caps
              icon="content_copy"
              label="Copy link"
              @click="copyOutput(link)"
            />
            <q-btn
              unelevated
              dense
              no-caps
              color="primary"
              icon="download"
              label="Download"
              :href="link"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
          <div class="deploy-field__note">
            A public link: anyone who has it can enroll a device into this site
            until it expires.
          </div>
        </div>
      </section>
    </template>

    <fieldset v-if="!installer && target && hasIso" class="deploy-choices">
      <legend class="deploy-legend">What to build</legend>
      <div class="deploy-cards">
        <label v-for="m in MODES" :key="m.id" class="deploy-option">
          <input
            v-model="mode"
            :value="m.id"
            type="radio"
            name="deploy-mode"
            class="sr-only"
          />
          <q-icon :name="m.icon" size="24px" aria-hidden="true" />
          <span class="deploy-option__text">
            <span class="deploy-option__title">{{ m.title }}</span>
            <span class="deploy-option__meta">{{ m.meta }}</span>
          </span>
          <q-icon
            :name="
              mode === m.id ? 'radio_button_checked' : 'radio_button_unchecked'
            "
            class="deploy-option__mark"
            size="20px"
            aria-hidden="true"
          />
        </label>
      </div>
    </fieldset>

    <section
      v-if="!installer && target && hasIso && mode === 'seed'"
      class="rmm-card deploy-export"
      aria-labelledby="deploy-seed-title"
    >
      <div class="rmm-card__header">
        <h3 id="deploy-seed-title" class="rmm-card__title">Instant seed ISO</h3>
        <HelpTip
          text="A small ISO you attach as a second drive. The installer finds the answer file by its volume label (AUTOUNATTEND, OEMDRV or CIDATA), so the stock install media stays untouched."
        />
      </div>
      <div class="rmm-card__body column q-gutter-y-sm">
        <div v-if="planError" class="text-negative" role="alert">
          {{ planError }}
        </div>
        <div v-else-if="plan" class="deploy-detail">
          <div>
            Volume label <code>{{ plan.label || "none" }}</code> ·
            {{ plan.agent ? `agent ${plan.agent}` : "no agent build" }}
          </div>
          <pre v-if="plan.files.length" class="deploy-command q-mt-sm">{{
            plan.files.join("\n")
          }}</pre>
          <q-banner
            v-for="n in plan.notes"
            :key="n"
            class="bg-info q-mt-sm"
            role="status"
            rounded
            dense
          >
            <template #avatar><q-icon name="info" /></template>
            {{ n }}
          </q-banner>
        </div>

        <q-banner
          v-if="seedError"
          class="bg-negative"
          role="alert"
          rounded
          dense
        >
          <template #avatar><q-icon name="error_outline" /></template>
          {{ seedError }}
        </q-banner>

        <div class="row items-center q-gutter-sm">
          <q-btn
            unelevated
            no-caps
            color="primary"
            icon="album"
            label="Download seed ISO"
            :loading="busy === 'seed'"
            :disable="!!busy"
            @click="downloadSeed"
          />
        </div>
        <div v-if="busy === 'seed'" style="max-width: 420px">
          <q-linear-progress
            rounded
            size="6px"
            color="primary"
            :value="progress.value ?? undefined"
            :indeterminate="progress.value === null"
            :aria-label="progress.text"
          />
          <div class="text-caption rmm-muted q-mt-xs" aria-live="polite">
            {{ progress.text }}
          </div>
        </div>
        <div v-if="seedSha" class="deploy-line">
          <span class="deploy-field__note">SHA-256</span>
          <code class="deploy-line__code">{{ seedSha }}</code>
          <q-btn
            flat
            dense
            no-caps
            icon="content_copy"
            label="Copy"
            aria-label="Copy the SHA-256 of the seed ISO"
            @click="copyOutput(seedSha)"
          />
        </div>
      </div>
    </section>

    <IsoBuild
      v-if="!installer && target && hasIso && mode === 'full'"
      :request="request"
      :target="target"
    />

    <section
      v-for="c in commands"
      :key="c.id"
      class="rmm-card deploy-export"
      :aria-labelledby="`deploy-cmd-${c.id}`"
    >
      <div class="rmm-card__header">
        <h3 :id="`deploy-cmd-${c.id}`" class="rmm-card__title">
          {{ c.title }}
        </h3>
        <q-space />
        <q-btn
          flat
          dense
          no-caps
          icon="content_copy"
          label="Copy"
          :aria-label="`Copy: ${c.title}`"
          @click="copyOutput(c.text)"
        />
      </div>
      <div class="rmm-card__body">
        <pre class="deploy-command">{{ c.text }}</pre>
        <div class="deploy-field__note">{{ c.hint }}</div>
      </div>
    </section>

    <template v-if="!installer && result">
      <q-banner v-if="generated" class="bg-info q-mb-md" role="status" rounded>
        <template #avatar><q-icon name="key" /></template>
        <div class="text-weight-medium">Generated admin password</div>
        <div class="deploy-line q-mt-xs">
          <code class="deploy-line__code">{{
            showGenerated ? generated : "********************"
          }}</code>
          <q-btn
            flat
            dense
            no-caps
            :icon="showGenerated ? 'visibility_off' : 'visibility'"
            :label="showGenerated ? 'Hide' : 'Show'"
            @click="showGenerated = !showGenerated"
          />
          <q-btn
            flat
            dense
            no-caps
            icon="content_copy"
            label="Copy"
            aria-label="Copy the generated admin password"
            @click="copyOutput(generated)"
          />
        </div>
        <div class="deploy-field__note q-mt-xs">
          Shown once and stored nowhere: it is only in the files you download
          now. LAPS takes the account over after enrollment when it is on for
          the site.
        </div>
      </q-banner>

      <q-banner
        v-if="result.warnings.length"
        class="bg-warning q-mb-md"
        role="status"
        rounded
        dense
      >
        <template #avatar><q-icon name="warning" /></template>
        <div v-for="w in result.warnings" :key="w">{{ w }}</div>
      </q-banner>

      <q-banner
        v-if="downloadError"
        class="bg-negative q-mb-md"
        role="alert"
        rounded
        dense
      >
        <template #avatar><q-icon name="error_outline" /></template>
        {{ downloadError }}
      </q-banner>

      <section
        class="rmm-card deploy-export"
        aria-labelledby="deploy-files-title"
      >
        <div class="rmm-card__header">
          <q-icon name="description" size="18px" aria-hidden="true" />
          <h3 id="deploy-files-title" class="rmm-card__title">
            {{
              mode === "agent" || !hasIso
                ? "Answer files"
                : "Files only, without an ISO"
            }}
          </h3>
        </div>
        <div class="rmm-card__body">
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-btn
              v-if="result.files.length === 1"
              unelevated
              no-caps
              color="primary"
              icon="download"
              :label="`Download ${result.files[0].name}`"
              :loading="busy === 'file'"
              :disable="!!busy"
              @click="download(false)"
            />
            <q-btn
              :unelevated="result.files.length !== 1"
              :outline="result.files.length === 1"
              no-caps
              color="primary"
              icon="folder_zip"
              label="Download bundle (zip)"
              :loading="busy === 'bundle'"
              :disable="!!busy"
              @click="download(true)"
            />
            <HelpTip
              text="The bundle adds the inject scripts that put the answer file onto the install media, and a README.txt with the exact steps. Nothing is stored on the server."
            />
          </div>
          <div
            v-if="busy && busy !== 'seed'"
            class="q-mb-sm"
            style="max-width: 420px"
          >
            <q-linear-progress
              rounded
              size="6px"
              color="primary"
              :value="progress.value ?? undefined"
              :indeterminate="progress.value === null"
              :aria-label="progress.text"
            />
            <div class="text-caption rmm-muted q-mt-xs" role="status">
              {{ progress.text }}
            </div>
          </div>

          <q-tabs
            v-model="tab"
            dense
            align="left"
            no-caps
            inline-label
            class="deploy-tabs"
          >
            <q-tab
              v-for="f in result.files"
              :key="f.name"
              :name="f.name"
              :label="f.name"
            />
          </q-tabs>
          <q-tab-panels v-model="tab" class="deploy-panels">
            <q-tab-panel
              v-for="f in result.files"
              :key="f.name"
              :name="f.name"
              class="q-pa-none q-pt-sm"
            >
              <CodePreview
                :content="f.content"
                :language="f.language"
                :label="`Preview of ${f.name}, secrets masked`"
              />
            </q-tab-panel>
          </q-tab-panels>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { exportFile, useQuasar } from "quasar";
import { useStore } from "vuex";
import { ensureConsoleStepUp } from "@/composables/accounts";
import CodePreview from "@/components/deploy/CodePreview.vue";
import IsoBuild from "@/components/deploy/IsoBuild.vue";
import HelpTip from "@/components/ui/HelpTip.vue";
import { copyOutput } from "@/utils/helpers";
import { notifyError, notifySuccess } from "@/utils/notify";
import {
  curlCommand,
  exportName,
  failureText,
  installerUrl,
  retryAfterStepUp,
  verifiedCommand,
  windowsCommand,
} from "@/utils/deploy";
import {
  downloadSeedIso,
  downloadTarget,
  planIso,
  type Deployment,
  type InstallerKind,
  type IsoPlan,
  type Matrix,
  type RenderRequest,
  type RenderResult,
  type Target,
} from "@/api/deploy";

const props = defineProps<{
  deployment: Deployment;
  matrix: Matrix;
  installer: InstallerKind | null;
  arch: string;
  target: Target | null;
  profile: Record<string, unknown>;
  result: RenderResult | null;
  generated: string;
}>();

const $q = useQuasar();
const store = useStore();
const formatDate = (value: string | null) => store.getters.formatDate(value);

const link = computed(() =>
  props.installer
    ? installerUrl(props.deployment.url, props.installer.fmt, props.arch)
    : "",
);

const winArch = computed(() => {
  const ps1 = props.matrix.installers.find((i) => i.fmt === "ps1");
  return ps1?.arches.includes(props.arch) ? props.arch : "amd64";
});
// the shell lines follow the chosen script's architecture, else uname -m
const shArch = computed(() =>
  props.installer?.fmt === "sh" ? props.arch : "",
);

const MODES = [
  {
    id: "full",
    icon: "album",
    title: "Full bootable ISO",
    meta: "Base image from the library with the answer file and agent",
  },
  {
    id: "seed",
    icon: "usb",
    title: "Instant seed ISO",
    meta: "Small second drive: AUTOUNATTEND, OEMDRV or CIDATA",
  },
  {
    id: "agent",
    icon: "terminal",
    title: "Agent-only installer",
    meta: "Install commands for a machine that is already running",
  },
] as const;
type Mode = (typeof MODES)[number]["id"];

const mode = ref<Mode>("seed");

// a target without an installer image (Batocera) only hands out its files
const hasIso = computed(() => props.target?.capabilities?.iso_image !== false);

// installer targets always show their commands, OS targets only in agent mode
const plat = computed(
  () =>
    props.installer?.plat ??
    (mode.value === "agent" ? props.target?.family : undefined),
);

const request = computed<RenderRequest>(() => ({
  deployment: props.deployment.id,
  target: props.target?.id ?? "",
  profile: props.profile,
}));

const commands = computed(() => {
  const base = props.deployment.url;
  if (plat.value === "windows")
    return [
      {
        id: "windows",
        title: "Windows one-liner",
        text: windowsCommand(installerUrl(base, "ps1", winArch.value)),
        hint: "Run in an elevated PowerShell or Command Prompt. It downloads the setup, checks its SHA-256 and enrolls the device.",
      },
    ];
  if (plat.value !== "linux") return [];
  const sh = installerUrl(base, "sh", shArch.value);
  return [
    {
      id: "curl",
      title: "Install with curl",
      text: curlCommand(sh),
      hint: "Run on the device as a user with sudo rights.",
    },
    {
      id: "verified",
      title: "Install with a verified signature",
      text: verifiedCommand(
        sh,
        installerUrl(base, "sig", shArch.value),
        props.matrix.pubkey_pem,
      ),
      hint: `Runs the script only when OpenSSL 3 verifies its Ed25519 signature against the enrollment key (key id ${props.matrix.kid}).`,
    },
  ];
});

const tab = ref("");
const showGenerated = ref(false);
const busy = ref<"" | "file" | "bundle" | "seed">("");
const downloadError = ref("");
// value is null until the server sends a Content-Length
const progress = ref<{ value: number | null; text: string }>({
  value: null,
  text: "Preparing the download...",
});

watch(
  () => props.result,
  (result) => {
    tab.value = result?.files[0]?.name ?? "";
    showGenerated.value = false;
    downloadError.value = "";
  },
  { immediate: true },
);

const plan = ref<IsoPlan | null>(null);
const planError = ref("");
const seedError = ref("");
const seedSha = ref("");
let planSeq = 0;

async function loadPlan() {
  const seq = ++planSeq;
  plan.value = null;
  planError.value = "";
  seedError.value = "";
  seedSha.value = "";
  if (
    props.installer ||
    !props.target ||
    !hasIso.value ||
    mode.value !== "seed"
  )
    return;
  try {
    const next = await planIso({ ...request.value, mode: "seed", base: null });
    if (seq === planSeq) plan.value = next;
  } catch (e) {
    if (seq === planSeq) planError.value = await failureText(e);
  }
}

watch([mode, () => props.target?.id], loadPlan, { immediate: true });

// a proxy or CORS can hide X-Sha256; a seed ISO is small enough to hash here
async function sha256Hex(blob: Blob) {
  if (!globalThis.crypto?.subtle) return "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function downloadSeed() {
  const target = props.target;
  if (!target) return;
  busy.value = "seed";
  seedError.value = "";
  seedSha.value = "";
  progress.value = { value: null, text: "Preparing the download..." };
  try {
    const seed = await retryAfterStepUp(
      () =>
        downloadSeedIso(request.value, (loaded, total) => {
          progress.value = total
            ? {
                value: loaded / total,
                text: `Downloading, ${Math.round((loaded / total) * 100)}%`,
              }
            : { value: null, text: "Downloading..." };
        }),
      () => ensureConsoleStepUp($q),
    );
    const name = `${target.id.replace(/[^\w.-]+/g, "-")}-seed.iso`;
    if (exportFile(name, seed.blob) === true)
      notifySuccess(`${name} downloaded`);
    else notifyError("The browser blocked the download.");
    seedSha.value = seed.sha256 || (await sha256Hex(seed.blob));
  } catch (e) {
    seedError.value = await failureText(e);
  }
  busy.value = "";
}

async function download(bundle: boolean) {
  const target = props.target;
  if (!target) return;
  busy.value = bundle ? "bundle" : "file";
  downloadError.value = "";
  progress.value = { value: null, text: "Preparing the download..." };
  try {
    const blob = await retryAfterStepUp(
      () =>
        downloadTarget(
          {
            deployment: props.deployment.id,
            target: target.id,
            profile: props.profile,
            bundle,
          },
          (loaded, total) => {
            progress.value = total
              ? {
                  value: loaded / total,
                  text: `Downloading, ${Math.round((loaded / total) * 100)}%`,
                }
              : { value: null, text: "Downloading..." };
          },
        ),
      () => ensureConsoleStepUp($q),
    );
    const name = exportName(
      [props.deployment.client_name, props.deployment.site_name, target.id],
      props.result?.files ?? [],
      blob.type,
      bundle,
    );
    const saved = exportFile(name, blob);
    if (saved === true) notifySuccess(`${name} downloaded`);
    else notifyError("The browser blocked the download.");
  } catch (e) {
    downloadError.value = await failureText(e);
  }
  busy.value = "";
}
</script>
