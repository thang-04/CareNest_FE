import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import * as models from '@/models/children/healthExamForm';
import * as hints from '@/utils/children/healthExamHints';
import { validateHealthExam } from '@/utils/children/healthExamValidation';

const MESSAGE = 'Nhập nhiệt độ gồm 2 chữ số, tối đa 2 chữ số sau dấu phẩy (vd 36,5)';
const VITALS = { label: '1-3 tuổi', temperature: { feverFrom: 37.5, hypothermiaBelow: 35.5 }, pulse: { min: 80, max: 130 }, respiratoryRate: { min: 20, max: 40 } };

test('temperatureFormatError: dạng sai bị chặn, dạng đúng và ô trống không báo lỗi', () => {
  for (const bad of ['3115345', '9,5', '36,555', '365', '36,', 'abc', '-36']) assert.equal(hints.temperatureFormatError(bad), MESSAGE, bad);
  for (const ok of ['36', '36,5', '36.5', '36.55', '36,55', '', null, undefined]) assert.equal(hints.temperatureFormatError(ok), '', String(ok));
});

test('temperatureForBe: đổi dấu phẩy thành số; chuỗi sai dạng giữ nguyên để BE báo lỗi đúng ô', () => {
  assert.equal(hints.temperatureForBe('36,5'), 36.5);
  assert.equal(hints.temperatureForBe('36.55'), 36.55);
  assert.equal(hints.temperatureForBe('36'), 36);
  assert.equal(hints.temperatureForBe('36,555'), 36.555);
  assert.equal(hints.temperatureForBe('36,5a'), '36,5a');
  assert.equal(hints.temperatureForBe('abc'), 'abc');
  assert.equal(hints.temperatureForBe(''), '');
});

test('vitalStatusFor: nhiệt độ chỉ phân loại khi giá trị hợp lệ, nhận cả dấu phẩy', () => {
  assert.equal(hints.vitalStatusFor('temperatureC', '3115345', VITALS), null);
  assert.equal(hints.vitalStatusFor('temperatureC', '9,5', VITALS), null);
  assert.equal(hints.vitalStatusFor('temperatureC', '', VITALS), null);
  assert.equal(hints.vitalStatusFor('temperatureC', '38,2', VITALS).status, 'FEVER');
  assert.equal(hints.vitalStatusFor('temperatureC', '36.5', VITALS).status, 'NORMAL');
  assert.equal(hints.vitalStatusFor('temperatureC', '35,2', VITALS).status, 'HYPOTHERMIA');
  assert.equal(hints.vitalStatusFor('pulse', '140', VITALS).status, 'FAST');
});

test('validateHealthExam: ô nhiệt độ sai dạng báo đúng câu BE', () => {
  const run = (temperatureC) => validateHealthExam({ exam: { vitals: { temperatureC } } })['exam.vitals.temperatureC'];
  assert.equal(run('3115345'), MESSAGE);
  assert.equal(run('36,555'), MESSAGE);
  assert.equal(run('9,5'), MESSAGE);
  assert.equal(run('36,'), MESSAGE);
  assert.equal(run(36.5), undefined);
});

const source = (name) => readFile(new URL(`../../src/components/children/exam/${name}`, import.meta.url), 'utf8');
const stripImports = (s) => s.replace(/^import [^;]*;\r?\n/gm, '');
const header = `import React, { useId } from 'react';
const { EXAM_STEPS, HEAD_STATUS_OPTIONS, NUTRITION_STATUS, NUTRITION_STATUS_OPTIONS, VITAL_ITEMS, labelOf } = globalThis.__models;
const { formatDecimal, headStatusFor, vitalStatusFor, temperatureTypingError } = globalThis.__hints;
const Info = () => null;
const FormField = ({ children }) => children;
`;
globalThis.__models = models;
globalThis.__hints = hints;
const { code } = await transformWithOxc(
  header + stripImports(await source('ExamFields.jsx')) + stripImports(await source('ExamMeasureStep.jsx')),
  'ExamMeasureStep.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { ExamMeasureStep } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const React = await import('react');

const render = (temperatureC, errors = {}) => {
  const exam = models.buildEmptyExam();
  exam.vitals.temperatureC = temperatureC;
  const form = { heightCm: '', weightKg: '', headCircumferenceCm: '', exam };
  const reference = { vitals: VITALS, headApplies: false };
  return renderToStaticMarkup(
    React.createElement(ExamMeasureStep, { form, set: () => {}, setMany: () => {}, errors, reference, disabled: false }),
  );
};
const temperatureInput = (html) => html.match(/<input[^>]*aria-labelledby="[^"]*-temperatureC"[^>]*>/)?.[0] ?? '';

test('ô nhiệt độ: nhập 3115345 thì hiện lỗi ngay dưới ô', () => {
  const html = render('3115345');
  assert.ok(html.includes(MESSAGE), 'có câu lỗi');
  assert.match(temperatureInput(html), /aria-invalid="true"/);
});

test('ô nhiệt độ: đang gõ dở (tiền tố hợp lệ) chưa báo lỗi, chữ không thể hợp lệ thì báo ngay', () => {
  for (const prefix of ['3', '36', '36,', '36,5', '9,5']) assert.ok(!render(prefix).includes(MESSAGE), prefix);
  for (const bad of ['311', '3115345', '36,555', '36,5a']) assert.ok(render(bad).includes(MESSAGE), bad);
});

test('ô nhiệt độ: nhận dấu phẩy, không lỗi và ô là text để gõ được dấu phẩy', () => {
  const html = render('36,5');
  assert.ok(!html.includes(MESSAGE));
  assert.match(temperatureInput(html), /type="text"/);
  assert.match(temperatureInput(html), /inputMode="decimal"/);
});

test('ô nhiệt độ: lỗi BE theo khóa exam.vitals.temperatureC hiện đúng ô này', () => {
  const html = render('36,5', { 'exam.vitals.temperatureC': 'Lỗi từ BE' });
  assert.ok(html.includes('Lỗi từ BE'));
});

test('ô mạch vẫn là ô số', () => {
  const html = render('');
  assert.match(html.match(/<input[^>]*aria-labelledby="[^"]*-pulse"[^>]*>/)?.[0] ?? '', /type="number"/);
});
