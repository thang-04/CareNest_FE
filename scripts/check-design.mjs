#!/usr/bin/env node
// Cổng design system (DESIGN.md §13.1): đếm vi phạm theo từng file, so với scripts/design-baseline.json.
// File vượt baseline hoặc file mới có vi phạm ⇒ exit 1. Sửa bớt nợ ⇒ chạy `--update` để hạ baseline (không dùng để nâng).
// Dùng: node scripts/check-design.mjs [--update] [--root <dir>]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const CHECKS = {
  hex: {
    label: "mã màu ngoài token",
    ext: /\.(css|jsx?)$/,
    // Màu trong dữ liệu mẫu (avatar, chữ ký) là dữ liệu, không phải style
    skip: /(^|\/)(styles\/tokens\.css|styles\/print\.css|mocks\/)/,
    re: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g,
  },
  cssPx: {
    label: "bo góc / cỡ chữ px, font-weight 800 ngoài token",
    ext: /\.css$/,
    skip: /(^|\/)styles\/tokens\.css$/,
    re: /border-radius: *[0-9]+px|font-size: *[0-9]+px|font-weight: *800/g,
  },
  inlineStyle: {
    label: "style={{ (chỉ cho giá trị động)",
    ext: /\.jsx$/,
    skip: /^$/,
    re: /style=\{\{/g,
  },
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs) : [abs];
  });

export function measure(root) {
  const src = join(root, "src");
  const result = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, {}]));
  if (!existsSync(src)) return result;
  for (const abs of walk(src)) {
    const rel = relative(root, abs).replaceAll("\\", "/");
    const inSrc = rel.slice("src/".length);
    let text = null;
    for (const [key, check] of Object.entries(CHECKS)) {
      if (!check.ext.test(rel) || check.skip.test(inSrc)) continue;
      text ??= readFileSync(abs, "utf8");
      const count = (text.match(check.re) || []).length;
      if (count) result[key][rel] = count;
    }
  }
  return result;
}

export function compare(current, baseline) {
  const problems = [];
  for (const [key, files] of Object.entries(current)) {
    for (const [file, count] of Object.entries(files)) {
      const allowed = baseline[key]?.[file] ?? 0;
      if (count > allowed) problems.push(`${file}: ${CHECKS[key].label} ${count} > baseline ${allowed}`);
    }
  }
  return problems;
}

const total = (m) => Object.values(m).reduce((s, n) => s + n, 0);

function main(argv) {
  const rootArg = argv.indexOf("--root");
  const root = rootArg >= 0 ? argv[rootArg + 1] : join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const baselinePath = join(root, "scripts", "design-baseline.json");
  const current = measure(root);
  if (argv.includes("--update")) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`check-design: đã ghi baseline (${Object.entries(current).map(([k, v]) => `${k} ${total(v)}`).join(" · ")})`);
    return 0;
  }
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  const problems = compare(current, baseline);
  const summary = Object.entries(current).map(([k, v]) => `${k} ${total(v)}/${total(baseline[k] || {})}`).join(" · ");
  if (problems.length) {
    console.log(`check-design: FAIL · ${summary}`);
    for (const p of problems.slice(0, 15)) console.log(`  ${p}`);
    console.log("  Dùng token / class chung (DESIGN.md §2–3, §6.3). Sửa bớt nợ ⇒ node scripts/check-design.mjs --update");
    return 1;
  }
  console.log(`check-design: ok · ${summary} (hiện tại/baseline)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
