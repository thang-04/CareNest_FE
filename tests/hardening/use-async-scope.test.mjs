import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deriveAsyncState } from '../../src/hooks/asyncState.js';

// Mô phỏng state của useAsync qua các bước: mỗi phạm vi (deps) là một token riêng
const campusA = {};
const campusB = {};
const rowsA = [{ id: 'lop-a1' }];
const rowsB = [{ id: 'lop-b1' }];

test('lần tải đầu: chưa có dữ liệu ⇒ initialLoading, không refreshing', () => {
  const s = deriveAsyncState({ scope: campusA, dataScope: null, loading: false });
  assert.equal(s.data, null);
  assert.equal(s.loading, true, 'render đầu (trước effect) đã báo đang tải');
  assert.equal(s.initialLoading, true);
  assert.equal(s.refreshing, false);
});

test('tải xong cùng phạm vi: trả dữ liệu, hết loading', () => {
  const s = deriveAsyncState({ scope: campusA, data: rowsA, dataScope: campusA, loading: false });
  assert.equal(s.data, rowsA);
  assert.equal(s.stale, null);
  assert.equal(s.loading, false);
  assert.equal(s.initialLoading, false);
  assert.equal(s.refreshing, false);
});

test('đổi phạm vi: không lộ dữ liệu phạm vi cũ như dữ liệu hiện tại, đưa sang stale và refreshing', () => {
  // Render ngay sau khi đổi deps: effect chưa chạy nên loading state vẫn false
  const s = deriveAsyncState({ scope: campusB, data: rowsA, dataScope: campusA, loading: false });
  assert.equal(s.data, null, 'code cũ dùng data không thao tác được trên dòng của cơ sở A');
  assert.equal(s.stale, rowsA);
  assert.equal(s.loading, true, 'code cũ kiểu `if (loading) …; data.map` không vỡ');
  assert.equal(s.initialLoading, false);
  assert.equal(s.refreshing, true);
});

test('phạm vi mới tải xong: chỉ dữ liệu phạm vi mới', () => {
  const s = deriveAsyncState({ scope: campusB, data: rowsB, dataScope: campusB, loading: false });
  assert.equal(s.data, rowsB);
  assert.equal(s.stale, null);
  assert.equal(s.loading, false);
});

test('tải lại không im lặng cùng phạm vi: giữ dữ liệu, refreshing (tương thích hành vi cũ)', () => {
  const s = deriveAsyncState({ scope: campusA, data: rowsA, dataScope: campusA, loading: true });
  assert.equal(s.data, rowsA);
  assert.equal(s.loading, true);
  assert.equal(s.refreshing, true);
  assert.equal(s.initialLoading, false);
});

test('lỗi chỉ thuộc phạm vi đã lỗi; phạm vi mới không mang lỗi cũ', () => {
  const err = Object.assign(new Error('Không tải được'), { status: 500 });
  const failedA = deriveAsyncState({ scope: campusA, dataScope: null, error: err, errorScope: campusA, loading: false });
  assert.equal(failedA.error, err);
  assert.equal(failedA.loading, false, 'lỗi đã về ⇒ hết đang tải để hiện ErrorState');
  const switched = deriveAsyncState({ scope: campusB, dataScope: null, error: err, errorScope: campusA, loading: false });
  assert.equal(switched.error, null);
  assert.equal(switched.loading, true);
});

test('lỗi phạm vi mới khi còn dữ liệu cũ: không trả dữ liệu cũ làm data', () => {
  const err = new Error('403');
  const s = deriveAsyncState({ scope: campusB, data: rowsA, dataScope: campusA, error: err, errorScope: campusB, loading: false });
  assert.equal(s.data, null);
  assert.equal(s.error, err);
  assert.equal(s.loading, false);
});

test('tắt enabled: không báo đang tải dù chưa có dữ liệu', () => {
  const s = deriveAsyncState({ scope: campusA, enabled: false, dataScope: null, loading: false });
  assert.equal(s.loading, false);
  assert.equal(s.initialLoading, false);
  assert.equal(s.data, null);
});

test('useAsync giữ các khóa trả về cũ và thêm khóa phạm vi', () => {
  const src = readFileSync(new URL('../../src/hooks/useAsync.js', import.meta.url), 'utf8');
  assert.match(src, /deriveAsyncState\(/);
  assert.match(src, /return \{ \.\.\.view, setData, reload: run \}/);
  const keys = Object.keys(deriveAsyncState({ scope: campusA }));
  for (const key of ['data', 'loading', 'error', 'stale', 'initialLoading', 'refreshing']) assert.ok(keys.includes(key), key);
});
