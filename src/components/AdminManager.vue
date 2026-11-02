<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <q-card style="width: 1100px; max-width: 95vw; min-height: 50vh">
    <DialogHeader
      title="User Administration"
      subtitle="Dashboard accounts, the role each one has and whether it may sign in"
    >
      <template #actions>
        <q-btn
          dense
          flat
          icon="refresh"
          aria-label="Refresh users"
          @click="loadUsers"
        >
          <q-tooltip>Reload the user list</q-tooltip>
        </q-btn>
      </template>
    </DialogHeader>
    <div class="q-pa-md">
      <div class="rmm-toolbar admin-toolbar">
        <q-btn
          label="New user"
          dense
          unelevated
          no-caps
          color="primary"
          icon="add"
          class="q-px-sm"
          @click="addUser"
        />
        <q-space />
        <span class="rmm-muted rmm-num"
          >{{ users.length }} {{ users.length === 1 ? "user" : "users" }}</span
        >
      </div>
      <q-table
        v-bind="tableProps"
        :loading="loading"
        :columns="columns"
        v-sortable-headers
        :rows="users"
        v-model:pagination="pagination"
      >
        <template #header-cell-is_active="cell">
          <q-th :props="cell" auto-width>
            <span class="sr-only">{{ cell.col.label }}</span>
            <q-icon name="power_settings_new" size="1.5em">
              <q-tooltip>{{ activeHeaderTip }}</q-tooltip>
            </q-icon>
          </q-th>
        </template>

        <template #header-cell-sso="cell">
          <q-th :props="cell" auto-width>
            <span class="sr-only">Single sign-on</span>
          </q-th>
        </template>

        <template #header-cell-last_login_ip="cell">
          <q-th :props="cell">
            {{ cell.col.label }}
            <q-tooltip
              >IP address of the user's last dashboard sign-in</q-tooltip
            >
          </q-th>
        </template>

        <template v-slot:loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template v-slot:no-data>
          <div
            v-if="!loading"
            class="full-width column flex-center q-gutter-sm q-py-md"
          >
            <template v-if="error">
              <q-icon name="error_outline" color="negative" size="24px" />
              <div>{{ error }}</div>
              <q-btn
                outline
                dense
                color="primary"
                label="Retry"
                @click="loadUsers"
              />
            </template>
            <EmptyState
              v-else
              class="full-width"
              icon="manage_accounts"
              title="No users to show"
              text="Add a user and give them a role; without a role they can sign in but have no permissions."
            >
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="New user"
                @click="addUser"
              />
            </EmptyState>
          </div>
        </template>

        <template v-slot:body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @dblclick="editUser(props.row)"
          >
            <q-menu context-menu>
              <q-list dense style="min-width: 200px">
                <template v-for="entry in entries" :key="entry.label">
                  <q-separator v-if="entry.divider" />
                  <div>
                    <q-item
                      v-close-popup
                      clickable
                      :class="entry.danger ? 'text-negative' : undefined"
                      :disable="entry.blocked(props.row)"
                      @click="entry.run(props.row)"
                    >
                      <q-item-section side>
                        <q-icon
                          :name="entry.icon"
                          :color="entry.danger ? 'negative' : undefined"
                        />
                      </q-item-section>
                      <q-item-section>{{ entry.label }}</q-item-section>
                    </q-item>
                    <q-tooltip v-if="entry.blocked(props.row)">
                      {{ entry.why }}
                    </q-tooltip>
                  </div>
                </template>
                <q-separator />
                <q-item clickable v-close-popup>
                  <q-item-section>Close</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
            <q-td>
              <q-checkbox
                dense
                :model-value="props.row.is_active"
                :disable="isSelf(props.row) || busyIds.includes(props.row.id)"
                :aria-label="`Active for ${props.row.username}`"
                @update:model-value="toggleActive(props.row)"
              >
                <q-tooltip>{{ activeHint(props.row) }}</q-tooltip>
              </q-checkbox>
            </q-td>
            <q-td>
              <q-chip v-if="isSso(props.row)" color="primary" dense
                >SSO
                <q-tooltip
                  >Signs in through a single sign-on provider</q-tooltip
                ></q-chip
              >
            </q-td>
            <q-td>
              {{ props.row.username }}
              <q-icon
                v-if="props.row.block_dashboard_login"
                name="api"
                size="1.2em"
                class="q-ml-xs"
                style="color: var(--rmm-status-warning)"
                aria-hidden="true"
              >
                <q-tooltip
                  >Dashboard login blocked (API-only account)</q-tooltip
                >
              </q-icon>
              <span v-if="props.row.block_dashboard_login" class="sr-only"
                >API-only account</span
              >
            </q-td>
            <q-td>{{ props.row.first_name }} {{ props.row.last_name }}</q-td>
            <q-td>
              <span
                v-if="props.row.role || !props.row.is_superuser"
                :class="{ 'rmm-muted': !props.row.role }"
                >{{ roleLabel(props.row) }}</span
              >
              <q-tooltip v-if="!props.row.role && !props.row.is_superuser"
                >No role assigned; only the built-in superuser account keeps
                access without one</q-tooltip
              >
              <span
                v-if="roleIsSuperuser(props.row)"
                class="rmm-pill rmm-pill--warning"
                :class="{ 'q-ml-xs': props.row.role }"
                >Superuser</span
              >
            </q-td>
            <q-td>{{ props.row.email }}</q-td>
            <q-td v-if="props.row.last_login">{{
              formatDate(props.row.last_login)
            }}</q-td>
            <q-td v-else>Never</q-td>
            <q-td class="rmm-mono">{{ props.row.last_login_ip }}</q-td>
            <!-- same entries as the context menu -->
            <q-td @click.stop>
              <RowActions :label="`Actions for ${props.row.username}`">
                <q-list dense style="min-width: 200px">
                  <template v-for="entry in entries" :key="entry.label">
                    <q-separator v-if="entry.divider" />
                    <!-- entries that can be blocked sit in a div so the
                         tooltip still shows while the item is disabled -->
                    <div v-if="entry.why">
                      <q-item
                        v-close-popup
                        clickable
                        :class="entry.danger ? 'text-negative' : undefined"
                        :disable="entry.blocked(props.row)"
                        @click="entry.run(props.row)"
                      >
                        <q-item-section side>
                          <q-icon
                            :name="entry.icon"
                            :color="entry.danger ? 'negative' : undefined"
                          />
                        </q-item-section>
                        <q-item-section>{{ entry.label }}</q-item-section>
                      </q-item>
                      <q-tooltip v-if="entry.blocked(props.row)">
                        {{ entry.why }}
                      </q-tooltip>
                    </div>
                    <q-item
                      v-else
                      v-close-popup
                      clickable
                      :class="entry.danger ? 'text-negative' : undefined"
                      @click="entry.run(props.row)"
                    >
                      <q-item-section side>
                        <q-icon
                          :name="entry.icon"
                          :color="entry.danger ? 'negative' : undefined"
                        />
                      </q-item-section>
                      <q-item-section>{{ entry.label }}</q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </RowActions>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
  </q-card>
