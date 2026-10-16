import { normalizeText } from '@/utils/format';
import { ALLERGENS, FOOD_GROUP_LABELS, FOOD_STORAGE_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { validateFood } from '@/utils/menu-planning/menuPlanningValidation';

/** Cột của file mẫu `public/templates/thuc-pham-mau.xlsx`, theo thứ tự. */
export const IMPORT_COLUMNS = [
  ['code', 'Mã TP'],
  ['name', 'Tên thực phẩm'],
  ['group', 'Nhóm'],
  ['unit', 'Đơn vị'],
  ['purchaseUnit', 'Đơn vị mua'],
  ['purchaseUnitSize', 'Quy đổi'],
  ['unitPrice', 'Đơn giá'],
  ['wastePct', 'Thải bỏ %'],
  ['kcal', 'Kcal'],
  ['protein', 'Đạm'],
  ['lipid', 'Béo'],
  ['glucid', 'Bột'],
  ['allergens', 'Dị ứng'],
  ['storage', 'Bảo quản'],
];
export const IMPORT_TEMPLATE_URL = '/templates/thuc-pham-mau.xlsx';

const norm = (v) => normalizeText(String(v ?? '')).trim();
const blank = (v) => v === null || v === undefined || String(v).trim() === '';
const byLabel = (labels, value) => Object.keys(labels).find((k) => norm(labels[k]) === norm(value));
const NUTRIENTS = ['kcal', 'protein', 'lipid', 'glucid'];
const FIELD_LABELS = Object.fromEntries(IMPORT_COLUMNS);

/** Đọc sheet đầu tiên của file .xlsx thành mảng dòng (thư viện chỉ tải khi dùng). */
export async function readFoodFile(file) {
  const { readSheet } = await import('read-excel-file/browser');
  return readSheet(file);
}

/**
 * Đối chiếu các dòng của file với danh mục: Mã TP trống ⇒ thêm mới; có mã ⇒ cập nhật các ô có giá trị (ô trống giữ nguyên).
 * Trả { creates, updates, errors } — creates/updates là item cho saveFoodsBulk kèm thông tin để xem trước.
 * Kiểm tra ở đây chỉ hỗ trợ xem trước; BE kiểm lại khi ghi.
 */
export function matchFoodRows(rows, foods) {
  const [header, ...body] = rows || [];
  const expected = IMPORT_COLUMNS.map(([, label]) => norm(label));
  if (!header || expected.some((label, i) => norm(header[i]) !== label))
    return { creates: [], updates: [], errors: [{ row: 1, reason: 'Dòng tiêu đề không đúng file mẫu. Hãy tải file mẫu và điền lại.' }] };

  const creates = [];
  const updates = [];
  const errors = [];
  const seenNames = [];
  body.forEach((cells, idx) => {
    const row = idx + 2;
    if ((cells || []).every(blank)) return;
    const raw = Object.fromEntries(IMPORT_COLUMNS.map(([key], i) => [key, cells[i]]));
    const problems = [];
    const data = {};
    const nutrition = {};

    if (!blank(raw.name)) data.name = String(raw.name).trim();
    if (!blank(raw.group)) {
      const g = byLabel(FOOD_GROUP_LABELS, raw.group);
      if (g) data.group = g;
      else problems.push(`Nhóm "${raw.group}" không có trong danh mục`);
    }
    if (!blank(raw.unit)) {
      const u = norm(raw.unit);
      if (['g', 'ml'].includes(u)) data.unit = u;
      else problems.push('Đơn vị phải là g hoặc ml');
    }
    if (!blank(raw.purchaseUnit)) data.purchaseUnit = String(raw.purchaseUnit).trim();
    ['purchaseUnitSize', 'unitPrice', 'wastePct'].forEach((k) => {
      if (blank(raw[k])) return;
      const n = Number(String(raw[k]).replace(',', '.'));
      if (Number.isNaN(n)) problems.push(`${FIELD_LABELS[k]} phải là số`);
      else data[k] = n;
    });
    NUTRIENTS.forEach((k) => {
      if (blank(raw[k])) return;
      const n = Number(String(raw[k]).replace(',', '.'));
      if (Number.isNaN(n)) problems.push(`${FIELD_LABELS[k]} phải là số`);
      else nutrition[k] = n;
    });
    if (Object.keys(nutrition).length) data.nutrition = nutrition;
    if (!blank(raw.allergens)) {
      const list = String(raw.allergens)
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      const unknown = list.filter((a) => !ALLERGENS.some((x) => norm(x) === norm(a)));
      if (unknown.length) problems.push(`Dị ứng không có trong danh sách: ${unknown.join(', ')}`);
      else data.allergens = list.map((a) => ALLERGENS.find((x) => norm(x) === norm(a)));
    }
    if (!blank(raw.storage)) {
      const s = byLabel(FOOD_STORAGE_LABELS, raw.storage);
      if (s) data.storage = s;
      else problems.push('Bảo quản phải là Tươi hoặc Khô');
    }

    const code = blank(raw.code) ? '' : String(raw.code).trim();
    const before = code ? foods.find((f) => norm(f.code) === norm(code)) : null;
    if (code && !before) problems.push(`Mã ${code} không có trong danh mục`);
    const name = data.name || before?.name;
    const inCatalog = name && foods.some((f) => f.id !== before?.id && norm(f.name) === norm(name));
    if (inCatalog) problems.push('Danh mục đã có thực phẩm cùng tên — điền Mã TP để cập nhật thực phẩm đó');
    else if (name && seenNames.includes(norm(name))) problems.push('Trùng tên với một dòng khác trong file');
    if (name) seenNames.push(norm(name));

    if (!problems.length) {
      const merged = before
        ? { ...before, ...data, nutrition: { ...before.nutrition, ...(data.nutrition || {}) } }
        : { purchaseUnit: 'kg', purchaseUnitSize: 1000, unit: 'g', ...data };
      Object.entries(validateFood({ ...merged, id: before?.id }, foods)).forEach(([field, msg]) =>
        problems.push(`${FIELD_LABELS[field] || field}: ${msg}`),
      );
    }
    if (problems.length) errors.push({ row, name: name || '', reason: problems.join('; ') });
    else if (before) {
      const changes = [...Object.keys(data).filter((k) => k !== 'nutrition'), ...Object.keys(nutrition)];
      if (changes.length) updates.push({ key: `r${row}`, id: before.id, data, row, code: before.code, name: before.name, changes });
    } else creates.push({ key: `r${row}`, data, row, name });
  });
  return { creates, updates, errors };
}

/** Nhãn cột cho danh sách trường thay đổi ở bảng xem trước. */
export const importFieldLabel = (key) => FIELD_LABELS[key] || key;
