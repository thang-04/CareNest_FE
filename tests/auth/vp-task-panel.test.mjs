import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const vpTasks = await import('@/utils/account/vpTasks');
const vpAreas = await import('@/models/account/vpTaskAreas');

// Thẻ chỉ dùng context để lưu: thay bằng stub, giữ nguyên logic mảng thật qua globalThis
globalThis.__vp = { ...vpTasks, ...vpAreas };
const source = await readFile(new URL('../../src/components/permissions/VpTaskPanel.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*?;\r?\n/gm, '');
const stubs = `import React, { useEffect, useMemo, useRef, useState } from 'react';
const Icon = () => null, AlertTriangle = Icon, ChevronDown = Icon, Eye = Icon, PencilLine = Icon, ReasonModal = Icon;
const useAuth = () => ({ user: {} }), useToast = () => ({}), updatePermissionOverrides = async () => {};
const { VP_PLACE, VP_TASK_PRESETS, VP_VIEW_CODE, VP_AREA_STATE, applyVpPreset, setVpArea, setVpTask, setVpTaskScope,
  vpAreaStatusText, vpAreasView, vpChangeTexts, vpDraftChanges, vpDraftOf, vpEditSummary, vpOverridesFromDraft,
  vpPlaceText, vpViewOff } = globalThis.__vp;
`;
const { code } = await transformWithOxc(stubs + isolated, 'VpTaskPanel.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { VpTaskPanel } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

const item = (code, on = false, extra = {}) => ({ code, label: code, roleOn: on, on, effect: 'INHERIT', scope: null, campusScoped: false, ...extra });
const render = (items, props = {}) =>
  renderToStaticMarkup(
    React.createElement(VpTaskPanel, { staff: { userId: 1, fullName: 'A' }, campusName: 'Cơ sở 1', items, ...props }),
  );

test('AUTH-20: PHT không có mã sửa vẫn ghi xem được cả trường, mảng ghi Chỉ xem, không có chữ Không được làm', () => {
  const html = render([item('CHILD_PROFILE_VIEW', true), item('MENU_MANAGE'), item('CHILD_ENROLL')]);
  assert.match(html, /Xem được dữ liệu của cả trường/);
  assert.match(html, /Chưa được giao sửa mảng nào/);
  assert.match(html, /Chỉ xem, không sửa được/);
  assert.doesNotMatch(html, /Không được làm|Theo vai trò|Cấp thêm|campus/);
});

test('AUTH-20: câu tóm tắt nêu mảng và nơi áp dụng', () => {
  const html = render([
    item('CHILD_PROFILE_VIEW', true),
    item('MENU_MANAGE', true, { effect: 'GRANT' }),
    item('STOCK_MANAGE', true, { effect: 'GRANT', scope: 'CAMPUS', campusScoped: true }),
  ]);
  assert.match(html, /Được sửa: Bán trú \(Cả trường, Cơ sở 1\)/);
});

test('AUTH-10: đang xem năm không hoạt động thì chỉ đọc, không có giao nhanh', () => {
  const html = render([item('CHILD_PROFILE_VIEW', true), item('MENU_MANAGE')], { readOnly: true });
  assert.doesNotMatch(html, /Giao nhanh/);
  assert.match(html, /Chọn năm đang hoạt động để sửa/);
  assert.match(html, /disabled/);
});

test('AUTH-20: quyền xem hồ sơ trẻ bị tắt thì cảnh báo, không ghi xem được cả trường', () => {
  const html = render([item('CHILD_PROFILE_VIEW', false, { roleOn: true }), item('MENU_MANAGE')]);
  assert.match(html, /đang bị tắt quyền xem hồ sơ trẻ/);
  assert.match(html, /Bật lại/);
  assert.doesNotMatch(html, /Xem được dữ liệu của cả trường/);
});
