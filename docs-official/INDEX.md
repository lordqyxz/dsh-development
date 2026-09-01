# DSH 本地仓库索引（deepseek-harness）

Skill 主入口与分主题参考：`../SKILL.md`、`../references/`（plugins / cordis / architecture / capabilities / client-ui / docs-index / environment / troubleshooting）。

**主参考源 = 本地完整仓库克隆**：`/Users/apple/dev/deepseek-harness`（shallow clone，`master`）。

- `docs/` — 官方文档源（英文 `.md` + 中文 `.zh.md` 成对），发布站 `https://deepseek-harness.github.io/deepseek-harness/en/` 由它生成。
- `packages/<name>/` — 每个包的源码 + README（含 config/扩展点/Model Experience 契约）。
- `apps/`、`python/`、`examples/`、`website/` — CLI、Python、示例、VitePress 站点源。
- 官方子文档 `docs/AGENTS.md` 定义文档分层与写作规约（哪些是 generated、哪些手写）。

> 本目录 `docs-official/` 只保留少量**自包含**中文离线副本（无克隆也能看）：
> `cordis-primer.zh.md`、`cordis-tutorial_*.zh.md`（01/05/06/07/index）、`user_develop_basic_index.zh.md`、`user_develop_basic_tool.zh.md`、`cookbook_adding-a-tool.zh.md`、`cookbook_extension-cookbook.zh.md`、`reference_architecture.zh.md`。
> **其余文档一律读本地克隆 `docs/`**（有克隆时优先），别为单页下载副本。

## 站点 URL → 克隆 docs/ 路径

站点路径（`/en/` 后）与克隆内 `docs/` 路径的映射规则：
- `reference/<x>` → `docs/<x>.md`
- `reference/cookbook/<x>` → `docs/cookbook/<x>.md`
- `reference/cordis-api/<x>` → `docs/cordis-api/<x>.md`
- `reference/subsystems/<x>` → `docs/subsystems/<x>.md`
- `develop/basic/<x>` → `docs/user/develop/basic/<x>.md`
- `develop/framework/<x>` → `docs/user/develop/framework/<x>.md`
- `develop/practice/<x>` → `docs/user/develop/practice/<x>.md`
- `develop/cordis-tutorial/<x>` → `docs/cordis-tutorial/<x>.md`
- `guide/quickstart` → `docs/user/guide/index.md`

每个 `docs/` 下都有同名 `.zh.md`（中文对照，英文为准）。

## 重点文件速查（克隆 `docs/` 下）

| 路径（`docs/` 下） | 一句话 |
|---|---|
| `architecture.md` | 架构总览：核心 ctx 服务 / 事件三类 / turn flow / session log 不变量 / seams / profiles & bundles / 新行为去哪 |
| `capability-seams.md` | **全量 ctx.\* 服务索引表**（role/owner/provider/consumer/一句话） |
| `agent-lifecycle.md` | agent 轮次/step 序列图 + 取消与错误恢复 |
| `tool-execution-pipeline.md` | 工具执行管道全序（pre-execute→guards→approval→execute→post→finalize→result） |
| `config-catalog.md` / `tool-catalog.md` / `persistence-catalog.md` | 生成的配置 / 工具 schema / 持久事件目录 |
| `event-producer-consumer.md` | 事件生产者/消费者矩阵 |
| `cordis-api/context.md` 等 | Context / Events / Fiber / Registry / Service / Inherited API |
| `cookbook/adding-a-tool.md` | 工具编写真源 |
| `cookbook/adding-an-llm-adapter.md` | 接新模型 provider（LlmAdapter + StreamChunk 协议） |
| `cookbook/adding-a-settings-card.md` | 官方设置卡模式（installSettingsSection + settings.plugin.item 槽 + settingsScope） |
| `cookbook/adding-a-conversation-node.md` | Web Chat 节点（事件族→Context→State→renderer） |
| `cookbook/adding-a-package.md` | 在仓库加 workspace package |
| `cookbook/extension-cookbook.md` | 扩展插件形态 + 功能→机制映射 |
| `user/develop/basic/tool.md` | 工具 step-by-step |
| `user/develop/basic/config.md` | 插件配置（Config schema/校验/HMR） |
| `user/develop/basic/publish.md` | **打包发布**（bundle vs profile、`dsh.bundle`/`dsh.profile`、`dsh plugin add`、层序） |
| `user/develop/framework/service.md` | 提供服务（inject/声明合并/isolate） |
| `user/develop/framework/events.md` | 事件四模式 emit/bail/serial/waterfall |
| `user/develop/framework/index.md` | 插件生命周期 / Fiber 状态机 / HMR / dispose |
| `user/develop/practice/llm-adapter.md` | LLM 适配器上手 |
| `subsystems/tools.md` | `ctx.tools` 注册表/守卫管道/restrict/presentAs |
| `subsystems/web-server.md` | `ctx.webServer` 插件自有路由（设置读写通道真源） |
| `subsystems/settings.md` / `credentials.md` | 用户设置 / 凭据 seam |
| `subsystems/client-modules.md` | 客户端 bundle 发现/服务/rev |
| `subsystems/AGENTS.md` | 文档分层/写作规约 |

## 其余 subsystems（`docs/subsystems/`）

`core` `scope` `invariants` `session` `session-query` `session-reference` `session-title` `session-projection` `persistence` `spill` `session-telemetry` `llm-streaming` `token-meter` `system-prompt` `compaction` `tools` `shell` `subprocess` `terminal` `jobs` `filesystem` `lsp` `code-runtime` `web` `skills` `workflow` `subagent` `approval` `permission-presets` `sandbox` `plan` `user-questions` `commands` `goal` `schedule` `web-server` `typert` `client-modules` `storage` `workspace` `settings` `credentials` `attachment` `agent-team` `extensions` `feedback`

## 更新本地克隆

克隆是 shallow（`--depth 1`）。官方文档/源码有更新时：

```sh
cd /Users/apple/dev/deepseek-harness && git fetch --depth 1 origin master && git reset --hard origin/master
```

> ⚠️ 本仓库仅作**只读参考**，别在上面新建提交/分支（会破坏 shallow 对齐；它和 `~/.dsh/plugins/<name>` 的运行时克隆不是一回事）。
