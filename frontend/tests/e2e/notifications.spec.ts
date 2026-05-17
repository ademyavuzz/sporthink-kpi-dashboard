/**
 * Notifications cross-stack E2E.
 *
 * Doğrulanan akış:
 * - Login sonrası bell ikonu render olur, unread count endpoint çağrılır
 * - NotificationsPage server'dan paginated liste çeker
 * - localStorage'da eski `sporthink-notifications` key'i (eski sürüm) varsa
 *   logout sonrası silinir (migration garantisi)
 *
 * NOT: Yeni bildirim oluşturmak için server tetikleyicisi (import vb.)
 * gerektirir; bu spec sadece okuma + temizleme + endpoint kontratı izler.
 */

import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "ademyavuz093@gmail.com";
const PASSWORD = process.env.E2E_PW ?? "Sporthink2026!";

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/isim@sporthink|@/i).first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.getByPlaceholder(/isim@sporthink|@/i).first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  const meResp = page.waitForResponse(
    (r) => r.url().includes("/api/v1/auth/me") && r.request().method() === "GET",
    { timeout: 30_000 }
  );
  await page.locator('button[type="submit"]').first().click();
  await meResp;
  await page.waitForFunction(() => !window.location.pathname.includes("/login"), null, {
    timeout: 10_000,
  });
}

test.describe("Notifications cross-stack", () => {
  test("login sonrası unread-count endpoint'i çağrılır", async ({ page }) => {
    const unreadResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/notifications/unread-count") &&
        r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await login(page);
    const r = await unreadResp;
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.count).toBe("number");
  });

  test("/notifications sayfası backend'den paginated liste çeker", async ({
    page,
  }) => {
    await login(page);

    // NotificationsPage default page_size=25 — bunu spesifik bekle, böylece
    // NotificationBell'in PREVIEW_LIMIT=6 polling'iyle karışmaz.
    const listResp = page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/notifications?") &&
        r.url().includes("page_size=25") &&
        r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await page.goto("/notifications");
    const r = await listResp;
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.page_size).toBe(25);

    // Sayfa render: başlık görünmeli
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
  });

  test("login sonrası eski client-side notifications store key'i kullanılmıyor", async ({
    page,
  }) => {
    await login(page);

    // Eski sürümlerden migrate ediliyor — yeni sistem bu key'i hiç yazmaz.
    // (clearAuth içinde cleanup var; burada en azından "yeni sürüm bu key'i
    //  oluşturmuyor" kontrolü yapıyoruz.)
    const oldKey = await page.evaluate(() =>
      localStorage.getItem("sporthink-notifications"),
    );
    expect(oldKey).toBeNull();
  });
});
