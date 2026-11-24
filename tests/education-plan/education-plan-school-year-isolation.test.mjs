import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { classPlanVersionPath, classTeamPlanSelection } from '../../src/models/education-plan/planVersions.mjs';
import { educationSchoolYears, previousSchoolYears } from '../../src/models/education-plan/schoolYearScope.mjs';

globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { educationPlanApi } = await import('../../src/services/education-plan/api/educationPlanApi.js');
const { educationPlanMockRepository } = await import('../../src/services/education-plan/mock/educationPlanMockRepository.js');
const { classPlanMockRepository } = await import('../../src/services/education-plan/mock/classPlanMockRepository.js');
const { EDU_SEED_VERSION } = await import('../../src/mocks/educationPlanSeed.js');
const { writeDb } = await import('../../src/mocks/mockDatabase.js');

const YEARS = [
  { id: 99, label: '2097 - 2098', name: '2097-2098', startDate: '2097-09-01', status: 'CLOSED' },
  { id: 5, label: '2098 - 2099', name: '2098-2099', startDate: '2098-09-01', status: 'ACTIVE' },
  { id: 2, label: '2099 - 2100', name: '2099-2100', startDate: '2099-09-01', status: 'PLANNED' },
];
const principal = { id: 'principal', role: 'PRINCIPAL', fullName: 'Hiệu trưởng thử' };
const summary = (id, schoolYearId, planLevel = 'TEAM') => ({
  id,
  schoolYearId,
  schoolYearName: YEARS.find((year) => year.id === schoolYearId)?.name,
  planLevel,
  ageGroupId: 3,
  title: `Kế hoạch ${id}`,
  status: 'REVIEW',
  permissions: { canApprove: true },
});
const response = (config, data) => ({ config, headers: {}, status: 200, data: { code: 200, data } });
const goalUrl = '/education-plans/goals';

test('API hàng chờ truyền ID và không mở chi tiết kết quả khác năm', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.url === '/education-plans/config') return response(config, { schoolYears: YEARS, ageGroups: [{ id: 3, code: 'ag-3' }] });
    if (config.url.endsWith('/review-queue')) return response(config, [summary(1, 5), summary(2, 99)]);
    return response(config, summary(Number(config.url.split('/').at(-1)), 5));
  };

  assert.deepEqual((await educationPlanApi.getReviewQueue(principal, '5')).map((plan) => plan.schoolYearId), [5]);
  assert.deepEqual(calls.find((call) => call.url.endsWith('/review-queue')).params, { schoolYearId: 5 });
  assert.deepEqual(calls.filter((call) => /^\/education-plans\/goals\/\d+$/.test(call.url)).map((call) => call.url), [`${goalUrl}/1`]);
  assert.deepEqual(await educationPlanApi.getReviewQueue(principal, 2), []);
});

test('API kế hoạch ở trang quá hạn truyền cùng ID tới mọi trang và cả hai cấp', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config.params);
    const { planLevel, page } = config.params;
    return response(config, {
      items: [summary(planLevel === 'TEAM' ? 10 + page : 20 + page, 5, planLevel), summary(99, 99, planLevel)],
      totalPages: 2,
    });
  };

  const { goals } = await educationPlanApi.getAll(principal, { schoolYearId: 5 });
  assert.deepEqual(goals.map(({ id }) => id).sort(), ['10', '11', '20', '21']);
  assert.deepEqual(calls.map(({ planLevel, page }) => [planLevel, page]), [
    ['TEAM', 0], ['SCHOOL_YEAR', 0], ['TEAM', 1], ['SCHOOL_YEAR', 1],
  ]);
  assert.ok(calls.every(({ schoolYearId }) => schoolYearId === 5));
});

test('mock hàng chờ và danh sách chỉ trả ID đã chọn, gồm dữ liệu cũ được ánh xạ từ cấu hình', async () => {
  const vp = { id: 'vp', role: 'VICE_PRINCIPAL' };
  writeDb((db) => {
    db.eduSeedVersion = EDU_SEED_VERSION;
    db.schoolYears = YEARS;
    db.eduGoals = [
      { id: 'current', schoolYear: '2098 – 2099' },
      { id: 'prior', schoolYear: '2098 – 2099', schoolYearId: 99 },
    ].map((plan) => ({ ...plan, planLevel: 'TEAM', ageGroupId: 'ag-3', status: 'REVIEW', waitingRole: 'VICE_PRINCIPAL', domains: [] }));
  });
  assert.deepEqual((await educationPlanMockRepository.getReviewQueue(vp, '5')).map(({ id }) => id), ['current']);
  assert.deepEqual((await educationPlanMockRepository.getAll(vp, { schoolYearId: 99 })).goals.map(({ id }) => id), []);
  assert.deepEqual((await educationPlanMockRepository.getReviewQueue(vp, 99)).map(({ id }) => id), ['prior']);
});

