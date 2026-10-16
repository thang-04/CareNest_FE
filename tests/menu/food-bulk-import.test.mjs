import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { IMPORT_COLUMNS, matchFoodRows } = await import('@/utils/menu-planning/foodImport');
const { readSheet } = await import('read-excel-file/node');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const HEADER = IMPORT_COLUMNS.map(([, label]) => label);

beforeEach(() => values.clear());

test('file mẫu đọc được và đúng dòng tiêu đề', async () => {
  const rows = await readSheet(readFileSync('public/templates/thuc-pham-mau.xlsx'));
  assert.deepEqual(rows[0], HEADER);
  assert.deepEqual(matchFoodRows(rows, []), { creates: [], updates: [], errors: [] });
});

test('đối chiếu file: mới, cập nhật ô có giá trị, lỗi có lý do; tiêu đề sai thì chặn cả file', async () => {
  const foods = await repo.listFoods({}, VP);
  const rice = foods.find((f) => f.name === 'Gạo tẻ');
  const rows = [
    HEADER,
    ['', 'Bí xanh', 'Rau, củ', 'g', 'kg', 1000, 18000, 15, 14, 0.6, 0.1, 2.4, '', 'Tươi'],
    [rice.code, '', '', '', '', '', 20000, '', '', '', '', '', '', ''],
    ['TP999', 'Không có', 'Thịt', 'g', 'kg', 1000, '', '', '', '', '', '', '', ''],
    ['', 'Rau lạ', 'Nhóm lạ', 'lít', 'kg', 1000, '', '', '', '', '', '', 'Hạt điều', 'Đông lạnh'],
    ['', 'Gạo tẻ', 'Lương thực', 'g', 'kg', 1000, '', '', '', '', '', '', '', ''],
    [],
  ];
  const r = matchFoodRows(rows, foods);
  assert.equal(r.creates.length, 1);
  assert.equal(r.creates[0].data.group, 'VEGETABLE');
  assert.equal(r.creates[0].data.storage, 'FRESH');
  assert.deepEqual(
    r.updates.map((u) => [u.code, u.changes]),
    [[rice.code, ['unitPrice']]],
  );
  assert.deepEqual(
    r.errors.map((e) => e.row),
    [4, 5, 6],
  );
  assert.match(r.errors[1].reason, /Nhóm "Nhóm lạ".*g hoặc ml.*Hạt điều.*Tươi hoặc Khô/);
  assert.match(r.errors[2].reason, /Danh mục đã có thực phẩm cùng tên/);
  assert.equal(matchFoodRows([['Sai'], []], foods).errors[0].row, 1);
});

test('lưu hàng loạt: ghi cả thêm mới và cập nhật; một dòng lỗi thì không ghi dòng nào', async () => {
  const foods = await repo.listFoods({}, VP);
  const [a, b] = foods;
  await assert.rejects(
    repo.saveFoodsBulk(
      [
        { key: a.id, id: a.id, data: { unitPrice: 12345 } },
        { key: b.id, id: b.id, data: { wastePct: 95 } },
      ],
      VP,
    ),
    (e) => e.status === 422 && !!e.details[`${b.id}.wastePct`],
  );
  assert.equal((await repo.getFood(a.id, VP)).unitPrice, a.unitPrice, 'không ghi dòng hợp lệ khi có dòng lỗi');
  const res = await repo.saveFoodsBulk(
    [
      { key: a.id, id: a.id, data: { unitPrice: 12345, nutrition: { kcal: 300 } } },
      { key: 'r2', data: { name: 'Bí xanh', group: 'VEGETABLE', unit: 'g', purchaseUnit: 'kg', purchaseUnitSize: 1000 } },
    ],
    VP,
  );
  assert.deepEqual(res, { created: 1, updated: 1 });
  const after = await repo.getFood(a.id, VP);
  assert.equal(after.unitPrice, 12345);
  assert.equal(after.nutrition.kcal, 300);
  assert.equal(after.nutrition.protein, a.nutrition.protein, 'chất khác giữ nguyên');
  const added = (await repo.listFoods({ keyword: 'Bí xanh' }, VP))[0];
  assert.equal(added.storage, 'FRESH');
});
