import { normalizeText } from '@/utils/format';
import { DECLARATION_STATE, IMPORT_COLUMNS } from '@/models/children/childrenConstants';

/*
 * Fake-backend parser for the enrollment template. Only CSV is read in the demo (no spreadsheet
 * dependency); the real backend reads .xlsx and returns the same row shape.
 */

import { parseCsv } from '@/utils/csv';
export { parseCsv } from '@/utils/csv';

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
const isYes = (value) => ['co', 'yes', 'x'].includes(normalizeText(value).trim());

// Ô Có/Không: để trống ⇒ chưa cung cấp; giá trị khác giữ nguyên để kiểm tra báo lỗi đúng dòng.
const toYesNo = (value) => {
  const v = String(value || '').trim();
  if (!v) return '';
  if (isYes(v)) return 'YES';
  if (isNone(v)) return 'NO';
  return v;
};

const toHistoryItem = (value) => {
  const v = String(value || '').trim();
  if (!v) return { state: DECLARATION_STATE.NOT_PROVIDED, text: '' };
  if (isNone(v)) return { state: DECLARATION_STATE.NONE_REPORTED, text: '' };
  return { state: DECLARATION_STATE.REPORTED, text: isYes(v) ? '' : v };
};

const toTbState = (value) => {
  const v = toYesNo(value);
  if (v === '') return DECLARATION_STATE.NOT_PROVIDED;
  if (v === 'YES') return DECLARATION_STATE.REPORTED;
  if (v === 'NO') return DECLARATION_STATE.NONE_REPORTED;
  return v;
};

const toDeclaration = (allergies, diet, raw = {}) => {
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
    medicalHistory: {
      self: toHistoryItem(raw.selfHistory),
      family: toHistoryItem(raw.familyHistory),
      tbContact: { state: toTbState(raw.tbContact) },
    },
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
          profile: {
            idNumber: raw.idNumber || '',
            premature: toYesNo(raw.premature),
            gestationWeeks: raw.gestationWeeks || '',
            ethnicity: raw.ethnicity || '',
            beneficiary: raw.beneficiary || '',
            paymentSource: raw.paymentSource || '',
            bloodType: raw.bloodType || '',
            address: { province: raw.province || '', ward: raw.ward || '', street: raw.street || '' },
          },
        },
        declaration: toDeclaration(raw.allergies, raw.diet, raw),
      },
    };
  });
  return { missingColumns, rows };
};
