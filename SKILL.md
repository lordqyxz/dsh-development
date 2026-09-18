---
name: dsh-development
description: >-
  跨 Agent 通用的 DSH（DeepSeek Harness）插件与工具开发 Skill（标准 SKILL.md 格式）：
  Cordis 插件、profile/bundle 安装、MCP 桥接（dsh-mcp-client）、工具规约、客户端 UI、Conversation Node、LLM 适配器。
  在 Cursor / Claude Code / Codex 等 Agent 中开发、安装或调试 DSH 插件，
  `dsh plugin add`、cordis.patch.yml、接入外部 MCP server、配置不生效、settings 白名单、升级后故障时使用。
---

# DSH Development

## 任务路由

| 你在做… | 读 |
|---|---|
| 装/卸/升级插件、`--patch` 原型、bundle 层序 | [references/plugins.md](references/plugins.md) |
| 判断改动要不要重启 | [references/restart.md](references/restart.md) |
| Cordis 概念、Fiber、插件写法、Config | [references/cordis.md](references/cordis.md) |
| 架构、ctx 服务、扩展点映射 | [references/architecture.md](references/architecture.md) |
| 工具、扩展形态、Conversation Node、LLM 适配器 | [references/capabilities.md](references/capabilities.md) |
| 接外部 MCP server（官方桥 / 社区插件承载）、选型 | [references/mcp.md](references/mcp.md) |
| 设置页、槽位、webServer 路由、logo | [references/client-ui.md](references/client-ui.md) |
| 官方文档路径、cordis-api、subsystems 索引 | [references/docs-index.md](references/docs-index.md) |
| 本机 `$DSH_HOME`、web profile、参考插件 | [references/environment.md](references/environment.md) |
| 验证清单、已知坑、省 token 技巧 | [references/troubleshooting.md](references/troubleshooting.md) |

离线中文副本与路径映射：`docs-official/INDEX.md`。官方全文克隆：`/Users/apple/dev/deepseek-harness/docs/`。DSH 已开源：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT，基于 Cordis，"Everything is a Plugin"）· [文档站](https://deepseek-harness.github.io/deepseek-harness/)。

## 快速开始

```ts
// lib/index.js — 最小工具插件
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'my-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'my_tool',
    description: 'What this tool does.',
    parameters: { arg: { type: 'string', required: true, description: '...' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args, exec) { return `result: ${args.arg}` },
  }))
}
```

**注册分两条路**（详见 [plugins.md](references/plugins.md)）：

| 插件类型 | 怎么装 | profile `cordis.patch.yml` |
|---|---|---|
| **bundle**（有 `dsh.bundle`） | `dsh plugin --profile web add <path\|git\|tgz>` | **不要** `- insert:` 同一 id；只 `- id:` 改 `config` / `disabled` |
| **非 bundle** | `dsh plugin add` 或手动 patch | `- insert:` + `config` |

工作流：写 `apply` → 按上表注册 → 按[重启规则](#重启-tldr)判断是否重启 → 会话调工具 / `curl` 路由复验（[troubleshooting.md](references/troubleshooting.md)）。

**原型阶段**：`dsh web --patch ./scratch-plugin/cordis.yml`，patch 里 `name` 用**绝对路径**；验证通过后打包 bundle 再 `plugin add`。

## 重启 TL;DR

| 改动 | 生效 |
|---|---|
| 宿主 `lib/index.js`（工具/路由/schema） | **重启**（web profile 宿主 HMR 关） |
| `cordis.patch.yml` 改已有 id 的 `config` | **热生效**（不重载宿主代码） |
| `plugin add/remove/update`（bundle 成员变） | **重启** |
| 客户端 `lib/client.js` | **刷新页面** |
| `settings.yaml` 用户层 | **热生效** |

完整表、curl 验证宿主路由、settings 假成功 → [restart.md](references/restart.md)。

## Cordis 五概念（展开见 cordis.md）

| 概念 | 要点 |
|---|---|
| 插件 | `apply(ctx)`；函数 / 对象 / `Service` 子类 |
| 上下文 | `ctx.tools` / `ctx.llm` / `ctx.sessions`…按 key 取服务 |
| inject | 依赖就绪后才 apply；顺序由依赖图决定 |
| 事件 | emit / bail / waterfall（须 `next()`）/ serial / parallel |
| 可逆注册 | `ctx.effect()` / `ctx.on()`，卸载自动清理 |

## 高频坑（展开见 troubleshooting.md）

- **duplicate loader entry id**：bundle 已 `plugin add`，patch 又 `insert` 同一 id → 只保留 `- id:` 改 config。
- **GitHub 包名 alias**：`dependencies` 键须与 bundle patch 的 `name:` 一致；bundles 只列一份。
- **升级后首页 400**：`profiles/node_modules` 仍链旧 dsh → `pnpm install` + 查 `dsh-host-webserver` 软链。
- **设置保存假成功**：第三方 `settingsScope` 被白名单拒 → 走插件自有路由 + 宿主 `scope.update`（[client-ui.md](references/client-ui.md)）。
- **curl 200 HTML**：未注册路由回退 SPA 首页 → 看 `content-type` 是否为 `application/json`。
- **`agents.create` 不传 `setup` = 空全局层**：`meta.agentPreset` 只写会话 header、不挂载组合（无 bash/fs/skill，**创建成功不报错**）；程序化建会话必须 `setup: (agentCtx) => ctx.agentPresets.mount(agentCtx, id?)`，验证看会话日志 `request/header` 的实际工具清单（[architecture.md](references/architecture.md) / [troubleshooting.md](references/troubleshooting.md)）。

## 本机环境（摘要）

| 项 | 值 |
|---|---|
| GUI | `http://127.0.0.1:3080` |
| 启动 | `npx @deepseek-ai/dsh web`；`dsh --profile <name>` 多配置隔离 |
| `$DSH_HOME` | `~/.dsh` |
| web profile | `~/.dsh/profiles/web/` |
| 官方克隆 | `/Users/apple/dev/deepseek-harness` |

完整表、参考插件路径 → [environment.md](references/environment.md)。
