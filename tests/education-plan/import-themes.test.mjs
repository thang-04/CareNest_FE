import assert from 'node:assert/strict';
import { test } from 'node:test';

const { mergeImportedThemes, shiftYears, yearShift } = await import('@/models/education-plan/importThemes.mjs');

const source = {
  schoolYear: '2026-2027',
  themes: [
    { id: 's1', name: 'Trường mầm non', abbr: 'TMN', start: '2026-09-07', end: '2026-09-25', festivals: 'Khai giảng', note: 'Ghi chú' },
    { id: 's2', name: 'Bản thân', abbr: 'BT', start: '2026-09-28', end: '2026-10-16', festivals: '', note: '' },
    { id: 's3', name: 'Gia đình', abbr: 'gđ', start: '2027-02-29', end: '', festivals: '', note: '' },
  ],
  breaks: [{ id: 'b1', label: 'Tết', start: '2027-02-08', end: '2027-02-19' }],
};
let n = 0;
const newId = () => `new-${++n}`;

test('dời ngày theo số năm chênh; 29/02 sang năm không nhuận thành 28/02', () => {
  assert.equal(yearShift('2026-2027', '2027 – 2028'), 1);
  assert.equal(shiftYears('2026-09-07', 1), '2027-09-07');
  assert.equal(shiftYears('2028-02-29', 1), '2029-02-28');
  assert.equal(shiftYears('', 1), '');
  assert.equal(shiftYears('2026-09-07', 0), '2026-09-07');
});

test('thêm vào cuối, bỏ chủ đề trùng tên hoặc viết tắt, chép lễ hội/ghi chú, không chép dấu tích (BE:EDU-43)', () => {
  const form = {
    schoolYear: '2027-2028',
    themes: [
      { id: 'a', name: 'Chủ đề có sẵn', abbr: 'GĐ', start: '', end: '' },
      { id: 'blank', name: '', abbr: '', start: '', end: '', festivals: '', note: '' },
    ],
    breaks: [{ id: 'x', label: 'tết ', start: '', end: '' }],
  };
  const { themes, breaks, report } = mergeImportedThemes(form, source, { themeIds: ['s1', 's3'], breakIds: ['b1'] }, newId);
  assert.deepEqual(
    themes.map((t) => t.name),
    ['Chủ đề có sẵn', 'Trường mầm non'],
  );
  const added = themes[1];
  assert.deepEqual(
    { abbr: added.abbr, start: added.start, end: added.end, festivals: added.festivals, note: added.note },
    { abbr: 'TMN', start: '2027-09-07', end: '2027-09-25', festivals: 'Khai giảng', note: 'Ghi chú' },
  );
  assert.ok(!('ticks' in added));
  assert.equal(breaks.length, 1); // "Tết" đã có
  assert.deepEqual(report, { themes: 1, breaks: 0, skipped: 2, shifted: 1 });
});

test('cùng năm học thì giữ nguyên ngày; chọn trùng nhau trong cùng lần lấy chỉ thêm một', () => {
  const form = { schoolYear: '2026-2027', themes: [], breaks: [] };
  const dup = { ...source, themes: [...source.themes, { ...source.themes[0], id: 's4' }] };
  const { themes, breaks } = mergeImportedThemes(form, dup, { themeIds: ['s1', 's4'], breakIds: ['b1'] }, newId);
  assert.equal(themes.length, 1);
  assert.equal(themes[0].start, '2026-09-07');
  assert.equal(breaks[0].start, '2027-02-08');
});
