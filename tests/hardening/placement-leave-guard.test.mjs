import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import * as constants from '@/models/school-config/schoolConfigConstants';

globalThis.placementGuardConstants = constants;
const source = await readFile(new URL('../../src/components/school-config/PlacementClassPanel.jsx', import.meta.url), 'utf8');
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
const useState=v=>{const i=globalThis.placementStateIndex++;return [i===0&&globalThis.placementGuardRows?globalThis.placementGuardRows:typeof v==='function'?v():v,()=>{}];};
const useMemo=f=>f(),useEffect=f=>f(),useAuth=()=>({user:{id:'test'}}),useToast=()=>({});
const ChildAvatar=()=>null,Save=()=>null,Spinner=()=>null,PlacementActionBadge=()=>null,savePlacements=()=>{};
const {PLACEMENT_ACTION,PLACEMENT_ACTION_LABELS,PLACEMENT_ACTION_SHORT,PLACEMENT_IN_CLASS}=globalThis.placementGuardConstants;
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import[\s\S]*?;\r?\n/gm, ''), 'PlacementClassPanel.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { PlacementClassPanel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const walk = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)];
const props = { yearId: 'next-year', from: { id: 'from', ageGroupId: 'a', nextAgeGroupId: 'b', campusId: 'c', suggestedTargetId: 'next', children: [{ id: 'child', fullName: 'TEST child' }] }, targets: [{ id: 'next', ageGroupId: 'b', campusId: 'c', name: 'TEST next', capacity: 10, taken: 0 }], campusName: () => 'TEST campus', editable: true };

test('trẻ chưa xếp chỉ có gợi ý: không dirty nhưng vẫn lưu được', () => {
  globalThis.placementStateIndex = 0; globalThis.placementGuardRows = null;
  let dirty;
  const tree = PlacementClassPanel({ ...props, onDirty: v => { dirty = v; } });
  assert.equal(dirty, false);
  const save = walk(tree).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes(' Lưu xếp lớp'));
  assert.equal(save.props.disabled, false);
});

test('thay đổi kết quả thật bật dirty; đưa về gợi ý ban đầu thì hết dirty', () => {
  for (const [value, expected] of [[{ action: constants.PLACEMENT_ACTION.LEAVE, toClassId: '' }, true], [{ action: constants.PLACEMENT_ACTION.PROMOTE, toClassId: 'next' }, false]]) {
    globalThis.placementStateIndex = 0; globalThis.placementGuardRows = { child: value };
    let dirty; PlacementClassPanel({ ...props, onDirty: v => { dirty = v; } }); assert.equal(dirty, expected);
  }
});
