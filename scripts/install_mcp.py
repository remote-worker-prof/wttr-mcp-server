#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="Install/update wttr-mcp entry in agent config JSON")
    p.add_argument("--config", required=True, help="Path to agent config JSON")
    p.add_argument("--root-key", default="mcpServers", help="Dot-path to MCP servers map (default: mcpServers)")
    p.add_argument("--server-name", default="wttr-mcp", help="Server key name")
    p.add_argument("--mode", choices=["source", "docker"], default="source")
    p.add_argument("--project-root", required=True, help="Project root path")
    p.add_argument("--docker-image", default="markstroinyi/wttr-mcp-server:latest")
    return p.parse_args()


def load_json(path: Path):
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    return json.loads(text)


def ensure_path(obj, dot_key: str):
    keys = [k for k in dot_key.split(".") if k]
    cur = obj
    for k in keys:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]
    return cur


def make_entry(mode: str, project_root: Path, docker_image: str):
    if mode == "docker":
        return {
            "command": "docker",
            "args": ["run", "--rm", "-i", docker_image],
            "description": f"wttr.in weather MCP via Docker image {docker_image}",
        }

    return {
        "command": "node",
        "args": [str(project_root / "src" / "index.mjs")],
        "description": f"wttr.in weather MCP from {project_root}",
    }


def main():
    args = parse_args()
    config_path = Path(args.config).expanduser()
    project_root = Path(args.project_root).expanduser().resolve()

    data = load_json(config_path)
    servers = ensure_path(data, args.root_key)
    servers[args.server_name] = make_entry(args.mode, project_root, args.docker_image)

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Updated {config_path}")
    print(f"  root key: {args.root_key}")
    print(f"  server:   {args.server_name}")
    print(f"  mode:     {args.mode}")


if __name__ == "__main__":
    main()
