import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { AlertTriangle, Check, Copy } from '@/components/ui/icons';
import { MEAL_SESSION_LABELS, SESSION_ORDER, WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { dayBlockItems } from '@/utils/menu-planning/mealPlanGrid';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Chép món của một khối từ một ngày sang một hoặc nhiều ngày khác trong tuần (như "Tạo bản sao" của PMS).
 * Trên: ngày nguồn và các món sẽ chép theo bữa. Giữa: thẻ ngày bấm để chọn, mỗi thẻ ghi trạng thái bằng chữ (trống / có N món
 * sẽ bị thay / ngày nghỉ / ngày nguồn); chọn nhanh cả tuần hoặc chỉ ngày trống. Dưới: tóm tắt ngày bị thay. `onCopy(dates)`.
 */
export function CopyDayModal({ draft, block, from, blockLabel, onCopy, onClose }) {
  const days = draft.days.map((day, i) => ({
    day,
    weekday: WEEKDAY_LABELS[i],
    date: ddmm(day.date),
    count: dayBlockItems(day, block).length,
  }));
  const source = days.find((d) => d.day.date === from);
  const sourceItems = dayBlockItems(source?.day, block);
  const bySession = SESSION_ORDER.map((s) => ({ session: s, items: sourceItems.filter((i) => i.session === s) })).filter(
    (g) => g.items.length,
  );
  const selectable = days.filter((d) => d.day.date !== from && !d.day.off);
  const [picked, setPicked] = useState([]);
  const toggle = (date) => setPicked((p) => (p.includes(date) ? p.filter((d) => d !== date) : [...p, date]));
  const pickAll = () => setPicked(selectable.map((d) => d.day.date));
  const pickEmpty = () => setPicked(selectable.filter((d) => d.count === 0).map((d) => d.day.date));
  const replacing = selectable.filter((d) => picked.includes(d.day.date) && d.count > 0);
  const canCopy = picked.length > 0 && sourceItems.length > 0;

  return (
    <Modal
      open
      size="lg"
      title="Chép món sang ngày khác"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!canCopy} onClick={() => onCopy(picked)}>
            <Copy size={16} aria-hidden="true" />
            {picked.length ? `Chép sang ${picked.length} ngày` : 'Chọn ngày để chép'}
          </button>
        </>
      }
    >
      <div className="td-copy">
        <section className="td-copy__source" aria-label="Món sẽ chép">
          <div className="td-copy__source-head">
            <span className="td-copy__eyebrow">Chép từ</span>
            <b>
              {source?.weekday} {source?.date}
            </b>
            <span className="muted">
              · Khối {blockLabel} · {sourceItems.length} món
            </span>
          </div>
          {bySession.length ? (
            <dl className="td-copy__meals">
              {bySession.map((g) => (
                <div key={g.session}>
                  <dt>{MEAL_SESSION_LABELS[g.session] || g.session}</dt>
                  <dd>
                    {g.items.map((i) => (
                      <span key={i.dishId} className="chip">
                        {i.dishName || 'Món đã xóa'}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm muted">Ngày này chưa có món của khối {blockLabel}, chưa có gì để chép.</p>
          )}
        </section>

        <fieldset className="td-copy__targets">
          <div className="td-copy__targets-head">
            <legend>Chép sang ngày</legend>
            <div className="td-copy__quick" role="group" aria-label="Chọn nhanh">
              <button type="button" className="btn btn--ghost btn--sm" disabled={!selectable.length} onClick={pickAll}>
                Cả tuần
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!selectable.some((d) => d.count === 0)}
                onClick={pickEmpty}
              >
                Chỉ ngày trống
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={!picked.length} onClick={() => setPicked([])}>
                Bỏ chọn
              </button>
            </div>
          </div>
          <div className="td-copy__days">
            {days.map((d) => {
              const isSource = d.day.date === from;
              const disabled = isSource || d.day.off;
              const on = picked.includes(d.day.date);
              const status = isSource
                ? 'Ngày nguồn'
                : d.day.off
                  ? 'Ngày nghỉ'
                  : d.count
                    ? `Có ${d.count} món${on ? ' · sẽ bị thay' : ''}`
                    : 'Đang trống';
              const tone = isSource ? 'source' : disabled ? 'off' : on && d.count ? 'replace' : on ? 'on' : '';
              return (
                <label key={d.day.date} className={`td-copy__day ${tone ? `td-copy__day--${tone}` : ''}`}>
                  <input type="checkbox" className="sr-only" checked={on} disabled={disabled} onChange={() => toggle(d.day.date)} />
                  <span className="td-copy__check" aria-hidden="true">
                    {(on || isSource) && <Check size={14} />}
                  </span>
                  <span className="td-copy__weekday">{d.weekday}</span>
                  <span className="td-copy__date">{d.date}</span>
                  <span className="td-copy__status">{status}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {replacing.length > 0 && (
          <p className="td-copy__warn" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Sẽ thay món đang có ở <b>{replacing.map((d) => `${d.weekday} ${d.date} (${d.count} món)`).join(', ')}</b>. Món của khối khác
              không đổi.
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
