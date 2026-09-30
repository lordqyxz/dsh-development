> [← 主入口 SKILL.md](../SKILL.md)

## 官方教程速查（最重要的知识来源）

官方仓库 `deepseek-ai/deepseek-harness` 已**本地完整克隆**到 `/Users/apple/dev/deepseek-harness`（shallow，`master`）——**要读官方文档全文一律从这里读 `docs/`**（英文 `.md` + 中文 `.zh.md` 成对），发布站 `deepseek-harness.github.io/.../en/` 由它生成。`docs/AGENTS.md` 说明文档分层/写作规约；`packages/<name>/` 是各包源码 + README 契约。站点路径 → 克隆 `docs/` 路径的映射与重点文件见 `docs-official/INDEX.md`。`docs-official/` 只留少量自包含中文副本（`cordis-primer.zh.md`、`cordis-tutorial_*.zh.md`、`user_develop_basic_*.zh.md`、`cookbook_*.zh.md`、`reference_architecture.zh.md`）。

> 更新克隆：`cd /Users/apple/dev/deepseek-harness && git fetch --depth 1 origin master && git reset --hard origin/master`（只读参考，别建分支/提交）。

| 找什么 | 官方路径 | 一句话 |
|---|---|---|
| 动手学 Cordis（01-07，无密钥） | `cordis-tutorial/index.md` | 见下表「Cordis 教程章节」 |
| Cordis 概念精读 | `cordis-primer.md` | 五概念 + 分发模式 + waterfall，不逐步实践 |
| **插件生命周期 / 服务 / 事件** | `user/develop/framework/index.md` / `service.md` / `events.md` | Fiber 状态机、对外提供 `ctx` 服务、事件模式选型 |
| **CLI 行为参考** | `apps/cli/reference/README.md` | profile 启动、层序、`dump-config`、`dsh web` flag、`plugin` 转发 pnpm |
| Web Chat 自定义行 | `cookbook/adding-a-conversation-node.*` | `ConversationNodeDefinition`、可回放事件族、Assembler（见专节） |
| 终端用户（非插件开发） | `user/guide/` | Web UI 使用、providers、Python SDK |
| **架构总览（改 packages 前必读）** | `reference/`（发布站 `/en/reference/`，离线 `docs-official/reference_architecture.zh.md`） | 核心 ctx 服务 / 事件三类 / turn flow / session log 不变量 / capability seams / profiles & bundles / **新行为去哪映射表** |
| Web UI 第一个插件 | `user/develop/basic/index.md`（发布站 `/en/develop/basic/`） | 最小插件 + `--patch` 覆盖层加载进 GUI |
| 开发一个工具（step by step） | `user/develop/basic/tool.md` | greet 工具全流程 |
| **打包与安装插件（官方）** | `user/develop/basic/publish.md` / `.zh.md` | bundle vs profile、`dsh plugin add/remove`、层序、GitHub `allowBuilds` |
| **添加 package / 依赖约束** | `cookbook/adding-a-package.md` | DSH peer dependency 同步到 `devDependencies`、运行时依赖和 monorepo package 不变量 |
| 插件配置（schema / 用户覆盖） | `user/develop/basic/config.md` / `.zh.md` | Config schema、patch 按 id 覆盖、整行替换 config |
| 工具编写参考（真源） | `cookbook/adding-a-tool.md` | 最小形态、execute 约定、扩展点、UI 卡片、后台任务 |
| 扩展形态参考 | `cookbook/extension-cookbook.md` | 钩子/UI 插件/协议桥 + 功能→机制映射表 |
| 核心 API 参考 | `cordis-api/context.md` 等 | 生成的服务/事件/配置目录 |
| **MCP 桥接（0.1.5-rc.1 起）** | 仓库 `packages/mcp/mcp-client/README.md`（在 `docs/` 之外）+ `config-catalog.md` 的 `@deepseek-ai/dsh-mcp-client` 节 | 官方桥接插件：每 server 一个实例的配置键、`mcp__<serverName>__<rawName>` 工具命名、重连策略（skill 摘要见 [mcp.md](mcp.md)） |

