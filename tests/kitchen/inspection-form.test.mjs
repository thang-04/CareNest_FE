import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSPECTION_COLUMNS } from '@/models/kitchen/inspectionConstants';
import {
  applySupplier,
  buildHeader,
  columnTick,
  copyDown,
  editableColumns,
  fillColumn,
  fillRange,
  fillRows,
  formToRequest,
  hasValidSignature,
  isFormDirty,
  joinDateTime,
  maskDate,
  normalizeDate,
  normalizeTime,
  rowsMissing,
  splitDateTime,
  toDisplayDate,
  toForm,
  toggleCell,
  toggleColumn,
  validateForm,
} from '@/utils/kitchen/inspectionForm';

const DATA = {
  header: { place: 'Nhà bếp', checkedAt: '2026-11-04T07:30' },
  rows: [
    { key: 'a', name: 'Cà rốt', sensory: 'PASS', invoice: 'YES', note: '' },
    { key: 'b', name: 'Bí đỏ', sensory: '', invoice: 'NO', note: '' },
    { key: 'c', name: 'Thịt', sensory: 'FAIL', invoice: '', note: 'Trả lại' },
  ],
};
const col = (tab, key) => INSPECTION_COLUMNS[tab].find((c) => c.key === key);

test('cột chỉ đọc (tên, món, số suất) không đi vào ô nhập', () => {
  const keys = editableColumns('process').map((c) => c.key);
  assert.ok(!keys.includes('dishName') && !keys.includes('servings') && !keys.includes('sessionLabel'));
  assert.ok(keys.includes('prepDoneAt') && keys.includes('sensory'));
});

test('toForm đưa giá trị ngoài lựa chọn của ô tích (dữ liệu cũ NO) về chưa tích', () => {
  const form = toForm('fresh', DATA);
  assert.equal(form.rows.a.invoice, 'YES');
  assert.equal(form.rows.b.invoice, '');
  assert.equal(form.header.place, 'Nhà bếp');
});

test('toForm tách thời gian kiểm tra thành ngày và giờ để gõ riêng, formToRequest ghép lại', () => {
  const form = toForm('fresh', DATA);
  assert.equal(form.header.checkedDate, '2026-11-04');
  assert.equal(form.header.checkedTime, '07:30');
  assert.equal(formToRequest('fresh', form).header.checkedAt, '2026-11-04T07:30');
  assert.deepEqual(splitDateTime(''), { date: '', time: '' });
  assert.equal(joinDateTime('', ''), '');
});

test('formToRequest giữ phần đầu, ô số rỗng gửi null', () => {
  const request = formToRequest('fresh', {
    header: { place: ' Bếp ', checkedDate: '', checkedTime: '' },
    rows: { f1: { quantity: '', receivedAt: '' } },
  });
  assert.equal(request.header.place, 'Bếp');
  assert.equal(request.header.checkedAt, '');
  assert.equal(request.rows[0].quantity, null);
});

test('validateForm báo giờ, ngày, số, thời gian kiểm tra sai định dạng và bỏ qua ô trống', () => {
  const form = { header: { place: '', checkedDate: '2026-11-04', checkedTime: '' }, rows: { a: { prepDoneAt: '7h20', cookDoneAt: '' } } };
  assert.deepEqual(Object.keys(validateForm('process', form)).sort(), ['a.prepDoneAt', 'header.checkedAt']);
  assert.equal(
    Object.keys(validateForm('process', { header: { place: '', checkedDate: '', checkedTime: '' }, rows: { a: { prepDoneAt: '07:20' } } }))
      .length,
    0,
  );
  assert.equal(Object.keys(validateForm('process', { header: { checkedDate: '2026-11-04', checkedTime: '07:30' }, rows: {} })).length, 0);
  assert.ok(validateForm('process', { header: { checkedDate: '2026-02-30', checkedTime: '07:30' }, rows: {} })['header.checkedAt']);
  const dry = validateForm('dry', { header: {}, rows: { a: { expiryDate: '2026-1-5', quantity: '-1' } } });
  assert.ok(dry['a.quantity'] && dry['a.expiryDate']);
});

