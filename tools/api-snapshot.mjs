#!/usr/bin/env node
/**
 * DSH API 面快照生成器 —— 防文档腐化。
 *
 * 从本机已安装的 @deepseek-ai/dsh 树提取「这一版到底有哪些 API」，输出 markdown
 * 快照。用法：
 *
 *   node tools/api-snapshot.mjs                    # 自动探测已安装的 DSH
 *   node tools/api-snapshot.mjs --dir <DSH根目录>   # 显式指定（含 node_modules/@deepseek-ai/ 的目录）
 *   node tools/api-snapshot.mjs --out <file.md>     # 写文件（默认 stdout）
 *
 * 产出建议存为 skill 的 references/snapshots/dsh-<version>.md，agent 按
 * `dsh --version` 路由读取。skill 静态文本与快照冲突时，以快照（= 已安装源码）为准，
 * 并回写修正 skill。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const nodeRequire = createRequire(import.meta.url);

/** 探测已安装 DSH 根目录（含 node_modules/@deepseek-ai/ 的那一层）。 */
function detectRoot() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--dir");
  if (i >= 0 && argv[i + 1]) return resolve(argv[i + 1]);
  const candidates = [];
  try {
    candidates.push(join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "@deepseek-ai/dsh"));
  } catch { /* npm 不可用则跳过 */ }
  for (const p of ["/opt/homebrew/lib/node_modules/@deepseek-ai/dsh", "/usr/local/lib/node_modules/@deepseek-ai/dsh", "/usr/lib/node_modules/@deepseek-ai/dsh"]) candidates.push(p);
  if (process.env.DSH_ROOT) candidates.unshift(process.env.DSH_ROOT);
  return candidates.find((p) => existsSync(join(p, "package.json")));
}

async function loadModule(base) {
  const pkg = JSON.parse(readFileSync(join(base, "package.json"), "utf8"));
  const main = typeof pkg.main === "string" ? pkg.main : "lib/index.js";
  const entry = join(base, main);
  if (!existsSync(entry)) throw new Error(`entry not found: ${main}`);
  if (pkg.type === "module") return { mod: await import(entry), main };
  return { mod: nodeRequire(entry), main };
}

/** 列出一个服务的原型方法名（沿原型链、去重、去私有）。 */
function protoMethods(mod, className) {
  const C = mod?.[className];
  if (typeof C !== "function") return `class ${className} not found`;
  const names = [];
  let proto = C.prototype;
  while (proto && proto !== Object.prototype) {
    names.push(...Object.getOwnPropertyNames(proto).filter((n) => n !== "constructor" && !n.startsWith("_") && !names.includes(n)));
    proto = Object.getPrototypeOf(proto);
  }
  return names.sort();
}

/** 源码文本字面量统计（出现次数 + 首处行号）。 */
function grepLiteral(text, literal) {
  const hits = [];
  text.split("\n").forEach((line, i) => { if (line.includes(literal)) hits.push(i + 1); });
  return { count: hits.length, firstLine: hits[0] ?? null };
}

