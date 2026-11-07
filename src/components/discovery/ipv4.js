// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// IPv4 helpers for the discovery forms and filters. Plain arithmetic, the
// values exceed the signed 32-bit range of bit operators.
const DOTTED = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function ipToInt(ip) {
  const m = DOTTED.exec(String(ip ?? "").trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts.reduce((n, p) => n * 256 + p, 0);
}

function intToIp(n) {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
}

// "10.0.0.7/24" -> { base, prefix, size } with the host bits cleared
export function parseCidr(text) {
  const parts = String(text ?? "")
    .trim()
    .split("/");
  if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
  const n = ipToInt(parts[0]);
  const prefix = Number(parts[1]);
  if (n === null || prefix > 32) return null;
  const size = 2 ** (32 - prefix);
  return { base: n - (n % size), prefix, size };
}

// a bare address counts as /32; null when it is not IPv4
export function normalizeCidr(text) {
  const value = String(text ?? "").trim();
  const net = parseCidr(value.includes("/") ? value : `${value}/32`);
  return net && `${intToIp(net.base)}/${net.prefix}`;
}

export function inCidr(ip, cidr) {
  const n = ipToInt(ip);
  const net = parseCidr(cidr);
  return n !== null && !!net && n >= net.base && n < net.base + net.size;
}

export function subnetOf(inner, outer) {
  const a = parseCidr(inner);
  const b = parseCidr(outer);
  return !!a && !!b && a.base >= b.base && a.base + a.size <= b.base + b.size;
}

// ports typed as "22, 80 443" -> valid numbers and the rejected parts
export function parsePorts(text) {
  const ports = [];
  const bad = [];
  for (const part of String(text ?? "").split(/[\s,;]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (/^\d+$/.test(part) && n >= 1 && n <= 65535) ports.push(n);
    else bad.push(part);
  }
  return { ports, bad };
}
