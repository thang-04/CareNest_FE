import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../../src/pages/education-plan/GoalFormPage.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const stubs = `
import React, {useEffect, useRef, useState} from 'react';
import {planLevel as levelOf, planRoute, inheritAnnual} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
import {branchScheduleIssue} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/branchTemplateSchedule.mjs'))};
const BranchTemplateEditor=()=>null;
const TeamSourceReview=()=>null;
const YearPlanSourceCard=({plan,source,children})=><section className="ga-plan-section--source" data-source-id={plan.curriculumSourcePlanId} data-source-title={source?.title}>{children}</section>;

const RowMenu=({label,text,items})=><div data-import-menu={label}><button>{text}</button>{items.map(item=><button key={item.label} disabled={item.disabled}>{item.label}</button>)}</div>;
const useParams=()=>({id:formContext.editId}), useLocation=()=>({state:null,search:''}), useSearchParams=()=>[new URLSearchParams()], useNavigate=()=>()=>{};
const useSchoolYear=()=>({schoolYears:[]}), useMediaQuery=()=>false;
const ROLE_LABELS={};
const ROLES={VICE_PRINCIPAL:'vp',TEAM_LEADER:'leader'}, AGE_GROUPS=[{id:'ag-5',name:'Mẫu giáo lớn (5–6 tuổi)'},{id:'ag-4',name:'Mẫu giáo nhỡ (4–5 tuổi)'}], DOMAINS=[], SCHOOL_SCOPE='Toàn trường', EDU_STATUS={EDITING:'EDITING',DRAFT:'DRAFT',PENDING_VP:'PENDING_VP'}, EDU_ERROR_CODE={};
export const formContext={goals:[],user:{id:'test',name:'Người soạn',role:'vp'}};
const useEducationPlan=()=>({...formContext,schoolYear:'2026 – 2027',staff:[]});
const useYearPlanAutosave=()=>({label:'Đã lưu',drafts:[],saved:()=>null}), useLeaveGuard=()=>({modal:{}});
const goalIdsToTicks=(domains,themes)=>({domains,themes});
const numberGoals=()=>({}), themeScheduleIssue=()=>'', isBlankTheme=()=>false, isBlankBreak=()=>false;
const Card=({title,num,actions,children,className})=><section className={className}><h2>{num}. {title}</h2>{actions}{children}</section>;
const PageHead=({actions})=><header>{actions}</header>, Field=({label,children})=><label>{label}{children}</label>, Notice=({children})=><p>{children}</p>;
const GoalTable=({fixedCells,readOnly,canAssignContents})=> <div data-table="goals" data-fixed={fixedCells} data-locked={readOnly} data-assign={canAssignContents}/>, ThemeEventTable=({fixedFields,readOnly})=> <div data-table="themes" data-fixed={fixedFields} data-locked={readOnly}/>;
const PlanTabs=()=> <div role="tablist"/>, Stepper=()=> <nav data-stepper="true"/>;
const Download=()=>null, FileDown=()=>null, Save=()=>null, Upload=()=>null, ArrowLeft=()=>null, ArrowRight=()=>null;
const ReviewActions=()=>null, VersionHistory=()=> <button data-history="true"/>, yearPlanLines=()=>[], LeaveConfirmModal=()=>null, fmtDate=(v)=>v;
const Link=({to,children})=><a href={to}>{children}</a>;
`;
const { code } = await transformWithOxc(stubs + isolated, 'GoalFormPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const {
  default: GoalFormPage,
  formContext,
  focusYearPlanIssue,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

test('mục tiêu năm hiển thị nhập dữ liệu, thông tin, chủ đề và mục tiêu trên cùng trang', () => {
  const html = renderToStaticMarkup(React.createElement(GoalFormPage));
  const common = html.indexOf('1. Thông tin chung');
  const themes = html.indexOf('3. Dự kiến chủ đề, sự kiện trong năm');
  const goals = html.indexOf('2. Mục tiêu nội dung giáo dục cuối độ tuổi');
  assert.doesNotMatch(html, /Nhập file|Lấy từ kế hoạch (?:giáo dục )?tổ|Lấy từ Chương trình của Bộ/);
  assert.ok(common < goals && goals < themes);
  assert.match(html, /data-table="themes"/);
  assert.match(html, /data-table="goals"/);
  assert.doesNotMatch(html, /tablist|data-stepper|Duyệt lại nội dung|Tiếp theo|page-actions|>Đóng</);
});

test('lập mới khóa nhóm đã có kế hoạch trong cùng năm, kể cả bản nháp; tổ trưởng cố định nhóm được phân công', () => {
  const user = formContext.user;
  try {
    for (const status of ['DRAFT', 'PENDING_VP', 'APPROVED']) {
      formContext.goals = [{ id: 'other', schoolYear: '2026 – 2027', ageGroupId: 'ag-5', status }];
      const html = renderToStaticMarkup(React.createElement(GoalFormPage));
      assert.match(html, /<option value="ag-5" disabled="">[^<]*Đã có kế hoạch/);
      assert.doesNotMatch(html, /<option value="ag-4" disabled/);
    }
    formContext.goals = [{ id: 'old', schoolYear: '2025 – 2026', ageGroupId: 'ag-5', status: 'DRAFT' }];
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(GoalFormPage)), /<option value="ag-5" disabled/);
    formContext.user = { ...user, role: 'leader', ageGroupId: 'ag-5' };
    assert.match(renderToStaticMarkup(React.createElement(GoalFormPage)), /<select id="ag"[^>]*disabled=""/);
  } finally {
    formContext.goals = [];
    formContext.user = user;
  }
});

