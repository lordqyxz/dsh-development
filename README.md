# dsh-development

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Agent Skill](https://img.shields.io/badge/format-Agent%20Skill-6366f1)](https://agentskills.io)

**跨 Agent 通用的 DeepSeek Harness (DSH) 插件 / 工具开发 Skill** — 供 Cursor、Claude Code、Codex 等 AI 助手加载，指导 Cordis 插件编写、bundle 安装、配置调试与客户端 UI。

A **portable Agent Skill** (standard `SKILL.md` + `references/`) for **DeepSeek Harness (DSH)** plugin and tool development — works with any agent that supports the [Agent Skills](https://agentskills.io) format.

---

## 简介

本仓库遵循 **Agent Skills 开放格式**（根目录 `SKILL.md` + YAML frontmatter + 可选参考文件），**不绑定单一 IDE 或厂商**：

| 主题 | 内容 |
|---|---|
| 插件安装 | `dsh plugin add/remove`、profile / bundle、层序、`--patch` 原型 |
| 依赖边界 | DSH 宿主 peer/dev 依赖、版本对齐、官方/已安装分类、卸载残留审计 |
| Cordis | 概念、Fiber 状态机、Config schema、插件写法 |
| 能力扩展 | 工具规约、Conversation Node、LLM 适配器、扩展钩子 |
| MCP 桥接 | 官方 `@deepseek-ai/dsh-mcp-client` 与纯插件承载的选型、配置键、`mcp__<name>__*` 工具命名 |
| 客户端 UI | 设置页槽位、webServer 路由、settings 白名单规避 |
| 排障 | 重启语义、duplicate id、升级 fallback、已知坑 |

采用**渐进披露**：`SKILL.md`（~100 行）作任务路由，细节在 `references/` 按需加载。

**上游文档**：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT，本 skill 索引其 `docs/`，并附带少量离线中文副本）· [文档站](https://deepseek-harness.github.io/deepseek-harness/)。

---

## 兼容的 Agent

只要支持从技能目录加载 `SKILL.md` 的 Agent 均可使用，例如：

| Agent | 典型技能目录 |
|---|---|
| **通用（推荐）** | `~/.agents/skills/` |
| Cursor | `~/.cursor/skills/` |
| Claude Code | `~/.claude/skills/` 或 `~/.agents/skills/` |
| 其他 | 见各产品文档中的 skills / rules 路径 |

同一仓库 clone 或 symlink 到对应目录即可，**无需改内容**。

---

## 何时使用

在以下场景让 Agent 加载本 skill：

- 开发 / 安装 / 调试 **DSH 插件**或工具
- 接入外部 **MCP server**（`@deepseek-ai/dsh-mcp-client`、`mcp__<name>__*` 工具命名）
- `dsh plugin add`、`cordis.patch.yml`、bundle 重复 insert
- 配置保存不生效、settings 白名单、`duplicate loader entry id`
- DSH 升级后首页 400、客户端 UI、Chat 自定义行

---

## 安装

```bash
# 推荐：Agent Skills CLI（Cursor / Claude Code / Codex 等自动装到对应目录）
npx skills add lordqyxz/dsh-development

# 或指定全局安装、非交互
npx skills add lordqyxz/dsh-development -g -y

# 备选：手动 git clone 到跨 Agent 共享目录
git clone https://github.com/lordqyxz/dsh-development.git ~/.agents/skills/dsh-development

# Cursor
git clone https://github.com/lordqyxz/dsh-development.git ~/.cursor/skills/dsh-development

# Claude Code（若使用 ~/.claude/skills）
git clone https://github.com/lordqyxz/dsh-development.git ~/.claude/skills/dsh-development

# 或软链到已有 checkout
ln -s /path/to/dsh-development ~/.agents/skills/dsh-development
```

安装后**重启 Agent 或新开会话**，由 Agent 根据 `description` 自动匹配加载。

---

## 目录结构

```
dsh-development/
├── SKILL.md              # 入口：frontmatter + 任务路由 + 快速开始
├── references/           # 专题参考（按需阅读）
│   ├── plugins.md        # 安装 / 卸载 / bundle / CLI
│   ├── dependencies.md   # 宿主依赖 / 版本对齐 / 官方分类 / 卸载审计
│   ├── restart.md        # 热更 vs 重启
│   ├── cordis.md         # Cordis 概念与插件写法
│   ├── architecture.md   # 架构与扩展点映射
│   ├── capabilities.md   # 工具 / Conversation Node / LLM
│   ├── mcp.md            # MCP 桥接：官方/社区路径与选型
│   ├── client-ui.md      # 设置页 / 槽位 / 路由
│   ├── docs-index.md     # 官方文档索引
│   ├── environment.md    # 本机 $DSH_HOME 事实
│   └── troubleshooting.md
└── docs-official/        # 离线中文文档片段 + INDEX
```

---

## 官方文档（本地克隆）

```bash
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness.git ~/dev/deepseek-harness
```

更新 skill：

```bash
cd ~/.agents/skills/dsh-development && git pull
```

---

## 标签

`agent-skill` · `ai-agent` · `deepseek-harness` · `dsh` · `cordis` · `plugin-development`

---

## License

MIT — see [LICENSE](LICENSE).
