> [← 主入口 SKILL.md](../SKILL.md)

## 什么时候需要重启（官方文档 + 本机实证）

**TL;DR：改宿主 JS 代码（`lib/index.js`）＝必须重启；改客户端 bundle / `settings.yaml` 用户层＝免重启（刷新页面即可）；改 `cordis.patch.yml` 已有条目的配置值＝热生效（配置 + 客户端 bundle 重扫）但不重载宿主模块代码——若改动依赖新宿主代码，仍要重启。**

| 改动类型 | 生效方式 | 依据 |
|---|---|---|
| 宿主插件代码 `lib/index.js`（服务端逻辑/工具/路由/配置 schema） | **必须重启** | 官方 [cordis-tutorial 06（HMR）](https://github.com/deepseek-ai/DeepSeek-Harness/blob/master/docs/cordis-tutorial/06-composition-and-hmr.md)：只有 `@deepseek-ai/cordis-plugin-hmr` 监视文件才会在保存时卸载+重载插件；而 web profile 组合树里该条目 **`disabled: true`**（`dsh --profile web --dump-config` 实证）。本机实证（dsh-config-sync / dsh-ark-quota）：改 index.js 加新路由，热重组后路由未出现，重启才生效 |
| `cordis.patch.yml` **改已有条目的 config 值** | **热生效**：配置值 + 客户端 bundle 重扫（`client.js?rev=` 变化）；但**不重载宿主模块代码** | 官方 06：编辑 cordis.yml 本身触发 loader 按 **id** 比较、只重新配置/挂载/卸载变化部分。本机实证（2026-08 方舟额度）：只改 entry config 未重启，客户端 bundle rev 变了、配置热应用；但 `lib/index.js` 的新路由未生效（curl 到新路径返回 SPA 首页 HTML 而非 JSON）→ 涉及宿主代码仍要重启 |
| `@deepseek-ai/dsh-mcp-client` 条目 config（server/transport/headers 等） | **热生效**：断开 + 重新连接对应 MCP server，不重启进程；`serverName` 不变则工具名不变 | 官方包 README（克隆 `packages/mcp/mcp-client/README.zh.md`）：编辑配置项触发断开 + 重新连接 |
| `cordis.patch.yml` **加/删条目** | loader 热挂载/卸载（官方 06 语义）；若同时改了宿主代码，**重启更稳** | 同上；加/删条目的宿主重载行为未逐条实测 |
| `profile/package.json` **bundles 列表变化**（`plugin add/remove/update` 激活/移除 bundle） | **必须重启** | 官方 `apps/cli/reference/README.md`：pnpm 成功后只改磁盘 manifest，**运行中的 profile 保留启动时的 bundle 集合**；profile/home 的 `cordis.patch.yml` 编辑可走热重载 |
| `profile/package.json` 依赖变化（非 bundle 成员，如纯库） | **必须重启**（先 `cd ~/.dsh/profiles/web && pnpm install`） | loader 启动时解析依赖图 |
| 客户端 bundle `lib/client.js` | **无需重启**，刷新页面即可；本机 `client-hmr` 已启用（SSE `/plugins/events` 在线）→ 可能自动热换，但**别依赖它**，手动刷新必生效 | 官方 [web-server.md](https://github.com/deepseek-ai/DeepSeek-Harness/blob/master/docs/subsystems/web-server.md)：`dsh-client-modules` 经 `tapIndex` 注入 boot 清单，bundle 按文件内容重新哈希/服务 |
| `settings.yaml` 用户层（settings 服务 `scope.watch`/`scope.update`） | **无需重启**，热生效 | `dsh-settings` 每次 commit 触发 watch；方舟额度密钥经 `scope.update` 写入后立即生效 |
| 插件运行时自注册的东西 | 运行时即时生效 | 插件内自行设计 |

**原理（官方依据）**：web profile 的**宿主 HMR 关**（`cordis-plugin-hmr` 条目 `disabled: true`，`--dump-config` 实证）+ **loader 对 patch/yml 的 id 级热重组**（官方 06）+ **客户端 HMR 开**（`dsh-client-hmr` 条目启用、SSE 在线）。所以：宿主代码＝重启；配置/客户端＝免重启。

**验证宿主是否真生效（关键坑：别被 200 骗了）**：
```bash
# 新路由返回 JSON（content-type: application/json）＝宿主已生效
curl -si http://127.0.0.1:3080/ark-quota/status | head -3
# 若返回 text/html 的 index.html（200，回退 SPA 首页）或非 GET/HEAD 得到 405 ＝宿主代码还没活，需重启
# （官方 web-server.md：未命名路由 miss 回退 index.html 且 HTTP 200；非 GET/HEAD 一律 405）
```

**"看到保存成功但没生效"是另一类问题**：设置 UI 里第三方插件命名空间点保存提示"已保存"，实际可能被平台白名单**静默拒绝**（`settings-not-exposed`，客户端吞掉错误）——这种"假成功"**不是重启能解决的**，先确认写入通道是不是插件自有路由。见 [client-ui.md](client-ui.md#设置页注册settingssection-槽位) 与 [troubleshooting.md](troubleshooting.md#已知坑)。

