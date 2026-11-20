import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { lockedYearMessage, lockedYearOf } from '@/utils/schoolYearPrep';

/*
 * Thông báo năm sắp diễn ra chưa tới ngày mở chuẩn bị (BE G94-180/CHD-12): màn trẻ, sức khỏe, đón trẻ chỉ xem.
 * Header (useSchoolYear) giả; hàm xét năm bị khóa và câu báo dùng bản thật.
 */
globalThis.yearPrep = { lockedYearOf, lockedYearMessage };
const source = await readFile(new URL('../../src/components/children/YearLockedNotice.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const Info=()=>null;
const useSchoolYear=()=>globalThis.yearCtx;
const {lockedYearOf,lockedYearMessage}=globalThis.yearPrep;
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'YearLockedNotice.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { YearLockedNotice } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);

const years = [
  { id: '2026-2027', label: '2026 - 2027', status: 'ACTIVE', preparing: false, prepDate: '2026-07-15' },
  { id: '2027-2028', label: '2027 - 2028', status: 'PLANNED', preparing: false, prepDate: '2027-07-15' },
  { id: '2028-2029', label: '2028 - 2029', status: 'PLANNED', preparing: true, prepDate: '2028-07-15' },
];
const render = (schoolYear, props = {}) => {
  globalThis.yearCtx = { schoolYear, schoolYears: years };
  return renderToStaticMarkup(YearLockedNotice(props) ?? '');
};

test('năm sắp diễn ra chưa tới ngày mở chuẩn bị ⇒ báo chỉ xem kèm việc bị khóa', () => {
  const html = render('2027-2028', { action: 'Sửa hồ sơ' });
  assert.match(html, /Năm học 2027 - 2028 mở chuẩn bị từ 15\/07\/2027 – chỉ xem\./);
  assert.match(html, /Sửa hồ sơ: làm được từ ngày mở chuẩn bị\./);
});

test('không truyền việc ⇒ chỉ câu chỉ xem', () => {
  const html = render('2027-2028');
  assert.match(html, /mở chuẩn bị từ 15\/07\/2027 – chỉ xem\./);
  assert.doesNotMatch(html, /làm được từ ngày/);
});

test('năm đang hoạt động hoặc năm đã tới ngày mở chuẩn bị ⇒ không báo', () => {
  assert.equal(render('2026-2027', { action: 'Sửa hồ sơ' }), '');
  assert.equal(render('2028-2029', { action: 'Sửa hồ sơ' }), '');
});
