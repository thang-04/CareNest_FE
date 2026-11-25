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

/** Mở ghi ngày cũ của một mẫu (INS-05) theo `InspectionDayResponse.TabApproval` của BE; BE chưa trả thì coi như không khóa. */
export const mapApproval = (approval) => ({
  id: approval?.approvalId ?? null,
  locked: !!approval?.locked,
  status: approval?.status || null,
  reason: approval?.reason || '',
  requestedByName: approval?.requestedByName || '',
  decisionNote: approval?.decisionNote || '',
  expiresAt: approval?.expiresAt || null,
  canRequest: !!approval?.canRequest,
  // BE trả `selfOpen` cho Hiệu trưởng: yêu cầu của họ mở ngay, không chờ ai duyệt
  canSelfOpen: !!approval?.selfOpen,
});

/** Một yêu cầu trong hàng chờ của Hiệu trưởng hoặc kết quả vừa gửi/duyệt (`InspectionApprovalResponse`). */
export const mapApprovalItem = (item) => ({
  id: item.id,
  campusId: item.campusId,
  date: item.date,
  tab: toUiTab(item.tab),
  status: item.status,
  selfOpened: !!item.selfOpened,
  reason: item.reason || '',
  requestedByName: item.requestedByName || '',
  requestedAt: item.requestedAt || null,
  decidedByName: item.decidedByName || '',
  decidedAt: item.decidedAt || null,
  decisionNote: item.decisionNote || '',
  expiresAt: item.expiresAt || null,
});

export const mapSheet = async (sheet, { canEdit, loadImage, approval }) => {
  const tab = toUiTab(sheet.tab);
  const signed = sheet.status === INSPECTION_STATUS.SIGNED;
  const mappedApproval = mapApproval(approval);
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
    approval: mappedApproval,
    // Mẫu đã ký bị khóa; chỉ "Sửa lại" (kèm lý do) mới mở khóa. Ngày cũ chưa được HT mở thì BE từ chối mọi lệnh ghi (INS-05)
    canEdit: !!canEdit && !signed && !mappedApproval.locked,
    canReopen: !!canEdit && signed && !mappedApproval.locked,
  };
};

export const mapDay = async (day, loadImage) => {
  const approvals = Object.fromEntries((day.approvals || []).map((approval) => [toUiTab(approval.tab), approval]));
  const entries = await Promise.all(
    day.sheets.map(async (sheet) => {
      const tab = toUiTab(sheet.tab);
      return [tab, await mapSheet(sheet, { canEdit: day.canEdit, loadImage, approval: approvals[tab] })];
    }),
  );
  return {
    campusId: day.campusId,
    date: day.date,
    canEdit: day.canEdit,
    // Hiệu trưởng (BE đặt `selfOpen`) xem và xử lý hàng chờ yêu cầu mở mẫu
    canDecide: Object.values(approvals).some((approval) => approval.selfOpen),
    tabs: Object.fromEntries(entries),
  };
};

/** Nhà cung cấp BE `{ id, name, phone, address, deliveryPerson, ... }` → `{ id, name, address, phone, contactName }` (bỏ CCCD). */
export const mapSupplier = (supplier) => ({
  id: supplier.id,
  name: supplier.name,
  address: supplier.address || '',
  phone: supplier.phone || '',
  contactName: supplier.deliveryPerson || '',
});
