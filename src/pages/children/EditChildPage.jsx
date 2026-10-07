import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ChildInfoFields } from '@/components/children/ChildInfoFields';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { updateChild } from '@/services/children/childrenService';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { hasErrors, validateChildInfo } from '@/utils/children/childrenValidation';
import { canEditChild } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

export default function EditChildPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { detail, loading, error, reload } = useChildDetail(id, { live: false });
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (detail?.child) {
      const c = detail.child;
      setForm({
        fullName: c.fullName,
        dateOfBirth: c.dateOfBirth,
        gender: c.gender,
        guardians: c.guardians.map((g) => ({ fullName: g.fullName, relation: g.relation, phone: g.phone, email: g.email || '' })),
      });
    }
  }, [detail]);

  const child = detail?.child;
  const crumbs = childrenCrumbs(childCrumb(child), 'Sửa hồ sơ');

  if (loading || (!error && !form))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error} onRetry={reload} />
      </div>
    );
  if (!canEditChild(child, user))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Sửa hồ sơ trẻ</h1>
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Bạn không có quyền sửa hồ sơ này"
            description="Chỉ Phó hiệu trưởng của điểm trường được sửa hồ sơ trẻ."
          />
        </div>
      </div>
    );

  const lockedPhones = child.guardians
    .filter((g) => g.accountStatus && g.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED)
    .map((g) => g.phone);

  const save = async () => {
    const errs = validateChildInfo(form);
    if (!reason.trim()) errs.reason = 'Nhập lý do chỉnh sửa hồ sơ';
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      await updateChild(id, { child: form, reason }, user);
      toast.success('Đã lưu thay đổi hồ sơ.');
      navigate(`/children/${id}`);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">Sửa hồ sơ: {child.fullName}</h1>
      <section className="card wizard-card">
        <ChildInfoFields
          value={form}
          onChange={(v) => {
            setForm(v);
            const now = validateChildInfo(v);
            setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k === 'reason' || now[k])));
          }}
          errors={errors}
          lockedGuardianPhones={lockedPhones}
        />
      </section>
      <section className="card wizard-card">
        <FormField label="Lý do chỉnh sửa" required error={errors.reason} hint="Được lưu vào lịch sử thay đổi của hồ sơ">
          <textarea
            className="textarea"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setErrors(({ reason: _r, ...rest }) => rest);
            }}
          />
        </FormField>
      </section>
      <div className="page-actions">
        <button className="btn wizard-actions__back" onClick={() => navigate(`/children/${id}`)} disabled={busy}>
          <ArrowLeft size={16} /> Hủy
        </button>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <Spinner small /> : <Save size={16} />} Lưu thay đổi
        </button>
      </div>
    </div>
  );
}
