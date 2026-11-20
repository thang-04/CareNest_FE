import { normalizeText } from '@/utils/format';

const sameText = (a, b) => normalizeText(String(a ?? '').trim()) === normalizeText(String(b ?? '').trim());

/** Đổi tỉnh/thành nơi ở: tỉnh khác ⇒ xóa phường/xã cũ để địa chỉ không lệch tỉnh mới (G94-434); gõ lại đúng tỉnh cũ thì giữ. */
export const changeProvince = (address, province) => ({
  ...address,
  province,
  ...(sameText(address.province, province) ? {} : { ward: '' }),
});

/** Chưa có tỉnh/thành ⇒ ô phường/xã bị khóa tới khi chọn lại tỉnh/thành. */
export const wardLocked = (address) => !String(address?.province ?? '').trim();
