// Nội dung có định dạng của thông báo (PAR-05). BE lọc và suy ra chữ thường; các hàm này chỉ phục vụ nhập liệu và hiển thị.
import { ALLOWED_URI } from '@/components/ui/richBodyAllowlist.mjs';

export const BODY_MAX = 4000;

export { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI } from '@/components/ui/richBodyAllowlist.mjs';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Chữ thường ⇒ HTML: dòng trống tách đoạn, xuống dòng đơn thành <br>. Dữ liệu cũ chỉ có `body` dùng hàm này để mở trong trình soạn. */
export function textToHtml(text) {
  const clean = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return '';
  return clean
    .split(/\n[ \t]*\n(?:[ \t]*\n)*/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Trình soạn trống trả `<p></p>`; coi là chuỗi rỗng để kiểm "bắt buộc" và gửi lên BE. */
export function normalizeEditorHtml(html) {
  const value = (html || '').trim();
  return value === '<p></p>' ? '' : value;
}

/** Ước lượng số ký tự chữ từ HTML (dùng khi chưa có trình soạn); số đúng do BE tính. */
export function estimateTextLength(html) {
  const text = (html || '')
    .replace(/<\/(p|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  return text.trim().length;
}

/**
 * Địa chỉ liên kết người dùng nhập ⇒ địa chỉ hợp lệ (https:, mailto:, tel:) hoặc null.
 * Thiếu giao thức: dạng email thành mailto:, còn lại thêm https://.
 */
export function normalizeLinkUrl(input) {
  const value = (input || '').trim();
  if (!value || /\s/.test(value)) return null;
  if (ALLOWED_URI.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (/^\/\//.test(value)) return null;
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(value)) return `mailto:${value}`;
  return /^[^./]+\.[^/]+/.test(value) ? `https://${value}` : null;
}
