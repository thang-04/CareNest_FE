import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { readDb, resetDb } = await import('@/mocks/mockDatabase');
const { authMockRepository: auth, DEMO_PASSWORD } = await import('@/mocks/authMockRepository');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { IMPORT_COLUMNS, DECLARATION_STATE } = await import('@/models/children/childrenConstants');
const { importTemplateRows } = await import('@/utils/children/importTemplate');
const { filledImportColumns } = await import('./profileFixture.mjs');

/*
 * Cột Báo ăn của file nhập Excel (CHD-13): trống = Có, Có/Không không phân biệt hoa thường, chữ khác báo lỗi
 * declaration.mealRegistered; Không thì bỏ qua ô Dị ứng, Chế độ ăn. Dữ liệu giả: CCCD bắt đầu 999.
 */
const loginAs = async (predicate) => (await auth.login({ email: readDb().users.find(predicate).email, password: DEMO_PASSWORD })).user; // carenest:allow-secret – mật khẩu demo của dữ liệu giả
const vpC1 = () => loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');

const csvOf = (rows) =>
  [IMPORT_COLUMNS.map((c) => c.label), ...rows.map((r) => IMPORT_COLUMNS.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

const importRow = (n, patch = {}) => ({
  fullName: `Trẻ Nhập Báo Ăn ${n}`,
  dateOfBirth: `0${n}/06/2023`,
  gender: 'Nam',
  guardianName: `Phụ huynh nhập báo ăn ${n}`,
  relation: 'Bố',
  phone: `0900 006 00${n}`,
  guardianIdNumber: `99990000600${n}`,
  ...filledImportColumns(),
  ...patch,
});

const declarationOf = (patch) => readEnrollmentCsv(csvOf([importRow(1, patch)])).rows[0].payload.declaration;

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('cột Báo ăn nằm trước Dị ứng, không bắt buộc, nhãn đúng nguyên văn', () => {
  const index = IMPORT_COLUMNS.findIndex((c) => c.key === 'mealRegistered');
  assert.equal(IMPORT_COLUMNS[index].label, 'Báo ăn (Có/Không, để trống = Có)');
  assert.equal(IMPORT_COLUMNS[index].required, false);
  assert.equal(IMPORT_COLUMNS[index + 1].key, 'allergies');
});

test('cột Báo ăn = Không bỏ qua dị ứng, chế độ ăn', () => {
  const d = declarationOf({ mealRegistered: 'Không', allergies: 'Trứng', diet: 'Ăn chay' });
  assert.equal(d.mealRegistered, false);
  assert.deepEqual(d.allergies, { state: DECLARATION_STATE.NOT_PROVIDED, items: [] });
  assert.deepEqual(d.diet, { state: DECLARATION_STATE.NOT_PROVIDED, text: '' });
});

test('cột Báo ăn trống là báo ăn, dị ứng vẫn đọc bình thường', () => {
  const d = declarationOf({ mealRegistered: '', allergies: 'Trứng' });
  assert.equal(d.mealRegistered, true);
  assert.deepEqual(d.allergies, { state: DECLARATION_STATE.REPORTED, items: ['Trứng'] });
});

test('cột Báo ăn không phân biệt hoa thường, chữ khác báo lỗi', async () => {
  assert.equal(declarationOf({ mealRegistered: ' KHÔNG ' }).mealRegistered, false);
  assert.equal(declarationOf({ mealRegistered: 'có' }).mealRegistered, true);

  const vp = await vpC1();
  const csv = csvOf([importRow(1, { mealRegistered: 'Không' }), importRow(2, { mealRegistered: 'Ăn trưa', allergies: 'Trứng' })]);
  const { rows } = await children.previewImport({ name: 'bao-an.csv', text: async () => csv }, vp);
  assert.deepEqual(rows[0].errors, []);
  assert.ok(rows[1].errors.includes('Báo ăn ghi Có hoặc Không'));
  assert.equal(rows[1].payload.declaration.mealRegistered, 'Ăn trưa');
  assert.equal(rows[1].payload.declaration.allergies.state, DECLARATION_STATE.REPORTED, 'chữ lạ: vẫn đọc dị ứng bình thường');
});

test('file mẫu: dòng mẫu đủ số cột và ô Báo ăn là Có', () => {
  const [header, sample] = importTemplateRows();
  assert.equal(header.length, IMPORT_COLUMNS.length);
  assert.equal(sample.length, IMPORT_COLUMNS.length);
  assert.equal(sample[IMPORT_COLUMNS.findIndex((c) => c.key === 'mealRegistered')], 'Có');
  assert.equal(sample[IMPORT_COLUMNS.findIndex((c) => c.key === 'allergies')], 'Không', 'ô sau cột mới không bị lệch');
});

test('xem trước: Báo ăn = Không mà ô Dị ứng, Chế độ ăn có chữ thì dòng có ghi chú bỏ qua', async () => {
  const vp = await vpC1();
  const csv = csvOf([
    importRow(1, { mealRegistered: 'Không', allergies: 'Trứng' }),
    importRow(2, { mealRegistered: 'Không', allergies: '', diet: '' }),
    importRow(3, { mealRegistered: 'Có', allergies: 'Trứng' }),
  ]);
  const { rows } = await children.previewImport({ name: 'bao-an.csv', text: async () => csv }, vp);
  const NOTE = 'Không báo ăn: bỏ qua cột Dị ứng, Chế độ ăn';
  assert.ok(rows[0].notes.includes(NOTE));
  assert.ok(!rows[1].notes.includes(NOTE), 'ô trống thì không có gì để bỏ qua');
  assert.ok(!rows[2].notes.includes(NOTE));
});
