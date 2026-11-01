import { APPEARANCE_MODE, DEFAULT_SCENE_ID, SCENES } from '@/models/appearance/scenes';

// Ngày dương của mùng 1 Tết và rằm tháng 8 âm lịch (không thêm thư viện âm lịch)
const TET = { 2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03' };
const MID_AUTUMN = { 2026: '2026-09-25', 2027: '2027-09-15', 2028: '2028-10-03', 2029: '2029-09-22', 2030: '2030-09-12' };

const DAY_MS = 86400000;
const localDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dayDiff = (date, iso) => Math.round((startOfDay(date) - localDate(iso)) / DAY_MS);
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** Số nguyên ổn định từ chuỗi: cùng ngày + cùng hạt giống ⇒ cùng tranh. */
const hash = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const pickStable = (list, seed) => list[hash(seed) % list.length];

export const currentOccasion = (date) => {
  const year = date.getFullYear();
  if (TET[year]) {
    const d = dayDiff(date, TET[year]);
    if (d >= -3 && d <= 7) return 'tet';
  }
  if (MID_AUTUMN[year] && Math.abs(dayDiff(date, MID_AUTUMN[year])) <= 1) return 'midAutumn';
  if (date.getMonth() === 8 && date.getDate() === 5) return 'schoolOpening';
  return null;
};

export const isNight = (date) => date.getHours() >= 18 || date.getHours() < 6;

export const currentSeason = (date) => {
  const month = date.getMonth() + 1;
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return null;
};

/**
 * Chọn tranh nền theo cấu hình trường. Chỉ chọn trong tranh đang bật; bước nào không có tranh hợp thì bỏ qua.
 * AUTO: dịp lễ → giờ đêm → mùa → ngẫu nhiên theo ngày. DAILY_RANDOM: chỉ bước cuối. FIXED: tranh ghim.
 */
export function pickScene(config, date = new Date()) {
  const enabled = SCENES.filter((s) => config?.enabledSceneIds?.includes(s.id));
  if (!enabled.length) return DEFAULT_SCENE_ID;
  if (config.mode === APPEARANCE_MODE.FIXED) {
    return enabled.some((s) => s.id === config.pinnedSceneId) ? config.pinnedSceneId : enabled[0].id;
  }
  const seed = dayKey(date);
  const days = enabled.filter((s) => s.time === 'day');
  if (config.mode === APPEARANCE_MODE.AUTO) {
    const occasion = currentOccasion(date);
    const byOccasion = occasion && enabled.filter((s) => s.occasion === occasion);
    if (byOccasion?.length) return pickStable(byOccasion, seed).id;
    if (isNight(date)) {
      const nights = enabled.filter((s) => s.time === 'night' && !s.occasion);
      if (nights.length) return pickStable(nights, seed).id;
    }
    const season = currentSeason(date);
    const bySeason = season && days.filter((s) => s.season === season);
    if (bySeason?.length) return pickStable(bySeason, seed).id;
  }
  const pool = (days.length ? days : enabled).filter((s) => !s.occasion);
  return pickStable(pool.length ? pool : enabled, seed).id;
}

/** Tranh cho màn trống: ngẫu nhiên trong tranh đang bật, ổn định theo ngày + tên màn. */
export function pickEmptyScene(config, key, date = new Date()) {
  const enabled = SCENES.filter((s) => config?.enabledSceneIds?.includes(s.id));
  return enabled.length ? pickStable(enabled, `${dayKey(date)}|${key}`).id : DEFAULT_SCENE_ID;
}
