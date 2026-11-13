import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as education from '../../src/models/education-plan/educationPlanConstants.js';

test('hồ sơ đã gửi duyệt hiển thị chờ duyệt và được tính vào số chờ', () => {
  assert.equal(education.EDU_STATUS_LABELS.REVIEW, 'Chờ duyệt');
  for (const status of ['REVIEW', 'PENDING_TL', 'PENDING_VP', 'PENDING_HT']) {
    assert.equal(education.EDU_STATUS_LABELS[status], 'Chờ duyệt');
    assert.equal(education.isEduReviewPending(status), true);
  }
  for (const status of [education.EDU_STATUS.DRAFT, education.EDU_STATUS.APPROVED, education.EDU_STATUS.REJECTED]) assert.equal(education.isEduReviewPending(status), false);
});

test('tổng quan toàn trường không hiển thị hồ sơ chờ duyệt', async () => {
  const source = await readFile(new URL('../../src/pages/education-plan/SchoolPlansPage.jsx', import.meta.url), 'utf8');
  const stubs = `
    import React, {useMemo, useState} from 'react';
    import {EDU_STATUS, EDU_STATUS_LABELS, isEduReviewPending} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/educationPlanConstants.js'))};
    const useEducationPlan=()=>({goals:[{id:'1',schoolYear:'2026',status:'REVIEW',title:'Demo',themes:[]}],branchPlans:[],classThemePlans:[],schoolYear:'2026',classes:[]});
    const useNavigate=()=>()=>{}, RotateCcw=()=>null, SearchSubmit=()=>null, PageHead=()=>null, EmptyState=()=>null;
    const Card=({children})=><section>{children}</section>, StatCard=({label,value})=><span>{label}: {value}</span>;
    const Tabs=({items})=><div role="tablist">{items.map((t)=><button key={t.key} role="tab">{t.label} {t.count}</button>)}</div>;
    const EduStatusBadge=({status})=><span>{EDU_STATUS_LABELS[status]}</span>, YearPlanStatusBadge=EduStatusBadge;
    const AGE_GROUPS=[], allGoalItems=()=>[], themeNumber=()=>'', themeWeeksOf=()=>[], yearWeeks=()=>[], clickableRowProps=()=>({}), fmtDate=()=>'', fmtDateTime=()=>'';
  `;
  const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
  const { code } = await transformWithOxc(stubs + isolated, 'SchoolPlansPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
  const { default: Page } = await import(`data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`);
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.doesNotMatch(html, /Chờ duyệt|Demo|value="REVIEW"/);
  assert.doesNotMatch(html, /Đang duyệt/);
});
