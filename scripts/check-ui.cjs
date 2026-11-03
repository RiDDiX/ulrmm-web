// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

// Build first. Playwright comes from local tooling, not this package.
// PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node scripts/check-ui.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const dist = path.resolve(__dirname, "../dist");
const agents = ["online", "offline"].map((status, index) => ({
  agent_id: `test-${index}`,
  hostname: `TEST-PC-${index}`,
  status,
  plat: "windows",
  monitoring_type: index ? "server" : "workstation",
  client_name: "Test client",
  site_name: "Test site",
  checks: { failing: 0, warning: 0, info: 0, passing: 1, total: 1 },
  last_seen: new Date().toISOString(),
  boot_time: Date.now() / 1000,
  pending_actions_count: 0,
  custom_fields: [],
  operating_system: "Windows 11",
}));
const dashinfo = {
  trmm_version: "test",
  latest_trmm_ver: "test",
  dark_mode: false,
  default_agent_tbl_tab: "mixed",
  client_tree_sort: "alpha",
  client_tree_splitter: 20,
  loading_bar_color: "primary",
  clear_search_when_switching: true,
  dash_info_color: "info",
  dash_positive_color: "positive",
  dash_negative_color: "negative",
  dash_warning_color: "warning",
};
let rejectLogin = true;
const totpKey = "JBSWY3DPEHPK3PXP";
const fixtures = {
  "/core/branding/": { product_name: "UI test", logo: null },
  "/core/dashinfo/": dashinfo,
  "/core/version/": "test",
  "/v2/checkcreds/": { totp: true },
  "/v2/login/": { token: "fake-local-test-token", username: "test" },
  "/accounts/users/setup_totp/": {
    totp_key: totpKey,
    qr_url: `otpauth://totp/UI%20test:test?secret=${totpKey}&issuer=UI%20test`,
  },
  "/_allauth/browser/v1/config/": {
    data: { socialaccount: { providers: [{ id: "test", name: "Test SSO" }] } },
  },
  "/agents/": agents,
  "/agents/test-0/": {
    ...agents[0],
    client: "Test client",
    cpu_model: [],
    disks: [],
    total_ram: 8,
    wmi_detail: {},
    applied_policies: {},
    winupdatepolicy: [],
    all_timezones: [],
    physical_disks: [],
  },
  // enough rows for the Checks table to fill the height it is given
  "/agents/test-0/checks/": Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    check_type: "memory",
    readable_desc: `Memory Check ${index + 1}`,
    text_alert: false,
    email_alert: false,
    dashboard_alert: false,
    alert_severity: "warning",
    policy: null,
    overridden_by_policy: false,
    assignedtasks: [],
    alert_template: null,
    warning_threshold: 80,
    error_threshold: 90,
    check_result: {
      id: index + 1,
      status: "passing",
      more_info: "Average memory usage: 40%",
      last_run: new Date().toISOString(),
      alert_severity: "info",
      history: [],
    },
  })),
  "/clients/": [
    {
      id: 1,
      name: "Test client",
      agent_count: 2,
      failing_checks: {},
      sites: [
        {
          id: 1,
          name: "Test site",
          client: 1,
          agent_count: 2,
          failing_checks: {},
        },
      ],
    },
  ],
};
// Local static server and a fake API. No credentials, no live endpoints.
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/env-config.js") {
    res.setHeader("Content-Type", "application/javascript");
    return res.end('window._env_ = { PROD_URL: location.origin + "/api" };');
  }
  if (url.pathname.startsWith("/api/")) {
    const route = url.pathname.slice(4);
    res.setHeader("Content-Type", "application/json");
    if (route === "/v2/login/" && rejectLogin) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ non_field_errors: ["Invalid code"] }));
    }
    if (route === "/accounts/users/ui/" && req.method === "PATCH") {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        if (body.default_agent_tbl_tab)
          dashinfo.default_agent_tbl_tab = body.default_agent_tbl_tab;
        res.end("null");
      });
      return;
    }
    if (route === "/agents/") {
      // the server narrows by type and rejects a value it does not know
      const type = url.searchParams.get("monitoring_type");
      if (type && !["server", "workstation"].includes(type)) {
        res.statusCode = 400;
        return res.end(JSON.stringify("monitoring type does not exist"));
      }
      return res.end(
        JSON.stringify(
          type ? agents.filter((a) => a.monitoring_type === type) : agents,
        ),
      );
    }
    return res.end(JSON.stringify(fixtures[route] ?? []));
  }
  const candidate = path.resolve(dist, `.${url.pathname}`);
  const file =
    candidate.startsWith(`${dist}/`) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile()
      ? candidate
      : path.join(dist, "index.html");
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
  };
  res.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // every agent list request, as its query string
    const agentLists = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/agents/") agentLists.push(url.search);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/login`);
    await page.getByText("Welcome back", { exact: true }).waitFor();
    await page.getByText("Test SSO", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByText("This field is required", { exact: true })
      .first()
      .waitFor();
    await page.getByLabel("Username", { exact: true }).fill("test");
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Password", { exact: true }).getAttribute("type"),
      "text",
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Authentication code").fill("000000");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByText("Invalid code", { exact: true }).last().waitFor();
    assert.equal(await page.locator(".q-dialog").count(), 1);
    rejectLogin = false;
    await page.getByLabel("Authentication code").fill("123456");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const row = page.locator(".agent-table tbody tr", { hasText: "TEST-PC-0" });
    await row.waitFor();
    // First list request has no monitoring_type. A fresh store used to
    // send monitoring_type=null before the preference loaded.
    assert.deepEqual(agentLists, [""]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("agentTable_columns")),
      null,
    );
    // Tiles count the table rows for this scope and tab.
    const tiles = await page.locator(".fleet-metrics").innerText();
    assert.match(tiles, /Total devices\s+2/);
    assert.match(tiles, /Online\s+1/);
    await page
      .getByRole("button", { name: "Online", exact: false })
      .first()
      .click();
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".agent-table")
          ?.textContent.includes("TEST-PC-1"),
    );
    await page.getByRole("button", { name: /Total devices/ }).click();
    await page
      .locator(".agent-table tbody tr", { hasText: "TEST-PC-1" })
      .waitFor();
    const treeToggle = page.getByRole("button", {
      name: "Browse clients and sites",
      exact: true,
    });
    await treeToggle.click();
    await page
      .getByRole("complementary", { name: "Clients and sites" })
      .waitFor();
    await treeToggle.click();
    await row.click();
    // Quick panel: hostname, Remote control, Activity tab.
    await page.locator(".quick-panel__hostname").waitFor();
    await page
      .getByRole("button", { name: "Remote control", exact: true })
      .waitFor();
    await page
      .locator(".quick-panel")
      .getByRole("tab", { name: "Activity", exact: true })
      .click();
    await page.locator(".quick-panel__body").waitFor();
    await page
      .getByRole("button", { name: "Close device details", exact: true })
      .click();
    // Under 1500px the details open below the table, on screen, one scrollbar.
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(500);
    await row.click();
    await page.locator(".quick-panel__hostname").waitFor();
    await page.waitForTimeout(500);
    const detail = await page.evaluate(() => {
      const inspector = document.querySelector(".device-inspector");
      const box = inspector.getBoundingClientRect();
      const scrollers = [...inspector.querySelectorAll("*")].filter(
        (el) =>
          /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
          el.scrollHeight > el.clientHeight + 1,
      );
      return {
        top: box.top,
        bottom: box.bottom,
        viewport: innerHeight,
        scrollers: scrollers.map((el) => el.className),
      };
    });
    assert.ok(
      detail.top >= 0 && detail.bottom <= detail.viewport,
      `details outside the viewport: ${JSON.stringify(detail)}`,
    );
    assert.ok(detail.scrollers.length <= 1, JSON.stringify(detail.scrollers));
    await page
      .getByRole("button", { name: "Close device details", exact: true })
      .click();
    // After the device page, one more list request with no type, and
    // agentTable_columns stays unset.
    await page.goto(`${base}/agents/test-0`);
    await page.locator(".device-hero").waitFor();
    agentLists.length = 0;
    await page.goto(`${base}/`);
    await row.waitFor();
    await page.waitForTimeout(500);
    assert.deepEqual(agentLists, [""]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("agentTable_columns")),
      null,
    );
    // Saving the default tab switches the table without a reload.
    const serverRow = page.locator(".agent-table tbody tr", {
      hasText: "TEST-PC-1",
    });
    const savePreference = async (label) => {
      await page.locator(".nav-user__btn").first().click();
      await page.getByText("Preferences", { exact: true }).click();
      await page
        .locator(".q-dialog .q-field", { hasText: "Agent table default tab" })
        .click();
      await page.getByRole("option", { name: label, exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
    };
    await savePreference("Servers");
    await row.waitFor({ state: "detached" });
    await serverRow.waitFor();
    assert.match(
      await page.locator(".agent-modes .q-tab--active").innerText(),
      /Servers/,
    );
    await savePreference("Mixed");
    await page.getByRole("tab", { name: /All devices/ }).click();
    await row.waitFor();
    assert.equal(dashinfo.default_agent_tbl_tab, "mixed");
    // Stored empty column lists still render the default headers.
    await page.evaluate(() =>
      localStorage.setItem(
        "agentTable_columns",
        JSON.stringify({ compact: [], full: [] }),
      ),
    );
    await page.reload();
    await row.waitFor();
    assert.ok((await page.locator(".agent-table thead th").count()) > 3);
    await page.evaluate(() => localStorage.removeItem("agentTable_columns"));
    for (const width of [1600, 1366, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(500); // Quasar's screen observer is debounced.
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow at ${width}px`,
      );
      assert.equal(await row.isVisible(), true);
    }
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    assert.equal(await page.locator("body.body--dark").count(), 1);
    const login = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await login.goto(`${base}/login`);
    await login.getByText("Welcome back", { exact: true }).waitFor();
    assert.equal(
      await login.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    // Two-factor enrolment: cancelling leaves no key, QR code or password.
    fixtures["/v2/checkcreds/"] = {
      totp: false,
      token: "fake-setup-token",
      username: "test",
    };
    const enrol = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    enrol.on("pageerror", (error) => errors.push(error.message));
    await enrol.goto(`${base}/login`);
    await enrol.getByLabel("Username", { exact: true }).fill("test");
    await enrol.getByLabel("Password", { exact: true }).fill("test-password");
    await enrol.getByRole("button", { name: "Sign in", exact: true }).click();
    await enrol
      .getByText("Set up two-factor authentication", { exact: true })
      .waitFor();
    await enrol.locator("img.enrol-qr").waitFor();
    await enrol.getByText(totpKey, { exact: true }).waitFor();
    await enrol.getByRole("button", { name: "Cancel", exact: true }).click();
    await enrol.locator(".q-dialog").waitFor({ state: "detached" });
    assert.equal((await enrol.content()).includes(totpKey), false);
    assert.equal(await enrol.locator("img.enrol-qr").count(), 0);
    assert.equal(
      await enrol.getByLabel("Password", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await enrol.evaluate(() => localStorage.getItem("access_token")),
      null,
    );
    assert.deepEqual(errors, []);
    console.log(
      "UI checks passed: validation, SSO, 2FA and enrolment, filters, client panel, device details, reload after the device page, column choice, light/dark and responsive layouts.",
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
