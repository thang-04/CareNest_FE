import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus, Plus, Trash2, X } from '@/components/ui/icons';
import { Button, ConfirmationModal, DataTable, DateInput, FormField, SearchSelect, SelectField, TextField } from '@/components';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { useToast } from '@/contexts/ToastContext';
import { useActiveSuppliers, useDryFoods } from '@/hooks/kitchen/useDryStock';
import { freshGoodsApi } from '@/services/freshGoodsApi';
import { NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { emptyDryIntakeForm, emptyIntakeLine, mapDryIntakeErrors, validateDryIntakeForm } from '@/utils/kitchen/dryIntakeForm';
import { formatDate, formatDateTime } from '@/utils/format';

const qtyText = (qty, food) => (qty == null ? '—' : `${fmtQty(qty)} ${food?.purchaseUnit || ''}`.trim());

/**
 * Hàng khô giao hôm nay trong màn Kiểm nhận hàng hôm nay: lượng đã đặt theo bản dự trù và đã nhận cộng dồn của kỳ (BE tính),
 * các đợt đã nhận trong ngày, form thêm đợt. Xác nhận một đợt ⇒ BE lập phiếu nhập đã xác nhận từ dòng Đạt; dòng Không đạt
 * giữ trên phiếu kèm biện pháp xử lý. Sửa sai: hủy phiếu ở màn Phiếu nhập rồi ghi lại.
 */
export function DryIntakeCard({ dry, campusId, date, canWrite, onSaved }) {
  const toast = useToast();
  const { foods } = useDryFoods();
  const { suppliers } = useActiveSuppliers();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState('');

  const foodById = useMemo(() => Object.fromEntries(foods.map((f) => [String(f.id), f])), [foods]);
  const foodOptions = useMemo(
    () => foods.filter((f) => f.status === 'ACTIVE').map((f) => ({ value: String(f.id), label: `${f.name} (${f.purchaseUnit})` })),
    [foods],
  );
  const supplierOptions = useMemo(() => suppliers.map((s) => ({ value: String(s.id), label: s.name })), [suppliers]);
  const orderByFood = useMemo(() => Object.fromEntries(dry.orders.map((o) => [String(o.food.id), o])), [dry.orders]);

  const setField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const setLine = (index, field, value) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));
    setErrors((e) => ({ ...e, [`lines.${index}.${field}`]: undefined, lines: undefined }));
  };
  const removeLine = (index) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }));

  const askConfirm = () => {
    const found = validateDryIntakeForm(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa ghi nhận được hàng khô');
      return;
    }
    setSaveError('');
    setConfirming(true);
  };
  const save = async () => {
    try {
      const saved = await freshGoodsApi.saveDryIntake({ campusId, date, form, foodById });
      toast.success('Đã ghi nhận đợt hàng khô và nhập kho các dòng đạt.');
      setConfirming(false);
      setForm(null);
      setErrors({});
      onSaved(saved);
    } catch (err) {
      setSaveError(err.message);
      const mapped = mapDryIntakeErrors(err.details);
      if (Object.keys(mapped).length) setErrors(mapped);
    }
  };

  const orderColumns = [
    { key: 'food', header: 'Thực phẩm', render: (o) => o.food.name },
    {
      key: 'ordered',
      header: 'Đã đặt cho kỳ',
      className: 'num',
      render: (o) => (o.ordered == null ? 'Ngoài đơn' : qtyText(o.purchaseOrdered, o.food)),
    },
    { key: 'received', header: 'Đã nhận (đạt)', className: 'num', render: (o) => qtyText(o.purchaseReceived, o.food) },
    {
      key: 'left',
      header: 'Còn phải nhận',
      className: 'num',
      // Hiển thị hiệu hai số BE trả, không tính lại lượng đặt
      render: (o) => (o.ordered == null ? '—' : qtyText(Math.max(0, o.purchaseOrdered - o.purchaseReceived), o.food)),
    },
  ];

  const err = (i, field) => errors[`lines.${i}.${field}`];
  const lineColumns = [
    {
      key: 'food',
      header: 'Thực phẩm',
      className: 'min-w-220',
      render: (line) => {
        const i = form.lines.indexOf(line);
        const order = orderByFood[String(line.foodId)];
        return (
          <>
            <SearchSelect
              options={foodOptions}
              value={String(line.foodId)}
              onChange={(v) => setLine(i, 'foodId', v)}
              placeholder="Chọn thực phẩm"
              ariaLabel={`Thực phẩm dòng ${i + 1}`}
              error={!!err(i, 'foodId')}
            />
            {line.foodId && (
              <div className="muted text-xs">
                {order?.ordered != null
                  ? `Đã đặt ${qtyText(order.purchaseOrdered, order.food)} · đã nhận ${qtyText(order.purchaseReceived, order.food)}`
                  : 'Ngoài đơn đặt của kỳ'}
              </div>
            )}
            {err(i, 'foodId') && <div className="field__error">{err(i, 'foodId')}</div>}
          </>
        );
      },
    },
    {
      key: 'qty',
      header: 'Số lượng',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <TextField
              type="number"
              min="0"
              step="any"
              className={`input kb-num ${err(i, 'purchaseQty') ? 'input--error' : ''}`}
              value={line.purchaseQty}
              onChange={(e) => setLine(i, 'purchaseQty', e.target.value)}
              aria-label={`Số lượng dòng ${i + 1}`}
            />
            <span className="muted text-xs"> {foodById[String(line.foodId)]?.purchaseUnit || ''}</span>
            {err(i, 'purchaseQty') && <div className="field__error">{err(i, 'purchaseQty')}</div>}
          </>
        );
      },
    },
    {
      key: 'lot',
      header: 'Số lô',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <TextField
              className={`input kb-lot-input ${err(i, 'lotNo') ? 'input--error' : ''}`}
              value={line.lotNo}
              maxLength={50}
              onChange={(e) => setLine(i, 'lotNo', e.target.value)}
              aria-label={`Số lô dòng ${i + 1}`}
            />
            {err(i, 'lotNo') && <div className="field__error">{err(i, 'lotNo')}</div>}
          </>
        );
      },
    },
    {
      key: 'expiry',
      header: 'Hạn sử dụng',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <DateInput
              value={line.expiryDate}
              onChange={(v) => setLine(i, 'expiryDate', v)}
              className={err(i, 'expiryDate') ? 'input--error' : ''}
              aria-label={`Hạn sử dụng dòng ${i + 1}`}
            />
            {err(i, 'expiryDate') && <div className="field__error">{err(i, 'expiryDate')}</div>}
          </>
        );
      },
    },
    {
      key: 'price',
      header: 'Đơn giá',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <TextField
              type="number"
              min="0"
              step="any"
              className={`input kb-num ${err(i, 'unitPrice') ? 'input--error' : ''}`}
              value={line.unitPrice}
              onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
              aria-label={`Đơn giá dòng ${i + 1}`}
            />
            {err(i, 'unitPrice') && <div className="field__error">{err(i, 'unitPrice')}</div>}
          </>
        );
      },
    },
    {
      key: 'passed',
      header: 'Cảm quan',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <SelectField
            className="select"
            value={line.passed ? 'PASS' : 'FAIL'}
            onChange={(e) => setLine(i, 'passed', e.target.value === 'PASS')}
            aria-label={`Cảm quan dòng ${i + 1}`}
          >
            <option value="PASS">Đạt</option>
            <option value="FAIL">Không đạt</option>
          </SelectField>
        );
      },
    },
    {
      key: 'note',
      header: 'Ghi chú / xử lý',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <TextField
              className={`input ${err(i, 'note') ? 'input--error' : ''}`}
              value={line.note}
              maxLength={300}
              placeholder={line.passed ? '' : 'Trả lại, tiêu hủy...'}
              onChange={(e) => setLine(i, 'note', e.target.value)}
              aria-label={`Ghi chú dòng ${i + 1}`}
            />
            {err(i, 'note') && <div className="field__error">{err(i, 'note')}</div>}
          </>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'cell--actions',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <Button
            variant="icon"
            onClick={() => removeLine(i)}
            disabled={form.lines.length === 1}
            title="Xóa dòng"
            aria-label={`Xóa dòng ${i + 1}`}
          >
            <Trash2 size={16} />
          </Button>
        );
      },
    },
  ];

  const passedCount = form ? form.lines.filter((l) => l.passed).length : 0;

  return (
    <section className="card" aria-label="Hàng khô giao hôm nay">
      <div className="card__header row row--between">
        <h2 className="card__title">Hàng khô giao hôm nay</h2>
        {canWrite && !form && (
          <Button icon={Plus} onClick={() => setForm(emptyDryIntakeForm())}>
            Thêm đợt hàng khô
          </Button>
        )}
      </div>
      <p className="kb-fresh__meta text-sm muted">
        {dry.forecastId ? (
          <>
            So với lượng đặt của <Link to={`/kitchen/forecast/${dry.forecastId}?campusId=${campusId}`}>bản dự trù</Link> kỳ{' '}
            {formatDate(dry.periodFrom)} – {formatDate(dry.periodTo)}. Đã nhận cộng dồn các đợt của kỳ.
          </>
        ) : (
          'Chưa có bản dự trù cho ngày này: hàng khô nhận được ghi là ngoài đơn.'
        )}
      </p>

      {dry.orders.length > 0 && <DataTable columns={orderColumns} rows={dry.orders} rowKey={(o) => o.food.id} />}

      {dry.receipts.length > 0 && (
        <div className="card__body kb-stack">
          {dry.receipts.map((receipt, n) => (
            <div key={receipt.id}>
              <div className="row row--between">
                <b>
                  Đợt {n + 1} · {receipt.supplierName} · {formatDateTime(receipt.confirmedAt || receipt.createdAt)}
                </b>
                <span className="row gap-2">
                  <ReceiptStatusBadge status={receipt.status} />
                  <Link to={`/kitchen/stock-receipts/${receipt.id}`}>Xem phiếu nhập</Link>
                </span>
              </div>
              <ul className="text-sm">
                {receipt.lines.map((l) => (
                  <li key={`ok-${l.id}`}>
                    Đạt: {l.food.name} — {qtyText(l.purchaseQuantity, l.food)}, lô {l.lotNo}, hạn {formatDate(l.expiryDate)}
                  </li>
                ))}
                {receipt.rejectedLines.map((l, k) => (
                  <li key={`ng-${k}`} className="text-danger">
                    Không đạt: {l.food.name} — {qtyText(l.purchaseQuantity, l.food)}, lô {l.lotNo}. Xử lý: {l.note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!form && !dry.receipts.length && !dry.orders.length && <p className="card__body muted">Hôm nay chưa ghi nhận hàng khô nào.</p>}

      {form && (
        <div className="card__body">
          <div className="grid-2">
            <FormField label="Nhà cung cấp" required error={errors.supplierId}>
              <SearchSelect
                options={supplierOptions}
                value={form.supplierId}
                onChange={(v) => setField('supplierId', v)}
                placeholder="Chọn nhà cung cấp..."
                ariaLabel="Nhà cung cấp hàng khô"
                error={!!errors.supplierId}
              />
            </FormField>
            <FormField label="Ghi chú" hint={`Tối đa ${NOTE_MAX} ký tự`}>
              <TextField className="input" value={form.note} maxLength={NOTE_MAX} onChange={(e) => setField('note', e.target.value)} />
            </FormField>
          </div>
          {errors.lines && <div className="field__error">{errors.lines}</div>}
          <DataTable columns={lineColumns} rows={form.lines} rowKey="key" />
          <div className="row row--between mt-12">
            <Button size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyIntakeLine()] }))}>
              Thêm thực phẩm
            </Button>
            <div className="row gap-2">
              <Button icon={X} onClick={() => setForm(null)}>
                Hủy
              </Button>
              <Button variant="primary" icon={PackagePlus} onClick={askConfirm}>
                Xác nhận nhận hàng
              </Button>
            </div>
          </div>
          <p className="text-sm muted mt-12">Số lượng và đơn giá theo đơn vị mua. Chỉ dòng Đạt được nhập kho.</p>
        </div>
      )}

      <ConfirmationModal
        open={confirming}
        title="Xác nhận nhận hàng khô?"
        message={`${passedCount} dòng đạt được nhập kho ngay (phiếu nhập đã xác nhận); ${form ? form.lines.length - passedCount : 0} dòng không đạt chỉ được ghi lại kèm biện pháp xử lý. Ghi nhầm thì hủy phiếu ở màn Phiếu nhập rồi ghi lại.`}
        confirmLabel="Xác nhận nhận hàng"
        error={saveError}
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}