</template>

<script setup>
import axios from "axios";
import { storeToRefs } from "pinia";
import { useQuasar } from "quasar";
import { onMounted, ref } from "vue";
import { useStore } from "vuex";
import UserSessionsTable from "@/components/accounts/UserSessionsTable.vue";
import UserForm from "@/components/modals/admin/UserForm.vue";
import UserResetPasswordForm from "@/components/modals/admin/UserResetPasswordForm.vue";
import DialogHeader from "@/components/ui/DialogHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import RowActions from "@/components/ui/RowActions.vue";
import {
  askChangeCode,
  CODE_PROMPT,
  PROMPT_CANCEL,
  PROMPT_OK,
} from "@/composables/accounts";
import SSOAccountsTable from "@/sso/SSOAccountsTable.vue";
import { useAuthStore } from "@/stores/auth";
import { notifySuccess } from "@/utils/notify";
import { sortableHeaders as vSortableHeaders } from "@/utils/sortableHeaders";

defineOptions({ name: "AdminManager" });

const $q = useQuasar();
const store = useStore();
const { username: me } = storeToRefs(useAuthStore());
const formatDate = (value) => store.getters.formatDate(value);

const users = ref([]);
const roles = ref([]);
const loading = ref(false);
const error = ref("");
const busyIds = ref([]);
const pagination = ref({
  rowsPerPage: 0,
  sortBy: "username",
  descending: false,
});

const tableProps = {
  class: "rmm-table",
  rowKey: "id",
  flat: true,
  bordered: true,
  dense: true,
  virtualScroll: true,
  hidePagination: true,
  binaryStateSort: true,
};

const isSelf = (user) => user.username === me.value;
const isSso = (user) => user.social_accounts.length > 0;

function roleOf(user) {
  return user.role ? roles.value.find((r) => r.id === user.role) : undefined;
}

function roleLabel(user) {
  if (!user.role) return user.is_superuser ? "Superuser" : "No role";
  return roleOf(user)?.name ?? `Role #${user.role}`;
}

// built-in superusers often have no role at all
const roleIsSuperuser = (user) =>
  user.is_superuser || !!roleOf(user)?.is_superuser;

const col = (name, label, extra = {}) => ({
  name,
  label,
  field: name,
  align: "left",
  sortable: true,
  ...extra,
});
const columns = [
  col("is_active", "Active", { sortable: false }),
  col("sso", "", { sortable: false }),
  col("username", "Username"),
  col("name", "Name", {
    field: (row) => `${row.first_name} ${row.last_name}`.trim(),
  }),
  col("role", "Role", { field: roleLabel }),
  col("email", "Email"),
  col("last_login", "Last login"),
  col("last_login_ip", "Last logon from"),
  { name: "actions", label: "Actions", align: "right", field: () => "" },
];

