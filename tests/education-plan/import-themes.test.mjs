import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  alignWeekEnd,
  alignWeekStart,
  mergeImportedThemes,
  shiftWeeksForYears,
  shiftYears,
  suggestBreakDates,
  suggestThemeDates,
  themeDates,
  yearShift,
} = await import('@/models/education-plan/importThemes.mjs');

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
    { abbr: 'TMN', start: '2026-09-07', end: '2026-09-25', festivals: 'Khai giảng', note: 'Ghi chú' },
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

const weekdayOf = (iso) => ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7];

test('dời chủ đề sang năm học khác giữ đúng thứ: thứ 2 vẫn thứ 2, thứ 6 vẫn thứ 6 (Tiền 04/11)', () => {
  // 2025-26 → 2026-27, 2026-27 → 2027-28 (qua 29/02/2028), lùi một năm
  const cases = [
    ['2025-09-08', 1, '2026-09-07'],
    ['2025-09-26', 1, '2026-09-25'],
    ['2026-09-07', 1, '2027-09-06'],
    ['2027-02-22', 1, '2028-02-21'],
    ['2027-09-06', -1, '2026-09-07'],
  ];
  for (const [from, n, to] of cases) {
    assert.equal(shiftWeeksForYears(from, n), to, `${from} +${n}`);
    assert.equal(weekdayOf(to), weekdayOf(from));
  }
  assert.equal(shiftWeeksForYears('2026-09-07', 0), '2026-09-07');
  assert.equal(shiftWeeksForYears('', 1), '');
});

test('chuẩn hóa chủ đề trọn tuần: bắt đầu thứ 2, kết thúc thứ 6; thứ 7/chủ nhật sang tuần học gần nhất', () => {
  assert.equal(alignWeekStart('2026-09-09'), '2026-09-07'); // thứ 4 → thứ 2 cùng tuần
  assert.equal(alignWeekStart('2026-09-06'), '2026-09-07'); // chủ nhật → thứ 2 tuần sau
  assert.equal(alignWeekEnd('2026-09-23'), '2026-09-25'); // thứ 4 → thứ 6 cùng tuần
  assert.equal(alignWeekEnd('2026-09-27'), '2026-09-25'); // chủ nhật → thứ 6 vừa qua
  // Ngày theo lịch năm cũ (lệch thứ) dời sang năm mới vẫn ra trọn tuần, giữ số tuần
  const t = themeDates({ start: '2025-09-08', end: '2025-09-26' }, 1);
  assert.deepEqual(t, { start: '2026-09-07', end: '2026-09-25' });
  assert.equal(weekdayOf(t.start), 'T2');
  assert.equal(weekdayOf(t.end), 'T6');
});

test('gợi ý dời ngày: khác năm học ⇒ dời theo tuần về năm học đang soạn và canh thứ 2 – thứ 6; đã đúng ⇒ không gợi ý', () => {
  const range = { start: '2026-09-01', end: '2027-05-31' };
  // Lấy từ kế hoạch 2025-26, giữ nguyên ngày
  assert.deepEqual(suggestThemeDates({ start: '2025-09-08', end: '2025-09-26' }, range), { start: '2026-09-07', end: '2026-09-25' });
  // Gõ tay trong năm học nhưng lệch thứ
  assert.deepEqual(suggestThemeDates({ start: '2026-09-09', end: '2026-09-27' }, range), { start: '2026-09-07', end: '2026-09-25' });
  // Đã trọn tuần trong năm học
  assert.equal(suggestThemeDates({ start: '2026-09-07', end: '2026-09-25' }, range), null);
  assert.equal(suggestThemeDates({ start: '', end: '' }, range), null);
  // Đợt nghỉ: chỉ gợi ý khi khác năm học, giữ ngày lịch
  assert.deepEqual(suggestBreakDates({ start: '2026-02-16', end: '2026-02-20' }, range), { start: '2027-02-16', end: '2027-02-20' });
  assert.equal(suggestBreakDates({ start: '2027-02-08', end: '2027-02-19' }, range), null);
});
