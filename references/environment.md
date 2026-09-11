> [← 主入口 SKILL.md](../SKILL.md)

## 本机环境

| 项目 | 值 |
|---|---|
| GUI | `http://127.0.0.1:3080` |
| 启动 | `npx @deepseek-ai/dsh web`（Web UI 默认 `127.0.0.1:3080`）；`dsh --profile <name>` 多配置隔离 |
| 运行模式 | 标准（完整工具组合）/ PTC（程序化工具调用：模型写一段代码组合多轮工具调用，即官方文档的 Code Mode，`run_code` 传输）/ 极简（1 个 shell 工具 + 1 个文件编辑工具，用于基准测试）/ 创造（检查运行时、在内存试验插件、组合新模式） |
| `$DSH_HOME` | `~/.dsh` |
| 公开仓库 / 文档站 | `github.com/deepseek-ai/deepseek-harness`（MIT，基于 Cordis，"Everything is a Plugin"）· `deepseek-harness.github.io/deepseek-harness/` |
| 官方仓库克隆 | `/Users/apple/dev/deepseek-harness`（**shallow `master`，只读参考**）：`docs/`=官方文档全文(英/中成对)、`packages/`=各包源码+README。站点路径→克隆 `docs/` 映射与重点文件见 `docs-official/INDEX.md`。更新：`git fetch --depth 1 origin master && git reset --hard origin/master` |
| web profile | `~/.dsh/profiles/web/`（`cordis.yml` 根为 `[]`；**bundle 插件**用 `dsh plugin add` 装，**非 bundle** 在 **`cordis.patch.yml`** insert + config） |
| 配置路径 | `cordis.patch.yml` 的 insert `config`（⚠️ `settings.yaml` 的插件节不被读进插件静态 `config`，但 settings 服务 `scope.get()` 读的是 base+用户层，热生效） |
| settings 白名单 | **`settings-not-exposed`**：插件命名空间读/写被 `dsh-host-apiproxy` 白名单挡（仅模型 provider + `WEB_SETTINGS_NAMESPACES` + `PRODUCT_SETTINGS_NAMESPACES`），客户端静默吞错 → 配置读写走插件自有路由（见 [client-ui.md](client-ui.md)） |
| 服务端 HMR | **默认关**（`cordis-plugin-hmr` 条目 `disabled: true`，`dsh --profile web --dump-config` 实证）→ 改宿主代码需重启 |
| 客户端 HMR | **默认开**（`dsh-client-hmr` 条目启用，SSE `/plugins/events` 在线）→ 改 `lib/client.js` 刷新即可，自动热换别依赖 |
| 参考插件 | `/Users/apple/dev/dsh-config-sync`（设置页 UI+三路由+settings ns，同款插件自有路由模式）、`~/.dsh/plugins/dsh-ark-quota`（**settings.section 顶栏分区 + 插件自有 status/credentials 路由 + refreshSignal**，本模式最佳范例）、`/Users/apple/dev/dsh-gitlab-tools`（纯工具） |
| 运行时克隆 | `~/.dsh/plugins/<name>` 是 profile `link:` 引用的**独立 git 克隆**（与规范 dev 仓库 `/Users/apple/dev/<name>` 同远端）；文件拷贝同步会让它 HEAD 落后 + 攒一堆未提交改动，git 状态修正步骤见 [troubleshooting.md](troubleshooting.md#已知坑) |
| 沙箱 | 默认 workspace-write 仅写 `/Users/apple/dev`；写 `~/.dsh` 需 `danger-full-access` 升级 |
| MCP 桥接 | **0.1.5-rc.1 起内置**：官方 `@deepseek-ai/dsh-mcp-client` 经 `cordis.patch.yml` insert 接入；外部系统已有现成 MCP server 就桥接不重写，需要设置面板/宿主状态用纯插件，流程规范用 skill——详见 [mcp.md](mcp.md) |

