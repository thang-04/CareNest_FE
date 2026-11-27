import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';

// Xếp tay năm mới được khác nhóm tuổi (Cần 22/11), vẫn đúng điểm trường và giữ giới hạn sĩ số.
const source = await readFile(new URL('../../src/components/school-config/NewAdmissionPlacementPanel.jsx', import.meta.url), 'utf8');
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
const useState=v=>[typeof v==='function'?v():v,()=>{}];
const useMemo=f=>f(),useEffect=f=>f(),useAuth=()=>({user:{id:'test'}}),useToast=()=>({});
const Save=()=>null,Users=()=>null,EmptyState=()=>null,Button=()=>null,savePlacements=()=>{},formatDate=v=>v;
const DataTable=()=>null,SelectField=()=>null;
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import[\s\S]*?;\r?\n/gm, ''), 'NewAdmissionPlacementPanel.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { NewAdmissionPlacementPanel } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const walk = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)]);

const props = {
  yearId: 'y',
  ageGroups: [
    { id: 'g2', shortName: 'Nhà trẻ' },
    { id: 'g3', shortName: 'Mẫu giáo bé' },
  ],
  targets: [
    { id: 'm1', name: 'Lớp Mầm 1', campusId: 'c1', ageGroupId: 'g3', capacity: 25, taken: 19 },
    { id: 'm2', name: 'Lớp Mầm 2', campusId: 'c2', ageGroupId: 'g3', capacity: 25, taken: 3 },
    { id: 'n1', name: 'Lớp Nhà trẻ 1', campusId: 'c1', ageGroupId: 'g2', capacity: 2, taken: 2 },
  ],
  admissions: [
    { admissionId: 'a1', fullName: 'TEST A', campusId: 'c1', ageGroupId: 'g3', targetClassId: null },
    { admissionId: 'a2', fullName: 'TEST B', campusId: 'c1', ageGroupId: 'g2', targetClassId: null },
    { admissionId: 'a3', fullName: 'TEST C', campusId: 'c1', ageGroupId: null, targetClassId: null },
  ],
  campusName: (id) => (id === 'c1' ? 'Cơ sở 1' : 'Cơ sở 2'),
  groupName: (id) => (id === 'g2' ? 'Nhà trẻ' : 'Mẫu giáo bé'),
  editable: true,
  onDirty: () => {},
  onSaved: () => {},
};

const tablesOf = () => walk(NewAdmissionPlacementPanel(props)).filter((n) => n.props?.columns);
const selectFor = (admissionId) => {
  for (const table of tablesOf()) {
    const row = table.props.rows.find((r) => r.admissionId === admissionId);
    if (row) {
      const cell = table.props.columns.find((c) => c.key === 'classroom').render(row);
      return walk(cell).find((n) => n.props?.['aria-label']?.startsWith('Lớp năm học mới'));
    }
  }
  return null;
};

test('danh sách gom theo nhóm tuổi, trẻ không khớp nhóm nào để cuối', () => {
  assert.deepEqual(
    tablesOf().map((t) => t.props.rows.map((r) => r.admissionId)),
    [['a2'], ['a1'], ['a3']],
  );
});

test('ô chọn lớp có cả nhóm tuổi khác trong cùng điểm trường, đúng nhóm gợi ý đứng trước', () => {
  const options = React.Children.toArray(selectFor('a1').props.children);
  assert.deepEqual(
    options.map((o) => o.props.value),
    ['m1', 'n1'],
  );
  assert.equal(React.Children.toArray(options[0].props.children).join(''), 'Lớp Mầm 1 · Mẫu giáo bé · Cơ sở 1 · 19/25');
});

test('lớp đầy không chọn được; trẻ không có nhóm gợi ý vẫn được xếp tay', () => {
  const full = React.Children.toArray(selectFor('a2').props.children);
  assert.equal(full[0].props.disabled, true);
  assert.equal(selectFor('a3').props.disabled, false);
  assert.deepEqual(
    React.Children.toArray(selectFor('a3').props.children)
      .map((option) => option.props.value)
      .sort(),
    ['m1', 'n1'],
  );
});
