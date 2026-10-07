import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Save, ShieldCheck, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { HealthDeclarationFields } from '@/components/children/HealthDeclarationFields';
import { confirmAllergies, saveHealthDeclaration } from '@/services/children/childrenService';
import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';
import { hasErrors, validateDeclaration } from '@/utils/children/childrenValidation';
import { canConfirmAllergies, canDeclareHealth } from '@/utils/children/childrenPermissions';
import { emptyDeclaration } from '@/utils/children/childrenHelpers';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const HISTORY_LABELS = {
  DECLARED: 'Khai báo khi tiếp nhận',
  UPDATED: 'Cập nhật khai báo',
  ALLERGY_CONFIRMED: 'Hiệu trưởng xác nhận dị ứng',
};

export default function HealthDeclarationPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [editing, setEditing] = useState(false);
  const { detail, loading, error, reload } = useChildDetail(id, { live: !editing });
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const child = detail?.child;
  const crumbs = childrenCrumbs(childCrumb(child), 'Khai báo sức khỏe');

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !child)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error} onRetry={reload} />
      </div>
    );

  const { declaration } = detail;
  const canEdit = canDeclareHealth(child, user);
  const canConfirm =
    canConfirmAllergies(child, user) &&
    declaration &&
    declaration.allergies.state !== DECLARATION_STATE.NOT_PROVIDED &&
    !declaration.allergyConfirmation;
  const needsReason = !!declaration?.allergyConfirmation;

  const startEdit = () => {
    const d = declaration || emptyDeclaration();
    setForm({
      allergies: { ...d.allergies, items: [...d.allergies.items] },
      diet: { ...d.diet },
      otherNotes: { ...(d.otherNotes || emptyDeclaration().otherNotes) },
    });
    setReason('');
    setErrors({});
    setEditing(true);
  };

  const save = async () => {
    const errs = validateDeclaration(form);
    if (needsReason && !reason.trim()) errs.reason = 'Nhập lý do thay đổi khai báo đã được xác nhận';
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      await saveHealthDeclaration(id, { declaration: form, reason }, user);
      toast.success('Đã lưu khai báo sức khỏe.');
      setEditing(false);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được khai báo');
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    try {
      await confirmAllergies(id, user);
      toast.success('Đã xác nhận thông tin dị ứng. Bếp sẽ dùng danh sách này cho suất ăn thay thế.');
      setConfirmOpen(false);
      reload({ silent: true });
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không xác nhận được');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Khai báo sức khỏe: {child.fullName}</h1>
        {!editing && (
          <div className="row" style={{ gap: 8 }}>
            {canEdit && (
              <button className={`btn ${canConfirm ? '' : 'btn--primary'}`} onClick={startEdit}>
                <Pencil size={16} /> {declaration ? 'Sửa khai báo' : 'Khai báo sức khỏe'}
              </button>
            )}
            {canConfirm && (
              <button className="btn btn--primary" onClick={() => setConfirmOpen(true)}>
                <ShieldCheck size={16} /> Xác nhận dị ứng
              </button>
            )}
          </div>
        )}
      </div>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Đây là thông tin phụ huynh cung cấp khi tiếp nhận, không phải kết quả khám hay chẩn đoán. Số đo chiều cao, cân nặng do giáo viên
          chủ nhiệm ghi ở <Link to={`/children/${child.id}/health`}>Sổ sức khỏe</Link>.
        </div>
      </div>

      {editing ? (
        <>
          <section className="card wizard-card">
            <HealthDeclarationFields
              value={form}
              onChange={(v) => {
                setForm(v);
                setErrors(({ reason: r }) => (r ? { reason: r } : {}));
              }}
              errors={errors}
            />
          </section>
          {needsReason && (
            <section className="card wizard-card">
              <FormField
                label="Lý do thay đổi"
                required
                error={errors.reason}
                hint="Khai báo đã được Hiệu trưởng xác nhận. Nếu đổi thông tin dị ứng, Hiệu trưởng cần xác nhận lại."
              >
                <textarea className="textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            </section>
          )}
          <div className="page-actions">
            <button className="btn wizard-actions__back" onClick={() => setEditing(false)} disabled={busy}>
              <ArrowLeft size={16} /> Hủy
            </button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>
              {busy ? <Spinner small /> : <Save size={16} />} Lưu khai báo
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thông tin khai báo</h2>
            </div>
            <div className="card__body">
              <DeclarationSummary
                declaration={declaration}
                confirmedAllergies={child.allergies}
                confirmedByName={declaration?.confirmedByName}
              />
            </div>
          </section>
          {declaration?.history?.length > 0 && (
            <section className="card mt-16">
              <div className="card__header">
                <h2 className="card__title">Lịch sử thay đổi</h2>
              </div>
              <div className="card__body">
                <ul className="history-list">
                  {[...declaration.history].reverse().map((h, i) => (
                    <li key={`${h.at}${i}`}>
                      <span className="history-list__dot" />
                      <div>
                        <div>{HISTORY_LABELS[h.action] || h.action}</div>
                        <div className="muted text-sm">
                          {md.userById(h.userId)?.fullName || '—'} · {formatDateTime(h.at)}
                          {h.note ? ` · Lý do: ${h.note}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <div className="page-actions">
            <Link className="btn" to={`/children/${child.id}`}>
              <ArrowLeft size={16} /> Về hồ sơ trẻ
            </Link>
          </div>
        </>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận thông tin dị ứng?"
        message={
          declaration?.allergies.state === DECLARATION_STATE.REPORTED
            ? `Xác nhận ${child.fullName} dị ứng: ${declaration.allergies.items.join(', ')}. Bếp sẽ chuẩn bị suất ăn thay thế theo danh sách này.`
            : `Xác nhận phụ huynh báo ${child.fullName} không có dị ứng thực phẩm.`
        }
        confirmLabel="Xác nhận dị ứng"
        onConfirm={doConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
