import { INSPECTION_COLUMNS, INSPECTION_STATUS } from '@/models/kitchen/inspectionConstants';

/*
 * Đổi bản trả của BE (`GET /inspections/day`: sheets[] theo `tab` HOA, chữ ký chỉ có `imageKey`, lịch sử `actorName`) sang
 * shape màn hình đang dùng (tabs theo khóa thường, `canEdit`/`canReopen` theo mẫu, `imageUrl`, `byName`). Hàm thuần: ảnh chữ ký
 * tải qua `loadImage(imageKey)` do bên gọi truyền vào.
 */

/** Mã mẫu BE (FRESH...) ⇄ khóa FE (fresh...). */
export const toApiTab = (tab) => String(tab).toUpperCase();
export const toUiTab = (tab) => String(tab).toLowerCase();

const editableColumns = (tab) => INSPECTION_COLUMNS[tab].filter((col) => !col.readOnly);

/** Ô PHT nhập luôn có giá trị ('' hoặc null cho số) để form không gặp undefined, như mock. */
const normalizeRow = (tab, row) => {
  const result = { ...row };
  editableColumns(tab).forEach((col) => {
    if (result[col.key] === undefined || result[col.key] === null) result[col.key] = col.type === 'number' ? null : '';
  });
  return result;
};

const safeImage = async (loadImage, imageKey) => {
  try {
    return await loadImage(imageKey);
  } catch {
    // Ảnh lỗi/không tải được thì vẫn hiện tên người ký, không làm hỏng cả màn
    return '';
  }
};

export const mapSheet = async (sheet, { canEdit, loadImage }) => {
  const tab = toUiTab(sheet.tab);
  const signed = sheet.status === INSPECTION_STATUS.SIGNED;
  const signature = sheet.signature ? { ...sheet.signature, imageUrl: await safeImage(loadImage, sheet.signature.imageKey) } : null;
  return {
    tab,
    rows: sheet.rows.map((row) => normalizeRow(tab, row)),
    status: sheet.status,
    version: sheet.version,
    updatedAt: sheet.updatedAt || null,
    signature,
    history: (sheet.history || []).map((event) => ({
      action: event.action,
      at: event.at,
      byName: event.actorName,
      note: event.note || '',
      imageKey: event.imageKey || null,
    })),
    header: { place: sheet.header?.place || '', checkedAt: sheet.header?.checkedAt || '' },
    // Mẫu đã ký bị khóa; chỉ "Sửa lại" (kèm lý do) mới mở khóa
    canEdit: !!canEdit && !signed,
    canReopen: !!canEdit && signed,
  };
};

export const mapDay = async (day, loadImage) => {
  const entries = await Promise.all(
    day.sheets.map(async (sheet) => [toUiTab(sheet.tab), await mapSheet(sheet, { canEdit: day.canEdit, loadImage })]),
  );
  return { campusId: day.campusId, date: day.date, canEdit: day.canEdit, tabs: Object.fromEntries(entries) };
};

/** Nhà cung cấp BE `{ id, name, phone, address, deliveryPerson, ... }` → `{ id, name, address, phone, contactName }` (bỏ CCCD). */
export const mapSupplier = (supplier) => ({
  id: supplier.id,
  name: supplier.name,
  address: supplier.address || '',
  phone: supplier.phone || '',
  contactName: supplier.deliveryPerson || '',
});
