> [← 主入口 SKILL.md](../SKILL.md)

## 客户端 UI 插件（设置页/槽位/webServer 路由）

宿主插件负责**服务端逻辑**（webServer 路由、settings namespace、引擎），客户端插件负责**浏览器 UI**（设置页/侧栏 widget/会话 tab）。两半区通过**同源 HTTP 路由**通信（客户端 `fetch('/xxx/...')` → 宿主 `ctx.webServer.register` 的 handler）。完整可运行范例：`/Users/apple/dev/dsh-config-sync`（设置页「配置同步」+ 三路由 + settings ns）。

### webServer 路由契约

Web profile 的 HTTP 服务键是 `webServer`（大写 `S`），由 `@deepseek-ai/dsh-host-webserver` 提供。宿主插件声明 `export const inject = ['webServer']`，并通过 `ctx.webServer.register({ kind, path, handler })` 注册路由；路由字段是 `handler`，不是 `server`、`registerRoute` 或 `handle`。注册应放在 `ctx.effect()` 中，以便插件卸载时自动移除路由。

### 包结构（package.json 三件套，client-modules 发现必需）

```jsonc
{
  "name": "dsh-config-sync",          // = loader entry name（cordis.patch.yml insert 的 name）
  "main": "lib/index.js",             // 宿主
  "exports": { "./client": "./lib/client.js" },  // ← 客户端 bundle 出口
  "dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] } }
  // 运行时依赖只放宿主需要的（如 @deepseek-ai/schemastery）；esbuild 放 devDependencies
}
```

`dsh-client-modules` 按 loader entry name 解析 package.json → 读 `dsh.client` 声明（platform=web）→ 经 `exports["./client"]` 定位 bundle → 服务到 `/plugins/<id>/client.js?rev=<sha1-12>`。`dev_plugin_status` 能看到 bundle 是否被注册。

### 客户端 bundle 格式（esbuild 构建，产物提交）

```js
window.__ModuleLoader__.load({ id: "dsh-config-sync", factory: (require) => {
  var module = { exports: {} }; var exports = module.exports;
  // ...打包体，平台模块经 require 从 loader 模块表解析（externals）...
  return module.exports; } });
```

构建脚本（`scripts/build.mjs`，参考 dsh-config-sync / dsh-memory-evolve）：
- **EXTERNALS（平台模块表，必须 external，绝不内联）**：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`cordis`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-web-react`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-schema-form`、`@deepseek-ai/dsh-client-runtime/client`
- `format: 'cjs'`, `platform: 'browser'`, `jsx: 'automatic'`, `define: { 'process.env.NODE_ENV': '"production"' }`
- banner/footer 如上（`window.__ModuleLoader__.load({ id, factory })` + `return module.exports`）
- **esbuild 装完要 `pnpm approve-builds esbuild`**（pnpm 默认拦 postinstall）

### 设置页注册（settings.section 槽位）

> ⚠️ **第三方命名空间的设置读写被平台白名单挡死（settings-not-exposed）——本次方舟额度"保存了没生效"的根因。**
> DSH 配置客户端（`dsh-host-apiproxy`）只暴露平台自己的命名空间：LLM 模型 provider + `WEB_SETTINGS_NAMESPACES` + `PRODUCT_SETTINGS_NAMESPACES`。插件 `ctx.settings.register` 的命名空间**读（settings.describe）和写（settings.mutate）都被拒绝**，且客户端 `SettingsScopeController` **静默吞掉失败**（resolve 而非 reject）→ GUI 提示"已保存"但什么都没写入。
> 这是**平台安全边界**（源码级、官方教程未覆盖），没有插件扩展点。**别在第三方插件里用 `ctx.settingsScope.bind()` + `scope.set()` / `hooks.settings` + `useSettings` 读写配置**——那套只对平台命名空间有效。

