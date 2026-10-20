import { Fragment, useEffect, useRef, useState } from 'react';
import { Trash2, X } from '@/components/ui/icons';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import {
  domainRoman,
  initialsOf,
  isBlankBreak,
  isBlankTheme,
  nestUnderFirstSub,
  themeAbbr,
  themeGoalLabel,
  weekCount,
} from '@/models/education-plan/goalTable';
import { fmtDate } from '@/components/education-plan/eduUi';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import DatePickerCell from '@/components/education-plan/DatePickerCell';
import { expectedResultsFor } from '@/models/education-plan/expectedResults';
import { normalizeText } from '@/utils/format';

const uid = () => Math.random().toString(36).slice(2, 9);
const blankTheme = () => ({ id: uid(), name: '', abbr: '', festivals: '', start: '', end: '', note: '' });
const GROUP_HINT = 'Nhập kết quả mong đợi';
// Độ rộng tối thiểu (px) của cả nhóm cột chủ đề, vừa chữ "Chủ đề thực hiện"
const THEME_HEAD_MIN = 140;
const NEW_GOAL_HINT = 'Nhập mục tiêu mới (Enter trong ô mục tiêu cũng thêm mục tiêu)';
const NO_BREAKS_HINT = 'Nhập đợt nghỉ mới: Tết, ôn tập, nghỉ lễ… (tuần trùng đợt nghỉ không tính vào số tuần của chủ đề)';
const NO_BREAKS = 'Chưa có đợt nghỉ. Tuần trùng đợt nghỉ không được tính vào số tuần của chủ đề.';
const enterKey = (e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing;
const pastedLines = (e) =>
  (e.clipboardData?.getData('text') || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
// Ô nhập trong bảng tự cao theo nội dung để đọc đủ câu dài, không cần cuộn trong ô.
const fitHeight = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};
const cellInput = (props) => (
  <textarea className="ga-cell-input" rows={1} ref={(el) => fitHeight(el)} onInput={(e) => fitHeight(e.target)} {...props} />
);

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
    const fitAll = () => document.querySelectorAll('.ga-cell-input').forEach(fitHeight);
    fitAll();
    window.addEventListener('resize', fitAll);
    return () => window.removeEventListener('resize', fitAll);
  });
  return setFocusId;
}

