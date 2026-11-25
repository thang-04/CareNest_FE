import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Printer, Unlock } from '@/components/ui/icons';
import { Breadcrumb, Button, EmptyState, ErrorState, LoadingState } from '@/components';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import {
  ApprovalDecisionDialog,
  ApprovalNotice,
  ApprovalRequestDialog,
  ApprovalStatusBadge,
  InspectionApprovalQueue,
} from '@/components/kitchen/inspection/InspectionApproval';
import { InspectionStatusBadge } from '@/components/kitchen/inspection/InspectionBadges';
import { InspectionFormModal } from '@/components/kitchen/inspection/InspectionFormModal';
import { InspectionPrintDialog } from '@/components/kitchen/inspection/InspectionPrintDialog';
import { useToast } from '@/contexts/ToastContext';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useInspectionDay } from '@/hooks/kitchen/useInspectionDay';
import { useFoodSamples } from '@/hooks/kitchen/useKitchenRecords';
import { pendingSampleCount } from '@/utils/kitchen/kitchenRecords';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import {
  APPROVAL_STATUS,
  INSPECTION_APPROVAL_REQUIRED,
  INSPECTION_FORMS,
  INSPECTION_TAB_LABELS,
  INSPECTION_TAB_ORDER,
} from '@/models/kitchen/inspectionConstants';
import { KITCHEN_RECORD_PAGES } from '@/models/kitchen/kitchenRecordConstants';
import {
  applySupplier,
  copyDown,
  fillRange,
  fillRows,
  formToRequest,
  hasValidSignature,
  isFormDirty,
  rowsMissing,
  toForm,
  toggleCell,
  toggleColumn,
  validateForm,
} from '@/utils/kitchen/inspectionForm';
import { approvalActionLabel } from '@/utils/kitchen/inspectionApproval';
import { actionsMissing } from '@/utils/kitchen/inspectionRules';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatDateTime, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

const AUTOSAVE_MS = 20000;
const EMPTY_HINT = {
  fresh: 'Chưa ghi nhận kiểm nhận hàng tươi cho ngày này.',
  dry: 'Ngày này chưa có phiếu xuất kho đồ khô.',
  process: 'Ngày này chưa có thực đơn đã công bố.',
  serve: 'Ngày này chưa có thực đơn đã công bố.',
  sample: 'Bếp chưa ghi lưu mẫu cho ngày này.',
};
const clockOf = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

function FormCard({ tab, data, date, campusId, onOpen, onRequest, onRevoke }) {
  const signed = hasValidSignature(data) && data.status === 'SIGNED';
  const sig = data.signature;
  const empty = !data.rows.length;
  const { approval } = data;
  // HT đang mở sẵn mẫu này cho PHT hoặc cho chính mình thì được thu hồi (INS-05)
  const canRevoke = approval.canSelfOpen && approval.status === APPROVAL_STATUS.APPROVED && !approval.locked;
  return (
    <section className="card kr-card">
      <div className="card__body kr-card__body">
        <div className="kr-card__top">
          <ClipboardCheck size={20} className="muted" />
          <div className="kr-card__name">
            <h2 className="card__title">{INSPECTION_TAB_LABELS[tab]}</h2>
            <div className="text-sm muted">
              {INSPECTION_FORMS[tab].step} · {INSPECTION_FORMS[tab].form}
            </div>
          </div>
          <div className="kr-card__badges">
            <InspectionStatusBadge status={data.status} />
            {approval.status && <ApprovalStatusBadge status={approval.status} />}
          </div>
        </div>
        <p className="text-sm">{INSPECTION_FORMS[tab].hint}</p>
        <div className="text-sm muted">
          {empty ? EMPTY_HINT[tab] : `${data.rows.length} dòng`}
          {empty && tab === 'fresh' && (
            <>
              {' '}
              <Link to={`/kitchen/fresh-receipts?date=${date}&campusId=${campusId}`}>Đi tới kiểm nhận hàng hôm nay</Link>
            </>
          )}
          {signed && ` · Ký bởi ${sig.signedByName} lúc ${formatDateTime(sig.signedAt)}`}
        </div>
        <ApprovalNotice approval={approval} />
        <div className="kr-card__actions">
          {/* Mẫu rỗng vẫn xem được ở chế độ chỉ đọc; chỉ khóa khi có quyền sửa mà chưa có dòng nào để điền */}
          <Button variant="primary" disabled={empty && data.canEdit} onClick={() => onOpen(tab)}>
            {data.canEdit ? 'Mở biểu mẫu' : 'Xem biểu mẫu'}
          </Button>
          {approval.canRequest && (
            <Button icon={Unlock} onClick={() => onRequest(tab)}>
              {approvalActionLabel(approval)}
            </Button>
          )}
          {canRevoke && <Button onClick={() => onRevoke(tab)}>Thu hồi quyền mở</Button>}
        </div>
      </div>
    </section>
  );
}

