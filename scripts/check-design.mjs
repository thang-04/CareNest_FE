#!/usr/bin/env node
// Cổng design system (DESIGN.md §13.1): đếm vi phạm theo từng file, so với scripts/design-baseline.json.
// File vượt baseline hoặc file mới có vi phạm ⇒ exit 1. Sửa bớt nợ ⇒ chạy `--update` để hạ baseline; `--update` từ chối nâng.
// Vi phạm cũ được giữ nguyên trong baseline (không bắt sửa hàng loạt); code mới phải dùng component/token chung (docs/design/UI_CARD.md).
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
  rawButton: {
    label: "<button> viết tay — dùng <Button> từ @/components",
    ext: /\.jsx$/,
    skip: /^components\/(ui|form)\//,
    re: /<button\b/g,
  },
  rawTable: {
    label: "<table> viết tay — dùng <DataTable> từ @/components",
    ext: /\.jsx$/,
    skip: /^components\/ui\//,
    re: /<table\b/g,
  },
  rawField: {
    label: "<input>/<select>/<textarea> viết tay — dùng TextField/SelectField/TextAreaField hoặc FormField",
    ext: /\.jsx$/,
    skip: /^components\/(ui|form)\//,
    re: /<(?:input|select|textarea)\b/g,
  },
  clickableDiv: {
    label: "onClick trên phần tử không phải nút — dùng <Button> hoặc clickableRowProps (bàn phím)",
    ext: /\.jsx$/,
    skip: /^$/,
    re: /<(?:div|span|tr|td|li|img)\b[^<>]*\bonClick=/g,
  },
  sharedOverride: {
    label: "CSS module đè class chung .btn/.card/.table/.modal — thêm biến thể vào phần chung hoặc dùng class có tiền tố module",
    ext: /\.css$/,
    // CSS chung (styles/*.css, layouts) được định nghĩa các class này
    skip: /^(styles\/(?!modules\/)|layouts\/)/,
    re: /\.(?:btn|card|table|modal)(?![\w-])/g,
  },
  spacingPx: {
    label: "padding/margin/gap bằng px — dùng var(--space-*)",
    ext: /\.css$/,
    skip: /(^|\/)styles\/tokens\.css$/,
    re: /(?:padding|margin|gap)[a-z-]*: *[^;{}]*?\b[1-9]\d*px/g,
  },
  zIndex: {
    label: "z-index số cứng — dùng var(--z-*)",
    ext: /\.css$/,
    skip: /(^|\/)styles\/tokens\.css$/,
    re: /z-index: *\d+/g,
  },
  primitiveToken: {
    label: "token nguyên thủy (--blue-700…) — dùng token semantic",
    ext: /\.(css|jsx?)$/,
    skip: /(^|\/)styles\/tokens\.css$/,
    re: /var\(--(?:blue|gray|green|red|amber|coral|gold|grass|lavender|leaf|mint|neutral|pink|purple|skin|sky|sun|teal|wood)-\d+\)/g,
  },
  crossCssImport: {
    label: "import CSS module của module khác — class dùng chung thì đưa vào styles/components.css",
    ext: /\.jsx?$/,
    skip: /^$/,
    // Chỉ xét file nằm trong thư mục module (pages|components|hooks/<module>/…); CSS cùng tiền tố tên module là hợp lệ
    count(text, inSrc) {
      const mod = inSrc.match(/^(?:pages|components|hooks)\/([^/]+)\/.+/)?.[1];
      if (!mod) return 0;
      return [...text.matchAll(/styles\/modules\/([\w-]+)\.css/g)].filter((m) => !m[1].startsWith(mod) && !mod.startsWith(m[1])).length;
    },
  },
  localDateHelper: {
    label: "tự viết addDays/toIso/todayIso — thêm một lần vào utils/format.js rồi dùng chung",
    ext: /\.jsx?$/,
    skip: /^utils\/format\.js$/,
    re: /\b(?:function|const)\s+(?:addDays|toIso|todayIso)\b/g,
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
      const count = check.count ? check.count(text, inSrc) : (text.match(check.re) || []).length;
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
    // Chỉ hạ: loại kiểm tra đã có trong baseline mà file vượt mức ⇒ từ chối (loại kiểm tra mới thì ghi mức hiện tại làm mốc)
    const old = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
    const known = Object.fromEntries(Object.entries(current).filter(([key]) => old[key]));
    const raised = compare(known, old);
    if (raised.length) {
      console.log(`check-design: --update từ chối nâng baseline (${raised.length} file vượt mức):`);
      for (const p of raised.slice(0, 15)) console.log(`  ${p}`);
      return 1;
    }
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
    console.log("  Dùng component / token chung (docs/design/UI_CARD.md). Sửa bớt nợ ⇒ node scripts/check-design.mjs --update");
    return 1;
  }
  console.log(`check-design: ok · ${summary} (hiện tại/baseline)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
