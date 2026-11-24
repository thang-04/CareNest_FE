import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { readSheet } = await import('read-excel-file/node');
const { buildXlsx } = await import('@/utils/exportXlsx');
const { createTemplatesSequentially, matchTemplateRows, templateImportSample, TEMPLATE_IMPORT_COLUMNS, TEMPLATE_IMPORT_MAX_ROWS } =
  await import('@/utils/announcement/templateImport.mjs');

const campuses = [
  { id: 1, name: 'Điểm trường Thượng Hồng' },
  { id: 2, name: 'Điểm trường Nam Sơn' },
];
const HEAD = TEMPLATE_IMPORT_COLUMNS;
const row = (name, scope, title, body) => [name, scope, title, body];

test('dòng hợp lệ: phạm vi trống hoặc Toàn trường là toàn trường, tên điểm trường khớp không phân biệt dấu và hoa thường', () => {
  const { items, errors, fatal } = matchTemplateRows(
    [
      HEAD,
      row('Nhắc họp', '', 'Họp phụ huynh', 'Dòng 1\r\n\r\n\r\nDòng 2'),
      row('Nhắc học phí', 'toàn trường', 'Học phí', 'Nội dung học phí'),
      row('Nghỉ lễ', 'diem truong nam son', 'Nghỉ lễ', 'Trường nghỉ lễ'),
    ],
    { campuses },
  );
  assert.equal(fatal, '');
  assert.deepEqual(errors, []);
  assert.deepEqual(
    items.map(({ row: r, name, campusId, campusLabel, body }) => ({ r, name, campusId, campusLabel, body })),
    [
      { r: 2, name: 'Nhắc họp', campusId: null, campusLabel: 'Toàn trường', body: 'Dòng 1\n\nDòng 2' },
      { r: 3, name: 'Nhắc học phí', campusId: null, campusLabel: 'Toàn trường', body: 'Nội dung học phí' },
      { r: 4, name: 'Nghỉ lễ', campusId: 2, campusLabel: 'Điểm trường Nam Sơn', body: 'Trường nghỉ lễ' },
    ],
  );
});

test('dòng lỗi ghi rõ số dòng và lý do, dòng hợp lệ vẫn được giữ, dòng trống bị bỏ qua', () => {
  const { items, errors } = matchTemplateRows(
    [
      HEAD,
      row('Mẫu tốt', '', 'Tiêu đề', 'Nội dung'),
      ['', '', '', ''],
      row('', '', 'Chỉ có tiêu đề', ''),
      row('a'.repeat(101), '', 't'.repeat(151), 'b'.repeat(4001)),
      row('Sai điểm trường', 'Điểm trường Không Có', 'Tiêu đề', 'Nội dung'),
    ],
    { campuses },
  );
  assert.deepEqual(
    items.map((item) => item.row),
    [2],
  );
  assert.deepEqual(
    errors.map((error) => error.row),
    [4, 5, 6],
  );
  assert.match(errors[0].reason, /thiếu Tên mẫu; thiếu Nội dung/);
  assert.match(errors[1].reason, /Tên mẫu dài quá 100.*Tiêu đề dài quá 150.*Nội dung dài quá 4\.000/);
  assert.match(errors[2].reason, /không có điểm trường “Điểm trường Không Có”/);
});

test('Phó hiệu trưởng bắt buộc chọn điểm trường, không được để toàn trường', () => {
  const { items, errors } = matchTemplateRows(
    [
      HEAD,
      row('Mẫu A', '', 'Tiêu đề', 'Nội dung'),
      row('Mẫu B', 'Toàn trường', 'Tiêu đề', 'Nội dung'),
      row('Mẫu C', 'Điểm trường Nam Sơn', 'Tiêu đề', 'Nội dung'),
    ],
    { campuses, viceRole: true },
  );
  assert.deepEqual(
    items.map((item) => item.name),
    ['Mẫu C'],
  );
  assert.deepEqual(
    errors.map((error) => error.row),
    [2, 3],
  );
  assert.match(errors[0].reason, /Phó hiệu trưởng phải chọn điểm trường/);
});

