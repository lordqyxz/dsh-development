> [← 主入口 SKILL.md](../SKILL.md)

## 官方插件安装（profile / bundle）

> **真源**：`docs/user/develop/basic/publish.zh.md`（英文 `publish.md`）。CLI 层优先级与 flag：`apps/cli/reference/README.zh.md`。

### 开发阶段：`--patch` 原型（官方 `basic/index.md`）

写第一版插件、尚未打包成 bundle 时，用 **overlay patch** 快速加载，不必先 `plugin add`：

```yaml
# scratch-plugin/cordis.yml — insert 的 name 必须是绝对路径
- insert:
    - id: hello
      name: '/absolute/path/to/scratch-plugin/src/my-plugin.ts'
```

```bash
dsh web --patch ./scratch-plugin/cordis.yml    # 或 pnpm dsh web --patch ...（源码树内）
```

| 阶段 | 加载方式 | patch 里 `name:` |
|---|---|---|
| **原型** | `dsh web --patch <file>` | **绝对路径** 指向源码/ts |
| **生产** | `dsh plugin add` → bundle | **`package.json` 的 name**（Node 从 profile 解析） |

原型验证通过后 → 按[打包与发布（作者侧）](#打包与发布作者侧-bundle) 做成 bundle → `dsh plugin add` 装进 profile。

### 两个概念（官方）

二者都在 `package.json` 的 `dsh` 键下，但 manifest 种类不同，**一个包不能同时是两者**：

| 概念 | manifest | 回答的问题 | 谁维护 |
|---|---|---|---|
| **bundle**（组合包） | `dsh.bundle.patch` → `cordis.patch.yml` | 这个包**贡献什么**（insert/override 插件行） | 插件作者 |
| **profile**（启动组合） | `dsh.profile.bundles` | 这套配置**由哪些 bundle 按什么顺序组成** | `dsh plugin` 自动维护 + 用户 patch |

- profile 目录：`$DSH_HOME/profiles/<name>/`，含 `package.json`（pnpm 管理的树外依赖 + bundles 列表）和 `cordis.patch.yml`（用户层）。
- bundle 的 patch 里插件行按 **`name: <package.json 的 name>`** 引用（不是相对源码路径）——loader 从 profile 目录做 Node 模块解析。
- 无 `dsh.bundle` 的包仍可 `dsh plugin add`，但只当普通依赖（stderr 警告、**不**进 bundles）——适合被其他插件 import 的库。

### 安装 / 卸载 / 更新（用户命令）

`dsh plugin --profile <name> <args...>` **在 profile 目录内转发给 pnpm**，因此 pnpm 子命令均可用（`install` / `update` / `remove` / …）。

```bash
# 本地目录（从插件 checkout 里执行 add . 时，dsh 会把相对路径锚定到当前 cwd，不会误链 profile 自身）
dsh plugin --profile web add /path/to/my-plugin
dsh plugin --profile web add ./my-plugin          # 在插件目录里执行

# GitHub（拉的是源码，见下节 prepare / allowBuilds）
dsh plugin --profile web add github:org/repo
dsh plugin --profile web add github:org/repo#<commit-sha>   # 锁定 commit，推荐

# tarball / npm（预构建产物，无需 allowBuilds）
dsh plugin --profile web add ./my-plugin-0.1.0.tgz
dsh plugin --profile web add my-published-package

# 更新 / 卸载
dsh plugin --profile web update github:org/repo
dsh plugin --profile web remove my-plugin-package-name      # 同时删 dependencies 与 bundles 层
```

**首次** `add` 会初始化 profile（模板 profile 如 `web` 以 `@deepseek-ai/dsh-base` 为第一个 bundle），pnpm 写入 `dependencies`，若包声明 `dsh.bundle` 则 **`dsh` 自动追加到 `dsh.profile.bundles`**——profile manifest **不必手写**。

**Bundle 成员变化须重启**：`plugin add` / `remove` / `update`（激活或移除 bundle 层）成功后只改磁盘上的 `package.json`；**正在运行的 `dsh web` 仍用启动时的 bundle 集合**。改完须重启进程。与之对比：仅编辑 profile 或 home 的 `cordis.patch.yml`（改已有 id 的 config / disabled）可走 loader 热重组，见[重启语义](restart.md)。

### 生效层序（官方）

在空根 `cordis.yml`（`[]`）之上，**后应用的层按行 id 胜出**；patch **整行替换** `config`（非 deep merge，覆盖时必须重述该行需要的每一个键）：

1. `dsh.profile.bundles` 各 bundle 的 patch（按列表顺序；`@deepseek-ai/dsh-base` 最先）
2. profile 的 `cordis.patch.yml`
3. home 级 `$DSH_HOME/cordis.patch.yml` — **各 profile 共享的机器级偏好**（优先于单个 profile 的 patch；适合全机 telemetry 开关等）
4. 各 `--patch <path>` overlay（按 argv 顺序；**一次性**调试 overlay，非常驻安装）

内置 `@deepseek-ai/*` bundle **始终从 dsh 安装目录解析**（双锚点：安装目录优先，profile 目录次之），与 pnpm 管理的树外包分离。裸插件 `name` 还会从 `$DSH_HOME/profiles/node_modules` 扁平 fallback 解析（每次启动 `healProfilesModuleFallback` 维护）。

### CLI 诊断与 `dsh web` 常用 flag（官方 `apps/cli/reference`）

```bash
# 只看 bundle 层（不含 profile/home patch）
dsh --profile web --dump-default-config

# 完整合成树（bundles + profile patch + home patch + --patch）；失败即 duplicate id / 缺包
dsh --profile web --dump-config
dsh web --dump-config          # web 别名，等价

# 临时叠加一层（不写入 profile）
dsh web --patch ./extra.cordis.yml

# web 应用参数（写在 dsh 启动器 flag 之后，由 web startup 插件解析）
dsh web --no-open              # 不自动开浏览器
dsh web --host 127.0.0.1 --port 3080
dsh web --trusted-host my.host # 可重复；/api 浏览器信任围栏
dsh web --help                 # 只打印 web 应用帮助，不启动

# headless：一次性任务（无 HTTP/Web UI；stdout 打印最后 assistant 文本）
dsh --profile headless "run the tests"

# 可选 subagent provider bundle（独立 add/remove；启用后还须 preset 里开对应工具行）
dsh plugin --profile web add @deepseek-ai/dsh-subagent-codex
dsh plugin --profile web add @deepseek-ai/dsh-subagent-claude-code
```

`--dump-config` 打印 `# == <来源文件>` 注释标明每层来源；`!!js` 表达式**不求值**。若 argv 里带了 web 应用参数，dump 会拒绝（须去掉 `--port` 等再 dump）。

### 用户如何改已装 bundle 的配置

bundle 已在 patch 里 `insert` 过，用户层**只按 id 覆盖**（不是再 insert）：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-memory-evolve
  config:
    reviewEnabled: true
- id: better-sidebar
  disabled: true          # 临时禁用，无需 uninstall
```

⚠️ patch 里的 `name` 字段用于**校验**（与目标行 name 不一致则跳过），**不能**用来把 loader 指向另一个包名。

### 从 GitHub 安装（官方 + 本机）

git 安装拉的是**源码**，不会自动跑你的 `build`——TypeScript 包若无 `lib/` 会加载失败。两边各做一件事：

- **作者**：`package.json` 提供自包含的 `prepare` 脚本（安装后构建出 `main` 指向的入口；不能假设 monorepo 上下文）。参考官方文档中的 [turtle-ui](https://github.com/deepseek-harness/turtle-ui) 范例。
- **用户**：pnpm ≥10 默认拒绝 git 依赖的 `prepare`，首次 `add` 会失败；按 `dsh` stderr 提示，把 pnpm 打印的包键写入 profile 的 `pnpm-workspace.yaml`：

```yaml
# ~/.dsh/profiles/web/pnpm-workspace.yaml
allowBuilds:
  dsh-hello-plugin: true
```

然后重新 `add`。**只对可信源码授权**；用 `#<sha>` 锁定 commit。

不想让用户授权构建 → 发 npm 或 `pnpm pack` 的 tarball（预构建 `lib/`）。

### 验证（不启动 / 启动）

```bash
dsh --profile web --dump-config              # 应看到 "# == <bundle-package-name>" 层
dsh --profile web --dump-config | rg 'my-plugin-id'
dsh web                                      # 改 profile/package.json 依赖后必须重启
```

### DSH CLI 升级后（本机 ritual）

每次 `pnpm add -g @deepseek-ai/dsh`（或换安装路径）后：

```bash
cd ~/.dsh/profiles/web && pnpm install
dsh --profile web --dump-config >/dev/null   # 失败则 stderr 直接报 duplicate id / 缺包
# 然后重启 dsh web
```

启动时官方会跑 `healProfilesModuleFallback`（维护 `$DSH_HOME/profiles/node_modules` 扁平 symlink 闭包），但**不清理**已失效的旧安装路径链接；升级后若首页 `/` 变 400，检查：

```bash
ls -l ~/.dsh/profiles/node_modules/@deepseek-ai/dsh-host-webserver
# 应指向当前 dsh 版本的 store 路径，不应再是旧的 pnpm global/5
```

### 常见故障（本机实证）

| 现象 | 原因 | 修法 |
|---|---|---|
| `duplicate loader entry id: xxx` | bundle 已 `dsh plugin add`（bundle patch 已 insert），profile patch **又 insert 同一 id** | 删 profile patch 里的 `- insert:`；只保留 `- id: xxx` 改 config |
| `Cannot find package 'foo' imported from .../profiles/web/` | bundle patch 的 `name:` 是包内 `package.json` 的 name，但 `dependencies` 键是 GitHub 装配别名（如 `@omdsh-dev/foo` vs `@changfenhuang/foo`） | **bundles 只保留一个**；`dependencies` 用与 patch `name:` **一致**的键（或额外加 alias 依赖，但**不要**对 alias 再 `plugin add`，否则 reconcile 会把两个都塞进 bundles → duplicate） |
| 首页 `/` HTTP 400，静态资源 200 | `profiles/node_modules` 里核心包仍链到旧版 dsh | 升级后跑上面 ritual；必要时重建 fallback（见 `healProfilesModuleFallback`） |
| `add` 后无 bundle 层 | 包无 `dsh.bundle` 声明 | 正常——纯库依赖；要激活层需作者加 `dsh.bundle` 或用户 patch insert（非 bundle 插件） |
| git `add` 失败 / 装完无 `lib/` | 缺 `allowBuilds` 或缺 `prepare` | 见上节 |

## 打包与发布（作者侧 bundle）

> 用户安装见上一节；本节面向**编写**要分发的 bundle。真源：`docs/user/develop/basic/publish.zh.md`。

两个概念都由 `package.json` 的 `dsh` 字段描述，但回答不同问题：

| 概念 | manifest | 回答 | 谁在用 |
|---|---|---|---|
| **bundle**（你编写/分发的东西） | `dsh.bundle.patch` | "这个包贡献什么？" → 一个 patch 文件（insert/override 插件行） | 被 profile 列出 |
| **profile**（用户启动的组成） | `dsh.profile.bundles` | "哪些 bundle 按什么顺序组成这套？" | `dsh --profile <name>` 启动 |

- bundle 的 `cordis.patch.yml` 里 `- insert:` 插件行，`name` = **`package.json` 的 `name` 字段**（Node 从 profile 目录 resolve）。
- **bundle 与 profile 不可兼得**于同一包。无 `dsh.bundle` → 只当普通依赖。
- 最小 bundle manifest 示例（官方 `publish.zh.md`）：

```json
{
  "name": "dsh-hello-plugin",
  "type": "module",
  "main": "index.js",
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

```yaml
# cordis.patch.yml — name 必须是 package.json 的 name，不是相对路径
- insert:
    - id: hello
      name: dsh-hello-plugin
```

- 表层组合包若持有 CLI：挂载 `inject = ['cmdlineArgs']` 的 startup 插件 + 行内 `!!js` 读 `ctx.*Startup`（官方 publish 教程后半；例：`port: !!js ctx.webStartup.port ?? 3080`）。

