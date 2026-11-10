import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapDay, mapSheet, mapSupplier, toApiTab, toUiTab } from '@/services/kitchen/api/inspectionMapper';
import { dataUrlToBlob } from '@/utils/file';

const loadImage = async (key) => `blob:${key}`;

const sheet = (overrides = {}) => ({
  tab: 'PROCESS',
  status: 'DRAFT',
  version: 2,
  saved: true,
  header: { place: 'Bếp ăn' },
  rows: [{ key: 'LUNCH:KINDERGARTEN:5', dishName: 'Cơm', servings: 10, sensory: 'PASS' }],
  signature: null,
  history: [],
  updatedAt: '2026-11-09T03:30:00Z',
  ...overrides,
});

test('mã mẫu đổi qua lại giữa BE (hoa) và FE (thường)', () => {
  assert.equal(toApiTab('process'), 'PROCESS');
  assert.equal(toUiTab('SAMPLE'), 'sample');
});

test('mẫu nháp: ô PHT nhập thiếu được điền rỗng, quyền theo canEdit của ngày', async () => {
  const tab = await mapSheet(sheet(), { canEdit: true, loadImage });

  assert.equal(tab.tab, 'process');
  assert.equal(tab.version, 2);
  assert.equal(tab.canEdit, true);
  assert.equal(tab.canReopen, false);
  assert.equal(tab.header.checkedAt, '');
  assert.equal(tab.rows[0].prepDoneAt, '');
  assert.equal(tab.rows[0].sensory, 'PASS');
  assert.equal(tab.rows[0].servings, 10);
});

test('ô số chưa nhập là null, không phải chuỗi rỗng', async () => {
  const tab = await mapSheet(sheet({ tab: 'FRESH', rows: [{ key: 'food:1', name: 'Thịt' }] }), { canEdit: true, loadImage });

  assert.equal(tab.rows[0].quantity, null);
  assert.equal(tab.rows[0].supplierName, '');
});

test('mẫu đã ký khóa sửa, cho phép sửa lại; ảnh chữ ký và lịch sử đổi sang shape màn hình', async () => {
  const tab = await mapSheet(
    sheet({
      status: 'SIGNED',
      signature: { signedBy: 7, signedByName: 'Phó HT', signedAt: '2026-11-09T04:00:00Z', documentVersion: 2, imageKey: 'abc' },
      history: [{ action: 'SIGNED', actorName: 'Phó HT', at: '2026-11-09T04:00:00Z', note: null, imageKey: 'abc' }],
    }),
    { canEdit: true, loadImage },
  );

  assert.equal(tab.canEdit, false);
  assert.equal(tab.canReopen, true);
  assert.equal(tab.signature.imageUrl, 'blob:abc');
  assert.equal(tab.signature.signedByName, 'Phó HT');
  assert.deepEqual(tab.history, [{ action: 'SIGNED', at: '2026-11-09T04:00:00Z', byName: 'Phó HT', note: '', imageKey: 'abc' }]);
});

test('không có quyền ghi: không mở sửa cũng không mở "Sửa lại"', async () => {
  const tab = await mapSheet(sheet({ status: 'SIGNED', signature: { imageKey: 'abc' } }), { canEdit: false, loadImage });

  assert.equal(tab.canEdit, false);
  assert.equal(tab.canReopen, false);
});

test('ảnh chữ ký lỗi vẫn trả chữ ký (tên người ký), imageUrl rỗng', async () => {
  const failing = async () => {
    throw new Error('404');
  };
  const tab = await mapSheet(sheet({ status: 'SIGNED', signature: { signedByName: 'A', imageKey: 'x' } }), {
    canEdit: true,
    loadImage: failing,
  });

  assert.equal(tab.signature.signedByName, 'A');
  assert.equal(tab.signature.imageUrl, '');
});

test('ngày: sheets[] thành tabs theo khóa thường kèm canEdit', async () => {
  const day = await mapDay(
    { campusId: 1, date: '2026-11-09', canEdit: false, sheets: [sheet({ tab: 'FRESH' }), sheet({ tab: 'SAMPLE' })] },
    loadImage,
  );

  assert.deepEqual(Object.keys(day.tabs), ['fresh', 'sample']);
  assert.equal(day.canEdit, false);
  assert.equal(day.tabs.fresh.canEdit, false);
});

test('nhà cung cấp: người giao thành contactName, bỏ CCCD', () => {
  const mapped = mapSupplier({
    id: 3,
    name: 'Cơ sở Hòa Phát',
    phone: '0901',
    address: null,
    idCard: '012345678901',
    deliveryPerson: 'Anh Nam',
    status: 'ACTIVE',
  });

  assert.deepEqual(mapped, { id: 3, name: 'Cơ sở Hòa Phát', address: '', phone: '0901', contactName: 'Anh Nam' });
});

test('dataUrlToBlob đọc data URL base64, chuỗi khác ⇒ null', async () => {
  const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');

  assert.equal(blob.type, 'image/png');
  assert.equal(blob.size, 8);
  assert.equal(dataUrlToBlob('blob:http://x/1'), null);
  assert.equal(dataUrlToBlob(''), null);
});