// M4 nhãn mẫu: không có biên bản riêng (INS-01), chỉ in/xuất từ dữ liệu sổ lưu mẫu M5 của ngày
function LabelCard({ sample, onPrint }) {
  const empty = !sample.rows.length;
  return (
    <section className="card kr-card">
      <div className="card__body kr-card__body">
        <div className="kr-card__top">
          <Printer size={20} className="muted" />
          <div className="kr-card__name">
            <h2 className="card__title">M4 · Nhãn mẫu thức ăn lưu</h2>
            <div className="text-sm muted">Chỉ in, lập từ sổ lưu mẫu M5</div>
          </div>
        </div>
        <p className="text-sm">Nhãn dán lên hộp mẫu thức ăn lưu, mỗi bữa một nhãn.</p>
        <div className="text-sm muted">{empty ? EMPTY_HINT.sample : `${sample.rows.length} mẫu từ sổ lưu mẫu`}</div>
        <div className="kr-card__actions">
          <Button variant="primary" icon={Printer} disabled={empty} onClick={onPrint}>
            In / xuất nhãn
          </Button>
        </div>
      </div>
    </section>
  );
}

/*
 * Kiểm thực ba bước M1–M3 (P-27): PHT điền bốn mẫu theo ngày và điểm trường, mở từng mẫu toàn màn hình như biểu mẫu giấy, lưu nháp
 * (tự lưu sau 20 giây) rồi ký bằng ảnh chữ ký khi đã chọn đủ Đạt / Không đạt. Mẫu đã ký bị khóa, "Sửa lại" cần lý do.
 * Món, bữa, số suất, nhà cung cấp, hạn dùng do hệ thống điền sẵn; bếp ghi lưu mẫu trên App. Quyền ghi theo cờ `canEdit` BE trả.
 * Ngày đã qua (INS-05): mẫu chỉ xem cho tới khi Hiệu trưởng duyệt mở; PHT gửi yêu cầu theo từng mẫu, Hiệu trưởng duyệt ở hàng chờ
 * đầu trang hoặc tự mở. Trạng thái khóa và hạn mở do BE trả, Web không tự tính từ ngày trên máy.
 */
