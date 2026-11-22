import { normalizeTemplateText } from './readTemplateFile.mjs';

/*
 * Nhập nhiều mẫu thông báo từ Excel. Kiểm tra ở đây chỉ để xem trước và báo lỗi sớm theo giới hạn của form mẫu;
 * BE kiểm lại khi tạo từng mẫu (tên, phạm vi, quyền theo điểm trường).
 */
export const TEMPLATE_IMPORT_COLUMNS = ['Tên mẫu', 'Phạm vi', 'Tiêu đề thông báo', 'Nội dung'];
export const TEMPLATE_IMPORT_MAX_ROWS = 50;
export const TEMPLATE_IMPORT_LIMITS = { name: 100, title: 150, body: 4000 };
export const SCHOOL_WIDE_LABEL = 'Toàn trường';

// Dấu thanh và dấu mũ sau khi tách NFD (U+0300 đến U+036F); dựng bằng mã để tệp nguồn không chứa ký tự vô hình
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

const norm = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const cell = (value) => (value instanceof Date ? '' : String(value ?? '').trim());
const isBlank = (row) => row.every((value) => cell(value) === '');

/** Dòng mẫu trong tệp tải về; phạm vi dùng tên điểm trường thật để Phó hiệu trưởng điền đúng. */
export const templateImportSample = ({ viceRole, campuses }) => [
  TEMPLATE_IMPORT_COLUMNS,
  [
    'Nhắc họp phụ huynh',
    viceRole ? campuses[0]?.name || 'Tên điểm trường' : SCHOOL_WIDE_LABEL,
    'Họp phụ huynh đầu năm',
    'Kính mời quý phụ huynh tham dự buổi họp vào 8 giờ sáng thứ Hai.',
  ],
];

/**
 * Các dòng của sheet đầu tiên ⇒ { items, errors, fatal }.
 * items: dòng hợp lệ { row, name, campusId, campusLabel, title, body } (row = số dòng trong tệp, tiêu đề là dòng 1).
 * errors: [{ row, reason }] cho dòng lỗi; fatal: lỗi cả tệp (sai tiêu đề cột, quá nhiều dòng, không có dòng nào).
 */
export function matchTemplateRows(rows, { campuses = [], viceRole = false } = {}) {
  const [header, ...body] = rows || [];
  if (!header || TEMPLATE_IMPORT_COLUMNS.some((label, index) => norm(header[index]) !== norm(label))) {
    return { items: [], errors: [], fatal: 'Dòng tiêu đề không đúng tệp mẫu. Hãy tải tệp mẫu và điền lại.' };
  }
  const filled = body.map((values, index) => ({ values, row: index + 2 })).filter(({ values }) => !isBlank(values));
  if (!filled.length) return { items: [], errors: [], fatal: 'Tệp chưa có dòng mẫu nào.' };
  if (filled.length > TEMPLATE_IMPORT_MAX_ROWS) {
    return { items: [], errors: [], fatal: `Tệp có ${filled.length} dòng, tối đa ${TEMPLATE_IMPORT_MAX_ROWS} dòng mỗi lần nhập.` };
  }
  const byCampus = new Map(campuses.map((site) => [norm(site.name), site]));
  const items = [];
  const errors = [];
  for (const { values, row } of filled) {
    const [name, scope, title, text] = [cell(values[0]), cell(values[1]), cell(values[2]), normalizeTemplateText(cell(values[3]))];
    const problems = [];
    if (!name) problems.push('thiếu Tên mẫu');
    else if (name.length > TEMPLATE_IMPORT_LIMITS.name) problems.push(`Tên mẫu dài quá ${TEMPLATE_IMPORT_LIMITS.name} ký tự`);
    if (!title) problems.push('thiếu Tiêu đề thông báo');
    else if (title.length > TEMPLATE_IMPORT_LIMITS.title) problems.push(`Tiêu đề dài quá ${TEMPLATE_IMPORT_LIMITS.title} ký tự`);
    if (!text) problems.push('thiếu Nội dung');
    else if (text.length > TEMPLATE_IMPORT_LIMITS.body)
      problems.push(`Nội dung dài quá ${TEMPLATE_IMPORT_LIMITS.body.toLocaleString('vi-VN')} ký tự`);
    let campus = null;
    if (!scope || norm(scope) === norm(SCHOOL_WIDE_LABEL)) {
      if (viceRole) problems.push('Phó hiệu trưởng phải chọn điểm trường ở cột Phạm vi');
    } else {
      campus = byCampus.get(norm(scope)) || null;
      if (!campus) problems.push(`không có điểm trường “${scope}”`);
    }
    if (problems.length) errors.push({ row, reason: problems.join('; ') });
    else
      items.push({
        row,
        name,
        campusId: campus ? campus.id : null,
        campusLabel: campus ? campus.name : SCHOOL_WIDE_LABEL,
        title,
        body: text,
      });
  }
  return { items, errors, fatal: '' };
}

/**
 * Tạo lần lượt từng mẫu bằng `create({ name, title, body, campusId })`; một dòng lỗi không dừng các dòng sau.
 * Trả { created, failed: [{ row, reason }] } để báo từng dòng.
 */
export async function createTemplatesSequentially(items, create) {
  let created = 0;
  const failed = [];
  for (const item of items) {
    try {
      await create({ name: item.name, title: item.title, body: item.body, campusId: item.campusId });
      created += 1;
    } catch (error) {
      failed.push({ row: item.row, reason: error?.message || 'Không tạo được mẫu' });
    }
  }
  return { created, failed };
}
