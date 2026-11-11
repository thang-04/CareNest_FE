import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import {
  withDefaults,
  DEFAULT_WORKFLOW_POLICY,
  WORKFLOW_ROLES,
  CREATOR_ROLES,
  REVIEWER_ROLES,
  SIGN_DOCS,
} from '@/models/education-plan/eduConfig';
import { STANDARD_DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { DOMAIN_ROMAN } from '@/models/education-plan/goalTable';

const source = await readFile(new URL('../../src/pages/education-plan/EduConfigPage.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const constants = { DEFAULT_WORKFLOW_POLICY, WORKFLOW_ROLES, CREATOR_ROLES, REVIEWER_ROLES, SIGN_DOCS, STANDARD_DOMAINS, DOMAIN_ROMAN };
const stubs = `
import React, { useState } from ${JSON.stringify(import.meta.resolve('react'))};
const { DEFAULT_WORKFLOW_POLICY, WORKFLOW_ROLES, CREATOR_ROLES, REVIEWER_ROLES, SIGN_DOCS, STANDARD_DOMAINS, DOMAIN_ROMAN } = ${JSON.stringify(constants)};
export const context = { config: ${JSON.stringify({ ...withDefaults(), canConfigure: true })} };
const useEffect = () => {}, useLayoutEffect = () => {};
const useEducationPlan = () => ({ eduConfig: context.config });
const useManualSave = (options) => { context.saver = options; return { unsaved: false, label: 'Đã lưu' }; };
const useLeaveGuard = (options) => { context.guard = options; return { modal: {} }; };
const Card = ({title,children}) => <section><h2>{title}</h2>{children}</section>;
const Notice = ({children}) => <p>{children}</p>;
const PageHead = ({title}) => <h1>{title}</h1>;
const Cell = ({editable,value,label}) => editable ? <textarea aria-label={label} defaultValue={value}/> : <span>{value}</span>;
const SortableList = ({children}) => <>{children}</>;
const SortableRow = ({children,as:Tag='tr'}) => <Tag>{children}</Tag>;
const SortIndex = ({index}) => <span>{index + 1}</span>;
const Check = () => <span>Có</span>;
const Pencil = () => null, Save = () => null, Trash2 = () => null, X = () => null;
const RenumberButton = () => <button>Đánh lại số</button>;
const SortButtons = () => <button>Sắp xếp</button>, SortHandle = () => <button>Kéo</button>;
const ConfirmationModal = () => null, LeaveConfirmModal = () => null, focusCell = () => {};
`;
const { code } = await transformWithOxc(stubs + isolated, 'EduConfigPage.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { default: EduConfigPage, context } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('cấu hình mở ở chế độ xem, phải bấm Chỉnh sửa trước khi nhập hoặc lưu', () => {
  for (const canConfigure of [true, false]) {
    context.config.canConfigure = canConfigure;
    const html = renderToStaticMarkup(React.createElement(EduConfigPage));
    assert.match(html, /btn btn--sm btn--outline-primary[^>]*>\s*Chỉnh sửa<\/button>/);
    assert.doesNotMatch(html, /<(?:input|textarea|select)\b|>Lưu<\/button>|>Xóa<\/th>|>Sắp xếp<\/th>/);
    assert.match(html, /Lĩnh vực giáo dục/);
    assert.match(html, /Các dòng hoạt động của kế hoạch tuần/);
    assert.equal(context.saver.enabled, false);
    assert.equal(context.saver.doc, null);
    assert.equal(context.guard.when, false);
  }
});
