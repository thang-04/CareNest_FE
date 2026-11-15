import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const storage = new Map();
const writes = [];
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => {
    writes.push(k);
    storage.set(k, String(v));
  },
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;

const { saveImportDraft, peekImportDraft, clearImportDraft } = await import('@/utils/children/importDraft');

const draft = { fileName: 'tiep-nhan.csv', fileSize: 1200, campusId: 'c1', preview: { supported: true, rows: [] } };

beforeEach(() => {
  clearImportDraft();
  writes.length = 0;
});

test('chưa kiểm tra file thì không có bản xem trước', () => {
  assert.equal(peekImportDraft(), null);
});

test('bản xem trước đọc lại được nhiều lần cho tới khi xóa', () => {
  saveImportDraft(draft);
  assert.equal(peekImportDraft(), draft);
  assert.equal(peekImportDraft(), draft);
  clearImportDraft();
  assert.equal(peekImportDraft(), null);
});

test('tải file khác thay bản xem trước cũ', () => {
  saveImportDraft(draft);
  const next = { ...draft, fileName: 'lan-2.csv' };
  saveImportDraft(next);
  assert.equal(peekImportDraft(), next);
});

test('bản xem trước chỉ nằm trong bộ nhớ, không ghi dữ liệu trẻ vào storage trình duyệt', () => {
  saveImportDraft(draft);
  assert.deepEqual(writes, []);
  assert.equal(storage.size, 0);
});
