/**
 * Shared validation for the inventory module (UI + mock server).
 * Rules from SRS UC 7.1 / GBR-FAC-04, 05.
 */

export const validateRound = (form) => {
  const e = {};
  if (!form.name?.trim()) e.name = 'Vui lòng nhập tên đợt kiểm kê';
  if (form.locationMode !== 'SCHOOL' && !form.campusIds?.length) e.campusIds = 'Vui lòng chọn ít nhất 1 campus';
  if (form.locationMode === 'LOCATION_TYPE' && !form.locationTypes?.length) e.locationTypes = 'Vui lòng chọn loại phòng';
  if (form.locationMode === 'CUSTOM' && !form.locationIds?.length) e.locationIds = 'Vui lòng chọn lớp/phòng';
  if (form.assetMode === 'CATEGORY' && !form.categoryIds?.length) e.categoryIds = 'Vui lòng chọn nhóm tài sản';
  if (form.assetMode === 'ASSET' && !form.assetCodes?.length) e.assetCodes = 'Vui lòng chọn tài sản cần kiểm kê';
  if (!form.startDate) e.startDate = 'Vui lòng chọn ngày bắt đầu';
  if (!form.deadline) e.deadline = 'Vui lòng chọn hạn hoàn thành';
  else if (form.startDate && form.deadline < form.startDate) e.deadline = 'Hạn hoàn thành phải từ ngày bắt đầu trở đi';
  if (!form.scope?.length) e.scope = 'Phạm vi đã chọn không có lớp/phòng nào có tài sản cần kiểm kê';
  (form.scope || []).forEach((s) => {
    if (!s.inspectorUserId) e[`inspector_${s.locationId}`] = 'Chọn người kiểm kê';
  });
  return e;
};

/** Item-level rules when the inspector submits a sheet. */
export const validateSheetItem = (item) => {
  const q = item.actualQuantity;
  if (q === null || q === undefined || q === '') return 'Chưa nhập số lượng thực tế';
  if (!Number.isInteger(Number(q)) || Number(q) < 0) return 'Số lượng không hợp lệ';
  if (!item.actualCondition) return 'Chưa chọn tình trạng';
  const note = (item.note || '').trim();
  if (Number(q) !== item.bookQuantity && !note) return 'Lệch sổ sách: bắt buộc ghi chú';
  if (item.actualCondition === 'NEED_REPAIR' && !note) return 'Cần sửa chữa: bắt buộc mô tả';
  if (item.actualCondition === 'BROKEN') {
    if (!note) return 'Hỏng: bắt buộc mô tả hư hỏng';
    if (!item.images?.length) return 'Hỏng: bắt buộc ít nhất 1 ảnh';
  }
  return null;
};

export const validateSheet = (items) => {
  const e = {};
  items.forEach((i) => {
    const err = validateSheetItem(i);
    if (err) e[i.assetId] = err;
  });
  return e;
};

export const hasErrors = (e) => Object.keys(e).length > 0;
export const firstError = (e) => Object.values(e)[0];
