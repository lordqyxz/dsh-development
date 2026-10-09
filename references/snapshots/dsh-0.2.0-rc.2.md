# DSH API 面快照

- **DSH 版本**：`0.2.0-rc.2`
- **生成时间**：`2026-10-09T08:03:15.478Z`
- **来源**：`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh`（本机已安装源码 + README，版本精确）

> 本文件是「这一版到底有什么 API」的权威记录。skill 静态参考（references/*.md）与本文件冲突时，**以本文件为准**，并回写修正 skill。

## @deepseek-ai/schemastery

- 版本：`3.18.4`
- `.volatile()` 可用：`true`（settings.update 可写字段的硬前提；<3.18.4 没有）

## @deepseek-ai/dsh-settings（ctx.settings = SettingsForms）

- 版本：`0.2.0-rc.2`
- `register()` 存在：`false`（预期 `false`——真实接缝见 references/client-ui.md）
- SettingsForms 方法：`["configure","describe","documentPath","importLegacyDocument","invalidate","mutate","prepareDocument","replace","schema","update","writable","write"]`

## @deepseek-ai/cordis-plugin-loader

- 版本：`1.0.5`
- Entry.id getter 存在：include 下返回 "<parent>:<id>" 组合 id——settings ns 必须用 entry.options.id

## @deepseek-ai/dsh-plugin-manager

- 版本：`0.2.0-rc.2`
- install 自带 `-w`：`no -w（workspace-root profile 会 ERR_PNPM_ADDING_TO_ROOT；add 调用点行 293）`

## @deepseek-ai/dsh-app-boot（loader 事件面）

- 版本：`0.2.0-rc.2`
- 事件：`["loader/config-update"]`

## @deepseek-ai/dsh-config-editor

- 版本：`0.2.0-rc.2`
- entries() 按 entry.options.id 去重（include 下的 entry）；settings.write 按 options.id 匹配

## 生成快照

```sh
node tools/api-snapshot.mjs --out references/snapshots/dsh-<version>.md
```
