import { LOCATION_TYPE_LABELS } from '@/models/Location';

/**
 * Scope of an inventory round on two axes (shared by UI and mock server):
 *  - WHERE: whole school / campuses / location types / specific rooms
 *  - WHAT:  all assets / asset categories / specific assets
 */
export const LOCATION_MODES = {
  SCHOOL: 'SCHOOL',
  CAMPUS: 'CAMPUS',
  LOCATION_TYPE: 'LOCATION_TYPE',
  CUSTOM: 'CUSTOM',
};

export const LOCATION_MODE_LABELS = {
  SCHOOL: 'Toàn trường (tất cả campus)',
  CAMPUS: 'Theo campus',
  LOCATION_TYPE: 'Theo loại phòng (ví dụ: tất cả lớp học)',
  CUSTOM: 'Chọn lớp/phòng cụ thể',
};

export const ASSET_MODES = {
  ALL: 'ALL',
  CATEGORY: 'CATEGORY',
  ASSET: 'ASSET',
};

export const ASSET_MODE_LABELS = {
  ALL: 'Tất cả tài sản',
  CATEGORY: 'Theo nhóm tài sản',
  ASSET: 'Chọn tài sản cụ thể',
};

export const LOCATION_TYPE_ORDER = ['CLASS', 'FUNCTION_ROOM', 'KITCHEN', 'DEPARTMENT', 'STORAGE'];

/** Campuses covered by the round. */
export const scopeCampusIds = (round, campuses) =>
  round.locationMode === LOCATION_MODES.SCHOOL ? campuses.map((c) => c.id) : round.campusIds || (round.campusId ? [round.campusId] : []);

/** Locations that match the WHERE axis (before excluding empty / locked ones). */
export const candidateLocations = (round, locations, campuses) => {
  const campusIds = scopeCampusIds(round, campuses);
  const inCampus = locations.filter((l) => campusIds.includes(l.campusId));
  if (round.locationMode === LOCATION_MODES.LOCATION_TYPE) return inCampus.filter((l) => (round.locationTypes || []).includes(l.type));
  if (round.locationMode === LOCATION_MODES.CUSTOM) return inCampus.filter((l) => (round.locationIds || []).includes(l.id));
  return inCampus;
};

/** Whether an asset stock line matches the WHAT axis. */
export const matchesAssetScope = (asset, round) => {
  if (round.assetMode === ASSET_MODES.CATEGORY) return (round.categoryIds || []).includes(asset.categoryId);
  if (round.assetMode === ASSET_MODES.ASSET) return (round.assetCodes || []).includes(asset.code);
  return true;
};

/** Human readable scope, used on detail / list / print. */
export const describeScope = (round, md) => {
  const campusIds = scopeCampusIds(round, md.campuses);
  const campusText =
    round.locationMode === LOCATION_MODES.SCHOOL
      ? 'Toàn trường'
      : campusIds
          .map((id) => md.campusById(id)?.shortName)
          .filter(Boolean)
          .join(', ');
  let where = campusText;
  if (round.locationMode === LOCATION_MODES.LOCATION_TYPE)
    where += ` – ${(round.locationTypes || []).map((t) => LOCATION_TYPE_LABELS[t]).join(', ')}`;
  if (round.locationMode === LOCATION_MODES.CUSTOM) where += ` – ${(round.locationIds || []).length} lớp/phòng chọn riêng`;
  let what = 'Tất cả tài sản';
  if (round.assetMode === ASSET_MODES.CATEGORY)
    what = `Nhóm: ${(round.categoryIds || [])
      .map((id) => md.categoryById(id)?.name)
      .filter(Boolean)
      .join(', ')}`;
  if (round.assetMode === ASSET_MODES.ASSET)
    what = `${(round.assetCodes || []).length} tài sản chọn riêng (${(round.assetCodes || []).join(', ')})`;
  return { where, what, campusText };
};
