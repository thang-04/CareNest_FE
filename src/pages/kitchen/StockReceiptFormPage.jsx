import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Info, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFoodCatalog } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, ErrorState, FormField, LoadingState, SearchSelect, Spinner } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { createStockReceipt } from '@/services/kitchen/kitchenService';
import { itemError, validateStockReceipt } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { todayInput } from '@/utils/format';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const emptyLine = () => ({
  key: Math.random().toString(36).slice(2),
  foodId: '',
  receivedQty: '',
  rejectedQty: '',
  expiryDate: '',
  note: '',
});

/* "?items=foodId:qty,foodId:qty" – shortage lines handed over by the stock issue screen (UC 6.24 alternative flow). */
const linesFromQuery = (value) =>
  (value || '')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter(([foodId]) => foodId)
    .map(([foodId, qty]) => ({ ...emptyLine(), foodId, receivedQty: qty || '' }));

/** Screen #90 – record a delivery: quantity, unit and quality check of each food (UC 6.23). */
export default function StockReceiptFormPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromIssueDate = params.get('issueDate');
  const backTo = fromIssueDate ? `/kitchen/stock-issues?date=${fromIssueDate}` : '/kitchen/stock-receipts';
  const { foods, loading, error, reload } = useFoodCatalog();
  const [form, setForm] = useState(() => {
    const prefilled = linesFromQuery(params.get('items'));
    return { date: todayInput(), note: '', items: prefilled.length ? prefilled : [emptyLine()] };
  });
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const foodById = useMemo(() => Object.fromEntries(foods.map((f) => [f.id, f])), [foods]);
  const options = useMemo(() => foods.map((f) => ({ value: f.id, label: `${f.name} (${f.unit})` })), [foods]);

  const setField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const setLine = (index, field, value) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, [field]: value } : it)) }));
    setErrors((e) => ({ ...e, [`items.${index}.${field}`]: undefined, items: undefined }));
  };
  const removeLine = (index) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
    setErrors({});
  };

  const openConfirm = () => {
    const found = validateStockReceipt(form, todayInput());
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa lưu được phiếu');
      return;
    }
    setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const receipt = await createStockReceipt(form, user);
      toast.success(`Đã lưu phiếu ${receipt.code} và cập nhật tồn kho.`);
      navigate(fromIssueDate ? backTo : '/kitchen/stock-receipts');
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không lưu được phiếu');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const accepted = (it) => Math.max(0, Number(it.receivedQty || 0) - Number(it.rejectedQty || 0));

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts, 'Tạo phiếu nhập kho')} />
      <h1 className="page__title">Tạo phiếu nhập kho</h1>
      {fromIssueDate && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Các dòng bên dưới là phần tồn kho còn thiếu cho phiếu xuất kho. Lưu phiếu nhập rồi quay lại duyệt phiếu xuất.</div>
        </div>
      )}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="card wizard-card">
            <div className="card__header">
              <div className="card__title">Thông tin phiếu</div>
            </div>
            <div className="card__body grid-2">
              <FormField label="Ngày nhập kho" required error={errors.date}>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  max={todayInput()}
                  onChange={(e) => setField('date', e.target.value)}
                />
              </FormField>
              <FormField label="Ghi chú" error={errors.note} hint={`Tối đa ${NOTE_MAX} ký tự`}>
                <input className="input" value={form.note} maxLength={NOTE_MAX} onChange={(e) => setField('note', e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="card wizard-card mt-16">
            <div className="card__header row row--between">
              <div className="card__title">Thực phẩm nhận và kiểm tra chất lượng</div>
              <button className="btn btn--sm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }))}>
                <Plus size={15} /> Thêm thực phẩm
              </button>
            </div>
            {errors.items && (
              <div className="field__error" style={{ padding: '0 16px' }}>
                {errors.items}
              </div>
            )}
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>
                      Thực phẩm <span className="req">*</span>
                    </th>
                    <th>
                      SL nhận <span className="req">*</span>
                    </th>
                    <th>SL không đạt</th>
                    <th className="right">Nhập kho</th>
                    <th>Hạn sử dụng</th>
                    <th style={{ minWidth: 200 }}>Ghi chú kiểm tra</th>
                    <th className="center">
                      <span className="sr-only">Xóa dòng</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => {
                    const unit = foodById[it.foodId]?.unit || '';
                    const err = (f) => itemError(errors, i, f);
                    return (
                      <tr key={it.key}>
                        <td>
                          <SearchSelect
                            options={options}
                            value={it.foodId}
                            onChange={(v) => setLine(i, 'foodId', v)}
                            placeholder="Chọn thực phẩm"
                            error={!!err('foodId')}
                            ariaLabel={`Thực phẩm dòng ${i + 1}`}
                          />
                          {err('foodId') && <div className="field__error">{err('foodId')}</div>}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input kb-num ${err('receivedQty') ? 'input--error' : ''}`}
                            value={it.receivedQty}
                            onChange={(e) => setLine(i, 'receivedQty', e.target.value)}
                            aria-label={`Số lượng nhận dòng ${i + 1}`}
                          />
                          <span className="muted text-xs"> {unit}</span>
                          {err('receivedQty') && <div className="field__error">{err('receivedQty')}</div>}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input kb-num ${err('rejectedQty') ? 'input--error' : ''}`}
                            value={it.rejectedQty}
                            onChange={(e) => setLine(i, 'rejectedQty', e.target.value)}
                            aria-label={`Số lượng không đạt dòng ${i + 1}`}
                          />
                          {err('rejectedQty') && <div className="field__error">{err('rejectedQty')}</div>}
                        </td>
                        <td className="right nowrap fw-600">
                          {fmtQty(accepted(it))} {unit}
                        </td>
                        <td>
                          <input
                            type="date"
                            className={`input ${err('expiryDate') ? 'input--error' : ''}`}
                            value={it.expiryDate}
                            onChange={(e) => setLine(i, 'expiryDate', e.target.value)}
                            aria-label={`Hạn sử dụng dòng ${i + 1}`}
                          />
                        </td>
                        <td>
                          <input
                            className={`input ${err('note') ? 'input--error' : ''}`}
                            value={it.note}
                            maxLength={NOTE_MAX}
                            placeholder={Number(it.rejectedQty) > 0 ? 'Lý do không đạt' : ''}
                            onChange={(e) => setLine(i, 'note', e.target.value)}
                            aria-label={`Ghi chú kiểm tra dòng ${i + 1}`}
                          />
                          {err('note') && <div className="field__error">{err('note')}</div>}
                        </td>
                        <td className="center">
                          <button
                            className="icon-btn"
                            onClick={() => removeLine(i)}
                            disabled={form.items.length === 1}
                            title="Xóa dòng"
                            aria-label={`Xóa dòng ${i + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-actions">
            <Link className="btn" to={backTo}>
              <ArrowLeft size={16} /> Quay lại
            </Link>
            <button className="btn btn--primary" onClick={openConfirm} disabled={saving}>
              {saving ? <Spinner small /> : <PackagePlus size={16} />} Lưu phiếu nhập kho
            </button>
          </div>
        </>
      )}
      <ConfirmationModal
        open={confirming}
        title="Lưu phiếu nhập kho?"
        message="Số lượng đạt chất lượng sẽ được cộng vào tồn kho của điểm trường. Phiếu đã lưu không sửa được."
        confirmLabel="Lưu phiếu nhập kho"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
