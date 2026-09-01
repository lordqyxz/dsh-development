# dsh-development

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cursor Agent Skill](https://img.shields.io/badge/Cursor-Agent%20Skill-000000)](https://cursor.com/docs/agent/skills)

**DeepSeek Harness (DSH) 插件 / 工具开发的 Cursor Agent Skill** — 教 AI 助手如何写 Cordis 插件、安装 bundle、调试配置与客户端 UI。

[Cursor Agent Skill](https://cursor.com/docs/agent/skills) for **DeepSeek Harness (DSH)** plugin and tool development.

---

## 简介

本仓库是一份可安装的 Agent Skill，覆盖 DSH 插件开发常见路径：

| 主题 | 内容 |
|---|---|
| 插件安装 | `dsh plugin add/remove`、profile / bundle、层序、`--patch` 原型 |
| Cordis | 概念、Fiber 状态机、Config schema、插件写法 |
| 能力扩展 | 工具规约、Conversation Node、LLM 适配器、扩展钩子 |
| 客户端 UI | 设置页槽位、webServer 路由、settings 白名单规避 |
| 排障 | 重启语义、duplicate id、升级 fallback、已知坑 |

采用**渐进披露**：`SKILL.md`（~100 行）作任务路由，细节在 `references/` 按需加载，符合 [Cursor Skill 最佳实践](https://cursor.com/docs/agent/skills)。

**上游文档**：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（本 skill 索引其 `docs/`，并附带少量离线中文副本）。

---

## 何时使用

在以下场景让 Agent 加载本 skill：

- 开发 / 安装 / 调试 **DSH 插件**或工具
- `dsh plugin add`、`cordis.patch.yml`、bundle 重复 insert
- 配置保存不生效、settings 白名单、`duplicate loader entry id`
- DSH 升级后首页 400、客户端 UI、Chat 自定义行

---

## 安装

```bash
# 推荐：Claude / Cursor agents 技能目录
git clone https://github.com/lordqyxz/dsh-development.git ~/.agents/skills/dsh-development

# 或 Cursor 个人 skills
git clone https://github.com/lordqyxz/dsh-development.git ~/.cursor/skills/dsh-development

# 或软链到已有 checkout
ln -s /path/to/dsh-development ~/.agents/skills/dsh-development
```

重启 Cursor 或新开 Agent 会话后即可被发现。

---

## 目录结构

```
dsh-development/
├── SKILL.md              # 入口：任务路由 + 快速开始 + TL;DR
├── references/           # 专题参考（按需阅读）
│   ├── plugins.md        # 安装 / 卸载 / bundle / CLI
│   ├── restart.md        # 热更 vs 重启
│   ├── cordis.md         # Cordis 概念与插件写法
│   ├── architecture.md   # 架构与扩展点映射
│   ├── capabilities.md   # 工具 / Conversation Node / LLM
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

`cursor` · `agent-skill` · `deepseek-harness` · `dsh` · `cordis` · `plugin-development` · `cursor-agent`

---

## License

MIT — see [LICENSE](LICENSE).
