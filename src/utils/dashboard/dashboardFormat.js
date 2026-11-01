import { formatDate, formatDateTime } from '@/utils/format';

/** Sortable key for ISO and 'yyyy-mm-dd HH:mm' values (modules store both forms). */
export const sortKey = (at) => String(at || '').replace('T', ' ');

/** Date-only values must not show a fake time (they would read 07:00 after the UTC shift). */
export const formatWhen = (at) => {
  if (!at) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return formatDate(at);
  return formatDateTime(String(at).replace(' ', 'T'));
};
