> [← 主入口 SKILL.md](../SKILL.md)

## Cordis 核心概念（速查表）

| # | 概念 | 一句话 |
|---|---|---|
| 1 | **插件** | 函数/对象/Service 子类，导出 `apply(ctx)`；`name` 是可选显示元数据 |
| 2 | **上下文** | 服务容器：`ctx.tools`/`ctx.llm`/`ctx.sessions`。按 key 查服务，不导入实现 |
| 3 | **`inject`** | 声明依赖的服务，就绪后才 `apply`；加载顺序由依赖图决定，不是配置列表顺序 |
| 4 | **事件** | `emit`(广播) / `bail`(首个非空短路) / `waterfall`(中间件,须调 next()) / `serial`(按序,首个非空停) / `parallel`(并行扇出)。每个事件只有一种模式；官方 `user/develop/framework/events.md` 有完整语义 |
| 5 | **可逆注册** | `ctx.effect()`/`ctx.on()` 安装，卸载时自动撤销——不用手动 removeListener；有顺序的清理放同一个 effect |

**Waterfall 语义**：`ctx.waterfall` = 环绕中间件。监听器 `(...args, next)` → `next()` 执行下游 → 下游返回值经 `next()` 传回。不调 `next()` 直接返回 = 短路。

## Cordis Framework 速查（官方 `develop/framework/`）

> 真源：`user/develop/framework/index.md`（生命周期）、`service.md`（服务）、`events.md`（事件）。插件写不动时先查这三篇。

### Fiber 状态机（每个 loader 条目一个 Fiber）

```
PENDING → LOADING → ACTIVE
                 ↘ FAILED
ACTIVE → UNLOADING → DISPOSED
```

| 状态 | 含义 | 你看到的 |
|---|---|---|
| PENDING | `inject` 依赖未就绪 | 合法静默；`dev_plugin_status` 可见 |
| LOADING | 依赖就绪，正在跑 `apply` | 短暂 |
| ACTIVE | 正常运行 | 工具/路由/事件已注册 |
| FAILED | `apply` 或 Config 校验抛错 | 启动失败或条目红 |
| UNLOADING / DISPOSED | 卸载中 / 已卸 | patch 删行、依赖消失、HMR 替换 |

**依赖驱动重载**：声明了 `inject` 的插件会等依赖服务；若提供方被替换或消失，消费者会 **ACTIVE → DISPOSED**，服务恢复后再重新加载。

### 对外提供服务（`Service` 子类）

向其他插件暴露命名能力时用类形式（函数插件只消费、不提供 `ctx` key）：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'
export default class MetricsService extends Service {
  static inject = ['llm']           // 服务也可 inject 其他服务
  constructor(ctx: Context) { super(ctx, 'metrics') }  // 'metrics' → ctx.metrics
  record(event: string, value: number) { /* ... */ }
}
```

其他插件 `export const inject = ['metrics']` 后，在 `apply` 里 `ctx.metrics` 已就绪。详见 `framework/service.md`。

### 事件模式怎么选（`framework/events.md`）

| 模式 | API | 何时用 | 注意 |
|---|---|---|---|
| 广播 | `ctx.on` / `ctx.emit` | 通知多方，不需返回值 | 所有监听都会跑 |
| 短路 | `ctx.bail` | 首个非空结果胜出 | 权限/标题类「有一个就够」 |
| 中间件 | `ctx.waterfall` + `next()` | 改写请求/结果、包装执行 | **必须**调 `next()` 委托下游 |
| 串行决策 | `ctx.serial` | 按序问监听，首个非空停 | 无 `next()`；如 `agent/turn-stopping` |
| 并行扇出 | `ctx.parallel` | 独立副作用并行 | 不合并返回值 |

Harness 能力事件（`tools/*`、`agent/*`、`fs/*`）与 Session 事件（`session/event` 持久事实）域不同——先选对域，再选模式。详见 [architecture.md](architecture.md#事件三类选对域是第一个决定)。

## 插件写法

```ts
// 1. 函数（最常见）
export const name = 'hello'
export function apply(ctx: Context) {
  ctx.effect(() => { const t = setInterval(...); return () => clearInterval(t) })
}

// 2. 对象
export default { name: 'x', inject: ['tools'], apply(ctx) {} }

// 3. 类（向其他插件提供服务时用）
import { Service } from '@deepseek-ai/cordis'
export default class MyService extends Service {
  static inject = ['tools']
  constructor(ctx: Context) { super(ctx, 'myService') }
}
```

- `apply` 抛异常 → fiber FAILED，**明确报错不跳过**；模块解析失败仅记日志。
- 通过 `ctx` 注册的（事件/工具/定时器）全自动清理；手动资源用 `ctx.effect(() => () => cleanup)`。

**配置**：

```ts
import Schema from '@deepseek-ai/schemastery'
export interface Config { greeting: string; targets: string[] }
export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  targets: Schema.array(String).default(['world']),
})
export function apply(ctx: Context, config: Config) { /* config 已校验+补默认值 */ }
```

- 无效配置 → `ValidationError` → fiber FAILED，**绝不带病启动**。
- **配置设计原则**（官方 `config.md`）：① **无硬编码可调参数**——部署可能变的值都进 Config schema + 默认值，别写死在代码常量里；② **配置错误要响亮**——约束写进 schema，加载时失败，别带病启动或运行时才 silently 错。
- 配置项元数据：`name`(模块指定符)、`id`(稳定标识，无 id 时每次生成新 id → 任何编辑都视为删+加重挂载)、`disabled`。
- `!!js` 表达式仅限 `config` 与 `disabled` 字段：`greeting: !!js process.env.X ?? 'Hello'`。
- 本地插件路径必须**绝对路径**（patch 不改 loader 解析的 profile 目录）。

**fiber 诊断**：插件"没动静也没输出"→ 查 fiber 状态：`ACTIVE`(正常) / `PENDING`(inject 缺服务，合法静默) / `FAILED`(配置/apply 错误)。枚举 `ctx.registry` 遍历 `runtime.fibers` 筛 PENDING。`dev_plugin_status` 工具可直接看全部 loader entries 状态（含 `[no-fiber]`、`[disabled]`、active）。⚠️ 别用 `dsh --dump-config` 推断运行时状态——它只显示组合树（如 hmr 条目 disabled），不代表没有别的途径挂载同名插件。