**正确模式（本机实证，dsh-ark-quota / dsh-config-sync 同款）**：宿主注册**插件自有路由**（`ctx.webServer.register`，官方一等公民，见 [web-server.md](https://github.com/deepseek-ai/DeepSeek-Harness/blob/master/docs/subsystems/web-server.md)）读写命名空间；客户端设置卡用 `fetch` 调这些路由，完全不碰 settingsScope。

```ts
// 宿主 lib/index.js
import { type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'   // schemastery 默认导出即 zod 兼容 API（z.object / .role()）
// ① 注册命名空间（获得 scope：get / watch / update）
export const inject = ['settings', 'webServer']
export function apply(ctx: Context) {
  const scope = ctx.settings.register('my-ns', z.object({
    token: z.string().role('secret').default(''),
  }), { base: { token: '' } })
  // ② 插件自有路由：GET 状态（绝不回显 secret，只回布尔）、POST 写配置（白名单键）
  const readBody = async (req: IncomingMessage): Promise<Record<string, unknown>> =>
    JSON.parse(await new Promise((res) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => res(b)) }))
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/my-plugin/config', handler: async (req, res) => {
    if (req.method !== 'POST') return res.writeHead(405).end()
    const patch = Object.fromEntries(Object.entries(await readBody(req)).filter(([k, v]) => k === 'token' && typeof v === 'string'))
    if (Object.keys(patch).length === 0) return res.writeHead(400).end('{"ok":false}')
    await scope.update(patch)          // 直写用户层，绕过代理白名单，持久化 settings.yaml
    res.writeHead(200).end('{"ok":true}')
  }}), 'route-my-plugin-config')
}
```

```tsx
// 客户端 lib/client.js（inject = ['slots']，不要 settingsScope）
function MySection() {
  // fetch('/my-plugin/config', { method: 'POST', body: JSON.stringify({ token }) }) 保存
  // fetch('/my-plugin/status', ...) 读已配置状态（布尔），绝不把 secret 值回传浏览器
  // 保存成功后 fire 模块级 refreshSignal → 侧栏 widget 立即重读
}
```

要点：
- **读**：`GET /xxx/status` 只回 `{ ok, configured }` 布尔，**绝不回显 secret 值**（`role('secret')` 只写字段 + 不回传）。
- **写**：`POST /xxx/config` 只接受固定形状白名单键（防 SSRF/字段注入）；`scope.update(patch)` 宿主侧直写，绕开代理白名单。
- **保存后联动**：模块级 `refreshSignal`（`{ listeners:Set, subscribe(fn)→disposer, notify() }`），设置卡保存成功 `notify()`，widget `useEffect` 里 `subscribe(() => q.load(true))`。
- 宿主只用 `scope.get()`（base+用户层）读生效配置，别读静态 `config`。
- 槽位注册形状：`ctx.slots.inject('settings.section', () => ctx.slots.register({ name:'settings.section', id, order, label }, SectionComponent))` —— `settings.section` 是设置页**左侧导航整页**（与 built-in 分区平级，order 如 200/300），不是「插件」Tab 里的一张小卡。`settings.section`（整页）/ `settings.general.item`（General 里一行）/ `settings.action`（面板头部动作）；还有 `sidebar.footer.action`（侧栏小组件）、`conversation.view`（会话 tab）。

### settings scope（读写契约，注意平台边界）

| 半区 | API | 第三方命名空间可用？ |
|---|---|---|
| 宿主 | `ctx.settings.register(ns, Schema, { base })` → scope：`get()`（base+用户层解析值）、`watch(cb)`（commit 后触发）、**`update(patch)`**（合并写入用户层并持久化）、`replace(section)` | ✅ **`update`/`get`/`watch` 宿主侧全可用**（这是绕开代理白名单的通道） |
| 客户端 | `ctx.settingsScope.bind({ namespace })` → controller：`getSnapshot()`/`subscribe()`、**`set(field, value)`**/`unset(field)`（走 `/api` settings.mutate） | ❌ **被白名单挡**：describe + mutate 都回 `settings-not-exposed`，客户端**静默 resolve**（"已保存"假象） |

**结论**：UI 读写配置一律走**插件自有路由 → 宿主 `scope.update(patch)`**（宿主集中校验、白名单键）；客户端 `settingsScope.set` 只适用于平台命名空间。宿主只读用 `scope.get()`，热生效免重启（见重启语义表）。

### 官方文档化的设置卡模式（`cookbook/adding-a-settings-card.md`，与上面本机实证并行看）

> 官方 cookbook 描述的**受支持路径**是「注册命名空间 + 注册 `settings.plugin.item` 卡片 + 用 `settingsScope` 读写」，Host 提供命名空间即自动配对。**它与上面"本机白名单挡死"的实证存在张力**——本机 web profile 里第三方命名空间被 `dsh-host-apiproxy` 白名单拒（`settings-not-exposed`），所以若你遇到"保存了没生效"，仍是插件自有路由那套最稳。两条路都列着，按部署验证走。

**Host 半区**（`installSettingsSection` 把 entry config 层进 user 文档，settings provider 未挂也照常）：

```ts
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
export const MY_NS = settingsNamespace('my-plugin')
export function apply(ctx: Context, config: Config) {
  let source = () => config
  installSettingsSection(ctx, MY_NS, Config, config, {
    validate: v => void assertReachable(v.endpoint),   // schema 表达不了的约束：拒写而非拒下次用
    setSource: (cur) => { source = cur },
    onChange: () => rebuildFromSettings(source()),
  })
}
```

**浏览器半区**（卡片注册进 `settings.plugin.item`，key = namespace，`inject` 含 `settingsScope`）：

```ts
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']
export function apply(ctx: ClientContext): void {
  const card = new MyPluginCardController(ctx.settingsScope.bind({ namespace: 'my-plugin' }))
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item', key: 'my-plugin', locale: 'settings.myPlugin',
    inject: () => card.inject(),
  }, MyPluginCard))
}
```

- `scope.getSnapshot()` 含解析 `value` + 组成 `base` + 原始 `user` 层（**键的"存在"**——而非值——标记字段被 override）；`scope.set(field, value)` 存单字段、`scope.unset(field)` 清回组成层；每次写用所读 revision 围栏。
- `role('secret')` 字段不进任何响应；卡片把该字段写进 `update`/`mutate` payload，或经 `credentials` 域用凭据引用。`applies: 'restart'` 表示 owner 只在下次启动才作用变更。
- **打包**：浏览器半区由 client-modules 扫描 `dsh.client` 声明并服务 `./client` 导出——插件一被 cordis.yml 挂上，页面即出现，无需重建 web 应用。
- 若此官方路径在你的部署里被白名单挡，回退上面[插件自有路由模式](#设置页注册settingssection-槽位)。


### 验证（不起 DSH 模拟浏览器加载）

```js
globalThis.window = { __ModuleLoader__: { load: (def) => { captured = def } } }
(0, eval)(readFileSync('lib/client.js', 'utf8'))
const loaded = captured.factory((id) => ({ /* react/react-jsx-runtime 等 stub */ })[id])
loaded.apply({ slots: { inject: (n, cb) => {...}, register: (e, c) => ({...e, component: c}) } })  // inject=['slots']，无 settingsScope
// 断言 captured.id、loaded.inject==['slots']、slot 条目 {name,id,order,label}、component 存在
// 组件 SSR 渲染用 react.createElement + react-dom/server（别直接调组件函数，会 Invalid hook call）
```

## 在设置里加 logo — DSH 定制 shell 渲染

> 两个不同的"加 logo"场景，用哪个模块看**放在哪**：
> - 放进**设置页内容 / 额度卡片**（插件自有组件内）→ 用[品牌 SVG 内联](#品牌-svg-内联--通用前端)模块，随便改、热生效。
> - 放进**设置面板左侧导航 tab 图标**（shell 渲染的，插件组件管不到）→ 本节。

DSH 的 shell 客户端包（如 `dsh-client-ui-settings-general`）渲染的设置面板导航、侧栏等，对"我们的 section/widget"用什么图标/外观，**可能是 shell 硬编码的，不是插件能配的**。动手定制前先确认扩展点存在与否，别假设能配：

**① 先读 shell 源码确认机制**
- 设置面板导航图标 = `dsh-client-ui-settings-general/lib/client.js` 的 `navIcon(id)`，**按 section id 硬编码**（只有 models/agent-presets/plugins 三档，其余回退齿轮）；它只消费 `ctx.slots.entries('settings.section')` 的 `id/order/label`。
- **slots 运行时对注册选项白名单化**：`dsh-client-ui-slots/lib/index.js` 的 `register` 只把 `key/id/order/label/priority` + `select/inject/children/store/locale/registrant` 存入 `e.options`，**自定义字段（如 `icon`）被静默丢弃** → 想"往注册里塞自定义元数据让 shell 读"走不通，别在这上面花时间。

**② 无扩展点时的通用应对**（按侵入性从小到大）
1. 接受默认外观（最省）。
2. **改插件自有组件内部**：`sidebar.footer.action` / `settings.section` 的组件体由插件全权控制——设置页内容/额度卡片里的 logo 在这里加（见[品牌 SVG 内联](#品牌-svg-内联--通用前端)模块）。
3. **幂等补丁 shell bundle**：只在必须改 shell 自己的渲染（如导航 tab 图标）时才用（见下）。

**③ 幂等补丁脚本模式**（改任何 DSH 客户端包，含 shell）
- **客户端 bundle 全部从磁盘直出**（`serveBundle` 不校验 rev）→ 改任意客户端包的 `lib/client.js` **只需浏览器刷新，不需要重启**（shell 包同理）。
- 补丁脚本（仓库留 `tools/patch-xxx.mjs`，可重跑）要点：
  - **幂等**：插入唯一 marker 注释（如 `/* ark-quota-logo */`），脚本检测到已含则跳过。**marker 必须是占满整行的注释**，别写成 `/* x */ 说明文字`——后半截会变成裸代码触发语法错误。
  - **备份 + 可还原**：首打前 `copyFileSync(target, target + '.orig')`；`--revert` 从备份恢复。
  - **插入代码复用目标 bundle 作用域标识符**：shell bundle 是编译产物，模块内可引用局部变量（如 `react_jsx_runtime`、`SettingsRoot_module_css_default`、`_deepseek_ai_dsh_client_ui_primitives`），插入的分支直接照用这些名字。
  - **落点找唯一锚点**（如 navIcon 齿轮回退 `return ...IconSettingsOutline16...`），插入前断言 `indexOf(anchor)` 出现且唯一。
  - **改完跑语法门禁** `node --check <target>`。
- **验证**：
  - `curl -s <dsh>/plugins/<shell-id>/client.js | grep <marker>`（shell bundle 也走 `/plugins/<id>/client.js` 从磁盘服务，改完即新）。
  - **功能测试被改的函数**：用 `node:vm` 建 sandbox（注入它引用的模块作用域标识符的 stub），`runInContext` 摘出的函数后直接调用断言（如 `navIcon('ark-quota')` 返回 svg、未知 id 仍回退齿轮、内置 id 不受影响）。
- **权衡**：补丁在 `node_modules`，DSH 升级 / `pnpm install` 重置后丢失 → **优雅降级**（回退默认外观，不崩）；脚本留在插件仓库，升级后重跑一次即可。

## 品牌 SVG 内联 — 通用前端

把品牌 logo（SVG）内联进**自己组件**里，任何前端都适用（不限于 DSH）：
- **官方素材来源**：产品 logo 从它自己的 console/官网 HTML 里抠 `.svg` 资源 URL（如 ark.volcengine.com 的 `arkIcon.svg`），别用随便的 icon pack。
- **扁平化 mask/clipPath**：官方 SVG 常以 `<mask>` 定义形状 + 矩形填充色被 mask clip；可等价改写为"路径直接填色"（mask 内 path 可见形状 = 该 path 填色），**避免同一 SVG 在 DOM 挂载多次时共享 `<mask id>`/`<clipPath id>` 冲突**。几何等价验证：用 `sharp` 把原图与扁平图栅格化逐像素对比（亚像素抗锯齿差 ≤ 个位数可忽略）。
- **React 内联 SVG 属性用驼峰**：`shapeRendering`（非 `shape-rendering`），否则 React 告警。
- 在 DSH 里：放进设置页内容/额度卡片用本模块；放进设置面板左侧导航 tab 图标见[在设置里加 logo](#在设置里加-logo--dsh-定制-shell-渲染)。
