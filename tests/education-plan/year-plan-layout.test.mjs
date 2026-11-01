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
const ROLES={VICE_PRINCIPAL:'vp'}, AGE_GROUPS=[], DOMAINS=[], SCHOOL_SCOPE='Toàn trường', EDU_STATUS={EDITING:'EDITING',DRAFT:'DRAFT',PENDING_VP:'PENDING_VP'}, EDU_ERROR_CODE={};
const useEducationPlan=()=>({goals:[],schoolYear:'2026 – 2027',user:{id:'test',name:'Người soạn',role:'vp'},staff:[]});
const useYearPlanAutosave=()=>({label:'Đã lưu',recovery:null}), useLeaveGuard=()=>({modal:{}});
const numberGoals=()=>({}), themeScheduleIssue=()=>'', isBlankTheme=()=>false, isBlankBreak=()=>false;
const Card=({title,num,actions,children})=><section><h2>{num}. {title}</h2>{actions}{children}</section>;
const PageHead=({actions})=><header>{actions}</header>, Field=({label,children})=><label>{label}{children}</label>, Notice=({children})=><p>{children}</p>;
const GoalTable=()=> <div data-table="goals"/>, ThemeEventTable=()=> <div data-table="themes"/>;
const PlanTabs=()=> <div role="tablist"/>, Stepper=()=> <nav data-stepper="true"/>;
const Download=()=>null, FileDown=()=>null, Save=()=>null, Upload=()=>null, ArrowLeft=()=>null, ArrowRight=()=>null;
const ReviewActions=()=>null, LeaveConfirmModal=()=>null, RowMenu=()=>null, fmtDate=(v)=>v;
`;
const { code } = await transformWithOxc(stubs + isolated, 'GoalFormPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { default: GoalFormPage } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

test('mục tiêu năm hiển thị nhập dữ liệu, thông tin, chủ đề và mục tiêu trên cùng trang', () => {
  const html = renderToStaticMarkup(React.createElement(GoalFormPage));
  const common = html.indexOf('1. Thông tin chung');
  const themes = html.indexOf('2. Chủ đề, sự kiện trong năm');
  const goals = html.indexOf('3. Mục tiêu, nội dung giáo dục');
  assert.ok(common > html.indexOf('Nhập file') && html.indexOf('Nhập file') >= 0);
  assert.ok(common > html.indexOf('Lấy từ kế hoạch có sẵn') && html.indexOf('Lấy từ kế hoạch có sẵn') >= 0);
  assert.ok(common > html.indexOf('Lấy từ Chương trình của Bộ') && html.indexOf('Lấy từ Chương trình của Bộ') >= 0);
  assert.ok(common < themes && themes < goals);
  assert.match(html, /data-table="themes"/);
  assert.match(html, /data-table="goals"/);
  assert.doesNotMatch(html, /tablist|data-stepper|Duyệt lại nội dung|Tiếp theo|page-actions|>Đóng</);
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
});
