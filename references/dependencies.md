> [← 主入口 SKILL.md](../SKILL.md)

# 依赖边界、版本对齐与卸载审计

本页处理 DSH 插件“能安装但运行时用了错误宿主版本”、官方插件被 UI 归入“已安装”、以及卸载后仍残留 bundle 或软链的问题。依据官方 [添加 package 约束](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)、[CLI 参考](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/reference/README.md) 和 [插件打包/安装文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)。

## 先分清三种所有权

| 对象 | 应放在哪里 | 判断标准 |
|---|---|---|
| 插件自己运行时需要的第三方库 | 插件 `dependencies` | 插件发布后仍需自行携带/解析，例如运行时 schema 库 |
| DSH 宿主提供、插件只 import 的包 | 插件 `peerDependencies` + 相同版本的 `devDependencies` | 宿主负责运行时实例与版本；开发、typecheck、build 仍需本地可解析 |
| 当前安装已提供的可选官方 bundle | 安装目录提供；按 profile 的 `dsh.profile.bundles` 启用 | 只有安装目录已经有该包时，才不要再把它作为 profile 直接依赖安装 |

官方 monorepo 包的约束是：`@deepseek-ai/cordis` 以及每一个 DSH peer dependency 都要在 `peerDependencies` 和 `devDependencies` 中出现，并保持版本范围一致；运行时确实被插件 import 的 `@deepseek-ai/schemastery` 等库仍属于 `dependencies`。第三方插件应沿用同一边界，不要把宿主包复制进自己的运行时依赖树。

### 典型修法

```json
{
  "dependencies": {
    "some-runtime-schema-lib": "<runtime-version>"
  },
  "peerDependencies": {
    "@deepseek-ai/dsh-tools": "<dsh-version>"
  },
  "devDependencies": {
    "@deepseek-ai/dsh-tools": "<dsh-version>"
  }
}
```

例如 `dsh-gitlab-tools` 使用 `@deepseek-ai/dsh-tools` 时，应采用上述 peer/dev 形状，而不是把 `dsh-tools` 放进运行时 `dependencies`；`<dsh-version>` 取当前宿主实际版本。

不要把宿主包写成 profile 内部的绝对 `file:` 依赖，例如指向 `~/.dsh/profiles/web/node_modules/@deepseek-ai/...`。这种路径既把运行时所有权写反，也容易在 DSH 升级后锁住旧安装树。

## 官方插件不是“profile 直接安装”

UI 中“官方”和“已安装”是管理器分类，不是包的 provenance 证明。常见判定是：optional bundle 且不在当前 profile 的直接依赖中才显示为官方；一旦把安装目录已经提供的官方 optional bundle `pnpm add` 到 profile，UI 可能把它归为“已安装”。

排查时分开回答两个问题：

1. 这是 DeepSeek 官方发布的包，还是第三方/本地插件？看包的仓库、发布者和当前安装来源。
2. 当前 profile 是否直接声明了它？看 profile `package.json` 的 `dependencies`，不要只看 `dsh.profile.bundles`。

`@deepseek-ai/dsh-subagent-codex` 这类 first-party 包不等于每个 UI 中的 optional plugin；是否由官方插件目录管理，还要看当前安装版本的 optional bundle 列表和 profile 状态。

## 审计顺序

在修改前先保存证据，不要直接删整个 `node_modules` 或重置 checkout：

```bash
PROFILE="$HOME/.dsh/profiles/web"

# 1. 直接依赖、bundle 列表、lockfile 是否一致
node -e 'const p=require(process.argv[1]); console.log(JSON.stringify({dependencies:p.dependencies,devDependencies:p.devDependencies,peerDependencies:p.peerDependencies,dsh:p.dsh},null,2))' "$PROFILE/package.json"
rg -n 'dsh-(base|tools|agent|credentials)|dsh\.profile|bundles' "$PROFILE/package.json" "$PROFILE/pnpm-lock.yaml"

# 2. 实际解析路径：静态 warning 不等于已经发生运行时重复
node --input-type=module -e "console.log(await import.meta.resolve('@deepseek-ai/dsh-tools'))"

# 3. DSH 最终组合树
dsh --profile web --dump-config
```

若是插件 checkout，另外在插件目录执行 `pnpm install --lockfile-only --ignore-scripts`，再检查 `package.json` 与 lockfile importer；不要用 profile 的绝对路径替代 peer 依赖。完成修改后至少运行插件自己的 typecheck/build/test，再重新执行 `--dump-config`。

## 升级与卸载后的完整核验

`dsh plugin --profile <name> ...` 会把 pnpm 操作写入 profile，并维护 `dsh.profile.bundles`；bundle 成员变化在下次启动才完整生效。每次升级或卸载按以下顺序核验：

1. **manifest**：目标包不再出现在 profile `dependencies`；不应再保留指向已删除包的依赖别名。
2. **lockfile**：importer 与 package snapshot 不再把已删除插件作为有效入口。
3. **bundle 列表**：检查 `dsh.profile.bundles`；如果当前 CLI 版本留下了 stale item，手动删除对应条目后再 dump。
4. **模块链接**：检查 `node_modules` 和 `$DSH_HOME/profiles/node_modules` 的链接目标；只删除明确指向已卸载插件 checkout 的孤立链接，保留源码仓库。
5. **最终组合**：`dsh --profile web --dump-config` 不应再出现该插件层，且不应出现 `Cannot find package`、duplicate id 或 bundle manifest 错误。
6. **运行时**：重启 `dsh web`，检查监听端口、关键 API 的 `content-type`，再在浏览器中刷新客户端。仅收到“remove 成功”不能算卸载完成。

## 版本对齐原则

- 先从正在运行的 DSH 安装锚点读取版本，再决定插件 peer/dev 版本；不要凭记忆硬编码旧版本。
- profile 自己的 `dependencies` 只声明树外插件；安装目录优先解析 in-box bundle，profile 目录解析 out-of-tree bundle。
- `pnpm outdated` 为空只说明 pnpm 认为没有可更新项，不代表 DSH 安装锚点、profile lockfile、bundle 列表和实际解析路径已经一致；四者都要检查。
- 版本升级后先 `pnpm install`，再 `--dump-config`，最后重启并做一个最小工具/API 冒烟；遇到客户端 slot 报错还要确认客户端插件与宿主版本配套。
