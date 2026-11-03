import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePlanImportFile } from '../../src/utils/education-plan/planImportFile.js';

test('bốn định dạng theo contract BE, không phụ thuộc MIME của hệ điều hành', () => {
  for (const name of ['plan.doc', 'plan.DOCX', 'plan.xlsx', 'plan.CSV']) {
    assert.equal(validatePlanImportFile({ name, size: 2 * 1024 * 1024, type: '' }), null);
  }
  for (const file of [null, { name: 'x.pdf', size: 10 }, { name: 'x.docx.exe', size: 10 }, { name: 'x.doc', size: 0 }, { name: 'x.doc', size: 2097153 }]) {
    assert.ok(validatePlanImportFile(file));
  }
});