test('thông tin chung nhập trong bảng và các nút dùng cùng kiểu trên một thanh', () => {
  const html = renderToStaticMarkup(React.createElement(GoalFormPage));
  assert.match(html, /<table[^>]*aria-label="Thông tin chung"/);
  assert.match(html, /ga-year-info ga-info-team/);
  assert.match(html, /<th[^>]*scope="row"/);
  assert.match(html, /class="ga-year-toolbar"/);
  assert.doesNotMatch(html, /btn--ghost|btn--primary btn--sm/);
  assert.match(html, /id="ag"/);
  assert.match(html, /id="title"/);
  assert.match(html, /<div class="ga-year-title-field"><input id="title" type="text"/);
  assert.doesNotMatch(html, /<textarea id="title"/);

  assert.match(html, /id="desc"/);
  assert.doesNotMatch(html, /class="ga-year-toolbar__group">/);
  const right = html.match(/class="ga-year-toolbar__group ga-year-toolbar__group--end">([\s\S]*?)<\/div>/)[1];
  assert.doesNotMatch(right, /Nhập file/);
  assert.ok(right.indexOf('Lưu') < right.indexOf('Xuất file'));
  assert.match(right, /ga-year-save-status/);
  assert.ok(right.indexOf('ga-year-save-status') < right.indexOf('title="Lưu'));
  assert.doesNotMatch(html, /Thoát/);
});

