// Hỗ trợ nhập liệu theo giới hạn upload EDU-46 của BE; server vẫn kiểm tra lại nội dung.
export const PLAN_IMPORT_ACCEPT = '.docx,.doc,.xlsx,.csv';
export const PLAN_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export const validatePlanImportFile = (file) => {
  if (!file || !/\.(docx?|xlsx|csv)$/i.test(file.name || '')) return 'Chọn file .doc, .docx, .xlsx hoặc .csv.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'File trống hoặc không đọc được.';
  if (file.size > PLAN_IMPORT_MAX_BYTES) return 'File tối đa 2 MB. Vui lòng chọn file nhỏ hơn.';
  return null;
};
