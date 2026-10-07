import { normalizeText } from '@/utils/format';
import { DECLARATION_STATE, IMPORT_COLUMNS } from '@/models/children/childrenConstants';

/*
 * Fake-backend parser for the enrollment template. Only CSV is read in the demo (no spreadsheet
 * dependency); the real backend reads .xlsx and returns the same row shape.
 */

/** RFC 4180-ish CSV parser: quotes, escaped quotes, ',' or ';' separator, BOM. */
export const parseCsv = (text) => {
  const raw = String(text || '');
  // Excel saves "CSV UTF-8" with a byte order mark (U+FEFF).
  const src = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

const headerKey = (header) => {
  const h = normalizeText(header).trim();
  const col = IMPORT_COLUMNS.find((c) => h.startsWith(normalizeText(c.label.split(' (')[0])));
  return col?.key || null;
};

const toIsoDate = (value) => {
  const v = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

const toGender = (value) => {
  const v = normalizeText(value).trim();
  if (['nam', 'male', 'm'].includes(v)) return 'MALE';
  if (['nu', 'female', 'f'].includes(v)) return 'FEMALE';
  return '';
};

const isNone = (value) => ['khong', 'khong co', 'none', 'no'].includes(normalizeText(value).trim());

const toDeclaration = (allergies, diet) => {
  const a = String(allergies || '').trim();
  const d = String(diet || '').trim();
  return {
    allergies: !a
      ? { state: DECLARATION_STATE.NOT_PROVIDED, items: [] }
      : isNone(a)
        ? { state: DECLARATION_STATE.NONE_REPORTED, items: [] }
        : {
            state: DECLARATION_STATE.REPORTED,
            items: a
              .split(/[;,/]/)
              .map((x) => x.trim())
              .filter(Boolean),
          },
    diet: !d
      ? { state: DECLARATION_STATE.NOT_PROVIDED, text: '' }
      : isNone(d)
        ? { state: DECLARATION_STATE.NONE_REPORTED, text: '' }
        : { state: DECLARATION_STATE.REPORTED, text: d },
    otherNotes: { state: DECLARATION_STATE.NOT_PROVIDED, text: '' },
  };
};

/** CSV text -> { missingColumns, rows: [{ rowNo, raw, payload }] } (payload = enrollment payload without class). */
export const readEnrollmentCsv = (text) => {
  const table = parseCsv(text);
  if (table.length === 0) return { missingColumns: IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.label), rows: [] };
  const keys = table[0].map(headerKey);
  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && !keys.includes(c.key)).map((c) => c.label);
  const rows = table.slice(1).map((cells, i) => {
    const raw = {};
    keys.forEach((k, idx) => {
      if (k) raw[k] = (cells[idx] || '').trim();
    });
    return {
      rowNo: i + 2,
      raw,
      payload: {
        child: {
          fullName: raw.fullName || '',
          dateOfBirth: toIsoDate(raw.dateOfBirth),
          gender: toGender(raw.gender),
          guardians: [{ fullName: raw.guardianName || '', relation: raw.relation || '', phone: raw.phone || '', email: raw.email || '' }],
        },
        declaration: toDeclaration(raw.allergies, raw.diet),
      },
    };
  });
  return { missingColumns, rows };
};
