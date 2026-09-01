# dsh-development

[Cursor Agent Skill](https://cursor.com/docs/agent/skills) for **DeepSeek Harness (DSH)** plugin and tool development.

Guides the agent through Cordis plugins, profile/bundle installation, tool conventions, client UI, Conversation Nodes, LLM adapters, and local troubleshooting — with progressive disclosure via reference files.

## When to use

Load this skill when working on:

- DSH / DeepSeek Harness plugins or tools
- `dsh plugin add/remove`, `cordis.patch.yml`, profile bundles
- Settings not persisting, duplicate loader entry id, upgrade breakage
- Client UI (settings sections, webServer routes, Chat nodes)

## Install

**Option A — clone into agent skills directory**

```bash
git clone https://github.com/lordqyxz/dsh-development.git ~/.agents/skills/dsh-development
```

**Option B — Cursor personal skills**

```bash
git clone https://github.com/lordqyxz/dsh-development.git ~/.cursor/skills/dsh-development
```

**Option C — symlink** (keep a dev checkout elsewhere)

```bash
ln -s /path/to/dsh-development ~/.agents/skills/dsh-development
```

Restart Cursor or start a new agent session so the skill is discovered.

## Structure

```
dsh-development/
├── SKILL.md              # Hub (~100 lines): task routing, quick start, TL;DR
├── references/           # Topic references (load on demand)
│   ├── plugins.md        # Install, bundle layers, CLI, publish
│   ├── restart.md        # Hot reload vs restart
│   ├── cordis.md         # Cordis concepts, framework, plugin writing
│   ├── architecture.md   # Harness architecture & extension map
│   ├── capabilities.md   # Tools, extensions, Conversation Node, LLM
│   ├── client-ui.md      # Settings UI, slots, webServer routes
│   ├── docs-index.md     # Official docs & deep reference index
│   ├── environment.md    # Local $DSH_HOME facts
│   └── troubleshooting.md
└── docs-official/        # Offline Chinese doc snippets + INDEX
```

The agent reads `SKILL.md` first, then follows links to `references/` only when needed.

## Official docs

Full upstream documentation lives in the [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) repository. This skill indexes paths under `docs/` and ships a few offline `.zh.md` copies in `docs-official/`.

Recommended local clone (read-only reference):

```bash
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git ~/dev/deepseek-harness
```

## Updating the skill

```bash
cd ~/.agents/skills/dsh-development
git pull
```

## License

MIT — see [LICENSE](LICENSE).
