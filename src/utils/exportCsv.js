import { downloadBlob } from './file';

export const csvCell = (value) => {
  const raw = value == null ? '' : String(value);
  const text = typeof value === 'string' && (/^[\t\r\n]/.test(raw) || /^\s*[=+@-]/.test(raw)) ? `'${raw}` : raw;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Shared export: rows (array of arrays) -> CSV file with UTF-8 BOM so Excel shows Vietnamese correctly. */
export const downloadCsv = (rows, filename) => {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), filename);
};
