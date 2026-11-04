import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useChildDetail, useCitizenIdAccounts } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { FormField } from '@/components/form/FormField';
import { ChildInfoFields } from '@/components/children/ChildInfoFields';
import { ChildProfileFields } from '@/components/children/ChildProfileFields';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { updateChild } from '@/services/children/childrenService';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { emptyChildProfile } from '@/models/children/childProfile';
import { hasErrors, validateChildInfo } from '@/utils/children/childrenValidation';
import { canEditChild } from '@/utils/children/childrenPermissions';
import { withGuardianAccounts } from '@/utils/children/childrenHelpers';
import { normalizeCitizenId } from '@/utils/citizenId';
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
  // Thêm phụ huynh có CCCD trùng tài khoản có sẵn ⇒ tự điền theo tài khoản, khóa; lưu thì liên kết (user chốt 2026-10-23).
  const accountOf = useCitizenIdAccounts((form?.guardians || []).map((g) => g.idNumber));

  useEffect(() => {
    if (detail?.child) {
      const c = detail.child;
      setForm({
        fullName: c.fullName,
        dateOfBirth: c.dateOfBirth,
        gender: c.gender,
        guardians: c.guardians.map((g) => ({
          fullName: g.fullName,
          relation: g.relation,
          phone: g.phone,
          idNumber: g.idNumber || '',
          email: g.email || '',
        })),
        profile: { ...emptyChildProfile(), ...c.profile, gestationWeeks: c.profile?.gestationWeeks ?? '' },
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
        <StatusPage
          kind="403"
          title="Bạn không có quyền sửa hồ sơ này"
          description="Chỉ Phó hiệu trưởng của điểm trường được sửa hồ sơ trẻ."
        />
      </div>
    );

  const withAccount = child.guardians.filter((g) => g.accountStatus && g.accountStatus !== PARENT_ACCOUNT_STATUS.NOT_ACTIVATED);
  // Phụ huynh đã có tài khoản: sửa được thông tin (tài khoản đổi theo, user chốt 2026-10-28) nhưng không xóa ở form.
  const accountPhones = withAccount.map((g) => g.phone);
  const accountIds = withAccount.filter((g) => g.idNumber).map((g) => normalizeCitizenId(g.idNumber));

  const effective = { ...form, guardians: withGuardianAccounts(form.guardians, accountOf) };

  const save = async () => {
    const errs = validateChildInfo(effective);
    if (!reason.trim()) errs.reason = 'Nhập lý do chỉnh sửa hồ sơ';
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const saved = await updateChild(id, { child: effective, reason }, user);
      // Đổi SĐT phụ huynh đã có tài khoản ⇒ BE đổi tên đăng nhập, gửi mật khẩu mới qua SMS (user chốt 2026-10-28).
      (saved.accountChanges || [])
        .filter((c) => c.phoneChanged)
        .forEach((c) =>
          c.smsStatus === 'FAILED'
            ? toast.warning(
                `Tên đăng nhập của ${c.fullName} đã đổi sang ${c.phone} nhưng chưa gửi được SMS mật khẩu; gửi lại ở màn Tài khoản phụ huynh.`,
              )
            : toast.success(`Tên đăng nhập của ${c.fullName} đổi sang ${c.phone}; mật khẩu tạm mới đã gửi qua SMS tới số này.`),
        );
      toast.success('Đã lưu thay đổi hồ sơ.');
      navigate(`/children/${id}`);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  const change = (v) => {
    setForm(v);
    const now = validateChildInfo({ ...v, guardians: withGuardianAccounts(v.guardians, accountOf) });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k === 'reason' || now[k])));
  };

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">Sửa hồ sơ: {child.fullName}</h1>
      <section className="card wizard-card">
        <ChildInfoFields
          value={form}
          onChange={change}
          errors={errors}
          accountGuardianPhones={accountPhones}
          accountGuardianIds={accountIds}
          accountOf={accountOf}
          childId={id}
        />
      </section>
      <section className="card wizard-card">
        <ChildProfileFields value={form.profile} onChange={(profile) => change({ ...form, profile })} errors={errors} />
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