test('mock hồ sơ lớp và khả năng tạo dùng lớp theo ID năm', async () => {
  writeDb((db) => {
    db.schoolYears = YEARS;
    db.classes = [
      { id: 'now', schoolYear: 5, ageGroupId: 'ag-3', teacherIds: [] },
      { id: 'prior', schoolYear: '2097 – 2098', ageGroupId: 'ag-3', teacherIds: [] },
      { id: 'legacy', ageGroupId: 'ag-3', teacherIds: [] },
    ];
    db.eduClassBranch = db.classes.map(({ id }) => ({ id: `bp-${id}`, classId: id, yearPlanId: 'source', status: 'DRAFT' }));
    db.eduClassTheme = [];
    db.eduClassWeek = [];
  });
  const current = await classPlanMockRepository.getAll(principal, 5);
  assert.deepEqual(current.classes.map(({ id }) => id), ['now', 'legacy']);
  assert.deepEqual(current.branchPlans.map(({ classId }) => classId), []);
  assert.ok(current.creationCapabilities.every(({ classId }) => ['now', 'legacy'].includes(classId)));
  const prior = await classPlanMockRepository.getAll(principal, 99);
  assert.deepEqual(prior.classes.map(({ id }) => id), ['prior']);
  assert.deepEqual(prior.branchPlans.map(({ classId }) => classId), []);
});

test('năm trước dựa theo ngày bắt đầu, dù thứ tự ID hoặc nhãn không phản ánh thời gian', () => {
  assert.deepEqual(previousSchoolYears(YEARS, '5').map(({ id }) => id), [99]);
  assert.deepEqual(previousSchoolYears(YEARS, 2).map(({ id }) => id), [5, 99]);
  assert.deepEqual(previousSchoolYears(YEARS, 'unknown'), []);
});

test('hồ sơ chờ duyệt ghim đúng bản tổ cũ cùng năm, không ghim bản cùng nhóm tuổi khác năm', () => {
  const cls = { id: 'class', ageGroupId: 'ag-3' };
  const base = { ageGroupId: cls.ageGroupId, schoolYearId: 5, planLevel: 'TEAM', status: 'APPROVED' };
  const old = { ...base, id: 'old', versionNo: 1 };
  const current = { ...base, id: 'current', versionNo: 2 };
  const prior = { ...base, id: 'prior', schoolYearId: 99, versionNo: 9 };
  const annual = { ...base, id: 'annual', planLevel: 'SCHOOL_YEAR', versionNo: 10 };
  const plans = [old, current, prior, annual];
  assert.equal(classTeamPlanSelection(plans, cls, '5', 'old').listed, old);
  for (const requested of ['prior', 'annual', null]) {
    assert.equal(classTeamPlanSelection(plans, cls, '5', requested).listed, current);
  }
  assert.equal(classTeamPlanSelection(plans, cls, 5, null).previous, old);
  assert.equal(classTeamPlanSelection(plans, cls, 2, 'old').listed, null);
});

