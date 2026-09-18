> [← 主入口 SKILL.md](../SKILL.md)

## 架构与扩展点（官方 reference）

> 源：发布站 `reference/`（"DeepSeek Harness Architecture"，**改 packages/ 下任何东西前必读**）。离线全文：`docs-official/reference_architecture.zh.md`。
> 核心思想：**没有特权核心**——产品每一部分（模型适配器/工具注册表/会话日志/agent loop）都是插件，都可从配置替换；注册都是 effect，卸载即撤销。

### 核心 ctx 服务（core packages → ctx key）

| 包 | 拥有 | ctx key |
|---|---|---|
| `core/session` | 追加式 SessionEvent 日志 + 内存存储 | `ctx.sessions` |
| `core/system-prompt` | 提示词分区 + 工具 schema 装配 | `ctx.systemPrompt` |
| `core/tools` | 作用域化工具注册表 + 守卫执行管道 | `ctx.tools` |
| `core/agent` | Agent 接口、live 注册表、`agent/*` 事件 | `ctx.agents` |
| `core/agent-loop` | 实现该接口的默认驱动 | `ctx.agentLoop` |
| `core/scope` | 每 agent 作用域化注册原语（库，无 key） | — |
| `llm/llm` | Message/stream 词汇 + 适配器缝 | `ctx.llm` |

### 事件三类（选对域是第一个决定）

| 域 | 事件 | 用途 |
|---|---|---|
| **Session 事件**（持久事实，`session/event` 广播） | `turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` | 要"跨重载存活"的事实用它 |
| **Agent 事件**（携带 live Agent） | `agent/*`：inbox/step/status/request/validation/continuation | 观测或拦截进行中的工作 |
| **能力事件**（给缝挂策略/适配器，不 import 循环） | `fs/*`、`tools/*`、`telemetry/*` | 给某个 seam 附加策略/适配器 |

**Waterfall（必须调 `next()` 委托下游）**：`agent/pre-step`、`agent/request`、`llm/stream`、`tools/pre-execute`、`tools/execute`、`tools/post-execute`。
**Serial（无 next()）**：`agent/turn-stopping`（停止一轮）。

### Turn flow（step vs turn）

- **step** = 一次模型请求 + 它调的工具；**turn** = 零个或多个 step（首个输入被 claim 前 open、不再欠任何东西时 close）。
- 输入经**唯一 inbox** 到达驱动；`agent.inject()` 注入的 context 在 inbox 里等（落在下一次被接纳的请求）。
- `agent/pre-step` 决定模型看到什么：可改写 claim 的消息或整体拒绝；被拒/空首 claim 仍会关掉一轮"没花 step"的持久 turn（日志记录这次尝试）。
- `turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` 是持久 session 事件；其余是 live 扩展点。

### Session log 不变量（模型看到的 = 日志里的）

- `deriveMessages()` 从日志投影模型历史；原始 `assistant/chunk` 保留回放/UI 保真。Fork/resume/transcript/telemetry/persistence 全派生自此流。
- **不变量：Model-visible means logged**——任何到达模型请求的东西都必须能从日志重建（运行时不变量强制）。
- 所以**新的"模型可见输入"必须新增一条 session 事件**：扩 `SessionEventMap` + 从日志渲染。

### Capability seams（能力缝：Service Definition / Provider / Consumer 三角）

- 一个 seam = 可替换能力，三个角色：定义接口的 **Service Definition**、实现它的 **Service Provider**、使用它的 **Consumer**（常是模型向工具）。一个包可兼多角色，但**只一个角色不构成 seam**——加能力 = 设计全部三角。
- fs/subprocess 共享同一执行世界 → 指向远程沙箱时 Bash/PTY/LSP 一起迁移，无 provider 分叉。
- 后端注册位：`ctx.shell`（shell 执行）、`ctx.terminals`（持久终端，+`dsh-tool-terminal`）、`ctx.fs`（文件访问/策略，或 `fs/*`）、`ctx.sandbox`（围住 spawn 的 argv）。

### Profiles & bundles（组合/分层）

