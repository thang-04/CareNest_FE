import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileImport, PackagePlus, Plus, Save, Trash2, XCircle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Breadcrumb,
  ConfirmationModal,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  SearchSelect,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { useActiveSuppliers, useDryFoods, useLots, useReceipt, useStockCampus, useSupplierFoods } from '@/hooks/kitchen/useDryStock';
import { receiptOriginOf } from '@/hooks/kitchen/useReceiptOrigin';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { canManageStockAt } from '@/utils/kitchen/kitchenPermissions';
import { dryStockApi } from '@/services/dryStockApi';
import { RECEIPT_STATUS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import {
  autoLotNo,
  emptyLine,
  emptyReceiptForm,
  isAutoLotNo,
  mapReceiptErrors,
  receiptNoteError,
  receiptToForm,
  uniqueLotNo,
  validateReceiptForm,
} from '@/utils/kitchen/stockReceiptForm';
import { RECEIPT_IMPORT_COLUMNS, readReceiptFile } from '@/utils/kitchen/stockReceiptImport';
import { downloadCsv } from '@/utils/exportCsv';
import { personName } from '@/utils/kitchen/stockLots';
import { ImportDialog } from '@/components/upload/ImportDialog';
import { Button } from '@/components/ui/Button';
import { LockNote } from '@/components/ui/LockNote';
import { ReadOnlyTag } from '@/components/ui/ReadOnlyTag';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, formatMoney, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';

const estimate = (line) => {
  const qty = Number(line.purchaseQty);
  const price = Number(line.unitPrice);
  return line.purchaseQty !== '' && line.unitPrice !== '' && qty > 0 && price >= 0 ? qty * price : null;
};

// Dòng không đạt của phiếu sinh từ kiểm nhận: không thành lô, chỉ lưu để tra biện pháp xử lý
const rejectedColumns = [
  { key: 'lot', header: 'Số lô', render: (line) => line.lotNo },
  { key: 'food', header: 'Thực phẩm', render: (line) => line.food.name },
  {
    key: 'qty',
    header: 'Số lượng',
    className: 'num nowrap',
    render: (line) => `${fmtQty(line.purchaseQuantity)} ${line.food.purchaseUnit || ''}`,
  },
  { key: 'expiry', header: 'Hạn sử dụng', className: 'nowrap', render: (line) => formatDate(line.expiryDate) },
  { key: 'note', header: 'Biện pháp xử lý', render: (line) => line.note },
];

/**
 * Phiếu nhập kho khô (`/kitchen/stock-receipts/new`, `/:id`): lập và sửa phiếu nháp, xác nhận nhập kho, hủy phiếu đã xác nhận (có lý do),
 * xóa phiếu nháp. Số lượng nhập theo đơn vị mua, gửi BE theo đơn vị gốc. Nút theo cờ `canManage` BE trả; BE vẫn là nơi kiểm tra.
 */
const CANCEL_BLOCKED = 'Thực phẩm của phiếu đã được xuất dùng.';

// Giá hợp đồng của nhà cung cấp cho thực phẩm (cùng đơn vị mua với dòng nhập); không có thì ''
const supplierPrice = (supplierFoods, foodId) => {
  const price = supplierFoods.find((f) => String(f.foodId) === String(foodId))?.price;
  return price == null || price === '' || !(Number(price) >= 0) ? '' : String(price);
};

export default function StockReceiptEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  // Màn người dùng bắt đầu lập phiếu (Tồn kho khô, Danh sách phiếu nhập…); không có ⇒ danh sách phiếu nhập
  const origin = receiptOriginOf(location.state);
  const toast = useToast();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const campus = useStockCampus();
  // Phiếu mới chỉ lập ở điểm trường được ghi kho (theo quyền BE); mặc định điểm đang xem nếu được ghi
  const writableCampuses = campus.campuses.filter((c) => canManageStockAt(user, c.id));
  const canCreate = writableCampuses.length > 0;
  const defaultCampusId = writableCampuses.some((c) => String(c.id) === campus.campusId)
    ? campus.campusId
    : String(writableCampuses[0]?.id ?? '');
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
  // Hộp nhập từ Excel: { open, fileName, reading, result: { lines, problems } }
  const [importing, setImporting] = useState({ open: false });
  // Đổi nhà cung cấp làm mất dòng đã nhập ⇒ chờ người dùng xác nhận: { next, nextFoods, count }
  const [supplierSwitch, setSupplierSwitch] = useState(null);

  // Nhập dòng từ Excel/CSV: thêm vào form nháp (bỏ dòng trống), người dùng xem lại rồi lưu
  const readImport = async (file) => {
    setImporting({ open: true, fileName: file.name, reading: true });
    try {
      const result = await readReceiptFile(file, importFoods);
      setImporting({ open: true, fileName: file.name, result });
    } catch (err) {
      toast.error(err, 'Không đọc được file');
      setImporting({ open: true });
    }
  };
  const applyImport = () => {
    const lines = importing.result?.lines || [];
    setForm((f) => ({ ...f, lines: [...f.lines.filter((l) => l.foodId || l.purchaseQty || l.lotNo), ...lines] }));
    toast.success(`Đã thêm ${lines.length} dòng từ file.`);
    setImporting({ open: false });
  };
  const downloadTemplate = () =>
    downloadCsv([RECEIPT_IMPORT_COLUMNS, ['TP001', 'Gạo tẻ', '50', 'L2611-01', '30/06/2027', '18000']], 'phieu-nhap-kho-mau.csv');

  useEffect(() => {
    // NUT-11: ngày nhập luôn là hôm nay; phiếu nháp ngày cũ được đổi sang hôm nay khi lưu hoặc xác nhận
    if (receipt)
      setForm({
        ...receiptToForm(receipt),
        ...(receipt.status === RECEIPT_STATUS.DRAFT && { receivedDate: todayInput() }),
      });
  }, [receipt]);
  useEffect(() => {
    if (isNew && !form && defaultCampusId)
      setForm(emptyReceiptForm({ campusId: defaultCampusId, today: todayInput(), foodId: params.get('foodId') || '' }));
  }, [isNew, form, defaultCampusId, params]);

  const editable = isNew ? canCreate : !!receipt && receipt.status === RECEIPT_STATUS.DRAFT && !!receipt.canManage;
  const staleDraft = !isNew && receipt?.status === RECEIPT_STATUS.DRAFT && receipt.receivedDate !== todayInput();
  // Người không có quyền quản lý kho của điểm trường này chỉ xem phiếu
  const viewOnly = isNew ? !canCreate : !!receipt && !receipt.canManage;
  usePageReadOnly();
  // Thực phẩm tra đơn vị mua: danh mục khô + thực phẩm đã ghi trên phiếu (phòng khi đã ngừng sử dụng)
  const foodById = useMemo(() => {
    const map = {};
    foods.forEach((f) => (map[String(f.id)] = f));
    (receipt?.lines || []).forEach((l) => l.food && (map[String(l.food.id)] ||= l.food));
    return map;
  }, [foods, receipt]);
  // Phiếu đang sửa: chỉ thực phẩm thuộc nhà cung cấp đã chọn (BE kiểm tra lại khi lưu và xác nhận)
  const {
    foods: allSupplierFoods,
    loading: supplierFoodsLoading,
    error: supplierFoodsError,
  } = useSupplierFoods(editable ? form?.supplierId : '', form?.receivedDate);
  // Lô đã vào kho (kể cả hết tồn) để tránh gợi ý số lô trùng; chỉ tải khi đang lập hoặc sửa phiếu
  const stockLots = useLots({ campusId: editable ? form?.campusId : '', includeEmpty: true });
  // Phiếu nhập chỉ nhận hàng khô: bỏ thực phẩm tươi của nhà cung cấp
  const supplierFoods = useMemo(() => {
    const dryIds = new Set(foods.map((f) => String(f.id)));
    return dryIds.size ? allSupplierFoods.filter((f) => dryIds.has(String(f.foodId))) : allSupplierFoods;
  }, [allSupplierFoods, foods]);
  const importFoods = useMemo(
    () => supplierFoods.map((f) => ({ id: f.foodId, code: f.code, name: f.name, unitPrice: f.price })),
    [supplierFoods],
  );
  const foodOptions = useMemo(() => {
    if (editable) return supplierFoods.map((f) => ({ value: String(f.foodId), label: `${f.name} (${f.purchaseUnit})` }));
    const picked = new Set((form?.lines || []).map((l) => String(l.foodId)));
    return Object.values(foodById)
      .filter((f) => f.status === 'ACTIVE' || picked.has(String(f.id)))
      .map((f) => ({ value: String(f.id), label: `${f.name} (${f.purchaseUnit})` }));
  }, [editable, supplierFoods, foodById, form]);
  const supplierId = form?.supplierId || '';
  const noSupplierFoods = editable && !!supplierId && !supplierFoodsLoading && !supplierFoodsError && supplierFoods.length === 0;
  let foodPlaceholder = 'Chọn thực phẩm';
  if (editable && !supplierId) foodPlaceholder = 'Vui lòng chọn nhà cung cấp trước';
  else if (editable && supplierFoodsLoading) foodPlaceholder = 'Đang tải thực phẩm...';
  else if (noSupplierFoods) foodPlaceholder = 'Chưa có thực phẩm';
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
  const catalogPrice = (foodId) => supplierPrice(supplierFoods, foodId);
  const codeOfFood = (foodId) =>
    supplierFoods.find((f) => String(f.foodId) === String(foodId))?.code || foodById[String(foodId)]?.code || '';
  // Số lô (chữ thường) của thực phẩm đã vào kho điểm trường hoặc đã có ở dòng khác trên phiếu
  const takenLotNos = (foodId, lines, skipIndex) =>
    new Set([
      ...(stockLots.data || []).filter((lot) => String(lot.food?.id) === String(foodId)).map((lot) => String(lot.lotNo).toLowerCase()),
      ...lines.filter((l, i) => i !== skipIndex && String(l.foodId) === String(foodId) && l.lotNo).map((l) => l.lotNo.trim().toLowerCase()),
    ]);
  const setLine = (index, field, value) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value };
        // Đổi thực phẩm: thay giá nếu ô còn trống hoặc vẫn là giá hợp đồng của thực phẩm trước, giá người dùng đã sửa thì giữ
        if (field === 'foodId' && (l.unitPrice === '' || String(l.unitPrice) === catalogPrice(l.foodId)))
          next.unitPrice = catalogPrice(value);
        // Số lô tự điền theo thực phẩm, thêm đuôi -2, -3… nếu đã có trong phiếu hoặc trong kho; ô trống hoặc còn là số lô tự sinh
        // của thực phẩm trước thì thay, số lô người dùng đã gõ thì giữ (BE vẫn chặn số lô trùng khi lưu)
        if (field === 'foodId' && (l.lotNo === '' || isAutoLotNo(l.lotNo, autoLotNo(f.receivedDate, codeOfFood(l.foodId)))))
          next.lotNo = uniqueLotNo(autoLotNo(f.receivedDate, codeOfFood(value)), takenLotNos(value, f.lines, index));
        return next;
      }),
    }));
    setErrors((e) => ({ ...e, [`lines.${index}.${field}`]: undefined, lines: undefined, _form: undefined }));
  };
  // Đổi nhà cung cấp: dòng có thực phẩm ngoài danh sách của nhà cung cấp mới bị bỏ chọn thực phẩm và đơn giá
  const applySupplier = (next, nextFoods) => {
    const valid = new Set(nextFoods.map((f) => String(f.foodId)));
    setForm((f) => ({
      ...f,
      supplierId: next,
      lines: f.lines.map((l) => {
        if (l.foodId === '') return l;
        if (!valid.has(String(l.foodId))) return { ...l, foodId: '', unitPrice: '' };
        // Giá còn là giá hợp đồng của nhà cung cấp cũ thì theo nhà cung cấp mới; giá người dùng đã sửa thì giữ
        const keep = l.unitPrice !== '' && String(l.unitPrice) !== catalogPrice(l.foodId);
        return keep ? l : { ...l, unitPrice: supplierPrice(nextFoods, l.foodId) };
      }),
    }));
    setErrors((e) => ({ ...e, supplierId: undefined, lines: undefined, _form: undefined }));
  };
  const changeSupplier = async (next) => {
    if (next === form.supplierId) return;
    try {
      const nextFoods = next ? await nutritionCatalogApi.getSupplierFoods(next, form.receivedDate) : [];
      const valid = new Set(nextFoods.map((f) => String(f.foodId)));
      const lost = form.lines.filter((l) => l.foodId !== '' && !valid.has(String(l.foodId)) && (l.purchaseQty || l.lotNo || l.expiryDate));
      if (lost.length) setSupplierSwitch({ next, nextFoods, count: lost.length });
      else applySupplier(next, nextFoods);
    } catch (err) {
      toast.error(err, 'Không tải được thực phẩm của nhà cung cấp');
    }
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
    if (isNew) navigate(`/kitchen/stock-receipts/${saved.id}`, { replace: true, state: location.state });
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
        // Lưu nháp luôn về danh sách phiếu nhập, dù bắt đầu từ màn nào
        navigate(listPath, { replace: true });
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
      await dryStockApi.confirmReceipt(saved.id);
      toast.success('Đã xác nhận nhập kho.');
      setDialog(null);
      // Chỉ rời trang khi xác nhận thành công: về màn nguồn (giữ điểm trường/bộ lọc trên URL)
      navigate(origin || listPath, { replace: true });
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
  if (isNew && !campus.loading && !canCreate)
    content = <ErrorState error={{ status: 403, message: 'Tài khoản chưa được cấp quyền lập phiếu nhập kho.' }} />;
  else if (!isNew && receiptQ.error) content = <ErrorState error={receiptQ.error} onRetry={receiptQ.reload} />;
  else if (isNew && !campus.loading && !campus.campusId)
    content = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để lập phiếu." />;
  else if (!form) content = <LoadingState />;
  else {
    const total = form.lines.reduce((sum, l) => sum + (estimate(l) || 0), 0);
    const err = (i, field) => errors[`lines.${i}.${field}`];
    content = (
      <>
        <div className="page-actions page-actions--top">
          <Link className="btn" to={listPath}>
            <ArrowLeft size={16} /> Quay lại
          </Link>
          {editable && !isNew && (
            <Button variant="outline-danger" icon={Trash2} disabled={busy} onClick={() => openDialog('delete')}>
              Xóa phiếu nháp
            </Button>
          )}
          {editable && (
            // Tổng tiền, Lưu nháp và Xác nhận đứng chung một nhóm bên phải
            <div className="kb-actions-main">
              <span className="kb-actions-total">
                Tổng tạm tính <b>{formatMoney(form.lines.reduce((sum, l) => sum + (estimate(l) || 0), 0))}</b>
              </span>
              <Button icon={Save} loading={busy} onClick={saveDraft}>
                Lưu nháp
              </Button>
              <Button variant="primary" icon={PackagePlus} disabled={busy} onClick={() => openDialog('confirm')}>
                Xác nhận nhập kho
              </Button>
            </div>
          )}
          {receipt?.status === RECEIPT_STATUS.CONFIRMED && receipt.canManage && (
            // NUT-11: hủy được khi chưa lô nào bị trừ; BE trả canCancel, bản demo không có cờ thì giữ nút
            <Button
              variant="danger"
              icon={XCircle}
              disabledReason={receipt.canCancel === false ? CANCEL_BLOCKED : undefined}
              onClick={() => openDialog('cancel')}
            >
              Hủy phiếu
            </Button>
          )}
        </div>
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
        {receipt?.fromIntake && (
          <div className="alert alert--info mb-16" role="status">
            Phiếu lập tự động từ{' '}
            <Link to={`/kitchen/fresh-receipts?campusId=${receipt.campusId}&date=${receipt.receivedDate}`}>
              kiểm nhận hàng ngày {formatDate(receipt.receivedDate)}
            </Link>
            : chỉ dòng đạt được nhập kho.
          </div>
        )}
        {receipt?.status === RECEIPT_STATUS.CONFIRMED && receipt.canManage && receipt.canCancel === false && (
          <LockNote kind="locked" className="mb-16">
            Không hủy được: thực phẩm của phiếu đã được xuất dùng.
          </LockNote>
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
                <SelectField
                  className="select"
                  value={form.campusId}
                  disabled={!editable || !isNew}
                  onChange={(e) => setField('campusId', e.target.value)}
                >
                  {(isNew ? writableCampuses : campus.campuses).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.shortName || c.name}
                    </option>
                  ))}
                </SelectField>
              </FormField>
              <FormField label="Nhà cung cấp" required error={errors.supplierId}>
                <SearchSelect
                  options={supplierOptions}
                  value={form.supplierId}
                  onChange={changeSupplier}
                  placeholder="Chọn nhà cung cấp..."
                  ariaLabel="Nhà cung cấp"
                  disabled={!editable}
                  error={!!errors.supplierId}
                />
              </FormField>
              <FormField
                label="Ngày nhập kho"
                required
                error={errors.receivedDate}
                hint={
                  !editable
                    ? undefined
                    : staleDraft
                      ? `Phiếu nháp lập ngày ${formatDate(receipt.receivedDate)}; khi lưu sẽ đổi ngày nhập về hôm nay`
                      : 'Phiếu nhập ghi đúng ngày nhận hàng (hôm nay)'
                }
              >
                <DateInput value={form.receivedDate} onChange={() => {}} disabled />
              </FormField>
              <FormField label="Ghi chú" error={errors.note} hint={`${(form.note || '').length}/${NOTE_MAX} ký tự`}>
                <TextField
                  className="input"
                  value={form.note}
                  onChange={(e) => {
                    setField('note', e.target.value);
                    // Không dùng maxLength: dán quá dài sẽ bị cắt ngầm; giữ nguyên nội dung và báo lỗi ngay
                    setErrors((prev) => ({ ...prev, note: receiptNoteError(e.target.value) }));
                  }}
                />
              </FormField>
            </div>
          </div>

          <div className="card wizard-card mt-16">
            <div className="card__header row row--between">
              <div className="card__title">Thực phẩm nhập kho</div>
              {editable && (
                <div className="row kb-line-actions">
                  <Button
                    size="sm"
                    icon={FileImport}
                    disabled={!supplierId || supplierFoodsLoading || noSupplierFoods}
                    title={supplierId ? undefined : 'Vui lòng chọn nhà cung cấp trước'}
                    onClick={() => setImporting({ open: true })}
                  >
                    Nhập từ Excel
                  </Button>
                  <Button size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>
                    Thêm thực phẩm
                  </Button>
                </div>
              )}
            </div>
            {errors.lines && <div className="field__error kb-card-error">{errors.lines}</div>}
            {noSupplierFoods && <div className="field__error kb-card-error">Nhà cung cấp này chưa có thực phẩm được thiết lập.</div>}
            {editable && supplierFoodsError && (
              <div className="field__error kb-card-error">Không tải được thực phẩm của nhà cung cấp. Chọn lại nhà cung cấp để thử lại.</div>
            )}
            <div className="table-wrap">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th>
                      Số lô <span className="req">*</span>
                    </th>
                    <th className="min-w-220">
                      Thực phẩm <span className="req">*</span>
                    </th>
                    <th>
                      Số lượng <span className="req">*</span>
                    </th>
                    <th>
                      Hạn sử dụng <span className="req">*</span>
                    </th>
                    <th>
                      Đơn giá <span className="req">*</span>
                    </th>
                    <th className="money cell--fixed">{editable ? 'Thành tiền (tạm tính)' : 'Thành tiền'}</th>
                    {editable && <th className="cell--actions">Thao tác</th>}
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
                          <TextField
                            className={`input kb-lot-input ${err(i, 'lotNo') ? 'input--error' : ''}`}
                            value={line.lotNo}
                            maxLength={50}
                            onChange={(e) => setLine(i, 'lotNo', e.target.value)}
                            aria-label={`Số lô dòng ${i + 1}`}
                          />
                          {err(i, 'lotNo') && <div className="field__error">{err(i, 'lotNo')}</div>}
                        </td>
                        <td>
                          <SearchSelect
                            options={foodOptions}
                            value={String(line.foodId)}
                            onChange={(v) => setLine(i, 'foodId', v)}
                            placeholder={foodPlaceholder}
                            ariaLabel={`Thực phẩm dòng ${i + 1}`}
                            disabled={!editable || !supplierId || supplierFoodsLoading || noSupplierFoods}
                            error={!!err(i, 'foodId')}
                          />
                          {err(i, 'foodId') && <div className="field__error">{err(i, 'foodId')}</div>}
                        </td>
                        <td>
                          <TextField
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
                          <DateInput
                            value={line.expiryDate}
                            onChange={(v) => setLine(i, 'expiryDate', v)}
                            className={err(i, 'expiryDate') ? 'input--error' : ''}
                            aria-label={`Hạn sử dụng dòng ${i + 1}`}
                          />
                          {err(i, 'expiryDate') && <div className="field__error">{err(i, 'expiryDate')}</div>}
                        </td>
                        <td>
                          <TextField
                            type="number"
                            min="0"
                            step="any"
                            className={`input kb-num ${err(i, 'unitPrice') ? 'input--error' : ''}`}
                            value={line.unitPrice}
                            onChange={(e) => setLine(i, 'unitPrice', e.target.value)}
                            aria-label={`Đơn giá dòng ${i + 1}`}
                          />
                          {unit && <span className="muted text-xs"> đ/{unit}</span>}
                          {err(i, 'unitPrice') && <div className="field__error">{err(i, 'unitPrice')}</div>}
                        </td>
                        <td className="money nowrap fw-600 cell--fixed">{value == null ? '—' : formatMoney(value)}</td>
                        {editable && (
                          <td className="cell--actions">
                            <Button
                              variant="icon"
                              onClick={() => removeLine(i)}
                              disabled={form.lines.length === 1}
                              title="Xóa dòng"
                              aria-label={`Xóa dòng ${i + 1}`}
                            >
                              <Trash2 size={16} />
                            </Button>
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
        {receipt?.rejectedLines?.length > 0 && (
          <div className="card wizard-card mt-16">
            <div className="card__header">
              <div className="card__title">Dòng không đạt khi kiểm nhận</div>
            </div>
            <DataTable columns={rejectedColumns} rows={receipt.rejectedLines} rowKey={(line) => `${line.food.id}-${line.lotNo}`} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts, title)} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {receipt && <ReceiptStatusBadge status={receipt.status} size="lg" />}
        {viewOnly && <ReadOnlyTag />}
      </div>
      {content}
      <ConfirmationModal
        open={!!supplierSwitch}
        danger
        title="Đổi nhà cung cấp?"
        message={`${supplierSwitch?.count || 0} dòng đã nhập có thực phẩm không thuộc nhà cung cấp mới. Thực phẩm và đơn giá của các dòng này sẽ bị xóa, bạn chọn lại thực phẩm cho các dòng đó.`}
        confirmLabel="Đổi nhà cung cấp"
        onConfirm={() => {
          applySupplier(supplierSwitch.next, supplierSwitch.nextFoods);
          setSupplierSwitch(null);
        }}
        onClose={() => setSupplierSwitch(null)}
      />
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
            <TextAreaField className="textarea" rows={3} maxLength={NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
        </div>
      </ConfirmationModal>
      <ImportDialog
        open={importing.open}
        title="Nhập thực phẩm vào phiếu từ Excel"
        guide={
          <>
            Tải xuống <b>tệp mẫu</b>, điền mỗi dòng một thực phẩm kho khô (mã hoặc tên, số lượng, số lô, hạn dùng, đơn giá) rồi tải lên. Các
            dòng hợp lệ được thêm vào bảng của phiếu để kiểm tra trước khi lưu.
          </>
        }
        onTemplate={downloadTemplate}
        accept=".xlsx,.csv"
        hint="Tệp .xlsx hoặc .csv, tối đa 10MB."
        fileName={importing.fileName || ''}
        reading={!!importing.reading}
        onFile={readImport}
        confirmLabel={`Thêm ${importing.result?.lines.length || 0} dòng vào phiếu`}
        idleLabel="Thêm vào phiếu"
        confirmDisabled={!importing.result?.lines.length}
        onConfirm={applyImport}
        onClose={() => setImporting({ open: false })}
      >
        {importing.result && (
          <div className="import-preview">
            <div className="row td-chips">
              <span className="chip chip--green">Hợp lệ {importing.result.lines.length}</span>
              <span className={`chip ${importing.result.problems.length ? 'chip--red' : 'chip--gray'}`}>
                Lỗi {importing.result.problems.length}
              </span>
            </div>
            {importing.result.problems.length > 0 && (
              <section>
                <h3>Dòng chưa nhập được</h3>
                <ul className="kb-import-problems">
                  {importing.result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </ImportDialog>
    </div>
  );
}
