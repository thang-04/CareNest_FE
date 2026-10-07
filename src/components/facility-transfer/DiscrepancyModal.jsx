import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { ConditionBadge } from '@/components/asset/AssetVisuals';
import { expectedReceiveQuantity } from '@/models/facility-transfer/FacilityTransferItem';

/**
 * Receiver reports missing / wrong / damaged assets.
 * `rows` are the receiver's inputs from the receive table.
 */
export function DiscrepancyModal({ open, items, rows, onSubmit, onClose }) {
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const issues = items
    .map((item) => {
      const row = rows[item.id] || {};
      const expected = expectedReceiveQuantity(item);
      const received = Number(row.receivedQuantity);
      return {
        item,
        row,
        expected,
        received,
        diff: received - expected,
        damaged: Number(row.damagedQuantity) || 0,
        badCondition: ['NEED_REPAIR', 'BROKEN'].includes(row.receivedCondition),
      };
    })
    .filter((x) => x.diff !== 0 || x.damaged > 0 || x.badCondition);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDescription(
      issues
        .map(
          (x) =>
            `${x.item.assetName}: cần nhận ${x.expected}, thực nhận ${x.received}${x.damaged ? `, trong đó hỏng ${x.damaged}` : x.badCondition ? ' (hư hỏng)' : ''}`,
        )
        .join('. '),
    );
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const error = !description.trim() ? 'Vui lòng mô tả chênh lệch' : '';

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      await onSubmit(description.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      size="lg"
      title="Báo chênh lệch khi nhận tài sản"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button className="btn btn--danger" onClick={submit} disabled={busy || issues.length === 0}>
            {busy ? <Spinner small /> : <Scale size={16} />} Gửi báo chênh lệch
          </button>
        </>
      }
    >
      {issues.length === 0 ? (
        <div className="alert alert--info">
          Chưa có tài sản nào thiếu, thừa hoặc hỏng. Hãy nhập <b>số lượng thực nhận</b> và <b>trong đó hỏng</b> trong bảng trước khi báo
          chênh lệch.
        </div>
      ) : (
        <>
          <div className="alert alert--purple mb-16">
            Báo chênh lệch được ký bằng chữ ký bạn đã chọn. Phiếu chuyển sang <b>Chờ xử lý chênh lệch</b>: Phó hiệu trưởng chấp nhận thì
            phiếu hoàn thành ngay; yêu cầu giao thêm / trả lại thì bạn kiểm tra và xác nhận lại sau.
          </div>
          <div className="table-wrap mb-16">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Tài sản</th>
                  <th className="center">Theo phiếu</th>
                  <th className="center">Bàn giao</th>
                  <th className="center">Thực nhận</th>
                  <th className="center">Chênh lệch</th>
                  <th className="center">Hỏng</th>
                  <th className="center">Tình trạng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(({ item, row, diff, damaged }) => (
                  <tr key={item.id}>
                    <td>
                      {item.assetCode} - {item.assetName}
                    </td>
                    <td className="center">{item.quantity}</td>
                    <td className="center">{item.handoverQuantity ?? '—'}</td>
                    <td className="center fw-600">{row.receivedQuantity}</td>
                    <td className={`center fw-600 ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-primary' : ''}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td className="center">{damaged || '—'}</td>
                    <td className="center">
                      <ConditionBadge value={row.receivedCondition} />
                    </td>
                    <td className="text-2">{row.receivedNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="disc-desc">
              Mô tả chênh lệch<span className="req">*</span>
            </label>
            <textarea
              id="disc-desc"
              className={`textarea ${touched && error ? 'textarea--error' : ''}`}
              rows={4}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {touched && error && <span className="field__error">{error}</span>}
          </div>
        </>
      )}
    </Modal>
  );
}
