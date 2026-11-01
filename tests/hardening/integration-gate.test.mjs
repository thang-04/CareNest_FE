import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
globalThis.window = new EventTarget();
const { createDemoSource } = await import('@/services/demoSource');

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const MODULES = {
  permission: { source: 'api', routes: ['/school/roles'] },
  children: { source: 'demo', routes: ['/children'] },
  guardian: { source: 'api', routes: ['/children/activation'] },
};
const MOCK_USERS = [
  { id: 'u-t1', role: 'TEACHER', status: 'INACTIVE', fullName: 'GV nghỉ' },
  { id: 'u-t2', role: 'TEACHER', status: 'ACTIVE', fullName: 'GV mẫu' },
];
const beUser = { id: '42', userId: 42, roles: ['TEACHER'], role: 'TEACHER', fullName: 'GV thật' };
const mock = { list: async (filters, user) => ({ filters, user }) };
const api = { list: async () => 'api' };

test('build nối BE: module api gọi BE, module demo dùng mock với tài khoản mẫu cùng vai trò', async () => {
  const source = createDemoSource({ useMock: false, modules: MODULES, loadUsers: () => MOCK_USERS });

  assert.equal(source.sourceOf('permission', mock, api), api);
  const demo = source.sourceOf('children', mock, api);
  assert.deepEqual(await demo.list({ page: 0 }, beUser), { filters: { page: 0 }, user: MOCK_USERS[1] });
  assert.throws(() => source.sourceOf('chua-khai', mock, api), /chưa khai/);
});

test('build mock: mọi module dùng mock nguyên trạng, không nhãn demo', async () => {
  const source = createDemoSource({ useMock: true, modules: MODULES, loadUsers: () => MOCK_USERS });

  assert.equal(source.sourceOf('permission', mock, api), mock);
  assert.equal(source.demoModuleOfPath('/children'), null);
  assert.equal(source.needsDemoLabel('children'), false);
});

test('nhãn demo theo route khớp dài nhất: /children demo, /children/activation là BE', () => {
  const source = createDemoSource({ useMock: false, modules: MODULES, loadUsers: () => MOCK_USERS });

  assert.equal(source.demoModuleOfPath('/children'), 'children');
  assert.equal(source.demoModuleOfPath('/children/12'), 'children');
  assert.equal(source.demoModuleOfPath('/children/activation'), null);
  assert.equal(source.demoModuleOfPath('/school/roles'), null);
  assert.equal(source.demoModuleOfPath('/childrenx'), null);
});

test('cổng contract: repo hiện tại đạt', () => {
  const output = execFileSync(process.execPath, [path.join(repoRoot, 'scripts/check-api-contract.mjs')], { encoding: 'utf8' });
  assert.match(output, /check-api-contract \(FE\): 0 lỗi/);
});

test('cổng contract: module api gọi endpoint BE không có, file gọi HTTP chưa khai, facade demo không qua sourceOf ⇒ fail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carenest-gate-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  write('scripts/check-api-contract.mjs', fs.readFileSync(path.join(repoRoot, 'scripts/check-api-contract.mjs'), 'utf8'));
  write('docs/integration/be-api-routes.json', JSON.stringify({ routes: ['GET /permissions'] }));
  write(
    'src/config/integrationModules.js',
    `export const INTEGRATION_MODULES = {
      permission: { source: 'api', files: ['src/services/a/api/aApi.js'] },
      kitchen: { source: 'demo', facades: ['src/services/k/kService.js'] },
    };`,
  );
  write(
    'src/services/a/api/aApi.js',
    "export const a = { x: () => client.get('/permissions'), y: () => client.get('/role-permissions') };",
  );
  write('src/services/b/bApi.js', "export const b = () => client.post('/orphan');");
  write('src/services/k/kService.js', 'export const repo = USE_MOCK ? mock : api;');

  const result = spawnSync(process.execPath, [path.join(dir, 'scripts/check-api-contract.mjs')], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /GET \/role-permissions — BE không có/);
  assert.match(result.stdout, /src\/services\/b\/bApi\.js: gọi HTTP nhưng chưa thuộc module nào/);
  assert.match(result.stdout, /module demo 'kitchen' phải chọn nguồn/);
});
