import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import * as validation from '../../src/utils/school-config/schoolConfigValidation.js';
import * as locations from '../../src/models/Location.js';

const source = await readFile(new URL('../../src/components/school-config/ClassFormModal.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const {classSizeLimit,validateClass,hasErrors,errorsAfterChange,CLASS_LIMITS}=globalThis.classRoomModules.validation;
const {isActiveLocation,LOCATION_TYPES}=globalThis.classRoomModules.locations;
const useState=v=>{const s=globalThis.classRoomTest;const i=s.index++;if(!(i in s.slots))s.slots[i]=typeof v==='function'?v():v;return [s.slots[i],v=>s.slots[i]=typeof v==='function'?v(s.slots[i]):v];};
const useRef=v=>({current:v}),useEffect=f=>{if(globalThis.classRoomTest.mount)globalThis.classRoomTest.effects.push(f);};
const useAuth=()=>({user:{id:'test-principal'}}),useToast=()=>({success:()=>{}});
const saveClass=async(id,form)=>{globalThis.classRoomTest.saved={id,form};return form;};
const Modal=()=>null,FormField=()=>null,Spinner=()=>null,Save=()=>null,Link=()=>null;
`;
globalThis.classRoomModules = { validation, locations };
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'ClassFormModal.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { ClassFormModal } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
delete globalThis.classRoomModules;
const walk = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)]);

for (const yearField of ['schoolYearId', 'schoolYear']) {
  test(`edit room saves a loaded class using ${yearField} and preserves its year`, async () => {
    const state = (globalThis.classRoomTest = { index: 0, slots: [], effects: [], mount: true });
    const cls = {
      id: '41',
      name: 'Lớp thử',
      [yearField]: '2027-2028',
      campusId: '1',
      ageGroupId: '2',
      locationId: '10',
      capacity: 25,
      childCount: 12,
    };
    const props = {
      open: true,
      cls,
      schoolYear: '2027-2028',
      onClose: () => {},
      existing: [cls],
      campuses: [{ id: '1' }],
      ageGroups: [{ id: '2', maxClassSize: 25 }],
      locations: ['10', '11'].map((id) => ({ id, campusId: '1', type: 'CLASS', capacity: 25, status: 'ACTIVE' })),
    };
    const render = () => {
      state.index = 0;
      return ClassFormModal(props);
    };
    try {
      render();
      state.effects.forEach((f) => f());
      state.mount = false;
      const roomSelect = walk(render()).find((n) => n.type === 'select' && n.props.value === '10');
      roomSelect.props.onChange({ target: { value: '11' } });
      const save = walk(render().props.footer).find((n) => n.type === 'button' && n.props.className.includes('primary'));
      await save.props.onClick();
      assert.ok(state.saved, 'form must reach the save API after changing room');
      assert.equal(state.saved.id, '41');
      assert.equal(state.saved.form.locationId, '11');
      assert.equal(state.saved.form.schoolYear, '2027-2028');
      assert.equal(state.saved.form.capacity, 25);
      assert.equal(state.saved.form.ageGroupId, '2');
    } finally {
      delete globalThis.classRoomTest;
    }
  });
}
