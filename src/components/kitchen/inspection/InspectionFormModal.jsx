import { useRef, useState } from 'react';
import { CheckCircle2, Lock, PenLine, Printer, Save, X } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { InspectionHistory, ReopenDialog, SupplierFillDialog } from '@/components/kitchen/inspection/InspectionDialogs';
import { InspectionStatusBadge } from '@/components/kitchen/inspection/InspectionBadges';
import { InspectionPrintDialog } from '@/components/kitchen/inspection/InspectionPrintDialog';
import { InspectionSheet } from '@/components/kitchen/inspection/InspectionSheet';
import { InspectionSignBoxes, InspectionSignDialog } from '@/components/kitchen/inspection/InspectionSignature';
import { useAuth } from '@/contexts/AuthContext';
import { INSPECTION_FORMS, INSPECTION_REQUIRED, INSPECTION_TAB_LABELS } from '@/models/kitchen/inspectionConstants';
import { hasValidSignature } from '@/utils/kitchen/inspectionForm';

/**
 * Biểu mẫu kiểm thực mở toàn màn hình: thanh trên có trạng thái, tiến độ cảm quan, Lưu nháp, Ký, Đóng (nút ghi ở đầu màn — DESIGN §8);
 * thân cuộn gồm khung biểu mẫu, ba ô ký và lịch sử. Mẫu đã ký bị khóa, "Sửa lại" cần lý do. Đóng khi còn sửa dở do trang xử lý (`onClose`).
 */
export function InspectionFormModal({
  tab,
  date,
  campusName,
  data,
  form,
  errors,
  dirty,
  busy,
  savedAt,
  missing,
  missingAction,
  sampleData,
  onClose,
  onSave,
  onSaveQuiet,
  onSign,
  onReopen,
  onApplySupplier,
  ...handlers
}) {
  const [signing, setSigning] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const { user } = useAuth() || {};
  const [printing, setPrinting] = useState(false);
  const rootRef = useRef(null);
  const meta = INSPECTION_FORMS[tab];
  const signed = hasValidSignature(data) && data.status === 'SIGNED';
  const total = data.rows.length;
  const editable = data.canEdit && !busy;

  // In / xuất luôn lấy bản đã lưu: còn sửa dở thì lưu nháp trước
  const openPrint = async () => {
    if (dirty && !(await onSaveQuiet())) return;
    setPrinting(true);
  };

  // Nhảy tới một dòng của bảng và đặt con trỏ vào ô cần nhập (ô tích đầu tiên, hoặc ô ghi chú)
  const jumpTo = (rowKey, selector) => {
    const row = [...(rootRef.current?.querySelectorAll('[data-row-key]') || [])].find((el) => el.dataset.rowKey === rowKey);
    row?.scrollIntoView({ block: 'center' });
    row?.querySelector(selector)?.focus();
  };
  const jumpToMissing = () => jumpTo(missing[0], 'input[type="checkbox"]');
  const jumpToMissingAction = () => jumpTo(missingAction[0], '[data-cell$=":note"]');
  const cannotSign = missing.length > 0 || missingAction.length > 0;
  const signHint = missing.length
    ? `Còn ${missing.length} dòng chưa chọn Đạt / Không đạt`
    : `Còn ${missingAction.length} dòng Không đạt chưa ghi biện pháp xử lý`;

  return (
    <Modal open size="full" label={INSPECTION_TAB_LABELS[tab]} onClose={onClose} closeOnBackdrop={false} className="kr-form-modal">
      <div className="kr-form" ref={rootRef}>
        <div className="kr-form__bar">
          <div className="kr-form__name">
            <div className="kr-form__title">{INSPECTION_TAB_LABELS[tab]}</div>
            <div className="text-sm muted">
              {meta.step} · {meta.hint}
            </div>
          </div>
          <InspectionStatusBadge status={data.status} />
          {data.canEdit &&
            total > 0 &&
            INSPECTION_REQUIRED[tab] &&
            (missing.length ? (
              <button
                type="button"
                className="chip chip--orange kr-progress"
                onClick={jumpToMissing}
                title="Bấm để tới dòng đầu tiên chưa chọn"
              >
                Cảm quan {total - missing.length}/{total} dòng · còn {missing.length}
              </button>
            ) : (
              <span className="chip chip--green kr-progress">
                <CheckCircle2 size={14} /> Đã chọn đủ cảm quan {total}/{total} dòng
              </span>
            ))}
          {data.canEdit && missingAction.length > 0 && (
            <button
              type="button"
              className="chip chip--orange kr-progress"
              onClick={jumpToMissingAction}
              title="Bấm để tới dòng Không đạt đầu tiên chưa ghi biện pháp xử lý (QĐ 1246)"
            >
              Không đạt chưa ghi biện pháp xử lý · {missingAction.length} dòng
            </button>
          )}
          {data.canEdit && savedAt && !dirty && <span className="text-xs muted">Đã lưu nháp lúc {savedAt}</span>}
          {data.canEdit && dirty && <span className="text-xs muted">Có thay đổi chưa lưu · tự lưu sau ít giây</span>}
          {signed && !data.canEdit && (
            <span className="text-sm muted kr-lock">
              <Lock size={14} /> Đã ký nên đang khóa
            </span>
          )}
          <div className="kr-form__actions">
            {data.canEdit && (
              <>
                <button type="button" className="btn" disabled={busy || !dirty} onClick={onSave}>
                  <Save size={16} /> Lưu nháp
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy || cannotSign}
                  title={cannotSign ? signHint : undefined}
                  onClick={() => setSigning(true)}
                >
                  <PenLine size={16} /> Ký xác nhận
                </button>
              </>
            )}
            {data.canReopen && (
              <button type="button" className="btn" disabled={busy} onClick={() => setReopening(true)}>
                <PenLine size={16} /> Sửa lại
              </button>
            )}
            <button type="button" className="btn" disabled={busy || total === 0} onClick={openPrint}>
              <Printer size={16} /> In / xuất
            </button>
            <button type="button" className="btn" onClick={onClose}>
              <X size={16} /> Đóng
            </button>
          </div>
        </div>
        <div className="kr-form__scroll">
          <InspectionSheet
            tab={tab}
            date={date}
            campusName={campusName}
            inspectorName={data.signature?.signedByName || user?.fullName || user?.name || ''}
            data={data}
            form={form}
            errors={errors}
            editable={editable}
            onSupplier={() => setSupplierOpen(true)}
            {...handlers}
          />
          <InspectionSignBoxes tab={tab} data={data} />
          <InspectionHistory history={data.history} />
        </div>
      </div>
      <InspectionSignDialog open={signing} busy={busy} onClose={() => setSigning(false)} onConfirm={onSign} />
      {supplierOpen && <SupplierFillDialog onApply={onApplySupplier} onClose={() => setSupplierOpen(false)} />}
      {printing && (
        <InspectionPrintDialog
          tab={tab}
          date={date}
          campusName={campusName}
          data={data}
          sampleData={sampleData}
          onClose={() => setPrinting(false)}
        />
      )}
      {reopening && <ReopenDialog busy={busy} onConfirm={onReopen} onClose={() => setReopening(false)} />}
    </Modal>
  );
}
