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

test('nhập quy đổi mới giữ số g/ml của đơn vị kho và cập nhật tỷ lệ mua', async () => {
  const foods = await repo.listFoods({}, VP);
  const rice = foods.find((f) => f.name === 'Gạo tẻ');
  const before = { ...rice, stockUnit: 'kg', stockUnitSize: 1000, purchaseToStock: 25, purchaseUnit: 'bao', purchaseUnitSize: 25000 };
  const cells = Array(HEADER.length).fill('');
  cells[0] = before.code;
  cells[5] = 10000;
  const result = matchFoodRows([HEADER, cells], [before]);
  assert.deepEqual(result.errors, []);
  const data = result.updates[0].data;
  assert.equal(data.purchaseToStock, 10);
  assert.equal(data.stockUnitSize, undefined, 'không thay đổi tỷ lệ đơn vị kho');
  const saved = await repo.saveFood(before.id, { ...before, ...data }, VP);
  assert.equal(saved.purchaseUnitSize, 10000);
  assert.equal(saved.stockUnitSize, 1000);
});

test('file mẫu đọc được và đúng dòng tiêu đề', async () => {
  const rows = await readSheet(readFileSync('public/templates/thuc-pham-mau.xlsx'));
  assert.deepEqual(rows[0], HEADER);
  assert.deepEqual(matchFoodRows(rows, []), { creates: [], updates: [], errors: [] });
});

test('file mẫu cũ giữ đúng vị trí vi chất sau cột phiên bản nguồn đã bỏ', async () => {
  const foods = await repo.listFoods({}, VP);
  const rice = foods.find((f) => f.name === 'Gạo tẻ');
  const header = HEADER.map(
    (label) => ({ 'Đơn vị gốc': 'Đơn vị', 'Đơn vị tính': 'Đơn vị mua', 'Vitamin B3 (PP/niacin) (mg)': 'Vitamin PP (mg)' })[label] || label,
  );
  header.splice(15, 0, 'Phiên bản nguồn');
  const row = header.map(() => '');
  row[0] = rice.code;
  row[15] = '2017';
  row[header.indexOf('Kẽm (mg)')] = 0;
  row[header.indexOf('Vitamin PP (mg)')] = 1.2;
  const result = matchFoodRows([header, row], foods);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.updates[0].data.nutrition, { zinc: 0, vitaminPp: 1.2 });
  assert.equal(Object.hasOwn(result.updates[0].data, 'nutrientSourceVersion'), false);
});

test('đối chiếu file: mới, cập nhật ô có giá trị, lỗi có lý do; tiêu đề sai thì chặn cả file', async () => {
  const foods = await repo.listFoods({}, VP);
  const rice = foods.find((f) => f.name === 'Gạo tẻ');
  const rows = [
    HEADER,
    ['', 'Bí xanh', 'Rau, củ', 'g', 'kg', 1000, 18000, 15, 14, 0.6, 0.1, 2.4, '', 'Tươi', 'Bảng TPVN', 'Thực vật'],
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
  assert.equal(r.creates[0].data.nutrientSource, 'Bảng TPVN');
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

test('cập nhật: ô điền lại đúng giá trị đang có không tính là thay đổi; dòng không đổi gì thì bỏ qua', async () => {
  const foods = await repo.listFoods({}, VP);
  const rice = foods.find((f) => f.name === 'Gạo tẻ');
  const sticky = foods.find((f) => f.name === 'Gạo nếp');
  const rows = [
    HEADER,
    // Điền lại tên, nhóm, đơn vị như cũ, chỉ đổi đơn giá
    [rice.code, rice.name, 'Lương thực', rice.unit, rice.purchaseUnit, rice.purchaseUnitSize, (rice.unitPrice || 0) + 500],
    // Toàn bộ giống cũ
    [sticky.code, sticky.name, 'Lương thực', sticky.unit],
  ];
  const r = matchFoodRows(rows, foods);
  assert.deepEqual(
    r.updates.map((u) => u.changes),
    [['unitPrice']],
  );
  assert.equal(r.errors.length, 0);
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
      {
        key: 'r2',
        data: {
          name: 'Bí xanh',
          group: 'VEGETABLE',
          origin: 'PLANT',
          unit: 'g',
          purchaseUnit: 'kg',
          purchaseUnitSize: 1000,
          nutrientSource: 'Bảng TPVN',
        },
      },
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

test('cột tinh bột: file mẫu ghi "Tinh bột"; file tải trước đây (cột "Bột") vẫn nhận', async () => {
  const rows = await readSheet(readFileSync('public/templates/thuc-pham-mau.xlsx'));
  assert.ok(rows[0].includes('Tinh bột') && !rows[0].includes('Bột'));
  const oldHeader = HEADER.map((label) => (label === 'Tinh bột' ? 'Bột' : label));
  assert.deepEqual(matchFoodRows([oldHeader], []), { creates: [], updates: [], errors: [] });
});

test('NUT-05: file mẫu cũ (chưa có cột nguồn) vẫn đọc được; dòng mới thiếu nguồn số liệu bị báo lỗi', () => {
  const oldHeader = HEADER.slice(0, 14);
  const rows = [oldHeader, ['', 'Bí xanh', 'Rau, củ', 'g', 'kg', 1000, 18000, 15, 14, 0.6, 0.1, 2.4, '', 'Tươi']];
  const r = matchFoodRows(rows, []);
  assert.equal(r.creates.length, 0);
  assert.match(r.errors[0].reason, /Nguồn số liệu/);
});
