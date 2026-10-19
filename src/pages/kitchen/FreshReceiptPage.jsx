import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, ClipboardCheck, Timer, Undo2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFreshReceipt, useKitchenCampus } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, Modal } from '@/components';
import { FreshReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbCampusFilter, KbDateFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { reviewFreshReceipt, saveFreshReceipt, setFreshSupplierNotified } from '@/services/kitchen/kitchenService';
import { itemError } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { FRESH_RESULT, FRESH_RESULT_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
const since = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`;
};
const toForm = (data) => ({
  header: { deliveryNote: data.deliveryNote, supplierName: data.supplierName, deliveredAt: data.deliveredAt },
  lines: data.lines.map((l) => ({
    foodId: l.foodId,
    delivered: String(l.delivered).replace('.', ','),
    received: String(l.received).replace('.', ','),
    result: l.result,
    reason: l.reason || '',
  })),
});

/** Nhóm nút Đủ / Thiếu / Trả lại của một dòng. */
function ResultSeg({ value, disabled, onChange, label }) {
  return (
    <span className="kb-res" role="group" aria-label={label}>
      {Object.values(FRESH_RESULT).map((r) => (
        <button key={r} type="button" data-r={r} aria-pressed={value === r} disabled={disabled} onClick={() => onChange(r)}>
          {FRESH_RESULT_LABELS[r]}
        </button>
      ))}
    </span>
  );
}

/**
 * Kiểm nhận hàng tươi theo phiếu giao hàng (khảo sát 18/10/2026, S5–S6; bố cục A): một bảng đủ cột Đặt / Giao / Thực nhận /
 * Kết quả / Lý do / NCC, chân bảng dính. Bếp kiểm rồi gửi; PHT xác nhận cuối hoặc trả bếp kiểm lại. Không cộng tồn kho.
 */
export default function FreshReceiptPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const today = todayInput();
  const date = params.get('date') || today;
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { data, loading, error, reload } = useFreshReceipt(campusId, date, { live: false });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [returnNote, setReturnNote] = useState('');

  useEffect(() => {
    if (data) setForm(toForm(data));
    setErrors({});
  }, [data]);

  const editable = !!data?.canEdit;
  const setHeader = (k, v) => setForm((f) => ({ ...f, header: { ...f.header, [k]: v } }));
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const counts = form
    ? Object.fromEntries(Object.values(FRESH_RESULT).map((r) => [r, form.lines.filter((l) => l.result === r).length]))
    : data?.counts;

  const save = async (submit) => {
    setBusy(true);
    try {
      const toNum = (v) => (String(v).trim() === '' ? '' : Number(String(v).replace(',', '.')));
      const lines = form.lines.map((l) => ({ ...l, delivered: toNum(l.delivered), received: toNum(l.received) }));
      await saveFreshReceipt({ campusId, date, header: form.header, lines, submit }, user);
      toast.success(submit ? 'Đã gửi kết quả kiểm nhận cho PHT xác nhận.' : 'Đã lưu nháp phiếu kiểm nhận.');
      reload({ silent: true });
    } catch (err) {
      setErrors(err.status === 422 && err.details && typeof err.details === 'object' ? err.details : {});
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.', 'Không lưu được');
    } finally {
      setBusy(false);
    }
  };

  const review = async (approve) => {
    setBusy(true);
    try {
      await reviewFreshReceipt({ campusId, date, approve, note: approve ? '' : returnNote }, user);
      toast.success(approve ? 'Đã xác nhận kết quả kiểm nhận.' : 'Đã trả bếp kiểm lại.');
      setReturning(false);
      setReturnNote('');
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.', 'Không lưu được');
    } finally {
      setBusy(false);
    }
  };

  const toggleNotified = async (foodId, notified) => {
    try {
      await setFreshSupplierNotified({ campusId, date, foodId, notified }, user);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.');
    }
  };

  let body;
  if (md.error && !campusId) body = <ErrorState error={md.error} onRetry={md.reload} />;
  else if (!campusId || (!data && !error) || (loading && !data)) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data.lines.length)
    body = (
      <section className="card">
        <EmptyState
          icon={ClipboardCheck}
          title={`Ngày ${formatDate(date)} không có hàng tươi`}
          description="Phiếu đặt hàng tuần không có thực phẩm tươi giao ngày này."
        />
      </section>
    );
  else if (form) {
    const steps = (
      <div className="kb-steps">
        <span className={`kb-step ${data.submittedAt ? 'kb-step--done' : 'kb-step--now'}`}>
          {data.submittedAt ? <Check size={14} /> : <Timer size={14} />}
          {data.submittedAt ? `Bếp kiểm nhận · ${hhmm(data.submittedAt)} · ${data.submittedByName || ''}` : 'Bếp đang kiểm nhận'}
        </span>
        <ChevronRight size={14} aria-hidden="true" />
        {data.status === 'CONFIRMED' ? (
          <span className="kb-step kb-step--done">
            <Check size={14} /> PHT xác nhận · {hhmm(data.confirmedAt)} · {data.confirmedByName || ''}
          </span>
        ) : (
          <span className={`kb-step ${data.status === 'SUBMITTED' ? 'kb-step--now' : ''}`}>
            <Timer size={14} /> Chờ PHT xác nhận{data.status === 'SUBMITTED' ? ` · đã ${since(data.submittedAt)}` : ''}
          </span>
        )}
      </div>
    );
    body = (
      <div className="kb-stack">
        <section className="card">
          <div className="card__body kb-fr-head">
            <div className="kb-fr-fields">
              <label className="kb-field">
                <span>Phiếu giao hàng</span>
                <input
                  className={`input ${errors.deliveryNote ? 'input--error' : ''}`}
                  value={form.header.deliveryNote}
                  disabled={!editable}
                  aria-invalid={!!errors.deliveryNote}
                  placeholder="Số phiếu"
                  onChange={(e) => setHeader('deliveryNote', e.target.value)}
                />
                {errors.deliveryNote && <small className="text-danger">{errors.deliveryNote}</small>}
              </label>
              <label className="kb-field kb-field--wide">
                <span>NCC</span>
                <input
                  className="input"
                  value={form.header.supplierName}
                  disabled={!editable}
                  onChange={(e) => setHeader('supplierName', e.target.value)}
                />
              </label>
              <label className="kb-field">
                <span>Giờ giao</span>
                <input
                  type="time"
                  className="input"
                  value={form.header.deliveredAt}
                  disabled={!editable}
                  onChange={(e) => setHeader('deliveredAt', e.target.value)}
                />
              </label>
            </div>
            {steps}
          </div>
        </section>
        {data.returnNote && data.status === 'DRAFT' && (
          <div className="alert alert--warning">
            <Undo2 size={18} />
            <div>
              <b>PHT trả bếp kiểm lại:</b> {data.returnNote}
            </div>
          </div>
        )}
        <section className="card kb-fr">
          <div className="table-wrap">
            <table className="table table--grid kb-fc">
              <thead>
                <tr>
                  <th>Thực phẩm</th>
                  <th>ĐVT</th>
                  <th className="right">Đặt</th>
                  <th className="right">Giao</th>
                  <th className="right">Thực nhận</th>
                  <th>Kết quả</th>
                  <th>Lý do</th>
                  <th>NCC</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => {
                  const f = form.lines[i];
                  const odd = f.result !== FRESH_RESULT.OK;
                  return (
                    <tr
                      key={l.foodId}
                      className={
                        f.result === FRESH_RESULT.SHORT ? 'kb-tr--warn' : f.result === FRESH_RESULT.RETURNED ? 'kb-tr--danger' : undefined
                      }
                    >
                      <td>{l.name}</td>
                      <td>{l.unit}</td>
                      <td className="right">{fmtQty(l.ordered)}</td>
                      <td className="right">
                        {editable ? (
                          <input
                            className={`input kb-fc__input ${itemError(errors, i, 'delivered') ? 'input--error' : ''}`}
                            inputMode="decimal"
                            value={f.delivered}
                            aria-label={`Giao ${l.name}`}
                            onChange={(e) => setLine(i, { delivered: e.target.value })}
                          />
                        ) : (
                          fmtQty(l.delivered)
                        )}
                      </td>
                      <td className="right">
                        {editable ? (
                          <input
                            className={`input kb-fc__input ${itemError(errors, i, 'received') ? 'input--error' : ''}`}
                            inputMode="decimal"
                            value={f.received}
                            aria-label={`Thực nhận ${l.name}`}
                            onChange={(e) => setLine(i, { received: e.target.value })}
                          />
                        ) : (
                          fmtQty(l.received)
                        )}
                      </td>
                      <td>
                        <ResultSeg
                          value={f.result}
                          disabled={!editable}
                          label={`Kết quả ${l.name}`}
                          onChange={(r) => setLine(i, { result: r })}
                        />
                      </td>
                      <td>
                        {!odd ? (
                          <span className="muted">—</span>
                        ) : editable ? (
                          <input
                            className={`input kb-fr__reason ${itemError(errors, i, 'reason') ? 'input--error' : ''}`}
                            value={f.reason}
                            placeholder="Lý do"
                            aria-label={`Lý do ${l.name}`}
                            title={itemError(errors, i, 'reason')}
                            onChange={(e) => setLine(i, { reason: e.target.value })}
                          />
                        ) : (
                          <span className="text-sm">{l.reason}</span>
                        )}
                      </td>
                      <td>
                        {l.result === FRESH_RESULT.OK ? null : l.supplierNotifiedAt && !data.canMarkNotified ? (
                          <span className="chip chip--green">Đã báo NCC {hhmm(l.supplierNotifiedAt)}</span>
                        ) : (
                          <label
                            className="checkbox"
                            title={l.supplierNotifiedAt ? `Báo lúc ${formatDateTime(l.supplierNotifiedAt)}` : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={!!l.supplierNotifiedAt}
                              disabled={!data.canMarkNotified}
                              onChange={(e) => toggleNotified(l.foodId, e.target.checked)}
                            />{' '}
                            Đã báo NCC
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="kb-sticky-foot">
            <span className="fw-600">
              Đủ {counts.OK} · Thiếu {counts.SHORT} · Trả lại {counts.RETURNED}
            </span>
            <div className="kb-actions">
              {editable && (
                <>
                  <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>
                    Lưu nháp
                  </button>
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save(true)}>
                    <Check size={16} /> Gửi PHT xác nhận
                  </button>
                </>
              )}
              {data.canReview && (
                <>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setReturning(true)}>
                    Trả bếp kiểm lại
                  </button>
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={() => review(true)}>
                    <Check size={16} /> Xác nhận kết quả
                  </button>
                </>
              )}
              {!editable && !data.canReview && data.status === 'SUBMITTED' && (
                <span className="text-sm muted">Đã gửi PHT lúc {hhmm(data.submittedAt)}</span>
              )}
            </div>
          </div>
        </section>
        {data.lines.some((l) => l.result !== FRESH_RESULT.OK) && (
          <p className="text-sm muted">Thiếu thì báo NCC giao bù; hỏng hoặc sai loại thì trả lại NCC. Hàng tươi không vào kho.</p>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.freshReceipts)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kiểm nhận hàng tươi</h1>
          <p className="page__desc">Đối chiếu phiếu giao hàng với phiếu đặt hàng. PHT xác nhận kết quả cuối.</p>
        </div>
      </div>
      <div className="kb-toolbar kb-toolbar--center">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
        {data && <FreshReceiptStatusBadge status={data.status} />}
      </div>
      {body}
      <Modal
        open={returning}
        onClose={() => setReturning(false)}
        title="Trả bếp kiểm lại"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setReturning(false)}>
              Quay lại
            </button>
            <button type="button" className="btn btn--primary" disabled={busy || !returnNote.trim()} onClick={() => review(false)}>
              Trả bếp kiểm lại
            </button>
          </>
        }
      >
        <label className="kb-field kb-field--block">
          <span>Bếp cần kiểm lại điều gì?</span>
          <textarea className="input" rows={3} maxLength={500} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
        </label>
      </Modal>
    </div>
  );
}
