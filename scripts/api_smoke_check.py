"""Sporthink API smoke-check script.

Tüm okunan endpoint'leri ×2 çağırır; mutasyon endpoint'lerinde sadece
auth-gate (401) ve "kayıt yok" (404) kontrolü yapar — production verisini
bozmaz.

Kullanım:
    SPORTHINK_EMAIL=... SPORTHINK_PASSWORD=... python3 scripts/api_smoke_check.py

Çevre değişkenleri:
    SPORTHINK_API_BASE  → varsayılan http://localhost:8000
    SPORTHINK_EMAIL     → süper admin email (zorunlu)
    SPORTHINK_PASSWORD  → süper admin şifre (zorunlu)

Çıkış kodu: 0 başarılı / 1 herhangi bir endpoint düşmüş.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Optional

BASE = os.environ.get("SPORTHINK_API_BASE", "http://localhost:8000")
EMAIL = os.environ.get("SPORTHINK_EMAIL", "")
PASSWORD = os.environ.get("SPORTHINK_PASSWORD", "")

if not EMAIL or not PASSWORD:
    print("ERROR: SPORTHINK_EMAIL ve SPORTHINK_PASSWORD env değişkenlerini ayarla.")
    sys.exit(2)

# (method, path, mode, body, expect_codes, label, query)
# mode:
#   "read"     → çağır, 200 bekle, iki kez
#   "preview"  → çağır, 200/422 OK, iki kez
#   "auth"     → token YOK çağrı, 401 bekle (mutasyon endpoint'leri için)
ENDPOINTS = [
    # AUTH
    ("GET",   "/api/v1/auth/me",                 "read",    None,                                   [200],          "auth.me"),
    ("POST",  "/api/v1/auth/refresh",            "refresh", None,                                   [200],          "auth.refresh"),
    ("GET",   "/api/v1/auth/verify-reset-token", "raw",     {"qs": "?token=invalidxyz"},            [200, 400, 422],"auth.verify_reset(invalid)"),

    # FILTERS
    ("GET",   "/api/v1/filters/brands",          "read",    None, [200], "filters.brands"),
    ("GET",   "/api/v1/filters/categories",      "read",    None, [200], "filters.categories"),
    ("GET",   "/api/v1/filters/channels",        "read",    None, [200], "filters.channels"),
    ("GET",   "/api/v1/filters/cities",          "read",    None, [200], "filters.cities"),
    ("GET",   "/api/v1/filters/devices",         "read",    None, [200], "filters.devices"),
    ("GET",   "/api/v1/filters/order-statuses",  "read",    None, [200], "filters.order_statuses"),
    ("GET",   "/api/v1/filters/payment-methods", "read",    None, [200], "filters.payment_methods"),

    # DASHBOARD - tarih aralığı veriyoruz
    ("GET", "/api/v1/dashboard/overview?date_from=2024-10-01&date_to=2025-03-31", "read", None, [200], "dashboard.overview"),
    ("GET", "/api/v1/dashboard/ecom?date_from=2024-10-01&date_to=2025-03-31",     "read", None, [200], "dashboard.ecom"),
    ("GET", "/api/v1/dashboard/traffic?date_from=2024-10-01&date_to=2025-03-31",  "read", None, [200], "dashboard.traffic"),
    ("GET", "/api/v1/dashboard/google?date_from=2024-10-01&date_to=2025-03-31",   "read", None, [200], "dashboard.google"),
    ("GET", "/api/v1/dashboard/meta?date_from=2024-10-01&date_to=2025-03-31",     "read", None, [200], "dashboard.meta"),
    ("GET", "/api/v1/dashboard/funnel?date_from=2024-10-01&date_to=2025-03-31",   "read", None, [200], "dashboard.funnel"),
    ("GET", "/api/v1/dashboard/products?date_from=2024-10-01&date_to=2025-03-31", "read", None, [200], "dashboard.products"),
    ("GET", "/api/v1/dashboard/customers?date_from=2024-10-01&date_to=2025-03-31","read", None, [200], "dashboard.customers"),
    ("GET", "/api/v1/dashboard/channel-analysis?date_from=2024-10-01&date_to=2025-03-31","read", None, [200], "dashboard.channel_analysis"),
    ("GET", "/api/v1/dashboard/cohort?date_from=2024-10-01&date_to=2025-03-31",   "read", None, [200], "dashboard.cohort"),
    ("GET", "/api/v1/dashboard/campaign?date_from=2024-10-01&date_to=2025-03-31", "read", None, [200], "dashboard.campaign"),

    # ADMIN GETs
    ("GET", "/api/v1/users",                       "read", None, [200], "admin.users"),
    ("GET", "/api/v1/roles",                       "read", None, [200], "admin.roles"),
    ("GET", "/api/v1/permissions",                 "read", None, [200], "admin.permissions"),
    ("GET", "/api/v1/admin/audit-logs",            "read", None, [200], "admin.audit_logs"),
    ("GET", "/api/v1/admin/channel-mappings",      "read", None, [200], "admin.channel_mappings"),
    ("GET", "/api/v1/saved-views",                 "read", None, [200], "admin.saved_views"),
    ("GET", "/api/v1/imports",                     "read", None, [200], "imports.list"),
    ("GET", "/api/v1/imports/data-types",          "read", None, [200], "imports.data_types"),
    ("GET", "/api/v1/reports",                     "read", None, [200], "reports.list"),
    ("GET", "/api/v1/reports/sections",            "read", None, [200], "reports.sections"),

    # AUTH-GATE: token YOK iken mutasyon → 401 bekleriz
    ("POST",   "/api/v1/users",                  "noauth", {"email":"x@x.com"},        [401], "users.create.noauth"),
    ("POST",   "/api/v1/roles",                  "noauth", {"name":"x"},               [401], "roles.create.noauth"),
    ("POST",   "/api/v1/saved-views",            "noauth", {"name":"x"},               [401], "saved_views.create.noauth"),
    ("POST",   "/api/v1/admin/channel-mappings", "noauth", {"channel":"x"},            [401], "channel_mappings.create.noauth"),
    ("POST",   "/api/v1/admin/aggregations/rebuild", "noauth", {},                     [401], "aggregations.rebuild.noauth"),
    ("DELETE", "/api/v1/users/9999999",          "noauth", None,                       [401], "users.delete.noauth"),
    ("DELETE", "/api/v1/roles/9999999",          "noauth", None,                       [401], "roles.delete.noauth"),
    ("PATCH",  "/api/v1/users/9999999",          "noauth", {},                         [401], "users.patch.noauth"),
    ("PATCH",  "/api/v1/roles/9999999",          "noauth", {},                         [401], "roles.patch.noauth"),

    # AUTH'LU validation kontrolü — geçersiz payload → 422 / mevcut olmayan id → 404
    ("PATCH",  "/api/v1/users/9999999",          "validate", {"first_name":"X"},        [404], "users.patch(missing)"),
    ("DELETE", "/api/v1/users/9999999",          "validate", None,                      [404], "users.delete(missing)"),
    ("DELETE", "/api/v1/roles/9999999",          "validate", None,                      [404], "roles.delete(missing)"),
    ("DELETE", "/api/v1/saved-views/9999999",    "validate", None,                      [404], "saved_views.delete(missing)"),
    ("DELETE", "/api/v1/admin/channel-mappings/9999999", "validate", None,              [404], "channel_mappings.delete(missing)"),
    ("DELETE", "/api/v1/imports/9999999",        "validate", None,                      [404], "imports.delete(missing)"),
    ("DELETE", "/api/v1/reports/9999999",        "validate", None,                      [404], "reports.delete(missing)"),

    # PASSWORD/EMAIL flows (mutasyon yapmıyorlar — sadece response code'u alalım)
    ("POST",   "/api/v1/auth/forgot-password",   "post_check", {"email":"nonexist@example.com"}, [200,202,204,400], "auth.forgot(noexist)"),
    ("POST",   "/api/v1/auth/reset-password",    "post_check", {"token":"bad","new_password":"Aa1!aaaa"}, [400,422], "auth.reset(bad-token)"),
]


def http(method: str, path: str, *, body: Any = None, token: Optional[str] = None, raw: bool = False, cookie: Optional[str] = None, return_set_cookie: bool = False):
    url = BASE + path
    headers = {"Accept": "application/json"}
    data: bytes | None = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw_body = resp.read().decode(errors="replace")
            try:
                parsed = json.loads(raw_body)
            except Exception:
                parsed = None
            set_cookie = resp.getheader("Set-Cookie") or ""
            if return_set_cookie:
                return resp.status, raw_body[:200], parsed, set_cookie
            return resp.status, raw_body[:200], parsed
    except urllib.error.HTTPError as e:
        raw_body = e.read().decode(errors="replace") if e.fp else ""
        try:
            parsed = json.loads(raw_body)
        except Exception:
            parsed = None
        if return_set_cookie:
            return e.code, raw_body[:200], parsed, ""
        return e.code, raw_body[:200], parsed
    except Exception as e:
        if return_set_cookie:
            return 0, f"ERR: {e}", None, ""
        return 0, f"ERR: {e}", None


def extract_refresh_cookie(set_cookie_header: str) -> str:
    for piece in set_cookie_header.split(";"):
        piece = piece.strip()
        if piece.startswith("sporthink_refresh="):
            return piece
    return ""


def login_with_cookie() -> tuple[str, str]:
    """Manuel HTTPResponse açarak Set-Cookie header'ını da yakala."""
    url = BASE + "/api/v1/auth/login"
    body = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw_body = resp.read().decode()
        parsed = json.loads(raw_body)
        cookies = resp.getheader("Set-Cookie") or ""
    token = parsed["data"]["access_token"]
    # Sadece refresh_token cookie'sini sakla — diğerleri opsiyonel
    cookie_kv = ""
    for part in cookies.split(","):
        for piece in part.split(";"):
            piece = piece.strip()
            if piece.lower().startswith("refresh_token=") or piece.lower().startswith("sporthink_refresh="):
                cookie_kv = piece
                break
        if cookie_kv:
            break
    if not cookie_kv:
        # fallback: ilk segmenti al
        cookie_kv = cookies.split(";")[0].strip() if cookies else ""
    return token, cookie_kv


