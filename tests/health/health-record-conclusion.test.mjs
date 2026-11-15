import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '../../src/models/children/childrenConstants.js';
import { CAMPAIGN_KIND } from '../../src/models/children/healthCheckConstants.js';

/*
 * Sổ sức khỏe (user yêu cầu 2026-11-10): cột "Kết luận sức khỏe" theo loại đợt — đợt khám ⇒ kết luận bác sĩ, kỳ cân đo / ngoài
 * đợt ⇒ mức BMI. Dữ liệu giả.
 */
async function loadView(path, stubs) {
  const source = await readFile(new URL(`../../src/${path}`, import.meta.url), 'utf8');
  const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '').replace(/^import '[^']+';\r?\n/gm, '');
  const { code } = await transformWithOxc(`import React from 'react';\n${stubs}\n${isolated}`, path, {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
  );
}

const { HealthWarningCell } = await loadView(
  'components/children/HealthWarningCell.jsx',
  `
const MEASUREMENT_SOURCE=${JSON.stringify(MEASUREMENT_SOURCE)}, MEASUREMENT_SOURCE_LABELS=${JSON.stringify(MEASUREMENT_SOURCE_LABELS)};
const CAMPAIGN_KIND=${JSON.stringify(CAMPAIGN_KIND)};
const formatNumber=(v)=>String(v);
const BmiStatusBadge=({status})=><i>{status}</i>, ConclusionCategoryBadge=({status})=><b>{status}</b>;
`,
);

const cell = (measurement) => renderToStaticMarkup(React.createElement(HealthWarningCell, { measurement, variant: 'conclusion' }));

const doctor = { conclusionCategory: 'ISSUE', conclusion: { issueText: 'Thiếu cân so với tuổi.' } };
const bmi = { bmi: 32, bmiStatus: 'OBESE' };

test('đợt khám: kết luận bác sĩ, không hiện mức BMI', () => {
  const html = cell({ source: MEASUREMENT_SOURCE.EXAM, campaignKind: CAMPAIGN_KIND.EXAM, ...doctor, ...bmi });
  assert.match(html, /<b>ISSUE<\/b>/);
  assert.match(html, /Thiếu cân so với tuổi\./);
  assert.doesNotMatch(html, /OBESE|BMI/);
});

test('đợt khám chưa có kết luận bác sĩ (dữ liệu cũ): ghi —, không thay bằng BMI', () => {
  const html = cell({ source: MEASUREMENT_SOURCE.LEGACY, campaignKind: CAMPAIGN_KIND.EXAM, conclusionCategory: null, ...bmi });
  assert.match(html, /—/);
  assert.doesNotMatch(html, /OBESE|BMI/);
});

test('kỳ cân đo và lần đo ngoài đợt: mức BMI kèm số BMI', () => {
  for (const campaignKind of [CAMPAIGN_KIND.MEASUREMENT, null]) {
    const html = cell({ source: MEASUREMENT_SOURCE.MEASUREMENT_ONLY, campaignKind, ...bmi });
    assert.match(html, /<i>OBESE<\/i>/);
    assert.match(html, /BMI 32/);
    assert.doesNotMatch(html, /<b>/);
  }
});
