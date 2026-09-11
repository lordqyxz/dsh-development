> [← 主入口 SKILL.md](../SKILL.md)

## MCP 桥接（0.1.5-rc.1 起）

> **版本口径**：0.1.5-rc.1 起官方提供 MCP 桥接。旧结论「0.1.0-rc.6 无 MCP 桥接、外部 MCP server 无法注册进 DSH」**已作废**。
> **真源**：克隆内 `packages/mcp/mcp-client/README.zh.md`（用法/配置/工具命名/重连行为）与 `docs/config-catalog.zh.md` 的 `@deepseek-ai/dsh-mcp-client` 节（生成的 TS Config 接口）；本页与其冲突时以克隆为准。

### 选型规则（先分清三类需求）

| 需求 | 用什么 | 实例 |
|---|---|---|
| 外部系统已有现成 MCP server | 官方桥接插件 `@deepseek-ai/dsh-mcp-client`，不重写 | 见下节，patch insert 即接 |
| 需要设置面板 / 客户端 UI / 宿主状态 | 纯 Cordis 插件（可自行 spawn 外部官方 MCP server 子进程，注册 `mcp__<name>__*` 形式工具） | `dsh-gitlab-tools`（`/Users/apple/dev/dsh-gitlab-tools`，纯 GitLab 工具，不走 MCP）；`dsh-feishu-mcp`（拉起 `@larksuiteoapi/lark-mcp`，带 web 设置面板） |
| 纯流程规范（怎么做事，不是新能力） | skill（`~/.agents/skills/`） | `gh-cli` 直接调 CLI |

### 官方路径：`@deepseek-ai/dsh-mcp-client`

桥接插件连接外部 [MCP](https://modelcontextprotocol.io/) server，把其工具注册进 `ctx.tools`。该包**无 `dsh.bundle`** manifest → 走非 bundle 路径：`dsh plugin --profile web add @deepseek-ai/dsh-mcp-client` 只进 profile `dependencies`（不进 bundles，见 [plugins.md](plugins.md#两个概念官方)），**每个 MCP server 在 `cordis.patch.yml` insert 一个实例**：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml — 每个 server 一个实例
- insert:
    - id: mcp-github
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: github
        transport: stdio
        command: npx
        args: ['-y', '@modelcontextprotocol/server-github']
        env:
          GITHUB_TOKEN: !!js process.env.GITHUB_TOKEN

- insert:
    - id: mcp-web
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: web
        transport: streamable-http
        url: http://localhost:3000/mcp
        headers:
          Authorization: !!js '`Bearer ${process.env.MCP_TOKEN}`'
```

模型看到 `mcp__github__create_issue`、`mcp__web__search` 这样的原生工具——与 Claude Code / Codex 的 server 限定命名同形状。

**Config 键**（`transport` 二选一，决定其余键归属 stdio 还是 http 组；来源 `config-catalog.zh.md`）：

| 键 | 传输 | 必填 | 说明 |
|---|---|---|---|
| `transport` | 两者 | 是 | `"stdio"` 或 `"streamable-http"` |
| `serverName` | 两者 | 是 | 工具名 namespace，`[A-Za-z0-9_-]{1,32}`，存活实例间唯一（重复 → 后加载实例失败） |
| `command` / `args` / `env` / `cwd` | stdio | `command` 必填 | spawn 子进程；args 不经 shell 插值；env 合并到已清理的环境之上 |
| `url` / `headers` | http | `url` 必填 | MCP 端点 URL + 附加请求头（如认证 token） |
| `toolCallTimeoutMs` | 两者 | 否 | 每次 `callTool` 的超时（默认 60000） |
| `failOnStartupError` | 两者 | 否 | 初始连接/工具同步失败时拒绝插件激活（默认 `false`；否则仍激活但不注册工具） |
| `reconnect.*` | 两者 | 否 | 断线自动重连：`enabled`(默认 true) / `initialDelayMs`(500，逐次翻倍) / `maxDelayMs`(30000，也是重置尝试预算所需存活时长) / `maxAttempts`(10，耗尽后注销该 server 工具并停止重连) |

**工具命名**：公开名 `mcp__<serverName>__<rawName>` 注册进 `ctx.tools`，规范化到 64 字符 `[A-Za-z0-9_-]`；截断/替换会追加由 `(serverName, rawName)` 算出的确定性 12 位 hex hash——名称是这两个值的纯函数，重连/重新同步不重命名。协议内 `tools/call` 只用原始 MCP 名称，公开名绝不发给 server。两个 server 发布同名工具时在各自 namespace 下共存。

**热生效**：编辑该条目 config 触发断开 + 重新连接对应 server，**无需重启进程**（`serverName` 不变则工具名不变）；改完按 [restart.md](restart.md) 复验。

**已知限制**（官方 README「已知限制与暂缓事项」）：

- 只桥接 MCP **tools**；resources / prompts 无 harness 消费接口，暂缓实现。
- 启动连接/发现超时继承 MCP SDK（每次 initialize / 分页 `tools/list` 默认 60s），DSH 未另行公开启动超时。
- 图片是唯一持久富结果块（需挂载 `ctx.attachments` 且确切调用路由声明支持图片输入）；音频/嵌入资源只出现在执行局部的诊断文本。
- 已发现工具的 schema 每次请求都进提示词（token 成本随 server 工具数增长）；工具太多时优先在 server 侧精简。
- 重连按中断预算控制：连续失败达 `reconnect.maxAttempts` 后工具被注销、重连停止，直到 HMR 重载该条目或重启 Host；存活超过 `maxDelayMs` 会重置预算。

### 社区路径：纯 Cordis 插件承载外部 MCP server 子进程

宿主 Cordis 插件自己 spawn 外部官方 MCP server 子进程、消费其工具，并注册 `mcp__<name>__*` 形式的工具。适用于官方桥接插件覆盖不了的场景：要 web 设置面板（连接配置可视化编辑）、要客户端 UI、要把 server 状态接进宿主（统计/审查/缓存）。实例 `dsh-feishu-mcp`：拉起 `@larksuiteoapi/lark-mcp`，带 web 设置面板。插件写法本身（`apply` / `ctx.tools.register` / 设置页）见 [cordis.md](cordis.md) 与 [client-ui.md](client-ui.md)。
