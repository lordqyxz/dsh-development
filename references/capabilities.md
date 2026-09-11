> [← 主入口 SKILL.md](../SKILL.md)

## 扩展形态（`cookbook/extension-cookbook` 摘要）

> 真源：`cookbook/extension-cookbook.md`。工具钩子见[工具编写](#工具编写)；Conversation Node 见 `cookbook/adding-a-conversation-node.md`。

### UI 插件（驱动 Web / 外部客户端）

从 **`session/event` 持久事件流**渲染，经 **`agent.followup()` / `agent.steer()`** 把输入送回 agent（不是改 loader 配置）：

```ts
export const inject = ['agents']
export function apply(ctx: Context) {
  ctx.on('session/event', (_session, event) => {
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'text-delta') {
      render(event.data.chunk.text)  // 你的 UI
    }
  })
  onUserInput(text => ctx.agents.get(sessionId)?.followup(createUserMessage({ /* ... */ })))
}
```

浏览器内建 Chat 要贡献**业务行** → 见专节 [Web Chat 自定义行（Conversation Node）](#web-chat-自定义行conversation-node)。

### 协议桥（stdio / JSON-RPC 等）

*协议驱动*插件把外部对端接到 `ctx.agents`：工厂创建/恢复 agent，协议请求映射为 `followup()` 或 `cancel()`，状态单独发布。完整范例：`packages/acp/acp`（ACP JSON-RPC stdio，见该包 README）。

### MCP 桥（外部工具体系接入，0.1.5-rc.1 起）

外部系统已有现成 MCP server 时不必重写成 Cordis 插件：官方 `@deepseek-ai/dsh-mcp-client` 桥接插件经 `cordis.patch.yml` insert 连接 server，把其工具注册为 `mcp__<serverName>__<rawName>` 原生工具；需要设置面板 / 客户端 UI / 宿主状态时才用纯插件承载外部 server 子进程。两条路径与配置键详见 [mcp.md](mcp.md)。

### 功能 → 机制（速查）

| 想做什么 | 挂哪里 |
|---|---|
| 拦截/改写工具调用 | `tools/pre-execute`（waterfall）或 `ctx.tools.guard()` |
| 包装工具执行（超时/重试） | `tools/execute` |
| 改工具结果 | `tools/post-execute` |
| 渲染会话 UI | `session/event` + `agents` |
| Chat 自定义行 | `ConversationNodeDefinition`（client） |
| 外部 IDE/CLI 接 agent | 协议桥 + `ctx.agents` / `ctx.sessions` |
| 接外部系统现成的 MCP 工具 | `@deepseek-ai/dsh-mcp-client` 桥接或纯插件承载（[mcp.md](mcp.md)） |

## Web Chat 自定义行（Conversation Node）

> **真源**：`cookbook/adding-a-conversation-node.zh.md`；引擎模型见仓库 `.agents/notes/.../client-conversation-node-assembly.md`。Host 须已持久化事件；Client 插件须进 Web bundle。

在 Chat 里渲染**插件拥有的业务行**（review job、deliverable 等），不靠扫描 Session 窗口或已有 Node——用 **Assembler + Definition** 把可回放 Session 事件族增量 fold 成 State，再发布 keyed Chat Node。

### 五步实现路径

| 步 | 做什么 |
|---|---|
| 1 | **设计可回放事件族**：稳定业务 id（branded type）；`start` 事件唯一；update 带相同 id；按 `seq` 升序确定性 fold |
| 2 | **类型合并**：生产方 `declare module '@deepseek-ai/dsh-session/types' { SessionEventMap { ... } }`；Client `ChatNodeDataMap` + `ConversationStepDataMap` |
| 3 | **`ConversationNodeDefinition`**：`match`（身份提取，非 fold）→ `start` / `update` → `buildLocationData` / `buildViewNode` |
| 4 | **注册**：`ctx.conversationEvents.register(def)` + `ctx.slots.register('conversation.chat.node', { key }, View)` |
| 5 | **测回放**：replace 全窗口、仅 update 尾部 + prepend start、实时 append、animation-frame 节流 |

### Definition 核心 API

```ts
const def: ConversationNodeDefinition<ReviewState> = {
  kind: 'review-job',           // ChatNodeDataMap key
  target: 'chat',
  match: (event) => {           // 只看当前事件，返回 { id, role: 'start'|'update' } 或 null
    if (event.type === 'review/start') return { id: String(event.data.reviewId), role: 'start' }
    if (event.type === 'review/progress' || event.type === 'review/end')
      return { id: String(event.data.reviewId), role: 'update' }
    return null
  },
  start: (_ctx, match) => ({ /* 从 start 事件构造初始 State */ }),
  update: (ctx, match) => ({ /* 从 progress/end 更新 State */ }),
  publication: match => match.event.type === 'review/progress' ? 'animation-frame' : 'immediate',
  buildLocationData: (ctx, scope) => scope === 'step' && ctx.state ? { kind: 'step', key: 'review-job', value: ... } : null,
  buildViewNode: (ctx) => ctx.state ? { key: ctx.key, kind: 'review-job', anchorSeq: ..., data: ... } : null,
}
```

**硬规则**（违反会导致分页/回放 bug）：

- 每条 update **必须**携带稳定 id；Client **不能**猜「最近未完成」Context。
- `(kind, id)` 最多一条 start；只有 update 的窗口 → pending，prepend 补齐 start 后才构造 State。
- append 热路径：**禁止**遍历全事件窗、全 Context、`context.matches` 或已渲染 Node 集合。
- 已发布 Node 须保持同一 `context.key`；暂离可见流用 `visibility: 'hidden'`，别返回 `null` 撤回。
- 需要「当前位置之前某 kind 的最新 State」→ 只在 `start` 里调 `reader.previous<State>(kind)`，不扫事件。

### 三条摄入路径（引擎行为）

| 路径 | Definition 看到什么 |
|---|---|
| replace（open/resync/gap repair） | 重建窗口 → 每条事件 match 一次 → 有 start 的 Context 按 seq 回放 update |
| prepend 更早历史 | 只匹配新页；可能激活 pending Context；依赖/Location 变则重跑 |
| append 实时事件 | 每 Definition 各 match 一次 → 命中 Context 执行一次 update |

`publication`：`immediate`（结构/terminal 变）、`animation-frame`（高频可见 delta）、`none`（只积累 State）。

**参考实现**：`packages/client/ui-conversation/.../assistant.ts`（流式）、`inbox.ts` / `message.ts`（前序查询）、`packages/client/ui-deliverables`（只发 Turn data、无自有 Node）。

## 工具编写

```ts
export const inject = ['tools']
export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'read_file', description: 'Read a file.',
    parameters: { path: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args, exec) { return readFile(args.path, { signal: exec.signal }) },
  }))
}
```

**execute() 约定**：

| 规则 | 要点 |
|---|---|
| 参数已校验 | 类型/必填/字面量/联合/嵌套自动校验；对象节点须声明 `additionalProperties`；DSL 之外的约束（非空串/正数/跨字段）自己查 |
| 返回规范值 | `output.schema` 声明（对象/数组/标量/null）；`output.render` 转模型文本；工具主体**不返回内容块** |
| `exec` 只读 | `exec.signal` 遵守取消；`exec.agent` 可发异步通知（`agent.inject(...)`，不唤醒空闲 agent）；`exec.token`/`callId` 不可变 |
| 异常 = isError | 抛异常或返回无效值 = `isError`；成功但状态不理想也写规范值，由 render 解释 |
| 注册后不可变 | 注册后不改 schema/换回调；热替换 = dispose 副作用 + 注册替代品 |
| 组合依赖 | 工具需 `@deepseek-ai/dsh-system-prompt` 提供方（schema 流入系统提示词装配），否则 PENDING |

**执行策略与观测**（尽量别内建策略进工具）：

| 扩展点 | 用途 |
|---|---|
| `tools/pre-execute` | 允许/拒绝/询问（waterfall 返回 `{kind:'deny', reason}`） |
| `ctx.tools.guard()` | 单调最终拒绝，后续监听器无法撤销 |
| `tools/execute` | 超时/重试/指标；可替换 `exec.signal`（不能移除） |
| `tools/post-execute` | 变换结果/附加上下文/阻止结果 |
| `tools/result` | 观测不可变权威结果，不改变它 |

**其他**：Code Mode 下每个可见工具自动可 `await tools.<name>(args)`，成功=规范值，失败=`ToolCallError`。UI 卡片（`presentCall`/`presentResult` 返回 `generic`/`terminal`/`diff`/`search`/`web`）必须是 args 纯函数（回放也会跑）。长时间运行用 `run_in_background` + `ctx.jobs.start(...)` 返回 `{kind:'background', jobId}`。

## 加一个 LLM 适配器（官方 `cookbook/adding-an-llm-adapter.md` + `develop/practice/llm-adapter.md`）

```ts
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
class MyAdapter extends LlmAdapter {
  constructor(private apiKey: string) { super() }
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> { /* 翻译请求→provider→回 StreamChunk */ }
}
export const name = 'llm-myprovider'
export const inject = ['llm']
export const Config = z.object({ apiKey: z.string().required(), providers: z.array(z.string()).required() })
export function apply(ctx: Context, config: Config) {
  ctx.llm.registerAdapter(config.providers, new MyAdapter(config.apiKey))   // effect 化，HMR-safe
}
```

- **注册**：`registerAdapter(['my-provider'], adapter)`——一个 provider 一个 adapter，重复 throw，多 route 全有全无。`options.provider` 选 adapter、`options.model` 是 provider 的 model id（动态目录适配器可服务新 model 免重配）。
- **`resolveModel(provider, model, signal?)`**：一次查询返回确切 provider/model 身份 + 可选 `context`/`reasoning` 元数据；推理强度是有序 opaque id 列表（含上游 `off`）；须响应 `signal`；`stream()` 前服务会校验显式 reasoning 是否受支持。
- **`listModels()`**：适配器能向选择器公布模型选项时覆写。
- **`attributionHeaders()`**：每个 provider HTTP 请求必须合并；配合 `options.signal` 透传。
- **StreamChunk 协议义务**（两个实现验证过的契约）：`usage` 必须在 `finish` **之前**发，`finish` 后什么都别发（稳妥法：把 finish/usage 缓冲到 provider 流结束再 flush，处理尾部仅 usage 的块）；工具调用 `arguments` 是 **raw JSON 字符串**端到端（增量用 `argumentsDelta`，provider 给对象就在 `block-end` 重 stringify）；block `index` 按首见流序分配，同一 block 的每个 delta 复用该 index；tool-call 用 `block-start/blockType:'tool-call'` + `tool-call-delta` + `block-end`。
- **错误两条合法路径**：① 从 `stream()` **throw** `LlmError`（传输/协议失败，带稳定 code，如 `PROVIDER_HTTP_ERROR`）；② 以 `finish {kind:'error'|'aborted'}` 结束流（provider 带内失败）。**别**依赖普通 `Error` 被自动转换。
- 尊重 `options.signal`（透传给 fetch/SDK）；provider 无法兑现的字段（如无 stop 序列却收到 stop 列表）→ throw `LlmError(..., 'UNSUPPORTED')`，别静默丢弃。
- 需要原生元数据（response id/签名）续调 → 以最小 lossless-JSON 投影发 `finish.replayState`；`LlmRuntime` 只在历史 route 与目标 route 当前归同一 adapter 实例时回传它。
- **密钥走 cordis 原生**：schemastery Config + env 回退，`!!js process.env.MY_KEY`；**别在代码里读 ad-hoc 密钥文件**。thinking-mode 开关留在 adapter 自己的 Config。
- **实战对照**：`packages/llm/llm-deepseek/`（OpenAI 兼容）、`packages/llm/llm-pi-ai/`（不同 API 格式）——同一 harness 契约的两套完整实现。

