import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../../src/pages/education-plan/GoalListPage.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const stubs = `
import React, {useMemo, useState} from 'react';
import {planLevel as levelOf, planRoute, inheritAnnual} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
import {currentPlanOf, versionOf} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planVersions.mjs'))};
export const context={goals:[],schoolYear:'2026',role:'vp',user:{id:'test'},classes:[]};
const useEducationPlan=()=>context, useNavigate=()=>()=>{};
const ROLES={VICE_PRINCIPAL:'vp', PRINCIPAL:'principal', TEAM_LEADER:'leader'}, AGE_GROUPS=[], EDU_STATUS={APPROVED:'APPROVED',SENT:'SENT',PENDING_VP:'PENDING_VP'};
const allGoalItems=()=>[], clickableRowProps=()=>({}), fmtDate=()=>'';
const Card=({children})=><section>{children}</section>, PageHead=({actions})=><header>{actions}</header>, StatCard=({label})=><span>{label}</span>, SearchSubmit=()=>null, EmptyState=()=>null;
const Link=({children,to})=><a href={to}>{children}</a>, Plus=()=>null, RotateCcw=()=>null;
const YearPlanStatusBadge=({status})=><span data-status={status}>{status}</span>;
const VersionBadge=()=> <span className="chip">Phiên bản màu</span>;
`;
const { code } = await transformWithOxc(stubs + isolated, 'GoalListPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { default: GoalListPage, context } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const plan = (id, versionNo, status = 'APPROVED', extra = {}) => ({
  id,
  versionNo,
  status,
  title: id,
  code: `KHNH-${id}`,
  ageGroupId: 'ag-2',
  schoolYear: '2026',
  ...extra,
});
const render = (goals) => {
  context.goals = goals;
  return renderToStaticMarkup(React.createElement(GoalListPage));
};

test('thẻ thống kê phân biệt kế hoạch giáo dục tổ và kế hoạch năm học', () => {
  context.goals = [];
  const team = renderToStaticMarkup(React.createElement(GoalListPage));
  const annual = renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'SCHOOL_YEAR' }));
  assert.match(team, /Kế hoạch giáo dục tổ/);
  assert.doesNotMatch(team, /Kế hoạch trong năm học/);
  assert.match(annual, /Kế hoạch trong năm học/);
});

test('hiệu trưởng chỉ xem kế hoạch đã ban hành hoặc thay thế ở danh sách năm và tổ', () => {
  const previous = { ...context };
  try {
    context.role = 'principal';
    for (const level of ['SCHOOL_YEAR', 'TEAM']) {
      context.goals = [
        plan('cu', 1, 'APPROVED', { planLevel: level, current: false, permissions: {} }),
        plan('moi', 2, 'APPROVED', { planLevel: level, current: true, permissions: {} }),
        plan('cho-duyet', 3, 'REVIEW', { planLevel: level, permissions: {} }),
        plan('nhap', 4, 'DRAFT', { planLevel: level, permissions: {} }),
      ];
      const html = renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: level }));
      assert.match(html, />cu</);
      assert.match(html, />moi</);
      assert.match(html, /data-status="REPLACED"/);
      assert.doesNotMatch(html, />cho-duyet<|>nhap</);
    }
  } finally {
    Object.keys(context).forEach((key) => delete context[key]);
    Object.assign(context, previous);
  }
});

test('bản cũ đã thay thế, bản ban hành mới nhất và bản đang sửa giữ đúng nhãn; phiên bản là chữ nhỏ', () => {
  const html = render([plan('v1', 1), plan('v2', 2), plan('v3', 3, 'EDITING')]);
  assert.equal((html.match(/data-status="REPLACED"/g) || []).length, 1);
  assert.equal((html.match(/data-status="APPROVED"/g) || []).length, 1);
  assert.match(html, /data-status="EDITING"/);
  for (const n of [1, 2, 3]) assert.match(html, new RegExp(`class="text-xs text-primary">Phiên bản ${n}</div>`));
  assert.doesNotMatch(html, /KHNH-|Phiên bản màu|hiện hành|đang soạn/);
});

test('ưu tiên current của BE khi bản hiện hành không nằm trong danh sách; không lẫn nhóm/năm', () => {
  let html = render([plan('old', 4, 'APPROVED', { current: false })]);
  assert.match(html, /data-status="REPLACED"/);
  html = render([
    plan('current', 4, 'APPROVED', { current: true }),
    plan('other-age', 9, 'APPROVED', { ageGroupId: 'ag-5' }),
    plan('other-year', 8, 'APPROVED', { schoolYear: '2025' }),
  ]);
  assert.doesNotMatch(html, /data-status="REPLACED"/);
});

const widgetSource = await readFile(new URL('../../src/components/education-plan/VersionWidgets.jsx', import.meta.url), 'utf8');
const widgetStubs =
  stubs +
  `
import {CHANGE, chainOf} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planVersions.mjs'))};
const usePlanChanges=()=>({data:null,loading:false,error:null}), Notice=()=>null;
const StatusBadge=({label})=><span className="chip">{label}</span>;
`;
const widgetCode = await transformWithOxc(
  widgetStubs.replace('const VersionBadge=()=> <span className="chip">Phiên bản màu</span>;', '') +
    widgetSource.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''),
  'VersionWidgets.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { YearPlanVersionPanel } = await import(
  `data:text/javascript;base64,${Buffer.from(widgetCode.code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

test('bảng phiên bản chi tiết bỏ mã, giữ liên kết ở số phiên bản xanh và phân biệt trạng thái', () => {
  const goals = [plan('v1', 1), plan('v4', 4, 'APPROVED', { current: true }), plan('v5', 5, 'EDITING')];
  const html = renderToStaticMarkup(React.createElement(YearPlanVersionPanel, { plan: goals[1], goals }));
  assert.doesNotMatch(html, /KHNH-|<th>Mã<\/th>|hiện hành|đã thay thế|đang soạn/);
  assert.match(html, /href="\/education\/goals\/v1"><span class="text-xs text-primary">Phiên bản 1/);
  assert.match(html, /class="text-xs text-primary">Phiên bản 4/);
  assert.equal((html.match(/data-status="REPLACED"/g) || []).length, 1);
  assert.equal((html.match(/data-status="APPROVED"/g) || []).length, 1);
  assert.match(html, /data-status="EDITING"/);
});

test('PHT sees annual create button even when duration API is unavailable; TEAM creator scopes do not hide it', () => {
  const previous = { ...context };
  try {
    context.goals = [];
    context.role = 'vp';
    context.eduConfig = { durationPolicyAvailable: false, yearCreationScopes: [] };
    const html = renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'SCHOOL_YEAR' }));
    assert.match(html, /href="\/education\/school-year-plans\/new"/);
    assert.match(html, /Lập kế hoạch năm học/);
    context.role = 'teacher';
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'SCHOOL_YEAR' })), /school-year-plans\/new/);
  } finally {
    Object.keys(context).forEach((key) => delete context[key]);
    Object.assign(context, previous);
  }
});
test('explicit empty annual creation scopes from server remain authoritative', () => {
  const previous = { ...context };
  try {
    context.goals = [];
    context.role = 'vp';
    context.eduConfig = { schoolYearCreationScopes: [] };
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'SCHOOL_YEAR' })), /school-year-plans\/new/);
  } finally {
    Object.keys(context).forEach((key) => delete context[key]);
    Object.assign(context, previous);
  }
});
