import { SourceItemMark } from '@/components/education-plan/TeamSourceReview';
import { branchDateIssues } from '@/models/education-plan/branchTemplateSchedule.mjs';
import { removeThemeReferences } from '@/models/education-plan/planLevel.mjs';
import { fillGoalLabels, goalDisplayLabel } from '@/models/education-plan/goalLabels.mjs';
import { cloneElement, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash2, X } from '@/components/ui/icons';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import {
  DUPLICATE_ABBR_MESSAGE,
  duplicateAbbrThemeIds,
  duplicateNameIds,
  mixedSubDomains,
  numberGoals,
  domainRoman,
  durationRangeIssue,
  initialsOf,
  isBlankBreak,
  isBlankTheme,
  subDomainBranch,
  themeAbbr,
  themeGoalIds,
  isWholeWeekTheme,
  overlappingThemes,
  themeGapIssue,
  weekCount,
} from '@/models/education-plan/goalTable';
import { fmtDate } from '@/components/education-plan/eduUi';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import DatePickerCell from '@/components/education-plan/DatePickerCell';
import { suggestBreakDates, suggestThemeDates } from '@/models/education-plan/importThemes.mjs';
import { curriculumOptions } from '@/models/education-plan/curriculum.mjs';
import { useCurriculum } from '@/hooks/education-plan/useCurriculum';
import { normalizeText } from '@/utils/format';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { NATIVE_FIT, fitHeight } from '@/components/ui/TableCell';
import { moveItem } from '@/hooks/useSortableList';
import { RenumberButton, SortHandle, SortIndex, SortableList, SortableRow } from '@/components/ui/Sortable';

const uid = () => Math.random().toString(36).slice(2, 9);
const blankTheme = () => ({ id: uid(), name: '', abbr: '', festivals: '', start: '', end: '', note: '' });
const GROUP_HINT = 'Nhập kết quả mong đợi';
// Độ rộng tối thiểu (px) của cả nhóm cột chủ đề, vừa chữ "Chủ đề thực hiện"
const THEME_HEAD_MIN = 140;
const NEW_GOAL_HINT = 'Nhập mục tiêu mới';
const NO_BREAKS_HINT = 'Nhập đợt nghỉ mới';
const NO_BREAKS = 'Chưa có đợt nghỉ. Tuần trùng đợt nghỉ không được tính vào số tuần của chủ đề.';
/** ` "chữ"` để đưa vào câu hỏi xác nhận; ô trống ⇒ chuỗi rỗng. */
const quoted = (text) => {
  const t = (text || '').trim();
  return t ? ` "${t}"` : '';
};
const enterKey = (e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing;
const pastedLines = (e) =>
  (e.clipboardData?.getData('text') || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
// Chỉ đo lại ô có chữ đổi (đo mọi ô mỗi lần vẽ lại = hàng trăm lần tính lại bố cục mỗi phím, bước 2 giật vài giây);
// thêm 1 nhịp sau lần vẽ đầu vì lúc đó cột chưa có độ rộng thật
function CellInput(props) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (NATIVE_FIT) return undefined;
    fitHeight(ref.current);
    const id = requestAnimationFrame(() => fitHeight(ref.current));
    return () => cancelAnimationFrame(id);
  }, [props.value]);
  return <textarea className="ga-cell-input" rows={1} ref={ref} onInput={(e) => fitHeight(e.target)} {...props} />;
}
const cellInput = (props) => <CellInput {...props} />;

