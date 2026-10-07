import { downloadBlob } from './file';

const cell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Shared export: rows (array of arrays) -> CSV file with UTF-8 BOM so Excel shows Vietnamese correctly. */
export const downloadCsv = (rows, filename) => {
  const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n');
  downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), filename);
};
