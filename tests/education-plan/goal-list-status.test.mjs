import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../../src/pages/education-plan/GoalListPage.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const stubs = `
import React, {useEffect, useMemo, useState} from 'react';
import {planLevel, planLevel as levelOf, planRoute, inheritAnnual} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
import {currentPlanInYear, currentPlanOf, versionOf} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planVersions.mjs'))};
import {isReviewTurn} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/reviewTurn.mjs'))};
import {sameSchoolYearId} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/schoolYearScope.mjs'))};
export const context={goals:[],schoolYear:'2026',schoolYearId:1,yearOption:{id:1,status:'ACTIVE'},role:'vp',user:{id:'test'},classes:[]};
const useGoalDetails=()=>({loading:false});const useEducationPlan=()=>context, useNavigate=()=>()=>{};
const ROLES={VICE_PRINCIPAL:'vp', PRINCIPAL:'principal', TEAM_LEADER:'leader'}, AGE_GROUPS=[], ageRangeOptions=()=>AGE_GROUPS, ageRangeKey=(g)=>g?.rangeKey, sameAgeRange=(a,b)=>a===b, EDU_STATUS={APPROVED:'APPROVED',SENT:'SENT',PENDING_VP:'PENDING_VP'};
const isEduVicePrincipal=()=>context.role===ROLES.VICE_PRINCIPAL, canEduApprove=()=>true;
const DEFAULT_WORKFLOW_POLICY={schoolYear:{creators:['vp'],reviewers:['principal']},year:{creators:['leader'],reviewers:['vp']}};
const allGoalItems=()=>[], clickableRowProps=()=>({}), fmtDate=(value)=>value || '—';
const Card=({children})=><section>{children}</section>, PageHead=({actions})=><header>{actions}</header>, StatCard=({label,value})=><span data-value={value}>{label}</span>, SearchSubmit=()=>null, EmptyState=()=>null;
const Link=({children,to})=><a href={to}>{children}</a>, Plus=()=>null, RotateCcw=()=>null;
const YearPlanStatusBadge=({status})=><span data-status={status}>{status}</span>;
const VersionBadge=()=> <span className="chip">Phiên bản màu</span>;
const useAsync=(fn)=>{ const r=fn(); return {data:r instanceof Promise ? (context.queue ?? null) : r,loading:false,reload:()=>{}}; }, usePolling=()=>{}, getReviewQueue=async()=>[];
// BE giả của danh sách phân trang + số liệu (edu-list-paging): ẩn bản ban hành có bản ban hành mới hơn cùng năm, nhóm tuổi
const levelGoals=(f)=>(context.goals||[]).filter((g)=>levelOf(g)===f.planLevel);
const isReplaced=(g)=>g.status==='APPROVED'&&(context.goals||[]).some((x)=>x.status==='APPROVED'&&x.ageGroupId===g.ageGroupId&&x.schoolYearId===g.schoolYearId&&x.versionNo>g.versionNo);
const getGoalPage=(u,f)=>{ const items=levelGoals(f).filter((g)=>!f.currentOnly||!isReplaced(g)); return {items:items.slice(f.page*f.size,(f.page+1)*f.size),totalElements:items.length}; };
const getGoalStats=(u,f)=>{ const lv=levelGoals(f); return {total:lv.length,issued:lv.filter((g)=>g.status==='APPROVED'||g.status==='SENT').length,replaced:lv.filter(isReplaced).length,ageGroupIdsWithPlan:[...new Set(lv.map((g)=>g.ageGroupId))]}; };
const submitEntryOf=(d)=>[...(d?.history||[])].reverse().find((h)=>h.code==='SUBMIT'||h.action==='submit')||null;
const paginate=(items,page,size)=>items.slice((page-1)*size,page*size), Pagination=()=>null;
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
  schoolYearId: 1,
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
    plan('other-year', 8, 'APPROVED', { schoolYear: '2025', schoolYearId: 2 }),
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
    const year = (status, preparing = false) => ({ id: 1, label: '2026 - 2027', status, preparing });
    context.yearOption = year('ACTIVE');
    assert.match(html(), /school-year-plans\/new/);
    context.yearOption = year('PLANNED', true);
    assert.match(html(), /school-year-plans\/new/);
    context.yearOption = year('PLANNED');
    assert.doesNotMatch(html(), /school-year-plans\/new/);
    context.yearOption = year('CLOSED');
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

test('EDU-93: thẻ "Chờ bạn duyệt" chỉ đếm hồ sơ đúng lượt, bỏ hồ sơ của bước khác trong hàng chờ', () => {
  const previous = { ...context };
  try {
    context.role = 'vp';
    context.queue = [
      plan('dung-luot', 1, 'REVIEW', { planLevel: 'TEAM', permissions: { canApprove: true } }),
      plan('buoc-khac', 1, 'REVIEW', { planLevel: 'TEAM', permissions: { canApprove: false, canReturn: false } }),
      plan('du-lieu-cu', 1, 'REVIEW', { planLevel: 'TEAM' }),
    ];
    const html = renderToStaticMarkup(React.createElement(GoalListPage, { planLevel: 'TEAM' }));
    assert.match(html, /data-value="2">Chờ bạn duyệt</);
  } finally {
    Object.keys(context).forEach((key) => delete context[key]);
    Object.assign(context, previous);
  }
});

const queueSource = await readFile(new URL('../../src/pages/education-plan/PlanReviewQueuePage.jsx', import.meta.url), 'utf8');
// Trang gọi như hàm thường (không render React): hook trạng thái bộ lọc thay bằng giá trị ban đầu
const queueStubs =
  stubs
    .replace(
      "import React, {useEffect, useMemo, useState} from 'react';",
      "import React, {useEffect, useMemo} from 'react'; const useState=(v)=>[typeof v==='function'?v():v,()=>{}], useId=()=>'q';",
    )
    .replace('useNavigate=()=>()=>{}', 'useNavigate=()=>to=>context.destination=to')
    .replace('clickableRowProps=()=>({})', 'clickableRowProps=(onClick)=>({onClick})')
    // edu-list-paging: lần gọi thứ nhất = hàng chờ năm/tổ, thứ hai = trang tài liệu lớp chờ duyệt từ BE
    .replace(
      "const useAsync=(fn)=>{ const r=fn(); return {data:r instanceof Promise ? (context.queue ?? null) : r,loading:false,reload:()=>{}}; }",
      "let asyncCall=0; const useAsync=()=>{ const docs=[...(context.semesterPackages||[]),...(context.themeDossiers||[])].filter((d)=>d.status==='REVIEW'); return asyncCall++%2===0 ? {data:context.queue ?? context.goals ?? null,loading:false,reload:()=>{}} : {data:{items:docs,total:docs.length},loading:false,reload:()=>{}}; }",
    ) +
  `
