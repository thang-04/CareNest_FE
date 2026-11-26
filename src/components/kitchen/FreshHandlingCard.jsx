import { useEffect, useRef, useState } from 'react';
import { Pencil, Printer, Save, X } from '@/components/ui/icons';
import {
  Button,
  ConfirmationModal,
  DataTable,
  LockNote,
  Modal,
  PrintPaperFit,
  PrintToolbar,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components';
import { FreshCheckResultBadge, FreshRoundStateBadge } from '@/components/kitchen/KitchenBadges';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { FreshHandlingSlip } from '@/components/kitchen/FreshHandlingSlip';
import { useToast } from '@/contexts/ToastContext';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { FRESH_ROUND_LABELS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { roundState, withEditReason } from '@/utils/kitchen/freshGoodsForm';
import { HANDLING_LABELS, differenceOf, handlingSlipRows, handlingToForm, validateHandlingForm } from '@/utils/kitchen/freshHandling';

const signed = (value) => `${value > 0 ? '+' : ''}${fmtQty(value)}`;

/**
 * Kiểm nhận lần 2 theo cân đối: lượng cần của bản lần 2 so với hàng đã nhận lần 1, chọn gọi thêm / trả lại / giữ dùng cho
 * dòng lệch, in phiếu chênh lệch gửi nhà cung cấp. Liên hệ nhà cung cấp làm ngoài hệ thống.
 */
export function FreshHandlingCard({ round, campusId, campusName, date, canManage, onSaved, onStale }) {
  const toast = useToast();
  const [form, setForm] = useState(() => handlingToForm(round));
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState('');
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);
  const canWrite = canManage && round.available && round.lines.length > 0;
  const editable = canWrite && (!round.recorded || editing);
  // Chỉ xem mà chưa ghi nhận thì không hiện gợi ý như quyết định đã chốt
  const decided = editable || round.recorded;
  const slip = decided ? handlingSlipRows(form, round.lines) : [];

  const reset = () => {
    setForm(handlingToForm(round));
    setErrors({});
    setEditing(false);
  };
  // Dữ liệu lần kiểm đổi từ BE thì bỏ ô đang nhập
  useEffect(reset, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (index, patch) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
    setErrors({});
  };
  const pickAction = (index, handlingAction) => {
    const difference = Math.abs(differenceOf(round.lines[index]));
    const needsQuantity = handlingAction === 'ORDER_MORE' || handlingAction === 'RETURN';
    setLine(index, { handlingAction, handlingQty: needsQuantity ? String(difference) : '' });
  };

  const askConfirm = () => {
    const found = validateHandlingForm(form, round.lines);
    setErrors(found);
    if (Object.keys(found).length) return toast.error('Kiểm tra các ô đánh dấu đỏ.', 'Chưa ghi nhận được');
    setReason('');
    setSaveError('');
    return setConfirming(true);
  };

  const save = async () => {
    if (round.recorded && !reason.trim()) return setSaveError('Nhập lý do sửa lại');
    const body = round.recorded ? { ...form, note: withEditReason(form.note, reason) } : form;
    if (body.note.length > NOTE_MAX) return setSaveError(`Lý do và ghi chú chung dài quá ${NOTE_MAX} ký tự`);
    setSaveError('');
    try {
      const saved = await freshGoodsApi.saveCheckRound({ campusId, date, round: round.round, form: body, lines: round.lines });
      toast.success('Đã ghi nhận kiểm nhận lần 2.');
      setConfirming(false);
      onSaved(saved);
    } catch (err) {
      setSaveError(err.message);
      if (err.status === 409) {
        setConfirming(false);
        toast.error(err, 'Chưa ghi nhận được kiểm nhận');
        onStale();
      }
    }
    return undefined;
  };

  const qty = (value, unit) => `${fmtQty(value)} ${unit}`;
  const rows = round.lines.map((line, index) => ({ ...line, index, id: line.food.id }));
  const columns = [
    { key: 'name', header: 'Thực phẩm', render: (r) => <b>{r.food.name}</b> },
    { key: 'supplier', header: 'Nhà cung cấp', render: (r) => r.supplier?.name || <span className="muted">—</span> },
    { key: 'need', header: 'Cần (cân đối 2)', className: 'num', render: (r) => qty(r.purchaseExpectedQty, r.food.purchaseUnit) },
    { key: 'first', header: 'Đã nhận lần 1', className: 'num', render: (r) => qty(r.purchaseRound1Qty ?? 0, r.food.purchaseUnit) },
    { key: 'difference', header: 'Chênh', className: 'num', render: (r) => signed(differenceOf(r)) },
    {
      key: 'action',
      header: 'Xử lý',
      render: (r) => {
        const row = form.lines[r.index];
        const error = errors[`lines.${r.index}.handlingAction`];
        if (!editable)
          return (decided && HANDLING_LABELS[row.handlingAction]) || <span className="muted">{differenceOf(r) === 0 ? 'Đủ' : '—'}</span>;
        return (
          <>
            <SelectField
              className={`select ${error ? 'input--error' : ''}`}
              value={row.handlingAction}
              aria-label={`Xử lý ${r.food.name}`}
              onChange={(e) => pickAction(r.index, e.target.value)}
            >
              <option value="">{differenceOf(r) === 0 ? 'Đủ' : 'Chọn cách xử lý'}</option>
              {Object.entries(HANDLING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            {error && <div className="field__error">{error}</div>}
          </>
        );
      },
    },
    {
      key: 'quantity',
      header: 'SL thực tế',
      className: 'num',
      render: (r) => {
        const row = form.lines[r.index];
        const error = errors[`lines.${r.index}.handlingQty`];
        if (!decided || (row.handlingAction !== 'ORDER_MORE' && row.handlingAction !== 'RETURN')) return <span className="muted">—</span>;
        if (!editable) return qty(row.handlingQty, r.food.purchaseUnit);
        return (
          <>
            <TextField
              type="number"
              min="0"
              step="any"
              className={`input kb-num ${error ? 'input--error' : ''}`}
              value={row.handlingQty}
              aria-label={`Số lượng xử lý ${r.food.name}`}
              onChange={(e) => setLine(r.index, { handlingQty: e.target.value })}
            />
            {error && <div className="field__error">{error}</div>}
          </>
        );
      },
    },
    ...(round.recorded && !editing
      ? [
          {
            key: 'received',
            header: 'Thực nhận',
            className: 'num',
            render: (r) => (r.purchaseReceivedQty == null ? '—' : qty(r.purchaseReceivedQty, r.food.purchaseUnit)),
          },
          { key: 'result', header: 'Kết quả', render: (r) => <FreshCheckResultBadge status={r.result} /> },
        ]
      : []),
    {
      key: 'note',
      header: 'Ghi chú',
      render: (r) =>
        editable ? (
          <TextField
            className="input"
            maxLength={NOTE_MAX}
            value={form.lines[r.index].note}
            aria-label={`Ghi chú ${r.food.name}`}
            onChange={(e) => setLine(r.index, { note: e.target.value })}
          />
        ) : (
          r.note || <span className="muted">—</span>
        ),
    },
  ];

  return (
    <section className="card" aria-label={FRESH_ROUND_LABELS[round.round]}>
      <div className="card__header row row--between">
        <h2 className="card__title">{FRESH_ROUND_LABELS[round.round]}</h2>
        <FreshRoundStateBadge status={roundState(round)} />
      </div>
      {!round.available && !round.recorded && (
        <div className="card__body">
          <LockNote kind="notYet">{round.unavailableReason || 'Lần kiểm này chưa mở.'}</LockNote>
        </div>
      )}
      {round.lines.length > 0 && (
        <>
          <DataTable columns={columns} rows={rows} empty={{ title: 'Không có hàng tươi' }} />
          <div className="kb-fresh__foot">
            {editable && (
              <TextAreaField
                label="Ghi chú chung"
                rows={2}
                maxLength={NOTE_MAX}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            )}
            {!editable && round.note && <p className="text-sm">Ghi chú chung: {round.note}</p>}
            <div className="row row--between mt-12">
              <Button icon={Printer} disabled={!slip.length} onClick={() => setPrinting(true)}>
                In phiếu chênh lệch
              </Button>
              <div className="row gap-2">
                {editing && (
                  <Button icon={X} onClick={reset}>
                    Hủy sửa
                  </Button>
                )}
                {editable && (
                  <Button variant="primary" icon={Save} onClick={askConfirm}>
                    {round.recorded ? 'Lưu kiểm nhận' : 'Ghi nhận kiểm nhận'}
                  </Button>
                )}
                {!editable && canWrite && round.recorded && (
                  <Button icon={Pencil} onClick={() => setEditing(true)}>
                    Sửa kiểm nhận
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      <ConfirmationModal
        open={confirming}
        title={round.recorded ? 'Lưu kiểm nhận đã sửa?' : 'Ghi nhận kiểm nhận?'}
        message={`${slip.length} thực phẩm cần gọi thêm hoặc trả lại. Hãy báo nhà cung cấp theo phiếu chênh lệch.`}
        confirmLabel={round.recorded ? 'Lưu bản sửa' : 'Ghi nhận'}
        error={saveError}
        onConfirm={save}
        onClose={() => setConfirming(false)}
      >
        {round.recorded && (
          <TextAreaField
            label="Lý do sửa lại"
            required
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSaveError('');
            }}
          />
        )}
      </ConfirmationModal>
      <Modal
        open={printing}
        onClose={() => setPrinting(false)}
        size="xl"
        className="print-modal"
        title="Phiếu chênh lệch hàng tươi"
        footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Phieu_chenh_lech_${date}`} onClose={() => setPrinting(false)} />}
      >
        <PrintPaperFit>
          <FreshHandlingSlip ref={sheetRef} rows={slip} date={date} campusName={campusName} />
        </PrintPaperFit>
      </Modal>
    </section>
  );
}