test('normalizeDate đọc ngày gõ liền hoặc gõ tắt về YYYY-MM-DD, thiếu năm lấy năm biên bản', () => {
  assert.equal(normalizeDate('09112026'), '2026-11-09');
  assert.equal(normalizeDate('091126'), '2026-11-09');
  assert.equal(normalizeDate('09/11/2026'), '2026-11-09');
  assert.equal(normalizeDate('9.11.26'), '2026-11-09');
  assert.equal(normalizeDate('9/11', '2026'), '2026-11-09');
  assert.equal(normalizeDate('0911', 2026), '2026-11-09');
  assert.equal(normalizeDate('2026-11-09'), '2026-11-09');
  assert.equal(normalizeDate(''), '');
  // Không đọc được hoặc ngày không có thật ⇒ giữ nguyên chữ để báo lỗi
  assert.equal(normalizeDate('30/02/2026'), '30/02/2026');
  assert.equal(normalizeDate('9/11'), '9/11');
  assert.equal(normalizeDate('abc'), 'abc');
});

test('maskDate chèn dấu / khi gõ liền toàn số; toDisplayDate hiện dd/mm/yyyy', () => {
  assert.equal(maskDate('09'), '09');
  assert.equal(maskDate('091'), '09/1');
  assert.equal(maskDate('0911'), '09/11');
  assert.equal(maskDate('09112026'), '09/11/2026');
  assert.equal(maskDate('091120261'), '09/11/2026');
  assert.equal(maskDate('9/11'), '9/11');
  // Gõ từng ký tự: đã có "/" rồi gõ tiếp vẫn ra đúng
  assert.equal(maskDate('09/112'), '09/11/2');
  assert.equal(maskDate('09/11/2026'), '09/11/2026');
  assert.equal(maskDate('09/'), '09/');
  assert.equal(maskDate('09.11.2026'), '09.11.2026');
  assert.equal(toDisplayDate('2026-11-09'), '09/11/2026');
  assert.equal(toDisplayDate('09/1'), '09/1');
});

test('copyDown chép ô dòng trên xuống dòng này; dòng đầu giữ nguyên', () => {
  const form = { header: {}, rows: { a: { servedAt: '10:00' }, b: { servedAt: '' }, c: { servedAt: '11:00' } } };
  assert.equal(copyDown(form, 'b', 'servedAt').rows.b.servedAt, '10:00');
  assert.equal(copyDown(form, 'c', 'servedAt').rows.c.servedAt, '');
  assert.equal(copyDown(form, 'a', 'servedAt'), form);
});

test('fillRange chép ô nguồn xuống hoặc lên các dòng trong vùng kéo, không đụng dòng ngoài vùng', () => {
  const form = { header: {}, rows: { a: { t: '1' }, b: { t: '2' }, c: { t: '3' }, d: { t: '4' } } };
  assert.deepEqual(
    Object.values(fillRange(form, 't', 'a', 'c').rows).map((r) => r.t),
    ['1', '1', '1', '4'],
  );
  assert.deepEqual(
    Object.values(fillRange(form, 't', 'd', 'b').rows).map((r) => r.t),
    ['1', '4', '4', '4'],
  );
  assert.equal(fillRange(form, 't', 'b', 'b'), form);
  assert.equal(fillRange(form, 't', 'b', 'zz'), form);
});

test('fillRows điền hoặc xóa cột chỉ cho các dòng được chọn', () => {
  const form = { header: {}, rows: { a: { t: '1', n: 'x' }, b: { t: '2', n: 'y' }, c: { t: '3', n: 'z' } } };
  assert.deepEqual(
    Object.values(fillRows(form, 't', '9', ['a', 'c']).rows).map((r) => r.t),
    ['9', '2', '9'],
  );
  assert.deepEqual(
    Object.values(fillRows(form, 't', '', ['a', 'b', 'c']).rows).map((r) => r.t),
    ['', '', ''],
  );
  assert.equal(fillRows(form, 't', '9', ['a']).rows.a.n, 'x');
  assert.equal(fillRows(form, 't', '9', []).rows.b, form.rows.b);
});

test('isFormDirty chỉ true khi ô nhập khác dữ liệu BE trả', () => {
  const form = toForm('fresh', DATA);
  assert.equal(isFormDirty('fresh', DATA, form), false);
  assert.equal(isFormDirty('fresh', DATA, { ...form, header: { ...form.header, place: 'Khác' } }), true);
  assert.equal(isFormDirty('fresh', DATA, toggleCell(form, 'b', col('fresh', 'sensory'), 'PASS')), true);
});

test('columnTick đếm all / some / none và toggleColumn tích hết rồi bỏ hết', () => {
  const sensory = col('fresh', 'sensory');
  let form = toForm('fresh', DATA);
  assert.equal(columnTick(form, sensory, 'PASS'), 'some');
  form = toggleColumn(form, sensory, 'PASS');
  assert.equal(columnTick(form, sensory, 'PASS'), 'all');
  assert.ok(Object.values(form.rows).every((row) => row.sensory === 'PASS'));
  form = toggleColumn(form, sensory, 'PASS');
  assert.equal(columnTick(form, sensory, 'PASS'), 'none');
});

