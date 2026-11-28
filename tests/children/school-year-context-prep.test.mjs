import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { lockedYearOf, preparingYearOf } from '@/utils/schoolYearPrep';

/*
 * Header năm học (useSchoolYear) cho màn trẻ, sức khỏe, đón trẻ (CFG-YR-05, CHD-12): năm sắp diễn ra chưa tới ngày mở chuẩn bị
 * ⇒ yearLocked + lockedYear; đã tới ⇒ preparingYear. React và dịch vụ giả; hàm xét năm dùng bản thật.
 */
globalThis.yearPrep = { lockedYearOf, preparingYearOf };
const source = await readFile(new URL('../../src/contexts/SchoolYearContext.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const createContext=()=>({Provider:'school-year-provider'});
const useContext=()=>null;
const useState=(v)=>[typeof v==='string'?globalThis.ctxTest.schoolYear:globalThis.ctxTest.schoolYears,()=>{}];
const useRef=(v)=>({current:v}),useCallback=(f)=>f,useEffect=()=>{},useMemo=(f)=>f();
const SCHOOL_YEARS=[],DEFAULT_SCHOOL_YEAR='';
const useAuth=()=>({user:null}),getSchoolYears=()=>Promise.resolve([]);
const readPickedSchoolYear=()=>null,savePickedSchoolYear=()=>{},DB_CHANGED_EVENT='db-changed';
const {lockedYearOf,preparingYearOf}=globalThis.yearPrep;
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'SchoolYearContext.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { SchoolYearProvider } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);

const active = { id: '2026-2027', label: '2026 - 2027', status: 'ACTIVE', preparing: false, prepDate: '2026-07-15' };
const locked = { id: '2027-2028', label: '2027 - 2028', status: 'PLANNED', preparing: false, prepDate: '2027-07-15' };
const preparing = { id: '2028-2029', label: '2028 - 2029', status: 'PLANNED', preparing: true, prepDate: '2028-07-14' };
const valueFor = (schoolYear) => {
  globalThis.ctxTest = { schoolYear, schoolYears: [active, locked, preparing] };
  return SchoolYearProvider({ children: null }).props.value;
};

test('CHD-12: header ở năm chưa tới ngày mở chuẩn bị ⇒ khóa, lockedYear là năm đó', () => {
  const value = valueFor('2027-2028');
  assert.equal(value.yearLocked, true);
  assert.equal(value.lockedYear, locked);
  assert.equal(value.preparingYear, null);
});

test('CHD-11: header ở năm đã tới ngày mở chuẩn bị ⇒ không khóa, preparingYear là năm đó', () => {
  const value = valueFor('2028-2029');
  assert.equal(value.yearLocked, false);
  assert.equal(value.lockedYear, null);
  assert.equal(value.preparingYear, preparing);
});

test('header ở năm đang hoạt động ⇒ không khóa, không chuẩn bị', () => {
  const value = valueFor('2026-2027');
  assert.equal(value.yearLocked, false);
  assert.equal(value.lockedYear, null);
  assert.equal(value.preparingYear, null);
});
