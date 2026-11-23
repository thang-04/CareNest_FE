import DOMPurify from 'dompurify';
import { ALLOWED_ATTR, ALLOWED_TAGS, ALLOWED_URI } from './richBodyAllowlist.mjs';

const purifier = typeof document !== 'undefined' && typeof DOMPurify.sanitize === 'function' ? DOMPurify : null;

// Liên kết luôn mở tab mới và không lộ trang gốc, bất kể HTML gốc ghi gì.
purifier?.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const sanitize = (html) =>
  purifier?.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: ALLOWED_URI, ALLOW_DATA_ATTR: false }) || '';

/** Chỉ component này đưa HTML đã lọc vào trang; thiếu HTML thì hiển thị bản chữ thường. */
export function RichBody({ html, text, empty = null, className = '' }) {
  const clean = html ? sanitize(html) : '';
  const classes = ['rich-body', clean.trim() ? 'rich-body--html' : '', className].filter(Boolean).join(' ');
  if (clean.trim()) return <div className={classes} dangerouslySetInnerHTML={{ __html: clean }} />;
  return <div className={classes}>{text && text.trim() ? text : empty}</div>;
}
