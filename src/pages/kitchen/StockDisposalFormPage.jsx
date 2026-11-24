import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PackageX, Plus, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useActiveSuppliers, useLots } from '@/hooks/kitchen/useDryStock';
import {
  Breadcrumb,
  Button,
  ConfirmationModal,
  DataTable,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  SearchSelect,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { dryStockApi } from '@/services/dryStockApi';
import { validateStockDisposal } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { DISPOSAL_KIND, DISPOSAL_KIND_LABELS, DISPOSAL_REASON_HINTS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const emptyLine = () => ({ key: Math.random().toString(36).slice(2), lotId: '', qty: '' });

const COPY = {
  [DISPOSAL_KIND.SUPPLIER_RETURN]: {
    intro:
      'Trả lại nhà cung cấp hàng còn hạn (giao thừa, sai quy cách, chất lượng không đạt). Chỉ chọn được lô còn hạn do nhà cung cấp đã chọn giao.',
    emptyTitle: 'Chưa có lô nào để trả',
    emptyDesc: 'Nhà cung cấp này không có lô còn hạn nào còn tồn ở điểm trường đã chọn.',
    pickTitle: 'Chọn nhà cung cấp trước',
    pickDesc: 'Sau khi chọn nhà cung cấp, các lô còn hạn do họ giao sẽ hiện ở đây.',
    confirmTitle: 'Xác nhận xuất kho trả nhà cung cấp?',
    confirmMessage: 'Số lượng trả được trừ khỏi từng lô và tồn kho của điểm trường. Phiếu đã xác nhận không sửa được.',
    done: 'đã trả nhà cung cấp và trừ tồn kho',
  },
  [DISPOSAL_KIND.WRITE_OFF]: {
    intro: 'Xuất khỏi kho những lô đã hết hạn sử dụng, kèm lý do. Lô còn hạn không xuất ở đây: trả nhà cung cấp bằng "Xuất kho cho NCC".',
    emptyTitle: 'Không có lô hết hạn',
    emptyDesc: 'Điểm trường đã chọn không có lô nào quá hạn sử dụng còn tồn.',
    confirmTitle: 'Xác nhận xuất kho hết hạn?',
    confirmMessage: 'Số lượng xuất được trừ khỏi từng lô và tồn kho của điểm trường. Phiếu đã xác nhận không sửa được.',
    done: 'đã xuất kho và trừ tồn',
  },
};

/**
 * Phiếu xuất kho khô kèm lý do (BE NUT-29, NUT-30): `kind` = SUPPLIER_RETURN (trả NCC, lô còn hạn) hoặc WRITE_OFF
 * (xuất hủy, lô hết hạn). BE quyết định hợp lệ (hạn, NCC, tồn, quyền); form chỉ lọc lô hợp lệ và nhắc ô thiếu.
 */
export default function StockDisposalFormPage({ kind = DISPOSAL_KIND.SUPPLIER_RETURN }) {
  const isReturn = kind === DISPOSAL_KIND.SUPPLIER_RETURN;
  const copy = COPY[kind];
  const title = DISPOSAL_KIND_LABELS[kind];
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => ({
    campusId: params.get('campusId') || user?.campusId || '',
    supplierId: '',
    reason: '',
    lines: [emptyLine()],
  }));
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const lots = useLots({ campusId: form.campusId });
  const suppliers = useActiveSuppliers();
  const backTo = `/kitchen/dry-stock${form.campusId ? `?campusId=${form.campusId}` : ''}`;
  const today = todayInput();

  const supplierOptions = useMemo(() => suppliers.suppliers.map((s) => ({ value: String(s.id), label: s.name })), [suppliers.suppliers]);
  const supplierName = suppliers.suppliers.find((s) => String(s.id) === String(form.supplierId))?.name || '';
  // Lô BE (tồn theo đơn vị gốc, kèm bản theo đơn vị mua) -> dòng chọn: tồn và số xuất hiện theo đơn vị mua
  const stockLots = useMemo(
    () =>
      (lots.data || []).map((l) => ({
        ...l,
        foodName: l.food?.name || '',
        unit: l.food?.purchaseUnit || '',
        qty: l.purchaseRemaining,
        expired: !!l.expiryDate && l.expiryDate < today,
      })),
    [lots.data, today],
  );
  const lotById = useMemo(() => Object.fromEntries(stockLots.map((l) => [l.id, l])), [stockLots]);
  // Trả NCC: lô còn hạn của NCC đã chọn; xuất hủy: lô hết hạn
  const eligible = useMemo(
    () =>
      stockLots.filter((l) => (isReturn ? !l.expired && !!form.supplierId && String(l.supplierId) === String(form.supplierId) : l.expired)),
    [stockLots, isReturn, form.supplierId],
  );
  const pickedIds = new Set(form.lines.map((l) => l.lotId).filter(Boolean));
  const optionsFor = (line) =>
    eligible
      .filter((l) => l.id === line.lotId || !pickedIds.has(l.id))
      .map((l) => ({ value: l.id, label: `${l.foodName} · Lô ${l.lotNo || '—'} · tồn ${fmtQty(l.qty)} ${l.unit}` }));

  const setField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  // Đổi điểm trường hoặc NCC ⇒ tập lô hợp lệ đổi theo, bỏ các dòng đã chọn
  const resetScope = (field, value) => {
    setForm((f) => ({ ...f, [field]: value, lines: [emptyLine()] }));
    setErrors({});
  };
  const setLine = (index, patch) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }));
    setErrors((e) => ({ ...e, [`lines.${index}.lotId`]: undefined, [`lines.${index}.qty`]: undefined, lines: undefined }));
  };
  // Chọn lô ⇒ điền sẵn toàn bộ tồn của lô (xuất hủy thường xuất hết lô), người dùng sửa lại được
  const pickLot = (index, lotId) => setLine(index, { lotId, qty: lotById[lotId] ? String(lotById[lotId].qty) : '' });
  const removeLine = (index) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }));
    setErrors({});
  };

  const openConfirm = () => {
    const found = validateStockDisposal({ ...form, kind }, { lotById, today, supplierName });
    setErrors(found);
    if (Object.keys(found).length) toast.error('Kiểm tra lại các ô được đánh dấu đỏ.', 'Chưa lập được phiếu');
    else setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const record = await dryStockApi.createDisposal(kind, form, lotById);
      toast.success(`Phiếu ${record.code} ${copy.done}.`);
      navigate(backTo);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lập được phiếu');
    } finally {
      setConfirming(false);
      setSaving(false);
    }
  };

  const pickedCount = form.lines.filter((l) => l.lotId).length;
  const totalQty = form.lines.reduce((n, l) => n + (Number(l.qty) > 0 ? Number(l.qty) : 0), 0);
  const needSupplier = isReturn && !supplierName;
  const noLots = !lots.loading && !needSupplier && eligible.length === 0;

  const columns = [
    {
      key: 'lot',
      header: (
        <>
          Lô <span className="req">*</span>
        </>
      ),
      className: 'min-w-220',
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <>
            <SearchSelect
              options={optionsFor(line)}
              value={line.lotId}
              onChange={(v) => pickLot(i, v)}
              placeholder="Chọn lô"
              ariaLabel={`Lô dòng ${i + 1}`}
              error={!!errors[`lines.${i}.lotId`]}
            />
            {errors[`lines.${i}.lotId`] && (
              <div className="field__error kb-cell-error" role="alert">
                {errors[`lines.${i}.lotId`]}
              </div>
            )}
          </>
        );
      },
    },
    {
      key: 'expiry',
      header: 'Hạn sử dụng',
      className: 'center nowrap',
      render: (line) => (lotById[line.lotId] ? formatDate(lotById[line.lotId].expiryDate) : <span className="muted">—</span>),
    },
    {
      key: 'stock',
      header: 'Tồn của lô',
      className: 'num nowrap',
      render: (line) => {
        const lot = lotById[line.lotId];
        return lot ? `${fmtQty(lot.qty)} ${lot.unit}` : <span className="muted">—</span>;
      },
    },
    {
      key: 'qty',
      header: (
        <>
          Số lượng xuất <span className="req">*</span>
        </>
      ),
      render: (line) => {
        const i = form.lines.indexOf(line);
        return (
          <div className="kb-qty-cell">
            <div className="kb-qty-row">
              <TextField
                type="number"
                min="0"
                step="any"
                className={`input kb-num ${errors[`lines.${i}.qty`] ? 'input--error' : ''}`}
                value={line.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                aria-label={`Số lượng xuất dòng ${i + 1}`}
              />
              <span className="muted text-xs">{lotById[line.lotId]?.unit || ''}</span>
            </div>
            {errors[`lines.${i}.qty`] && (
              <div className="field__error" role="alert">
                {errors[`lines.${i}.qty`]}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
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

  let linesBody;
  if (lots.error) linesBody = <ErrorState error={lots.error} onRetry={lots.reload} />;
  else if (lots.loading) linesBody = <LoadingState />;
  else if (needSupplier) linesBody = <EmptyState title={copy.pickTitle} description={copy.pickDesc} />;
  else if (noLots) linesBody = <EmptyState title={copy.emptyTitle} description={copy.emptyDesc} />;
  else linesBody = <DataTable columns={columns} rows={form.lines} rowKey="key" />;

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.dryStock, title)} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
      </div>
      <div className="alert alert--info mb-16" role="note">
        {copy.intro}
      </div>
      <div className="page-actions page-actions--top">
        <Link className="btn" to={backTo}>
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <div className="kb-actions-main">
          <span className="kb-actions-total">
            {pickedCount} lô · Tổng số lượng <b>{fmtQty(totalQty)}</b>
          </span>
          <Button variant="primary" icon={PackageX} loading={saving} disabled={lots.loading || !!lots.error} onClick={openConfirm}>
            Xác nhận xuất kho
          </Button>
        </div>
      </div>

      <div className="card wizard-card">
        <div className="card__header">
          <div className="card__title">Thông tin phiếu</div>
        </div>
        <div className="card__body grid-2">
          <FormField label="Điểm trường" required>
            <SelectField className="select" value={form.campusId} onChange={(e) => resetScope('campusId', e.target.value)}>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </SelectField>
          </FormField>
          {isReturn && (
            <FormField label="Nhà cung cấp" required error={errors.supplierId} hint="Chỉ trả được lô do nhà cung cấp này giao">
              <SearchSelect
                options={supplierOptions}
                value={form.supplierId}
                onChange={(v) => resetScope('supplierId', v)}
                placeholder={suppliers.loading ? 'Đang tải nhà cung cấp...' : 'Chọn nhà cung cấp...'}
                ariaLabel="Nhà cung cấp"
                error={!!errors.supplierId}
              />
            </FormField>
          )}
          <div className="kb-field--full">
            <FormField label="Lý do" required error={errors.reason} hint={`${form.reason.length}/${NOTE_MAX} ký tự`}>
              <TextAreaField
                className="textarea"
                rows={2}
                value={form.reason}
                maxLength={NOTE_MAX}
                onChange={(e) => setField('reason', e.target.value)}
                placeholder={DISPOSAL_REASON_HINTS[kind][0]}
              />
            </FormField>
            <div className="kb-reason-hints">
              <span className="text-sm muted">Gợi ý:</span>
              {DISPOSAL_REASON_HINTS[kind].map((hint) => (
                <Button key={hint} size="sm" onClick={() => setField('reason', hint)}>
                  {hint}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card wizard-card mt-16">
        <div className="card__header row row--between">
          <div className="card__title">Lô xuất kho</div>
          <Button
            size="sm"
            icon={Plus}
            onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
            disabled={needSupplier || noLots || form.lines.length >= eligible.length}
          >
            Thêm lô
          </Button>
        </div>
        {errors.lines && <div className="field__error kb-card-error">{errors.lines}</div>}
        {linesBody}
      </div>

      <ConfirmationModal
        open={confirming}
        title={copy.confirmTitle}
        message={copy.confirmMessage}
        confirmLabel="Xác nhận xuất kho"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