const compileComponent = async (relativePath, imports) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const isolated = source.replace(/^import '[^']+';\r?\n/gm, '').replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
  const { code } = await transformWithOxc(imports + isolated, relativePath, {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};

const hookStubs = `
import React from ${JSON.stringify(import.meta.resolve('react'))};
let cursor, instance;
export function componentState() { return { hooks: [], cleanups: [], writes: 0 }; }
export function render(component, state, props = {}) {
  cursor = 0;
  instance = state;
  return component(props);
}
export function unmount(state) { state.cleanups.forEach((cleanup) => cleanup()); }
const useMemo = (build, deps) => {
  const key = cursor++;
  const saved = instance.hooks[key];
  if (saved && deps.every((dep, i) => Object.is(dep, saved.deps[i]))) return saved.value;
  const value = build();
  instance.hooks[key] = { value, deps };
  return value;
};
const useCallback = (fn, deps) => useMemo(() => fn, deps);
const useRef = (current) => useMemo(() => ({current}), []);
const useState = (initial) => {
  const state = instance;
  const ref = useRef(typeof initial === 'function' ? initial() : initial);
  return [ref.current, (next) => { state.writes += 1; ref.current = typeof next === 'function' ? next(ref.current) : next; }];
};
const useEffect = (fn, deps) => {
  useMemo(() => { const cleanup = fn(); if (cleanup) instance.cleanups.push(cleanup); }, deps);
};
const useId = () => 'year-case';
`;

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const compileProvider = () => compileComponent('../../src/hooks/education-plan/useEducationPlan.jsx', hookStubs + `
import {educationSchoolYears,sameSchoolYearId} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/schoolYearScope.mjs'))};
const USE_MOCK=false;
const { createContext, useContext } = React;
export const state = {
  year: '2098-2099', data: { goals: [] }, getClassPlans: () => {},
  years: [{id:'2098-2099',beId:5,label:'2098 - 2099'},{id:'2097-2098',beId:99,label:'2097 - 2098'}],
  getEducationPlans: () => ({goals:[]}), getEduConfig: () => ({}),
};
export let loadCurrent;
const actor = { id:'principal', role:'PRINCIPAL', fullName:'Hiệu trưởng thử' };
const useAuth = () => ({user: actor}), useToast = () => ({});
const useSchoolYear = () => ({schoolYear:state.year, schoolYears:state.years, setSchoolYear:() => {}});
const service = {
  getClassPlans: (...args) => state.getClassPlans(...args),
  getEducationPlans: (...args) => state.getEducationPlans(...args),
  getEduConfig: (...args) => state.getEduConfig(...args),
};
const useAsync = (load) => {
  loadCurrent = load;
  return {
    data: state.data, loading: false, error: null,
    setData: (apply) => { state.data = typeof apply === 'function' ? apply(state.data) : apply; },
    reload: () => {},
  };
};
const ROLES={}, ROLE_LABELS={}, AGE_GROUPS=[], EDU_STATUS={};
const mergeGoals=(prev,next)=>next, withDefaults=(value)=>value, applyEduConfig=()=>{};
const toEduYear=(value)=>value, fromEduYear=(value)=>value;
const LoadingState=()=>null, ErrorState=()=>null;
`);

test('giữ ID BE khi bộ chọn dùng tên năm và giữ ID mock khi chỉ cấu hình trường nối BE', () => {
  const a = { id: '2026-2027', beId: 42, label: '2026 - 2027' };
  const b = { id: '17', label: '2025 - 2026' };
  const invalid = { id: 'không rõ' };
  assert.deepEqual(educationSchoolYears([a, b, invalid], false).map(({ id, headerId }) => [id, headerId]), [
    [42, '2026-2027'], [17, '17'],
  ]);
  assert.deepEqual(educationSchoolYears([a], true).map(({ id, beId }) => [id, beId]), [['2026-2027', 42]]);
});

test('header giữ beId từ danh mục mà vẫn dùng khóa lựa chọn cũ', async () => {
  const app = await compileComponent('../../src/contexts/SchoolYearContext.jsx', hookStubs + `
const {createContext,useContext} = React;
const account = { id:'test' };
const useAuth=()=>({user:account});
const rows=[{id:'2026-2027',beId:42,name:'2026-2027',status:'ACTIVE'},{id:17,name:'2025-2026',status:'CLOSED'}];
const getSchoolYears=async()=>rows;
const readPickedSchoolYear=()=>null, savePickedSchoolYear=()=>{}, DB_CHANGED_EVENT='storage-change';
`);
  const instance = app.componentState();
  app.render(app.SchoolYearProvider, instance);
  await Promise.resolve();
  const { props: { value } } = app.render(app.SchoolYearProvider, instance);
  assert.equal(value.schoolYear, '2026-2027');
  assert.equal(value.schoolYears[0].beId, 42);
  assert.equal(value.schoolYears[1].id, 17);
});

test('provider dùng cùng ID cho kế hoạch và lớp, bỏ truy vấn theo năm ở trang dùng chung hoặc lúc thiếu năm hợp lệ', async () => {
  const app = await compileProvider();
  const instance = app.componentState();
  const calls = [];
  app.state.getEducationPlans = async (_user, filter) => (calls.push(['plans', filter.schoolYearId]), { goals: [] });
  app.state.getClassPlans = async (id) => (calls.push(['classes', id]), {});
  app.state.getEduConfig = async () => (calls.push(['config']), { ready: true });
  const render = (props = {}) => app.render(app.EducationPlanProvider, instance, props).props.value;
  for (const [picked, id] of [['2098-2099', 5], ['2097-2098', 99]]) {
    app.state.year = picked;
    assert.equal(render().schoolYearId, id);
    await app.loadCurrent();
    assert.deepEqual(calls.splice(0), [['plans', id], ['classes', id], ['config']]);
  }
  assert.equal(render({ yearScoped: false }).schoolYearId, null);
  assert.deepEqual((await app.loadCurrent()).eduConfig, { ready: true });
  assert.deepEqual(calls.splice(0), [['config']]);
  app.state.year = '2100-2101';
  assert.equal(render().schoolYearId, null);
  await app.loadCurrent();
  assert.deepEqual(calls.splice(0), [['config']]);
});

test('hai trang dùng chung tắt truy vấn theo năm tại layout', async () => {
  const app = await compileComponent('../../src/components/education-plan/EducationPlanLayout.jsx', hookStubs + `
export const route = { path: '' };
const Outlet='outlet', EducationPlanProvider='provider';
const useMatch = (path) => path === route.path;
const useSearchParams = () => [new URLSearchParams()];
const document = new EventTarget(), window = new EventTarget();
`);
  for (const path of ['/education/settings', '/education/curriculum-sources', '/education/resources', '/education/plan-reviews']) {
    app.route.path = path;
    const provider = app.render(app.default, app.componentState());
    assert.equal(provider.props.yearScoped, !/settings|curriculum-sources/.test(path), path);
    assert.equal(provider.props.reviewView, path === '/education/plan-reviews', path);
  }
});

test('liên kết trong gói giữ phiên bản tổ cũ, truy vấn học kỳ và vị trí mở', () => {
  assert.equal(classPlanVersionPath('/education/theme-plans/c1?hk=2', 'old'), '/education/theme-plans/c1?hk=2&plan=old');
  assert.equal(classPlanVersionPath('/education/class/c1/weeks/2098-10-12#cov-day-0', 'old'), '/education/class/c1/weeks/2098-10-12?plan=old#cov-day-0');
  assert.equal(classPlanVersionPath('/education/class/c1/themes/t1?plan=other', 'old'), '/education/class/c1/themes/t1?plan=old');
});

test('phản hồi hồ sơ lớp đang tải của lần chọn A cũ không ghi đè khi chọn A → B → A', async () => {
  const app = await compileProvider();
  const instance = app.componentState();
  const provider = () => app.render(app.EducationPlanProvider, instance).props.value;
  const stale = deferred();
  app.state.getClassPlans = () => stale.promise;
  const pending = provider().refreshClassDocs();

  app.state.year = '2097-2098';
  app.state.getClassPlans = async () => ({ classes: [{ id: 'class-B' }] });
  await provider().refreshClassDocs();
  assert.deepEqual(app.state.data.classes, [{ id: 'class-B' }]);

  app.state.year = '2098-2099';
  app.state.getClassPlans = async () => ({ classes: [{ id: 'class-A-latest' }] });
  await provider().refreshClassDocs();
  stale.resolve({ classes: [{ id: 'class-A-old' }] });
  await pending;
  assert.deepEqual(app.state.data.classes, [{ id: 'class-A-latest' }]);
});

const descendants = (node) =>
  React.isValidElement(node) ? [node, ...React.Children.toArray(node.props.children).flatMap(descendants)] : [];

test('kho học liệu tải theo năm trên header trước khi chọn chủ đề và đặt lại bộ lọc khi chuyển năm', async () => {
  const app = await compileComponent('../../src/pages/education-plan/ResourceLibraryPage.jsx', hookStubs + `
import {sameSchoolYearId} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/schoolYearScope.mjs'))};
export const state={schoolYearId:42,user:{id:'teacher'},requests:[]};
const useEducationPlan=()=>state, ageRangeOptions=()=>[];
const api={list:(_user,query)=>state.requests.push(query)};
const useAsync=(load,_deps,options)=>{if(options.enabled) load(); return {data:null};};
const PageHead='header', FilterSelect='select', SearchSubmit='search-box', FilterChips='div', Card='section', EmptyState='div';
`);
  const render = () => {
    const wrapper = app.render(app.default, app.componentState());
    return [wrapper.key, app.render(wrapper.type, app.componentState(), wrapper.props)];
  };
  const [firstKey] = render();
  assert.equal(app.state.requests[0].schoolYearId, 42);
  assert.equal(app.state.requests[0].teachThemeName, undefined);
  app.state.schoolYearId = 17;
  const [secondKey] = render();
  assert.notEqual(secondKey, firstKey);
  assert.equal(app.state.requests[1].schoolYearId, 17);
  app.state.schoolYearId = null;
  render();
  assert.equal(app.state.requests.length, 2);
});

test('R-01 mở hạn hàng loạt giữ đúng đích khi đổi năm và không ghi kết quả vào năm mới', async () => {
  const app = await compileComponent('../../src/pages/education-plan/OverduePlansPage.jsx', hookStubs + `
import { overdueRows, filterOverdue, OVERDUE_DEADLINE_LABEL, OVERDUE_KIND_LABEL } from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/overdue.mjs'))};
export const state = {schoolYearId:5, user:{id:'principal'}, goals:[], classes:[], semesterPackages:[], themeDossiers:[], loading:false};
const useEducationPlan=()=>state, useGoalDetails=()=>{}, usePolling=()=>{};
const useSearchParams=()=>[new URLSearchParams(), ()=>{}];
const useAsync=()=>{ const items=overdueRows({yearPlans:state.goals,today:'2098-10-19'}); return {data:{rows:{items,totalElements:items.length},overdueCount:items.length,extendedCount:0,semesters:[]},reload:state.reload}; };
const todayIso=()=> '2098-10-19';
const ageRangeOptions=()=>[], sameAgeRange=(a,b)=>a===b, planRoute=()=>'/education/goals';
const Button='button', SelectField='select', Link='a', Card='section', PageHead='header', FilterMore='aside';
const EduStatusBadge='span', YearPlanStatusBadge='span', EmptyState='p', Eye='i', ErrorState='p', LoadingState='p';
const ExtendDeadlineModal='test-modal', fmtDate=(x)=>x, fmtDateTime=fmtDate;
const Pagination='nav', paginate=(items,page,size)=>items.slice((page-1)*size,page*size);
`);
  const first = deferred();
  const attempted = [];
  app.state.unlockGoal = async (id) => { attempted.push(id); return attempted.length === 1 ? first.promise : false; };
  app.state.reloads = 0;
  app.state.reload = () => app.state.reloads++;
  const overdue = (id) => ({ id, title:id, timeLock:{ canUnlock:true, deadline:'2098-10-10' }, status:'DRAFT' });
  app.state.goals = [overdue('A-1'), overdue('A-2')];
  const wrapper = () => app.render(app.default, app.componentState());
  const scopedA = wrapper();
  const stateA = app.componentState();
  const renderA = () => app.render(scopedA.type, stateA, scopedA.props);
  assert.equal(descendants(renderA()).find((node) => node.props['data-testid'] === 'overdue-plans-view').props.to,
    '/education/overdue?kind=TEAM&doc=A-1');
  descendants(renderA()).find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange();
  descendants(renderA()).find((node) => node.props['data-testid'] === 'overdue-plans-extend-selected').props.onClick();
  const modal = descendants(renderA()).find((node) => node.type === 'test-modal');
  const pending = modal.props.onConfirm({ note:'Gia hạn', deadline:'2098-10-21' });
  assert.deepEqual(attempted, ['A-1']);

  app.unmount(stateA);
  app.state.schoolYearId = 99;
  app.state.goals = [overdue('B-1')];
  const scopedB = wrapper();
  const stateB = app.componentState();
  const renderB = () => app.render(scopedB.type, stateB, scopedB.props);
  assert.notEqual(scopedA.key, scopedB.key);
  renderB();
  const writesWhenSwitched = stateA.writes;
  first.resolve(false);
  await pending;

  assert.deepEqual(attempted, ['A-1', 'A-2']);
  assert.equal(stateA.writes, writesWhenSwitched);
  const next = descendants(renderB());
  assert.ok(next.every((node) => node.type !== 'test-modal'));
  assert.ok(next.filter((node) => node.type === 'input' && node.props.type === 'checkbox').every((node) => !node.props.checked));
  assert.ok(next.some((node) => React.Children.toArray(node.props.children).includes('B-1')));
  assert.equal(app.state.reloads, 0);
});
