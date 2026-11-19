import { useEffect, useRef, useState } from 'react';
import { Info, Trash2, Undo2 } from '@/components/ui/icons';
import { Button, DataTable, Modal, SearchSelect, StatusBadge, TextAreaField, TextField } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { formatDate } from '@/utils/format';
import { FRESH_RESULT, FRESH_RESULT_LABELS } from '@/models/kitchen/kitchenConstants';

// BE nhận một chuỗi ghi chú ≤ 500 ký tự; bảng chỉ giúp nhập theo từng thực phẩm rồi ghép lại thành từng dòng
const NOTE_MAX = 500;
const RESULT_TONE = { [FRESH_RESULT.OK]: 'green', [FRESH_RESULT.SHORT]: 'orange', [FRESH_RESULT.RETURNED]: 'red' };
const flaggedIds = (lines) => lines.filter((l) => l.result && l.result !== FRESH_RESULT.OK).map((l) => String(l.foodId));
const composeNote = (rows, byId, general) =>
  [...rows.filter((r) => r.text.trim()).map((r) => `${byId[r.foodId]?.name || 'Thực phẩm'}: ${r.text.trim()}`), general.trim()]
    .filter(Boolean)
    .join('\n');

/**
 * PHT trả phiếu kiểm nhận hàng tươi về bếp. Bảng sẵn các dòng bếp đánh dấu Thiếu / Trả lại, mỗi dòng một ô "cần kiểm lại gì";
 * thêm được thực phẩm khác của phiếu và ghi chú chung. Gửi BE một chuỗi ghép "Tên: nội dung" theo dòng. `onSubmit(note)` trả true khi BE nhận.
 */
export function FreshReturnModal({ open, campusName, date, lines = [], busy, onSubmit, onClose }) {
  const byId = Object.fromEntries(lines.map((l) => [String(l.foodId), l]));
  const [rows, setRows] = useState([]);
  const [general, setGeneral] = useState('');
  const [error, setError] = useState('');
  const firstInput = useRef(null);

  // Mỗi lần mở: bảng bắt đầu từ các dòng bếp đã đánh dấu, ô trống
  useEffect(() => {
    if (!open) return;
    setRows(flaggedIds(lines).map((foodId) => ({ foodId, text: '' })));
    setGeneral('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khởi tạo khi mở hộp, không reset khi trang tải lại phiếu
  }, [open]);

  const note = composeNote(rows, byId, general);
  const tooLong = note.length > NOTE_MAX;
  const picked = new Set(rows.map((r) => r.foodId));
  const addable = lines
    .filter((l) => !picked.has(String(l.foodId)))
    .map((l) => ({ value: String(l.foodId), label: `${l.name} · ${FRESH_RESULT_LABELS[l.result] || '—'}` }));

  const setText = (foodId, text) => {
    setRows((rs) => rs.map((r) => (r.foodId === foodId ? { ...r, text } : r)));
    setError('');
  };
  const add = (foodId) => foodId && setRows((rs) => [...rs, { foodId, text: '' }]);
  const remove = (foodId) => setRows((rs) => rs.filter((r) => r.foodId !== foodId));

  const submit = async () => {
    if (!note) {
      setError('Ghi ít nhất một dòng cần kiểm lại, hoặc ghi chú chung.');
      firstInput.current?.focus();
      return;
    }
    if (tooLong) {
      setError(`Ghi chú dài ${note.length}/${NOTE_MAX} ký tự, rút gọn bớt.`);
      return;
    }
    await onSubmit(note);
  };

  const columns = [
    {
      key: 'name',
      header: 'Thực phẩm',
      render: (r) => <span className="fw-600">{byId[r.foodId]?.name}</span>,
    },
    {
      key: 'kitchen',
      header: 'Bếp ghi',
      render: (r) => {
        const l = byId[r.foodId] || {};
        return (
          <div className="kb-return__kitchen">
            <StatusBadge tone={RESULT_TONE[l.result] || 'gray'} label={FRESH_RESULT_LABELS[l.result] || '—'} />
            <span className="text-xs muted">
              Đặt {fmtQty(l.ordered)} · nhận {fmtQty(l.received)} {l.unit}
              {l.reason ? ` · ${l.reason}` : ''}
            </span>
          </div>
        );
      },
    },
    {
      key: 'text',
      header: 'Cần bếp kiểm lại',
      render: (r) => (
        <TextField
          ref={r.foodId === rows[0]?.foodId ? firstInput : undefined}
          value={r.text}
          maxLength={NOTE_MAX}
          placeholder="Cân lại, đối chiếu phiếu giao…"
          aria-label={`Cần bếp kiểm lại ${byId[r.foodId]?.name || ''}`}
          onChange={(e) => setText(r.foodId, e.target.value)}
        />
      ),
    },
    {
      key: 'remove',
      header: <span className="sr-only">Bỏ dòng</span>,
      className: 'cell--actions',
      render: (r) => (
        <Button variant="icon" aria-label={`Bỏ ${byId[r.foodId]?.name || 'dòng'}`} onClick={() => remove(r.foodId)}>
          <Trash2 size={16} />
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      size="lg"
      title="Trả bếp kiểm lại"
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <span className={`kb-return__count ${tooLong ? 'kb-return__count--over' : ''}`} aria-live="polite">
            {note.length}/{NOTE_MAX} ký tự
          </span>
          <Button disabled={busy} onClick={onClose}>
            Quay lại
          </Button>
          <Button variant="primary" icon={Undo2} loading={busy} onClick={submit}>
            Trả bếp kiểm lại
          </Button>
        </>
      }
    >
      <div className="kb-return">
        <p className="kb-return__ctx">
          Phiếu kiểm nhận hàng tươi · <b>{campusName || 'Điểm trường'}</b> · {formatDate(date)}
        </p>
        <div className="alert alert--info kb-return__note" role="note">
          <Info size={18} />
          <span>Phiếu về trạng thái nháp. Bếp thấy từng dòng dưới đây ở đầu phiếu, sửa rồi gửi lại PHT xác nhận.</span>
        </div>
        {error && (
          <div className="alert alert--danger kb-return__note" role="alert">
            {error}
          </div>
        )}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="foodId"
          className="kb-return__table"
          empty={{ title: 'Chưa chọn thực phẩm nào', description: 'Thêm thực phẩm cần bếp kiểm lại ở ô bên dưới.' }}
        />
        {addable.length > 0 && (
          <div className="kb-return__add">
            <SearchSelect
              options={addable}
              value=""
              onChange={add}
              placeholder="+ Thêm thực phẩm khác của phiếu"
              ariaLabel="Thêm thực phẩm cần kiểm lại"
              searchable
            />
          </div>
        )}
        <TextAreaField
          label="Ghi chú chung"
          rows={2}
          maxLength={NOTE_MAX}
          value={general}
          hint="Không bắt buộc. Việc không gắn với thực phẩm nào, ví dụ: thiếu chữ ký người giao trên phiếu."
          onChange={(e) => {
            setGeneral(e.target.value);
            setError('');
          }}
        />
      </div>
    </Modal>
  );
}
