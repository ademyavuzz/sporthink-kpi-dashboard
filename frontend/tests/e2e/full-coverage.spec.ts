/**
 * Frontend tam kapsam E2E — login + 11 dashboard sayfa + admin sayfaları + auth flow.
 *
 * `cross-browser.spec.ts`'nin 2 testini genişletir:
 * - 11 dashboard sayfası tek tek render
 * - 10 admin/operasyonel sayfa tek tek render
 * - Sidebar nav öğesi sayım (süper admin ≥ 10)
 * - Auth/state temizliği sonrası protected route → /login
 * - 404 sayfası
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

test.describe("Frontend kapsamlı kapsam", () => {
  test("11 dashboard sayfası tek tek render olur", async ({ page }) => {
    await login(page);

    const dashboardPages = [
      "/overview",
      "/traffic",
      "/meta-ads",
      "/google-ads",
      "/ecommerce",
      "/campaigns",
      "/funnel",
      "/cohort",
      "/products",
      "/customers",
      "/channel-analysis",
    ];

    for (const path of dashboardPages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      // 403'e yönlenmemiş olmalı
      expect(page.url(), `${path} → unexpected redirect`).toContain(path);
      // Sayfa header/içerik render etmeli
      await expect(
        page.locator("h1, h2, [class*='title']").first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("operasyonel sayfalar tek tek render olur", async ({ page }) => {
    await login(page);

    const adminPages = [
      "/users",
      "/audit-logs",
      "/notifications",
      "/settings/profile",
      "/settings/security",
      "/reports",
      "/import",
      "/import/history",
    ];

    for (const path of adminPages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      expect(page.url(), `${path} → unexpected redirect`).toContain(path);
      await expect(
        page.locator("h1, h2, [class*='title']").first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("sidebar süper admin için ≥10 nav öğesi içerir", async ({ page }) => {
    await login(page);
    await page.goto("/overview");
    await page.waitForLoadState("networkidle").catch(() => {});

    const navLinks = await page.locator("aside nav a").count();
    expect(
      navLinks,
      `Süper admin sidebar'da en az 10 nav öğesi bekleniyor`
    ).toBeGreaterThanOrEqual(10);
  });

  test("auth state temizlenince protected route /login'e yönlendirir", async ({
    page,
  }) => {
    await login(page);

    // localStorage'ı temizle + in-memory store'u da boşaltmak için reload
    await page.evaluate(() => {
      localStorage.removeItem("sporthink_auth");
    });

    await page.goto("/users");
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("404 sayfası bilinmeyen route için içerik gösterir", async ({ page }) => {
    await login(page);

    await page.goto("/this-route-does-not-exist-xyz");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.locator("body")).toContainText(/404|bulunamadı|not found/i, {
      timeout: 15_000,
    });
  });
});
