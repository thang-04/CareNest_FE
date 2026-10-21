import { REASON_MAX_LENGTH } from '@/models/account/permissionConstants';

/** Lý do bắt buộc cho mọi thay đổi phân quyền (BE AUTH-14). */
export const validatePermissionChange = (form) => {
  const e = {};
  const reason = form.reason?.trim();
  if (!reason) e.reason = 'Nhập lý do thay đổi quyền';
  else if (reason.length > REASON_MAX_LENGTH) e.reason = `Lý do tối đa ${REASON_MAX_LENGTH} ký tự`;
  return e;
};