/** Đặt con trỏ vào ô vừa tạo sau lần vẽ lại; ô trong bảng đo lại chiều cao khi đổi cỡ cửa sổ. */
function useCellFocus() {
  const [focusId, setFocusId] = useState(null);
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[data-focus="${focusId}"]`);
    // Dòng mới nằm đúng chỗ đang gõ nên không cuộn trang khi chuyển con trỏ sang ô mới
    el?.focus({ preventScroll: true });
    el?.setSelectionRange?.(el.value.length, el.value.length);
    setFocusId(null);
  }, [focusId]);
  useEffect(() => {
    if (NATIVE_FIT) return undefined;
    const fitAll = () => document.querySelectorAll('.ga-cell-input').forEach(fitHeight);
    window.addEventListener('resize', fitAll);
    return () => window.removeEventListener('resize', fitAll);
  }, []);
  return setFocusId;
}

/** Bấm vào phần trống của ô (dưới ô nhập khi hàng cao hơn) cũng đặt con trỏ vào ô nhập, như bảng tính. */
// Bấm chỗ nào trong ô (cả dòng báo lỗi, khoảng đệm) cũng vào ô nhập của ô đó, như bảng tính (Tiền 31/10)
const focusCell = (e) => {
  if (e.target.closest('input, textarea, select, button, a, [role="button"]')) return;
  const input = e.target.closest('td')?.querySelector('.ga-cell-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
};
/* ---------- A. Mục tiêu nội dung giáo dục cuối độ tuổi ---------- */

/**
 * Chia hàng phẳng của một lĩnh vực thành tầng: lĩnh vực con → nhóm kết quả mong đợi → mục tiêu.
 * Hàng tiêu đề áp dụng cho các hàng bên dưới tới tiêu đề kế tiếp (như mục lục trong Word); tầng không có tiêu đề thì sub/group = null.
 * last: id hàng cuối của tầng (để chèn hàng mới ngay sau tầng đó).
 */
const toTiers = (rows) => {
  const blocks = [];
  let block = null;
  let group = null;
  const openBlock = (sub) => {
    block = { sub, groups: [], last: sub?.id || null };
    blocks.push(block);
    group = null;
  };
  const openGroup = (g) => {
    if (!block) openBlock(null);
    group = { group: g, goals: [], last: g?.id || block.last };
    block.groups.push(group);
  };
  rows.forEach((r) => {
    if (r.kind === 'sub') openBlock(r);
    else if (r.kind === 'group') {
      openGroup(r);
      block.last = r.id;
    } else {
      if (!group) openGroup(null);
      group.goals.push(r);
      group.last = r.id;
      block.last = r.id;
    }
  });
  if (!blocks.length) openBlock(null);
  return blocks;
};

/** Ô chữ kèm danh sách gợi ý (kiểu thả xuống search-select có sẵn): mở khi ô được chọn, lọc theo chữ đang gõ. */
function Suggest({ query, options, onPick, label, children, context, status, error, onRetry }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useRef(`suggest-${uid()}`).current;
  const q = normalizeText(query || '');
  const shown = error || status ? [] : options.filter((o) => !q || normalizeText(o.text).includes(q));
  const activeIndex = shown.findIndex((o) => o.key === active);
  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, listId]);
  const pick = (option) => {
    onPick(option);
    setOpen(false);
    setActive(null);
  };
  const keys = (event) => {
    if (event.nativeEvent.isComposing || event.shiftKey || event.target.tagName === 'SELECT') return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && shown.length) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
      const i =
        activeIndex < 0
          ? event.key === 'ArrowDown'
            ? 0
            : shown.length - 1
          : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      setActive(shown[i].key);
    } else if (open && event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      pick(shown[activeIndex]);
    } else if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActive(null);
    }
  };
  return (
    <div
      className="search-select ga-curriculum-suggest"
      ref={anchorRef}
      onKeyDownCapture={keys}
      onClick={(e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!anchorRef.current?.contains(e.relatedTarget) && !panelRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {cloneElement(children, {
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': open,
        'aria-controls': open ? listId : undefined,
        'aria-activedescendant': open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
      })}
      {open && (
        <FloatingPanel anchorRef={anchorRef} panelRef={panelRef}>
          {context}
          {error ? (
            <div className="ga-suggest-state" role="alert">
              Không tải được gợi ý.{' '}
              <button type="button" className="link-btn" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          ) : status ? (
            <div className="ga-suggest-state" role="status">
              {status}
            </div>
          ) : (
            !shown.length && (
              <div className="ga-suggest-state" role="status">
                Không có gợi ý phù hợp trong phạm vi đang chọn.
              </div>
            )
          )}
          <div id={listId} className="search-select__list ga-curriculum-options" role="listbox" aria-label={label}>
            {!error &&
              !status &&
              shown.map((o, i) => (
                <button
                  type="button"
                  key={o.key}
                  id={`${listId}-${i}`}
                  tabIndex={-1}
                  role="option"
                  aria-selected={i === activeIndex}
                  className="search-select__option"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  {o.text}
                </button>
              ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

/**
 * Bảng mục tiêu theo mẫu MN Thái Dương: lĩnh vực con là dải tiêu đề đánh số, các tầng dưới là cột gộp dọc
 * (Nhóm kết quả mong đợi | STT | Mục tiêu | Nội dung | Chủ đề thực hiện: mỗi chủ đề một cột | Xóa).
 * Bấm ô chủ đề của một nội dung để tích / bỏ tích; ô đã tích hiện tên viết tắt của chủ đề như bản Word.
 * Thêm bằng cách gõ vào ô trống cuối mỗi tầng hoặc Enter trong ô cùng tầng; readOnly cho bước duyệt lại và trang chi tiết.
 */
export function GoalTable({
  domains,
  themes = [],
  numbers,
  onChange,
  readOnly: viewOnly = false,
  canAssignContents = false,
  canEditContents = false,
  fixedCells = false,
  editLabels = false,
  ageGroupId,
  canSuggest = true,
  suggestionScope = null,
  reviewItems = [],
  newItems = [],
}) {
  const readOnly = viewOnly || fixedCells;
  const setFocusId = useCellFocus();
  const edit = !readOnly && !fixedCells;
  const editContent = edit || canEditContents;
  const isEditing = Boolean(edit || canEditContents || canAssignContents);
  const catalog = useCurriculum(ageGroupId, { enabled: edit && canSuggest, scope: suggestionScope });
  const [sourceContexts, setSourceContexts] = useState({});
  const newRowIds = useRef(new Map());
  const existingRowIds = new Set(domains.flatMap((d) => d.rows.flatMap((r) => [r.id, ...(r.contents || []).map((c) => c.id)])));
  const allocateNewRowId = (slot) => {
    let id = newRowIds.current.get(slot);
    if (!id || existingRowIds.has(id)) {
      id = uid();
      newRowIds.current.set(slot, id);
    }
    return id;
  };
  const renderedContexts = useRef(new Set());
  renderedContexts.current = new Set();
  useEffect(() => {
    setSourceContexts((old) => {
      const keys = Object.keys(old).filter((key) => renderedContexts.current.has(key));
      return keys.length === Object.keys(old).length ? old : Object.fromEntries(keys.map((key) => [key, old[key]]));
    });
  }, [domains, ageGroupId, suggestionScope, canSuggest, edit]);
  const rowContext = (di, rowId) => {
    let sub = null;
    let group = null;
    for (const row of domains[di].rows) {
      if (row.kind === 'sub') {
        sub = row;
        group = null;
      }
      if (row.kind === 'group') group = row;
      if (row.id === rowId) break;
    }
    return { sub, group };
  };
  const sourceSuggest = (input, di, sub, group, kind, rowKey, onPick) => {
    if (!edit || !canSuggest) return input;
    const domain = domains[di];
    const key = JSON.stringify([
      suggestionScope,
      ageGroupId,
      domain.id,
      sub?.id,
      kind === 'group' ? null : group?.id,
      sub?.curriculumSubDomainId,
      kind === 'group' ? null : group?.curriculumExpectedResultId,
      rowKey,
    ]);
    renderedContexts.current.add(key);
    const manual = sourceContexts[key] || {};
    const mine = catalog.goals.filter((g) => g.domainName === domain.name);
    const linkedGroup = mine.find(
      (g) =>
        group?.curriculumExpectedResultId != null &&
        String(g.expectedResultId) === String(group.curriculumExpectedResultId) &&
        (sub?.curriculumSubDomainId == null || String(g.subDomainId) === String(sub.curriculumSubDomainId)),
    );
    const subId =
      sub?.curriculumSubDomainId ??
      (manual.subDomainId !== undefined
        ? manual.subDomainId
        : (linkedGroup?.subDomainId ?? (!sub && mine.some((g) => g.subDomainId == null) ? null : undefined)));
    const groupId = linkedGroup?.expectedResultId ?? manual.expectedResultId;
    const updateContext = (patch) => setSourceContexts((old) => ({ ...old, [key]: { ...manual, ...patch } }));
    const subOptions = [...new Map(mine.map((g) => [g.subDomainId ?? '@none', g])).values()];
    const groupOptions = curriculumOptions(mine, { domainName: domain.name, subDomainId: subId }, 'group');
    const options = curriculumOptions(mine, { domainName: domain.name, subDomainId: subId, expectedResultId: groupId }, kind);
    const context = (
      <div className="ga-suggest-context">
        {sub?.curriculumSubDomainId == null && !linkedGroup && subOptions.length > 0 && (
          <label>
            Lĩnh vực con nguồn
            <select
              className="select"
              aria-label="Lĩnh vực con nguồn"
              value={subId === null ? '@none' : (subId ?? '')}
              onChange={(e) =>
                updateContext({ subDomainId: e.target.value === '@none' ? null : e.target.value || undefined, expectedResultId: undefined })
              }
            >
              <option value="">Chọn lĩnh vực con nguồn</option>
              {subOptions.map((g) => (
                <option key={g.subDomainId ?? '@none'} value={g.subDomainId ?? '@none'}>
                  {g.subDomain || 'Không có lĩnh vực con'}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind !== 'group' && !linkedGroup && subId !== undefined && (
          <label>
            Kết quả mong đợi nguồn
            <select
              className="select"
              aria-label="Kết quả mong đợi nguồn"
              value={groupId ?? ''}
              onChange={(e) => updateContext({ expectedResultId: e.target.value || undefined })}
            >
              <option value="">Chọn kết quả mong đợi nguồn</option>
              {groupOptions.map((o) => (
                <option key={o.key} value={o.patch.curriculumExpectedResultId}>
                  {o.text}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
    const status = catalog.loading
      ? 'Đang tải gợi ý…'
      : !catalog.goals.length
        ? 'Chưa có dữ liệu của Bộ cho nhóm tuổi này.'
        : subId === undefined
          ? 'Chọn lĩnh vực con nguồn để xem gợi ý.'
          : kind !== 'group' && groupId == null
            ? 'Chọn kết quả mong đợi nguồn để xem gợi ý.'
            : '';
    return (
      <Suggest
        key={key}
        query={input.props.value}
        options={options}
        context={context}
        status={status}
        error={catalog.error}
        onRetry={catalog.reload}
        label={`Gợi ý ${kind === 'group' ? 'kết quả mong đợi' : kind === 'goal' ? 'mục tiêu' : 'nội dung giáo dục'}`}
        onPick={(option) => {
          if (canSuggest && edit && !catalog.loading && !catalog.error && !status && options.some((o) => o.key === option.key))
            onPick(option);
        }}
      >
        {input}
      </Suggest>
    );
  };
  const [labelFill, setLabelFill] = useState(null);
  const fillRef = useRef(null);
  const [labelError, setLabelError] = useState(null);
  const labelGoals = domains.flatMap((d) => d.rows.filter((r) => r.kind === 'goal' && r.text.trim()));
  const updateFill = (range) => {
    fillRef.current = range;
    setLabelFill(range);
    setLabelError(null);
  };
  const commitFill = () => {
    const range = fillRef.current;
    updateFill(null);
    if (!range || !edit || !editLabels) return;
    try {
      onChange(fillGoalLabels(domains, range.source, range.target, numbers));
    } catch (error) {
      setLabelError(error.message);
    }
  };
  useEffect(() => {
    if (!labelFill || labelFill.keyboard) return undefined;
    const cancel = () => updateFill(null);
    const escape = (event) => {
      if (event.key === 'Escape') cancel();
    };
    document.addEventListener('pointerup', commitFill);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerup', commitFill);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', escape);
    };
  });
  const fillKeys = (event, id) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      updateFill(null);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (fillRef.current) commitFill();
      else updateFill({ source: id, target: id, keyboard: true });
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const range = fillRef.current || { source: id, target: id, keyboard: true };
      const index = labelGoals.findIndex((r) => r.id === range.target);
      const target = labelGoals[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (target) updateFill({ ...range, target: target.id, keyboard: true });
    }
  };
  const fillIds = new Set();
  if (labelFill) {
    const source = labelGoals.findIndex((r) => r.id === labelFill.source);
    const target = labelGoals.findIndex((r) => r.id === labelFill.target);
    for (let i = Math.min(source, target); i <= Math.max(source, target); i++) {
      if (labelGoals[i]) fillIds.add(labelGoals[i].id);
    }
  }
  const cols = 4 + themes.length + (edit ? 1 : 0);
  // EDU-51: tên trùng trong cùng lĩnh vực con báo đỏ tại ô; chặn ở bước gửi / ban hành
  const dupNames = edit ? duplicateNameIds(domains) : new Set();
  const mixed = new Set(edit ? mixedSubDomains(domains) : []);
  const dupHint = (id, text) =>
    dupNames.has(id) && (
      <div className="ga-goal-table__pad text-xs text-danger text-right" role="alert">
        {text}
      </div>
    );
  // Ô gộp các cột STT, Mục tiêu, Nội dung và các cột chủ đề cho các hàng "thêm mới"
  const restSpan = 3 + themes.length;

  // Giữ nguyên thứ tự dòng (Tiền 05/11): dòng đứng trước lĩnh vực con đầu tiên thuộc thẳng lĩnh vực, không bị dồn vào lĩnh vực con
  const updRows = (di, fn) => onChange(domains.map((d, i) => (i === di ? { ...d, rows: fn(d.rows) } : d)));
  const patchRow = (di, rid, patch) => updRows(di, (rows) => rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const mapContents = (di, rid, fn) => updRows(di, (rows) => rows.map((r) => (r.id === rid ? { ...r, contents: fn(r.contents) } : r)));
  const removeRow = (di, rid) => updRows(di, (rows) => rows.filter((r) => r.id !== rid));
  // Xóa nhóm kết quả mong đợi kéo theo toàn bộ mục tiêu và nội dung bên dưới nhóm
  const removeGroup = (di, gr) => {
    const ids = new Set([gr.group.id, ...gr.goals.map((r) => r.id)]);
    updRows(di, (rows) => rows.filter((r) => !ids.has(r.id)));
  };
  // Mọi nút xóa trong bảng mục tiêu đều hỏi lại trước khi xóa (như bảng chủ đề)
  const [pendingDelete, setPendingDelete] = useState(null);
  const askDelete = (title, message, run) => setPendingDelete({ title, message: `${message} Thay đổi chỉ lưu khi bấm Lưu.`, run });
  // Chọn khi xóa lĩnh vực con có tên (Tiền 05/11): 'keep' chỉ bỏ thanh lĩnh vực con, 'branch' xóa cả nhánh (EDU-48)
  const [subDeleteMode, setSubDeleteMode] = useState('keep');
  const askDeleteSubDomain = (di, sub, subNo) => {
    const rows = domains[di].rows;
    const branch = subDomainBranch(rows, sub.id);
    const ids = new Set(branch.map((row) => row.id));
    const removeSubOnly = () => updRows(di, (list) => list.filter((row) => row.id !== sub.id));
    // EDU-53: bỏ lĩnh vực con đầu tiên mà còn lĩnh vực con khác thì các dòng tạm nằm ngoài lĩnh vực con: đầu lĩnh vực báo
    // đỏ, gửi / ban hành bị chặn đến khi thêm lĩnh vực con cho chúng (không tự dồn sang lĩnh vực con khác)
    const keepAllowed = true;
    // Lĩnh vực con chưa có tên (thường do lỡ gõ vào ô "Nhập lĩnh vực con"): chỉ bỏ thanh, giữ mọi mục tiêu, không hỏi
    if (!sub.text.trim() && keepAllowed) return removeSubOnly();
    const groupCount = branch.filter((row) => row.kind === 'group').length;
    const goals = branch.filter((row) => row.kind === 'goal');
    const contents = goals.flatMap((row) => row.contents || []);
    const ticks = contents.reduce((n, content) => n + (content.themes || []).length, 0);
    setSubDeleteMode(keepAllowed ? 'keep' : 'branch');
    setPendingDelete({
      title: 'Xóa lĩnh vực con',
      message: `Lĩnh vực con ${subNo}${quoted(sub.text)} có ${groupCount} nhóm kết quả mong đợi, ${goals.length} mục tiêu, ${contents.length} nội dung và ${ticks} dấu tích chủ đề.${keepAllowed ? '' : ' Đây là lĩnh vực con đầu tiên nên chỉ xóa được cả nhánh.'} Thay đổi chỉ lưu khi bấm Lưu.`,
      keep: removeSubOnly,
      keepAllowed,
      run: () => updRows(di, (list) => list.filter((row) => !ids.has(row.id))),
    });
  };
  const flip = (list, id) => (list.includes(id) ? list.filter((t) => t !== id) : [...list, id]);
  const toggleTick = (di, r, c, themeId) =>
    mapContents(di, r.id, (cs) => cs.map((x) => (x.id === c.id ? { ...x, themes: flip(x.themes, themeId) } : x)));
  /** Các ô "Chủ đề thực hiện" của một nội dung (c = null: mục tiêu chưa có nội dung, ô trống). */
  const themeCells = (di, r, c, label) =>
    themes.map((t) => {
      const on = !!c && c.themes.includes(t.id);
      // EDU-50: nội dung trống (chỉ có khoảng trắng) chưa tích được; dấu tích cũ vẫn bỏ được
      const blocked = !!c && !c.text.trim() && !on;
      const abbr = themeAbbr(t);
      const tickLabel = abbr.split(/[-–]/).join('\n');
      return (
        <td
          key={t.id}
          className={c && (edit || canAssignContents) ? 'center ga-theme-tick-cell' : 'center'}
          // Ô cao theo hàng: bấm phần trống dưới nút cũng tick (bàn phím vẫn dùng nút)
          onClick={
            c && (edit || canAssignContents)
              ? (e) => {
                  if (e.target !== e.currentTarget || blocked) return;
                  e.currentTarget.querySelector('button')?.focus();
                  toggleTick(di, r, c, t.id);
                }
              : undefined
          }
        >
          {c && (edit || canAssignContents) ? (
            <button
              type="button"
              className="ga-cell-input ga-theme-tick text-xs fw-600"
              aria-pressed={on}
              aria-label={`Chủ đề ${t.name || abbr} – ${label}`}
              title={blocked ? 'Nhập nội dung trước khi tích chủ đề' : t.name}
              disabled={blocked}
              onClick={() => toggleTick(di, r, c, t.id)}
            >
              {on ? tickLabel : ''}
            </button>
          ) : (
            <div className="ga-goal-table__pad ga-theme-tick text-xs fw-600">{on ? tickLabel : ''}</div>
          )}
        </td>
      );
    });
  /** Thêm nhóm kết quả ngay trước mục tiêu beforeId: các mục tiêu chưa có nhóm phía dưới thuộc về nhóm này. */
  const addGroupBefore = (di, beforeId, text, patch = {}, rowId) => {
    const g = { ...make('group', text), ...(rowId ? { id: rowId } : {}), ...patch };
    updRows(di, (rows) => {
      const at = rows.findIndex((r) => r.id === beforeId);
      return [...rows.slice(0, at), g, ...rows.slice(at)];
    });
    setFocusId(g.id);
  };
  /** Chèn hàng mới ngay sau hàng afterId (null = đầu lĩnh vực) và đặt con trỏ vào hàng cuối vừa chèn. */
  const insertAfter = (di, afterId, fresh) => {
    updRows(di, (rows) => {
      const at = afterId ? rows.findIndex((r) => r.id === afterId) + 1 : 0;
      return [...rows.slice(0, at), ...fresh, ...rows.slice(at)];
    });
    setFocusId(fresh[fresh.length - 1].id);
  };
  const make = (kind, text = '') => (kind === 'goal' ? { id: uid(), kind, text, contents: [] } : { id: uid(), kind, text });
  const newGoalLabel = (di, afterId) =>
    cellInput({
      'aria-label': `STT mục tiêu mới lĩnh vực ${domains[di].name}`,
      maxLength: 100,
      value: '',
      onChange: (event) => {
        const row = { ...make('goal'), displayLabel: event.target.value };
        insertAfter(di, afterId, [row]);
        setFocusId(`label-${row.id}`);
      },
      onKeyDown: (event) => enterKey(event) && event.preventDefault(),
    });
  const updateTierText = (di, row, text) => {
    const patch = { text };
    if (row.kind === 'goal' && !row.text.trim() && text.trim() && !row.displayLabel?.trim()) {
      const next = domains.map((d, index) =>
        index === di ? { ...d, rows: d.rows.map((r) => (r.id === row.id ? { ...r, text } : r)) } : d,
      );
      patch.displayLabel = `MT${numberGoals(next)[row.id]}`;
    }
    patchRow(di, row.id, patch);
  };

  const addContentsAfter = (di, r, afterId, texts = [''], replace = false, firstId = null) => {
    const fresh = texts.map((text, index) => ({ id: index === 0 && firstId ? firstId : uid(), text, themes: [] }));
    mapContents(di, r.id, (cs) => {
      const i = afterId ? cs.findIndex((c) => c.id === afterId) : cs.length - 1;
      return [...cs.slice(0, replace ? i : i + 1), ...fresh, ...cs.slice(i + 1)];
    });
    setFocusId(fresh[fresh.length - 1].id);
  };

  /** Ô chữ của một tầng: Enter thêm mục cùng tầng ngay sau, dán nhiều dòng thành nhiều mục. Xóa hết chữ chỉ để ô trống; xóa dòng bằng thùng rác. */
  const tierInput = (di, row, label, { onEnter, kind, after, placeholder }) =>
    cellInput({
      'data-focus': row.id,
      'aria-label': label,
      placeholder,
      value: row.text,
      onChange: (e) => updateTierText(di, row, e.target.value),
      onKeyDown: (e) => {
        if (enterKey(e)) {
          e.preventDefault();
          if (row.text.trim()) onEnter();
        }
      },
      onPaste: (e) => {
        const lines = pastedLines(e);
        if (lines.length < 2) return;
        e.preventDefault();
        const [head, ...tail] = lines;
        if (!row.text.trim()) patchRow(di, row.id, { text: head });
        insertAfter(
          di,
          after,
          (row.text.trim() ? lines : tail).map((t) => make(kind, t)),
        );
      },
    });
  /** Ô trống cuối tầng: gõ chữ đầu tiên là tạo mục mới ở cuối tầng đó. */
  const newInput = (di, kind, afterId, label, placeholder, rowId) =>
    cellInput({
      'aria-label': label,
      placeholder,
      value: '',
      onChange: (e) => insertAfter(di, afterId, [{ ...make(kind, e.target.value), ...(rowId ? { id: rowId } : {}) }]),
      onKeyDown: (e) => enterKey(e) && e.preventDefault(),
      onPaste: (e) => {
        const lines = pastedLines(e);
        if (!lines.length) return;
        e.preventDefault();
        insertAfter(
          di,
          afterId,
          lines.map((t) => make(kind, t)),
        );
      },
    });
  const dash = <div className="ga-goal-table__pad muted">—</div>;

  const contentKeys = (di, r, c) => (e) => {
    if (!enterKey(e)) return;
    e.preventDefault();
    if (c.text.trim()) addContentsAfter(di, r, c.id);
  };
  const contentPaste = (di, r, c) => (e) => {
    const lines = pastedLines(e).map((l) => l.replace(/^[-+•]\s*/, ''));
    if (lines.length < 2) return;
    e.preventDefault();
    addContentsAfter(di, r, c.id, lines, !c.text.trim());
  };

  /** Các hàng của một mục tiêu (mỗi nội dung một hàng); lead là các ô tầng trên gộp dọc, chỉ có ở hàng đầu. */
  const goalRows = (d, di, r, lead) => {
    const parent = rowContext(di, r.id);
    const nextContentId = editContent ? allocateNewRowId(JSON.stringify([di, 'content', r.id])) : null;
    const contents = readOnly && !editContent ? r.contents.filter((c) => c.text.trim()) : [...r.contents];
    if ((editContent && r.text.trim()) || !contents.length) contents.push(null);
    const span = contents.length;
    const no = numbers[r.id];
    const head = (
      <>
        <td
          rowSpan={span}
          className={`ga-stt${isEditing && fixedCells ? ' cell--fixed' : isEditing ? ' ga-cell-editable' : ''}${edit && editLabels && no ? ` ga-goal-label-cell${fillIds.has(r.id) ? ' ga-goal-label-cell--fill' : ''}` : ''}`}
          onPointerEnter={() => {
            const range = fillRef.current;
            if (range && !range.keyboard && no) updateFill({ ...range, target: r.id });
          }}
        >
          {edit && editLabels ? (
            <>
              {cellInput({
                'aria-label': `Nhãn mục tiêu ${no || 'mới'}`,
                'data-focus': `label-${r.id}`,
                title: goalDisplayLabel(r, no),
                maxLength: 100,
                value: r.displayLabel ?? (no ? `MT${no}` : ''),
                onChange: (event) => patchRow(di, r.id, { displayLabel: event.target.value }),
                onKeyDown: (event) => enterKey(event) && event.preventDefault(),
              })}
              {no && (
                <button
                  type="button"
                  className="ga-goal-label-fill"
                  aria-label={`Điền nhãn từ mục tiêu ${no}`}
                  title="Kéo để điền tăng số; hoặc dùng ↑/↓ rồi Enter để áp dụng, Esc để hủy"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    updateFill({ source: r.id, target: r.id, keyboard: false });
                  }}
                  onKeyDown={(event) => fillKeys(event, r.id)}
                  onBlur={() => {
                    if (fillRef.current?.keyboard) updateFill(null);
                  }}
                />
              )}
            </>
          ) : (
            <div className="ga-goal-table__pad">
              <span className="ga-goal-code">{goalDisplayLabel(r, no)}</span>
            </div>
          )}
        </td>
        <td rowSpan={span} className={isEditing && fixedCells ? 'cell--fixed' : isEditing ? 'ga-cell-editable' : ''}>
          {edit ? (
            <>
              {sourceSuggest(
                tierInput(di, r, `Mục tiêu ${no || 'mới'} lĩnh vực ${d.name}`, {
                  kind: 'goal',
                  after: r.id,
                  // Enter ở mục tiêu: thêm mục tiêu mới ngay dưới, cùng nhóm (mỗi tầng Enter thêm mục cùng tầng)
                  onEnter: () => insertAfter(di, r.id, [make('goal')]),
                }),
                di,
                parent.sub,
                parent.group,
                'goal',
                r.id,
                (o) => patchRow(di, r.id, { text: o.text, ...o.patch }),
              )}
              {!r.text.trim() && (
                <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                  Chưa nhập mục tiêu giáo dục
                </div>
              )}
              {dupHint(r.id, 'Mục tiêu đã có')}
            </>
          ) : (
            <div className="ga-goal-table__pad">
              {r.text}
              <SourceItemMark itemKind="GOAL" itemId={r.id} reviewItems={reviewItems} newItems={newItems} />
            </div>
          )}
        </td>
      </>
    );
    const del = edit && (
      <td rowSpan={span} className="center ga-cell-editable">
        <div className="ga-goal-table__pad">
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => {
              const n = r.contents.filter((c) => c.text.trim()).length;
              const ticked = r.contents.some((c) => c.themes.length);
              askDelete(
                'Xóa mục tiêu',
                `Xóa mục tiêu ${no ? `MT${no}` : 'mới'}${quoted(r.text)}?${n ? ` ${n} nội dung của mục tiêu này cũng bị xóa${ticked ? ', kèm dấu tích chủ đề' : ''}.` : ''}`,
                () => removeRow(di, r.id),
              );
            }}
            aria-label={`Xóa mục tiêu ${no || ''}`}
            title="Xóa mục tiêu"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </td>
    );
    return contents.map((c, k) => {
      if (!c)
        return (
          <tr key={`new-content-${r.id}`}>
            {k === 0 && lead}
            {k === 0 && head}
            <td className={editContent ? 'ga-goal-content-cell ga-cell-editable' : isEditing && fixedCells ? 'cell--fixed' : ''}>
              {editContent && r.text.trim()
                ? sourceSuggest(
                    cellInput({
                      'aria-label': `Nội dung đầu tiên của mục tiêu ${no}`,
                      placeholder: 'Nhập nội dung',
                      value: '',
                      onChange: (e) => addContentsAfter(di, r, null, [e.target.value], false, nextContentId),
                      onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                      onPaste: (e) => {
                        const lines = pastedLines(e);
                        if (!lines.length) return;
                        e.preventDefault();
                        addContentsAfter(di, r, null, lines, false, nextContentId);
                      },
                    }),
                    di,
                    parent.sub,
                    parent.group,
                    'content',
                    nextContentId,
                    (o) => {
                      if (!r.contents.some((c) => normalizeText(c.text) === normalizeText(o.text)))
                        addContentsAfter(di, r, null, [o.text], false, nextContentId);
                    },
                  )
                : dash}
              {r.text.trim() && !(r.contents || []).some((c) => c?.text?.trim()) && (
                <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                  Mục tiêu cần ít nhất một nội dung
                </div>
              )}
            </td>
            {themeCells(di, r, null)}
            {k === 0 && del}
          </tr>
        );
      return (
        <tr key={c.id}>
          {k === 0 && lead}
          {k === 0 && head}
          <td className={editContent ? 'ga-goal-content-cell ga-cell-editable' : isEditing && fixedCells ? 'cell--fixed' : ''}>
            {editContent ? (
              <>
                <div className="ga-goal-line__text">
                  {sourceSuggest(
                    cellInput({
                      'data-focus': c.id,
                      'aria-label': `Nội dung ${k + 1} của mục tiêu ${no || 'mới'}`,
                      placeholder: 'Nhập nội dung',
                      value: c.text,
                      onChange: (e) => mapContents(di, r.id, (cs) => cs.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x))),
                      onKeyDown: contentKeys(di, r, c),
                      onPaste: contentPaste(di, r, c),
                    }),
                    di,
                    parent.sub,
                    parent.group,
                    'content',
                    c.id,
                    (o) => {
                      if (!r.contents.some((other) => other.id !== c.id && normalizeText(other.text) === normalizeText(o.text)))
                        mapContents(di, r.id, (cs) => cs.map((x) => (x.id === c.id ? { ...x, text: o.text } : x)));
                    },
                  )}
                  {edit && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() =>
                        askDelete(
                          'Xóa nội dung',
                          `Xóa nội dung ${k + 1}${quoted(c.text)} của mục tiêu ${no ? `MT${no}` : 'mới'}?${
                            c.themes.length ? ' Dấu tích chủ đề của nội dung này cũng bị bỏ.' : ''
                          }`,
                          () => mapContents(di, r.id, (cs) => cs.filter((x) => x.id !== c.id)),
                        )
                      }
                      aria-label={`Xóa nội dung ${k + 1}`}
                      title="Xóa nội dung"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  )}
                </div>
                {!c.text.trim() && (
                  <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                    Chưa nhập nội dung
                  </div>
                )}
                {canAssignContents && c.text.trim() && !(c.themes || []).length && (
                  <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                    Chưa chọn chủ đề thực hiện
                  </div>
                )}
                {!edit && <SourceItemMark itemKind="CONTENT" itemId={c.id} reviewItems={reviewItems} newItems={newItems} />}
                {dupHint(c.id, 'Nội dung đã có')}
              </>
            ) : (
              <div className="ga-goal-table__pad">
                {c.text}
                <SourceItemMark itemKind="CONTENT" itemId={c.id} reviewItems={reviewItems} newItems={newItems} />
              </div>
            )}
          </td>
          {themeCells(di, r, c, `nội dung ${k + 1} của mục tiêu ${no || 'mới'}`)}
          {k === 0 && del}
        </tr>
      );
    });
  };

  const addSubAfter = (di, b) => insertAfter(di, b.last, [make('sub')]);
  // Ô tên lĩnh vực con dài theo số ký tự để gõ dài vẫn thấy đủ chữ
  const fitSize = (text, placeholder = '') => Math.max(text.length, placeholder.length, 4) + 1;
  const subInput = (di, b, label) => (
    <input
      data-focus={b.sub.id}
      aria-label={label}
      size={fitSize(b.sub.text)}
      value={b.sub.text}
      onChange={(e) => patchRow(di, b.sub.id, { text: e.target.value })}
      onKeyDown={(e) => {
        if (enterKey(e)) {
          e.preventDefault();
          if (b.sub.text.trim()) addSubAfter(di, b);
        }
      }}
      onPaste={(e) => {
        const lines = pastedLines(e);
        if (lines.length < 2) return;
        e.preventDefault();
        const [head, ...tail] = lines;
        if (!b.sub.text.trim()) patchRow(di, b.sub.id, { text: head });
        insertAfter(
          di,
          b.last,
          (b.sub.text.trim() ? lines : tail).map((t) => make('sub', t)),
        );
      }}
    />
  );
  // atTop (Tiền 05/11): ô ở đầu lĩnh vực, gõ để thêm lĩnh vực con lên trên cùng; các dòng đang nằm thẳng dưới lĩnh vực
  // (trước lĩnh vực con đầu tiên) trở thành con của lĩnh vực con mới này
  const newSubInput = (di, d, atTop = false) => {
    const after = atTop || !d.rows.length ? null : d.rows[d.rows.length - 1].id;
    const hint = 'Nhập lĩnh vực con';
    // EDU-53: lĩnh vực chưa có lĩnh vực con mà đã có dòng thì lĩnh vực con đầu tiên luôn thêm ở ô trên cùng
    return (
      <input
        aria-label={`${hint} ${d.name}`}
        placeholder={hint}
        size={fitSize('', hint)}
        value=""
        onChange={(e) => insertAfter(di, after, [make('sub', e.target.value)])}
        onKeyDown={(e) => enterKey(e) && e.preventDefault()}
        onPaste={(e) => {
          const lines = pastedLines(e);
          if (!lines.length) return;
          e.preventDefault();
          insertAfter(
            di,
            after,
            (atTop ? lines.slice(0, 1) : lines).map((t) => make('sub', t)),
          );
        }}
      />
    );
  };
  const goalSpan = (r) =>
    Math.max(
      readOnly && !editContent
        ? r.contents.filter((c) => c.text.trim()).length
        : r.contents.length + (editContent && r.text.trim() ? 1 : 0),
      1,
    );
  const groupSpan = (gr) => Math.max(gr.goals.reduce((n, r) => n + goalSpan(r), 0) + (edit ? 1 : 0), 1);

  /**
   * Toàn bộ hàng của một lĩnh vực: lĩnh vực con là dải tiêu đề đánh số 1, 2… trong lĩnh vực;
   * dưới mỗi dải là các nhóm kết quả (cột gộp dọc) và mục tiêu. Lĩnh vực không có lĩnh vực con thì không có dải.
   */
  const domainRows = (d, di) => {
    const out = [];
    const rows = readOnly ? d.rows.filter((r) => r.text.trim() || (r.kind === 'goal' && r.contents.some((c) => c.text.trim()))) : d.rows;
    let subNo = 0;
    const addSubAtTop = !rows.length || rows[0].kind !== 'sub';
    // Giữ ô thêm lĩnh vực con ở đầu từ khi trống để không nhảy vị trí lúc bắt đầu nhập.
    if (edit && addSubAtTop)
      out.push(
        <tr key="new-sub-top">
          <td colSpan={cols} className="ga-goal-table__subband">
            <div className="ga-goal-table__subname">{newSubInput(di, d, true)}</div>
            {mixed.has(d.name) && (
              <div className="ga-goal-table__pad text-xs text-danger text-right" role="alert">
                Lĩnh vực đã có lĩnh vực con: các dòng chưa thuộc lĩnh vực con nào cần một lĩnh vực con
              </div>
            )}
          </td>
        </tr>,
      );
    toTiers(rows).forEach((b, bi) => {
      if (b.sub) {
        subNo += 1;
        const currentSubNo = subNo;
        out.push(
          <tr key={b.sub.id}>
            <td colSpan={cols - (edit ? 1 : 0)} className={`ga-goal-table__subband${isEditing && fixedCells ? ' cell--fixed' : ''}`}>
              <div className="ga-goal-table__subname">
                {currentSubNo}. {edit ? subInput(di, b, `Lĩnh vực con ${currentSubNo}`) : b.sub.text}
              </div>
              {dupHint(b.sub.id, 'Lĩnh vực con đã có')}
            </td>
            {edit && (
              <td className="center ga-goal-table__subband ga-cell-editable">
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => askDeleteSubDomain(di, b.sub, currentSubNo)}
                  aria-label={`Xóa lĩnh vực con ${currentSubNo}`}
                  title="Xóa lĩnh vực con"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </td>
            )}
          </tr>,
        );
      }
      b.groups.forEach((gr, gi) => {
        const beforeId = edit && !gr.group && gr.goals.length ? allocateNewRowId(JSON.stringify([di, 'before', gr.goals[0].id])) : null;
        const nextGoalId = edit ? allocateNewRowId(JSON.stringify([di, 'goal', gr.last])) : null;
        let groupCell = (
          <td key="group" rowSpan={groupSpan(gr)} className={isEditing && fixedCells ? 'cell--fixed' : isEditing ? 'ga-cell-editable' : ''}>
            {gr.group ? (
              edit ? (
                <>
                  <div className="ga-goal-line__text">
                    {sourceSuggest(
                      tierInput(di, gr.group, 'Nhóm kết quả mong đợi', {
                        kind: 'group',
                        after: gr.last,
                        placeholder: GROUP_HINT,
                        onEnter: () => insertAfter(di, gr.last, [make('group')]),
                      }),
                      di,
                      b.sub,
                      gr.group,
                      'group',
                      gr.group.id,
                      (o) => patchRow(di, gr.group.id, { text: o.text, ...o.patch }),
                    )}
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() =>
                        askDelete(
                          'Xóa kết quả mong đợi',
                          `Xóa kết quả mong đợi${quoted(gr.group.text)}?${
                            gr.goals.length ? ` ${gr.goals.length} mục tiêu cùng nội dung bên dưới nhóm này cũng bị xóa.` : ''
                          }`,
                          () => removeGroup(di, gr),
                        )
                      }
                      title="Xóa kết quả mong đợi"
                      aria-label={`Xóa kết quả mong đợi ${gr.group.text}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                  {!gr.group.text.trim() && (
                    <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                      Chưa nhập nhóm kết quả mong đợi
                    </div>
                  )}
                  {dupHint(gr.group.id, 'Kết quả mong đợi đã có')}
                </>
              ) : (
                <div className="ga-goal-table__pad">{gr.group.text}</div>
              )
            ) : edit && gr.goals.length ? (
              // Mục tiêu chưa thuộc nhóm nào: gõ vào đây để bổ sung nhóm kết quả cho các mục tiêu này
              sourceSuggest(
                cellInput({
                  'aria-label': `Bổ sung kết quả mong đợi cho MT${numbers[gr.goals[0].id] || ''}`,
                  placeholder: GROUP_HINT,
                  value: '',
                  onChange: (e) => addGroupBefore(di, gr.goals[0].id, e.target.value, {}, beforeId),
                  onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                }),
                di,
                b.sub,
                null,
                'group',
                beforeId,
                (o) => addGroupBefore(di, gr.goals[0].id, o.text, o.patch, beforeId),
              )
            ) : (
              dash
            )}
          </td>
        );
        const lead = () => {
          const cell = groupCell;
          groupCell = null;
          return cell;
        };
        gr.goals.forEach((r) => out.push(...goalRows(d, di, r, lead())));
        if (edit)
          out.push(
            <tr key={`new-goal-${bi}-${gi}`}>
              {lead()}
              <td className={`ga-stt${isEditing && fixedCells ? ' cell--fixed' : isEditing ? ' ga-cell-editable' : ''}`}>
                {editLabels ? newGoalLabel(di, gr.last) : dash}
              </td>
              <td colSpan={restSpan - 1} className={isEditing ? 'ga-cell-editable' : ''}>
                {sourceSuggest(
                  newInput(di, 'goal', gr.last, `Thêm mục tiêu lĩnh vực ${d.name}`, NEW_GOAL_HINT, nextGoalId),
                  di,
                  b.sub,
                  gr.group,
                  'goal',
                  nextGoalId,
                  (o) => insertAfter(di, gr.last, [{ ...make('goal', o.text), id: nextGoalId, ...o.patch }]),
                )}
              </td>
              <td className={isEditing ? 'ga-cell-editable' : ''} />
            </tr>,
          );
        else if (!gr.goals.length)
          out.push(
            <tr key={`empty-${bi}-${gi}`}>
              {lead()}
              <td colSpan={restSpan} className={isEditing && fixedCells ? 'cell--fixed' : isEditing ? 'ga-cell-editable' : ''}>
                <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                  Nhóm kết quả cần ít nhất một mục tiêu
                </div>
              </td>
            </tr>,
          );
      });
      const nextGroupId = edit ? allocateNewRowId(JSON.stringify([di, 'group', b.last])) : null;
      const ungroupedGoalId = edit && !b.groups.length ? allocateNewRowId(JSON.stringify([di, 'goal', b.last])) : null;
      if (edit)
        out.push(
          // Luôn giữ ô trống cuối tầng để gõ thêm kết quả mong đợi, giống ô thêm mục tiêu.
          <tr key={`new-group-${bi}`}>
            <td className={isEditing ? 'ga-cell-editable' : ''}>
              {sourceSuggest(
                newInput(di, 'group', b.last, `Thêm nhóm kết quả lĩnh vực ${d.name}`, GROUP_HINT, nextGroupId),
                di,
                b.sub,
                null,
                'group',
                nextGroupId,
                (o) => insertAfter(di, b.last, [{ ...make('group', o.text), id: nextGroupId, ...o.patch }]),
              )}
            </td>
            <td className={`ga-stt${isEditing && fixedCells ? ' cell--fixed' : isEditing ? ' ga-cell-editable' : ''}`}>
              {editLabels && !b.groups.length ? newGoalLabel(di, b.last) : dash}
            </td>
            <td colSpan={restSpan - 1} className="ga-cell-editable">
              {!b.groups.length &&
                sourceSuggest(
                  newInput(di, 'goal', b.last, `Thêm mục tiêu lĩnh vực ${d.name}`, NEW_GOAL_HINT, ungroupedGoalId),
                  di,
                  b.sub,
                  null,
                  'goal',
                  ungroupedGoalId,
                  (o) => insertAfter(di, b.last, [{ ...make('goal', o.text), id: ungroupedGoalId, ...o.patch }]),
                )}
            </td>
            <td className="ga-cell-editable" />
          </tr>,
        );
      else if (!edit && !b.groups.length)
        out.push(
          <tr key={`empty-${bi}`}>
            <td className="cell--fixed">{dash}</td>
            <td colSpan={restSpan} className="cell--fixed">
              {dash}
            </td>
          </tr>,
        );
    });
    // EDU-53: có dòng mà chưa có lĩnh vực con thì chỉ thêm lĩnh vực con ở ô trên cùng (gom các dòng), không thêm ở cuối
    if (edit && !addSubAtTop)
      out.push(
        <tr key="new-sub">
          <td colSpan={cols} className="ga-goal-table__subband">
            <div className="ga-goal-table__subname">{newSubInput(di, d)}</div>
          </td>
        </tr>,
      );
    return out;
  };

  const headRows = themes.length ? 2 : 1;
  // Ít chủ đề (1–2 cột hẹp) thì nới các cột chủ đề để tiêu đề "Chủ đề thực hiện" nằm gọn, không đè sang cột Xóa
  const themeColStyle = themes.length && themes.length < 3 ? { width: Math.ceil(THEME_HEAD_MIN / themes.length) } : undefined;
  return (
    <>
      {labelError && (
        <p role="alert" className="text-danger">
          {labelError}
        </p>
      )}
      <div className="table-wrap">
        <table
          className={`table ga-plan-table ga-goal-table${fixedCells ? ' ga-curriculum-fixed' : ''}${themes.length ? ' ga-goal-table--themes' : ''}`}
          onMouseDown={focusCell}
        >
          <colgroup>
            <col className="ga-goal-table__group" />
            <col className="ga-goal-table__code" />
            <col className="ga-goal-table__goaltext" />
            <col className="ga-goal-table__content" />
            {themes.map((t) => (
              <col key={t.id} className="ga-goal-table__theme" style={themeColStyle} />
            ))}
            {edit && <col className="ga-goal-table__del" />}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={headRows} className={isEditing && fixedCells ? 'cell--fixed' : isEditing ? 'ga-th-editable' : ''}>
                Nhóm kết quả mong đợi
                {edit && (
                  <>
                    <span className="req" aria-hidden="true">
                      {' '}
                      *
                    </span>
                    <span className="sr-only"> Bắt buộc khi gửi duyệt</span>
                  </>
                )}
              </th>
              <th rowSpan={headRows} className={`ga-stt${isEditing && fixedCells ? ' cell--fixed' : isEditing ? ' ga-th-editable' : ''}`}>
                STT
              </th>
              <th rowSpan={headRows} className={isEditing && fixedCells ? 'cell--fixed' : isEditing ? 'ga-th-editable' : ''}>
                Mục tiêu giáo dục
                {edit && (
                  <>
                    <span className="req" aria-hidden="true">
                      {' '}
                      *
                    </span>
                    <span className="sr-only"> Bắt buộc khi gửi duyệt</span>
                  </>
                )}
              </th>
              <th rowSpan={headRows} className={editContent ? 'ga-th-editable' : isEditing && fixedCells ? 'cell--fixed' : ''}>
                Nội dung giáo dục
                {edit && (
                  <>
                    <span className="req" aria-hidden="true">
                      {' '}
                      *
                    </span>
                    <span className="sr-only"> Bắt buộc khi gửi duyệt</span>
                  </>
                )}
              </th>
              {themes.length > 0 && (
                <th
                  colSpan={themes.length}
                  className={`center ${isEditing && canAssignContents ? 'ga-th-editable' : isEditing && fixedCells ? 'cell--fixed' : ''}`}
                >
                  Chủ đề thực hiện
                </th>
              )}
              {edit && (
                <th rowSpan={headRows} className="center ga-th-editable">
                  Xóa
                </th>
              )}
            </tr>
            {themes.length > 0 && (
              <tr>
                {themes.map((t) => (
                  <th
                    key={t.id}
                    className={`center text-xs ${isEditing && canAssignContents ? 'ga-th-editable' : isEditing && fixedCells ? 'cell--fixed' : ''}`}
                    title={t.name}
                  >
                    {themeAbbr(t) || '?'}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {domains.map((d, di) => (
              <Fragment key={d.id || d.name}>
                <tr id={`goal-domain-${d.id}`}>
                  <td colSpan={cols} className="ga-goal-table__domain">
                    <div className="ga-goal-table__pad row gap-2">
                      <h3>
                        {domainRoman(d.name)}. {domainLabel(d.name).toUpperCase()}
                      </h3>
                      <span className="muted text-xs">{d.rows.filter((r) => r.kind === 'goal' && r.text.trim()).length} mục tiêu</span>
                    </div>
                  </td>
                </tr>
                {domainRows(d, di)}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmationModal
        open={Boolean(pendingDelete)}
        danger
        title={pendingDelete?.title}
        message={pendingDelete?.message}
        confirmLabel={pendingDelete?.keep ? (subDeleteMode === 'keep' ? 'Bỏ lĩnh vực con' : 'Xóa cả nhánh') : 'Xóa'}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete.keep && subDeleteMode === 'keep') pendingDelete.keep();
          else pendingDelete.run();
          setPendingDelete(null);
        }}
      >
        {pendingDelete?.keep && (
          <div className="stack mt-12" role="radiogroup" aria-label="Cách xóa lĩnh vực con">
            <label className="radio">
              <input
                type="radio"
                name="sub-delete-mode"
                checked={subDeleteMode === 'keep'}
                disabled={!pendingDelete.keepAllowed}
                onChange={() => setSubDeleteMode('keep')}
              />
              <span>Chỉ bỏ lĩnh vực con</span>
            </label>
            <label className="radio">
              <input type="radio" name="sub-delete-mode" checked={subDeleteMode === 'branch'} onChange={() => setSubDeleteMode('branch')} />
              <span>Xóa cả nhánh</span>
            </label>
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}

/* ---------- B. Chủ đề, sự kiện trong năm ---------- */

/** Bảng dự kiến chủ đề, sự kiện cả năm và các đợt nghỉ. Số MT (từ dấu tích ở bảng mục tiêu) và số tuần tự tính; xóa chủ đề thì bỏ dấu tích của chủ đề đó. */
function ThemeGoalPreview({ domains, theme }) {
  const [selected, setSelected] = useState('');
  const goals = domains.flatMap((d) =>
    d.rows
      .filter((r) => r.kind === 'goal')
      .map((r) => ({
        ...r,
        contents: r.contents.filter((c) => c.themes?.includes(theme.id)),
      }))
      .filter((r) => r.contents.length),
  );
  const goal = goals.find((r) => r.id === selected);
  return (
    <div className="ga-goal-table__pad ga-theme-goal-preview">
      <label>
        <span>Xem mục tiêu</span>
        <select
          className="select"
          aria-label={`Xem mục tiêu của ${theme.name}`}
          value={goal ? selected : ''}
          disabled={!goals.length}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{goals.length ? `Chọn mục tiêu (${goals.length})` : 'Chưa có mục tiêu'}</option>
          {goals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.text}
            </option>
          ))}
        </select>
      </label>
      {goal && (
        <div role="status">
          <p>{goal.text}</p>
          <ul>
            {goal.contents.map((c) => (
              <li key={c.id}>{c.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BranchTemplateNames({
  theme,
  templates,
  onChange,
  onDelete,
  readOnly,
  leadingCells,
  trailingCells,
  breaks = [],
  durationLimits = null,
}) {
  const setFocusId = useCellFocus();
  const values = templates.filter((t) => String(t.themeId) === String(theme.id));
  const next = `branch-new-${theme.id}`;
  const nameCell = (t) =>
    readOnly ? (
      <div className="ga-goal-table__pad">{t.name}</div>
    ) : (
      <CellInput
        data-focus={`branch-${t.id}`}
        aria-label={`Chủ đề nhánh / dự án của ${theme.name}`}
        value={t.name}
        placeholder="Nhập chủ đề nhánh / dự án"
        onChange={(e) => onChange(templates.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
        onKeyDown={(e) => {
          if (!enterKey(e)) return;
          e.preventDefault();
          if (!t.name.trim()) return;
          const id = crypto.randomUUID();
          const at = templates.findIndex((x) => x.id === t.id) + 1;
          onChange([...templates.slice(0, at), { id, themeId: theme.id, name: '', startDate: '', endDate: '' }, ...templates.slice(at)]);
          setFocusId(`branch-${id}`);
        }}
      />
    );
  const dateLabel = (value) => (value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : 'dd/mm/yyyy');
  const branchDate = (t, field, label) =>
    readOnly ? (
      <div className="ga-goal-table__pad">{dateLabel(t[field])}</div>
    ) : (
      <DatePickerCell
        label={`${label} nhánh ${t.name}`}
        compact
        taken={values
          .filter((x) => x.id !== t.id && x.startDate)
          .map((x) => ({ start: x.startDate, end: x.endDate || x.startDate, label: `nhánh "${x.name || 'chưa đặt tên'}"` }))}
        min={(field === 'endDate' ? t.startDate : null) || theme.start || undefined}
        max={theme.end || undefined}
        openAt={t.startDate || theme.start}
        range={{ start: t.startDate, end: t.endDate }}
        value={t[field] || ''}
        disabled={!theme.start || !theme.end}
        onChange={(value) => {
          const min = (field === 'endDate' ? t.startDate : null) || theme.start;
          if (value && (value < min || value > theme.end)) return;
          onChange(templates.map((x) => (x.id === t.id ? { ...x, [field]: value } : x)));
        }}
      />
    );
  const dateCells = (t) => (
    <>
      <div className="ga-branch-date-endpoint">{branchDate(t, 'startDate', 'Từ')}</div>
      <span aria-hidden="true">-</span>
      <div className="ga-branch-date-endpoint">{branchDate(t, 'endDate', 'Đến')}</div>
    </>
  );
  return (
    <>
      {values.map((t, index) => {
        const issues = readOnly ? [] : branchDateIssues(t, templates, breaks, durationLimits);
        return (
          <tr key={t.id}>
            {index === 0 && leadingCells}
            <td className={`ga-branch-template-cell${issues.length ? ' ga-date--bad' : ''}`}>
              <div className="ga-goal-line__text ga-branch-template-item">
                {nameCell(t)}
                <div className="ga-branch-template-dates ga-branch-date-range">{dateCells(t)}</div>
                {issues.length > 0 && (
                  <div className="ga-goal-table__pad text-xs text-danger ga-branch-date-errors" role="alert">
                    {issues.map((issue) => (
                      <div key={issue}>{issue}</div>
                    ))}
                  </div>
                )}
                {/* Nhánh kế thừa từ kế hoạch năm chỉ sửa tên/ngày, không xóa (BE spec 002 FR-013) */}
                {!readOnly && t.sourceTemplateId == null && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={`Xóa nhánh gợi ý ${t.name}`}
                    onClick={() => onDelete(t)}
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
            </td>
            {index === 0 && trailingCells}
          </tr>
        );
      })}
      {(!readOnly || !values.length) && (
        <tr>
          {!values.length && leadingCells}
          <td className="ga-branch-template-cell">
            {readOnly ? (
              <div className="ga-goal-table__pad">—</div>
            ) : (
              <CellInput
                data-focus={next}
                aria-label={`Thêm chủ đề nhánh / dự án của ${theme.name}`}
                placeholder="Nhập nhánh / dự án, Enter để thêm"
                value=""
                onChange={(e) => {
                  const id = crypto.randomUUID();
                  onChange([...templates, { id, themeId: theme.id, name: e.target.value, startDate: '', endDate: '' }]);
                  setFocusId(`branch-${id}`);
                }}
                onKeyDown={(e) => {
                  if (enterKey(e)) e.preventDefault();
                }}
              />
            )}
          </td>
          {!values.length && trailingCells}
        </tr>
      )}
    </>
  );
}

export function ThemeEventTable({
  themes,
  breaks,
  domains,
  onChange,
  readOnly: viewOnly = false,
  yearRange,
  requireDates = false,
  hideGoals = false,
  fixedFields = false,
  branchEditable = false,
  branchTemplates = [],
  durationPolicy = null,
  reviewItems = [],
  newItems = [],
}) {
  const readOnly = viewOnly || fixedFields;
  const branchReadOnly = (viewOnly || fixedFields) && !branchEditable;
  const showBranches = hideGoals || fixedFields;
  const setFocusId = useCellFocus();
  const patchTheme = (id, patch) => onChange({ themes: themes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const removeTheme = (id) => onChange(removeThemeReferences(themes, domains, branchTemplates, id));
  const removeBreak = (id) => onChange({ breaks: breaks.filter((b) => b.id !== id) });
  const patchBreak = (id, patch) => onChange({ breaks: breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  // STT là vị trí trong danh sách: xóa dòng thì các dòng dưới dồn lên, nên cho đổi thứ tự bằng kéo-thả hoặc mũi tên
  const themeLabel = (i) => `chủ đề ${(themes[i]?.name || '').trim() || i + 1}`;
  const breakLabel = (i) => `đợt nghỉ ${(breaks[i]?.label || '').trim() || i + 1}`;
  // Bấm thùng rác luôn hỏi lại trước khi xóa dòng
  const [pendingDelete, setPendingDelete] = useState(null);
  const askDeleteTheme = (t, i) => {
    const ticked = themeGoalIds(domains, t).length;
    setPendingDelete({
      title: 'Xóa chủ đề',
      message: `Xóa chủ đề ${i + 1} "${(t.name || '').trim() || 'chưa đặt tên'}"?${
        ticked ? ` Dấu tích của chủ đề này ở ${ticked} mục tiêu cũng bị bỏ.` : ''
      } Thay đổi chỉ lưu khi bấm Lưu.`,
      run: () => removeTheme(t.id),
    });
  };
  const askDeleteBreak = (b, i) =>
    setPendingDelete({
      title: 'Xóa đợt nghỉ',
      message: `Xóa đợt nghỉ ${i + 1} "${(b.label || '').trim() || 'chưa đặt tên'}"? Thay đổi chỉ lưu khi bấm Lưu.`,
      run: () => removeBreak(b.id),
    });
  const askDeleteBranch = (branch) =>
    setPendingDelete({
      title: 'Xóa chủ đề nhánh / dự án',
      message: `Xóa chủ đề nhánh / dự án "${(branch.name || '').trim() || 'chưa đặt tên'}"? Tên và lịch của nhánh sẽ bị bỏ. Thay đổi chỉ lưu khi bấm Lưu.`,
      run: () => onChange({ branchTemplates: branchTemplates.filter((t) => t.id !== branch.id) }),
    });
  // Nội dung ô Thao tác (kéo xếp + xóa); ô <td className="cell--actions"> viết ở từng bảng theo mẫu chung
  const actionButtons = (label, onDelete, deleteLabel) => (
    <div className="ga-goal-table__pad ga-sort-cell">
      <SortHandle label={label} />
      <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete} aria-label={deleteLabel} title={deleteLabel}>
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );
  // Thêm dòng như bảng mục tiêu: gõ vào dòng trống cuối bảng, hoặc Enter ở ô tên để chèn dòng mới ngay dưới
  // col: tiền tố data-focus của cột cần đặt con trỏ ở dòng mới ('' = ô tên)
  const insertTheme = (afterIdx, name = '', col = '') => {
    const t = { ...blankTheme(), name, abbr: initialsOf(name) };
    onChange({ themes: [...themes.slice(0, afterIdx + 1), t, ...themes.slice(afterIdx + 1)] });
    setFocusId(`${col}${t.id}`);
  };
  const insertBreak = (afterIdx, label = '') => {
    const b = { id: uid(), label, start: '', end: '' };
    onChange({ breaks: [...breaks.slice(0, afterIdx + 1), b, ...breaks.slice(afterIdx + 1)] });
    setFocusId(b.id);
  };
  // BE:EDU-42 viết tắt trùng: chỉ báo đỏ tại ô; còn trùng thì không thêm chủ đề mới, không tự kéo con trỏ đi đâu
  const dupAbbr = duplicateAbbrThemeIds(themes);
  /** Enter ở ô tên đợt nghỉ: thêm dòng dưới. Xóa hết chữ chỉ để ô trống, không xóa dòng; xóa dòng bằng thùng rác. */
  const nameKeys = (row, i, insert, blank) => (e) => {
    if (!enterKey(e)) return;
    e.preventDefault();
    if (!blank(row)) insert(i);
  };
  /**
   * Enter ở ô của bảng chủ đề: xuống ô cùng cột ở dòng dưới như bảng tính; dòng cuối thì thêm chủ đề mới và đặt con trỏ
   * vào ô cùng cột của dòng mới (Tiền 31/10). Còn viết tắt trùng thì đứng yên tại ô, không thêm dòng.
   */
  const themeKeys = (t, i, col) => (e) => {
    if (!enterKey(e)) return;
    e.preventDefault();
    if (dupAbbr.has(t.id)) return;
    if (i < themes.length - 1) {
      setFocusId(`${col}${themes[i + 1].id}`);
      return;
    }
    if (i === themes.length - 1 && !dupAbbr.size && !isBlankTheme(t)) insertTheme(i, '', col);
  };

  const textCell = (value, onValue, label, extra) =>
    readOnly ? (
      <div className="ga-goal-table__pad">{value || '—'}</div>
    ) : (
      cellInput({ 'aria-label': label, value: value || '', onChange: (e) => onValue(e.target.value), ...extra })
    );
  /** Dòng trống cuối bảng: gõ chữ đầu tiên là thành một dòng thật ở đúng chỗ đó. */
  const newRow = (span, label, placeholder, create) => (
    <tr key="new">
      <td className="cell--fixed ga-stt" />
      <td>
        {cellInput({
          'aria-label': label,
          placeholder,
          value: '',
          onChange: (e) => create(e.target.value),
          onKeyDown: (e) => enterKey(e) && e.preventDefault(),
        })}
      </td>
      {Array.from({ length: span - 1 }, (_, i) => (
        <td key={i} />
      ))}
    </tr>
  );
  const dateCell = (value, onValue, label, row, others, compact = false) =>
    readOnly ? (
      <div className="ga-goal-table__pad">
        {value
          ? compact
            ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
            : fmtDate(value)
          : compact
            ? 'dd/mm/yyyy'
            : '—'}
      </div>
    ) : (
      <DatePickerCell
        value={value}
        onChange={onValue}
        label={label}
        range={row}
        compact={compact}
        taken={others}
        openAt={yearRange?.start}
        min={yearRange?.start}
        max={yearRange?.end}
      />
    );
  // Khoảng thời gian đã dùng (tô đỏ trên lịch): mọi chủ đề và đợt nghỉ khác dòng đang chọn
  const span = (x, label) => ({ start: x.start, end: x.end || x.start, label });
  const breakSpans = breaks.filter((b) => b.start).map((b) => ({ ...span(b, `đợt nghỉ "${b.label || 'chưa đặt tên'}"`), id: b.id }));
  const themeSpans = themes.filter((t) => t.start).map((t) => ({ ...span(t, `chủ đề "${t.name || 'chưa đặt tên'}"`), id: t.id }));
  const takenForTheme = (t) => [...themeSpans.filter((x) => x.id !== t.id), ...breakSpans];
  const takenForBreak = (b) => [...themeSpans, ...breakSpans.filter((x) => x.id !== b.id)];
  /** Chủ đề trùng thời gian (EDU-39) / không trọn tuần (EDU-40): báo tại chỗ, chặn ở bước gửi / ban hành. */
  const overlapOf = (t) => overlappingThemes(t, themes).map((x) => `chủ đề "${x.name || 'chưa đặt tên'}"`);
  // Gợi ý dời ngày (Tiền 04/11): ngày lệch thứ 2 – thứ 6 hoặc khác năm học tô đỏ, đồng ý từng dòng / tất cả / tự sửa
  const themeSug = new Map(readOnly ? [] : themes.map((t) => [t.id, suggestThemeDates(t, yearRange)]).filter(([, x]) => x));
  const breakSug = new Map(readOnly ? [] : breaks.map((b) => [b.id, suggestBreakDates(b, yearRange)]).filter(([, x]) => x));
  const applyAllSuggestions = () =>
    onChange({
      themes: themes.map((t) => (themeSug.has(t.id) ? { ...t, ...themeSug.get(t.id) } : t)),
      breaks: breaks.map((b) => (breakSug.has(b.id) ? { ...b, ...breakSug.get(b.id) } : b)),
    });
  const suggestion = (sug, apply) => (
    <div className="ga-goal-table__pad text-xs text-danger ga-date-sug">
      Gợi ý: {fmtDate(sug.start)} – {fmtDate(sug.end)}{' '}
      <button type="button" className="link-btn" onClick={apply}>
        Áp dụng
      </button>
    </div>
  );
  const sugCount = themeSug.size + breakSug.size;
  const gapIssue = readOnly ? null : themeGapIssue(themes, breaks);
  // EDU-52: bấm Ban hành mà chủ đề chưa chọn ngày thì báo tại ô ngày còn trống
  const missingDate = (value) =>
    !readOnly && requireDates && !value && <div className="ga-goal-table__pad text-xs text-danger text-right">Chọn ngày</div>;

  return (
    <div className="stack ga-theme-event-tables">
      {gapIssue && (
        <p className="text-danger text-sm text-right ga-date-gap" role="alert">
          {gapIssue}
        </p>
      )}
      {sugCount > 0 && (
        <p className="text-danger text-sm text-right ga-date-sug-all">
          {sugCount} dòng lệch ngày (cần trọn tuần thứ 2 – thứ 6, trong năm học).{' '}
          <button type="button" className="link-btn" onClick={applyAllSuggestions}>
            Áp dụng tất cả gợi ý
          </button>
        </p>
      )}
      <div className="table-wrap">
        <SortableList
          overlayClassName="ga-sortable-overlay"
          ids={themes.map((t) => t.id)}
          onMove={(from, to) => onChange({ themes: moveItem(themes, from, to) })}
          labelOf={themeLabel}
          disabled={readOnly}
        >
          <table
            className={`table ga-plan-table ga-goal-table${hideGoals ? ' ga-annual-theme-table' : ''}${fixedFields ? ' ga-theme-edit-fixed' : ''}${branchEditable ? ' ga-branch-template-editable' : ''}${readOnly && !fixedFields ? ' ga-table-readonly' : ''}`}
            onMouseDown={focusCell}
          >
            {/* Chia cột theo khung bảng, nội dung dài xuống dòng trong ô. */}
            <colgroup>
              <col className="ga-col-stt" />
              <col className="ga-col-theme-name" />
              <col className="ga-col-abbr" />
              <col className="ga-col-mt" />
              {showBranches && !hideGoals && <col className="ga-col-mt" />}
              <col className="ga-col-festivals" />
              <col className="ga-col-weeks" />
              <col className="ga-col-theme-note" />
              {!readOnly && <col className="ga-col-actions" />}
            </colgroup>
            <thead>
              <tr>
                <th className="cell--fixed ga-stt">
                  <span className="stt-head">STT {!readOnly && <RenumberButton />}</span>
                </th>
                <th>Tên chủ đề{!readOnly && <span className="req">*</span>}</th>
                <th className="center">Viết tắt{!readOnly && <span className="req">*</span>}</th>
                <th>{showBranches ? 'Chủ đề nhánh / dự án' : 'Mục tiêu giáo dục'}</th>
                {showBranches && !hideGoals && <th>Mục tiêu giáo dục</th>}
                <th>Ngày lễ hội</th>
                <th className="center cell--fixed">Số tuần</th>
                <th>Ghi chú</th>
                {!readOnly && <th className="cell--actions">Thao tác</th>}
              </tr>
            </thead>
            {readOnly && themes.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={showBranches && !hideGoals ? 8 : 7}>
                    <div className="ga-goal-table__pad muted">Chưa có chủ đề.</div>
                  </td>
                </tr>
              </tbody>
            )}
            {themes.map((t, i) => {
              const span = showBranches
                ? Math.max(1, branchTemplates.filter((b) => String(b.themeId) === String(t.id)).length + (branchReadOnly ? 0 : 1))
                : 1;
              const durationIssue = readOnly ? null : durationRangeIssue(t, breaks, durationPolicy?.theme, 'Chủ đề');
              const leadingCells = (
                <>
                  <td rowSpan={span} className="cell--fixed ga-stt">
                    <div className="ga-goal-table__pad">
                      <SortIndex id={t.id} index={i} />
                    </div>
                  </td>
                  <td rowSpan={span}>
                    {textCell(
                      t.name,
                      (name) => patchTheme(t.id, !t.abbr || t.abbr === initialsOf(t.name) ? { name, abbr: initialsOf(name) } : { name }),
                      `Tên chủ đề ${i + 1}`,
                      {
                        'data-focus': t.id,
                        placeholder: 'Nhập tên chủ đề',
                        onKeyDown: themeKeys(t, i, ''),
                      },
                    )}
                    <SourceItemMark itemKind="THEME" itemId={t.id} reviewItems={reviewItems} newItems={newItems} />
                    <div className={`ga-branch-template-dates ga-branch-date-range${themeSug.has(t.id) ? ' ga-date--bad' : ''}`}>
                      <div className="ga-branch-date-endpoint">
                        {dateCell(t.start, (start) => patchTheme(t.id, { start }), `Từ ngày chủ đề ${i + 1}`, t, takenForTheme(t), true)}
                        {missingDate(t.start)}
                      </div>
                      <span aria-hidden="true">-</span>
                      <div className="ga-branch-date-endpoint">
                        {dateCell(t.end, (end) => patchTheme(t.id, { end }), `Đến ngày chủ đề ${i + 1}`, t, takenForTheme(t), true)}
                        {missingDate(t.end)}
                      </div>
                    </div>
                    {themeSug.has(t.id) && suggestion(themeSug.get(t.id), () => patchTheme(t.id, themeSug.get(t.id)))}
                    {!readOnly && overlapOf(t).length > 0 && (
                      <div className="ga-goal-table__pad text-xs text-danger">Trùng thời gian với {overlapOf(t).join(', ')}</div>
                    )}
                    {durationIssue && (
                      <div className="ga-goal-table__pad text-xs text-danger" role="alert">
                        {durationIssue}
                      </div>
                    )}
                    {!readOnly && !isWholeWeekTheme(t) && !themeSug.has(t.id) && (
                      <div className="ga-goal-table__pad text-xs text-danger">Bắt đầu Thứ 2, kết thúc Thứ 6</div>
                    )}
                  </td>
                  <td rowSpan={span} className="center ga-goal-table__center">
                    {textCell(t.abbr, (abbr) => patchTheme(t.id, { abbr }), `Viết tắt chủ đề ${i + 1}`, {
                      'data-focus': `abbr-${t.id}`,
                      'aria-invalid': dupAbbr.has(t.id) || undefined,
                      'aria-describedby': dupAbbr.has(t.id) ? `abbr-err-${t.id}` : undefined,
                      onKeyDown: themeKeys(t, i, 'abbr-'),
                    })}
                    {!readOnly && dupAbbr.has(t.id) && (
                      <div id={`abbr-err-${t.id}`} className="ga-goal-table__pad field__error" role="alert">
                        {DUPLICATE_ABBR_MESSAGE}
                      </div>
                    )}
                  </td>
                </>
              );
              const trailingCells = (
                <>
                  {showBranches && !hideGoals && (
                    <td rowSpan={span} className="cell--fixed">
                      <ThemeGoalPreview domains={domains} theme={t} />
                    </td>
                  )}
                  <td rowSpan={span}>
                    {textCell(t.festivals, (festivals) => patchTheme(t.id, { festivals }), `Ngày lễ hội chủ đề ${i + 1}`, {
                      'data-focus': `fest-${t.id}`,
                      onKeyDown: themeKeys(t, i, 'fest-'),
                    })}
                  </td>
                  <td rowSpan={span} className="center cell--fixed">
                    <div className="ga-goal-table__pad">{weekCount(t, breaks) || '—'}</div>
                  </td>
                  <td rowSpan={span}>
                    {textCell(t.note, (note) => patchTheme(t.id, { note }), `Ghi chú chủ đề ${i + 1}`, {
                      'data-focus': `note-${t.id}`,
                      onKeyDown: themeKeys(t, i, 'note-'),
                    })}
                  </td>
                  {!readOnly && (
                    <td rowSpan={span} className="cell--actions">
                      {actionButtons(themeLabel(i), () => askDeleteTheme(t, i), `Xóa chủ đề ${i + 1}`)}
                    </td>
                  )}
                </>
              );
              return (
                <SortableRow as="tbody" key={t.id} id={t.id}>
                  {showBranches ? (
                    <BranchTemplateNames
                      theme={t}
                      templates={branchTemplates}
                      breaks={breaks}
                      durationLimits={durationPolicy?.branch}
                      readOnly={branchReadOnly}
                      onChange={(values) => onChange({ branchTemplates: values })}
                      onDelete={askDeleteBranch}
                      leadingCells={leadingCells}
                      trailingCells={trailingCells}
                    />
                  ) : (
                    <tr>
                      {leadingCells}
                      <td className="cell--fixed">
                        <ThemeGoalPreview domains={domains} theme={t} />
                      </td>
                      {trailingCells}
                    </tr>
                  )}
                </SortableRow>
              );
            })}
            {!readOnly && (
              <tbody>
                {newRow(7, 'Thêm chủ đề', 'Nhập tên chủ đề mới', (name) => (dupAbbr.size ? null : insertTheme(themes.length - 1, name)))}
              </tbody>
            )}
          </table>
        </SortableList>
      </div>

      <div className="table-wrap">
        <SortableList
          overlayClassName="ga-sortable-overlay"
          ids={breaks.map((b) => b.id)}
          onMove={(from, to) => onChange({ breaks: moveItem(breaks, from, to) })}
          labelOf={breakLabel}
          disabled={readOnly}
        >
          <table
            className={`table ga-plan-table ga-goal-table${fixedFields ? ' ga-theme-edit-fixed' : ''}${readOnly && !fixedFields ? ' ga-table-readonly' : ''}`}
            onMouseDown={focusCell}
          >
            <colgroup>
              <col className="ga-col-stt" />
              <col />
              {!readOnly && <col className="ga-col-actions" />}
            </colgroup>
            <thead>
              <tr>
                <th className="cell--fixed ga-stt">
                  <span className="stt-head">STT {!readOnly && <RenumberButton />}</span>
                </th>
                <th>Đợt nghỉ (Tết, ôn tập, nghỉ lễ…)</th>
                {!readOnly && <th className="cell--actions">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {readOnly && breaks.length === 0 && (
                <tr>
                  <td colSpan={2}>
                    <div className="ga-goal-table__pad muted">{NO_BREAKS}</div>
                  </td>
                </tr>
              )}
              {breaks.map((b, i) => (
                <SortableRow key={b.id} id={b.id}>
                  <td className="cell--fixed ga-stt">
                    <div className="ga-goal-table__pad">
                      <SortIndex id={b.id} index={i} />
                    </div>
                  </td>
                  <td>
                    {textCell(b.label, (label) => patchBreak(b.id, { label }), `Tên đợt nghỉ ${i + 1}`, {
                      'data-focus': b.id,
                      placeholder: 'Nhập tên đợt nghỉ',
                      onKeyDown: nameKeys(b, i, insertBreak, isBlankBreak),
                    })}
                    <div className={`ga-branch-template-dates ga-branch-date-range${breakSug.has(b.id) ? ' ga-date--bad' : ''}`}>
                      <div className="ga-branch-date-endpoint">
                        {dateCell(b.start, (start) => patchBreak(b.id, { start }), `Từ ngày đợt nghỉ ${i + 1}`, b, takenForBreak(b), true)}
                      </div>
                      <span aria-hidden="true">-</span>
                      <div className="ga-branch-date-endpoint">
                        {dateCell(b.end, (end) => patchBreak(b.id, { end }), `Đến ngày đợt nghỉ ${i + 1}`, b, takenForBreak(b), true)}
                      </div>
                    </div>
                    {breakSug.has(b.id) && suggestion(breakSug.get(b.id), () => patchBreak(b.id, breakSug.get(b.id)))}
                  </td>
                  {!readOnly && (
                    <td className="cell--actions">{actionButtons(breakLabel(i), () => askDeleteBreak(b, i), `Xóa đợt nghỉ ${i + 1}`)}</td>
                  )}
                </SortableRow>
              ))}
              {!readOnly && newRow(2, 'Thêm đợt nghỉ', NO_BREAKS_HINT, (label) => insertBreak(breaks.length - 1, label))}
            </tbody>
          </table>
        </SortableList>
      </div>

      <ConfirmationModal
        open={Boolean(pendingDelete)}
        danger
        title={pendingDelete?.title}
        message={pendingDelete?.message}
        confirmLabel="Xóa"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          pendingDelete.run();
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ---------- Tab chia kế hoạch năm: mục tiêu trước, chủ đề và sự kiện sau ---------- */

export const PLAN_TABS = [
  { key: 'goals', label: 'Mục tiêu nội dung giáo dục cuối độ tuổi' },
  { key: 'themes', label: 'Chủ đề và sự kiện' },
];

export function PlanTabs({ tab, onTab, counts }) {
  return (
    <div className="tabs" role="tablist">
      {PLAN_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          className={`tab ${tab === t.key ? 'tab--active' : ''}`}
          onClick={() => onTab(t.key)}
        >
          {t.label}
          <span className="tab__count">{counts[t.key]}</span>
        </button>
      ))}
    </div>
  );
}
