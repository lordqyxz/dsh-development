# DeepSeek Harness 架构（官方 reference 中文离线版）

> 源：`https://deepseek-harness.github.io/deepseek-harness/en/reference/`（"DeepSeek Harness Architecture"）。
> 改 `packages/` 下任何东西前先读这篇。假设你已了解 Cordis；不了解先读 [cordis-primer](./cordis-primer.zh.md) 或 [cordis-tutorial_index](./cordis-tutorial_index.zh.md)。
> 推荐用一个 agent 去探索代码库、理解其架构。

## Cordis

Cordis 是 dsh 之下的框架：插件向共享 context 贡献**服务**、**类型化事件**、**可逆 effect**。产品的每一部分都是插件——包括模型适配器、工具注册表、会话日志、乃至 agent loop 本身——所以每个部分都能从配置替换。

**没有需要打补丁的特权核心**：你通过"把插件装在其他插件旁边"来扩展 dsh，注册都是 effect，插件卸载时自动撤销。

## Profiles 与 bundles

运行中的 dsh 是一棵在启动时由**有序层**组合出来的插件树。

- **profile** = 命名组合（存在 Harness home 下）：列出它叠的 bundles、装的 out-of-tree 插件、以及用户自己的 `cordis.patch.yml`。`web` 和 `headless` 作为模板随附。
- **bundle** = Cordis 配置行 + 它们挂载的代码的分发格式，这样它插入的东西仍能被上层 patch。bundle 在自己的 `package.json` 的 `dsh` 字段声明：`dsh.profile` 列一个 profile 的 bundles；`dsh.bundle` 指向一个 bundle 的 patch 文件。
- `dsh-base` 是每个 profile 的第一层：模型适配器、工具、持久化、沙箱与审批策略、设置、凭据、遥测。`dsh-web-app` 加浏览器应用；`dsh-headless` 加一次性 runner（完全没有服务器）。

**层序**（应用到空的 entry 列表，按序）：profile 列出的各 bundle（按顺序）→ profile 的 `cordis.patch.yml` → home 级那个 → 任意 `--patch` overlay。一个 patch 按 **id** 定位一行、整体替换其 config，或插入新行。

看机器实际启动的树：

```sh
dsh --profile web --dump-config
```

它打印的任何一行都能被你自己的 patch 替换。组合机制在 `app-boot`；配置字段在生成的 config catalog。

## 核心包（core packages → ctx key）

| 包 | 拥有 | ctx key |
|---|---|---|
| `core/session` | 追加式 SessionEvent 日志 + 内存存储 | `ctx.sessions` |
| `core/system-prompt` | 提示词分区 + 工具 schema 装配 | `ctx.systemPrompt` |
| `core/tools` | 作用域化工具注册表 + 守卫执行管道 | `ctx.tools` |
| `core/agent` | Agent 接口、live 注册表、`agent/*` 事件 | `ctx.agents` |
| `core/agent-loop` | 实现该接口的默认驱动 | `ctx.agentLoop` |
| `core/scope` | 每 agent 作用域化注册原语（库，无 key） | — |
| `llm/llm` | Message/stream 词汇 + 适配器缝 | `ctx.llm` |

## 事件（Events）

事件是扩展点，**选对域是大多数改动的第一个决定**。

- **Session 事件**是追加进日志的持久事实，经 `session/event` 广播。要"必须跨重载存活"的事实用它。
- **Agent 事件**（`agent/*`）携带 live Agent：inbox、step、status、request、validation、continuation。观测或拦截进行中的工作用。
- **能力事件**给一个缝挂策略/适配器（`fs/*`、`tools/*`、`telemetry/*`），不 import 循环。

事件 map 列出每个事件的生产者/消费者。

## Turn flow（轮次流程）

- **step** = 一次模型请求 + 它调的工具。
- **turn** = 零个或多个 step：第一个输入被 claim 之前 open，不再欠任何东西时 close。

```text
turn/start
  claim next-step input plus one queued message
  assemble prompt sections + tool schemas
  -> agent/pre-step                   reject | enter(messages)
     reject, or a first enter rewritten empty -> close the turn with no step
     step/start
     append entered messages as user/message
     derive model history from the log
     agent/request -> llm/stream -> assistant/chunk* -> assistant/message
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     tools owe another request, or next-step input arrived -> claim -> next step
  -> agent/turn-stopping
turn/end
```

