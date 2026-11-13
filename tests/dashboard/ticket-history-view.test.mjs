import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../../src/pages/assessment/GoodBehaviourTicketsPage.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const useMemo=f=>f(),useState=v=>[v,()=>{}],useAuth=()=>({user:{id:'t',role:'TEACHER'}}),useToast=()=>({});
const useDailyAssessmentClasses=()=>({classes:[{id:'A',name:'Lớp A'}],loading:false,error:null});
const useTicketBoard=()=>({board:globalThis.ticketHistoryFixture,loading:false,error:null,reload:()=>{}});
const CalendarRange=()=>null,ChevronLeft=()=>null,ChevronRight=()=>null,Flag=()=>null,Ticket=()=>null;
const Breadcrumb=()=>null,ConfirmationModal=()=>null,EmptyState=()=>null,ErrorState=()=>null,SkeletonRows=()=>null,StatusPage=()=>null,TicketSummary=()=>null,Tabs=()=>null,TicketOverview=()=>null;
const ChildNameCell=({child})=>React.createElement('span',{},child.fullName);
const TicketBadge=({status,detail})=>React.createElement('span',{},status,' ',detail);
const canViewTicketOverview=()=>false,isTeamLeader=()=>false,assessmentCrumbs=()=>[],SECTIONS={},TICKET_TYPE={WEEKLY:'WEEKLY',MONTHLY:'MONTHLY'},TICKET_TYPE_LABELS={WEEKLY:'Phiếu tuần'};
const formatDateTime=x=>x,periodLabel=(_type,start,end)=>start+' - '+end,issueTickets=()=>[];
`;
const { code } = await transformWithOxc(
  stubs + source.replace(/^import .*;\r?\n/gm, '') + '\nexport {TeacherTicketsPage};',
  'GoodBehaviourTicketsPage.jsx',
  {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  },
);
const { TeacherTicketsPage } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);
const render = (row) => {
  globalThis.ticketHistoryFixture = {
    period: { start: '2026-10-26', end: '2026-10-30' },
    periods: [],
    rows: [
      {
        child: { id: 'test', fullName: 'TEST lịch sử' },
        eligible: true,
        presentDays: 5,
        flagCount: 3,
        ...row,
      },
    ],
    rules: { WEEK_MIN_FLAGS: 3, MONTH_MIN_WEEKLY_TICKETS: 3 },
  };
  try {
    return renderToStaticMarkup(TeacherTicketsPage());
  } finally {
    delete globalThis.ticketHistoryFixture;
  }
};
const childCheckbox = (html) => html.match(/<input[^>]*aria-label="Chọn TEST lịch sử"[^>]*>/)?.[0];

test('trẻ ở lịch sử lớp cũ không thể được chọn hoặc chọn tất cả để phát lại', () => {
  const html = render({ canIssue: false });
  assert.match(html, /Chỉ xem lịch sử/);
  assert.match(childCheckbox(html), /disabled/);
  assert.match(html, /aria-label="Chọn tất cả trẻ đủ điều kiện"[^>]*disabled/);
});
test('lớp nhận trẻ thấy căn cứ xuyên lớp và được chọn trẻ đủ điều kiện chưa phát', () => {
  const html = render({ canIssue: true });
  assert.doesNotMatch(childCheckbox(html), /disabled/);
  assert.match(html, /bao gồm trước khi chuyển lớp/);
});
test('phiếu đã phát nơi khác có nhãn rõ ràng và khóa phát trùng', () => {
  const html = render({ eligible: false, canIssue: false, issuedElsewhere: true, ticket: { issuedAt: '2026-11-03' } });
  assert.match(html, /Đã phát tại lớp khác/);
  assert.match(html, /Đã có phiếu trong kỳ/);
  assert.match(childCheckbox(html), /disabled/);
});
