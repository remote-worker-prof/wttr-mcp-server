#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Install/update wttr MCP server in Codex ~/.codex/config.toml")
    p.add_argument("--config", required=True, help="Path to Codex config.toml")
    p.add_argument("--server-name", default="wttr_mcp", help="Codex mcp_servers key (TOML table suffix)")
    p.add_argument("--mode", choices=["source", "docker"], default="source")
    p.add_argument("--project-root", required=True, help="Project root path")
    p.add_argument("--docker-image", default="markstroinyi/wttr-mcp-server:latest")
    p.add_argument("--startup-timeout", type=float, default=30.0)
    p.add_argument("--tool-timeout", type=float, default=120.0)
    return p.parse_args()


def toml_array(values):
    return json.dumps(values, ensure_ascii=False)


def build_block(server_name: str, mode: str, project_root: Path, docker_image: str, startup: float, tool: float):
    if mode == "docker":
        command = "docker"
        args = ["run", "--rm", "-i", docker_image]
    else:
        command = "node"
        args = [str(project_root / "src" / "index.mjs")]

    lines = [
        f"[mcp_servers.{server_name}]",
        f'command = "{command}"',
        f"args = {toml_array(args)}",
        f"startup_timeout_sec = {startup:.1f}",
        f"tool_timeout_sec = {tool:.1f}",
    ]
    return "\n".join(lines) + "\n"


def upsert_section(text: str, section_name: str, block: str):
    pattern = re.compile(
        rf"(?ms)^\[mcp_servers\.{re.escape(section_name)}\]\n.*?(?=^\[|\Z)"
    )
    if pattern.search(text):
        return pattern.sub(block + "\n", text, count=1), "updated"

    if text and not text.endswith("\n"):
        text += "\n"
    return text + "\n" + block, "added"


def main():
    args = parse_args()
    config_path = Path(args.config).expanduser()
    project_root = Path(args.project_root).expanduser().resolve()

    original = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    block = build_block(
        server_name=args.server_name,
        mode=args.mode,
        project_root=project_root,
        docker_image=args.docker_image,
        startup=args.startup_timeout,
        tool=args.tool_timeout,
    )

    updated, status = upsert_section(original, args.server_name, block)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(updated, encoding="utf-8")

    print(f"{status.capitalize()} Codex MCP section in {config_path}")
    print(f"  section: [mcp_servers.{args.server_name}]")
    print(f"  mode:    {args.mode}")


if __name__ == "__main__":
    main()
