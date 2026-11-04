import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE_THEME_COLUMNS, goalTemplateFile, yearPlanHtml } from '../../src/utils/education-plan/yearPlanDoc.js';

const plan = {
  schoolYear: '2026 - 2027',
  ageGroupId: 'ag-3',
  title: 'KH',
  themes: [{ id: 't1', name: 'Trường mầm non', abbr: 'MN', start: '2026-09-07', end: '2026-09-25' }],
  breaks: [],
  domains: [
    {
      name: 'Phát triển thể chất',
      rows: [
        { id: 's1', kind: 'sub', text: 'Phát triển vận động', contents: [] },
        { id: 'g1', kind: 'goal', text: 'Trẻ bò', contents: [{ id: 'c1', text: 'Bò thẳng', themes: ['t1'] }] },
      ],
    },
  ],
};
const tableA = (html) => html.slice(html.indexOf('A. MỤC TIÊU'), html.indexOf('B. DỰ KIẾN'));

test('template keeps only the fixed parts of the school layout: header, dotted year/age, both tables, Tổng, signing place', () => {
  const { html, name } = goalTemplateFile();
  for (const text of [
    'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    'KẾ HOẠCH GIÁO DỤC NĂM HỌC ……',
    'KHỐI ……',
    'Chủ đề thực hiện',
    'B. DỰ KIẾN KẾ HOẠCH CHỦ ĐỀ, SỰ KIỆN NĂM HỌC',
    'Ngày lễ hội',
    'Tổng',
    'Người xây dựng kế hoạch',
    'I. Giáo dục phát triển thể chất',
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('landscape'));
  assert.equal(name, 'Mẫu kế hoạch giáo dục năm học');
  assert.equal(tableA(html).match(/<th class="abbr/g).length, TEMPLATE_THEME_COLUMNS);
  assert.ok(!/\d{4} - \d{4}/.test(html), 'no school year filled in');
});

test('no cell spans columns in the goal table so every vertical line runs to the end (export and template)', () => {
  for (const html of [yearPlanHtml(plan, { g1: 1 }), goalTemplateFile().html]) {
    const body = tableA(html).split('<tbody>')[1];
    assert.ok(!/colspan/.test(body), 'colspan in body');
  }
  assert.match(tableA(yearPlanHtml(plan, { g1: 1 })), /<td class="c"><b>Tổng<\/b><\/td><td><\/td><td><\/td><td class="tick">1<\/td>/);
});

test('template and export have no nested table so the BE file reader (EDU-46) can read them back', () => {
  for (const html of [goalTemplateFile().html, yearPlanHtml(plan, { g1: 1 })]) {
    let depth = 0;
    let max = 0;
    for (const m of html.matchAll(/<(\/?)table\b/g)) {
      depth += m[1] ? -1 : 1;
      max = Math.max(max, depth);
    }
    assert.equal(depth, 0);
    assert.equal(max, 1);
  }
});
