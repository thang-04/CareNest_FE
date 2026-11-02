/**
 * Single print template. The same layout renders every status (no per-status template).
 * @typedef {Object} PrintTemplate
 * @property {string} id
 * @property {string} code
 * @property {string} title
 * @property {string} schoolName
 * @property {string} address
 * @property {string} phone
 * @property {string} email
 * @property {string} slogan
 */

export const DEFAULT_PRINT_TEMPLATE = {
  id: 'tpl_school',
  code: 'SCHOOL_DOCUMENT',
  title: 'TRƯỜNG MẦM NON THƯỢNG HỒNG',
  schoolName: 'TRƯỜNG MẦM NON THƯỢNG HỒNG',
  address: 'Thôn Thượng Hồng, xã Thượng Hồng, tỉnh Hưng Yên',
  phone: '0221 3 888 999',
  email: 'mnthuonghong@carenest.vn',
  slogan: 'Vì một thế hệ mầm non hạnh phúc',
};
