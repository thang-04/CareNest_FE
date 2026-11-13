import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Save, X } from '@/components/ui/icons';
import { ConfirmationModal } from '@/components';
import { FreshCheckResultBadge, FreshRoundStateBadge } from '@/components/kitchen/KitchenBadges';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { FOOD_GROUP_LABELS } from '@/models/foodGroups';
import { FRESH_CHECK_RESULT, FRESH_CHECK_RESULT_LABELS, FRESH_ROUND_LABELS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { groupRoundLines, roundState, roundToForm, tallyResults, validateRoundForm, withEditReason } from '@/utils/kitchen/freshGoodsForm';
import { personName } from '@/utils/kitchen/stockLots';
import { formatDateTime } from '@/utils/format';

const REASON_MAX = 200;
const COLUMNS = 6;

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
 * Một lần kiểm nhận hàng tươi: bảng thực phẩm cần nhận (BE trả) chia theo nhóm, ô thực nhận theo đơn vị mua, kết quả, ghi chú.
 * Ghi nhận phải qua hộp xác nhận; lần đã ghi bị khóa, muốn kiểm lại bấm "Sửa kiểm nhận" và nêu lý do. Lần chưa mở được hiện lý
 * do BE trả; không có quyền ghi (`canManage` sai) thì chỉ xem. Lưu xong nạp lại cả hai lần từ kết quả BE.
 */
export function FreshRoundCard({ round, campusId, date, canManage, groupOfFood, onSaved, onStale }) {
  const toast = useToast();
  const [form, setForm] = useState(() => roundToForm(round));
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saveError, setSaveError] = useState('');
  const state = roundState(round);
  const canWrite = canManage && round.available && round.lines.length > 0;
  const editable = canWrite && (!round.recorded || editing);
  const groups = useMemo(() => groupRoundLines(round.lines, groupOfFood, FOOD_GROUP_LABELS), [round.lines, groupOfFood]);

  // Dữ liệu lần kiểm đổi từ BE (đổi ngày, điểm trường, lưu xong) thì nạp lại ô nhập và thoát chế độ sửa
  useEffect(() => {
    setForm(roundToForm(round));
    setErrors({});
    setEditing(false);
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

  const startEdit = () => {
    setForm(roundToForm(round));
    setErrors({});
    setEditing(true);
  };
  const cancelEdit = () => {
    setForm(roundToForm(round));
    setErrors({});
    setEditing(false);
  };

  // Kiểm ô trước, đạt mới mở hộp xác nhận
  const askConfirm = () => {
    const found = validateRoundForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Chọn kết quả cho từng thực phẩm và kiểm tra các ô đánh dấu đỏ.', 'Chưa ghi nhận được');
      return;
    }
    setReason('');
    setReasonError('');
    setSaveError('');
    setConfirming(true);
  };
  const closeConfirm = () => setConfirming(false);

  const save = async () => {
    let body = form;
    if (round.recorded) {
      if (!reason.trim()) {
        setReasonError('Nhập lý do sửa lại');
        return;
      }
      body = { ...form, note: withEditReason(form.note, reason) };
      if (body.note.length > NOTE_MAX) {
        setReasonError(`Lý do và ghi chú chung dài quá ${NOTE_MAX} ký tự, hãy rút gọn`);
        return;
      }
    }
    setSaveError('');
    try {
      const saved = await freshGoodsApi.saveCheckRound({ campusId, date, round: round.round, form: body, lines: round.lines });
      toast.success(`Đã ghi nhận kiểm nhận ${FRESH_ROUND_LABELS[round.round].split(' — ')[0].toLowerCase()}.`);
      setConfirming(false);
      onSaved(saved);
    } catch (err) {
      setSaveError(err.message);
      // Lần kiểm không còn mở (409): nạp lại để hiện lý do mới
      if (err.status === 409) {
        setConfirming(false);
        setErrors({ _form: err.message });
        toast.error(err, 'Chưa ghi nhận được kiểm nhận');
        onStale();
      }
    }
  };

  const who = personName(round.checkedBy);
  let shown = 0; // STT chạy liền theo thứ tự hiển thị qua các nhóm
  const tally = tallyResults(form);
  const meta = [
    round.forecastId && (
      <span key="forecast">
        So với <Link to={`/kitchen/forecast/${round.forecastId}?campusId=${campusId}`}>bản dự trù</Link> đã lập
      </span>
    ),
    round.recorded && <span key="recorded">{`Ghi nhận${who ? ` bởi ${who}` : ''} lúc ${formatDateTime(round.checkedAt)}`}</span>,
  ].filter(Boolean);

  return (
    <section className="card" aria-label={FRESH_ROUND_LABELS[round.round]}>
      <div className="card__header row row--between">
        <h2 className="card__title">{FRESH_ROUND_LABELS[round.round]}</h2>
        <FreshRoundStateBadge status={state} />
      </div>
      {meta.length > 0 && (
        <p className="kb-fresh__meta text-sm muted">
          {meta.map((part, i) => (
            <span key={part.key}>
              {i > 0 && ' · '}
              {part}
            </span>
          ))}
          .
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
            <table className="table table--grid kb-fresh">
              <thead>
                <tr>
                  <th>STT</th>
                  <th className="min-w-220 kb-fresh__left">Thực phẩm</th>
                  <th>Cần nhận</th>
                  <th>Thực nhận</th>
                  <th>Kết quả</th>
                  <th className="kb-fresh__left">Ghi chú</th>
                </tr>
              </thead>
              <tbody>{groups.map(renderGroup)}</tbody>
            </table>
          </div>
          {editable ? (
            <div className="kb-fresh__foot">
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
                <button type="button" className="btn" onClick={markAll}>
                  <Check size={16} /> Đánh dấu tất cả Đủ
                </button>
                <div className="row gap-2">
                  {editing && (
                    <button type="button" className="btn" onClick={cancelEdit}>
                      <X size={16} /> Hủy sửa
                    </button>
                  )}
                  <button type="button" className="btn btn--primary" onClick={askConfirm}>
                    <Save size={16} /> {round.recorded ? 'Lưu kiểm nhận' : 'Ghi nhận kiểm nhận'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="kb-fresh__foot">
              {round.note && <p className="text-sm">Ghi chú chung: {round.note}</p>}
              {canWrite && round.recorded && (
                <div className="kb-fresh__actions">
                  <button type="button" className="btn" onClick={startEdit}>
                    <Pencil size={16} /> Sửa kiểm nhận
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <ConfirmationModal
        open={confirming}
        title={round.recorded ? 'Lưu kiểm nhận đã sửa?' : 'Ghi nhận kiểm nhận?'}
        message={
          round.recorded
            ? 'Kết quả cũ của lần này sẽ bị thay bằng nội dung vừa sửa.'
            : 'Sau khi ghi nhận, bảng sẽ khóa. Muốn kiểm lại phải bấm "Sửa kiểm nhận" và nêu lý do.'
        }
        confirmLabel={round.recorded ? 'Lưu bản sửa' : 'Ghi nhận'}
        error={saveError}
        onConfirm={save}
        onClose={closeConfirm}
      >
        <p className="kb-fresh__tally">
          {FRESH_ROUND_LABELS[round.round]}: <b>{form.lines.length}</b> thực phẩm —{' '}
          {Object.values(FRESH_CHECK_RESULT)
            .filter((r) => tally[r])
            .map((r) => `${tally[r]} ${FRESH_CHECK_RESULT_LABELS[r]}`)
            .join(', ')}
          .
        </p>
        {round.recorded && (
          <div className="kb-fresh__reason">
            <label className="field__label" htmlFor={`fresh-reason-${round.round}`}>
              Lý do sửa lại (bắt buộc)
            </label>
            <textarea
              id={`fresh-reason-${round.round}`}
              className={`textarea ${reasonError ? 'input--error' : ''}`}
              rows={2}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError('');
              }}
            />
            {reasonError && <div className="field__error">{reasonError}</div>}
          </div>
        )}
      </ConfirmationModal>
    </section>
  );

  // Dòng nhóm + các thực phẩm của nhóm; STT chạy liền qua các nhóm. Là hàm render (không phải component) để ô nhập không bị dựng lại mỗi lần gõ
  function renderGroup(group) {
    return (
      <Fragment key={group.key}>
        <tr className="kb-fresh__group">
          <th colSpan={COLUMNS} scope="colgroup">
            {group.label} <span className="muted">· {group.rows.length} thực phẩm</span>
          </th>
        </tr>
        {group.rows.map(({ line, index: i }) => {
          const row = form.lines[i];
          const unit = line.food.purchaseUnit;
          const err = (field) => errors[`lines.${i}.${field}`];
          return (
            <tr key={line.food.id}>
              <td>{++shown}</td>
              <td className="kb-fresh__left">{line.food.name}</td>
              <td className="nowrap">
                {fmtQty(line.purchaseExpectedQty)} {unit}
              </td>
              <td>
                {editable ? (
                  <>
                    <span className="kb-fresh__qty">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={`input kb-num ${err('receivedQty') ? 'input--error' : ''}`}
                        value={row.receivedQty}
                        onChange={(e) => setLine(i, { receivedQty: e.target.value })}
                        aria-label={`Thực nhận ${line.food.name}`}
                      />
                      <span className="muted text-xs">{unit}</span>
                    </span>
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
                    <ResultSeg value={row.result} onChange={(result) => setLine(i, { result })} label={`Kết quả ${line.food.name}`} />
                    {err('result') && <div className="field__error">{err('result')}</div>}
                  </>
                ) : line.result ? (
                  <FreshCheckResultBadge status={line.result} />
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="kb-fresh__left">
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
      </Fragment>
    );
  }
}