/** Bấm vào phần trống của ô (dưới ô nhập khi hàng cao hơn) cũng đặt con trỏ vào ô nhập, như bảng tính. */
const focusCell = (e) => {
  if (e.target.tagName !== 'TD') return;
  const input = e.target.querySelector('.ga-cell-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
};

/* ---------- A. Mục tiêu, nội dung giáo dục ---------- */

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
function Suggest({ query, options, onPick, label, children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const q = normalizeText(query || '');
  const shown = options.filter((o) => normalizeText(o) !== q && (!q || normalizeText(o).includes(q))).slice(0, 12);
  return (
    <div className="search-select" ref={anchorRef} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && shown.length > 0 && (
        <FloatingPanel anchorRef={anchorRef} keepFocus>
          <div className="search-select__list" role="listbox" aria-label={label}>
            {shown.map((o) => (
              <button
                type="button"
                key={o}
                role="option"
                aria-selected={false}
                className="search-select__option"
                // Giữ con trỏ trong ô khi chọn gợi ý
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(o);
                }}
              >
                {o}
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
export function GoalTable({ domains, themes = [], numbers, onChange, readOnly = false, ageGroupId }) {
  const setFocusId = useCellFocus();
  const edit = !readOnly;
  const cols = 4 + themes.length + (edit ? 1 : 0);
  // Ô gộp các cột STT, Mục tiêu, Nội dung và các cột chủ đề cho các hàng "thêm mới"
  const restSpan = 3 + themes.length;

  const updRows = (di, fn) => onChange(domains.map((d, i) => (i === di ? { ...d, rows: nestUnderFirstSub(fn(d.rows)) } : d)));
  const patchRow = (di, rid, patch) => updRows(di, (rows) => rows.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const mapContents = (di, rid, fn) => updRows(di, (rows) => rows.map((r) => (r.id === rid ? { ...r, contents: fn(r.contents) } : r)));
  const removeRow = (di, rid) => updRows(di, (rows) => rows.filter((r) => r.id !== rid));
  // Xóa nhóm kết quả mong đợi kéo theo toàn bộ mục tiêu và nội dung bên dưới nhóm
  const removeGroup = (di, gr) => {
    const ids = new Set([gr.group.id, ...gr.goals.map((r) => r.id)]);
    updRows(di, (rows) => rows.filter((r) => !ids.has(r.id)));
  };
  const flip = (list, id) => (list.includes(id) ? list.filter((t) => t !== id) : [...list, id]);
  const toggleTick = (di, r, c, themeId) =>
    mapContents(di, r.id, (cs) => cs.map((x) => (x.id === c.id ? { ...x, themes: flip(x.themes, themeId) } : x)));
  /** Các ô "Chủ đề thực hiện" của một nội dung (c = null: mục tiêu chưa có nội dung, ô trống). */
  const themeCells = (di, r, c, label) =>
    themes.map((t) => {
      const on = !!c && c.themes.includes(t.id);
      const abbr = themeAbbr(t);
      return (
        <td key={t.id} className="center">
          {c && edit ? (
            <button
              type="button"
              className="ga-cell-input text-xs fw-600"
              aria-pressed={on}
              aria-label={`Chủ đề ${t.name || abbr} – ${label}`}
              title={t.name}
              onClick={() => toggleTick(di, r, c, t.id)}
            >
              {on ? abbr : ''}
            </button>
          ) : (
            <div className="ga-goal-table__pad text-xs fw-600">{on ? abbr : ''}</div>
          )}
        </td>
      );
    });
  /** Thêm nhóm kết quả ngay trước mục tiêu beforeId: các mục tiêu chưa có nhóm phía dưới thuộc về nhóm này. */
  const addGroupBefore = (di, beforeId, text) => {
    const g = make('group', text);
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
  const addContentsAfter = (di, r, afterId, texts = [''], replace = false) => {
    const fresh = texts.map((text) => ({ id: uid(), text, themes: [] }));
    mapContents(di, r.id, (cs) => {
      const i = afterId ? cs.findIndex((c) => c.id === afterId) : cs.length - 1;
      return [...cs.slice(0, replace ? i : i + 1), ...fresh, ...cs.slice(i + 1)];
    });
    setFocusId(fresh[fresh.length - 1].id);
  };

  /** Ô chữ của một tầng: Enter thêm mục cùng tầng ngay sau, dán nhiều dòng thành nhiều mục, Backspace ở ô trống xóa tiêu đề. */
  const tierInput = (di, row, label, { onEnter, kind, after, placeholder }) =>
    cellInput({
      'data-focus': row.id,
      'aria-label': label,
      placeholder,
      value: row.text,
      onChange: (e) => patchRow(di, row.id, { text: e.target.value }),
      onKeyDown: (e) => {
        if (enterKey(e)) {
          e.preventDefault();
          if (row.text.trim()) onEnter();
        } else if (e.key === 'Backspace' && !row.text && kind !== 'goal') {
          e.preventDefault();
          removeRow(di, row.id);
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
  const newInput = (di, kind, afterId, label, placeholder) =>
    cellInput({
      'aria-label': label,
      placeholder,
      value: '',
      onChange: (e) => insertAfter(di, afterId, [make(kind, e.target.value)]),
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
    const contents = readOnly ? r.contents.filter((c) => c.text.trim()) : r.contents;
    const span = Math.max(contents.length, 1);
    const no = numbers[r.id];
    const head = (
      <>
        <td rowSpan={span} className="cell--fixed">
          <div className="ga-goal-table__pad">
            <span className="ga-goal-code">{no ? `MT${no}` : '—'}</span>
          </div>
        </td>
        <td rowSpan={span}>
          {edit ? (
            tierInput(di, r, `Mục tiêu ${no || 'mới'} lĩnh vực ${d.name}`, {
              kind: 'goal',
              after: r.id,
              // Enter ở mục tiêu: thêm mục tiêu mới ngay dưới, cùng nhóm (mỗi tầng Enter thêm mục cùng tầng)
              onEnter: () => insertAfter(di, r.id, [make('goal')]),
            })
          ) : (
            <div className="ga-goal-table__pad">{r.text}</div>
          )}
        </td>
      </>
    );
    const del = edit && (
      <td rowSpan={span} className="center">
        <div className="ga-goal-table__pad">
          <button type="button" className="icon-btn" onClick={() => removeRow(di, r.id)} aria-label={`Xóa mục tiêu ${no || ''}`}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </td>
    );
    if (!contents.length)
      return [
        <tr key={r.id}>
          {lead}
          {head}
          <td>
            {edit && r.text.trim()
              ? cellInput({
                  'aria-label': `Nội dung đầu tiên của mục tiêu ${no}`,
                  placeholder: 'Nhập nội dung, Enter để thêm nội dung (dán được nhiều dòng)',
                  value: '',
                  onChange: (e) => addContentsAfter(di, r, null, [e.target.value]),
                  onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                  onPaste: (e) => {
                    const lines = pastedLines(e);
                    if (!lines.length) return;
                    e.preventDefault();
                    addContentsAfter(di, r, null, lines);
                  },
                })
              : dash}
          </td>
          {themeCells(di, r, null)}
          {del}
        </tr>,
      ];
    return contents.map((c, k) => (
      <tr key={c.id}>
        {k === 0 && lead}
        {k === 0 && head}
        <td>
          {edit ? (
            <div className="ga-goal-line__text">
              {cellInput({
                'data-focus': c.id,
                'aria-label': `Nội dung ${k + 1} của mục tiêu ${no || 'mới'}`,
                placeholder: 'Nhập nội dung',
                value: c.text,
                onChange: (e) => mapContents(di, r.id, (cs) => cs.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x))),
                onKeyDown: contentKeys(di, r, c),
                onPaste: contentPaste(di, r, c),
              })}
              <button
                type="button"
                className="icon-btn"
                onClick={() => mapContents(di, r.id, (cs) => cs.filter((x) => x.id !== c.id))}
                aria-label={`Xóa nội dung ${k + 1}`}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="ga-goal-table__pad">{c.text}</div>
          )}
        </td>
        {themeCells(di, r, c, `nội dung ${k + 1} của mục tiêu ${no || 'mới'}`)}
        {k === 0 && del}
      </tr>
    ));
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
        } else if (e.key === 'Backspace' && !b.sub.text) {
          e.preventDefault();
          removeRow(di, b.sub.id);
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
  const newSubInput = (di, d) => (
    <input
      aria-label={`Thêm lĩnh vực con ${d.name}`}
      placeholder="Thêm lĩnh vực con"
      size={fitSize('', 'Thêm lĩnh vực con')}
      value=""
      onChange={(e) => insertAfter(di, d.rows.length ? d.rows[d.rows.length - 1].id : null, [make('sub', e.target.value)])}
      onKeyDown={(e) => enterKey(e) && e.preventDefault()}
      onPaste={(e) => {
        const lines = pastedLines(e);
        if (!lines.length) return;
        e.preventDefault();
        insertAfter(
          di,
          d.rows.length ? d.rows[d.rows.length - 1].id : null,
          lines.map((t) => make('sub', t)),
        );
      }}
    />
  );
  const goalSpan = (r) => Math.max(readOnly ? r.contents.filter((c) => c.text.trim()).length : r.contents.length, 1);
  const groupSpan = (gr) => Math.max(gr.goals.reduce((n, r) => n + goalSpan(r), 0) + (edit ? 1 : 0), 1);

  /**
   * Toàn bộ hàng của một lĩnh vực: lĩnh vực con là dải tiêu đề đánh số 1, 2… trong lĩnh vực;
   * dưới mỗi dải là các nhóm kết quả (cột gộp dọc) và mục tiêu. Lĩnh vực không có lĩnh vực con thì không có dải.
   */
  const domainRows = (d, di) => {
    const out = [];
    const rows = readOnly ? d.rows.filter((r) => r.text.trim() || (r.kind === 'goal' && r.contents.some((c) => c.text.trim()))) : d.rows;
    let subNo = 0;
    toTiers(rows).forEach((b, bi) => {
      if (b.sub) {
        subNo += 1;
        out.push(
          <tr key={b.sub.id}>
            <td colSpan={cols} className="ga-goal-table__subband">
              <div className="ga-goal-table__subname">
                {subNo}. {edit ? subInput(di, b, `Lĩnh vực con ${subNo}`) : b.sub.text}
                {edit && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeRow(di, b.sub.id)}
                    aria-label={`Xóa lĩnh vực con ${subNo}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            </td>
          </tr>,
        );
      }
      // Gợi ý kết quả mong đợi theo Chương trình GDMN: đúng nhóm tuổi, lĩnh vực; bỏ các câu lĩnh vực này đã dùng
      const used = new Set(d.rows.filter((r) => r.kind === 'group').map((r) => normalizeText(r.text)));
      const suggestions = (current = '') =>
        expectedResultsFor(ageGroupId, d.name, b.sub?.text)
          .map((x) => x.text)
          .filter((t) => !used.has(normalizeText(t)) || normalizeText(t) === normalizeText(current));
      const SUGGEST_LABEL = 'Gợi ý kết quả mong đợi theo Chương trình GDMN';
      b.groups.forEach((gr, gi) => {
        let groupCell = (
          <td key="group" rowSpan={groupSpan(gr)}>
            {gr.group ? (
              edit ? (
                <div className="ga-goal-line__text">
                  <Suggest
                    query={gr.group.text}
                    options={suggestions(gr.group.text)}
                    label={SUGGEST_LABEL}
                    onPick={(text) => patchRow(di, gr.group.id, { text })}
                  >
                    {tierInput(di, gr.group, 'Nhóm kết quả mong đợi', {
                      kind: 'group',
                      after: gr.last,
                      placeholder: GROUP_HINT,
                      onEnter: () => insertAfter(di, gr.last, [make('group')]),
                    })}
                  </Suggest>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeGroup(di, gr)}
                    aria-label={`Xóa kết quả mong đợi ${gr.group.text}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="ga-goal-table__pad">{gr.group.text}</div>
              )
            ) : edit && gr.goals.length ? (
              // Mục tiêu chưa thuộc nhóm nào: gõ vào đây để bổ sung nhóm kết quả cho các mục tiêu này
              <Suggest query="" options={suggestions()} label={SUGGEST_LABEL} onPick={(text) => addGroupBefore(di, gr.goals[0].id, text)}>
                {cellInput({
                  'aria-label': `Bổ sung kết quả mong đợi cho MT${numbers[gr.goals[0].id] || ''}`,
                  placeholder: GROUP_HINT,
                  value: '',
                  onChange: (e) => addGroupBefore(di, gr.goals[0].id, e.target.value),
                  onKeyDown: (e) => enterKey(e) && e.preventDefault(),
                })}
              </Suggest>
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
              <td className="cell--fixed">{dash}</td>
              <td colSpan={restSpan - 1}>{newInput(di, 'goal', gr.last, `Thêm mục tiêu lĩnh vực ${d.name}`, NEW_GOAL_HINT)}</td>
              <td />
            </tr>,
          );
        else if (!gr.goals.length)
          out.push(
            <tr key={`empty-${bi}-${gi}`}>
              {lead()}
              <td colSpan={restSpan}>{dash}</td>
            </tr>,
          );
      });
      if (edit && !b.groups.some((g) => g.group))
        out.push(
          // Tầng chưa có nhóm kết quả: một ô nhập nhóm (tầng trống thì gõ được cả mục tiêu); có nhóm rồi thì Enter ở ô nhóm mới thêm dòng
          <tr key={`new-group-${bi}`}>
            <td>
              <Suggest
                query=""
                options={suggestions()}
                label={SUGGEST_LABEL}
                onPick={(text) => insertAfter(di, b.last, [make('group', text)])}
              >
                {newInput(di, 'group', b.last, `Thêm nhóm kết quả lĩnh vực ${d.name}`, GROUP_HINT)}
              </Suggest>
            </td>
            <td className="cell--fixed">{dash}</td>
            <td colSpan={restSpan - 1}>
              {!b.groups.length && newInput(di, 'goal', b.last, `Thêm mục tiêu lĩnh vực ${d.name}`, NEW_GOAL_HINT)}
            </td>
            <td />
          </tr>,
        );
      else if (!edit && !b.groups.length)
        out.push(
          <tr key={`empty-${bi}`}>
            <td>{dash}</td>
            <td colSpan={restSpan}>{dash}</td>
          </tr>,
        );
    });
    if (edit)
      out.push(
        <tr key="new-sub">
          <td colSpan={cols} className="ga-goal-table__subband">
            <div className="ga-goal-table__subname">
              {subNo + 1}. {newSubInput(di, d)}
            </div>
          </td>
        </tr>,
      );
    return out;
  };

  const headRows = themes.length ? 2 : 1;
  // Ít chủ đề (1–2 cột hẹp) thì nới các cột chủ đề để tiêu đề "Chủ đề thực hiện" nằm gọn, không đè sang cột Xóa
  const themeColStyle = themes.length && themes.length < 3 ? { width: Math.ceil(THEME_HEAD_MIN / themes.length) } : undefined;
  return (
    <div className="table-wrap">
      <table className={`table ga-plan-table ga-goal-table${themes.length ? ' ga-goal-table--themes' : ''}`} onMouseDown={focusCell}>
        <colgroup>
          <col className="ga-goal-table__group" />
          <col className="ga-goal-table__code" />
          <col className="ga-goal-table__goaltext" />
          <col />
          {themes.map((t) => (
            <col key={t.id} className="ga-goal-table__theme" style={themeColStyle} />
          ))}
          {edit && <col className="ga-goal-table__del" />}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={headRows}>Nhóm kết quả mong đợi</th>
            <th rowSpan={headRows} className="cell--fixed">
              STT
            </th>
            <th rowSpan={headRows}>Mục tiêu giáo dục</th>
            <th rowSpan={headRows}>Nội dung giáo dục</th>
            {themes.length > 0 && (
              <th colSpan={themes.length} className="center">
                Chủ đề thực hiện
              </th>
            )}
            {edit && (
              <th rowSpan={headRows} className="center">
                Xóa
              </th>
            )}
          </tr>
          {themes.length > 0 && (
            <tr>
              {themes.map((t) => (
                <th key={t.id} className="center text-xs" title={t.name}>
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
  );
}

/* ---------- B. Chủ đề, sự kiện trong năm ---------- */

/** Bảng dự kiến chủ đề, sự kiện cả năm và các đợt nghỉ. Số MT (từ dấu tích ở bảng mục tiêu) và số tuần tự tính; xóa chủ đề thì bỏ dấu tích của chủ đề đó. */
export function ThemeEventTable({ themes, breaks, domains, numbers, onChange, readOnly = false }) {
  const setFocusId = useCellFocus();
  const patchTheme = (id, patch) => onChange({ themes: themes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const removeTheme = (id) =>
    onChange({
      themes: themes.filter((t) => t.id !== id),
      domains: domains.map((d) => ({
        ...d,
        rows: d.rows.map((r) =>
          r.kind === 'goal' ? { ...r, contents: r.contents.map((c) => ({ ...c, themes: c.themes.filter((t) => t !== id) })) } : r,
        ),
      })),
    });
  const patchBreak = (id, patch) => onChange({ breaks: breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  // Thêm dòng như bảng mục tiêu: gõ vào dòng trống cuối bảng, hoặc Enter ở ô tên để chèn dòng mới ngay dưới
  const insertTheme = (afterIdx, name = '') => {
    const t = { ...blankTheme(), name, abbr: initialsOf(name) };
    onChange({ themes: [...themes.slice(0, afterIdx + 1), t, ...themes.slice(afterIdx + 1)] });
    setFocusId(t.id);
  };
  const insertBreak = (afterIdx, label = '') => {
    const b = { id: uid(), label, start: '', end: '' };
    onChange({ breaks: [...breaks.slice(0, afterIdx + 1), b, ...breaks.slice(afterIdx + 1)] });
    setFocusId(b.id);
  };
  /** Enter ở ô tên: thêm dòng dưới; Backspace ở dòng trống: xóa dòng, con trỏ về dòng trên. */
  const nameKeys = (row, i, list, insert, blank, remove) => (e) => {
    if (enterKey(e)) {
      e.preventDefault();
      if (!blank(row)) insert(i);
    } else if (e.key === 'Backspace' && blank(row)) {
      e.preventDefault();
      remove(row.id);
      if (i > 0) setFocusId(list[i - 1].id);
    }
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
      <td className="cell--fixed" />
      <td colSpan={span}>
        {cellInput({
          'aria-label': label,
          placeholder,
          value: '',
          onChange: (e) => create(e.target.value),
          onKeyDown: (e) => enterKey(e) && e.preventDefault(),
        })}
      </td>
    </tr>
  );
  const dateCell = (value, onValue, label, row, others) =>
    readOnly ? (
      <div className="ga-goal-table__pad">{value ? fmtDate(value) : '—'}</div>
    ) : (
      <DatePickerCell value={value} onChange={onValue} label={label} range={row} taken={others} />
    );
  // Khoảng thời gian đã dùng (tô đỏ trên lịch): mọi chủ đề và đợt nghỉ khác dòng đang chọn
  const span = (x, label) => ({ start: x.start, end: x.end || x.start, label });
  const breakSpans = breaks.filter((b) => b.start).map((b) => ({ ...span(b, `đợt nghỉ "${b.label || 'chưa đặt tên'}"`), id: b.id }));
  const themeSpans = themes.filter((t) => t.start).map((t) => ({ ...span(t, `chủ đề "${t.name || 'chưa đặt tên'}"`), id: t.id }));
  const takenForTheme = (t) => [...themeSpans.filter((x) => x.id !== t.id), ...breakSpans];
  const takenForBreak = (b) => [...themeSpans, ...breakSpans.filter((x) => x.id !== b.id)];
  /** Chủ đề trùng thời gian với chủ đề khác: chỉ báo, không chặn. */
  const overlapOf = (t) =>
    t.start && t.end ? themeSpans.filter((x) => x.id !== t.id && x.start <= t.end && t.start <= x.end).map((x) => x.label) : [];

  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col className="ga-goal-table__del" />
            <col />
            <col className="ga-goal-table__code" />
            <col />
            <col />
            <col className="ga-cal__col" />
            <col className="ga-cal__col" />
            <col className="ga-goal-table__code" />
            <col />
            {!readOnly && <col className="ga-goal-table__del" />}
          </colgroup>
          <thead>
            <tr>
              <th className="cell--fixed">STT</th>
              <th>Tên chủ đề</th>
              <th className="center">Viết tắt</th>
              <th className="cell--fixed">Mục tiêu giáo dục</th>
              <th>Ngày lễ hội</th>
              <th>Từ ngày</th>
              <th>Đến ngày</th>
              <th className="center cell--fixed">Số tuần</th>
              <th>Ghi chú</th>
              {!readOnly && <th className="center">Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {readOnly && themes.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="ga-goal-table__pad muted">Chưa có chủ đề.</div>
                </td>
              </tr>
            )}
            {themes.map((t, i) => (
              <tr key={t.id}>
                <td className="cell--fixed">
                  <div className="ga-goal-table__pad">{i + 1}</div>
                </td>
                <td>
                  {textCell(
                    t.name,
                    (name) => patchTheme(t.id, !t.abbr || t.abbr === initialsOf(t.name) ? { name, abbr: initialsOf(name) } : { name }),
                    `Tên chủ đề ${i + 1}`,
                    {
                      'data-focus': t.id,
                      placeholder: 'Nhập tên chủ đề',
                      onKeyDown: nameKeys(t, i, themes, insertTheme, isBlankTheme, removeTheme),
                    },
                  )}
                </td>
                <td className="center ga-goal-table__center">
                  {textCell(t.abbr, (abbr) => patchTheme(t.id, { abbr }), `Viết tắt chủ đề ${i + 1}`)}
                </td>
                <td className="cell--fixed">
                  <div className="ga-goal-table__pad">{themeGoalLabel(domains, numbers, t) || 'Tích ở tab Mục tiêu'}</div>
                </td>
                <td>{textCell(t.festivals, (festivals) => patchTheme(t.id, { festivals }), `Ngày lễ hội chủ đề ${i + 1}`)}</td>
                <td>{dateCell(t.start, (start) => patchTheme(t.id, { start }), `Từ ngày chủ đề ${i + 1}`, t, takenForTheme(t))}</td>
                <td>
                  {dateCell(t.end, (end) => patchTheme(t.id, { end }), `Đến ngày chủ đề ${i + 1}`, t, takenForTheme(t))}
                  {!readOnly && overlapOf(t).length > 0 && (
                    <div className="ga-goal-table__pad text-xs text-danger">Trùng thời gian với {overlapOf(t).join(', ')}</div>
                  )}
                </td>
                <td className="center cell--fixed">
                  <div className="ga-goal-table__pad">{weekCount(t, breaks) || '—'}</div>
                </td>
                <td>{textCell(t.note, (note) => patchTheme(t.id, { note }), `Ghi chú chủ đề ${i + 1}`)}</td>
                {!readOnly && (
                  <td className="center">
                    <div className="ga-goal-table__pad">
                      <button type="button" className="icon-btn" onClick={() => removeTheme(t.id)} aria-label={`Xóa chủ đề ${i + 1}`}>
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!readOnly &&
              newRow(9, 'Thêm chủ đề', 'Nhập tên chủ đề mới (Enter trong ô tên chủ đề cũng thêm dòng)', (name) =>
                insertTheme(themes.length - 1, name),
              )}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col className="ga-goal-table__del" />
            <col />
            <col className="ga-cal__col" />
            <col className="ga-cal__col" />
            {!readOnly && <col className="ga-goal-table__del" />}
          </colgroup>
          <thead>
            <tr>
              <th className="cell--fixed">STT</th>
              <th>Đợt nghỉ (Tết, ôn tập, nghỉ lễ…)</th>
              <th>Từ ngày</th>
              <th>Đến ngày</th>
              {!readOnly && <th className="center">Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {readOnly && breaks.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="ga-goal-table__pad muted">{NO_BREAKS}</div>
                </td>
              </tr>
            )}
            {breaks.map((b, i) => (
              <tr key={b.id}>
                <td className="cell--fixed">
                  <div className="ga-goal-table__pad">{i + 1}</div>
                </td>
                <td>
                  {textCell(b.label, (label) => patchBreak(b.id, { label }), `Tên đợt nghỉ ${i + 1}`, {
                    'data-focus': b.id,
                    placeholder: 'Nhập tên đợt nghỉ',
                    onKeyDown: nameKeys(b, i, breaks, insertBreak, isBlankBreak, (id) =>
                      onChange({ breaks: breaks.filter((x) => x.id !== id) }),
                    ),
                  })}
                </td>
                <td>{dateCell(b.start, (start) => patchBreak(b.id, { start }), `Từ ngày đợt nghỉ ${i + 1}`, b, takenForBreak(b))}</td>
                <td>{dateCell(b.end, (end) => patchBreak(b.id, { end }), `Đến ngày đợt nghỉ ${i + 1}`, b, takenForBreak(b))}</td>
                {!readOnly && (
                  <td className="center">
                    <div className="ga-goal-table__pad">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onChange({ breaks: breaks.filter((x) => x.id !== b.id) })}
                        aria-label={`Xóa đợt nghỉ ${i + 1}`}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!readOnly && newRow(4, 'Thêm đợt nghỉ', NO_BREAKS_HINT, (label) => insertBreak(breaks.length - 1, label))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Tab chia kế hoạch năm: mục tiêu trước, chủ đề và sự kiện sau ---------- */

export const PLAN_TABS = [
  { key: 'goals', label: 'Mục tiêu, nội dung giáo dục' },
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
