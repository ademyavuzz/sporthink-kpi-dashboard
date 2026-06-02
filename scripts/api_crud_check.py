"""Sporthink — full CRUD round-trip smoke pass (mutating endpoints).

Login → her resource için create → patch → delete (cleanup garantili).
Roles, users, segments, saved-views, channel-mappings, reports için tam
tur; auth/me + avatar + change-password + aggregations rebuild de test
edilir. Hata olursa script orada durur ve ne yarattığını gösterir;
böylece manuel cleanup adımı net.

Sadece dev/staging'e karşı koş — gerçek mutasyonlar yapar (yarattıklarını
sonunda siler ama audit log'a kayıt düşer).

Kullanım:
    SPORTHINK_EMAIL=... SPORTHINK_PASSWORD=... python3 scripts/api_crud_check.py

Çevre değişkenleri:
    SPORTHINK_API_BASE  → varsayılan http://localhost:8000
    SPORTHINK_EMAIL     → süper admin email (zorunlu)
    SPORTHINK_PASSWORD  → süper admin şifre (zorunlu)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("SPORTHINK_API_BASE", "http://localhost:8000")
EMAIL = os.environ.get("SPORTHINK_EMAIL", "")
PASSWORD = os.environ.get("SPORTHINK_PASSWORD", "")

if not EMAIL or not PASSWORD:
    print("ERROR: SPORTHINK_EMAIL ve SPORTHINK_PASSWORD env değişkenlerini ayarla.")
    sys.exit(2)

created: list[tuple[str, str, str]] = []  # (resource, method, path-to-cleanup)
results: list[tuple[str, int, bool, str]] = []  # (label, code, ok, note)


def http(method: str, path: str, *, body=None, token=None, cookie=None,
         multipart: tuple[str, str, bytes, str] | None = None,
         expect_json: bool = True, timeout: int = 30):
    url = BASE + path
    headers = {"Accept": "application/json"}
    data = None
    if multipart is not None:
        field, filename, content, content_type = multipart
        boundary = "----sporthinkboundary7f8a"
        parts = [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            content,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        data = b"".join(parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            text = raw.decode("utf-8", errors="replace") if raw else ""
            if expect_json and text:
                try:
                    return resp.status, text, json.loads(text)
                except Exception:
                    return resp.status, text, None
            return resp.status, text[:80], None
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            return e.code, text, json.loads(text) if text else None
        except Exception:
            return e.code, text, None


def login():
    url = BASE + "/api/v1/auth/login"
    data = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
        cookies = resp.getheader("Set-Cookie") or ""
    token = body["data"]["access_token"]
    cookie_kv = ""
    for piece in cookies.split(";"):
        piece = piece.strip()
        if piece.startswith("sporthink_refresh="):
            cookie_kv = piece
            break
    return token, cookie_kv


def step(label: str, status: int, ok: bool, note: str = ""):
    sym = "✓" if ok else "✗"
    extra = f"  ({note})" if note else ""
    print(f"  {sym} [{label:42}] HTTP {status}{extra}")
    results.append((label, status, ok, note))
    if not ok:
        print()
        print("FAILED — payload:")
        print(note)
        print("\n--- created so far (manual cleanup may be needed) ---")
        for r in created:
            print(" ", r)
        sys.exit(1)


def section(name: str):
    print()
    print("─" * 70)
    print(f" {name}")
    print("─" * 70)


import base64
# Bilinen iyi 1×1 transparent PNG (test edilmiş, 70 byte)
PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def main():
    print("=" * 70)
    print(" CRUD ROUND-TRIP — mutasyon endpoint'leri")
    print("=" * 70)

    section("AUTH")
    t0 = time.time()
    token, refresh_cookie = login()
    step("login", 200, True, f"{time.time()-t0:.2f}s")

    # /auth/me PATCH (snapshot then revert)
    code, _, parsed = http("GET", "/api/v1/auth/me", token=token)
    me_orig = parsed["data"]["user"]
    step("auth.me.get", code, code == 200, "")

    new_bio = f"crud-test-{int(time.time())}"
    code, raw, parsed = http(
        "PATCH", "/api/v1/auth/me", token=token,
        body={"bio": new_bio, "first_name": me_orig["first_name"]},
    )
    step("auth.me.patch (set bio)", code, code == 200 and parsed["data"]["bio"] == new_bio, raw[:100])

    code, raw, _ = http(
        "PATCH", "/api/v1/auth/me", token=token,
        body={"bio": me_orig["bio"] or "", "first_name": me_orig["first_name"]},
    )
    step("auth.me.patch (revert bio)", code, code == 200, raw[:80])

    # Avatar upload + delete (re-upload original after if exists)
    orig_avatar = me_orig.get("avatar_url")
    code, raw, parsed = http(
        "POST", "/api/v1/auth/me/avatar", token=token,
        multipart=("file", "test.png", PNG_1x1, "image/png"),
    )
    step("auth.avatar.upload", code, code == 200, raw[:120])

    code, raw, _ = http("DELETE", "/api/v1/auth/me/avatar", token=token)
    step("auth.avatar.delete", code, code == 200, raw[:80])

    # Avatar geri yükle (original'i restore — UI bozulmasın)
    if orig_avatar:
        # Boş — orig URL backend'in fs'inde yok olduğu için skip; kullanıcı bilir.
        pass

    # /auth/me/change-password — sadece "wrong current" testi (gerçek değişiklik yok)
    code, raw, _ = http(
        "POST", "/api/v1/auth/me/change-password", token=token,
        body={"current_password": "WRONG-PASSWORD-9999", "new_password": "Aa1!aaaaaa"},
    )
    step("auth.change_password (wrong-current)", code, code in (400, 401, 422), raw[:120])

    section("ROLES")
    role_name = f"crud-test-role-{int(time.time())}"
    code, raw, parsed = http(
        "POST", "/api/v1/roles", token=token,
        body={"name": role_name, "description": "CRUD smoke", "color": "#888888",
              "permissions": ["dashboard.view", "users.view"]},
    )
    role_id = parsed["data"]["id"] if parsed and parsed.get("success") else None
    step("roles.create", code, code == 200 and role_id is not None, raw[:120])
    if role_id:
        created.append(("role", "DELETE", f"/api/v1/roles/{role_id}"))

    code, raw, parsed = http("GET", f"/api/v1/roles/{role_id}", token=token)
    step("roles.get_by_id", code, code == 200 and parsed["data"]["name"] == role_name, raw[:80])

    code, raw, _ = http(
        "PATCH", f"/api/v1/roles/{role_id}", token=token,
        body={"description": "updated by CRUD smoke",
              "permissions": ["dashboard.view", "users.view", "users.update"]},
    )
    step("roles.patch", code, code == 200, raw[:80])

    section("USERS")
    user_email = f"crud-{int(time.time())}@example.com"
    code, raw, parsed = http(
        "POST", "/api/v1/users", token=token,
        body={"email": user_email, "first_name": "Crud", "last_name": "Test", "role_id": role_id},
    )
    user_id = parsed["data"]["id"] if parsed and parsed.get("success") else None
    step("users.create", code, code == 200 and user_id, raw[:120])
    if user_id:
        created.append(("user", "DELETE", f"/api/v1/users/{user_id}"))

    code, raw, _ = http(
        "PATCH", f"/api/v1/users/{user_id}", token=token,
        body={"first_name": "CrudPatched", "is_active": True},
    )
    step("users.patch", code, code == 200, raw[:80])

    code, raw, parsed = http(
        "POST", f"/api/v1/users/{user_id}/reset-password", token=token,
        body={},
    )
    step("users.admin_reset_password", code, code == 200, raw[:120])

    section("SAVED-VIEWS")
    code, raw, parsed = http(
        "POST", "/api/v1/saved-views", token=token,
        body={"page": "overview", "name": f"crud-view-{int(time.time())}",
              "description": "smoke", "filters": {"date_from": "2024-10-01", "date_to": "2025-03-31"}},
    )
    view_id = parsed["data"]["id"] if parsed and parsed.get("success") else None
    step("saved_views.create", code, code == 200 and view_id, raw[:140])
    if view_id:
        created.append(("saved_view", "DELETE", f"/api/v1/saved-views/{view_id}"))

    code, raw, _ = http("PATCH", f"/api/v1/saved-views/{view_id}", token=token,
                       body={"description": "updated"})
    step("saved_views.patch", code, code == 200, raw[:80])

    section("CHANNEL-MAPPINGS")
    map_source = f"crud-{int(time.time())}"
    code, raw, parsed = http(
        "POST", "/api/v1/admin/channel-mappings", token=token,
        body={"source": map_source, "medium": "test", "channel_group": "Other",
              "notes": "smoke"},
    )
    map_id = parsed["data"]["id"] if parsed and parsed.get("success") else None
    step("channel_mappings.create", code, code == 200 and map_id, raw[:140])
    if map_id:
        created.append(("mapping", "DELETE", f"/api/v1/admin/channel-mappings/{map_id}"))

    code, raw, _ = http(
        "PATCH", f"/api/v1/admin/channel-mappings/{map_id}", token=token,
        body={"channel_group": "Direct", "notes": "updated"},
    )
    step("channel_mappings.patch", code, code == 200, raw[:80])

    section("REPORTS")
    code, raw, parsed = http(
        "POST", "/api/v1/reports", token=token,
        body={
            "name": f"crud-report-{int(time.time())}",
            "date_from": "2024-12-01",
            "date_to": "2024-12-31",
            "sections": ["overview"],
            "language": "tr",
        },
    )
    rep_id = parsed["data"]["id"] if parsed and parsed.get("success") else None
    step("reports.create", code, code == 201 and rep_id, raw[:160])
    if rep_id:
        created.append(("report", "DELETE", f"/api/v1/reports/{rep_id}"))

    code, raw, _ = http("GET", f"/api/v1/reports/{rep_id}", token=token)
    step("reports.get_by_id", code, code == 200, raw[:80])

    section("AGGREGATIONS REBUILD")
    code, raw, _ = http(
        "POST", "/api/v1/admin/aggregations/rebuild", token=token,
        body={"date_from": "2024-12-01", "date_to": "2024-12-02"},
        timeout=60,
    )
    step("aggregations.rebuild", code, code in (200, 202), raw[:160])

    section("CLEANUP — yarattığım her şeyi geri al")
    # Reverse order so FK dependencies don't bite (user → role)
    for resource, method, path in reversed(created):
        code, raw, _ = http(method, path, token=token)
        ok = code in (200, 204)
        step(f"cleanup.{resource}", code, ok, raw[:80])

    section("LOGOUT")
    code, raw, _ = http("POST", "/api/v1/auth/logout", token=token, cookie=refresh_cookie)
    step("auth.logout", code, code == 200, raw[:80])

    # Final summary
    print()
    print("=" * 70)
    failed = [r for r in results if not r[2]]
    if failed:
        print(f" FAIL ({len(failed)}/{len(results)})")
        for f in failed:
            print(f"   ✗ {f[0]}: HTTP {f[1]}  {f[3]}")
        sys.exit(1)
    else:
        print(f" ✓ ALL PASS ({len(results)} steps)")
        print(f" yarattığım {len(created)} kayıt da temizlendi.")
    print("=" * 70)


if __name__ == "__main__":
    main()
