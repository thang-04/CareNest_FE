import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Printer, Send, CheckCircle2, Eye, List } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTransferWizard, WIZARD_STEPS } from '@/hooks/facility-transfer/useTransferWizard';
import { createTransfer, updateTransfer, submitTransfer, resubmitTransfer } from '@/services/facility-transfer/transferService';
import { hasErrors, firstError } from '@/utils/facility-transfer/transferValidation';
import { buildPrintModel } from '@/utils/facility-transfer/printModel';
import { Stepper } from '@/components/ui/Stepper';
import { StepGeneralInfo } from '@/components/facility-transfer/wizard/StepGeneralInfo';
import { StepSelectAssets } from '@/components/facility-transfer/wizard/StepSelectAssets';
import { StepAssignUsers } from '@/components/facility-transfer/wizard/StepAssignUsers';
import { StepReview } from '@/components/facility-transfer/wizard/StepReview';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { PrintPreview } from '@/components/facility-transfer/PrintPreview';
import { TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import '@/styles/modules/facility-transfer.css';

/**
 * Shared 4-step wizard.
 * mode: 'create' (new) | 'draft' (edit a saved draft) | 'revise' (fix after a revision request).
 */
export function TransferWizard({ mode, initialForm, md, transferId, lockedCode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const wizard = useTransferWizard({ initialForm, md });
  const { form, step, next, back, goTo, findInvalidStep, setErrors, validateStep } = wizard;

  const [draftId, setDraftId] = useState(transferId || null);
  const [code, setCode] = useState(lockedCode || '');
  const [saving, setSaving] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sent, setSent] = useState(null);
  const [changeNote, setChangeNote] = useState('');

  const payload = () => ({ ...form, changeNote });

  const saveDraft = async () => {
    setSaving(true);
    try {
      const saved = draftId ? await updateTransfer(draftId, payload(), user) : await createTransfer(payload(), user);
      setDraftId(saved.id);
      setCode(saved.code);
      toast.success(`Đã lưu nháp phiếu ${saved.code}`);
    } catch (err) {
      toast.error(err.message, 'Không lưu được nháp');
    } finally {
      setSaving(false);
    }
  };

  const askSend = () => {
    const invalid = findInvalidStep();
    if (invalid >= 0) {
      goTo(invalid);
      setErrors(validateStep(invalid));
      toast.error(firstError(validateStep(invalid)), `Bước ${invalid + 1} chưa hợp lệ`);
      return;
    }
    const all = validateStep(3);
    if (hasErrors(all)) {
      setErrors(all);
      toast.error(firstError(all));
      return;
    }
    setConfirmSend(true);
  };

  const send = async () => {
    try {
      const result = mode === 'revise' ? await resubmitTransfer(draftId, payload(), user) : await submitTransfer(draftId, payload(), user);
      setConfirmSend(false);
      setSent(result);
      toast.success(
        mode === 'revise' ? `Đã gửi lại phiếu ${result.code} (phiên bản ${result.version})` : `Đã gửi phiếu ${result.code}`,
        'Gửi phiếu thành công',
      );
    } catch (err) {
      setConfirmSend(false);
      toast.error(err.message, 'Gửi phiếu thất bại');
      if (err.details) setErrors(err.details);
    }
  };

  const previewModel = buildPrintModel(
    {
      ...form,
      code: code || '',
      status: mode === 'revise' ? TRANSFER_STATUS.REVISION_REQUESTED : TRANSFER_STATUS.DRAFT,
      createdBy: user.id,
      signatures: [],
    },
    md,
    { url: form.creatorSignatureUrl, name: user.fullName },
  );

  const sentModel = sent ? buildPrintModel(sent, md) : null;
  const canDraft = mode !== 'revise';

  return (
    <>
      <div className="card stepper-card">
        <Stepper steps={WIZARD_STEPS} current={step} maxReached={wizard.maxReached} onStepClick={goTo} />
      </div>

      {step === 0 && <StepGeneralInfo wizard={wizard} md={md} user={user} lockedCode={code} />}
      {step === 1 && <StepSelectAssets wizard={wizard} md={md} transferId={draftId} />}
      {step === 2 && <StepAssignUsers wizard={wizard} md={md} />}
      {step === 3 && (
        <StepReview wizard={wizard} md={md} lockedCode={code} mode={mode} changeNote={changeNote} onChangeNote={setChangeNote} />
      )}

      <div className="page-actions wizard-actions">
        {step === 0 ? (
          <button className="btn wizard-actions__back" onClick={() => setConfirmLeave(true)}>
            Hủy
          </button>
        ) : (
          <button className="btn wizard-actions__back" onClick={back}>
            Quay lại
          </button>
        )}
        <div className="row" style={{ gap: 10 }}>
          {canDraft && (
            <button className="btn" onClick={saveDraft} disabled={saving}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu nháp
            </button>
          )}
          {step === 3 && (
            <button className="btn btn--outline-primary" onClick={() => setPreview(true)}>
              <Printer size={16} /> In phiếu ngay
            </button>
          )}
          {step < 3 ? (
            <button className="btn btn--primary btn--lg" onClick={next}>
              Tiếp theo <ArrowRight size={17} />
            </button>
          ) : (
            <button className="btn btn--primary btn--lg" onClick={askSend}>
              <Send size={16} /> {mode === 'revise' ? 'Gửi lại phiếu đã điều chỉnh' : 'Gửi phiếu luân chuyển'} <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={confirmSend}
        title={mode === 'revise' ? 'Gửi lại phiếu đã điều chỉnh?' : 'Gửi phiếu luân chuyển?'}
        message={
          mode === 'revise'
            ? 'Phiếu sẽ được tạo phiên bản mới, lịch sử phiên bản cũ vẫn được giữ. Người bàn giao sẽ kiểm tra lại và xác nhận.'
            : `Phiếu sẽ chuyển sang trạng thái "Chờ bàn giao" và gửi thông báo cho ${md.userById(form.handoverUserId)?.fullName}. Sau khi gửi bạn không thể sửa trừ khi người bàn giao yêu cầu điều chỉnh.`
        }
        confirmLabel={mode === 'revise' ? 'Gửi lại phiếu' : 'Gửi phiếu'}
        onConfirm={send}
        onClose={() => setConfirmSend(false)}
      />

      <ConfirmationModal
        open={confirmLeave}
        title="Rời khỏi trang tạo phiếu?"
        message="Các thông tin chưa lưu nháp sẽ bị mất."
        confirmLabel="Rời khỏi"
        cancelLabel="Ở lại"
        danger
        onConfirm={() => navigate('/facility/transfers')}
        onClose={() => setConfirmLeave(false)}
      />

      <Modal open={preview === true} title="Xem trước phiếu luân chuyển" onClose={() => setPreview(false)} size="xl">
        <div className="alert alert--warning mb-12 no-print">
          Phiếu chưa được gửi: bản in mang dấu “{previewModel.statusLabel}”, chữ ký người tạo là bản xem trước.
        </div>
        <PrintPreview model={previewModel} />
      </Modal>

      <Modal open={!!sent && !preview} onClose={() => navigate('/facility/transfers')} closeOnBackdrop={false}>
        {sent && (
          <div className="success-modal">
            <div className="success-modal__icon">
              <CheckCircle2 size={44} />
            </div>
            <h2>{mode === 'revise' ? 'Đã gửi lại phiếu thành công' : 'Đã gửi phiếu thành công'}</h2>
            <p className="text-2">
              Phiếu <b>{sent.code}</b> đang ở trạng thái <b>Chờ bàn giao</b>.<br />
              Đã gửi thông báo cho {md.userById(sent.handoverUserId)?.fullName}.
            </p>
            <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setPreview('sent')}>
                <Printer size={16} /> In phiếu
              </button>
              <button className="btn btn--outline-primary" onClick={() => navigate(`/facility/transfers/${sent.id}`)}>
                <Eye size={16} /> Xem chi tiết
              </button>
              <button className="btn btn--primary" onClick={() => navigate('/facility/transfers')}>
                <List size={16} /> Về danh sách
              </button>
            </div>
          </div>
        )}
      </Modal>
      {sentModel && (
        <Modal open={preview === 'sent'} title={`In phiếu ${sent.code}`} onClose={() => setPreview(false)} size="xl">
          <PrintPreview model={sentModel} />
        </Modal>
      )}
    </>
  );
}
