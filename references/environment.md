> [← 主入口 SKILL.md](../SKILL.md)

## 本机环境

| 项目 | 值 |
|---|---|
| GUI | `http://127.0.0.1:3080` |
| `$DSH_HOME` | `~/.dsh` |
| 官方仓库克隆 | `/Users/apple/dev/deepseek-harness`（**shallow `master`，只读参考**）：`docs/`=官方文档全文(英/中成对)、`packages/`=各包源码+README。站点路径→克隆 `docs/` 映射与重点文件见 `docs-official/INDEX.md`。更新：`git fetch --depth 1 origin master && git reset --hard origin/master` |
| web profile | `~/.dsh/profiles/web/`（`cordis.yml` 根为 `[]`；**bundle 插件**用 `dsh plugin add` 装，**非 bundle** 在 **`cordis.patch.yml`** insert + config） |
| 配置路径 | `cordis.patch.yml` 的 insert `config`（⚠️ `settings.yaml` 的插件节不被读进插件静态 `config`，但 settings 服务 `scope.get()` 读的是 base+用户层，热生效） |
| settings 白名单 | **`settings-not-exposed`**：插件命名空间读/写被 `dsh-host-apiproxy` 白名单挡（仅模型 provider + `WEB_SETTINGS_NAMESPACES` + `PRODUCT_SETTINGS_NAMESPACES`），客户端静默吞错 → 配置读写走插件自有路由（见 [client-ui.md](client-ui.md)） |
| 服务端 HMR | **默认关**（`cordis-plugin-hmr` 条目 `disabled: true`，`dsh --profile web --dump-config` 实证）→ 改宿主代码需重启 |
| 客户端 HMR | **默认开**（`dsh-client-hmr` 条目启用，SSE `/plugins/events` 在线）→ 改 `lib/client.js` 刷新即可，自动热换别依赖 |
| 参考插件 | `/Users/apple/dev/dsh-config-sync`（设置页 UI+三路由+settings ns，同款插件自有路由模式）、`~/.dsh/plugins/dsh-ark-quota`（**settings.section 顶栏分区 + 插件自有 status/credentials 路由 + refreshSignal**，本模式最佳范例）、`/Users/apple/dev/dsh-gitlab-tools`（纯工具） |
| 运行时克隆 | `~/.dsh/plugins/<name>` 是 profile `link:` 引用的**独立 git 克隆**（与规范 dev 仓库 `/Users/apple/dev/<name>` 同远端）；文件拷贝同步会让它 HEAD 落后 + 攒一堆未提交改动，git 对齐见 [troubleshooting.md](troubleshooting.md#已知坑) |
| 沙箱 | 默认 workspace-write 仅写 `/Users/apple/dev`；写 `~/.dsh` 需 `danger-full-access` 升级 |
| MCP | 0.1.0-rc.6 无桥接 → 扩展走 cordis 插件或 `~/.agents/skills` |

