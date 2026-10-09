---
name: dsh-development
license: MIT
description: >-
  跨 Agent 通用的 DSH（DeepSeek Harness）插件与工具开发 Skill（标准 SKILL.md 格式）：
  Cordis 插件、profile/bundle 安装、MCP 桥接（dsh-mcp-client）、工具规约、客户端 UI、Conversation Node、LLM 适配器。
  在 Cursor / Claude Code / Codex 等 Agent 中开发、安装或调试 DSH 插件，
  `dsh plugin add`、宿主依赖/版本隔离、cordis.patch.yml、接入外部 MCP server、配置不生效、settings 白名单、升级或卸载后故障时使用。
---

# DSH Development

## 任务路由

| 你在做… | 读 |
|---|---|
| 装/卸/升级插件、`--patch` 原型、bundle 层序 | [references/plugins.md](references/plugins.md) |
| 宿主依赖、DSH 版本对齐、官方/已安装分类、卸载审计 | [references/dependencies.md](references/dependencies.md) |
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

## DSH 版本与文档路由（防 API 腐化）

DSH 处于开发者预览期、持续发版（rc.1 → rc.2 → …），skill 静态参考**必然滞后**于已安装版本。铁律与机制：

1. **API 实证协议**：任何 `ctx.*` API 用法，先对照本机已安装源码验证（`<DSH安装根>/node_modules/@deepseek-ai/<pkg>/` 的 README + 源码），或真机探针；skill 文本与安装源码冲突时**以源码为准**，并回写修正 skill。实测教训：`ctx.settings.register` 在教程里存在、在 rc.1/rc.2 里都不存在，mock 测试测不出，只有真机暴露。
2. **快照按版本路由**：`references/snapshots/dsh-<version>.md` 记录各版本的 API 面（服务方法、事件、探针结果）。开工先 `dsh --version`：
   - 对应快照存在 → 读它，并留意文中标注的探针差异；
   - 不存在 → `node tools/api-snapshot.mjs --out references/snapshots/dsh-<version>.md` 现场生成（自动探测本机 DSH，或 `--dir` 指定安装根/容器内安装根）。
3. **快照 ≠ 上游原版**：宿主侧打过补丁的安装（如 plugin-manager 的 `-w`）会进快照，标注「本机打过补丁」的行以上游 tarball 复核为准。

## 高频坑（展开见 troubleshooting.md）

- **duplicate loader entry id**：bundle 已 `plugin add`，patch 又 `insert` 同一 id → 只保留 `- id:` 改 config。
- **GitHub 包名 alias**：`dependencies` 键须与 bundle patch 的 `name:` 一致；bundles 只列一份。
- **升级后首页 400**：`profiles/node_modules` 仍链旧 dsh → `pnpm install` + 查 `dsh-host-webserver` 软链。
- **宿主包被插件遮蔽**：外部插件 import 的 `@deepseek-ai/dsh-*` 不应放在 `dependencies`；放入 `peerDependencies`，并以相同版本镜像到 `devDependencies`，详见 [dependencies.md](references/dependencies.md)。
- **官方插件显示为“已安装”**：先区分安装目录提供的 optional bundle 与 profile 的直接依赖；不要为安装目录已经提供的官方 bundle 再 `pnpm add` 到 profile。
- **卸载后仍有插件痕迹**：同时检查 profile `package.json`、lockfile、`dsh.profile.bundles`、`node_modules` 链接和 `--dump-config`，再重启验证；不要只看 `pnpm remove` 的退出码。
- **`ctx.settings.register` 不存在（真机必炸）**：DSH 0.2.0-rc.1/rc.2 的 `ctx.settings` 没有 register——照旧文档写，宿主半区以 `TypeError: ctx.settings.register is not a function` 拒绝激活（mock 测试测不出）。真实接缝 = 自己的 profile entry：Config 可写字段 `.volatile()`（schemastery ≥3.18.4），写 `ctx.settings.update(ctx.fiber.entry?.options.id, patch)`，读 config 的 volatile refs（[client-ui.md](references/client-ui.md)）。
- **hybrid 插件 GUI 安装后不激活**：无 `dsh.bundle` 的包经插件管理器只落普通依赖，宿主半区不挂载——`package.json` 必须声明 `dsh.bundle.patch`（[plugins.md](references/plugins.md)）。
- **`ERR_PNPM_ADDING_TO_ROOT`（装插件）**：profile 是 pnpm workspace root 而 plugin-manager 不带 `-w`（rc.1/rc.2 均如此）——CLI 加 `-w` 或宿主侧打补丁；GitHub spec 走 ssh 报 Host key verification 就 insteadOf 重写 https（[troubleshooting.md](references/troubleshooting.md)）。
- **设置保存假成功**：第三方 `settingsScope` 被白名单拒 → 走插件自有路由 + 宿主 `ctx.settings.update(entry.options.id, patch)`（[client-ui.md](references/client-ui.md)）。
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
