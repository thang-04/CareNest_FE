import { formatDate } from '@/utils/format';

const WEEK_STATUS_TEXT = { DRAFT: 'chưa công bố', PUBLISHED: 'đã công bố' };

/**
 * Câu liệt kê nơi món đang dùng cho hộp xác nhận ngừng dùng (BE NUT-18: ngừng dùng không bị chặn,
 * chỉ báo để người dùng biết). Dữ liệu `usedInMenus`, `usedInWeeks` lấy từ chi tiết món BE trả.
 */
export function dishInUseNote(dish) {
  const menus = dish?.usedInMenus || [];
  const weeks = dish?.usedInWeeks || [];
  if (!menus.length && !weeks.length) return '';
  const parts = [];
  if (menus.length) parts.push(`${menus.length} thực đơn mẫu (${menus.map((m) => m.name).join(', ')})`);
  if (weeks.length)
    parts.push(
      `${weeks.length} tuần chưa qua (${weeks
        .map((w) => `tuần ${formatDate(w.weekStart)}${WEEK_STATUS_TEXT[w.status] ? ` ${WEEK_STATUS_TEXT[w.status]}` : ''}`)
        .join(', ')})`,
    );
  return `Món đang có trong ${parts.join(' và ')}. Sau khi ngừng, áp mẫu hoặc công bố tuần có món này sẽ báo lỗi món ngừng dùng.`;
}