const activeHeaderTip =
  "Active: unticked users cannot sign in and their API keys stop working";

function activeHint(user) {
  if (isSelf(user)) return "You cannot deactivate your own account";
  return user.is_active
    ? "Untick to block sign-in and API keys for this user"
    : "Tick to let this user sign in again";
}

function loadRoles() {
  axios
    .get("/accounts/roles/")
    .then(({ data }) => {
      roles.value = data;
    })
    .catch(() => {
      // a 403 here just means this role cannot list roles; fall back to
      // showing the role id instead of failing the whole table
      roles.value = [];
    });
}

function loadUsers() {
  loading.value = true;
  error.value = "";
  axios
    .get("/accounts/users/")
    .then(({ data }) => {
      users.value = data;
    })
    .catch((err) => {
      error.value =
        err?.response?.status === 403
          ? "Your role cannot view users."
          : "Users could not be loaded.";
    })
    .finally(() => {
      loading.value = false;
    });
}

function openForm(component, componentProps) {
  $q.dialog({ component, componentProps }).onOk(loadUsers);
}

const addUser = () => openForm(UserForm);
const editUser = (user) => openForm(UserForm, { user });
const resetPassword = (user) => openForm(UserResetPasswordForm, { user });
const showSSOAccounts = (user) => openForm(SSOAccountsTable, { user });
const showSessions = (user) =>
  $q.dialog({ component: UserSessionsTable, componentProps: { user } });

function removeUser(user) {
  $q.dialog({
    title: `Delete user ${user.username}?`,
    message: "This cannot be undone. The user's API keys are deleted too.",
    ok: { label: "Delete", color: "negative" },
    cancel: true,
  }).onOk(() => {
    axios.delete(`/accounts/${user.id}/users/`).then(() => {
      loadUsers();
      notifySuccess(`User ${user.username} was deleted!`);
    });
  });
}

async function toggleActive(user) {
  if (isSelf(user)) return;
  const next = !user.is_active;
  const totp_code = await askChangeCode($q, {
    title: `${next ? "Enable" : "Disable"} user ${user.username}?`,
  });
  if (totp_code === null) return;

  busyIds.value.push(user.id);
  axios
    .put(`/accounts/${user.id}/users/`, {
      id: user.id,
      is_active: next,
      totp_code,
    })
    .then(() => {
      // only reflect the new state once the server confirms it; a failed
      // request leaves the checkbox showing the server's state
      user.is_active = next;
      notifySuccess(
        next ? "User enabled successfully" : "User disabled successfully",
      );
    })
    .finally(() => {
      busyIds.value = busyIds.value.filter((id) => id !== user.id);
    });
}

function resetTwoFactor(user) {
  const self = isSelf(user);
  $q.dialog({
    title: `Reset 2FA for ${user.username}?`,
    message: self
      ? "Enter a current code to confirm. You set up a new authenticator app the next time you sign in."
      : "Enter your current code to confirm. They set up a new authenticator app the next time they sign in.",
    prompt: { ...CODE_PROMPT },
    cancel: PROMPT_CANCEL,
    ok: { ...PROMPT_OK, label: "Reset", color: "negative" },
  }).onOk((code) => {
    axios
      .put("/accounts/users/reset_totp/", {
        id: user.id,
        [self ? "code" : "totp_code"]: code,
      })
      .then((response) => {
        notifySuccess(response.data, 4000);
      });
  });
}

// shared by the context menu and the row actions; "blocked" disables the
// entry and "why" is shown as its tooltip
const never = () => false;
const entries = [
  { icon: "edit", label: "Edit", run: editUser, blocked: never },
  {
    icon: "autorenew",
    label: "Reset password",
    divider: true,
    run: resetPassword,
    blocked: isSso,
    why: "SSO accounts have no local password to reset",
  },
  {
    icon: "autorenew",
    label: "Reset two-factor auth",
    run: resetTwoFactor,
    blocked: isSso,
    why: "SSO accounts have no local two-factor auth to reset",
  },
  {
    icon: "groups",
    label: "Show connected SSO accounts",
    divider: true,
    run: showSSOAccounts,
    blocked: (user) => !isSso(user),
    why: "This user has no connected SSO accounts",
  },
  {
    icon: "devices",
    label: "Show active sessions",
    run: showSessions,
    blocked: never,
  },
  {
    icon: "delete",
    label: "Delete",
    divider: true,
    danger: true,
    run: removeUser,
    blocked: isSelf,
    why: "You cannot delete your own account",
  },
];

onMounted(() => {
  loadUsers();
  loadRoles();
});
</script>

<style scoped>
.admin-toolbar {
  margin-bottom: 8px;
  padding: 0 0 8px;
}
</style>
