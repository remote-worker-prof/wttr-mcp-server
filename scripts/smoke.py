#!/usr/bin/env python3
"""Smoke tests for wttr-mcp-server over stdio via mcporter.

This suite is intentionally high-signal and low-overhead:
- it validates end-to-end tool wiring,
- exercises core success paths,
- and verifies one known upstream failure path.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Tuple

ROOT = Path(__file__).resolve().parents[1]
SERVER_CMD = f"node {ROOT / 'src' / 'index.mjs'}"
TestFn = Callable[[], Tuple[bool, Any]]


def run_tool(tool: str, args: dict[str, Any]) -> dict[str, Any]:
    """Call a tool over stdio using mcporter.

    Args:
        tool: MCP tool name.
        args: JSON-serializable arguments for the tool.

    Returns:
        Parsed JSON response from mcporter.

    Raises:
        subprocess.CalledProcessError: If command execution fails.
        json.JSONDecodeError: If output is not valid JSON.
    """
    cmd = [
        "mcporter",
        "call",
        "--stdio",
        SERVER_CMD,
        tool,
        "--args",
        json.dumps(args, ensure_ascii=False),
    ]
    output = subprocess.check_output(cmd, text=True)
    return json.loads(output)


def check(name: str, fn: TestFn) -> bool:
    """Run one smoke test and print status line.

    Args:
        name: Human-readable test name.
        fn: Test function returning `(ok, details)`.

    Returns:
        True when test passed, False otherwise.
    """
    try:
        ok, details = fn()
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {details}")
        return ok
    except subprocess.CalledProcessError as error:
        print(f"[FAIL] {name}: command failed\n{error.output}")
        return False
    except Exception as error:  # pylint: disable=broad-except
        print(f"[FAIL] {name}: {error}")
        return False


def t_help() -> Tuple[bool, Any]:
    """Validate wttr_help endpoint basics."""
    response = run_tool("wttr_help", {})
    ok = response.get("ok") is True and ":help" in response.get("url", "")
    return ok, response.get("contentType", "")


def t_site_weather() -> Tuple[bool, Any]:
    """Validate quick site-weather text response."""
    response = run_tool("wttr_site_weather", {"location": "Saint Petersburg", "mode": "3", "lang": "ru"})
    ok = response.get("ok") is True and "weather" in response
    preview = (response.get("weather", "") or "").splitlines()[0:1]
    return ok, preview[0] if preview else "<empty>"


def t_weather_view_normal() -> Tuple[bool, Any]:
    """Validate default summary strategy output."""
    response = run_tool("wttr_weather_view", {"location": "Saint Petersburg", "agent": "openclaw", "days": 2})
    text = response.get("text", "")
    ok = response.get("ok") is True and response.get("view") == "normal" and "Now:" in text and "Forecast" in text
    return ok, response.get("view")


def t_weather_view_ascii_codex() -> Tuple[bool, Any]:
    """Validate codex profile: compact ASCII and no ANSI codes."""
    response = run_tool("wttr_weather_view", {"location": "Saint Petersburg", "agent": "codex", "lang": "ru"})
    text = response.get("text", "")
    ok = (
        response.get("ok") is True
        and response.get("view") == "ascii_compact"
        and isinstance(text, str)
        and len(text.splitlines()) >= 5
        and "\u001b[" not in text
    )
    return ok, response.get("view")


def t_weather_view_ascii_terminal_ansi() -> Tuple[bool, Any]:
    """Validate terminal profile: full ASCII with ANSI kept."""
    response = run_tool(
        "wttr_weather_view",
        {"location": "Saint Petersburg", "agent": "terminal", "lang": "ru", "ansi": True},
    )
    text = response.get("text", "")
    ok = (
        response.get("ok") is True
        and response.get("view") == "ascii_full"
        and isinstance(text, str)
        and "\u001b[" in text
    )
    return ok, response.get("view")


def t_api_current() -> Tuple[bool, Any]:
    """Validate structured current-weather payload."""
    response = run_tool("wttr_api_current", {"location": "Saint Petersburg", "lang": "ru"})
    current = response.get("current", {})
    ok = response.get("ok") is True and isinstance(current, dict) and "temperatureC" in current
    return ok, {key: current.get(key) for key in ["temperatureC", "feelsLikeC", "humidity", "condition"]}


def t_api_forecast() -> Tuple[bool, Any]:
    """Validate 2-day forecast branch and count."""
    response = run_tool("wttr_api_forecast", {"location": "Saint Petersburg", "days": 2})
    forecast = response.get("forecast", [])
    ok = response.get("ok") is True and isinstance(forecast, list) and len(forecast) == 2
    return ok, f"days={len(forecast)}"


def t_raw_translation() -> Tuple[bool, Any]:
    """Validate raw translation endpoint response."""
    response = run_tool("wttr_raw_request", {"path": ":translation"})
    text = response.get("text", "")
    ok = response.get("ok") is True and "translated" in text
    return ok, "translation text present"


def t_raw_png() -> Tuple[bool, Any]:
    """Validate PNG binary path encoded as base64."""
    response = run_tool(
        "wttr_raw_request",
        {"path": "Paris.png", "query": "p&transparency=150", "responseType": "base64"},
    )
    ok = (
        response.get("ok") is True
        and str(response.get("contentType", "")).startswith("image/")
        and int(response.get("bytes", 0)) > 1000
        and isinstance(response.get("base64"), str)
        and len(response.get("base64", "")) > 100
    )
    return ok, {"contentType": response.get("contentType"), "bytes": response.get("bytes")}


def t_raw_accept_language() -> Tuple[bool, Any]:
    """Validate locale override through Accept-Language header."""
    response = run_tool("wttr_raw_request", {"path": "Paris", "query": "3", "acceptLanguage": "fr"})
    ok = response.get("ok") is True and "Prévisions" in response.get("text", "")
    return ok, "fr locale response"


def t_known_upstream_500() -> Tuple[bool, Any]:
    """Validate known upstream failure is mapped to UPSTREAM error code."""
    response = run_tool("wttr_raw_request", {"path": ":bash.function"})
    error = response.get("error", {})
    ok = response.get("ok") is False and error.get("code") == "UPSTREAM"
    return ok, error.get("message")


def main() -> int:
    """Run smoke suite and return process exit code.

    Returns:
        0 if all tests pass, otherwise 1.
    """
    tests: list[tuple[str, TestFn]] = [
        ("help", t_help),
        ("site-weather", t_site_weather),
        ("weather-view-normal", t_weather_view_normal),
        ("weather-view-ascii-codex", t_weather_view_ascii_codex),
        ("weather-view-ascii-terminal-ansi", t_weather_view_ascii_terminal_ansi),
        ("api-current", t_api_current),
        ("api-forecast", t_api_forecast),
        ("raw-translation", t_raw_translation),
        ("raw-png-base64", t_raw_png),
        ("raw-accept-language", t_raw_accept_language),
        ("known-upstream-500-bash-function", t_known_upstream_500),
    ]

    all_ok = True
    for name, fn in tests:
        # Evaluate every test even when one fails to keep debugging visibility high.
        all_ok = check(name, fn) and all_ok

    if all_ok:
        print("\nSmoke test: OK")
        return 0

    print("\nSmoke test: FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
