#!/usr/bin/env python3
"""Extended E2E: full workflow + new industrial-practice rules.

Run: python3 /tmp/e2e_v3.py
"""
import json
import time

UNIQ = str(int(time.time()))
import subprocess

B = "https://localhost"


def curl(method, path, body=None, cookie_file=None, cookie_save=None):
    cmd = ["curl", "-sk", "-X", method, f"{B}{path}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    if cookie_file:
        cmd += ["-b", cookie_file]
    if cookie_save:
        cmd += ["-c", cookie_save]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except (json.JSONDecodeError, ValueError):
        return out


def code(method, path, body=None, cookie_file=None):
    cmd = ["curl", "-sk", "-o", "/dev/null", "-w", "%{http_code}", "-X", method, f"{B}{path}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    if cookie_file:
        cmd += ["-b", cookie_file]
    return subprocess.run(cmd, capture_output=True, text=True).stdout


ok = 0
fail = 0


def check(label, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"PASS  {label}")
    else:
        fail += 1
        print(f"FAIL  {label}  {detail}")


# --- 1. Original full ladder ---
r = curl("POST", "/api/requests", {
    "name": "Sara Client", "email": "sara3+1789306250@test.com",
    "service": "Website / landing page", "urgency": "ASAP — within days",
    "details": "Landing page for my bakery business"})
rid = r.get("id")
check("1. anonymous submit", rid is not None, str(r))

curl("POST", "/api/auth/login", {"email": "admin@devdesk.test", "password": "admin-test-pw-123"},
     cookie_save="/tmp/e2e-admin.txt")
data = curl("GET", "/api/admin/requests", cookie_file="/tmp/e2e-admin.txt")
mine = [x for x in data["requests"] if x["id"] == rid][0]
check("admin sees request", mine["status"] == "submitted", str(mine["status"]))

r = curl("PUT", f"/api/admin/requests/{rid}",
         {"status": "quoted", "quote_price": 250, "quote_date": "2026-09-20"},
         cookie_file="/tmp/e2e-admin.txt")
check("2. quote set", r.get("ok") is True, str(r))

r = curl("POST", "/api/auth/register", {"email": "sara3+1789306250@test.com", "password": "sara-pass-123"},
         cookie_save="/tmp/e2e-sara.txt")
data = curl("GET", "/api/portal/requests", cookie_file="/tmp/e2e-sara.txt")
req = data["requests"][0]
check("3. portal shows claimed quoted request",
      req["status"] == "quoted" and req["quote_price"] == "250", str(req))

r = curl("POST", f"/api/portal/requests/{rid}/decision", {"decision": "accept"},
         cookie_file="/tmp/e2e-sara.txt")
check("4. accept", r.get("status") == "accepted", str(r))

curl("PUT", f"/api/admin/requests/{rid}", {"status": "in_progress"}, cookie_file="/tmp/e2e-admin.txt")
curl("PUT", f"/api/admin/requests/{rid}",
     {"status": "delivered", "preview_url": "https://bakery-preview.example.com"},
     cookie_file="/tmp/e2e-admin.txt")
data = curl("GET", "/api/portal/requests", cookie_file="/tmp/e2e-sara.txt")
check("5. client sees preview",
      data["requests"][0].get("preview_url") == "https://bakery-preview.example.com",
      str(data["requests"][0]))

r = curl("PUT", f"/api/admin/requests/{rid}", {"status": "paid"}, cookie_file="/tmp/e2e-admin.txt")
data = curl("GET", "/api/portal/requests", cookie_file="/tmp/e2e-sara.txt")
check("6. paid", data["requests"][0]["status"] == "paid", str(r))

# --- 2. NEW: admin cannot skip ladder steps ---
r2 = curl("POST", "/api/requests", {
    "name": "Skip Test", "email": "skip+1789306250@test.com",
    "service": "Bug fix / debugging", "urgency": "Flexible",
    "details": "test skipping ladder"})
sid = r2["id"]
c = code("PUT", f"/api/admin/requests/{sid}", {"status": "paid"},
         cookie_file="/tmp/e2e-admin.txt")
check("7. submitted->paid rejected (409)", c == "409", c)
c = code("PUT", f"/api/admin/requests/{sid}", {"status": "delivered"},
         cookie_file="/tmp/e2e-admin.txt")
check("8. submitted->delivered rejected (409)", c == "409", c)

# --- 3. NEW: admin cannot go backwards ---
curl("PUT", f"/api/admin/requests/{sid}", {"status": "quoted"}, cookie_file="/tmp/e2e-admin.txt")
c = code("PUT", f"/api/admin/requests/{sid}", {"status": "submitted"},
         cookie_file="/tmp/e2e-admin.txt")
check("9. quoted->submitted backwards rejected (409)", c == "409", c)

# --- 4. NEW: quoted requires a price? (info only) — accept without price then check quote ---
r = curl("PUT", f"/api/admin/requests/{sid}", {"quote_price": None},
         cookie_file="/tmp/e2e-admin.txt")
check("10. clearing quote price works (null)", r.get("ok") is True, str(r))
data = curl("GET", "/api/admin/requests", cookie_file="/tmp/e2e-admin.txt")
row = [x for x in data["requests"] if x["id"] == sid][0]
check("11. quote_price is null after clear", row.get("quote_price") is None, str(row.get("quote_price")))

# --- 5. NEW: javascript: preview URL rejected ---
r3 = curl("POST", "/api/requests", {
    "name": "XSS Test", "email": "xss+1789306250@test.com",
    "service": "Script / automation", "urgency": "Flexible",
    "details": "test preview url validation"})
xid = r3["id"]
curl("PUT", f"/api/admin/requests/{xid}", {"status": "quoted"}, cookie_file="/tmp/e2e-admin.txt")
r = curl("PUT", f"/api/admin/requests/{xid}", {"preview_url": "javascript:alert(1)"},
         cookie_file="/tmp/e2e-admin.txt")
check("12. javascript: preview_url rejected", "error" in r and "http" in r.get("error", ""), str(r))
r = curl("PUT", f"/api/admin/requests/{xid}", {"preview_url": "https://ok.example.com/x"},
         cookie_file="/tmp/e2e-admin.txt")
check("13. https preview_url accepted", r.get("ok") is True, str(r))
r = curl("PUT", f"/api/admin/requests/{xid}", {"preview_url": ""},
         cookie_file="/tmp/e2e-admin.txt")
check("14. empty string clears preview_url", r.get("ok") is True, str(r))

# --- 6. NEW: 73+ byte password rejected, not 500 ---
c = code("POST", "/api/auth/register",
         {"email": "longpw+1789306250@test.com", "password": "x" * 100})
check("15. 100-char password rejected 400 (no 500)", c == "400", c)

# --- 7. NEW: rate limiting on login (10/min burst 5) ---
codes = []
for i in range(10):
    codes.append(code("POST", "/api/auth/login",
                      {"email": "brute+1789306250@test.com", "password": f"wrong-{i}"}))
seen_429 = "429" in codes
check("16. login brute-force gets 429", seen_429, str(codes))

# --- 8. NEW: public form rate limit (10 burst) ---
codes = []
for i in range(14):
    codes.append(code("POST", "/api/requests", {
        "name": "rl", "email": "rl+1789306250@test.com", "service": "s", "urgency": "u", "details": "d"}))
check("17. form spam gets 429", "429" in codes, str(codes))

# --- 9. original security sweeps still hold ---
c = code("GET", "/api/admin/requests", cookie_file="/tmp/e2e-sara.txt")
check("18. client blocked from admin list (403)", c == "403", c)
c = code("POST", f"/api/portal/requests/{rid}/decision", {"decision": "accept"})
check("19. anonymous decision -> 401", c == "401", c)
c = code("POST", f"/api/portal/requests/{rid}/decision", {"decision": "decline"},
         cookie_file="/tmp/e2e-sara.txt")
check("20. decline on paid request -> 409 now (was 404)", c == "409", c)

# --- 10. unknown status error message no longer lies ---
r = curl("PUT", f"/api/admin/requests/{sid}", {"status": "bogus"},
         cookie_file="/tmp/e2e-admin.txt")
check("21. unknown status message correct",
      "unknown status" in r.get("error", ""), str(r))

print(f"\n{ok} passed, {fail} failed")