- `turn/*`、`step/*`、`user/message`、`assistant/*`、`tool/*` 是**持久 session 事件**；其余是三个域上的 **live 扩展点**。
- `agent/pre-step`、`agent/request`、`llm/stream`、三个 `tools/*` 事件是 **waterfall**，监听器必须调 `next()` 委托下游；`agent/turn-stopping` 是 **serial**，没有 `next()`。
- 输入经**唯一 inbox** 到达驱动。有些消息会立即唤醒它；注入的 context 在 inbox 里等到另一条消息来。
- `agent/pre-step` 决定模型看到什么：监听器可改写 claim 的消息或整体拒绝；被拒或空的首 claim 仍会关掉一轮"没花 step"的持久 turn（日志记录这次尝试）。
- 每步读插件注册的提示词分区和工具 schema。

详情：序列图、工具管道、取消与错误恢复（官方子页）。

## Session log（会话日志）

会话日志是模型看到上下文的来源。

- `deriveMessages()` 从日志投影模型历史；原始 `assistant/chunk` 事件保留回放与 UI 保真。
- Fork、resume、transcript、telemetry、persistence 全部派生自这条流。
- **不变量：Model-visible means logged（模型可见 = 已记录）**。任何到达模型请求的东西都必须能从日志重建，运行时不变量强制这一点。
- 这就是为什么新的"模型可见输入"需要一条**新的 session 事件**：扩 `SessionEventMap`，并从日志渲染。

## Capability seams（能力缝）

一个 **seam** = 可替换能力，有三个角色：

1. **Service Definition**：声明接口。
2. **Service Provider**：实现它。
3. **Consumer**：使用它（常见是模型向工具）。

一个包可以兼多个角色，但只一个角色不构成 seam。**加能力 = 设计全部三角**（见 capability graph）。

- Seams 是为什么"换一个 provider"能换掉整个产品。filesystem 与 subprocess provider 共享同一执行世界，所以把它们指向远程沙箱时，Bash、PTY、LSP 一起迁移，没有 provider 分叉。
- Subagent provider 在单一接口后变化同样大：从全新子 agent 到另一个产品里的委托轮次。
- 实验性 Agent Teams 是 `ctx.agentTeams` 上一个私有 opt-in 协调缝：持久 roster、任务板、mailbox，叠在可续子 agent 之上。

## 新行为去哪（Where new behavior goes）

新行为挂到文档化的扩展点。改 loop 本身才更新这张图。

| 目标 | 机制 |
|---|---|
| 加一个模型 provider | 在 `ctx.llm` 注册它的适配器 |
| 加一个模型向能力 | 注册到 `ctx.tools`；其 schema 加入提示词装配 |
| 给某个会话不同的能力集 | 组一个 agent preset；那里的 service row 需要 isolate realm |
| 加 shell 执行 | 注册 `ctx.shell` 后端；本地那个经 `ctx.subprocess` spawn |
| 加持久终端执行 | 注册 `ctx.terminals` 后端 + `dsh-tool-terminal` |
| 加人类命令 | 注册到 `ctx.commands`；不经模型轮次直接派发 |
| 加后台工作 | 注册到 `ctx.jobs`；`job_*` 工具收集/停止它 |
| 加文件访问或策略 | 注册 `ctx.fs` provider，或监听 `fs/*` 事件 |
| 围住生成的进程 | 用 `ctx.sandbox` 后端；Consumer 在 spawn 前包 argv |
| 拦截请求/工具/轮次 | 用对应 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 停一轮 |
| 加模型向上下文 | 调 `agent.inject()`；落在下一次被接纳的请求 |
| 加 UI 或编辑器集成 | 驱动 `ctx.agents`，从 `session/event` 渲染 |
| 加 Web 客户端 Chat 节点 | 注册 `ConversationNodeDefinition` + keyed renderer |
| 加持久会话状态 | 扩 `SessionEventMap`；从日志渲染/回放 |
| 生成会话标题 | 注册唯一的 `ctx.sessionTitle` provider |
| 管同一会话的目标 | 用 `ctx.goals`；经 `agent/*` 继续 |
| Fork 一个活会话 | `ctx.sessions.fork(source, boundary?, childSessionId?)` |
| 把注册作用域到一个 agent | 用那个 agent 的 `agent.ctx` |

> 扩展 cookbook 把功能映射到能力，并为 packages、tools、LLM 适配器、Chat 节点、设置卡编制 step-by-step 指南。
