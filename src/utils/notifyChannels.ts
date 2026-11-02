// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

export interface ChannelField {
  key: string;
  label: string;
  hint: string;
  placeholder?: string;
  optional?: boolean;
  // comma separated in the form, a list on the server
  list?: boolean;
}

export interface ChannelKind {
  label: string;
  icon: string;
  help: string;
  fields: ChannelField[];
  // label of the write-only secret, empty = kind has none
  secretLabel: string;
  secretHint: string;
}

export const CHANNEL_KINDS: Record<string, ChannelKind> = {
  matrix: {
    label: "Matrix",
    icon: "forum",
    help: "Posts into a Matrix room. Create a bot user, invite it to the room and copy its access token (Element: Settings > Help & About > Access Token, or log in with the client API).",
    fields: [
      {
        key: "homeserver",
        label: "Homeserver URL",
        hint: "https only, e.g. https://matrix.example.org",
      },
      {
        key: "room_id",
        label: "Room ID",
        hint: "Internal ID starting with !, from the room settings > Advanced",
        placeholder: "!abc123:example.org",
      },
    ],
    secretLabel: "Access token",
    secretHint: "Access token of the bot user",
  },
  telegram: {
    label: "Telegram",
    icon: "send",
    help: "Sends through a Telegram bot. Create the bot with @BotFather to get the token, start a chat with it (or add it to a group) and use that chat's ID; @userinfobot or the getUpdates call shows it.",
    fields: [
      {
        key: "chat_id",
        label: "Chat ID",
        hint: "Number of the user, group or channel; groups are negative",
      },
    ],
    secretLabel: "Bot token",
    secretHint: "Token from @BotFather, like 123456:ABC...",
  },
  ntfy: {
    label: "ntfy",
    icon: "notifications_active",
    help: "Publishes to an ntfy topic on ntfy.sh or your own server. Subscribe to the topic in the ntfy app. Pick a hard-to-guess topic name, or set an access token for a protected topic.",
    fields: [
      {
        key: "server",
        label: "Server URL",
        hint: "Optional, https only. Empty uses ntfy.sh",
        optional: true,
      },
      {
        key: "topic",
        label: "Topic",
        hint: "Letters, digits, - and _ (max 64)",
      },
    ],
    secretLabel: "Access token",
    secretHint: "Only for protected topics, leave empty otherwise",
  },
  slack: {
    label: "Slack",
    icon: "tag",
    help: "Uses a Slack incoming webhook. In Slack: Apps > Incoming Webhooks > Add to Slack, pick the channel and copy the webhook URL. The URL is a secret.",
    fields: [],
    secretLabel: "Webhook URL",
    secretHint: "https://hooks.slack.com/services/...",
  },
  teams: {
    label: "Microsoft Teams",
    icon: "groups",
    help: "Uses a Teams incoming webhook. In the channel: ... > Workflows or Connectors > Incoming Webhook, create it and copy the URL. The URL is a secret.",
    fields: [],
    secretLabel: "Webhook URL",
    secretHint: "URL of the Teams webhook",
  },
  webhook: {
    label: "Webhook",
    icon: "webhook",
    help: "POSTs the event as JSON to your URL. With a secret set, the body is signed with HMAC-SHA256 and sent in the X-Signature header so the receiver can verify it.",
    fields: [
      {
        key: "url",
        label: "URL",
        hint: "https only; receives a JSON body per event",
      },
    ],
    secretLabel: "Signing secret",
    secretHint: "Optional; used for the X-Signature header",
  },
  email: {
    label: "Email",
    icon: "mail",
    help: "Sends through the SMTP server from Global Settings > Email Alerts. Separate recipients with commas.",
    fields: [
      {
        key: "recipients",
        label: "Recipients",
        hint: "Comma separated, at most 20 addresses",
        list: true,
        optional: true,
      },
    ],
    secretLabel: "",
    secretHint: "",
  },
};

export const kindLabel = (kind: string) =>
  CHANNEL_KINDS[kind]?.label ?? kind ?? "Unknown";

export const SEVERITIES = ["info", "warning", "error"];

export const SOURCES = [
  { value: "check", label: "Checks" },
  { value: "agent", label: "Agents" },
  { value: "task", label: "Tasks" },
  { value: "netmon", label: "Network devices" },
  { value: "vuln", label: "Vulnerabilities" },
  { value: "appupdate", label: "App updates" },
  { value: "tamper", label: "Tamper" },
  { value: "license", label: "Licenses and warranty" },
  { value: "laps", label: "Local admin" },
];

export const sourceLabel = (s: string) =>
  SOURCES.find((x) => x.value === s)?.label ?? s;

export const SEVERITY_PILL: Record<string, string> = {
  info: "rmm-pill--info",
  warning: "rmm-pill--warning",
  error: "rmm-pill--negative",
};
