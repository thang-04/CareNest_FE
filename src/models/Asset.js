/**
 * One stock line: an asset type held at one location.
 * @typedef {Object} Asset
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string} unit
 * @property {string} categoryId
 * @property {string} locationId
 * @property {number} quantity
 * @property {string} condition
 * @property {string|null} imageUrl
 */

/**
 * @typedef {Object} AssetCategory
 * @property {string} id
 * @property {string} name
 * @property {string} icon  lucide icon key
 */

export const ASSET_CONDITIONS = {
  GOOD: 'GOOD',
  NORMAL: 'NORMAL',
  NEED_REPAIR: 'NEED_REPAIR',
  BROKEN: 'BROKEN',
};

export const ASSET_CONDITION_LABELS = {
  GOOD: 'Tốt',
  NORMAL: 'Bình thường',
  NEED_REPAIR: 'Cần sửa chữa',
  BROKEN: 'Hỏng',
};

export const CONDITION_OPTIONS = Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label }));
