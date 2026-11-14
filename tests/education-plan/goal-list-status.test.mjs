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
import {planLevel, planLevel as levelOf, planRoute, inheritAnnual} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
import {currentPlanOf, versionOf} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planVersions.mjs'))};
export const context={goals:[],schoolYear:'2026',role:'vp',user:{id:'test'},classes:[]};
const useGoalDetails=()=>({loading:false});const useSchoolYear=()=>({schoolYears:context.schoolYears||[]});const useEducationPlan=()=>context, useNavigate=()=>()=>{};
const ROLES={VICE_PRINCIPAL:'vp', PRINCIPAL:'principal', TEAM_LEADER:'leader'}, AGE_GROUPS=[], EDU_STATUS={APPROVED:'APPROVED',SENT:'SENT',PENDING_VP:'PENDING_VP'};
const allGoalItems=()=>[], clickableRowProps=()=>({}), fmtDate=(value)=>value || '—';
const Card=({children})=><section>{children}</section>, PageHead=({actions})=><header>{actions}</header>, StatCard=({label})=><span>{label}</span>, SearchSubmit=()=>null, EmptyState=()=>null;
const Link=({children,to})=><a href={to}>{children}</a>, Plus=()=>null, RotateCcw=()=>null;
const YearPlanStatusBadge=({status})=><span data-status={status}>{status}</span>;
const VersionBadge=()=> <span className="chip">Phiên bản màu</span>;
const useAsync=()=>({data:context.queue ?? context.goals ?? null,loading:false,reload:()=>{}}), usePolling=()=>{}, getReviewQueue=async()=>[];
const submitEntryOf=(d)=>[...(d?.history||[])].reverse().find((h)=>h.code==='SUBMIT'||h.action==='submit')||null;
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

test('hiệu trưởng thấy đúng danh sách BE trả (BE chỉ trả bản đã ban hành — spec 002 FR-007), bản cũ là thay thế', () => {
  const previous = { ...context };
  try {
    context.role = 'principal';
    for (const level of ['SCHOOL_YEAR', 'TEAM']) {
      context.goals = [
        plan('cu', 1, 'APPROVED', { planLevel: level, current: false, permissions: {} }),
        plan('moi', 2, 'APPROVED', { planLevel: level, current: true, permissions: {} }),
      ];
      const html = renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: level }));
      // Tiền 12/11/2026: bản thay thế gom vào "Hiện phiên bản cũ", danh sách mặc định chỉ còn bản đang dùng
      assert.doesNotMatch(html, />cu</);
      assert.match(html, />moi</);
      assert.match(html, /Hiện phiên bản cũ \(1\)/);
    }
  } finally {
    Object.keys(context).forEach((key) => delete context[key]);
    Object.assign(context, previous);
  }
});

