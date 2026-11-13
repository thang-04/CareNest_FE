import test from 'node:test';
import assert from 'node:assert/strict';
import { branchDateIssues, branchScheduleIssue } from '../../src/models/education-plan/branchTemplateSchedule.mjs';
import * as calendar from '../../src/models/education-plan/goalTable.js';
import { calendarDurationIssue } from '../../src/models/education-plan/branchCalendar.mjs';

const branch = (id, startDate, endDate, themeId = 'parent') => ({ id, themeId, name: id, startDate, endDate });

test('báo thời lượng khi nhập đủ ngày, theo snapshot và bỏ tuần nghỉ trọn', () => {
  const limits = { minWeeks: 2, maxWeeks: 4 };
  assert.match(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-11' }, [], limits, 'Chủ đề'), /2.*4.*1 tuần/);
  assert.equal(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-18' }, [], limits, 'Chủ đề'), null);
  assert.match(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-10-09' }, [], limits, 'Chủ đề'), /5 tuần/);
  assert.match(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-18' }, [{ start: '2026-09-14', end: '2026-09-18' }], limits, 'Chủ đề'), /1 tuần/);
  assert.equal(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-18' }, [{ start: '2026-09-14', end: '2026-09-14' }], limits, 'Chủ đề'), null);
  assert.match(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-18' }, [], { minWeeks: 3, maxWeeks: 5 }, 'Chủ đề'), /3.*5.*2 tuần/);
  assert.equal(calendar.durationRangeIssue({ start: '2026-09-07', end: '' }, [], limits, 'Chủ đề'), null);
  assert.equal(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-11' }, [], null, 'Chủ đề'), null);
  assert.match(calendar.durationRangeIssue({ start: '2026-09-07', end: '2026-09-25' }, [], { minWeeks: 1, maxWeeks: 2 }, 'Nhánh'), /1.*2.*3 tuần/);
});

test('lịch lớp kiểm chủ đề và nhánh bằng snapshot, bỏ qua hồ sơ legacy', () => {
  const plan = { themes: [{ id: 't', name: 'A' }], breaks: [] };
  const doc = { themeSchedules: [{ themeId: 't', startDate: '2026-09-07', endDate: '2026-09-18' }], branches: [{ name: 'B', startDate: '2026-09-07', endDate: '2026-09-25' }], durationPolicySnapshot: { mode: 'BOUNDED', theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } } };
  assert.match(calendarDurationIssue(doc, plan), /Nhánh.*1.*2.*3 tuần/);
  assert.equal(calendarDurationIssue({ ...doc, durationPolicySnapshot: { mode: 'LEGACY_UNBOUNDED' } }, plan), null);
  assert.match(calendarDurationIssue({ ...doc, themeSchedules: [{ themeId: 't', startDate: '2026-09-07', endDate: '2026-09-11' }] }, plan), /Chủ đề.*2.*4.*1 tuần/);
});

test('branch schedule detects weekday errors and inclusive overlap among siblings', () => {
  const a = branch('A', '2026-09-07', '2026-09-18');
  const b = branch('B', '2026-09-14', '2026-09-25');
  assert.match(branchScheduleIssue([a, b]), /trùng/i);
  assert.match(branchDateIssues(a, [a, b])[0], /B/);
  assert.match(branchScheduleIssue([branch('Tue', '2026-09-08', '2026-09-11')]), /Thứ 2/);
  assert.match(branchScheduleIssue([branch('Sat', '2026-09-07', '2026-09-12')]), /Thứ 6/);
  assert.match(branchScheduleIssue([branch('Reverse', '2026-09-21', '2026-09-18')]), /trước/);
});

test('adjacent weeks, different parents and undated drafts are not reported as overlaps', () => {
  assert.equal(
    branchScheduleIssue([
      branch('A', '2026-09-07', '2026-09-11'),
      branch('B', '2026-09-14', '2026-09-18'),
      branch('Other', '2026-09-07', '2026-09-18', 'other-parent'),
      branch('None', '', ''),
      branch('Partial', '2026-09-07', ''),
    ]),
    null,
  );
  assert.match(branchScheduleIssue([branch('A', '2026-09-07', '2026-09-18'), branch('Shared-end', '2026-09-18', '2026-09-25')]), /trùng/i);
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
const pickerSource = await readFile(new URL('../../src/components/education-plan/DatePickerCell.jsx', import.meta.url), 'utf8');
const pickerStubs = `import React,{useState,useRef,useEffect} from ${JSON.stringify(import.meta.resolve('react'))};
const fmtDate=value=>value.split('-').reverse().join('/');
const CalendarDays=()=> <i data-icon="calendar"/>, ChevronLeft=()=>null, ChevronRight=()=>null, FloatingPanel=({children})=>children;`;
const pickerCode = await transformWithOxc(
  pickerStubs + pickerSource.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''),
  'DatePickerCell.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { default: DatePickerCell } = await import(
  'data:text/javascript;base64,' + Buffer.from(pickerCode.code + '\n//# sourceURL=CompactDatePickerCell.js').toString('base64')
);
test('compact date picker shows a four-digit year or dd/mm/yyyy placeholder, without changing default pickers', () => {
  const render = (props) => renderToStaticMarkup(React.createElement(DatePickerCell, { label: 'Ngày', onChange() {}, ...props }));
  assert.match(render({ compact: true, value: '2026-09-07' }), />07\/09\/2026</);
  assert.match(render({ compact: true }), /dd\/mm\/yyyy/);
  assert.doesNotMatch(render({ compact: true }), /data-icon|Chọn ngày/);
  assert.match(render({ value: '2026-09-07' }), />07\/09\/2026</);
  assert.match(render({}), /Chọn ngày/);
});
