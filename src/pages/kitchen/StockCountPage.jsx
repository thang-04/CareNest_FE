import { useEffect, useState } from 'react';
import { ClipboardList, Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useStockCounts } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { createStockCount, saveStockCount } from '@/services/kitchen/kitchenService';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import { COUNT_DIFF_REASON_LABELS, STOCK_COUNT_STATUS, STOCK_COUNT_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const toDraft = (count) =>
  Object.fromEntries(
    count.lines.map((l) => [
      l.foodId,
      { countedQty: l.countedQty == null ? '' : String(l.countedQty).replace('.', ','), reason: l.reason },
    ]),
  );

/**
 * Kiểm kê kho khô theo tháng (quyết định 5): nhập số đếm, lệch khác 0 phải chọn lý do; chốt thì tồn = số đếm (giao dịch
 * ADJUST) và khóa phiếu. Mỗi cơ sở một phiếu nháp. Phiếu nhập sai cũng chỉnh qua đây (Q1 chưa có câu trả lời khác).
 */
export default function StockCountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [campusId, setCampusId] = useState(user?.campusId || md.campuses[0]?.id || '');
  const { data, loading, error, reload } = useStockCounts(campusId);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!campusId && md.campuses[0]) setCampusId(md.campuses[0].id);
  }, [campusId, md.campuses]);

  const counts = data?.counts || [];
  const current = counts.find((c) => c.id === selectedId) || counts.find((c) => c.status === STOCK_COUNT_STATUS.DRAFT) || counts[0] || null;
  const editable = current?.status === STOCK_COUNT_STATUS.DRAFT && data?.canWrite;

  useEffect(() => {
    if (current) setDraft(toDraft(current));
    setErrors({});
  }, [current]);

  const create = async () => {
    setBusy(true);
    try {
      const c = await createStockCount({ campusId }, user);
      setSelectedId(c.id);
      toast.success('Đã tạo phiếu kiểm kê.');
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không tạo được phiếu.', 'Không tạo được');
    } finally {
      setBusy(false);
    }
  };

  const save = async (finalize) => {
    setBusy(true);
    try {
      const lines = Object.entries(draft).map(([foodId, v]) => ({
        foodId,
        countedQty: v.countedQty === '' ? null : Number(String(v.countedQty).replace(',', '.')),
        reason: v.reason,
      }));
      await saveStockCount({ id: current.id, lines, finalize }, user);
      toast.success(finalize ? 'Đã chốt kiểm kê, tồn kho cập nhật theo số đếm.' : 'Đã lưu số đếm.');
      setConfirming(false);
      reload({ silent: true });
    } catch (err) {
      setErrors(err.status === 422 && err.details && typeof err.details === 'object' ? err.details : {});
      toast.error(err.message || 'Không lưu được.', 'Không lưu được');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const setLine = (foodId, patch) => {
    setDraft((d) => ({ ...d, [foodId]: { ...d[foodId], ...patch } }));
    setErrors((e) => ({ ...e, [`lines.${foodId}`]: undefined }));
  };

  let body;
  if (loading && !data) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!current)
    body = (
      <section className="card">
        <EmptyState
          icon={ClipboardList}
          title="Chưa có phiếu kiểm kê"
          description="Tạo phiếu để đếm tồn đồ khô của cơ sở."
          action={
            data.canWrite && (
              <button type="button" className="btn btn--primary" disabled={busy} onClick={create}>
                <Plus size={16} /> Tạo phiếu kiểm kê
              </button>
            )
          }
        />
      </section>
    );
  else
    body = (
      <div className="kb-split">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">
              {current.code} · {STOCK_COUNT_STATUS_LABELS[current.status]}
            </h2>
            <span className="text-xs muted">
              {current.status === STOCK_COUNT_STATUS.FINALIZED
                ? `Chốt ${formatDateTime(current.finalizedAt)} · ${current.finalizedByName || ''}`
                : `Tạo ${formatDateTime(current.createdAt)} · ${current.createdByName || ''}`}
            </span>
          </div>
          <div className="table-wrap">
            <table className="table kb-fc">
              <thead>
                <tr>
                  <th>Thực phẩm</th>
                  <th>ĐVT</th>
                  <th className="right">Tồn hệ thống</th>
                  <th className="right">Số đếm</th>
                  <th className="right">Lệch</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {current.lines.map((l) => {
                  const v = draft[l.foodId] || { countedQty: '', reason: '' };
                  const counted = v.countedQty === '' ? null : Number(String(v.countedQty).replace(',', '.'));
                  const diff = counted == null || Number.isNaN(counted) ? null : Math.round((counted - l.systemQty) * 1000) / 1000;
                  const err = errors[`lines.${l.foodId}`];
                  return (
                    <tr key={l.foodId} className={diff ? 'kb-tr--warn' : undefined}>
                      <td>{l.name}</td>
                      <td>{l.unit}</td>
                      <td className="right">{fmtQty(l.systemQty)}</td>
                      <td className="right">
                        {editable ? (
                          <input
                            className={`input kb-fc__input ${err ? 'input--error' : ''}`}
                            inputMode="decimal"
                            value={v.countedQty}
                            aria-label={`Số đếm ${l.name}`}
                            title={err}
                            onChange={(e) => setLine(l.foodId, { countedQty: e.target.value })}
                          />
                        ) : (
                          fmtQty(l.countedQty)
                        )}
                      </td>
                      <td className={`right ${diff < 0 ? 'kb-short' : diff > 0 ? 'kb-over' : 'muted'}`}>{diff ? fmtQty(diff) : '—'}</td>
                      <td>
                        {editable ? (
                          diff ? (
                            <select
                              className={`select ${err ? 'input--error' : ''}`}
                              value={v.reason}
                              aria-label={`Lý do lệch ${l.name}`}
                              onChange={(e) => setLine(l.foodId, { reason: e.target.value })}
                            >
                              <option value="">Chọn lý do</option>
                              {Object.entries(COUNT_DIFF_REASON_LABELS).map(([k, label]) => (
                                <option key={k} value={k}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted">—</span>
                          )
                        ) : (
                          COUNT_DIFF_REASON_LABELS[l.reason] || <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="kb-sticky-foot">
              <span className="text-sm muted">Tồn hệ thống là số hiện tại; kho vẫn xuất mỗi ngày nên chốt ngay sau khi đếm.</span>
              <div className="kb-actions">
                <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>
                  Lưu số đếm
                </button>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => setConfirming(true)}>
                  Chốt kiểm kê
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Các phiếu kiểm kê</h2>
            {data.canWrite && !counts.some((c) => c.status === STOCK_COUNT_STATUS.DRAFT) && (
              <button type="button" className="btn btn--sm" disabled={busy} onClick={create}>
                <Plus size={15} /> Tạo phiếu
              </button>
            )}
          </div>
          <div className="card__body">
            <ul className="kb-list">
              {counts.map((c) => (
                <li key={c.id} className="kb-list__item">
                  <div className="kb-list__main">
                    <button type="button" className="link-btn fw-600" onClick={() => setSelectedId(c.id)}>
                      {c.code}
                    </button>
                    <small>{formatDateTime(c.finalizedAt || c.createdAt)}</small>
                  </div>
                  <StatusBadge
                    tone={c.status === STOCK_COUNT_STATUS.DRAFT ? 'orange' : 'green'}
                    label={STOCK_COUNT_STATUS_LABELS[c.status]}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockCounts)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kiểm kê kho khô</h1>
          <p className="page__desc">Đếm tồn theo tháng. Lệch phải chọn lý do; chốt thì tồn kho bằng số đếm.</p>
        </div>
      </div>
      <div className="kb-toolbar kb-toolbar--center">
        <label className="date-filter">
          Điểm trường
          <select
            className="select"
            value={campusId}
            onChange={(e) => {
              setCampusId(e.target.value);
              setSelectedId(null);
            }}
          >
            {md.campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {body}
      <ConfirmationModal
        open={confirming}
        title="Chốt kiểm kê?"
        message="Tồn kho của cơ sở được đặt bằng số đếm, phiếu khóa lại và không sửa được."
        confirmLabel="Chốt kiểm kê"
        onConfirm={() => save(true)}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