- **profile** = 命名组合（Harness home 下）：列它叠的 bundles + 装的 out-of-tree 插件 + 用户自己的 `cordis.patch.yml`；`web`/`headless` 是模板。
- **bundle** = cordis 配置行 + 它们挂载的代码的分发格式，声明在 package.json 的 `dsh` 字段：`dsh.profile`（列 profile 的 bundles）、`dsh.bundle`（指 bundle 的 patch 文件）。
- **层序**（应用到空 entry 列表）：各 bundle（按 profile 列出顺序）→ profile 的 `cordis.patch.yml` → home 级 → 任意 `--patch` overlay。patch 按 **id** 定位一行、整体替换其 config，或插入新行。
- `dsh --profile web --dump-config` 打印实际启动的树，任何一行都能被自己的 patch 替换。

### 新行为去哪（goal → mechanism 官方映射）

| 目标 | 机制 |
|---|---|
| 加模型 provider | 在 `ctx.llm` 注册适配器 |
| 加模型向能力 | 注册 `ctx.tools`；schema 自动进提示词装配 |
| 给某会话不同能力集 | 组 agent preset；其 service row 需 isolate realm |
| 加 shell 执行 | 注册 `ctx.shell` 后端；本地经 `ctx.subprocess` spawn |
| 加持久终端执行 | 注册 `ctx.terminals` 后端 + `dsh-tool-terminal` |
| 加人类命令 | 注册 `ctx.commands`；不经模型轮次直接派发 |
| 加后台工作 | 注册 `ctx.jobs`；`job_*` 工具收集/停止 |
| 加文件访问/策略 | 注册 `ctx.fs` provider 或监听 `fs/*` |
| 围住子进程 | 用 `ctx.sandbox` 后端；Consumer 在 spawn 前包 argv |
| 拦截请求/工具/轮次 | 用对应 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 停一轮 |
| 加模型向上下文 | `agent.inject()`；落在下一次被接纳的请求 |
| 加 UI/编辑器集成 | 驱动 `ctx.agents`，从 `session/event` 渲染 |
| 接外部系统现成的 MCP 工具 | `@deepseek-ai/dsh-mcp-client` 桥接或纯插件承载（[mcp.md](mcp.md)） |
| 加 Web 客户端 Chat 节点 | 注册 `ConversationNodeDefinition` + keyed renderer |
| 加持久会话状态 | 扩 `SessionEventMap`；从日志渲染/回放 |
| 生成会话标题 | 注册唯一 `ctx.sessionTitle` provider |
| 管同一会话目标 | 用 `ctx.goals`；经 `agent/*` 继续 |
| Fork 活会话 | `ctx.sessions.fork(source, boundary?, childSessionId?)` |
| 作用域注册到单 agent | 用该 agent 的 `agent.ctx` |
| 程序化建会话 | `ctx.agents.create` + **setup 挂 preset**（见下节，漏 setup = 空全局层） |

### 程序化创建会话：组合必须经 setup 挂载（2026-09-18 实证）

`ctx.agents.create({ sessionId, meta, setup })` 是插件/协议桥建会话的正路，两条铁律：

- **组合（工具/技能/提示词段落）只认 `setup(agentCtx)` 钩子**。`meta.agentPreset` 只是会话 header 的创建事实记录，工厂不读它做挂载——漏传 setup 时 agent 以「空全局层」发布：工具目录只剩宿主面插件注册的工具，bash/fs/run_code/skill 全缺，技能目录不存在，且**创建成功、无任何报错**（agent-presets 服务只在日志里 warn 一句）。
- **正确形状**：`setup: (agentCtx) => ctx.agentPresets.mount(agentCtx, id?)`——id 省略时读 settings `agent-presets.default`（这就是「启动默认 preset」的真实语义：**mount 的参数回退值**，不是创建时的自动副作用）；mount 拒绝会回滚整个 create，要降级就吞掉错误让会话 bare 发布。
- 预设 = `apps/cli/config/agent-presets/`（或 `~/.dsh/.agent-presets/`）下含 `agent.cordis.yml` 的目录；出厂四预设 standard/ptc/minimal/cordis（0.1.5-rc.1）。**ptc 模式的工具经 run_code SDK 呈现**——会话目录里只有 `run_code` 一个直接工具属正常，不是丢工具。
- **验证别只看创建成功**：读会话日志 `request/header` 的实际工具清单（与 GUI 会话对比；两类会话同机共存、header 都可能写着同一个 preset id，最会骗人），或让冒烟探针显式回报 preset 挂载结果。故障模式与案例见 [troubleshooting.md](troubleshooting.md)。

