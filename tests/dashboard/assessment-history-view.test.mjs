import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { canReviewEvaluation, canViewAiDraft } from '@/utils/assessment/assessmentPermissions';
import { ROLES } from '@/models/User';
import { EVAL_STATUS } from '@/models/assessment/assessmentConstants';

const source = await readFile(new URL('../../src/components/assessment/DailyDaysTable.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const Link=({to,children,...props})=>React.createElement('a',{href:to,...props},children);
const EMOTION_LABELS={},BEHAVIORS={},NAP={},NAP_LABELS={},HEALTH_SYMPTOMS={};
const formatDate=x=>x,mealsText=(meals,sessions)=>sessions.map(s=>s+':'+meals[s]).join(', ');
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'DailyDaysTable.jsx', {
  lang: 'jsx', jsx: { runtime: 'classic' },
});
const { DailyDaysTable } = await import(`data:text/javascript;base64,${Buffer.from(
  code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`),
).toString('base64')}`);
const day = (overrides = {}) => ({date:'2026-10-13',health:null,meals:null,behaviors:[],met:[],effort:[],notMet:[],comment:'',...overrides});

test('lịch sử ghi rõ lớp cũ và giữ mục tiêu; không dẫn ngày cũ sang phiếu lớp mới', () => {
  const html = renderToStaticMarkup(DailyDaysTable({
    days:[day({classId:'1',className:'Lớp A',met:[{id:'1001',name:'MT cũ',description:'Nội dung cũ'}]}),
      day({date:'2026-10-15',classId:'2',className:'Lớp B'})],
    classId:'2',mealSessions:['LUNCH'],linkDays:true,
  }));
  assert.match(html,/Lớp A/);
  assert.match(html,/Lớp B/);
  assert.match(html,/Nội dung cũ/);
  assert.doesNotMatch(html,/href="[^"]*2026-10-13/);
  assert.match(html,/href="[^"]*classId=2[^" ]*2026-10-15/);
});

test('lịch sử bữa ăn giữ bữa đã ghi ở lớp cũ, BGH xem không có đường sửa ngày', () => {
  const html = renderToStaticMarkup(DailyDaysTable({
    days:[day({classId:'1',className:'Lớp A',meals:{MORNING:'AN_HET',LUNCH:'AN_HET'}})],
    classId:'2',mealSessions:['LUNCH'],linkDays:false,
  }));
  assert.match(html,/MORNING:AN_HET/);
  assert.doesNotMatch(html,/<a /);
});

test('cô nhận trẻ và BGH không thấy quyền sửa hoặc bản nháp của lớp cũ', () => {
  const cls={id:'1',teaches:false,canEdit:false};
  for(const role of [ROLES.TEACHER,ROLES.VICE_PRINCIPAL,ROLES.PRINCIPAL]) {
    const user={id:'2',role};
    assert.equal(canReviewEvaluation({status:EVAL_STATUS.CONFIRMED},cls,user),false);
    assert.equal(canReviewEvaluation({status:EVAL_STATUS.AWAITING_REVIEW},cls,user),false);
    assert.equal(canViewAiDraft({status:EVAL_STATUS.CONFIRMED},cls,user),false);
  }
});
