import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHeader } from '@/utils/kitchen/inspectionForm';
import { INSPECTION_COLUMNS } from '@/models/kitchen/inspectionConstants';
import {
  inspectionCellText,
  inspectionExportRows,
  inspectionLabels,
  inspectionLeafLabels,
  inspectionRows,
  inspectionTitle,
} from '@/utils/kitchen/inspectionExport';

const ROW = {
  key: 'f1',
  name: 'Cà rốt',
  unit: 'kg',
  quantity: 1.5,
  receivedAt: '07:30',
  supplierName: 'NCC Sạch',
  invoice: 'YES',
  sensory: 'PASS',
  rapidTest: '',
  note: '',
};
const leavesOf = (tab) => buildHeader(INSPECTION_COLUMNS[tab]).leaves;
const textOf = (tab, key, row = ROW, value) =>
  inspectionCellText(
    leavesOf(tab).find((l) => l.col.key === key && (value === undefined || l.value === value)),
    row,
  );

test('ô tích in x ở đúng cột Đạt hoặc Không đạt', () => {
  assert.equal(textOf('fresh', 'sensory', ROW, 'PASS'), 'x');
  assert.equal(textOf('fresh', 'sensory', ROW, 'FAIL'), '');
  assert.equal(textOf('fresh', 'invoice'), 'x');
  assert.equal(textOf('fresh', 'vetCert'), '');
});

test('khối lượng in kèm đơn vị, giờ và chữ giữ nguyên, ô trống là rỗng', () => {
  assert.equal(textOf('fresh', 'quantity'), '1,5 kg');
  assert.equal(textOf('fresh', 'receivedAt'), '07:30');
  assert.equal(textOf('fresh', 'name'), 'Cà rốt');
  assert.equal(textOf('fresh', 'note'), '');
});

test('tên cột lá có nhóm và Đạt / Không đạt cho dòng tiêu đề Excel', () => {
  const labels = inspectionLeafLabels(INSPECTION_COLUMNS.fresh);
  assert.ok(labels.includes('Nơi cung cấp · Tên cơ sở'));
  assert.ok(labels.some((label) => label.endsWith('· Đạt')) && labels.some((label) => label.endsWith('· Không đạt')));
  assert.equal(labels.length, leavesOf('fresh').length);
});

test('tiêu đề biểu mẫu có số hiệu 1246/QĐ-BYT, mẫu và ngày', () => {
  const head = inspectionTitle('process', '2026-11-04');
  assert.equal(head.decision, 'Số: 1246/QĐ-BYT');
  assert.equal(head.form, 'Mẫu 2');
  assert.equal(head.date, 'Ngày 04 tháng 11 năm 2026');
  assert.match(head.title, /^BƯỚC 2: KIỂM TRA KHI CHẾ BIẾN THỨC ĂN$/);
});

test('dòng Excel: tiêu đề bảng ở headerRow, mỗi dòng dữ liệu đủ số cột, người ký ở cuối', () => {
  const data = { header: { place: 'Nhà bếp', checkedAt: '' }, rows: [ROW], signature: null };
  const { rows, headerRow, fileBase } = inspectionExportRows('fresh', data, { date: '2026-11-04', campusName: 'Cơ sở 1' });
  assert.equal(rows[headerRow][0], 'TT');
  assert.equal(rows[headerRow + 1].length, rows[headerRow].length);
  assert.deepEqual(rows[rows.length - 1], ['Người kiểm tra', 'Chưa xác nhận']);
  assert.equal(fileBase, 'kiem-thuc-fresh-2026-11-04');
  const signed = inspectionExportRows(
    'fresh',
    { ...data, signature: { valid: true, signedByName: 'Lan', signedAt: '2026-11-04T01:00:00Z' } },
    { date: '2026-11-04' },
  );
  assert.match(signed.rows[signed.rows.length - 1][1], /^Lan/);
});

const SERVE_ROWS = [
  { key: 'LUNCH:d1', sessionLabel: 'Bữa trưa', dishName: 'Cơm', servings: 183, servedAt: '10:05', sensory: 'PASS' },
  { key: 'LUNCH:d2', sessionLabel: 'Bữa trưa', dishName: 'Canh', servings: 183, servedAt: '10:05', sensory: 'PASS' },
];
const sampleRow = (key, dishName, weight, container) => ({
  key,
  session: 'LUNCH',
  sessionLabel: 'Bữa trưa',
  dishName,
  weight,
  container,
  temperature: '2-8 °C',
  takenAt: '2026-11-09T03:35:00Z',
  destroyedAt: '',
  qualityNote: '',
});
const SAMPLE_ROWS = [sampleRow('LUNCH:d1', 'Cơm', '100 g', 'Hộp thủy tinh'), sampleRow('LUNCH:d2', 'Canh', '150 ml', 'Bát')];

test('M3 gộp ghép dòng M3 với dòng lưu mẫu cùng bữa, món', () => {
  const rows = inspectionRows('serve', 'combined', { rows: SERVE_ROWS }, { rows: SAMPLE_ROWS });
  assert.equal(rows[0].weight, '100 g');
  assert.equal(rows[1].container, 'Bát');
  assert.equal(rows[0].servedAt, '10:05');
  assert.equal(inspectionRows('serve', 'main', { rows: SERVE_ROWS }, { rows: SAMPLE_ROWS }), SERVE_ROWS);
});

test('Excel M3 gộp có đủ cột M3 và lưu mẫu, tiêu đề B3', () => {
  const data = { header: {}, rows: SERVE_ROWS, signature: null };
  const out = inspectionExportRows('serve', data, { date: '2026-11-09', variant: 'combined', sampleData: { rows: SAMPLE_ROWS } });
  const header = out.rows[out.headerRow];
  assert.ok(header.includes('Khối lượng / thể tích mẫu (gam/ml)') && header.includes('Thời gian chia món ăn xong'));
  assert.equal(out.rows[out.headerRow + 1].length, header.length);
  assert.match(out.rows[0][0], /^B3: KIỂM TRA TRƯỚC KHI ĂN - LƯU MẪU/);
  assert.equal(out.fileBase, 'kiem-thuc-serve-combined-2026-11-09');
});

test('M4 nhãn: mỗi bữa một nhãn gom tên các mẫu; Excel liệt kê bữa, mẫu, giờ lấy mẫu', () => {
  const labels = inspectionLabels({ rows: SAMPLE_ROWS });
  assert.equal(labels.length, 1);
  assert.deepEqual(labels[0].dishes, ['Cơm', 'Canh']);
  const out = inspectionExportRows('sample', { rows: SAMPLE_ROWS }, { date: '2026-11-09', variant: 'label' });
  assert.deepEqual(out.rows[out.headerRow], ['Bữa ăn', 'Tên mẫu thức ăn', 'Thời gian lấy mẫu']);
  assert.equal(out.rows[out.headerRow + 1][1], 'Cơm, Canh');
  assert.equal(inspectionTitle('sample', '2026-11-09', 'label').form, 'Mẫu 4');
});

test('M5: giờ lấy mẫu in giờ ngày tháng năm, ô chưa hủy để rỗng', () => {
  const leaves = buildHeader(INSPECTION_COLUMNS.sample).leaves;
  const leaf = (key) => leaves.find((l) => l.col.key === key);
  assert.match(inspectionCellText(leaf('takenAt'), SAMPLE_ROWS[0]), /09\/11\/2026/);
  assert.equal(inspectionCellText(leaf('destroyedAt'), SAMPLE_ROWS[0]), '');
  assert.equal(inspectionCellText(leaf('weight'), SAMPLE_ROWS[0]), '100 g');
});
