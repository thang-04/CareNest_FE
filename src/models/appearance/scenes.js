/*
 * Bộ tranh nền sáp màu của giao diện. `id` là mã gửi lên BE (enabledSceneIds, pinnedSceneId).
 * time: 'day' | 'night'; season/occasion dùng cho chế độ Tự động (utils/appearance/pickScene.js).
 */
export const APPEARANCE_MODE = {
  FIXED: 'FIXED',
  AUTO: 'AUTO',
  DAILY_RANDOM: 'DAILY_RANDOM',
};

export const APPEARANCE_MODE_LABELS = {
  FIXED: 'Cố định một tranh',
  AUTO: 'Tự động theo dịp, giờ và mùa',
  DAILY_RANDOM: 'Ngẫu nhiên mỗi ngày',
};

export const SCENES = [
  { id: 'T0', file: 'san-choi', name: 'Sân chơi', time: 'day' },
  { id: 'T1', file: 'vuon-rau', name: 'Vườn rau của bé', time: 'day' },
  { id: 'T2', file: 'bua-an', name: 'Bữa trưa dã ngoại', time: 'day' },
  { id: 'T3', file: 'bien', name: 'Một ngày ở biển', time: 'day', season: 'summer' },
  { id: 'T4', file: 'dem-sao', name: 'Đêm sao yên bình', time: 'night' },
  { id: 'T5', file: 'mua-thu', name: 'Mùa thu lá vàng', time: 'day', season: 'autumn' },
  { id: 'T6', file: 'tet', name: 'Tết vui xuân', time: 'day', occasion: 'tet' },
  { id: 'T7', file: 'lop-hoc', name: 'Góc học tập', time: 'day' },
  { id: 'T8', file: 'suc-khoe', name: 'Bé khỏe mỗi ngày', time: 'day' },
  { id: 'T9', file: 'ao-ca', name: 'Ao cá vịt bơi', time: 'day', season: 'summer' },
  { id: 'T10', file: 'vu-tru', name: 'Bay vào vũ trụ', time: 'night' },
  { id: 'T11', file: 'mua-mua', name: 'Mưa và cầu vồng', time: 'day' },
  { id: 'T12', file: 'so-thu', name: 'Đi thăm sở thú', time: 'day' },
  { id: 'T13', file: 'trung-thu', name: 'Đêm trăng Trung thu', time: 'night', occasion: 'midAutumn' },
  { id: 'T14', file: 'den-truong', name: 'Bé đến trường', time: 'day', occasion: 'schoolOpening' },
  { id: 'T15', file: 'cau-vong', name: 'Đồi cầu vồng', time: 'day' },
  { id: 'T16', file: 'sinh-nhat', name: 'Sinh nhật của bé', time: 'day' },
  { id: 'S1', file: 'cau-vong-sap-dam', name: 'Đồi cầu vồng (sáp đậm)', time: 'day' },
  { id: 'S3', file: 'bien-sap-dau', name: 'Biển (sáp dầu)', time: 'day', season: 'summer' },
  { id: 'S8', file: 'lop-hoc-sap-dam', name: 'Góc học tập (sáp đậm)', time: 'day' },
];

export const DEFAULT_SCENE_ID = 'T0';

export const sceneById = (id) => SCENES.find((s) => s.id === id) || SCENES.find((s) => s.id === DEFAULT_SCENE_ID);

// Vite tách mỗi tranh thành một file; chỉ tranh được dùng mới tải về
const SCENE_URLS = import.meta.glob('@/assets/illustrations/scenes/*.webp', { eager: true, query: '?url', import: 'default' });

export const sceneUrl = (id) => {
  const { file } = sceneById(id);
  const key = Object.keys(SCENE_URLS).find((k) => k.endsWith(`/${file}.webp`));
  return key ? SCENE_URLS[key] : '';
};

/** Cấu hình mặc định khi trường chưa lưu, và cho màn chưa đăng nhập (chưa gọi được API). */
export const DEFAULT_APPEARANCE = {
  mode: APPEARANCE_MODE.AUTO,
  pinnedSceneId: DEFAULT_SCENE_ID,
  enabledSceneIds: SCENES.map((s) => s.id),
  updatedBy: null,
  updatedAt: null,
};
