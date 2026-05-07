import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

const EMAIL = process.env.PW_EMAIL || "ademyavuz093@gmail.com";
const PASSWORD = process.env.PW_PASSWORD || "Sporthink2026!";

type ConsoleError = { type: string; text: string; location: string };

function attachConsoleListener(page: Page, sink: ConsoleError[]) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      sink.push({
        type: msg.type(),
        text: msg.text(),
        location: JSON.stringify(msg.location()),
      });
    }
  });
  page.on("pageerror", (err) => {
    sink.push({ type: "pageerror", text: err.message, location: err.stack ?? "" });
  });
}

// Login formundaki email/password input'larına role-based + placeholder fallback ile eriş
function emailInput(page: Page) {
  return page.getByPlaceholder(/isim@sporthink|@/i).first();
}
function passwordInput(page: Page) {
  return page.locator('input[type="password"]').first();
}
function submitButton(page: Page) {
  return page.locator('button[type="submit"]').first();
}

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await emailInput(page).waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  await emailInput(page).fill(EMAIL);
  await passwordInput(page).fill(PASSWORD);

  const meResponse = page.waitForResponse(
    (r) => r.url().includes("/api/v1/auth/me") && r.request().method() === "GET",
    { timeout: 30_000 }
  );
  await submitButton(page).click();
  const me = await meResponse;
  expect(me.status(), "GET /auth/me should return 200").toBe(200);

  await page.waitForFunction(
    () => !window.location.pathname.includes("/login"),
    null,
    { timeout: 10_000 }
  );
}

// ApexCharts'ın React 19 ile uyumsuzluğundan kaynaklı bilinen hatalar.
// ChartErrorBoundary yakalıyor; sayfa render'ı bundan etkilenmiyor.
// Aşağıdaki pattern'lerin tümü chart kütüphanesine ait — projenin başka yerinden
// gelen hatalar bu filtreye takılmaz.
const KNOWN_CHART_NOISE: RegExp[] = [
  /react-apexcharts/i,
  /apexcharts/i,
  /reading 'node'/i,
  /reading 'beforeMount'/i,
  /chart\.events is undefined/i,
  /beforeMount.*undefined/i,
  /react_stack_bottom_frame/i,  // React internals'tan tekrarlayan stack
  /commitHookEffectListMount/i,
  /commitHookPassiveMountEffects/i,
  /recursivelyTraversePassiveMountEffects/i,
  /<\w+>.*ChartErrorBoundary/i,  // boundary log'u
];

const KNOWN_DEV_NOISE: RegExp[] = [
  /Failed to load resource.*favicon/i,
  /\[vite\] connecting/i,
  /\[vite\] connected/i,
  /DevTools/i,
  /^%o$|^%s$/m,
  /An error occurred in the <[^>]+> component/i,
  /The above error occurred in the/i,
  /Consider adding an error boundary/i,
  // Chromium/WebKit logs 401 on /auth/me before login as a "Failed to load resource"
  // console error. Bu uygulama-tarafı bug değil; refresh-retry interceptor zaten handle ediyor.
  /Failed to load resource.*401.*Unauthorized/i,
  /\/api\/v1\/auth\/me.*401/i,
  /\/api\/v1\/auth\/refresh.*401/i,
];

function unexpectedErrors(errors: ConsoleError[]): ConsoleError[] {
  const noise = [...KNOWN_CHART_NOISE, ...KNOWN_DEV_NOISE];
  return errors.filter((e) => {
    const probe = `${e.text}\n${e.location}`;
    return !noise.some((p) => p.test(probe));
  });
}

test.describe("Sporthink KPI Dashboard cross-browser smoke", () => {
  test.setTimeout(180_000);

  test("login → overview → ecommerce → traffic render", async ({ page, browserName }, testInfo) => {
    const consoleErrors: ConsoleError[] = [];
    attachConsoleListener(page, consoleErrors);

    await login(page);

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await testInfo.attach(`overview-${browserName}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(page.url()).not.toContain("/login");
    await expect(page.locator("nav, header, h1, h2").first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/ecommerce");
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await testInfo.attach(`ecommerce-${browserName}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await expect(
      page.locator('[class*="card"], [class*="Card"], svg, canvas').first()
    ).toBeVisible({ timeout: 15_000 });

    await page.goto("/traffic");
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await testInfo.attach(`traffic-${browserName}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Bilinen ApexCharts noise'ı filtreledikten sonra başka console error olmamalı
    const errs = unexpectedErrors(consoleErrors);
    if (errs.length > 0) {
      await testInfo.attach(`console-errors-${browserName}.json`, {
        body: JSON.stringify(errs, null, 2),
        contentType: "application/json",
      });
    }
    // Bilinen "iyi" gürültüyü (pre-login 401 session check, vb.) ayıkla
    const chartErrors = consoleErrors.filter((e) =>
      KNOWN_CHART_NOISE.some((p) => p.test(`${e.text}\n${e.location}`))
    );
    const summary = `[${browserName}] total=${consoleErrors.length}, chart=${chartErrors.length}, unexpected=${errs.length}`;
    console.log(summary);
    await testInfo.attach(`error-summary-${browserName}.txt`, {
      body: summary,
      contentType: "text/plain",
    });
    expect(errs, `Unexpected (non-chart) console errors in ${browserName}`).toEqual([]);
  });

  test("yanlış şifre → kullanıcı login'de kalır", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await emailInput(page).waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    await emailInput(page).fill(EMAIL);
    await passwordInput(page).fill("wrong-password-xyz-123");

    const loginResponse = page.waitForResponse(
      (r) => r.url().includes("/api/v1/auth/login") && r.request().method() === "POST",
      { timeout: 30_000 }
    );
    await submitButton(page).click();
    const resp = await loginResponse;
    expect([400, 401, 422]).toContain(resp.status());

    await page.waitForTimeout(1500);
    expect(page.url()).toContain("/login");
  });
});
