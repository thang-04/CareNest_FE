import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { mealRowState } = await import('@/utils/attendance/mealRowState');

const row = (mealRegistered, meals) => ({ child: { mealRegistered }, record: meals && { meals } });
const eaten = { LUNCH: true, AFTERNOON: true };

test('a locked day keeps the meals saved before the child stopped registering meals', () => {
  assert.equal(mealRowState(row(false, eaten), { editable: false }), 'SAVED');
  assert.equal(mealRowState(row(false, eaten), { editable: true, baseLocked: true }), 'SAVED');
});

test('an unregistered child without saved meals, or on a day still open, shows no meals', () => {
  assert.equal(mealRowState(row(false, { LUNCH: false }), { editable: false }), 'UNREGISTERED');
  assert.equal(mealRowState(row(false), { editable: false }), 'UNREGISTERED');
  assert.equal(mealRowState(row(false, eaten), { editable: true, baseLocked: false }), 'UNREGISTERED');
});

test('a registered child is unchanged', () => {
  assert.equal(mealRowState(row(true, eaten), { editable: false }), 'REGISTERED');
  assert.equal(mealRowState(row(undefined), { editable: true }), 'REGISTERED');
});

test('the attendance screen uses that state for the label and the meal cell', () => {
  const page = readFileSync(new URL('../../src/pages/attendance/AttendancePage.jsx', import.meta.url), 'utf8');
  assert.match(page, /mealState === 'UNREGISTERED'/);
  assert.match(page, /mealState === 'SAVED'/);
});
