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
const useParams=()=>({}), useLocation=()=>({state:null,search:''}), useSearchParams=()=>[new URLSearchParams()], useNavigate=()=>()=>{};
const useSchoolYear=()=>({schoolYears:[]}), useMediaQuery=()=>false;
const ROLES={VICE_PRINCIPAL:'vp',TEAM_LEADER:'leader'}, AGE_GROUPS=[{id:'ag-5',name:'Mẫu giáo lớn (5–6 tuổi)'},{id:'ag-4',name:'Mẫu giáo nhỡ (4–5 tuổi)'}], DOMAINS=[], SCHOOL_SCOPE='Toàn trường', EDU_STATUS={EDITING:'EDITING',DRAFT:'DRAFT',PENDING_VP:'PENDING_VP'}, EDU_ERROR_CODE={};
export const formContext={goals:[],user:{id:'test',name:'Người soạn',role:'vp'}};
const useEducationPlan=()=>({...formContext,schoolYear:'2026 – 2027',staff:[]});
const useYearPlanAutosave=()=>({label:'Đã lưu',recovery:null}), useLeaveGuard=()=>({modal:{}});
const numberGoals=()=>({}), themeScheduleIssue=()=>'', isBlankTheme=()=>false, isBlankBreak=()=>false;
const Card=({title,num,actions,children})=><section><h2>{num}. {title}</h2>{actions}{children}</section>;
const PageHead=({actions})=><header>{actions}</header>, Field=({label,children})=><label>{label}{children}</label>, Notice=({children})=><p>{children}</p>;
const GoalTable=()=> <div data-table="goals"/>, ThemeEventTable=()=> <div data-table="themes"/>;
const PlanTabs=()=> <div role="tablist"/>, Stepper=()=> <nav data-stepper="true"/>;
const Download=()=>null, FileDown=()=>null, Save=()=>null, Upload=()=>null, ArrowLeft=()=>null, ArrowRight=()=>null;
const ReviewActions=()=>null, LeaveConfirmModal=()=>null, RowMenu=()=>null, fmtDate=(v)=>v;
const Link=({to,children})=><a href={to}>{children}</a>;
`;
const { code } = await transformWithOxc(stubs + isolated, 'GoalFormPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { default: GoalFormPage, formContext } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

test('mục tiêu năm hiển thị nhập dữ liệu, thông tin, chủ đề và mục tiêu trên cùng trang', () => {
  const html = renderToStaticMarkup(React.createElement(GoalFormPage));
  const common = html.indexOf('1. Thông tin chung');
  const themes = html.indexOf('2. Chủ đề, sự kiện trong năm');
  const goals = html.indexOf('3. Mục tiêu, nội dung giáo dục');
  assert.ok(common > html.indexOf('Nhập file') && html.indexOf('Nhập file') >= 0);
  assert.ok(common > html.indexOf('Lấy từ kế hoạch năm học') && html.indexOf('Lấy từ kế hoạch năm học') >= 0);
  assert.ok(common > html.indexOf('Lấy từ Chương trình của Bộ') && html.indexOf('Lấy từ Chương trình của Bộ') >= 0);
  assert.ok(common < themes && themes < goals);
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
  assert.match(html, /<th[^>]*scope="row"/);
  assert.match(html, /class="ga-year-toolbar"/);
  assert.doesNotMatch(html, /btn--ghost|btn--primary btn--sm/);
  assert.match(html, /id="ag"/);
  assert.match(html, /id="title"/);
  assert.match(html, /id="desc"/);
  const left = html.match(/class="ga-year-toolbar__group">([\s\S]*?)<\/div>/)[1];
  const right = html.match(/class="ga-year-toolbar__group ga-year-toolbar__group--end">([\s\S]*?)<\/div>/)[1];
  assert.ok(left.indexOf('Lấy từ kế hoạch năm học') < left.indexOf('Lấy từ Chương trình của Bộ'));
  assert.ok(left.indexOf('Lấy từ Chương trình của Bộ') < left.indexOf('Nhập file'));
  assert.doesNotMatch(right, /Nhập file/);
  assert.ok(right.indexOf('Lưu') < right.indexOf('Xuất file'));
  assert.match(right, /ga-year-save-status/);
  assert.ok(right.indexOf('ga-year-save-status') < right.indexOf('title="Lưu'));
  assert.doesNotMatch(html, /Thoát/);
});

const detailSource = await readFile(new URL('../../src/pages/education-plan/GoalDetailPage.jsx', import.meta.url), 'utf8');
const detailStubs = `
import React, {useState} from 'react';
const useParams=()=>({id:'test'}), useNavigate=()=>()=>{}, useLocation=()=>({state:null});
const ROLES={VICE_PRINCIPAL:'vp'}, AGE_GROUPS=[], DOMAINS=[], SCHOOL_SCOPE='Toàn trường', EDU_STATUS={DRAFT:'DRAFT',EDITING:'EDITING',APPROVED:'APPROVED'};
const useEducationPlan=()=>({goals:[{id:'test',title:'Kế hoạch thử',status:'DRAFT',domains:[],themes:[],permissions:{canEdit:true}}],themes:[],user:{id:'vp',role:'vp'},staff:[]});
const goalIdsToTicks=(domains,themes)=>({domains,themes}), numberGoals=()=>({}), chainOf=()=>[], currentPlanOf=()=>null;
const Card=({title,num,children})=><section><h2>{num}. {title}</h2>{children}</section>;
const PageHead=({actions})=><header>{actions}</header>, VersionBadge=()=>null, YearPlanVersionPanel=()=>null, ReviewHistory=()=>null, ReviewActions=()=>null;
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
  assert.ok(html.indexOf('1. Thông tin chung') < html.indexOf('2. Chủ đề, sự kiện trong năm'));
  assert.ok(html.indexOf('2. Chủ đề, sự kiện trong năm') < html.indexOf('3. Mục tiêu, nội dung giáo dục'));
  assert.match(html, /ga-sticky-head/);
  assert.match(html, /href="\/education\/goals\/test\/edit" data-back-to="\/education\/goals"/);
  assert.match(html, /href="\/education\/goals\/test\/edit"[^>]*data-replace="true"/);
  assert.doesNotMatch(html, /Thoát/);
  assert.doesNotMatch(html, /btn--ghost/);
});
