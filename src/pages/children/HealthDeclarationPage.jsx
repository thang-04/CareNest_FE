import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Save, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { HealthDeclarationFields } from '@/components/children/HealthDeclarationFields';
import { saveHealthDeclaration } from '@/services/children/childrenService';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';
import { hasErrors, validateDeclaration } from '@/utils/children/childrenValidation';
import { canDeclareHealth } from '@/utils/children/childrenPermissions';
import { emptyDeclaration } from '@/utils/children/childrenHelpers';
import { MEDICAL_HISTORY_ITEMS, emptyMedicalHistory, historyItemText } from '@/models/children/childProfile';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const HISTORY_LABELS = {
  DECLARED: 'Khai báo khi tiếp nhận',
  UPDATED: 'Cập nhật khai báo',
  ALLERGY_CONFIRMED: 'Hiệu trưởng xác nhận dị ứng',
  UPDATED_FROM_EXAM: 'Cập nhật tiền sử từ phiếu khám',
};

// Chỉ liệt kê mục tiền sử có thay đổi.
const historyChangeLines = (c) =>
  MEDICAL_HISTORY_ITEMS.map((it) => [it.label, historyItemText(it, c.from), historyItemText(it, c.to)]).filter(([, a, b]) => a !== b);

const allergyText = (a) =>
  !a ? 'Chưa có khai báo' : a.state === DECLARATION_STATE.REPORTED ? a.items.join(', ') : ALLERGY_STATE_LABELS[a.state];

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
  const navigate = useNavigate();
  // ?mode=edit (từ nút "Cập nhật khai báo" ở hồ sơ trẻ): mở thẳng form, Hủy/Lưu xong quay về hồ sơ
  const [params] = useSearchParams();
  const directEdit = params.get('mode') === 'edit';
  const autoOpened = useRef(false);

  const child = detail?.child;
  const crumbs = childrenCrumbs(childCrumb(child), 'Khai báo sức khỏe');

  const openEditor = (d = emptyDeclaration()) => {
    setForm({
      allergies: { ...d.allergies, items: [...d.allergies.items] },
      diet: { ...d.diet },
      otherNotes: { ...(d.otherNotes || emptyDeclaration().otherNotes) },
      medicalHistory: JSON.parse(JSON.stringify(d.medicalHistory || emptyMedicalHistory())),
    });
    setReason('');
    setErrors({});
    setEditing(true);
  };

  useEffect(() => {
    if (!directEdit || autoOpened.current || !detail?.child) return;
    autoOpened.current = true;
    if (canDeclareHealth(detail.child, user)) openEditor(detail.declaration || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directEdit, detail, user]);

  const leaveEditor = () => (directEdit ? navigate(`/children/${id}`) : setEditing(false));

  // Tránh nháy chế độ xem trước khi form tự mở
  const waitingEditor = directEdit && !autoOpened.current && !!child && canDeclareHealth(child, user);
  if (loading || waitingEditor)
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
  // Sửa khai báo đã có thì bắt buộc lý do; dữ liệu có hiệu lực ngay cho bếp.
  const needsReason = !!declaration;

  const startEdit = () => openEditor(declaration || undefined);

  const save = async () => {
    const errs = validateDeclaration(form);
    if (needsReason && !reason.trim()) errs.reason = 'Nhập lý do thay đổi khai báo';
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      await saveHealthDeclaration(id, { declaration: form, reason }, user);
      toast.success('Đã lưu khai báo sức khỏe.');
      reload({ silent: true });
      leaveEditor();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được khai báo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Khai báo sức khỏe: {child.fullName}</h1>
        {!editing && (
          <div className="row gap-2">
            {canEdit && (
              <button className="btn btn--primary" onClick={startEdit}>
                <Pencil size={16} /> {declaration ? 'Sửa khai báo' : 'Khai báo sức khỏe'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Đây là thông tin phụ huynh cung cấp khi tiếp nhận, không phải kết quả khám hay chẩn đoán. Kết quả khám (số đo, vận động) do giáo
          viên phụ trách lớp ghi ở <Link to={`/children/${child.id}/health`}>Sổ sức khỏe</Link>.
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
                hint="Thay đổi có hiệu lực ngay: bếp và điểm danh dùng thông tin dị ứng mới."
              >
                <textarea className="textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            </section>
          )}
          <div className="page-actions">
            <button className="btn wizard-actions__back" onClick={leaveEditor} disabled={busy}>
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
              <DeclarationSummary declaration={declaration} />
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
                          {h.note ? (h.action === 'UPDATED_FROM_EXAM' ? ` · ${h.note}` : ` · Lý do: ${h.note}`) : ''}
                        </div>
                        {h.historyChange &&
                          historyChangeLines(h.historyChange).map(([label, from, to]) => (
                            <div key={label} className="muted text-sm">
                              {label}: {from} → {to}
                            </div>
                          ))}
                        {h.allergyChange && (
                          <div className="muted text-sm">
                            Dị ứng: {allergyText(h.allergyChange.from)} → {allergyText(h.allergyChange.to)}
                          </div>
                        )}
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
    </div>
  );
}
