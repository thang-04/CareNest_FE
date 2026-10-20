import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PackagePlus, Plus, Save, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFoodCatalog, useStockReceipt, useSuppliers } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, ErrorState, FormField, LoadingState, SearchSelect, Spinner } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { saveStockReceipt } from '@/services/kitchen/kitchenService';
import { itemError, validateStockReceipt } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { todayInput } from '@/utils/format';
import { NOTE_MAX, RECEIPT_STATUS, SUPPLIER_STATUS } from '@/models/kitchen/kitchenConstants';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { UNIT_KIND, hasPurchaseConversion, lineUnitName, toStockQty } from '@/utils/menu-planning/foodUnits';
import '@/styles/modules/kitchen.css';

const emptyLine = () => ({
  key: Math.random().toString(36).slice(2),
  foodId: '',
  // Mặc định nhập theo đơn vị mua (user chốt 20/10/2026); lô và tồn lưu theo đơn vị kho
  unitKind: UNIT_KIND.PURCHASE,
  receivedQty: '',
  rejectedQty: '',
  lotNo: '',
  mfgDate: '',
  expiryDate: '',
  unitPrice: '',
  note: '',
});

/* "?foodId=…" mở từ panel lô của Kho khô; "?items=foodId:qty,…" điền sẵn nhiều dòng. */
const linesFromQuery = (value) =>
  (value || '')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter(([foodId]) => foodId)
    // Lượng thiếu của phiếu xuất tính theo đơn vị kho
    .map(([foodId, qty]) => ({ ...emptyLine(), foodId, unitKind: UNIT_KIND.STOCK, receivedQty: qty || '' }));

const toLine = (it) => ({
  ...emptyLine(),
  ...Object.fromEntries(Object.entries(it).map(([k, v]) => [k, v == null ? '' : typeof v === 'number' ? String(v) : v])),
});

/**
 * Phiếu nhập kho khô (BA 05): NCC, nhiều dòng có lô, NSX, HSD, đơn giá, thành tiền tự tính.
 * Lưu nháp không cộng tồn; xác nhận nhập kiểm tra toàn phiếu, cộng tồn một lần và khóa sửa.
 */
