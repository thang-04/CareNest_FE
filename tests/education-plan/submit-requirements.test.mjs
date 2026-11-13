import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionRequirementsIssue } from '../../src/models/education-plan/submitRequirements.mjs';

test('year requires nine topics, dates, and content for every goal', () => {
  const themes = Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `Chủ đề ${i}`, abbr: `C${i}`, start: '2026-09-07', end: '2026-09-18' }));
  const domains = [{ rows: [{ kind: 'group', text: 'Kết quả' }, { kind: 'goal', text: 'Mục tiêu', contents: [{ text: 'Nội dung', themes: [] }] }] }];
  assert.match(submissionRequirementsIssue({ planLevel: 'SCHOOL_YEAR', themes: themes.slice(0, 8), domains }), /Chưa đạt số lượng chủ đề cho phép/);
  assert.equal(submissionRequirementsIssue({ planLevel: 'SCHOOL_YEAR', themes, domains }), null);
  assert.match(submissionRequirementsIssue({ planLevel: 'SCHOOL_YEAR', themes, domains: [{ rows: [...domains[0].rows, { kind: 'goal', text: 'Chưa đủ', contents: [] }] }] }), /Chưa đủ/);
});

test('team requires one ticked content for each goal', () => {
  const themes = [{ id: 't', name: 'Chủ đề', abbr: 'C', start: '2026-09-07', end: '2026-09-18' }];
  const goal = { kind: 'goal', text: 'Mục tiêu', contents: [{ text: 'Nội dung', themes: [] }] };
  assert.match(submissionRequirementsIssue({ planLevel: 'TEAM', themes, domains: [{ rows: [goal] }] }), /Mục tiêu/);
  assert.equal(submissionRequirementsIssue({ planLevel: 'TEAM', themes, domains: [{ rows: [{ ...goal, contents: [{ ...goal.contents[0], themes: ['t'] }] }] }] }), null);
});

test('year requires continuous theme dates without gaps on weekdays', () => {
  const baseThemes = [
    { id: '1', name: 'Chủ đề 1', abbr: 'C1', start: '2026-09-07', end: '2026-09-18' },
    { id: '2', name: 'Chủ đề 2', abbr: 'C2', start: '2026-09-28', end: '2026-10-09' },
    ...Array.from({ length: 7 }, (_, i) => ({ id: String(i + 3), name: `Chủ đề ${i + 3}`, abbr: `C${i + 3}`, start: '2026-10-12', end: '2026-10-23' })),
  ];
  const domains = [{ rows: [{ kind: 'group', text: 'Kết quả' }, { kind: 'goal', text: 'Mục tiêu', contents: [{ text: 'Nội dung', themes: [] }] }] }];
  const issue = submissionRequirementsIssue({ planLevel: 'SCHOOL_YEAR', themes: baseThemes, domains });
  assert.match(issue, /Bị trống ngày chưa tạo chủ đề/);
  assert.match(issue, /21\/09\/2026/);
});
