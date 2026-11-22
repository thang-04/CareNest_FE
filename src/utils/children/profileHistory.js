import { CHILD_HISTORY_ACTION_LABELS, CHILD_HISTORY_FIELD_LABELS } from '@/models/children/childrenConstants';
import { formatDate } from '@/utils/format';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// BE ghi giá trị đã định dạng (chuỗi); BE giả còn ghi giá trị thô (ngày ISO, danh sách phụ huynh) ⇒ null = chỉ báo đã đổi.
const valueText = (value) => {
  if (value == null || value === '') return '(trống)';
  if (typeof value === 'string') return ISO_DAY.test(value) ? formatDate(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const changeText = (change) => {
  const label = change.label || CHILD_HISTORY_FIELD_LABELS[change.field] || change.field;
  const from = valueText(change.from);
  const to = valueText(change.to);
  return from === null || to === null ? `${label}: đã thay đổi` : `${label}: ${from} → ${to}`;
};

/** Dòng của tab "Lịch sử sửa hồ sơ" từ `child.history` BE trả, mới nhất trước. */
export const profileHistoryRows = (history) =>
  [...(history || [])]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .map((entry, index) => ({
      key: `${entry.at || ''}-${index}`,
      at: entry.at,
      actionLabel: CHILD_HISTORY_ACTION_LABELS[entry.action] || entry.action,
      userName: entry.userName || '',
      note: entry.note || '',
      changes: (entry.changes || []).map(changeText),
    }));
