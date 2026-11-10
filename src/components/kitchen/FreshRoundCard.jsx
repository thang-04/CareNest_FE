import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Save } from '@/components/ui/icons';
import { Spinner } from '@/components';
import { FreshCheckResultBadge, FreshRoundStateBadge } from '@/components/kitchen/KitchenBadges';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { FRESH_CHECK_RESULT, FRESH_CHECK_RESULT_LABELS, FRESH_ROUND_LABELS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { roundState, roundToForm, validateRoundForm } from '@/utils/kitchen/freshGoodsForm';
import { personName } from '@/utils/kitchen/stockLots';
import { formatDateTime } from '@/utils/format';

/** Nhóm nút Đủ / Thiếu / Thừa của một dòng. */
function ResultSeg({ value, onChange, label }) {
  return (
    <span className="kb-res kb-res--fresh" role="group" aria-label={label}>
      {Object.values(FRESH_CHECK_RESULT).map((r) => (
        <button key={r} type="button" data-r={r} aria-pressed={value === r} onClick={() => onChange(r)}>
          {FRESH_CHECK_RESULT_LABELS[r]}
        </button>
      ))}
    </span>
  );
}

/**
 * Một lần kiểm nhận hàng tươi: bảng thực phẩm cần nhận (BE trả), ô thực nhận theo đơn vị mua, kết quả, ghi chú. Lần chưa mở
 * được hiện lý do BE trả; không có quyền ghi (`canManage` sai) thì chỉ xem. Lưu xong nạp lại cả hai lần từ kết quả BE.
 */
export function FreshRoundCard({ round, campusId, date, canManage, onSaved, onStale }) {
  const toast = useToast();
  const [form, setForm] = useState(() => roundToForm(round));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const state = roundState(round);
  const editable = canManage && round.available && round.lines.length > 0;

  // Dữ liệu lần kiểm đổi từ BE (đổi ngày, điểm trường, lưu xong) thì nạp lại ô nhập
  useEffect(() => {
    setForm(roundToForm(round));
    setErrors({});
  }, [round]);

  const setLine = (index, patch) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
    setErrors((e) => {
      const next = { ...e, _form: undefined };
      Object.keys(patch).forEach((field) => delete next[`lines.${index}.${field}`]);
      return next;
    });
  };
  const markAll = () => setForm((f) => ({ ...f, lines: f.lines.map((l) => ({ ...l, result: FRESH_CHECK_RESULT.ENOUGH })) }));

  const save = async () => {
    const found = validateRoundForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Chọn kết quả cho từng thực phẩm và kiểm tra các ô đánh dấu đỏ.', 'Chưa ghi nhận được');
      return;
    }
    setBusy(true);
    try {
      const saved = await freshGoodsApi.saveCheckRound({ campusId, date, round: round.round, form, lines: round.lines });
      toast.success(`Đã ghi nhận kiểm nhận ${FRESH_ROUND_LABELS[round.round].split(' — ')[0].toLowerCase()}.`);
      onSaved(saved);
    } catch (err) {
      setErrors({ _form: err.message });
      toast.error(err, 'Chưa ghi nhận được kiểm nhận');
      // Lần kiểm không còn mở (409): nạp lại để hiện lý do mới
      if (err.status === 409) onStale();
    } finally {
      setBusy(false);
    }
  };

  const who = personName(round.checkedBy);
  return (
    <section className="card" aria-label={FRESH_ROUND_LABELS[round.round]}>
      <div className="card__header row row--between">
        <h2 className="card__title">{FRESH_ROUND_LABELS[round.round]}</h2>
        <FreshRoundStateBadge status={state} />
      </div>
      {round.forecastId && (
        <p className="card__body text-sm muted">
          So với <Link to={`/kitchen/forecast/${round.forecastId}?campusId=${campusId}`}>bản dự trù</Link> đã lập.
        </p>
      )}
      {round.recorded && (
        <p className="card__body text-sm muted">
          Ghi nhận{who ? ` bởi ${who}` : ''} lúc {formatDateTime(round.checkedAt)}.
        </p>
      )}
      {!round.available && !round.recorded && (
        <div className="card__body">
          <div className="alert alert--info" role="status">
            {round.unavailableReason || 'Lần kiểm này chưa mở.'}
          </div>
        </div>
      )}
      {round.available && !round.lines.length && <p className="card__body muted">Ngày này không có hàng tươi cần nhận.</p>}
      {round.lines.length > 0 && (
        <>
          {errors._form && (
            <div className="card__body">
              <div className="alert alert--danger" role="alert">
                {errors._form}
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th className="num">STT</th>
                  <th className="min-w-220">Thực phẩm</th>
                  <th className="num">Cần nhận</th>
                  <th>Thực nhận</th>
                  <th>Kết quả</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {round.lines.map((line, i) => {
                  const row = form.lines[i];
                  const unit = line.food.purchaseUnit;
                  const err = (field) => errors[`lines.${i}.${field}`];
                  return (
                    <tr key={line.food.id}>
                      <td className="num">{i + 1}</td>
                      <td>{line.food.name}</td>
                      <td className="num nowrap">
                        {fmtQty(line.purchaseExpectedQty)} {unit}
                      </td>
                      <td>
                        {editable ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className={`input kb-num ${err('receivedQty') ? 'input--error' : ''}`}
                              value={row.receivedQty}
                              onChange={(e) => setLine(i, { receivedQty: e.target.value })}
                              aria-label={`Thực nhận ${line.food.name}`}
                            />
                            <span className="muted text-xs"> {unit}</span>
                            {err('receivedQty') && <div className="field__error">{err('receivedQty')}</div>}
                          </>
                        ) : line.purchaseReceivedQty == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className="nowrap">
                            {fmtQty(line.purchaseReceivedQty)} {unit}
                          </span>
                        )}
                      </td>
                      <td>
                        {editable ? (
                          <>
                            <ResultSeg
                              value={row.result}
                              onChange={(result) => setLine(i, { result })}
                              label={`Kết quả ${line.food.name}`}
                            />
                            {err('result') && <div className="field__error">{err('result')}</div>}
                          </>
                        ) : line.result ? (
                          <FreshCheckResultBadge status={line.result} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {editable ? (
                          <input
                            className="input"
                            value={row.note}
                            maxLength={NOTE_MAX}
                            onChange={(e) => setLine(i, { note: e.target.value })}
                            aria-label={`Ghi chú ${line.food.name}`}
                          />
                        ) : (
                          line.note || <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable ? (
            <div className="card__body">
              <label className="field__label" htmlFor={`fresh-note-${round.round}`}>
                Ghi chú chung
              </label>
              <textarea
                id={`fresh-note-${round.round}`}
                className="textarea"
                rows={2}
                maxLength={NOTE_MAX}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
              <div className="row row--between mt-12">
                <button type="button" className="btn" disabled={busy} onClick={markAll}>
                  <Check size={16} /> Đánh dấu tất cả Đủ
                </button>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
                  {busy ? <Spinner small /> : <Save size={16} />} {round.recorded ? 'Cập nhật kiểm nhận' : 'Ghi nhận kiểm nhận'}
                </button>
              </div>
            </div>
          ) : (
            round.note && <p className="card__body text-sm">Ghi chú chung: {round.note}</p>
          )}
        </>
      )}
    </section>
  );
}
