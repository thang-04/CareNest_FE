import { useMemo, useState } from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { History } from '@/components/ui/icons';
import { SidePanel } from '@/components/ui/SidePanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Notice } from '@/components/education-plan/eduUi';
import { diffLines } from '@/models/education-plan/planHistory.mjs';

const pad = (n) => String(n).padStart(2, '0');
const at = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const CONTEXT = 2;

// Dòng giống nhau dài thì gộp, chỉ giữ vài dòng quanh chỗ khác để dễ thấy thay đổi
function collapse(ops) {
  const out = [];
  let run = [];
  const flush = (last) => {
    const head = out.length ? CONTEXT : 0;
    const tail = last ? 0 : CONTEXT;
    if (run.length > head + tail + 1) {
      out.push(...run.slice(0, head), { type: 'gap', count: run.length - head - tail }, ...run.slice(run.length - tail));
    } else out.push(...run);
    run = [];
  };
  ops.forEach((op) => {
    if (op.type === 'same') run.push(op);
    else {
      flush(false);
      out.push(op);
    }
  });
  flush(true);
  return out;
}

/**
 * Lịch sử phiên bản khi soạn (Tiền 03/11, giống Docs): bản đã lưu hiện tại + tối đa 2 mốc chưa lưu trên máy.
 * Chọn một bản ⇒ so với nội dung đang mở (thêm xanh, bỏ đỏ gạch); "Dùng bản này" thay toàn bộ nội dung, vẫn phải bấm Lưu.
 * blockedReason(entry) trả lý do không dùng được (entry = null là bản đã lưu); actions(entry) thêm nút ở chân panel.
 */
export function VersionHistory({ drafts, saved, current, unsaved, linesOf, onUse, blockedReason, actions }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const items = useMemo(
    () => [
      { id: 'saved', title: 'Bản đã lưu hiện tại', doc: saved, entry: null },
      ...drafts.map((entry, i) => ({ id: `draft-${i}-${entry.savedAt}`, title: `Lúc ${at(entry.savedAt)}`, doc: entry.doc, entry })),
    ],
    [drafts, saved],
  );
  const chosen = items.find((x) => x.id === pick && x.doc) || null;
  const ops = useMemo(() => (chosen ? diffLines(linesOf(current), linesOf(chosen.doc)) : []), [chosen, current, linesOf]);
  const added = ops.filter((x) => x.type === 'add').length;
  const removed = ops.filter((x) => x.type === 'del').length;
  const reason = chosen ? blockedReason?.(chosen.entry) || null : null;
  const close = () => {
    setOpen(false);
    setPick(null);
  };
  const use = () => {
    setConfirming(false);
    onUse(chosen.entry, chosen.doc);
    close();
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn ga-history-btn"
        aria-label={drafts.length ? 'Lịch sử phiên bản (có bản chưa lưu)' : 'Lịch sử phiên bản'}
        title="Lịch sử phiên bản"
        onClick={() => setOpen(true)}
      >
        <History size={20} aria-hidden />
        {drafts.length > 0 && <span className="ga-history-btn__dot" aria-hidden />}
      </button>
      <SidePanel
        open={open}
        title="Lịch sử phiên bản"
        onClose={close}
        wide
        footer={
          chosen && (
            <div className="row gap-2 ga-history-foot">
              {actions?.(chosen.entry, chosen.doc)}
              <button
                type="button"
                className="btn btn--primary"
                disabled={!!reason || (!added && !removed)}
                onClick={() => (unsaved ? setConfirming(true) : use())}
              >
                Dùng bản này
              </button>
            </div>
          )
        }
      >
        <ul className="ga-history-list">
          {items.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className={`ga-history-item ${pick === x.id ? 'ga-history-item--active' : ''}`}
                aria-pressed={pick === x.id}
                disabled={!x.doc}
                onClick={() => setPick(x.id)}
              >
                <span className="ga-history-item__title">{x.title}</span>
                {x.entry ? (
                  <StatusBadge tone="orange" label="Chưa lưu" size="sm" />
                ) : x.doc ? (
                  <StatusBadge tone="green" label="Đã lưu" size="sm" />
                ) : (
                  <span className="muted text-sm">Chưa lưu lần nào</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {drafts.length === 0 && <p className="muted text-sm">Không có bản chưa lưu nào trên máy này.</p>}
        {chosen ? (
          <section className="ga-history-preview" aria-label={`Khác biệt: ${chosen.title}`}>
            <p className="text-sm">
              So với nội dung đang mở:{' '}
              {added || removed ? (
                <>
                  <span className="ga-history-count--add">+{added} dòng</span> ·{' '}
                  <span className="ga-history-count--del">−{removed} dòng</span>
                </>
              ) : (
                'giống nhau.'
              )}
            </p>
            {reason && <Notice tone="warn">{reason}</Notice>}
            <ol className="ga-history-diff">
              {collapse(ops).map((op, i) =>
                op.type === 'gap' ? (
                  <li key={i} className="ga-history-line ga-history-line--gap">
                    … {op.count} dòng giống nhau
                  </li>
                ) : (
                  <li key={i} className={`ga-history-line ga-history-line--${op.type}`}>
                    <span className="ga-history-line__mark" aria-hidden>
                      {op.type === 'add' ? '+' : op.type === 'del' ? '−' : ''}
                    </span>
                    {op.type === 'add' ? <ins>{op.text}</ins> : op.type === 'del' ? <del>{op.text}</del> : op.text}
                  </li>
                ),
              )}
            </ol>
          </section>
        ) : (
          <p className="muted text-sm">Chọn một bản để xem khác biệt so với nội dung đang mở.</p>
        )}
      </SidePanel>
      <ConfirmationModal
        open={confirming}
        title="Dùng bản này?"
        message="Toàn bộ nội dung đang soạn sẽ được thay bằng bản đã chọn. Thay đổi chưa lưu hiện tại sẽ mất. Sau đó bấm Lưu để ghi lên hệ thống."
        confirmLabel="Dùng bản này"
        cancelLabel="Quay lại"
        onConfirm={use}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
