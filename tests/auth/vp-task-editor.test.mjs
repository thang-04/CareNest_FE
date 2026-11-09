import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const vpTasks = await import('@/utils/account/vpTasks');
const vpAreas = await import('@/models/account/vpTaskAreas');

// Khung giao việc chỉ dùng context/modal để lưu: thay bằng stub, giữ nguyên logic thật qua globalThis
globalThis.__vp = { ...vpTasks, ...vpAreas };
const source = await readFile(new URL('../../src/components/permissions/VpTaskEditor.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*?;\r?\n/gm, '');
const names = source.match(/import \{([^}]*)\} from '@\/utils\/account\/vpTasks'/)[1];
const stubs = `import React, { useEffect, useRef, useState } from 'react';
const Icon = () => null, AlertTriangle = Icon, ArrowRight = Icon, Buildings = Icon, Check = Icon, Info = Icon, Lock = Icon, MapPin = Icon;
const Minus = Icon, Plus = Icon, Undo2 = Icon, X = Icon, Avatar = Icon, ReasonModal = Icon;
const Switch = ({ checked, label, disabled }) => React.createElement('button', { role: 'switch', 'aria-checked': checked, 'aria-label': label, disabled });
const useAuth = () => ({ user: {} }), useToast = () => ({}), updatePermissionOverrides = async () => {};
const { VP_PLACE, VP_VIEW_CODE, ${names} } = globalThis.__vp;
`;
const { code } = await transformWithOxc(stubs + isolated, 'VpTaskEditor.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const mod = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

const item = (code, on = false, extra = {}) => ({
  code,
  label: code,
  roleOn: on,
  on,
  effect: 'INHERIT',
  scope: null,
  campusScoped: false,
  ...extra,
});
const mealItems = (allOn = false) => [
  item('CHILD_PROFILE_VIEW', true),
  item('MENU_MANAGE', allOn),
  item('NUTRITION_MANAGE', allOn),
  item('MEAL_COUNT_CONFIRM', allOn, { campusScoped: true }),
  item('STOCK_MANAGE', allOn, { campusScoped: true }),
  item('FOOD_SAFETY_APPROVE', allOn, { campusScoped: true }),
  item('CHILD_ENROLL'),
];
const person = (userId, fullName, items) => ({ userId, fullName, campusId: String(userId), campusName: `Cơ sở ${userId}`, items });
const campuses = [
  { id: '1', shortName: 'Cơ sở 1' },
  { id: '2', shortName: 'Cơ sở 2' },
];
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('AUTH-10: danh sách PHT gắn nhãn màu điểm trường, mảng phụ trách và số việc được sửa', () => {
  const html = render(mod.VpPeopleList, {
    people: [
      { userId: 1, user: { fullName: 'An' }, campusName: 'Cơ sở 1', items: mealItems(true) },
      { userId: 2, user: { fullName: 'Bình' }, campusName: null },
      { userId: 3, user: { fullName: 'Chi' }, campusName: 'Cơ sở 2', error: new Error('x') },
    ],
    selectedId: 1,
    onSelect: () => {},
  });
  assert.match(html, /class="chip chip--blue"[^>]*> Cơ sở 1/);
  assert.match(html, /class="chip chip--teal"[^>]*> Dinh dưỡng/);
  assert.match(html, /class="chip chip--green"[^>]*>Sửa 5\/6 việc/);
  assert.match(html, /class="chip chip--orange">Chưa có điểm trường/);
  assert.match(html, /class="chip chip--red">Chưa tải được việc/);
  assert.match(html, /aria-current="true"/);
  // Người đang chọn có nhãn chữ, không chỉ đổi màu nền; chỉ một người mang nhãn
  assert.equal(html.match(/class="pick-badge"[^>]*> Đang chọn/g)?.length, 1);
});

test('AUTH-20: mỗi việc một công tắc; việc đang bật và chọn được nơi thì có nút Cơ sở / Cả trường', () => {
  const items = mealItems();
  items[3] = { ...items[3], on: true, roleOn: true };
  const html = render(mod.VpTaskEditor, { person: person(1, 'An', items), others: [person(2, 'Bình', mealItems(true))], campuses });
  assert.match(html, /role="switch" aria-checked="true" aria-label="Được sửa: Xác nhận, điều chỉnh số suất ăn"/);
  assert.match(html, /role="radiogroup" aria-label="Nơi được sửa: Xác nhận, điều chỉnh số suất ăn"/);
  assert.match(html, /aria-checked="true" class="tab tab--active"[^>]*>Cơ sở 1/);
  assert.match(html, /PHT khác đang sửa: Bình \(Cơ sở 2\)/);
  assert.match(html, /được sửa 1\/5 việc/);
  // Trạng thái từng việc ghi bằng chữ cạnh công tắc
  assert.match(html, /vp-task-row__state is-on"[^>]*> Được sửa/);
  assert.match(html, /vp-task-row__state"[^>]*>Chỉ xem/);
  // Mỗi nhóm phạm vi nói rõ sửa ở đâu và vì sao
  assert.match(html, /Dùng chung cả trường/);
  assert.match(html, /Theo điểm trường — chọn được phạm vi/);
  assert.match(html, /Chỉ Cơ sở 1/);
  assert.match(html, /chỉ sửa ở điểm trường mình phụ trách/);
  assert.match(html, /\+ Phụ trách dinh dưỡng|Phụ trách dinh dưỡng<\/button>/);
  assert.match(html, /disabled="">Lưu<\/button>/);
});

test('AUTH-20: việc chưa ai được sửa thì cảnh báo dưới tên việc', () => {
  const html = render(mod.VpTaskEditor, { person: person(1, 'An', mealItems()), campuses });
  assert.match(html, /Chưa ai được sửa ở Cơ sở 1, Cơ sở 2/);
});

test('AUTH-10: năm không hoạt động thì khung chỉ đọc, không giao nhanh, không lưu', () => {
  const html = render(mod.VpTaskEditor, { person: person(1, 'An', mealItems()), campuses, readOnly: true });
  assert.doesNotMatch(html, /Phụ trách dinh dưỡng<\/button>/);
  assert.doesNotMatch(html, />Lưu<\/button>/);
  assert.match(html, /Chọn năm đang hoạt động để sửa/);
});

test('AUTH-20: ghi chú việc chưa PHT nào được sửa, thu gọn mặc định', () => {
  const html = render(mod.VpGapsNote, { people: [person(1, 'An', mealItems())], campuses });
  assert.match(html, /<details/);
  assert.match(html, /6 việc chưa giao cho Phó hiệu trưởng nào/);
  assert.equal(render(mod.VpGapsNote, { people: [], campuses }), '');
});
