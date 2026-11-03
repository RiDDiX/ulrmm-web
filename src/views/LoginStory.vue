<!-- SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid -->
<!-- SPDX-License-Identifier: FSL-1.1-ALv2 -->

<template>
  <section class="login-story">
    <div class="login-brand">
      <img
        v-if="branding.logo"
        :src="branding.logo"
        alt=""
        class="login-brand__logo"
      />
      <q-icon v-else name="hub" size="30px" />
      <span>{{ branding.productName }}</span>
    </div>
    <div class="login-story__content">
      <div class="login-eyebrow">YOUR OPERATIONS WORKSPACE</div>
      <div class="login-headline">Every device.<br />One clear view.</div>
      <p>
        Stay on top of your fleet. Resolve issues, automate everyday tasks and
        support your users from one place.
      </p>
      <!-- a sketch of the dashboard, drawn with empty elements -->
      <div class="login-illustration" aria-hidden="true">
        <div class="illustration-bar">
          <span v-for="dot in 3" :key="dot"></span>
        </div>
        <div class="illustration-body">
          <div class="illustration-nav">
            <i v-for="entry in 4" :key="entry"></i>
          </div>
          <div class="illustration-content">
            <div class="illustration-metrics">
              <i v-for="tile in 3" :key="tile"></i>
            </div>
            <div v-for="row in 4" :key="row" class="illustration-row">
              <q-icon name="computer" /><i></i><q-icon name="check_circle" />
            </div>
          </div>
        </div>
      </div>
      <div class="login-features">
        <span v-for="pillar in PILLARS" :key="pillar.label"
          ><q-icon :name="pillar.icon" /> {{ pillar.label }}</span
        >
      </div>
    </div>
    <div class="login-story__footer">Remote monitoring &amp; management</div>
  </section>
</template>

<script setup lang="ts">
import { useBrandingStore } from "@/stores/branding";

// the left half of the sign-in page; nothing here is interactive
const branding = useBrandingStore();

const PILLARS = [
  { icon: "devices", label: "Monitor" },
  { icon: "bolt", label: "Automate" },
  { icon: "support_agent", label: "Support" },
];
</script>

<style scoped>
.login-story {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 64px;
  background: radial-gradient(ellipse at 15% 65%, #203e67, transparent 65%),
    #102139;
  color: #f3f7ff;
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 19px;
  font-weight: 600;
}
.login-brand .q-icon {
  color: #7eb4ff;
}
.login-brand__logo {
  max-width: 160px;
  max-height: 32px;
  object-fit: contain;
}
.login-story__content {
  max-width: 500px;
  padding: 60px 0;
}
.login-eyebrow {
  color: #a5c4ee;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 2px;
}
.login-headline {
  font-size: clamp(36px, 4vw, 58px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -2px;
  margin: 20px 0;
}
.login-story p {
  color: #b7c8df;
  font-size: 16px;
  line-height: 1.8;
  max-width: 420px;
}
.login-story__footer {
  color: #a5bad5;
  font-size: 12px;
}
.login-features {
  display: flex;
  gap: 26px;
  margin-top: 30px;
  font-size: 13px;
  color: #cfdef2;
}
.login-features .q-icon {
  margin-right: 6px;
  font-size: 18px;
  color: #85b6fa;
}
.login-illustration {
  max-width: 430px;
  margin-top: 36px;
  border: 1px solid #456083;
  border-radius: 12px;
  background: #172e4d;
  box-shadow: 0 20px 45px #08162655;
  overflow: hidden;
}
.illustration-bar {
  display: flex;
  gap: 5px;
  padding: 12px;
  border-bottom: 1px solid #344c6b;
}
.illustration-bar span {
  height: 5px;
  width: 5px;
  background: #7994b5;
  border-radius: 50%;
}
.illustration-body {
  display: flex;
  min-height: 170px;
}
.illustration-nav {
  width: 55px;
  display: grid;
  align-content: start;
  gap: 13px;
  padding: 20px 12px;
  border-right: 1px solid #344c6b;
}
.illustration-nav i {
  height: 5px;
  border-radius: 2px;
  background: #577191;
}
.illustration-nav i:first-child {
  background: #7db2ff;
}
.illustration-content {
  flex: 1;
  padding: 18px;
}
.illustration-metrics {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.illustration-metrics i {
  height: 32px;
  flex: 1;
  border-radius: 5px;
  background: #2b466a;
  border: 1px solid #42618a;
}
.illustration-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 29px;
  border-bottom: 1px solid #2e486b;
  color: #9bb5d8;
}
.illustration-row > i:not(.q-icon) {
  width: 45%;
  height: 4px;
  border-radius: 2px;
  background: #607b9f;
}
.illustration-row .q-icon:last-child {
  margin-left: auto;
  color: #75cba9;
}
@media (max-width: 1000px) {
  .login-story {
    padding: 36px;
  }
}
@media (max-width: 700px) {
  .login-story {
    padding: 24px;
  }
  .login-brand {
    font-size: 16px;
  }
  .login-story__content,
  .login-story__footer {
    display: none;
  }
}
</style>
