import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/ui/icons';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { fmtDate } from '@/components/education-plan/eduUi';

const DOW = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const pad = (n) => String(n).padStart(2, '0');
// Ngày dạng yyyy-mm-dd, tính theo UTC để không lệch múi giờ
const isoOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const monthStart = (iso) => {
  const [y, m] = (iso || isoOf(new Date())).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
const addMonths = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

/** Các tuần (Thứ 2 → Chủ nhật) phủ tháng đang xem: chỉ đủ số tuần của tháng (4–6 hàng) cho lịch thấp gọn. */
const monthGrid = (first) => {
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - offset + i)));
};

/**
 * Ô chọn ngày trong bảng chủ đề / đợt nghỉ: lịch thả xuống tô màu theo tuần đã dùng.
 * taken: [{ start, end, label }] các khoảng của dòng khác (ngày thuộc khoảng này tô đỏ, rê chuột thấy tên);
 * range: khoảng của chính dòng này (tô xanh lá). Ngày đỏ vẫn chọn được, bảng tự báo trùng.
 */
export default function DatePickerCell({ value, onChange, label, taken = [], range = {}, openAt }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthStart(value || range.start));
  const ref = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    // Mở lịch ở tháng của ngày đang chọn; ô trống thì mở ở tháng sau khoảng đã dùng gần nhất
    const lastEnd = taken
      .map((t) => t.end || t.start)
      .sort()
      .at(-1);
    // Chưa có ngày nào thì mở ở tháng đầu năm học (lập kế hoạch năm sau không phải bấm "Tháng sau" nhiều lần)
    if (!open) setView(monthStart(value || range.start || lastEnd || openAt));
    setOpen((v) => !v);
  };
  const pick = (iso) => {
    onChange(iso);
    setOpen(false);
  };
  // Gõ ngày dd/mm/yyyy (hoặc dd/mm, lấy năm của tháng đang xem) rồi Enter, không phải bấm qua nhiều tháng
  const typeDate = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const m = e.target.value.trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/);
    if (!m) return;
    const y = Number(m[3] || view.getUTCFullYear());
    const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    if (d.getUTCDate() !== Number(m[1])) return;
    pick(isoOf(d));
  };
  // Ngày có thể vừa thuộc chủ đề vừa thuộc đợt nghỉ: ghi đủ tên các dòng đang giữ ngày đó
  const ownerOf = (iso) =>
    taken
      .filter((t) => t.start && t.start <= iso && iso <= (t.end || t.start))
      .map((t) => t.label)
      .join(', ') || null;
  // Khoảng của chính dòng; mới có Từ ngày thì vẫn đánh dấu ngày bắt đầu để chọn Đến ngày cho dễ
  const inRange = (iso) => range.start && (range.end ? range.start <= iso && iso <= range.end : iso === range.start);
  const today = isoOf(new Date());

  return (
    <div ref={ref}>
      <button
        type="button"
        className="ga-cell-input ga-cal__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
      >
        {value ? <span>{fmtDate(value)}</span> : <span className="muted">Chọn ngày</span>}
        <CalendarDays size={15} className="muted" aria-hidden />
      </button>
      {open && (
        <FloatingPanel anchorRef={ref} panelRef={panelRef} minWidth={360}>
          <div className="ga-cal" role="dialog" aria-label={label}>
            <input
              className="input"
              placeholder="Gõ ngày dd/mm/yyyy rồi Enter"
              aria-label={`Gõ ${label}`}
              defaultValue={value ? fmtDate(value) : ''}
              onKeyDown={typeDate}
            />
            <div className="ga-cal__head">
              <button type="button" className="icon-btn" onClick={() => setView((v) => addMonths(v, -1))} aria-label="Tháng trước">
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span>
                Tháng {view.getUTCMonth() + 1} năm {view.getUTCFullYear()}
              </span>
              <button type="button" className="icon-btn" onClick={() => setView((v) => addMonths(v, 1))} aria-label="Tháng sau">
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
            <div className="ga-cal__grid">
              {DOW.map((d) => (
                <div key={d} className="ga-cal__dow">
                  {d}
                </div>
              ))}
              {monthGrid(view).map((d) => {
                const iso = isoOf(d);
                const owner = ownerOf(iso);
                const cls = [
                  'ga-cal__day',
                  d.getUTCMonth() !== view.getUTCMonth() && 'ga-cal__day--out',
                  // Ưu tiên màu: ngày đang chọn (xanh lá đậm) > khoảng của dòng này (xanh lá nhạt) > đã thuộc dòng khác (đỏ)
                  iso === value ? 'ga-cal__day--selected' : inRange(iso) ? 'ga-cal__day--range' : owner ? 'ga-cal__day--taken' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={iso}
                    type="button"
                    className={cls}
                    title={owner ? `Đã thuộc ${owner}` : undefined}
                    aria-label={`${fmtDate(iso)}${owner ? `, đã thuộc ${owner}` : ''}`}
                    aria-pressed={iso === value}
                    aria-current={iso === today ? 'date' : undefined}
                    autoFocus={iso === (value || '')}
                    onClick={() => pick(iso)}
                  >
                    {d.getUTCDate()}
                  </button>
                );
              })}
            </div>
            <div className="ga-cal__legend">
              <span>
                <span className="ga-cal__swatch ga-cal__day--taken" />
                Đã có lịch
              </span>
              <span>
                <span className="ga-cal__swatch ga-cal__day--selected" />
                Đang chọn
              </span>
              <span>
                <span className="ga-cal__swatch" />
                Còn trống
              </span>
              {value && (
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => pick('')}>
                  Xóa ngày
                </button>
              )}
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