async function probePkg(root, name, probes) {
  const out = { name, version: null, probes: {} };
  try {
    const base = join(root, "node_modules", name);
    out.version = JSON.parse(readFileSync(join(base, "package.json"), "utf8")).version;
    const { mod } = await loadModule(base);
    for (const [label, fn] of Object.entries(probes)) {
      try { out.probes[label] = fn(mod, base); } catch (e) { out.probes[label] = `probe-error: ${e.message}`; }
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

const root = detectRoot();
if (!root) {
  console.error("未找到已安装的 @deepseek-ai/dsh —— 传入 --dir <DSH根目录>");
  process.exit(1);
}
const dshVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const settings = await probePkg(root, "@deepseek-ai/dsh-settings", {
  settingsFormsMethods: (m) => protoMethods(m, "SettingsForms"),
  hasRegister: (m) => typeof m.SettingsForms?.prototype?.register === "function",
});
const schemasteryPkg = await probePkg(root, "@deepseek-ai/schemastery", {
  hasVolatile: (m) => { const s = m.default ?? m; return typeof s.string().volatile === "function"; },
});
const loader = await probePkg(root, "@deepseek-ai/cordis-plugin-loader", {
  entryIdGetter: (m, base) => {
    const src = readFileSync(join(base, "lib/index.js"), "utf8");
    const g = grepLiteral(src, "get id()");
    return g.count > 0
      ? "Entry.id getter 存在：include 下返回 \"<parent>:<id>\" 组合 id——settings ns 必须用 entry.options.id"
      : "Entry.id getter 未确认";
  },
});
const pluginManager = await probePkg(root, "@deepseek-ai/dsh-plugin-manager", {
  installAddsWorkspaceFlag: (m, base) => {
    const src = readFileSync(join(base, "lib/index.js"), "utf8");
    if (grepLiteral(src, '"add", "-w"').count > 0) return true;
    return `no -w（workspace-root profile 会 ERR_PNPM_ADDING_TO_ROOT；add 调用点行 ${grepLiteral(src, '"add",').firstLine}）`;
  },
});
const appBoot = await probePkg(root, "@deepseek-ai/dsh-app-boot", {
  loaderEvents: (m, base) => {
    const src = readFileSync(join(base, "lib/index.js"), "utf8");
    return [...new Set([...src.matchAll(/"(loader\/[a-z-]+)"/g)].map((x) => x[1]))].sort();
  },
});
const configEditor = await probePkg(root, "@deepseek-ai/dsh-config-editor", {
  note: () => "entries() 按 entry.options.id 去重（include 下的 entry）；settings.write 按 options.id 匹配",
});

const sections = [
  { title: "@deepseek-ai/schemastery", p: schemasteryPkg, rows: [
    `- \`.volatile()\` 可用：\`${schemasteryPkg.probes.hasVolatile}\`（settings.update 可写字段的硬前提；<3.18.4 没有）`,
  ] },
  { title: "@deepseek-ai/dsh-settings（ctx.settings = SettingsForms）", p: settings, rows: [
    `- \`register()\` 存在：\`${settings.probes.hasRegister}\`（预期 \`false\`——真实接缝见 references/client-ui.md）`,
    `- SettingsForms 方法：\`${JSON.stringify(settings.probes.settingsFormsMethods)}\``,
  ] },
  { title: "@deepseek-ai/cordis-plugin-loader", p: loader, rows: [
    `- ${loader.probes.entryIdGetter}`,
  ] },
  { title: "@deepseek-ai/dsh-plugin-manager", p: pluginManager, rows: [
    `- install 自带 \`-w\`：\`${pluginManager.probes.installAddsWorkspaceFlag}\``,
  ] },
  { title: "@deepseek-ai/dsh-app-boot（loader 事件面）", p: appBoot, rows: [
    `- 事件：\`${JSON.stringify(appBoot.probes.loaderEvents)}\``,
  ] },
  { title: "@deepseek-ai/dsh-config-editor", p: configEditor, rows: [
    `- ${configEditor.probes.note}`,
  ] },
];

const lines = [
  "# DSH API 面快照",
  "",
  `- **DSH 版本**：\`${dshVersion}\``,
  `- **生成时间**：\`${new Date().toISOString()}\``,
  `- **来源**：\`${root}\`（本机已安装源码 + README，版本精确）`,
  "",
  "> 本文件是「这一版到底有什么 API」的权威记录。skill 静态参考（references/*.md）与本文件冲突时，**以本文件为准**，并回写修正 skill。",
  "",
];

for (const { title, p, rows } of sections) {
  lines.push(`## ${title}`, "");
  lines.push(`- 版本：\`${p.version ?? "未安装"}\`${p.error ? `（探测失败：${p.error}）` : ""}`);
  if (!p.error) lines.push(...rows);
  lines.push("");
}

lines.push("## 生成快照", "", "```sh", "node tools/api-snapshot.mjs --out references/snapshots/dsh-<version>.md", "```", "");

const report = lines.join("\n");
const i = process.argv.indexOf("--out");
if (i >= 0 && process.argv[i + 1]) {
  mkdirSync(dirname(process.argv[i + 1]), { recursive: true });
  writeFileSync(process.argv[i + 1], report);
  console.error(`snapshot written: ${process.argv[i + 1]}`);
} else {
  console.log(report);
}