### 核心 ctx 服务索引（能力缝速查，真源 `docs/capability-seams.md` 全量表）

> `role` 三档：**seam**=可替换能力(有 Provider)、**core**=核心脊柱服务(单一实现)、**bundle**=组合点。加"可替换能力"=设计三角（Service Definition / Provider / Consumer）。

| ctx key | role | 一句话 |
|---|---|---|
| `ctx.tools` | core | 工具注册表 + 守卫执行管道（pre→guards→execute→post→result），Code Mode 传输 |
| `ctx.llm` | seam | LLM 适配器注册（provider→adapter）；provider 可动态换、model 免重配 |
| `ctx.sessions` | core | 追加式 SessionEvent 日志 + 持久事件流 |
| `ctx.agents` | core | live Agent 句柄、create/resume 工厂缝、`agent/*` 事件 |
| `ctx.agentLoop` | bundle | 唯一具体 loop 驱动（扩展依赖 `agent/*` 事件与服务，别依赖本包） |
| `ctx.agentPresets` | core | agent 预设发现/挂载——**每会话工具/技能/提示词组合的唯一来源**；`agents.create` 必须经 setup 调它 |
| `ctx.systemPrompt` | core | 每步收集提示词分区 + 模型向工具 schema |
| `ctx.scope` | core | 每 agent 作用域化注册 |
| `ctx.subagents` | seam | 子 agent 传输缝（in-process/ACP/Codex/Claude Code/DshSDK）；`tool-subagent` 选一次性/可续 |
| `ctx.jobs` | seam | 后台任务（producer 注册，`tool-jobs` 读列杀；`jobs-local` 进程内注册表） |
| `ctx.shell` / `ctx.subprocess` / `ctx.terminals` | seam | bash 执行 / 子进程 / 持久 PTY；fs 与 subprocess 共享执行世界 |
| `ctx.sandbox` | seam | 进程沙箱：Consumer 交出将 spawn 的 argv，同世界后端按策略包 argv |
| `ctx.fs` | seam | 文件 seam；`tool-fs` 经它执行，`fs-sandbox` 按沙箱模式围变更，`fs/*` 事件门做 observed-state 检查 |
| `ctx.approval` | seam | 一次性权限决策（`approval/request` waterfall；无应答 fail-closed `unavailable`） |
| `ctx.permissionPresets` | core | `workspace-write`/`danger-full-access` 预设 → 写一个 `permission/preset` 事件 → 两个旋钮事件 |
| `ctx.settings` | seam | 命名空间 schema + 分层取值（`settings-file` 存文档） |
| `ctx.credentials` | seam | 凭据引用；provider 持值，Consumer 每次操作时解析（轮换即生效） |
| `ctx.webServer` | core | 插件自有路由（named-route 注册表、index transform tap、静态 dist 回退） |
| `ctx.clientModules` | core | `__DSH_BOOT__` 图组合 + 客户端 bundle 服务/重扫 |
| `ctx.skills` | seam | 技能目录合并；`tool-skill` 渲染 session 前缀目录并载入完整技能体 |
| `ctx.goals` | core | 从日志 fold 修订化目标状态，live 续跑激活进程内 |
| `ctx.commands` | core | 人类命令（不经模型轮次直接派发） |
| `ctx.sessionTitle` | seam | 会话标题：确定性 fallback + 唯一异步 provider 注册 |
| `ctx.workflowEngine` | seam | 工作流引擎（agent() 经 ctx.subagents 扇出） |
| `ctx.storage` / `ctx.storageDomain` | seam/core | 命名 KV 后端 / 类型化域状态 |
| `ctx.spillStore` | seam | 超大工具文本落盘，返回模型向 locator（`spill-policy` 是 tools/post-execute 消费者） |
| `ctx.sessionQuery` / `ctx.sessionReferenceResolver` | seam/core | 会话查询 / 会话引用投影 |
| `ctx.sandboxPolicy` | core | 部署默认沙箱模式 + 工作区根的唯一归属（bash 与 fs 据此统一根） |
| `ctx.invariants` | core | 运行时不变量（含 Model-visible means logged） |

完整表（40+ 服务，含 owner 包 / provider / consumer）读 `docs/capability-seams.md`。