test('Đạt tất cả ghi đè Không đạt; ô tích một dòng bấm lại thì bỏ tích', () => {
  const sensory = col('fresh', 'sensory');
  let form = toggleColumn(toForm('fresh', DATA), sensory, 'FAIL');
  assert.equal(columnTick(form, sensory, 'FAIL'), 'all');
  form = toggleColumn(toggleColumn(form, sensory, 'FAIL'), sensory, 'PASS');
  assert.equal(form.rows.c.sensory, 'PASS');
  form = toggleCell(form, 'a', sensory, 'PASS');
  assert.equal(form.rows.a.sensory, '');
});

test('buildHeader: cột nhóm gộp hàng trên, Đạt / Không đạt thành hai cột lá, số cột lá khớp thân bảng', () => {
  const { top, sub, leaves } = buildHeader(INSPECTION_COLUMNS.fresh);
  const group = top.find((cell) => cell.label === 'Nơi cung cấp');
  assert.equal(group.colSpan, 3);
  const sensory = top.find((cell) => cell.key === 'sensory');
  assert.equal(sensory.colSpan, 2);
  assert.equal(
    leaves
      .filter((leaf) => leaf.col.key === 'sensory')
      .map((leaf) => leaf.value)
      .join(),
    'PASS,FAIL',
  );
  const spanned = top.reduce((n, cell) => n + cell.colSpan, 0);
  assert.equal(spanned, leaves.length);
  assert.equal(
    sub.length,
    top.filter((cell) => cell.rowSpan === 1).reduce((n, cell) => n + cell.colSpan, 0),
  );
});

test('normalizeTime đọc giờ gõ nhanh và giữ nguyên chữ không đọc được', () => {
  assert.equal(normalizeTime('730'), '07:30');
  assert.equal(normalizeTime('1030'), '10:30');
  assert.equal(normalizeTime('0730'), '07:30');
  assert.equal(normalizeTime('7:5'), '07:05');
  assert.equal(normalizeTime('9'), '09:00');
  assert.equal(normalizeTime(''), '');
  assert.equal(normalizeTime('2560'), '2560');
  assert.equal(normalizeTime('abc'), 'abc');
});

test('fillColumn điền cả cột, chỉ dòng trống hoặc ghi đè tất cả', () => {
  const form = { header: {}, rows: { a: { servedAt: '10:00' }, b: { servedAt: '' } } };
  assert.deepEqual(fillColumn(form, 'servedAt', '10:05', true).rows, { a: { servedAt: '10:00' }, b: { servedAt: '10:05' } });
  assert.deepEqual(fillColumn(form, 'servedAt', '10:05', false).rows, { a: { servedAt: '10:05' }, b: { servedAt: '10:05' } });
});

test('applySupplier điền tên, địa chỉ + điện thoại, người giao hàng; không đè ô đã nhập khi chọn dòng trống', () => {
  const form = {
    header: {},
    rows: {
      a: { supplierName: 'Cũ', supplierContact: '', deliveryPerson: '' },
      b: { supplierName: '', supplierContact: '', deliveryPerson: '' },
    },
  };
  const next = applySupplier(form, { name: 'NCC Sạch', address: 'Hải Phòng', phone: '0901', contactName: 'Anh Nam' }, true);
  assert.equal(next.rows.a.supplierName, 'Cũ');
  assert.equal(next.rows.a.supplierContact, 'Hải Phòng, 0901');
  assert.equal(next.rows.b.deliveryPerson, 'Anh Nam');
  assert.equal(applySupplier(form, { name: 'NCC Sạch' }, false).rows.a.supplierName, 'NCC Sạch');
});

test('rowsMissing liệt kê dòng chưa chọn Đạt / Không đạt theo thứ tự, M5 không bắt buộc', () => {
  const form = { header: {}, rows: { a: { sensory: 'PASS' }, b: { sensory: '' }, c: { sensory: 'FAIL' }, d: {} } };
  assert.deepEqual(rowsMissing('fresh', form), ['b', 'd']);
  assert.deepEqual(rowsMissing('sample', form), []);
});

test('chữ ký mất hiệu lực khi BE đánh dấu valid=false', () => {
  assert.equal(hasValidSignature({ signature: { valid: true } }), true);
  assert.equal(hasValidSignature({ signature: { valid: false } }), false);
  assert.equal(hasValidSignature({ signature: null }), false);
});
