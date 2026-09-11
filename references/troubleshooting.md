> [← 主入口 SKILL.md](../SKILL.md)

## 验证清单

1. **语法**：`node --check lib/index.js`（宿主）与 `node --check lib/client.js`（客户端 bundle）
2. **全链路模拟**（不起 DSH）：mock ctx（`settings.register` / `webServer.register` / `effect`）+ 临时目录跑引擎；断言关键路径（排除/符号链接/stale 删除/幂等二次 0 复制）
3. **宿主路由冒烟**（mock ctx 驱动 webServer handler，用 `Readable` stream 模拟 body）：`GET /xxx/status` 回布尔且**不回显 secret**；`POST /xxx/config` 白名单键、空值 400、GET 405、持久化进 `scope.update`
3. **客户端结构**：模拟浏览器加载 bundle → 断言 exports.apply/inject、slot 条目形状
4. **真实 API**：`import { createClient }` → `await createClient(config)` → `client.raw({ path: '/api/v4/user' })`
5. **重启后复验**：curl 宿主路由 + `curl -o /dev/null -w "%{http_code}" /plugins/<id>/client.js`；会话内调工具名，靠报错信息判新旧代码

## 优化技巧

### 按需工具披露（类 Claude Code tool_search）

DSH 无现成插件——官方仅文档化模式（extension-cookbook：替换作用域化 `ctx.tools.restrict()` 注册，对应展示/查找/执行三段）。自建时：
- 常驻极小 `tool_search(query)` 元工具（唯一常驻）；可见性插件监听其调用 → 匹配工具 restrict mask deny→allow（live 生效，下一轮装配进提示词）
- `restrict()` 隐藏时该 agent 的 schema 成本**归零**（dsh-tools README 原话）
- `presentAs('code')` 用 SDK 文本替换完整工具 schema
- 适用前提：工具集大（几十上百）或个别工具 schema 很重；十几个小工具时 ROI 低

### 其他省 token 手段

- **`ctx.tools.restrict(filter)`**：agent 级 allow/deny 可见性门控，live，多 mask 交集。隐藏工具 = 不进提示词 = schema 成本归零
- **`ctx.tools.presentAs('code')`**：code 模式用生成 SDK 文本替换完整 JSON Schema，适合 SDK 直连范式的工具
- **description 精简**：description 是模型直接读的文本，写短最省；工具名 + 参数类型也占 token

## 已知坑

- **bundle 重复 insert**：`dsh plugin add` 已把 bundle patch 层叠进树，profile `cordis.patch.yml` 再 `- insert:` 同一 **id** → `duplicate loader entry id`，`dsh web` 起不来。bundle 插件只写 `- id: xxx` 改 config/disabled；非 bundle 才 insert。
- **GitHub 装配名 ≠ package.json name**：loader 按 bundle patch 的 `name:` import；`dependencies` 键若用 GitHub org 别名而包内 name 不同，会 `Cannot find package`。修法：`dependencies` 键与 patch `name:` 保持一致；**bundles 只列一份**——别对 alias 依赖再跑 `plugin add`（`reconcilePlugins` 会把每个带 `dsh.bundle` 的 dependency 都追加进 bundles）。
- **DSH 升级后 fallback 错位**：`healProfilesModuleFallback` 每次启动跑，但旧 `profiles/node_modules` 软链可能仍指向过期 global/store → 首页 400。升级后 `cd ~/.dsh/profiles/web && pnpm install` + `dump-config` 验合成；查 `dsh-host-webserver` 链接版本。
- **升级后排障是常态**：DSH 处于开发者预览期，官方明示后续版本会有破坏性变更——每次升级先跑上条 ritual（`pnpm install` + `--dump-config`），再逐插件验证（会话调工具名 / curl 路由，见 [restart.md](restart.md)），最后才定位新故障；MCP 桥接实例的重连状态在日志里可见（reconnecting / recovered / disabled-loss）。
- **patch 不能改 entry 的 `name`**：`applyEntryPatches` 里 name 仅校验，不匹配则跳过——别指望用 profile patch 把 `@changfenhuang/foo` 重定向到 `@omdsh-dev/foo`。
- **服务端 HMR 假象**：`dev_plugin_status` 可能显示一个 active 的 `cordis-plugin-hmr`（自动 id 条目），但**实测改宿主代码不热生效**（改 status 响应加字段，保存 4s 后无变化）——别信运行时有 hmr 就跳过重启。`dsh --profile web --dump-config` 里该条目是 `disabled: true`。
- **设置"保存成功"是假象**：第三方命名空间走 `settingsScope.set` / `hooks.settings` + `useSettings`，读写在代理层被 `settings-not-exposed` 拒绝且**客户端静默 resolve** → UI 提示"已保存并热生效"但 settings.yaml 无变化。诊断：`grep -c accessKeyId ~/.dsh/settings.yaml` 看落盘没有；改走插件自有路由 + `scope.update`（见 [client-ui.md](client-ui.md#设置页注册settingssection-槽位)）。
- **curl 新路由返回 200 HTML ≠ 宿主生效**：未注册路径回退 `index.html`（SPA 首页，200 text/html）、非 GET/HEAD 回 405（官方 web-server.md 语义）——验证宿主代码用 `curl -si <path>` 看 `content-type` 是不是 `application/json`，别只看状态码。
- **插件 `pending (waiting for service: server)`**：Web profile 提供的是 `ctx.webServer`，路由 API 是 `ctx.webServer.register({ kind, path, handler })`；插件应声明 `inject = ['webServer']`。若 `dsh plugin list` 没列出该插件，仍检查 `~/.dsh/super-injector/registry.json`，运行时注入记录也会参与启动；修复源码后重新构建 `lib/` 并重启 `dsh web`。
- glab CLI 认证在 DSH 会话内不可靠（多 host 默认 gitlab.com 无 token 401、spawn/keychain 被沙箱拦）→ 插件用纯配置 host+token
- schemastery Config schema 无 `.parse`/`.validate` 方法（原型上是 toJSON/toString），别用它做运行时校验
- `detectBaseUrl` 等解析逻辑先用 node 回放真实输出验证再信
- 改 `cordis.patch.yml` / 插件代码后没生效 → 先按 [restart.md](restart.md) 判断是否需要重启、再看报错新旧，别盲目改配置
- **pnpm 拦 postinstall**：esbuild 等依赖装完要 `pnpm approve-builds`，否则 build 时静默缺二进制
- **esbuild devDependency 不随 profile 装**：link 插件被 profile `pnpm install` 时只装它的运行时 dependencies；构建工具要在插件目录自己 `pnpm i`（devDependencies）
- **客户端 bundle 改动 = 刷新即可**：`serveBundle` 不校验 rev 直接读磁盘，别为此重启（见重启语义表）
- **slots 注册选项白名单化**：`ctx.slots.register` 只存 key/id/order/label/priority 等固定字段，**自定义 option（如 `icon`）被静默丢弃** → 想给 shell 塞自定义元数据定制渲染走不通，得改 shell 渲染（见 [client-ui.md](client-ui.md#在设置里加-logo--dsh-定制-shell-渲染)）。
- **运行时克隆 git 分叉**：`~/.dsh/plugins/<name>` HEAD 落后 origin/main、working tree 是文件拷贝的"新内容"（一堆未提交改动）时，提交推送前先 diff 它对 origin/main；若只是旧子集（无独有内容）用 `git fetch origin && git reset --hard origin/main` 把工作树退回远端状态，**别**在旧 HEAD 新建提交（分叉 + push 被拒 + 重复历史）。