export default function StockReceiptFormPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const [params] = useSearchParams();
  const { id } = useParams();
  const backTo = '/kitchen/stock-receipts';
  const existing = useStockReceipt(id);
  const locked = !!existing.data && existing.data.status !== RECEIPT_STATUS.DRAFT;
  const { foods: allFoods, loading, error, reload } = useFoodCatalog();
  // Kho chỉ giữ đồ khô; hàng tươi kiểm nhận ở bếp
  const foods = useMemo(() => allFoods.filter((f) => f.storage === 'DRY'), [allFoods]);
  const [form, setForm] = useState(() => {
    const prefilled = linesFromQuery(params.get('items') || (params.get('foodId') ? `${params.get('foodId')}:` : ''));
    return {
      campusId: params.get('campusId') || user?.campusId || '',
      date: todayInput(),
      supplierId: '',
      note: '',
      items: prefilled.length ? prefilled : [emptyLine()],
    };
  });
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);

  // Mở lại phiếu đã lưu: nạp vào form khi tải xong
  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setForm({ campusId: r.campusId, date: r.date, supplierId: r.supplierId || '', note: r.note || '', items: r.items.map(toLine) });
  }, [existing.data]);
  const [saving, setSaving] = useState(false);

  const foodById = useMemo(() => Object.fromEntries(foods.map((f) => [f.id, f])), [foods]);
  const options = useMemo(() => foods.map((f) => ({ value: f.id, label: `${f.name} (${f.unit})` })), [foods]);
  const suppliers = useSuppliers();
  // Chỉ NCC đang dùng; NCC đã gắn trên phiếu trước khi ngừng dùng vẫn hiện để giữ lựa chọn cũ
  const supplierOptions = useMemo(
    () =>
      (suppliers.data || [])
        .filter((s) => s.status === SUPPLIER_STATUS.ACTIVE || s.id === existing.data?.supplierId)
        .map((s) => ({
          value: s.id,
          label: `${s.code} · ${s.name}${s.status === SUPPLIER_STATUS.ACTIVE ? '' : ' (ngừng dùng)'}`,
        })),
    [suppliers.data, existing.data?.supplierId],
  );
  const legacySupplier = existing.data && !existing.data.supplierId ? existing.data.supplierName : '';

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

  const check = (confirm) => {
    const found = validateStockReceipt(form, todayInput(), { confirm });
    setErrors(found);
    if (Object.keys(found).length) toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa lưu được phiếu');
    return !Object.keys(found).length;
  };
  const openConfirm = () => check(true) && setConfirming(true);

  const save = async (confirm) => {
    if (!confirm && !check(false)) return;
    setSaving(true);
    try {
      const receipt = await saveStockReceipt({ ...form, id: id || null, confirm }, user);
      toast.success(
        confirm ? `Đã xác nhận nhập phiếu ${receipt.code} và cộng tồn kho.` : `Đã lưu nháp phiếu ${receipt.code}. Chưa cộng tồn kho.`,
      );
      navigate(backTo);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không lưu được phiếu');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const accepted = (it) => Math.max(0, Number(it.receivedQty || 0) - Number(it.rejectedQty || 0));
  const amountOf = (it) => (it.unitPrice === '' || it.unitPrice == null ? null : Math.round(accepted(it) * Number(it.unitPrice)));
  const total = form.items.reduce((n, it) => n + (amountOf(it) || 0), 0);
  const title = id ? `Phiếu nhập ${existing.data?.code || ''}` : 'Tạo phiếu nhập kho';

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts, title)} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {existing.data && <ReceiptStatusBadge status={existing.data.status} />}
      </div>
      {loading || existing.loading ? (
        <LoadingState />
      ) : error || existing.error ? (
        <ErrorState error={error || existing.error} onRetry={error ? reload : existing.reload} />
      ) : (
        <>
          {locked && (
            <p className="text-sm muted">
              Phiếu đã xác nhận nhập{existing.data.confirmedByName ? ` bởi ${existing.data.confirmedByName}` : ''}: tồn kho đã cộng, chỉ
              xem.
            </p>
          )}
          <fieldset className="kb-receipt-fields" disabled={locked}>
            <div className="card wizard-card">
              <div className="card__header">
                <div className="card__title">Thông tin phiếu</div>
              </div>
              <div className="card__body grid-2">
                <FormField label="Điểm trường" required error={errors.campusId}>
                  <select className="select" value={form.campusId} onChange={(e) => setField('campusId', e.target.value)}>
                    {md.campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Nhà cung cấp"
                  required
                  error={errors.supplierId}
                  hint={
                    legacySupplier
                      ? `Phiếu cũ ghi "${legacySupplier}", chưa liên kết danh mục: chọn nhà cung cấp trong danh mục.`
                      : 'Bắt buộc khi xác nhận nhập'
                  }
                >
                  <SearchSelect
                    options={supplierOptions}
                    value={form.supplierId}
                    onChange={(v) => setField('supplierId', v)}
                    placeholder={suppliers.loading ? 'Đang tải nhà cung cấp...' : 'Chọn nhà cung cấp...'}
                    ariaLabel="Nhà cung cấp"
                    disabled={locked}
                    error={!!errors.supplierId}
                  />
                </FormField>
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
              {errors.items && <div className="field__error kb-card-error">{errors.items}</div>}
              <div className="table-wrap">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th className="min-w-220">
                        Thực phẩm <span className="req">*</span>
                      </th>
                      <th>Đơn vị</th>
                      <th>
                        SL nhận <span className="req">*</span>
                      </th>
                      <th>SL không đạt</th>
                      <th className="num cell--fixed">Nhập kho</th>
                      <th>
                        Số lô <span className="req">*</span>
                      </th>
                      <th>
                        NSX <span className="req">*</span>
                      </th>
                      <th>
                        Hạn sử dụng <span className="req">*</span>
                      </th>
                      <th>
                        Đơn giá <span className="req">*</span>
                      </th>
                      <th className="num cell--fixed">Thành tiền</th>
                      <th className="min-w-200">Ghi chú kiểm tra</th>
                      <th className="center">
                        <span className="sr-only">Xóa dòng</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, i) => {
                      const food = foodById[it.foodId];
                      const unit = food ? lineUnitName(food, it.unitKind) : '';
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
                          <td className="nowrap">
                            {food && hasPurchaseConversion(food) ? (
                              <select
                                className="select"
                                value={it.unitKind}
                                onChange={(e) => setLine(i, 'unitKind', e.target.value)}
                                aria-label={`Đơn vị dòng ${i + 1}`}
                              >
                                <option value={UNIT_KIND.PURCHASE}>{food.purchaseUnit}</option>
                                <option value={UNIT_KIND.STOCK}>{food.stockUnit}</option>
                              </select>
                            ) : (
                              unit || <span className="muted">—</span>
                            )}
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
                          <td className="num nowrap fw-600 cell--fixed">
                            {food ? `${fmtQty(toStockQty(food, accepted(it), it.unitKind))} ${food.stockUnit}` : fmtQty(accepted(it))}
                          </td>
                          <td>
                            <input
                              className={`input kb-lot-input ${err('lotNo') ? 'input--error' : ''}`}
                              value={it.lotNo}
                              maxLength={50}
                              onChange={(e) => setLine(i, 'lotNo', e.target.value)}
                              aria-label={`Số lô dòng ${i + 1}`}
                            />
                            {err('lotNo') && <div className="field__error">{err('lotNo')}</div>}
                          </td>
                          <td>
                            <input
                              type="date"
                              className={`input ${err('mfgDate') ? 'input--error' : ''}`}
                              value={it.mfgDate}
                              max={todayInput()}
                              onChange={(e) => setLine(i, 'mfgDate', e.target.value)}
                              aria-label={`Ngày sản xuất dòng ${i + 1}`}
                            />
                            {err('mfgDate') && <div className="field__error">{err('mfgDate')}</div>}
                          </td>
                          <td>
                            <input
                              type="date"
                              className={`input ${err('expiryDate') ? 'input--error' : ''}`}
                              value={it.expiryDate}
                              onChange={(e) => setLine(i, 'expiryDate', e.target.value)}
                              aria-label={`Hạn sử dụng dòng ${i + 1}`}
                            />
                            {err('expiryDate') && <div className="field__error">{err('expiryDate')}</div>}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className={`input kb-num ${err('unitPrice') ? 'input--error' : ''}`}
                              value={it.unitPrice}
                              onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                              aria-label={`Đơn giá dòng ${i + 1}`}
                            />
                            <span className="muted text-xs"> đ/{unit}</span>
                            {err('unitPrice') && <div className="field__error">{err('unitPrice')}</div>}
                          </td>
                          <td className="num nowrap fw-600 cell--fixed">{amountOf(it) == null ? '—' : formatMoney(amountOf(it))}</td>
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
                  <tfoot>
                    <tr>
                      <td colSpan={8} className="right fw-600">
                        Tổng thành tiền (theo lượng nhập kho)
                      </td>
                      <td className="num nowrap fw-600">{formatMoney(total)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </fieldset>

          <div className="page-actions">
            <Link className="btn" to={backTo}>
              <ArrowLeft size={16} /> Quay lại
            </Link>
            {!locked && (
              <>
                <button className="btn" onClick={() => save(false)} disabled={saving}>
                  {saving ? <Spinner small /> : <Save size={16} />} Lưu nháp
                </button>
                <button className="btn btn--primary" onClick={openConfirm} disabled={saving}>
                  {saving ? <Spinner small /> : <PackagePlus size={16} />} Xác nhận nhập kho
                </button>
              </>
            )}
          </div>
        </>
      )}
      <ConfirmationModal
        open={confirming}
        title="Xác nhận nhập kho?"
        message="Số lượng đạt chất lượng được cộng vào tồn kho của điểm trường đã chọn theo từng lô. Phiếu đã xác nhận không sửa được."
        confirmLabel="Xác nhận nhập kho"
        onConfirm={() => save(true)}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