export default function InspectionDayPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const campus = useStockCampus();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const open = INSPECTION_TAB_ORDER.includes(params.get('form')) ? params.get('form') : null;
  const day = useInspectionDay(campus.campusId, date);
  // Mẫu của ngày để biết còn bản chờ duyệt (khóa nút ký sổ M5)
  const samples = useFoodSamples(campus.campusId, date, date);
  const [forms, setForms] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [labelPrint, setLabelPrint] = useState(false);
  const [conflict, setConflict] = useState(null);
  // Hộp gửi yêu cầu mở mẫu ngày cũ / thu hồi quyền mở: { tab, mode: 'request' | 'revoke' } (INS-05)
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [savedAt, setSavedAt] = useState('');
  const stamps = useRef({});

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  // Nạp lại ô nhập của một mẫu khi mẫu đó có phiên bản mới từ BE (hoặc đổi ngày, điểm trường); mẫu khác giữ phần đang gõ
  useEffect(() => {
    if (!day.data) return;
    const updates = {};
    INSPECTION_TAB_ORDER.forEach((key) => {
      const stamp = `${day.data.campusId}|${day.data.date}|${day.data.tabs[key].version}`;
      if (stamps.current[key] === stamp) return;
      stamps.current[key] = stamp;
      updates[key] = toForm(key, day.data.tabs[key]);
    });
    if (Object.keys(updates).length) setForms((prev) => ({ ...prev, ...updates }));
  }, [day.data]);

  const dirtyOf = (key) => !!day.data && !!forms[key] && day.data.tabs[key].canEdit && isFormDirty(key, day.data.tabs[key], forms[key]);
  const anyDirty = INSPECTION_TAB_ORDER.some(dirtyOf);

  const refreshQuietly = async () => {
    try {
      await day.reload({ silent: true });
    } catch {
      // Nạp lại chỉ để cập nhật trạng thái khóa; lỗi mạng đã được báo ở thao tác vừa thất bại
    }
  };
  // BE từ chối vì ngày đã qua chưa được HT mở (INS-05; ví dụ quyền mở vừa hết hạn, bị thu hồi hoặc qua 00:00 khi đang sửa): báo lý do
  // và nạp lại trạng thái để mẫu chuyển sang chỉ xem; phần đang gõ giữ nguyên trên màn, không ghi đè
  const failWrite = async (err, title) => {
    toast.error(err, title);
    if (err.errorCode === INSPECTION_APPROVAL_REQUIRED) await refreshQuietly();
  };

  // `quiet` = tự lưu: không báo toast thành công, lỗi nhập thì để người dùng thấy ô được đánh dấu khi mở lại
  const saveTab = async (key, { quiet = false } = {}) => {
    const found = validateForm(key, forms[key]);
    setErrors(found);
    if (Object.keys(found).length) {
      if (!quiet) toast.error('Kiểm tra lại các ô được đánh dấu.', 'Chưa lưu được');
      return false;
    }
    setBusy(true);
    try {
      // `version` = phiên bản đang sửa: BE từ chối (409) nếu có người lưu trước thay vì ghi đè
      await day.save(key, { ...formToRequest(key, forms[key]), version: day.data.tabs[key].version });
      await day.reload({ silent: true });
      setSavedAt(clockOf());
      if (!quiet) toast.success('Đã lưu nháp.');
      return true;
    } catch (err) {
      // 409: có người lưu hoặc ký mẫu này trước (BE kiểm phiên bản) — hỏi tải bản mới, không ghi đè và không thử lại liên tục.
      // Cùng 409 nhưng mã 6116 là ngày cũ chưa được HT mở, không phải xung đột phiên bản
      if (err.errorCode === INSPECTION_APPROVAL_REQUIRED) await failWrite(err, 'Chưa lưu được');
      else if (err.status === 409) setConflict(key);
      else {
        if (err.details) setErrors(err.details);
        toast.error(err, 'Chưa lưu được');
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Tải bản mới của mẫu bị xung đột: phiên bản đổi nên ô nhập tự nạp lại từ BE (bỏ phần chưa lưu)
  const reloadConflict = async () => {
    const key = conflict;
    setConflict(null);
    stamps.current[key] = '';
    await day.reload({ silent: true });
  };

  // Tự lưu nháp khi mẫu đang mở có thay đổi và im lặng 20 giây; đang hỏi xung đột thì dừng để không báo lặp
  const autosave = useRef(null);
  autosave.current = () => open && !conflict && dirtyOf(open) && !busy && saveTab(open, { quiet: true });
  useEffect(() => {
    if (!open || !day.data || !forms[open]) return undefined;
    const timer = setTimeout(() => autosave.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [open, forms, day.data]);

  const signTab = async (key, signature) => {
    if (dirtyOf(key) && !(await saveTab(key, { quiet: true }))) return false;
    setBusy(true);
    try {
      await day.sign(key, signature);
      await day.reload({ silent: true });
      toast.success('Đã ký xác nhận.');
      return true;
    } catch (err) {
      await failWrite(err, 'Chưa ký được');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reopenTab = async (key, reason) => {
    setBusy(true);
    try {
      await day.reopen(key, reason);
      await day.reload({ silent: true });
      toast.success('Đã mở khóa. Sửa xong thì ký lại.');
      return true;
    } catch (err) {
      await failWrite(err, 'Chưa mở khóa được');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Ngày cũ (INS-05): PHT gửi yêu cầu chờ HT duyệt, HT gửi thì mở ngay; sau đó nạp lại để thẻ và biểu mẫu theo trạng thái BE trả
  const requestApproval = async (tab, input) => {
    setBusy(true);
    try {
      const result = await day.requestApproval(tab, input);
      await refreshQuietly();
      toast.success(result.selfOpened ? 'Đã mở mẫu để sửa. Sửa xong thì ký.' : 'Đã gửi yêu cầu, chờ Hiệu trưởng duyệt.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa gửi được yêu cầu');
      // 409: mẫu đã có yêu cầu chờ hoặc đang mở ở nơi khác ⇒ nạp lại cho thẻ hiện đúng trạng thái
      await refreshQuietly();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const revokeApproval = async (tab, { note }) => {
    setBusy(true);
    try {
      await day.decide(day.data.tabs[tab].approval.id, 'revoke', { note });
      await refreshQuietly();
      toast.success('Đã thu hồi quyền mở. Mẫu về chỉ xem.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa thu hồi được');
      await refreshQuietly();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    for (const key of INSPECTION_TAB_ORDER) {
      if (dirtyOf(key) && !(await saveTab(key, { quiet: true }))) return false;
    }
    return true;
  };
  const guard = useLeaveGuard({ when: anyDirty && !busy, onSave: saveAll });

  const openForm = (key) => {
    setErrors({});
    setSavedAt('');
    setParam('form', key);
  };
  // Đóng mẫu: còn sửa dở thì thử lưu nháp luôn; lưu không được (ô nhập sai) mới hỏi bỏ thay đổi
  const requestClose = async () => {
    if (open && dirtyOf(open) && !(await saveTab(open, { quiet: true }))) {
      setConfirmClose(true);
      return;
    }
    setParam('form', '');
  };
  const discardAndClose = () => {
    setForms((prev) => ({ ...prev, [open]: toForm(open, day.data.tabs[open]) }));
    setErrors({});
    setConfirmClose(false);
    setParam('form', '');
  };

  const update = (fn) => setForms((prev) => ({ ...prev, [open]: fn(prev[open]) }));
  const clearError = (key) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const handlers = {
    onField: (rowKey, column, value) => {
      update((form) => ({ ...form, rows: { ...form.rows, [rowKey]: { ...form.rows[rowKey], [column]: value } } }));
      clearError(`${rowKey}.${column}`);
    },
    onHeader: (field, value) => {
      update((form) => ({ ...form, header: { ...form.header, [field]: value } }));
      // Ngày và giờ gõ riêng nhưng báo lỗi chung ở "Thời gian kiểm tra"
      clearError(field.startsWith('checked') ? 'header.checkedAt' : `header.${field}`);
    },
    onCopyDown: (rowKey, column) => rowKey && update((form) => copyDown(form, rowKey, column)),
    onFillRange: (column, fromKey, toKey) => update((form) => fillRange(form, column, fromKey, toKey)),
    onTick: (rowKey, col, value) => update((form) => toggleCell(form, rowKey, col, value)),
    onTickAll: (col, value) => update((form) => toggleColumn(form, col, value)),
    onFillRows: (colKey, value, rowKeys) => update((form) => fillRows(form, colKey, value, rowKeys)),
    onApplySupplier: (supplier, onlyEmpty) => update((form) => applySupplier(form, supplier, onlyEmpty)),
  };

  const campusName = campus.campuses.find((c) => String(c.id) === String(campus.campusId))?.name;
  const campusNameOf = (id) => campus.campuses.find((c) => String(c.id) === String(id))?.name || 'Điểm trường';
  // Từ hàng chờ của HT sang đúng ngày và điểm trường của yêu cầu; một lần đổi tham số để không ghi đè nhau
  const openApprovalDay = (item) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', item.date);
        if (campus.canPick) next.set('campusId', String(item.campusId));
        next.delete('form');
        return next;
      },
      { replace: true },
    );

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId) body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường." />;
  else if (day.error) body = <ErrorState error={day.error} onRetry={day.reload} />;
  else if (day.loading || !day.data || INSPECTION_TAB_ORDER.some((key) => !forms[key])) body = <LoadingState />;
  else
    body = (
      <>
        {day.data.canDecide && (
          <InspectionApprovalQueue campusNameOf={campusNameOf} onOpenDay={openApprovalDay} onDecided={refreshQuietly} />
        )}
        <div className="kr-cards">
          {INSPECTION_TAB_ORDER.map((key) => (
            <FormCard
              key={key}
              tab={key}
              data={day.data.tabs[key]}
              date={date}
              campusId={campus.campusId}
              onOpen={openForm}
              onRequest={(tab) => setApprovalDialog({ tab, mode: 'request' })}
              onRevoke={(tab) => setApprovalDialog({ tab, mode: 'revoke' })}
            />
          ))}
          <LabelCard sample={day.data.tabs.sample} onPrint={() => setLabelPrint(true)} />
        </div>
      </>
    );

  const openData = open && day.data ? day.data.tabs[open] : null;

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.inspections)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kiểm thực ba bước</h1>
          <p className="muted text-sm">
            Chọn một mẫu để điền theo Quyết định 1246/QĐ-BYT. Món, bữa, số suất, nhà cung cấp và hạn dùng được điền sẵn; bếp ghi lưu mẫu
            thức ăn trên App.
          </p>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(next) => setParam('date', next)} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
      </div>
      {body}
      {openData && forms[open] && (
        <InspectionFormModal
          tab={open}
          date={date}
          campusName={campusName}
          data={openData}
          form={forms[open]}
          errors={errors}
          dirty={dirtyOf(open)}
          busy={busy}
          savedAt={savedAt}
          missing={rowsMissing(open, forms[open])}
          missingAction={actionsMissing(open, forms[open])}
          sampleData={day.data.tabs.sample}
          pendingSamples={pendingSampleCount(samples.data)}
          onClose={requestClose}
          onSave={() => saveTab(open)}
          onSaveQuiet={() => saveTab(open, { quiet: true })}
          onSign={(signature) => signTab(open, signature)}
          onReopen={(reason) => reopenTab(open, reason)}
          {...handlers}
        />
      )}
      <ConfirmationModal
        open={confirmClose}
        title="Bỏ thay đổi chưa lưu?"
        message="Có ô nhập chưa đúng nên chưa lưu nháp được. Đóng bây giờ sẽ mất phần đã sửa."
        confirmLabel="Bỏ thay đổi"
        danger
        onConfirm={discardAndClose}
        onClose={() => setConfirmClose(false)}
      />
      <ConfirmationModal
        open={!!conflict}
        title="Mẫu này vừa được người khác thay đổi"
        message="Có người vừa lưu hoặc ký mẫu này nên bản của bạn không còn mới nhất. Tải bản mới sẽ bỏ các thay đổi chưa lưu; chọn Giữ lại nếu cần chép phần đã gõ trước."
        confirmLabel="Tải bản mới"
        cancelLabel="Giữ lại"
        danger
        onConfirm={reloadConflict}
        onClose={() => setConflict(null)}
      />
      {day.data && approvalDialog?.mode === 'request' && (
        <ApprovalRequestDialog
          tab={approvalDialog.tab}
          date={date}
          selfOpen={day.data.tabs[approvalDialog.tab].approval.canSelfOpen}
          busy={busy}
          onConfirm={(input) => requestApproval(approvalDialog.tab, input)}
          onClose={() => setApprovalDialog(null)}
        />
      )}
      {day.data && approvalDialog?.mode === 'revoke' && (
        <ApprovalDecisionDialog
          mode="revoke"
          context={{ tab: approvalDialog.tab, date, ...day.data.tabs[approvalDialog.tab].approval }}
          busy={busy}
          onConfirm={(input) => revokeApproval(approvalDialog.tab, input)}
          onClose={() => setApprovalDialog(null)}
        />
      )}
      {labelPrint && day.data && (
        <InspectionPrintDialog
          tab="sample"
          date={date}
          campusName={campusName}
          data={day.data.tabs.sample}
          sampleData={day.data.tabs.sample}
          initialVariant="label"
          onClose={() => setLabelPrint(false)}
        />
      )}
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
