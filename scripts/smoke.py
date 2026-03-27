#!/usr/bin/env python3
import json
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_CMD = f"node {ROOT / 'src' / 'index.mjs'}"


def run_tool(tool: str, args: dict):
    cmd = [
        "mcporter",
        "call",
        "--stdio",
        SERVER_CMD,
        tool,
        "--args",
        json.dumps(args, ensure_ascii=False),
    ]
    out = subprocess.check_output(cmd, text=True)
    return json.loads(out)


def check(name: str, fn):
    try:
        ok, details = fn()
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {details}")
        return ok
    except subprocess.CalledProcessError as e:
        print(f"[FAIL] {name}: command failed\n{e.output}")
        return False
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        return False


def t_help():
    r = run_tool("wttr_help", {})
    ok = r.get("ok") is True and ":help" in r.get("url", "")
    return ok, r.get("contentType", "")


def t_site_weather():
    r = run_tool("wttr_site_weather", {"location": "Saint Petersburg", "mode": "3", "lang": "ru"})
    ok = r.get("ok") is True and "weather" in r
    preview = (r.get("weather", "") or "").splitlines()[0:1]
    return ok, preview[0] if preview else "<empty>"


def t_api_current():
    r = run_tool("wttr_api_current", {"location": "Saint Petersburg", "lang": "ru"})
    c = r.get("current", {})
    ok = r.get("ok") is True and isinstance(c, dict) and "temperatureC" in c
    return ok, {k: c.get(k) for k in ["temperatureC", "feelsLikeC", "humidity", "condition"]}


def t_api_forecast():
    r = run_tool("wttr_api_forecast", {"location": "Saint Petersburg", "days": 2})
    f = r.get("forecast", [])
    ok = r.get("ok") is True and isinstance(f, list) and len(f) == 2
    return ok, f"days={len(f)}"


def t_raw_translation():
    r = run_tool("wttr_raw_request", {"path": ":translation"})
    txt = r.get("text", "")
    ok = r.get("ok") is True and "translated" in txt
    return ok, "translation text present"


def t_raw_png():
    r = run_tool(
        "wttr_raw_request",
        {"path": "Paris.png", "query": "p&transparency=150", "responseType": "base64"},
    )
    ok = (
        r.get("ok") is True
        and str(r.get("contentType", "")).startswith("image/")
        and int(r.get("bytes", 0)) > 1000
        and isinstance(r.get("base64"), str)
        and len(r.get("base64", "")) > 100
    )
    return ok, {"contentType": r.get("contentType"), "bytes": r.get("bytes")}


def t_raw_accept_language():
    r = run_tool("wttr_raw_request", {"path": "Paris", "query": "3", "acceptLanguage": "fr"})
    ok = r.get("ok") is True and "Prévisions" in r.get("text", "")
    return ok, "fr locale response"


def t_known_upstream_500():
    r = run_tool("wttr_raw_request", {"path": ":bash.function"})
    e = r.get("error", {})
    ok = r.get("ok") is False and e.get("code") == "UPSTREAM"
    return ok, e.get("message")


def main():
    tests = [
        ("help", t_help),
        ("site-weather", t_site_weather),
        ("api-current", t_api_current),
        ("api-forecast", t_api_forecast),
        ("raw-translation", t_raw_translation),
        ("raw-png-base64", t_raw_png),
        ("raw-accept-language", t_raw_accept_language),
        ("known-upstream-500-bash-function", t_known_upstream_500),
    ]

    all_ok = True
    for name, fn in tests:
        all_ok = check(name, fn) and all_ok

    if all_ok:
        print("\nSmoke test: OK")
        return 0

    print("\nSmoke test: FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