def login() -> tuple[str, str]:
    return login_with_cookie()


def main():
    print("=" * 80)
    print("LOGIN PASS 1")
    print("=" * 80)
    t0 = time.time()
    token, refresh = login()
    print(f"  ✓ login #1: 200  ({time.time()-t0:.2f}s)  token={token[:24]}...  cookie={refresh[:32]}")

    t0 = time.time()
    token2, refresh2 = login()
    print(f"  ✓ login #2: 200  ({time.time()-t0:.2f}s)  token={token2[:24]}...")
    assert token != token2, "Tokens should differ between logins (different jti)"
    print("  ✓ JTI farkı doğrulandı (her login → yeni token)")

    results = []  # (label, run1_code, run2_code, expected, ok, summary)

    for ep in ENDPOINTS:
        method, path, mode, body, expect, label = ep
        # Twice
        codes = []
        bodies = []
        for run in (1, 2):
            t = time.time()
            if mode == "read" or mode == "preview" or mode == "validate" or mode == "post_check":
                code, raw, parsed = http(method, path, body=body, token=token)
            elif mode == "refresh":
                # Token rotation: her çağrıdan sonra yeni cookie gelir;
                # bir sonraki çağrı için onu kullan.
                code, raw, parsed, sc = http(
                    method, path, body=body, cookie=refresh, return_set_cookie=True,
                )
                new_cookie = extract_refresh_cookie(sc)
                if new_cookie:
                    refresh = new_cookie
            elif mode == "noauth":
                code, raw, parsed = http(method, path, body=body, token=None)
            elif mode == "raw":
                qs = body.get("qs","") if isinstance(body, dict) else ""
                code, raw, parsed = http(method, path + qs, token=token)
            else:
                code, raw, parsed = http(method, path, body=body, token=token)
            codes.append(code)
            bodies.append(raw[:80])

        ok = all(c in expect for c in codes) and codes[0] == codes[1] if mode != "refresh" else all(c == 200 for c in codes)
        # refresh: yeni access token üretildiği için OK
        sym = "✓" if ok else "✗"
        print(f"  {sym} [{label:42}] {method:6} {codes[0]:3} / {codes[1]:3}  expect={expect}")
        results.append((label, codes[0], codes[1], expect, ok, bodies[0]))

    print()
    print("=" * 80)
    bad = [r for r in results if not r[4]]
    if bad:
        print(f"FAIL ({len(bad)}/{len(results)}):")
        for r in bad:
            print(f"  ✗ {r[0]}: {r[1]} / {r[2]} (expect {r[3]}) → {r[5]}")
    else:
        print(f"ALL PASS ({len(results)}/{len(results)} endpoints, each ×2)")
    print("=" * 80)
    sys.exit(0 if not bad else 1)


if __name__ == "__main__":
    main()
