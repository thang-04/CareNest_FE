/*
 * Breadcrumb lấy tên nhóm và tên mục từ cấu hình sidebar (layouts/menuConfig) để hai nơi luôn khớp:
 * Trang chủ › <nhóm sidebar> › <mục sidebar> [› các cấp con của trang].
 * Trang chỉ còn khai các cấp con (tên bản ghi, "Thêm mới"…); tên nhóm và tên mục không đặt riêng ở từng trang.
 */

const HOME = { label: 'Trang chủ', to: '/' };

const flatten = (menu) =>
  (menu || []).flatMap((entry) =>
    entry.children ? entry.children.map((item) => ({ group: entry, item })) : [{ group: null, item: entry }],
  );

// Khớp theo ranh giới "/" để /children không nhận nhầm /children-archive; mục `exact` và Trang chủ chỉ khớp đúng đường dẫn
const covers = (item, pathname) =>
  item.to === '/' || item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

/** Mục sidebar của màn đang mở: mục có đường dẫn dài nhất bao được `pathname`; không có ⇒ null. */
export const menuEntryFor = (menu, pathname) =>
  flatten(menu)
    .filter((e) => e.item.to && covers(e.item, pathname))
    .sort((a, b) => b.item.to.length - a.item.to.length)[0] || null;

/**
 * Đổi `items` của trang theo sidebar. Giữ nguyên khi màn không thuộc mục sidebar nào (kể cả qua crumb cha) hoặc là Trang chủ.
 * Cấp con giữ lại = các crumb đứng sau crumb trỏ về mục sidebar; trang không có crumb như vậy thì giữ crumb cuối
 * (tên trang hiện tại) khi đang ở trang con, bỏ hết khi đang ở đúng trang của mục.
 */
export function alignCrumbs(items, menu, pathname) {
  const flat = flatten(menu);
  let hit = menuEntryFor(menu, pathname);
  let at = -1;
  if (hit) at = items.findLastIndex((c) => c.to === hit.item.to);
  else {
    // Màn không có mục riêng trên sidebar (mở từ một màn khác): bám theo crumb cha trỏ về một mục sidebar
    for (at = items.length - 2; at >= 1 && !hit; at -= 1) hit = flat.find((e) => e.item.to === items[at].to) || null;
    if (!hit) return items;
    at += 1;
  }
  if (hit.item.to === '/') return items;
  // Crumb cuối trùng tên mục (trang con vẫn hiện tên mục, vd. hộp "lập mới" mở trên danh sách) thì không lặp lại
  const tail = (at >= 0 ? items.slice(at + 1) : pathname === hit.item.to ? [] : items.slice(-1)).filter(
    (c, i, all) => !(all.length === 1 && c.label === hit.item.label),
  );
  return [HOME, ...(hit.group ? [{ label: hit.group.label }] : []), { label: hit.item.label, to: hit.item.to }, ...tail];
}