const LoadingState=()=>null, getClassDocSummaries=async()=>({items:[],totalElements:0});
import { mixedPage } from ${JSON.stringify(new URL('../../src/models/education-plan/classDocSummary.mjs', import.meta.url).href)};
const EduStatusBadge=YearPlanStatusBadge, fmtDateTime=(value)=>value, DeadlineBadge=()=>null, Eye=()=>null, FilterText=()=>null;
const PENDING_OF={}, CLASS_DOC_LABELS={year:'Kế hoạch tổ', branch:'Nhánh', theme:'Chủ đề'};
const themeNumber=()=>1, themeWeeksOf=()=>[];
import { isChainReviewer } from ${JSON.stringify(new URL('../../src/models/education-plan/reviewTurn.mjs', import.meta.url).href)};
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

test('EDU-93: hàng chờ hiện hồ sơ cho người duyệt bước khác (nút Xem) và mở trang xem giáo án ngày của chủ đề', () => {
  const dossier = (id, permissions) => ({
    id,
    classId: 'c1',
    themeId: 't1',
    yearPlanId: 'y1',
    status: 'REVIEW',
    review: { roles: ['leader', 'vp'], waitingRole: 'leader' },
    permissions,
  });
  Object.assign(queueContext, {
    user: { role: 'vp' },
    queue: [],
    goals: [],
    branchPlans: [],
    classThemePlans: [],
    classes: [{ id: 'c1', name: 'Lớp Lá 1', ageGroupId: 4 }],
    semesterPackages: [{ id: 'sp1', classId: 'c1', themeIds: ['t1'], semesterNo: 2, status: 'APPROVED', permissions: {} }],
    themeDossiers: [dossier('ds-other-step', { canApprove: false, canReturn: false })],
  });
  try {
    const tree = PlanReviewQueuePage();
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Kế hoạch giáo dục ngày/);
    assert.match(html, />\s*Xem<\/button>/);
    assert.doesNotMatch(html, /Mở duyệt/);
    const nodes = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]);
    nodes(tree)
      .find((node) => node.type === 'tr' && node.props.onClick)
      .props.onClick();
    assert.equal(queueContext.destination, '/education/day-plans/c1?theme=t1&plan=y1&review=1');

    queueContext.themeDossiers = [dossier('ds-my-turn', { canApprove: true, canReturn: true })];
    assert.match(renderToStaticMarkup(PlanReviewQueuePage()), /Mở duyệt/);
  } finally {
    for (const key of ['queue', 'classes', 'semesterPackages', 'themeDossiers']) delete queueContext[key];
  }
});
