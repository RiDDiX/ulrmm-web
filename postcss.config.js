// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// the last four releases of each browser family
const targets = [
  "Chrome",
  "Firefox",
  "Edge",
  "Safari",
  "Android",
  "ChromeAndroid",
  "FirefoxAndroid",
  "iOS",
].map((browser) => `last 4 ${browser} versions`);

module.exports = {
  plugins: [require("autoprefixer")({ overrideBrowserslist: targets })],
};