test('lỗi cả tệp: sai tiêu đề cột, không có dòng, quá số dòng cho phép', () => {
  assert.match(
    matchTemplateRows([['Tên', 'Phạm vi', 'Tiêu đề', 'Nội dung'], row('a', '', 'b', 'c')], { campuses }).fatal,
    /không đúng tệp mẫu/,
  );
  assert.match(matchTemplateRows([], { campuses }).fatal, /không đúng tệp mẫu/);
  assert.match(matchTemplateRows([HEAD, ['', '', '', '']], { campuses }).fatal, /chưa có dòng mẫu nào/);
  const many = [HEAD, ...Array.from({ length: TEMPLATE_IMPORT_MAX_ROWS + 1 }, (_, i) => row(`Mẫu ${i}`, '', 'Tiêu đề', 'Nội dung'))];
  const result = matchTemplateRows(many, { campuses });
  assert.match(result.fatal, /51 dòng, tối đa 50 dòng/);
  assert.deepEqual(result.items, []);
});

test('tiêu đề cột nhận không phân biệt dấu, hoa thường và khoảng trắng thừa', () => {
  const head = ['  tên MẪU ', 'phạm vi', 'tiêu đề thông báo', 'Nội  dung'];
  assert.equal(matchTemplateRows([head, row('a', '', 'b', 'c')], { campuses }).items.length, 1);
});

test('tạo lần lượt từng mẫu, một dòng lỗi không dừng các dòng sau và được báo đúng dòng', async () => {
  const calls = [];
  const items = [2, 3, 4].map((r) => ({ row: r, name: `Mẫu ${r}`, title: 'T', body: 'B', campusId: null, campusLabel: 'Toàn trường' }));
  const outcome = await createTemplatesSequentially(items, async (data) => {
    calls.push(data.name);
    if (data.name === 'Mẫu 3') throw new Error('Tên mẫu đã tồn tại');
  });
  assert.deepEqual(calls, ['Mẫu 2', 'Mẫu 3', 'Mẫu 4']);
  assert.deepEqual(outcome, { created: 2, failed: [{ row: 3, reason: 'Tên mẫu đã tồn tại' }] });
  assert.deepEqual(Object.keys((await createTemplatesSequentially(items.slice(0, 1), async (data) => calls.push(data))).failed), []);
  assert.deepEqual(calls.at(-1), { name: 'Mẫu 2', title: 'T', body: 'B', campusId: null });
});

test('tệp mẫu tải về đọc lại được và qua kiểm tra: Hiệu trưởng dùng Toàn trường, Phó hiệu trưởng dùng tên điểm trường đầu tiên', async () => {
  for (const viceRole of [false, true]) {
    const rows = templateImportSample({ viceRole, campuses });
    const blob = buildXlsx(rows, { sheetName: 'Mẫu thông báo', headerRow: 0 });
    const sheet = await readSheet(Buffer.from(await blob.arrayBuffer()));
    const result = matchTemplateRows(sheet, { campuses, viceRole });
    assert.equal(result.fatal, '');
    assert.deepEqual(result.errors, []);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].campusLabel, viceRole ? 'Điểm trường Thượng Hồng' : 'Toàn trường');
  }
});

test('trang mẫu có nút Nhập từ Excel, mục tạo lịch gửi chỉ cho Hiệu trưởng; form lịch gửi điền sẵn mẫu từ ?templateId', () => {
  const page = readFileSync('src/pages/announcement/AnnouncementTemplatesPage.jsx', 'utf8');
  assert.match(page, /Nhập từ Excel/);
  assert.match(page, /<TemplateImportDialog/);
  assert.match(page, /user\?\.role === ROLES\.PRINCIPAL/);
  assert.match(page, /\/announcement-schedules\/new\?templateId=\$\{item\.id\}/);
  const edit = readFileSync('src/pages/announcement/AnnouncementScheduleEditPage.jsx', 'utf8');
  assert.match(edit, /initialTemplateId=\{id \? '' : params\.get\('templateId'\) \|\| ''\}/);
  const form = readFileSync('src/components/announcement/AnnouncementForm.jsx', 'utf8');
  assert.match(form, /const prefillTemplateId = initial \? '' : initialTemplateId/);
  assert.match(form, /Không tìm thấy mẫu đã chọn/);
  const dialog = readFileSync('src/components/announcement/TemplateImportDialog.jsx', 'utf8');
  assert.match(dialog, /import\('read-excel-file\/browser'\)/);
  assert.doesNotMatch(dialog, /^import .*read-excel-file/m);
  assert.match(dialog, /announcements\.createTemplate\(data, user\)/);
});
