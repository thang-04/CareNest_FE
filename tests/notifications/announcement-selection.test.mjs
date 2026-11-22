import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyAnnouncementSelection,
  toggleAnnouncementSelection,
  announcementIsSelected,
  announcementSelectionCount,
  announcementSelectionRequest,
} from '../../src/components/announcement/announcementSelection.mjs';

test('tick từng dòng giữ id qua các trang; bỏ chọn không đụng lựa chọn khác', () => {
  let selection = emptyAnnouncementSelection();
  selection = toggleAnnouncementSelection(selection, 1);
  selection = toggleAnnouncementSelection(selection, 25);
  assert.equal(announcementSelectionCount(selection, 42), 2);
  assert.equal(announcementIsSelected(selection, { id: 25, canDelete: true }), true);
  assert.equal(announcementIsSelected(selection, { id: 25, canDelete: false }), false);
  selection = toggleAnnouncementSelection(selection, 1);
  assert.deepEqual(selection.ids, [25]);
});

test('chọn tất cả trên mọi trang rồi bỏ tick một dòng dùng excludedIds', () => {
  let selection = { allMatching: true, ids: [], excludedIds: [] };
  assert.equal(announcementSelectionCount(selection, 42), 42);
  selection = toggleAnnouncementSelection(selection, 25);
  assert.equal(announcementSelectionCount(selection, 42), 41);
  assert.equal(announcementIsSelected(selection, { id: 25, canDelete: true }), false);
  assert.equal(announcementIsSelected(selection, { id: 41, canDelete: true }), true);
  const request = announcementSelectionRequest(selection, { q: 'họp', status: 'CANCELLED' });
  assert.deepEqual(request, { allMatching: true, ids: [], excludedIds: [25], q: 'họp', status: 'CANCELLED' });
  selection = toggleAnnouncementSelection(selection, 25);
  assert.equal(announcementSelectionCount(selection, 42), 42);
  assert.deepEqual(request.excludedIds, [25]);
  assert.equal(announcementSelectionCount(emptyAnnouncementSelection(), 42), 0);
});
