#!/usr/bin/env node
/*
 * Cổng contract FE↔BE (chạy trong `npm run check`):
 * - lời gọi HTTP của module `api` phải có route BE (docs/integration/be-api-routes.json, chụp từ BE openapi) hoặc khai `pending`;
 * - file gọi HTTP phải thuộc một module trong src/config/integrationModules.js;
 * - facade của module demo phải chọn nguồn qua sourceOf/isDemoModule (không lặng lẽ dùng mock).
 * Cập nhật ảnh chụp route: node scripts/check-api-contract.mjs --sync ../CareNest_BE/docs/api/openapi.yaml
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SNAPSHOT = 'docs/integration/be-api-routes.json';
const BE_OPENAPI = path.join(root, '..', 'CareNest_BE', 'docs', 'api', 'openapi.yaml');
const { INTEGRATION_MODULES: modules } = await import(pathToFileURL(path.join(root, 'src/config/integrationModules.js')).href);

const norm = (p) =>
  ('/' + p)
    .replace(/\$\{[^}]+\}/g, '{x}')
    .replace(/\{[^}]+\}/g, '{x}')
    .replace(/\?.*$/, '')
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1');

// Đọc `paths` của openapi (YAML do springdoc sinh: 2 dấu cách cho path, 4 cho method); bỏ tiền tố /api như baseURL FE
const openapiRoutes = (file) => {
  const routes = new Set();
  let inPaths = false;
  let current = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^paths:/.test(line)) inPaths = true;
    else if (/^\S/.test(line)) inPaths = false;
    else if (inPaths && /^ {2}\//.test(line)) current = line.trim().replace(/:$/, '').replace(/^\/api(?=\/)/, '');
    else if (inPaths && current && /^ {4}(get|post|put|patch|delete):/.test(line))
      routes.add(`${line.trim().replace(':', '').toUpperCase()} ${norm(current)}`);
  }
  return [...routes].sort();
};

if (process.argv[2] === '--sync') {
  const source = path.resolve(process.argv[3] || BE_OPENAPI);
  const routes = openapiRoutes(source);
  fs.writeFileSync(
    path.join(root, SNAPSHOT),
    JSON.stringify({ source: 'CareNest_BE docs/api/openapi.yaml', syncedAt: new Date().toLocaleDateString('sv-SE'), routes }, null, 2) + '\n',
  );
  console.log(`check-api-contract: đã chụp ${routes.length} route BE vào ${SNAPSHOT}`);
  process.exit(0);
}

const errors = [];
const warnings = [];
const snapshot = JSON.parse(fs.readFileSync(path.join(root, SNAPSHOT), 'utf8'));
const beRoutes = new Set(snapshot.routes);
if (fs.existsSync(BE_OPENAPI)) {
  const live = openapiRoutes(BE_OPENAPI);
  if (live.join('\n') !== snapshot.routes.join('\n'))
    warnings.push(`${SNAPSHOT} khác BE openapi cạnh bên ⇒ chạy: node scripts/check-api-contract.mjs --sync`);
}

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'mock' || entry.name === 'mocks' ? [] : walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
const rel = (file) => path.relative(root, file).replace(/\\/g, '/');
// `'/a/' + id` ⇒ /a/{x}; đường dẫn không phải chuỗi literal (vd. base(key)) không kiểm được
const callsOf = (source) =>
  [...source.matchAll(/\b\w+\.(get|post|put|patch|delete)\(\s*([`'"])(\/[^`'"]*)\2(\s*\+)?/g)].map(
    (m) => `${m[1].toUpperCase()} ${norm(m[3] + (m[4] ? '/{x}' : ''))}`,
  );

const owner = new Map();
for (const [key, mod] of Object.entries(modules)) {
  if (!['api', 'demo'].includes(mod.source)) errors.push(`${key}: source phải là 'api' hoặc 'demo'`);
  for (const file of [...(mod.files || []), ...(mod.facades || [])])
    if (!fs.existsSync(path.join(root, file))) errors.push(`${key}: không có file ${file}`);
  for (const file of mod.files || []) {
    if (owner.has(file)) errors.push(`${file} thuộc 2 module: ${owner.get(file)}, ${key}`);
    owner.set(file, key);
  }
}

const stats = { matched: 0, pending: 0 };
const sources = walk(path.join(root, 'src')).map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }));
for (const { file, text } of sources) {
  const calls = callsOf(text);
  for (const [, key] of text.matchAll(/\b(?:sourceOf|isDemoModule|needsDemoLabel)\(\s*'([^']+)'/g))
    if (!modules[key]) errors.push(`${file}: module '${key}' chưa khai trong integrationModules.js`);
  if (!calls.length) continue;
  const key = owner.get(file);
  if (!key) {
    errors.push(`${file}: gọi HTTP nhưng chưa thuộc module nào (thêm vào files của integrationModules.js)`);
    continue;
  }
  const mod = modules[key];
  if (mod.source !== 'api') continue;
  for (const call of new Set(calls)) {
    if (beRoutes.has(call)) stats.matched += 1;
    else if ((mod.pending || []).includes(call)) stats.pending += 1;
    else errors.push(`${file} (${key}): ${call} — BE không có; nối đúng endpoint, khai pending, hoặc chuyển module sang 'demo'`);
  }
}

for (const [key, mod] of Object.entries(modules)) {
  for (const call of mod.pending || [])
    if (beRoutes.has(call)) warnings.push(`${key}: pending ${call} đã có ở BE ⇒ bỏ khỏi pending`);
  if (mod.source !== 'demo') continue;
  for (const facade of mod.facades || []) {
    const text = sources.find((s) => s.file === facade)?.text || '';
    // Khóa có thể truyền qua bảng (vd. DEMO_FUNCTIONS) ⇒ facade chỉ cần dùng sourceOf/isDemoModule và nêu khóa
    if (!/\b(?:sourceOf|isDemoModule)\(/.test(text) || !text.includes(`'${key}'`))
      errors.push(`${facade}: module demo '${key}' phải chọn nguồn qua sourceOf('${key}', ...) hoặc isDemoModule('${key}')`);
  }
  const calls = (mod.files || []).flatMap((file) => callsOf(sources.find((s) => s.file === file)?.text || ''));
  if (calls.length && calls.every((call) => beRoutes.has(call)))
    warnings.push(`${key}: mọi lời gọi đã có ở BE ⇒ cân nhắc chuyển source sang 'api'`);
}

warnings.forEach((w) => console.log(`WARN  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
const count = (source) => Object.values(modules).filter((mod) => mod.source === source).length;
console.log(
  `check-api-contract (FE): ${errors.length} lỗi, ${warnings.length} cảnh báo · api ${count('api')} module (${stats.matched} lời gọi khớp BE, ${stats.pending} pending) · demo ${count('demo')} module`,
);
process.exit(errors.length ? 1 : 0);