const detailSource = await readFile(new URL('../../src/pages/education-plan/GoalDetailPage.jsx', import.meta.url), 'utf8');
const detailStubs = `
import React, {useState} from 'react';
import {planLevel as levelOf, planRoute} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
const BranchTemplateEditor=()=>null;
const TeamSourceReview=()=>null;
const useParams=()=>({id:'test'}), useNavigate=()=>()=>{}, useLocation=()=>({state:null});
const ROLE_LABELS={};
const YearPlanSourceCard=({plan,source,children})=><section className="ga-plan-section--source" data-source-id={plan.curriculumSourcePlanId} data-source-title={source?.title}>{children}</section>;
const ROLES={VICE_PRINCIPAL:'vp'}, AGE_GROUPS=[], DOMAINS=[], SCHOOL_SCOPE='Toàn trường', EDU_STATUS={DRAFT:'DRAFT',EDITING:'EDITING',APPROVED:'APPROVED'};
const useEducationPlan=()=>({goals:[{id:'test',title:'Kế hoạch thử',status:'DRAFT',domains:[],themes:[],permissions:{canEdit:true}}],themes:[],user:{id:'vp',role:'vp'},staff:[]});
const goalIdsToTicks=(domains,themes)=>({domains,themes}), numberGoals=()=>({}), chainOf=()=>[], currentPlanOf=()=>null;
const Card=({title,num,children})=><section><h2>{num}. {title}</h2>{children}</section>;
const PageHead=({actions})=><header>{actions}</header>, VersionBadge=()=>null, YearPlanVersionPanel=()=>null, ReviewHistory=()=>null, ReviewActions=()=>null, RejectedNotice=()=>null;
const GoalTable=()=> <div data-table="goals"/>, ThemeEventTable=()=> <div data-table="themes"/>, PlanTabs=()=> <div role="tablist"/>;
const Copy=()=>null, FileDown=()=>null, Pencil=()=>null, Trash2=()=>null, ArrowLeft=()=>null, fmtDate=()=> '—';
const Link=({to,children,...props})=><a href={to} data-back-to={props.state?.backTo} data-replace={props.replace ? 'true' : 'false'} className={props.className}>{children}</a>;
`;
const detailCode = await transformWithOxc(
  detailStubs + detailSource.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''),
  'GoalDetailPage.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { default: GoalDetailPage } = await import(
  `data:text/javascript;base64,${Buffer.from(detailCode.code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

test('chi tiết có cùng thứ tự phần với form, không tab và liên kết sửa mang đích thoát về danh sách', () => {
  const html = renderToStaticMarkup(React.createElement(GoalDetailPage));
  assert.doesNotMatch(html, /tablist/);
  assert.ok(html.indexOf('1. Thông tin chung') < html.indexOf('2. Mục tiêu nội dung giáo dục cuối độ tuổi'));
  assert.ok(html.indexOf('2. Mục tiêu nội dung giáo dục cuối độ tuổi') < html.indexOf('3. Dự kiến chủ đề, sự kiện trong năm'));
  assert.match(html, /ga-sticky-head/);
  assert.match(html, /href="\/education\/goals\/test\/edit" data-back-to="\/education\/goals"/);
  assert.match(html, /href="\/education\/goals\/test\/edit"[^>]*data-replace="true"/);
  assert.doesNotMatch(html, /Thoát/);
  assert.doesNotMatch(html, /btn--ghost/);
});

test('PHT can open and edit the annual review form before duration API rollout, without pretending save is available', () => {
  const old = formContext.eduConfig;
  try {
    formContext.eduConfig = { durationPolicyAvailable: false, yearCreationScopes: [] };
    const html = renderToStaticMarkup(React.createElement(GoalFormPage, { planLevel: 'SCHOOL_YEAR' }));
    assert.doesNotMatch(html, /<fieldset disabled="" class="ga-edit-fieldset"/);
    assert.match(html, /bản xem trước/);
    assert.match(html, /chưa hỗ trợ lưu và gửi duyệt/);
  } finally {
    formContext.eduConfig = old;
  }
});

test('annual form imports annual plans instead of team plans', () => {
  const html = renderToStaticMarkup(React.createElement(GoalFormPage, { planLevel: 'SCHOOL_YEAR' }));
  assert.match(html, /Lấy kế hoạch năm/);
  assert.doesNotMatch(html, /Lấy từ kế hoạch (?:giáo dục )?tổ/);
  assert.match(html, /Dự kiến chủ đề \/ sự kiện năm học/);
  assert.ok(html.indexOf('2. Mục tiêu nội dung giáo dục cuối độ tuổi') < html.indexOf('3. Dự kiến chủ đề'));
  assert.match(html, /data-table="goals" data-fixed="false" data-locked="false"/);
  assert.doesNotMatch(html, /ga-info-team/);
  assert.match(html, /ga-year-info ga-info-annual/);
  assert.match(html, /id="year"[^>]*readonly=""/);
  assert.match(html, /id="scope"[^>]*readonly=""/);
  assert.match(html, /id="author"[^>]*readonly=""/);
  assert.doesNotMatch(html, /id="title"[^>]*readonly=""/);
  assert.doesNotMatch(html, /id="desc"[^>]*readonly=""/);
});

test('TEAM edit locks all general information and scopes fixed colors to edit tables', () => {
  const old = { ...formContext };
  try {
    formContext.editId = 'team';
    formContext.goals = [
      {
        id: 'team',
        sourceMode: 'INHERITED',
        curriculumSourcePlanId: 'annual',
        schoolYear: '2026 – 2027',
        ageGroupId: 'ag-4',
        status: 'DRAFT',
        title: 'Tổ',
        description: 'Mô tả',
        domains: [],
        themes: [],
        breaks: [],
        branchTemplates: [],
        permissions: { canEdit: true },
      },
    ];
    const html = renderToStaticMarkup(React.createElement(GoalFormPage));
    assert.match(html, /ga-year-info ga-info-team ga-info-fixed/);
    assert.match(html, /id="title"[^>]*readonly=""/);
    assert.match(html, /id="desc"[^>]*readonly=""/);
    assert.match(html, /data-table="goals" data-fixed="true" data-locked="true" data-assign="true"/);
    assert.match(html, /data-table="themes" data-fixed="true" data-locked="true"/);
  } finally {
    Object.keys(formContext).forEach((key) => delete formContext[key]);
    Object.assign(formContext, old);
  }
});

test('annual improvements stay scoped to annual form and preserve all import options', () => {
  const annual = renderToStaticMarkup(React.createElement(GoalFormPage, { planLevel: 'SCHOOL_YEAR' }));
  assert.match(annual, /ga-annual-plan/);
  assert.match(annual, /Lấy \/ nhập nội dung/);
  assert.match(annual, /Lấy kế hoạch năm/);
  assert.match(annual, /Lấy từ Chương trình của Bộ/);
  assert.match(annual, /Nhập file/);
  assert.match(annual, /ga-plan-section--info/);
  assert.match(annual, /ga-plan-section--goals/);
  assert.match(annual, /ga-plan-section--themes/);
  assert.match(annual, /class="btn btn--sm btn--primary"[^>]*title="Lưu/);
  const team = renderToStaticMarkup(React.createElement(GoalFormPage));
  assert.doesNotMatch(team, /ga-annual-plan|data-import-menu=|Lấy \/ nhập nội dung/);
  assert.match(team, /ga-team-plan/);
  assert.doesNotMatch(team, /Lấy từ kế hoạch (?:giáo dục )?tổ|Lấy từ Chương trình của Bộ|Nhập file/);
});

test('error navigation focuses the invalid field or the section heading without a second scroll', () => {
  const events = [];
  const field = { scrollIntoView: (options) => events.push(['scroll', options]), focus: (options) => events.push(['focus', options]) };
  const section = { querySelector: (selector) => (selector === '#title' ? field : null) };
  const root = { querySelector: (selector) => (selector === '.ga-plan-section--info' ? section : null) };
  focusYearPlanIssue(root, { section: 'info', control: 'title' });
  assert.deepEqual(events, [
    ['scroll', { block: 'center' }],
    ['focus', { preventScroll: true }],
  ]);
  events.length = 0;
  const sectionWithHeading = { querySelector: (selector) => (selector === '.ga-card-toggle' ? field : null) };
  focusYearPlanIssue({ querySelector: () => sectionWithHeading }, { section: 'goals', control: null });
  assert.equal(events.length, 2);
  assert.doesNotThrow(() => focusYearPlanIssue(null, { section: 'themes' }));
});

const annualHooks = `
let slots=[], cursor=0;
const useState=initial=>{const index=cursor++; if(!(index in slots)) slots[index]=typeof initial==='function'?initial():initial; return [slots[index], value=>slots[index]=typeof value==='function'?value(slots[index]):value];};
const useRef=initial=>{const index=cursor++; return slots[index] ||= {current:initial};};
const useEffect=()=>{};
export function renderAnnual(planLevel='SCHOOL_YEAR'){cursor=0;return GoalFormPage({planLevel});}
export function disposeAnnual(){slots=[];cursor=0;}
`;
const annualCode = await transformWithOxc(
  stubs.replace("import React, {useEffect, useRef, useState} from 'react';", "import React from 'react';" + annualHooks) + isolated,
  'AnnualControlled.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const annualControlled = await import(
  'data:text/javascript;base64,' +
    Buffer.from(annualCode.code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')
);
const annualNodes = (node) =>
  !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(annualNodes)];

test('annual failed submit provides actionable error links while import actions keep their handlers', () => {
  const previousFrame = globalThis.requestAnimationFrame;
  const events = [];
  globalThis.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  try {
    let tree = annualControlled.renderAnnual();
    const menu = annualNodes(tree).find((node) => node.props.label === 'Lấy và nhập nội dung kế hoạch năm học');
    assert.deepEqual(
      menu.props.items.map((item) => item.label),
      ['Lấy kế hoạch năm', 'Lấy từ Chương trình của Bộ', 'Nhập file'],
    );
    menu.props.items.forEach((item) => assert.equal(typeof item.onClick, 'function'));
    assert.equal(menu.props.items[1].disabled, true);
    const review = annualNodes(tree).find((node) => typeof node.props.beforeOpen === 'function');
    assert.equal(review.props.beforeOpen('submit'), false);
    tree = annualControlled.renderAnnual();
    const summary = annualNodes(tree).find((node) => node.props['aria-label'] === 'Các phần cần kiểm tra');
    assert.ok(summary);
    assert.equal(summary.props.role, 'alert');
    assert.equal(summary.props.tabIndex, -1);
    const target = { scrollIntoView: () => events.push('scroll'), focus: () => events.push('focus') };
    tree.ref.current = {
      querySelector: (selector) => {
        assert.equal(selector, '.ga-plan-section--info');
        return { querySelector: (selector) => (selector === '#title' ? target : null) };
      },
    };
    const titleError = annualNodes(summary).find((node) => node.type === 'button' && node.props.children === 'Nhập tên kế hoạch');
    assert.ok(titleError);
    titleError.props.onClick();
    assert.deepEqual(events, ['scroll', 'focus']);
    tree = annualControlled.renderAnnual();
    assert.equal(annualNodes(tree).find((node) => node.props.title === '1. Thông tin chung').props.collapsed, false);
  } finally {
    annualControlled.disposeAnnual();
    if (previousFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousFrame;
  }
});

test('TEAM keeps its source visible after creation and exposes only allocation controls', () => {
  const old = { ...formContext };
  try {
    formContext.editId = 'team';
    formContext.goals = [
      { id: 'annual', planLevel: 'SCHOOL_YEAR', title: 'Nguồn đã ban hành', versionNo: 2, status: 'APPROVED', domains: [], themes: [] },
      {
        id: 'team',
        planLevel: 'TEAM',
        sourceMode: 'INHERITED',
        curriculumSourcePlanId: 'annual',
        schoolYear: '2026 – 2027',
        ageGroupId: 'ag-5',
        title: 'Tổ',
        status: 'DRAFT',
        domains: [],
        themes: [],
      },
    ];
    const html = renderToStaticMarkup(React.createElement(GoalFormPage));
    assert.match(html, /data-source-id="annual" data-source-title="Nguồn đã ban hành"/);
    assert.match(html, /data-table="goals" data-fixed="true" data-locked="true" data-assign="true"/);
    assert.doesNotMatch(html, /Nhập file|Lấy chủ đề từ kế hoạch có sẵn|Lấy từ kế hoạch (?:giáo dục )?tổ|Lấy từ Chương trình của Bộ/);
  } finally {
    Object.keys(formContext).forEach((key) => delete formContext[key]);
    Object.assign(formContext, old);
  }
});

test('TEAM validation also exposes an error summary without enabling annual imports', () => {
  try {
    const tree = annualControlled.renderAnnual('TEAM');
    annualNodes(tree)
      .find((node) => typeof node.props.beforeOpen === 'function')
      .props.beforeOpen('submit');
    const updated = annualControlled.renderAnnual('TEAM');
    assert.ok(annualNodes(updated).find((node) => node.props['aria-label'] === 'Các phần cần kiểm tra'));
    assert.equal(
      annualNodes(updated).some((node) => node.props.label === 'Lấy và nhập nội dung kế hoạch năm học'),
      false,
    );
  } finally {
    annualControlled.disposeAnnual();
  }
});