test('TEAM giữ trạng thái nhưng ẩn phiên bản và chỉ hiện năm cột', () => {
  const html = render([plan('v1', 1), plan('v2', 2), plan('v3', 3, 'EDITING')]);
  assert.equal((html.match(/data-status="REPLACED"/g) || []).length, 0);
  assert.match(html, /Hiện phiên bản cũ \(1\)/);
  assert.equal((html.match(/data-status="APPROVED"/g) || []).length, 1);
  assert.match(html, /data-status="EDITING"/);
  assert.doesNotMatch(html, /Phiên bản/);
  assert.equal((html.match(/<th[ >]/g) || []).length, 5);
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
  const goals = [plan('v1', 1), plan('v4', 4, 'APPROVED', { current: true }), plan('v5', 5, 'EDITING')].map((p) => ({
    ...p,
    planLevel: 'SCHOOL_YEAR',
  }));
  const html = renderToStaticMarkup(React.createElement(YearPlanVersionPanel, { plan: goals[1], goals }));
  assert.doesNotMatch(html, /KHNH-|<th>Mã<\/th>|hiện hành|đã thay thế|đang soạn/);
  assert.match(html, /href="\/education\/school-year-plans\/v1"><span class="text-xs text-primary">Phiên bản 1/);
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
test('EDU-89: chỉ lập kế hoạch khi năm đang hoạt động hoặc đã tới ngày mở chuẩn bị', () => {
  const previous = { ...context };
  const html = () => renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'SCHOOL_YEAR' }));
  try {
    context.goals = [];
    context.role = 'vp';
    context.schoolYear = '2026-2027';
    const year = (status, preparing = false) => [{ id: 1, label: '2026 - 2027', status, preparing }];
    context.schoolYears = year('ACTIVE');
    assert.match(html(), /school-year-plans\/new/);
    context.schoolYears = year('PLANNED', true);
    assert.match(html(), /school-year-plans\/new/);
    context.schoolYears = year('PLANNED');
    assert.doesNotMatch(html(), /school-year-plans\/new/);
    context.schoolYears = year('CLOSED');
    assert.doesNotMatch(html(), /school-year-plans\/new/);
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

test('TEAM ngày gửi ưu tiên sentAt, tương thích sentBy.at và chưa gửi không dùng ngày tạo', () => {
  const html = render([
    plan('new-date', 1, 'DRAFT', { sentAt: '2026-11-09', sentBy: { at: '2026-11-08' } }),
    plan('old-date', 1, 'DRAFT', { sentBy: { at: '2026-11-07' } }),
    plan('never-sent', 1, 'DRAFT', { createdAt: '2026-11-06' }),
  ]);
  assert.match(html, /2026-11-09/);
  assert.match(html, /2026-11-07/);
  assert.doesNotMatch(html, /2026-11-08|2026-11-06/);
  assert.match(html, /<td>—<\/td>/);
});

const queueSource = await readFile(new URL('../../src/pages/education-plan/PlanReviewQueuePage.jsx', import.meta.url), 'utf8');
// Trang gọi như hàm thường (không render React): hook trạng thái bộ lọc thay bằng giá trị ban đầu
const queueStubs =
  stubs
    .replace(
      "import React, {useMemo, useState} from 'react';",
      "import React, {useMemo} from 'react'; const useState=(v)=>[typeof v==='function'?v():v,()=>{}], useId=()=>'q';",
    )
    .replace('useNavigate=()=>()=>{}', 'useNavigate=()=>to=>context.destination=to')
    .replace('clickableRowProps=()=>({})', 'clickableRowProps=(onClick)=>({onClick})') +
  `
const EduStatusBadge=YearPlanStatusBadge, fmtDateTime=(value)=>value, DeadlineBadge=()=>null, Eye=()=>null, FilterText=()=>null;
const PENDING_OF={}, CLASS_DOC_LABELS={year:'Kế hoạch tổ', branch:'Nhánh', theme:'Chủ đề'};
const themeNumber=()=>1, themeWeeksOf=()=>[];
`;
const queueCode = await transformWithOxc(
  queueStubs + queueSource.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''),
  'PlanReviewQueuePage.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { default: PlanReviewQueuePage, context: queueContext } = await import(
  `data:text/javascript;base64,${Buffer.from(queueCode.code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
test('review queue uses exact annual/TEAM type, own title, sentBy.at fallback and routes for server-authorized team reviewers', () => {
  queueContext.user = { role: 'leader' };
  queueContext.classes = [];
  queueContext.branchPlans = [];
  queueContext.classThemePlans = [];
  queueContext.goals = [
    plan('annual-exact', 2, 'REVIEW', {
      planType: 'SCHOOL_YEAR',
      planLevel: 'TEAM',
      title: 'Tên riêng năm',
      permissions: { canApprove: true },
      sentBy: { name: 'Người gửi năm', at: '2026-11-09' },
    }),
    plan('team-exact', 1, 'REVIEW', {
      planType: 'TEAM',
      title: 'Tên riêng tổ',
      permissions: { canApprove: true },
      sentBy: { name: 'Người gửi tổ', at: '2026-11-08' },
    }),
  ];
  const tree = PlanReviewQueuePage();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Kế hoạch năm học/);
  assert.match(html, /Kế hoạch tổ/);
  assert.match(html, /Tên riêng năm/);
  assert.match(html, /Tên riêng tổ/);
  assert.match(html, /2026-11-09/);
  assert.match(html, /2026-11-08/);
  const nodes = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]);
  const rows = nodes(tree).filter((node) => node.type === 'tr' && node.props.onClick);
  rows[0].props.onClick();
  assert.equal(queueContext.destination, '/education/school-year-plans/annual-exact');
  rows[1].props.onClick();
  assert.equal(queueContext.destination, '/education/goals/team-exact');
});
