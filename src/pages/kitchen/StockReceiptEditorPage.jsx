import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PackagePlus, Plus, Save, Trash2, XCircle } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import {
  Breadcrumb,
  ConfirmationModal,
  DateInput,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  SearchSelect,
  Spinner,
} from '@/components';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { useActiveSuppliers, useCanManageStock, useDryFoods, useReceipt, useStockCampus } from '@/hooks/kitchen/useDryStock';
import { dryStockApi } from '@/services/dryStockApi';
import { RECEIPT_STATUS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { emptyLine, emptyReceiptForm, mapReceiptErrors, receiptToForm, validateReceiptForm } from '@/utils/kitchen/stockReceiptForm';
import { personName } from '@/utils/kitchen/stockLots';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, formatMoney, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';

const estimate = (line) => {
  const qty = Number(line.purchaseQty);
  const price = Number(line.unitPrice);
  return line.purchaseQty !== '' && line.unitPrice !== '' && qty > 0 && price >= 0 ? qty * price : null;
};

/**
 * Phiếu nhập kho khô (`/kitchen/stock-receipts/new`, `/:id`): lập và sửa phiếu nháp, xác nhận nhập kho, hủy phiếu đã xác nhận (có lý do),
 * xóa phiếu nháp. Số lượng nhập theo đơn vị mua, gửi BE theo đơn vị gốc. Nút theo cờ `canManage` BE trả; BE vẫn là nơi kiểm tra.
 */
export default function StockReceiptEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const canCreate = useCanManageStock();
  const campus = useStockCampus();
  const receiptQ = useReceipt(id);
  const receipt = receiptQ.data;
  const { foods } = useDryFoods();
  const { suppliers } = useActiveSuppliers();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'confirm' | 'delete' | 'cancel'
  const [dialogError, setDialogError] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (receipt) setForm(receiptToForm(receipt));
  }, [receipt]);
  useEffect(() => {
    if (isNew && !form && campus.campusId)
      setForm(emptyReceiptForm({ campusId: campus.campusId, today: todayInput(), foodId: params.get('foodId') || '' }));
  }, [isNew, form, campus.campusId, params]);

  const editable = isNew ? canCreate : !!receipt && receipt.status === RECEIPT_STATUS.DRAFT && !!receipt.canManage;
  // Thực phẩm tra đơn vị mua: danh mục khô + thực phẩm đã ghi trên phiếu (phòng khi đã ngừng sử dụng)
  const foodById = useMemo(() => {
    const map = {};
    foods.forEach((f) => (map[String(f.id)] = f));
    (receipt?.lines || []).forEach((l) => l.food && (map[String(l.food.id)] ||= l.food));
    return map;
  }, [foods, receipt]);
  const foodOptions = useMemo(() => {
    const picked = new Set((form?.lines || []).map((l) => String(l.foodId)));
    return Object.values(foodById)
      .filter((f) => f.status === 'ACTIVE' || picked.has(String(f.id)))
      .map((f) => ({ value: String(f.id), label: `${f.name} (${f.purchaseUnit})` }));
  }, [foodById, form]);
  const supplierOptions = useMemo(() => {
    const list = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
    if (receipt?.supplierId && !list.some((o) => o.value === String(receipt.supplierId)))
      list.push({ value: String(receipt.supplierId), label: `${receipt.supplierName} (ngừng dùng)` });
    return list;
  }, [suppliers, receipt]);

  const campusId = receipt ? String(receipt.campusId) : form?.campusId || campus.campusId;
  const listPath = campusId ? `/kitchen/stock-receipts?campusId=${campusId}` : '/kitchen/stock-receipts';
  const title = isNew ? 'Lập phiếu nhập kho' : receipt ? `Phiếu nhập ngày ${formatDate(receipt.receivedDate)}` : 'Phiếu nhập kho';

  const setField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, _form: undefined }));
  };
  const setLine = (index, field, value) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));
    setErrors((e) => ({ ...e, [`lines.${index}.${field}`]: undefined, lines: undefined, _form: undefined }));
  };
  const removeLine = (index) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }));
    setErrors({});
  };

  const showError = (err, heading) => {
    const mapped = mapReceiptErrors(err.details);
    if (Object.keys(mapped).length) setErrors(mapped);
    toast.error(err, heading);
  };
  // Phiếu mới lưu xong ⇒ chuyển sang địa chỉ của phiếu; phiếu đang mở ⇒ nạp lại từ kết quả BE
  const afterSave = (saved) => {
    setErrors({});
    if (isNew) navigate(`/kitchen/stock-receipts/${saved.id}`, { replace: true });
    else receiptQ.setData(saved);
  };
  const persist = async () => {
    const found = validateReceiptForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa lưu được phiếu');
      return null;
    }
    return dryStockApi.saveReceipt(id || null, form, foodById);
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const saved = await persist();
      if (saved) {
        toast.success('Đã lưu nháp phiếu nhập. Phiếu chưa vào kho.');
        afterSave(saved);
      }
    } catch (err) {
      showError(err, 'Chưa lưu được phiếu');
    } finally {
      setBusy(false);
    }
  };

  const confirmReceipt = async () => {
    let saved = null;
    try {
      saved = await persist();
      if (!saved) return setDialog(null);
      const confirmed = await dryStockApi.confirmReceipt(saved.id);
      toast.success('Đã xác nhận nhập kho.');
      setDialog(null);
      afterSave(confirmed);
    } catch (err) {
      setDialog(null);
      // Đã lưu nháp được nhưng chưa xác nhận: giữ phiếu nháp để người dùng sửa theo lỗi BE
      if (saved) afterSave(saved);
      showError(err, saved ? 'Đã lưu nháp nhưng chưa xác nhận được' : 'Chưa lưu được phiếu');
    }
  };

  const deleteDraft = async () => {
    try {
      await dryStockApi.deleteReceipt(id);
      toast.success('Đã xóa phiếu nháp.');
      setDialog(null);
      navigate(listPath, { replace: true });
    } catch (err) {
      setDialogError(err.message);
    }
  };

  const cancelReceipt = async () => {
    if (!reason.trim()) return setDialogError('Nhập lý do hủy phiếu.');
    try {
      const cancelled = await dryStockApi.cancelReceipt(id, reason);
      toast.success('Đã hủy phiếu nhập.');
      closeDialog();
      receiptQ.setData(cancelled);
    } catch (err) {
      // Vd. lô đã bị trừ theo suất ⇒ BE từ chối, giải thích trong hộp thoại
      setDialogError(err.message);
    }
  };

  const openDialog = (kind) => {
    setDialogError('');
    setReason('');
    setDialog(kind);
  };
  const closeDialog = () => {
    setDialog(null);
    setReason('');
    setDialogError('');
  };

  let content;
  if (isNew && !canCreate) content = <ErrorState error={{ status: 403, message: 'Tài khoản chưa được cấp quyền lập phiếu nhập kho.' }} />;
  else if (!isNew && receiptQ.error) content = <ErrorState error={receiptQ.error} onRetry={receiptQ.reload} />;
  else if (isNew && !campus.loading && !campus.campusId)
    content = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để lập phiếu." />;
  else if (!form) content = <LoadingState />;
  else {
    const total = form.lines.reduce((sum, l) => sum + (estimate(l) || 0), 0);
    const err = (i, field) => errors[`lines.${i}.${field}`];
    content = (
      <>
        {errors._form && (
          <div className="alert alert--danger mb-16" role="alert">
            {errors._form}
          </div>
        )}
        {receipt?.status === RECEIPT_STATUS.CONFIRMED && (
          <p className="text-sm muted mb-16">
            Đã xác nhận nhập kho{personName(receipt.confirmedBy) ? ` bởi ${personName(receipt.confirmedBy)}` : ''}
            {receipt.confirmedAt ? ` lúc ${formatDateTime(receipt.confirmedAt)}` : ''}. Phiếu không sửa được.
          </p>
        )}
        {receipt?.status === RECEIPT_STATUS.CANCELLED && (
          <div className="alert alert--warning mb-16">
            <div>
              Phiếu đã hủy{personName(receipt.cancelledBy) ? ` bởi ${personName(receipt.cancelledBy)}` : ''}
              {receipt.cancelledAt ? ` lúc ${formatDateTime(receipt.cancelledAt)}` : ''}.
              {receipt.cancelReason && <> Lý do: {receipt.cancelReason}</>}
            </div>
          </div>
        )}
        <fieldset className="kb-receipt-fields" disabled={!editable}>
          <div className="card wizard-card">
            <div className="card__header">
              <div className="card__title">Thông tin phiếu</div>
            </div>
            <div className="card__body grid-2">
              <FormField label="Điểm trường" required error={errors.campusId}>
                <select
                  className="select"
                  value={form.campusId}
                  disabled={!editable || !isNew}
                  onChange={(e) => setField('campusId', e.target.value)}
                >
                  {campus.campuses.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.shortName || c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Nhà cung cấp" required error={errors.supplierId}>
                <SearchSelect
                  options={supplierOptions}
                  value={form.supplierId}
                  onChange={(v) => setField('supplierId', v)}
                  placeholder="Chọn nhà cung cấp..."
                  ariaLabel="Nhà cung cấp"
                  disabled={!editable}
                  error={!!errors.supplierId}
                />
              </FormField>
              <FormField label="Ngày nhập kho" required error={errors.receivedDate}>
                <DateInput value={form.receivedDate} onChange={(v) => setField('receivedDate', v)} />
              </FormField>
              <FormField label="Ghi chú" error={errors.note} hint={`Tối đa ${NOTE_MAX} ký tự`}>
                <input className="input" value={form.note} maxLength={NOTE_MAX} onChange={(e) => setField('note', e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="card wizard-card mt-16">
            <div className="card__header row row--between">
              <div className="card__title">Thực phẩm nhập kho</div>
              {editable && (
                <button type="button" className="btn btn--sm" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>
                  <Plus size={15} /> Thêm thực phẩm
                </button>
              )}
            </div>
            {errors.lines && <div className="field__error kb-card-error">{errors.lines}</div>}
            <div className="table-wrap">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th className="min-w-220">
                      Thực phẩm <span className="req">*</span>
                    </th>
                    <th>
                      Số lượng <span className="req">*</span>
                    </th>
                    <th>
                      Số lô <span className="req">*</span>
                    </th>
                    <th>
                      Hạn sử dụng <span className="req">*</span>
                    </th>
                    <th>
                      Đơn giá <span className="req">*</span>
                    </th>
                    <th className="money cell--fixed">{editable ? 'Thành tiền (tạm tính)' : 'Thành tiền'}</th>
                    {editable && (
                      <th className="center">
                        <span className="sr-only">Xóa dòng</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, i) => {
                    const food = foodById[String(line.foodId)];
                    const unit = food?.purchaseUnit || '';
                    const value = editable ? estimate(line) : receipt?.lines[i]?.value;
                    return (
                      <tr key={line.key}>
                        <td>
                          <SearchSelect
                            options={foodOptions}
                            value={String(line.foodId)}
                            onChange={(v) => setLine(i, 'foodId', v)}
                            placeholder="Chọn thực phẩm"
                            ariaLabel={`Thực phẩm dòng ${i + 1}`}
                            disabled={!editable}
                            error={!!err(i, 'foodId')}
                          />
                          {err(i, 'foodId') && <div className="field__error">{err(i, 'foodId')}</div>}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input kb-num ${err(i, 'purchaseQty') ? 'input--error' : ''}`}
                            value={line.purchaseQty}
                            onChange={(e) => setLine(i, 'purchaseQty', e.target.value)}
                            aria-label={`Số lượng dòng ${i + 1}`}
                          />
                          <span className="muted text-xs"> {unit}</span>
                          {err(i, 'purchaseQty') && <div className="field__error">{err(i, 'purchaseQty')}</div>}
                        </td>
                        <td>
                          <input
                            className={`input kb-lot-input ${err(i, 'lotNo') ? 'input--error' : ''}`}
                            value={line.lotNo}
                            maxLength={50}
                            onChange={(e) => setLine(i, 'lotNo', e.target.value)}
                            aria-label={`Số lô dòng ${i + 1}`}
                          />
                          {err(i, 'lotNo') && <div className="field__error">{err(i, 'lotNo')}</div>}
                        </td>
                        <td>
                          <DateInput
                            value={line.expiryDate}
                            onChange={(v) => setLine(i, 'expiryDate', v)}
                            className={err(i, 'expiryDate') ? 'input--error' : ''}
                            aria-label={`Hạn sử dụng dòng ${i + 1}`}
                          />
                          {err(i, 'expiryDate') && <div className="field__error">{err(i, 'expiryDate')}</div>}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className={`input kb-num ${err(i, 'unitPrice') ? 'input--error' : ''}`}
                            value={line.unitPrice}
                            onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                            aria-label={`Đơn giá dòng ${i + 1}`}
                          />
                          <span className="muted text-xs"> đ/{unit}</span>
                          {err(i, 'unitPrice') && <div className="field__error">{err(i, 'unitPrice')}</div>}
                        </td>
                        <td className="money nowrap fw-600 cell--fixed">{value == null ? '—' : formatMoney(value)}</td>
                        {editable && (
                          <td className="center">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => removeLine(i)}
                              disabled={form.lines.length === 1}
                              title="Xóa dòng"
                              aria-label={`Xóa dòng ${i + 1}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="right fw-600">
                      {editable ? 'Tổng tiền (tạm tính)' : 'Tổng tiền'}
                    </td>
                    <td className="money nowrap fw-600">{formatMoney(editable ? total : receipt?.totalValue)}</td>
                    {editable && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
            {editable && (
              <p className="card__body text-sm muted">
                Số lượng và đơn giá tính theo đơn vị mua của từng thực phẩm; khi lưu, số lượng được quy đổi về đơn vị gốc.
              </p>
            )}
          </div>
        </fieldset>

        <div className="page-actions">
          <Link className="btn" to={listPath}>
            <ArrowLeft size={16} /> Quay lại
          </Link>
          {editable && !isNew && (
            <button type="button" className="btn btn--outline-danger" disabled={busy} onClick={() => openDialog('delete')}>
              <Trash2 size={16} /> Xóa phiếu nháp
            </button>
          )}
          {editable && (
            <>
              <button type="button" className="btn" onClick={saveDraft} disabled={busy}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu nháp
              </button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => openDialog('confirm')}>
                <PackagePlus size={16} /> Xác nhận nhập kho
              </button>
            </>
          )}
          {receipt?.status === RECEIPT_STATUS.CONFIRMED && receipt.canManage && (
            <button type="button" className="btn btn--danger" onClick={() => openDialog('cancel')}>
              <XCircle size={16} /> Hủy phiếu
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts, title)} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {receipt && <ReceiptStatusBadge status={receipt.status} size="lg" />}
      </div>
      {content}
      <ConfirmationModal
        open={dialog === 'confirm'}
        title="Xác nhận nhập kho?"
        message="Phiếu được lưu rồi tạo lô tồn kho từ các dòng đã nhập. Phiếu đã xác nhận không sửa được."
        confirmLabel="Xác nhận nhập kho"
        onConfirm={confirmReceipt}
        onClose={closeDialog}
      />
      <ConfirmationModal
        open={dialog === 'delete'}
        danger
        title="Xóa phiếu nháp?"
        message="Phiếu nháp bị xóa hẳn và chưa ảnh hưởng đến kho."
        confirmLabel="Xóa phiếu"
        error={dialogError}
        onConfirm={deleteDraft}
        onClose={closeDialog}
      />
      <ConfirmationModal
        open={dialog === 'cancel'}
        danger
        title="Hủy phiếu nhập?"
        message="Các lô của phiếu được rút khỏi kho. Nhập lý do hủy để lưu vào lịch sử."
        confirmLabel="Hủy phiếu"
        cancelLabel="Giữ phiếu"
        error={dialogError}
        onConfirm={cancelReceipt}
        onClose={closeDialog}
      >
        <div className="mt-12">
          <FormField label="Lý do hủy" required>
            <textarea className="textarea" rows={3} maxLength={NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
      </ConfirmationModal>
    </div>
  );
}
