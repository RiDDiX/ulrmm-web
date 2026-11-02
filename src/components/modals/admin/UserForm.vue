<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rmm-dialog--md">
      <DialogHeader
        :title="title"
        :subtitle="
          user
            ? 'Change the account details, role and sign-in access'
            : 'Creates a local account that signs in with a password and two-factor code'
        "
      />
      <q-form @submit="save">
        <div class="scroll" style="max-height: 65vh">
          <q-card-section class="q-pb-none">
            <div class="user-form__section">Account</div>
            <div class="row q-col-gutter-sm">
              <template v-for="f in accountFields" :key="f.key">
                <PasswordField
                  v-if="f.secret"
                  :model-value="f.get()"
                  v-model:shown="shown"
                  :label="f.label"
                  :rules="f.rules"
                  :class="f.cols"
                  hide-bottom-space
                  lazy-rules
                  @update:model-value="f.set"
                />
                <q-input
                  v-else
                  v-model="localUser[f.key]"
                  :label="f.label"
                  :rules="f.rules"
                  :class="f.cols"
                  outlined
                  dense
                  hide-bottom-space
                  lazy-rules
                />
              </template>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="user-form__section">Access</div>
            <div
              v-if="roles.length === 0"
              class="user-form__notice text-caption"
              role="status"
            >
              No roles have been created yet. Create one under Settings &gt;
              Roles, then assign it here.
            </div>
            <q-select
              v-else
              v-model="localUser.role"
              :options="roles"
              label="Role"
              hint="Decides what the user can see and do; without a role a user has no permissions (except the built-in superuser)"
              outlined
              dense
              options-dense
              map-options
              emit-value
              clearable
            />
            <div
              v-for="(flag, i) in accessFlags"
              :key="flag.key"
              :class="i === 0 ? 'q-mt-md' : 'q-mt-sm'"
            >
              <q-checkbox
                v-model="localUser[flag.key]"
                :label="flag.label"
                :disable="isSelf"
              />
              <div class="user-form__hint">
                {{ isSelf ? flag.selfHint : flag.hint }}
              </div>
            </div>
          </q-card-section>
        </div>
        <FormActions :disable="!canSave" />
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "axios";
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useAuthStore } from "@/stores/auth";
import { askChangeCode } from "@/composables/accounts";
import { isValidEmail } from "@/utils/validation";
import { notifySuccess } from "@/utils/notify";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import FormActions from "@/core/ui/FormActions.vue";
import PasswordField from "@/components/modals/admin/PasswordField.vue";

const props = defineProps({ user: Object });
defineEmits([...useDialogPluginComponent.emits]);

const $q = useQuasar();
const auth = useAuthStore();
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

const title = props.user ? "Edit User" : "Add User";
// email is optional, but the server wants the key on create
const localUser = ref({
  email: "",
  is_active: true,
  block_dashboard_login: false,
  ...props.user,
});
const roles = ref([]);
const shown = ref(false);
const confirm = ref("");

const isSelf = computed(() => localUser.value.username === auth.username);

const required = [(val) => !!val || "*Required"];
const accountFields = computed(() => [
  {
    key: "username",
    label: "Username",
    cols: "col-12",
    rules: required,
  },
  ...(props.user
    ? []
    : [
        {
          key: "password",
          secret: true,
          label: "Password",
          cols: "col-12 col-sm-6",
          rules: required,
          get: () => localUser.value.password,
          set: (v) => (localUser.value.password = v),
        },
        {
          key: "confirm",
          secret: true,
          label: "Confirm password",
          cols: "col-12 col-sm-6",
          rules: [
            (val) =>
              val === localUser.value.password || "Passwords do not match",
          ],
          get: () => confirm.value,
          set: (v) => (confirm.value = v),
        },
      ]),
  {
    key: "email",
    label: "Email",
    cols: "col-12",
    rules: [(val) => !val || isValidEmail(val) || "Invalid email"],
  },
  { key: "first_name", label: "First Name", cols: "col-12 col-sm-6" },
  { key: "last_name", label: "Last Name", cols: "col-12 col-sm-6" },
]);

const accessFlags = [
  {
    key: "is_active",
    label: "Active",
    hint: "Inactive users cannot sign in, and their API keys stop working.",
    selfHint: "You cannot deactivate your own account.",
  },
  {
    key: "block_dashboard_login",
    label: "Deny Dashboard Logins",
    hint: "For API-only accounts: the user works through API keys and cannot sign in to the dashboard.",
    selfHint: "You cannot block dashboard logins for your own account.",
  },
];

const canSave = computed(() => {
  const u = localUser.value;
  if (props.user) return !!u.username;
  return !!u.username && !!u.password && u.password === confirm.value;
});

async function loadRoles() {
  const { data } = await axios.get("/accounts/roles/");
  roles.value = data.map((role) => ({ label: role.name, value: role.id }));
}

// role, active and dashboard login of another user, or a new user with a
// role, need the current code
function needsCode() {
  if (!props.user) return localUser.value.role != null;
  return (
    props.user.username !== auth.username &&
    ["role", "is_active", "block_dashboard_login"].some(
      (key) => localUser.value[key] !== props.user[key],
    )
  );
}

async function save() {
  let totp_code;
  if (needsCode()) {
    totp_code = await askChangeCode($q, { title });
    if (totp_code === null) return;
  }

  $q.loading.show();
  // read-only fields the server does not take back
  const body = { ...localUser.value };
  delete body.last_login;
  delete body.last_login_ip;

  try {
    if (props.user) {
      // the logged in user cannot change their own active state
      if (isSelf.value) {
        delete body.is_active;
        delete body.block_dashboard_login;
      }
      await axios.put(`/accounts/${body.id}/users/`, { ...body, totp_code });
      $q.loading.hide();
      onDialogOK();
      notifySuccess("User edited!");
    } else {
      const { data } = await axios.post("/accounts/users/", {
        ...body,
        totp_code,
      });
      $q.loading.hide();
      onDialogOK();
      notifySuccess(`User ${data} was added!`);
    }
  } catch {
    $q.loading.hide();
  }
}

onMounted(loadRoles);
</script>

<style scoped>
.user-form__section {
  margin-bottom: 8px;
  color: var(--rmm-text);
  font-size: var(--rmm-fs-md);
  font-weight: 600;
}

.user-form__hint {
  padding-left: 40px;
  color: var(--rmm-text-muted);
  font-size: var(--rmm-fs-xs);
  line-height: 1.4;
}

.user-form__notice {
  padding: 8px 12px;
  border: 1px dashed var(--rmm-border-strong);
  border-radius: var(--rmm-radius-sm);
  color: var(--rmm-text-muted);
}
</style>
