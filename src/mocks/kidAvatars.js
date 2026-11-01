/*
 * Ảnh đại diện minh họa cho trẻ trong dữ liệu demo (không dùng ảnh trẻ thật).
 * Trả về data URI SVG, cố định theo mã trẻ; BE thật sẽ trả URL ảnh hồ sơ.
 */
const BACKGROUNDS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#ede9fe', '#cffafe'];
const SKINS = ['#f8d7b8', '#f1c6a0', '#e8b48a'];
const HAIRS = ['#3b2a20', '#5a3b28', '#2b2b2b'];

const hash = (text) => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function kidAvatar(child) {
  const h = hash(child?.id || child?.code || child?.fullName || '');
  const bg = BACKGROUNDS[h % BACKGROUNDS.length];
  const skin = SKINS[(h >> 3) % SKINS.length];
  const hair = HAIRS[(h >> 5) % HAIRS.length];
  const girl = child?.gender === 'FEMALE';
  const hairShape = girl
    ? `<path d="M14 34c0-12 8-20 18-20s18 8 18 20v14c-3 0-5-2-6-5V30c-6 2-18 2-24-4-1 3-1 6-2 8v9c-1 3-3 5-6 5z" fill="${hair}"/>`
    : `<path d="M16 30c0-10 7-16 16-16s16 6 16 16c-4-4-9-6-16-6s-12 2-16 6z" fill="${hair}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${bg}"/>${
    girl ? hairShape : ''
  }<circle cx="32" cy="35" r="15" fill="${skin}"/>${girl ? '' : hairShape}<circle cx="26.5" cy="34" r="1.8" fill="#2b2b2b"/><circle cx="37.5" cy="34" r="1.8" fill="#2b2b2b"/><circle cx="23.5" cy="39" r="2.4" fill="#f4a7a7" opacity=".7"/><circle cx="40.5" cy="39" r="2.4" fill="#f4a7a7" opacity=".7"/><path d="M28 41c2 2.2 6 2.2 8 0" stroke="#8a4b3a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