**Cordis 教程章节**（`cordis-tutorial/`，在 `tmp/cordis-tutorial` 动手，无需 API 密钥）：

| 章 | 文件 | 学什么 |
|---|---|---|
| 01 | `01-first-plugin.md` | 最小插件 + `cordis.yml` |
| 02 | `02-lifecycle-and-effects.md` | `ctx.effect` 可逆注册 |
| 03 | `03-services.md` | `inject` 与依赖就绪 |
| 04 | `04-events.md` | emit / waterfall / serial |
| 05 | `05-config.md` | Config schema + patch |
| 06 | `06-composition-and-hmr.md` | patch 层叠 + HMR（harness web profile 宿主 HMR 关） |
| 07 | `07-into-the-harness.md` | 接入真实 harness 服务 |

> ⚠️ 离线文档**未覆盖客户端 bundle / slots / rev 热更机制**——那部分以本版本源码为准：`node_modules/@deepseek-ai/dsh-client-modules`（serveBundle/rev/rebuilt）、`dsh-client-hmr`（轮询+SSE）、`dsh-client-ui-settings`（settings 槽位契约）、`dsh-client-ui-slots`（hooks→props 映射）。

## 深度参考索引（查具体 seam 时去读官方，不必搬进 skill）

> 路径均相对 `/Users/apple/dev/deepseek-harness/docs/`。skill 用 `reference/` 架构摘要代替 40+ 子系统全文；碰到具体 API/类型/事件名时再下钻。

### Cordis API（生成参考）

| 文件 | 查什么 |
|---|---|
| `cordis-api/context.md` | `Context` 方法、`effect`/`on`/waterfall 等 |
| `cordis-api/fiber.md` | Fiber 生命周期、状态转换 |
| `cordis-api/service.md` | `Service` 基类、提供方约定 |
| `cordis-api/registry.md` | 插件注册表、loader 条目 |
| `cordis-api/events.md` | 事件分发 API 细节 |

插件写不动时：**framework 三篇摘要**（本 skill）→ **cordis-api** → **cordis-tutorial 01–07**。

### Subsystems（按任务选页）

| 你在做… | 读 |
|---|---|
| 工具 schema / 执行管道 / UI 卡片 | `subsystems/tools.md` + `tool-execution-pipeline.md` |
| Session 事件类型 / 回放 | `subsystems/session.md` |
| LLM 流 / StreamChunk / 适配器契约 | `subsystems/llm-streaming.md` |
| 设置 namespace / scope.update | `subsystems/settings.md` |
| 插件 HTTP 路由 | `subsystems/web-server.md` |
| Web 客户端 bundle / boot 图 | `subsystems/client-modules.md` |
| 凭据引用（不进响应） | `subsystems/credentials.md` |
| 审批 / 人工问答 | `subsystems/approval.md`、`user-questions.md` |
| 后台任务 | `subsystems/jobs.md` |
| Agent loop / turn-step | `subsystems/core.md` + skill「架构与扩展点」 |

完整目录：`subsystems/README.zh.md`（40+ 页，每页含类型声明 + 生成的 Cordis API 小节）。跨子系统行为总览：`architecture.md`（与 `reference/` 互补）。

### 改 harness 仓库本身（第三方插件通常不需要）

| 官方 | 何时读 |
|---|---|
| `cookbook/adding-a-package.md` | monorepo 新建 `@deepseek-ai/dsh-*` 包 |
| `cookbook/adding-a-vendored-package.md` | vendor 上游 Cordis 包 |
| `development.md` | 贡献者 typecheck/build、双 aggregate tsconfig |
| `cookbook/maintaining-*.md` | 维护者 PR 流程 |
