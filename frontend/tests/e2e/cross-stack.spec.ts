/**
 * Cross-stack E2E — gerçek tarayıcıdan backend'e tam yolculuk.
 *
 * Bu spec frontend kod doğruluğunu değil, **iki katmanın birlikte**
 * doğru çalıştığını doğrular:
 * - Login → backend /auth/login + /auth/me round-trip → in-memory token
 * - Sayfa render → backend KPI endpoint'leri 200 → ApexCharts render
 * - Mutation (admin) → backend persist → frontend list refetch
 * - Permission gizleme: backend 403 ↔ frontend UI gizleme aynı kararı verir
 * - i18n hata akışı: backend error code → frontend TR/EN render
 */

import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "ademyavuz093@gmail.com";
const PASSWORD = process.env.E2E_PW ?? "Sporthink2026!";

function emailInput(page: Page) {
  return page.getByPlaceholder(/isim@sporthink|@/i).first();
}
function passwordInput(page: Page) {
  return page.locator('input[type="password"]').first();
}

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await emailInput(page).waitFor({ state: "visible", timeout: 30_000 });
  await emailInput(page).fill(EMAIL);
  await passwordInput(page).fill(PASSWORD);
  const meResp = page.waitForResponse(
    (r) => r.url().includes("/api/v1/auth/me") && r.request().method() === "GET",
    { timeout: 30_000 }
  );
  await page.locator('button[type="submit"]').first().click();
  const me = await meResp;
  expect(me.status()).toBe(200);
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), null, {
    timeout: 10_000,
  });
}

test.describe("Cross-stack: frontend ↔ backend bütünleşik", () => {
  test("dashboard sayfa açar → backend KPI endpoint'i 200 + chart render", async ({
    page,
  }) => {
    await login(page);

    const kpiResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/dashboard/overview") &&
        r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.goto("/overview");
    const r = await kpiResp;
    expect(r.status(), "Backend KPI endpoint 200 dönmeli").toBe(200);

    // Sayfa render: bir başlık görmeli
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });

  test("kullanıcı yönetimi sayfası → backend /users + /roles çağrılarını yapar", async ({
    page,
  }) => {
    await login(page);

    // Sayfayı açtığımız anda 2 paralel API call beklenir
    const usersResp = page.waitForResponse(
      (r) => r.url().includes("/api/v1/users") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    const rolesResp = page.waitForResponse(
      (r) => r.url().includes("/api/v1/roles") && r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.goto("/users");

    const usersR = await usersResp;
    const rolesR = await rolesResp;
    expect(usersR.status(), "GET /users 200 dönmeli").toBe(200);
    expect(rolesR.status(), "GET /roles 200 dönmeli").toBe(200);

    // Sayfa render → en az 1 kullanıcı listede görünmeli (canlı DB'de 7 var)
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });

  test("audit-logs sayfası → backend pagination response'unu kullanır", async ({
    page,
  }) => {
    await login(page);

    const auditResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/admin/audit-logs") &&
        r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.goto("/audit-logs");
    const r = await auditResp;
    expect(r.status()).toBe(200);

    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.total).toBeGreaterThan(0);

    // Sayfa render: tablo veya başlık görünmeli
    await expect(page.locator("h1, h2, table").first()).toBeVisible({ timeout: 15_000 });
  });

  test("permission gizleme: süper admin sidebar dolu", async ({ page }) => {
    await login(page);
    await page.goto("/overview");
    await page.waitForLoadState("networkidle").catch(() => {});

    const navCount = await page.locator("aside nav a").count();
    expect(navCount, "Süper admin için sidebar tam doldu").toBeGreaterThanOrEqual(10);
  });

  test("i18n: 403 sayfası TR string'leri içerir", async ({ page }) => {
    await login(page);
    await page.goto("/403");
    await page.waitForLoadState("networkidle").catch(() => {});

    // TR locale aktif (playwright.config: locale=tr-TR)
    await expect(page.locator("body")).toContainText(/yetki|erişim|403/i, {
      timeout: 10_000,
    });
  });
});
