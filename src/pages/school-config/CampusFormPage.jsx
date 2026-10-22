import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useCampusDetail } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { deleteCampus, saveCampus } from '@/services/school-config/schoolConfigService';
import { canManageCampus } from '@/utils/school-config/schoolConfigPermissions';
import { validateCampus, hasErrors, errorsAfterChange, normalizePhone, CAMPUS_LIMITS } from '@/utils/school-config/schoolConfigValidation';
import { campusCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

const EMPTY = { code: '', name: '', shortName: '', address: '', phone: '', isMain: false };

function CampusForm({ campus, others, user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(() =>
    campus ? { ...EMPTY, ...campus, isMain: !!campus.isMain } : { ...EMPTY, isMain: others.length === 0 },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, CAMPUS_LIMITS));
  };
  const blurCheck = (field) => {
    const e = validateCampus(form, others);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
    else if (field === 'phone' && form.phone) setForm((f) => ({ ...f, phone: normalizePhone(f.phone) }));
  };

  const submit = async () => {
    const e = validateCampus(form, others);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const saved = await saveCampus(campus?.id || null, { ...form, phone: normalizePhone(form.phone) }, user);
      toast.success('Đã lưu thay đổi.', saved.shortName);
      navigate(`/school/campuses/${saved.id}`);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteCampus(campus.id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/school/campuses');
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <>
      <section className="card wizard-card">
        <h2 className="section-title">Thông tin điểm trường</h2>
        {errors._form && (
          <div className="alert alert--danger mb-12" role="alert">
            {errors._form}
          </div>
        )}
        <div className="grid-3">
          <FormField label="Mã điểm trường" required error={errors.code}>
            <input className="input" value={form.code} onChange={(e) => set({ code: e.target.value })} onBlur={() => blurCheck('code')} />
          </FormField>
          <FormField label="Tên ngắn" required error={errors.shortName} hint="Hiển thị trong menu, bảng">
            <input
              className="input"
              value={form.shortName}
              onChange={(e) => set({ shortName: e.target.value })}
              onBlur={() => blurCheck('shortName')}
            />
          </FormField>
          <FormField label="Số điện thoại" error={errors.phone}>
            <input
              className="input"
              value={form.phone}
              inputMode="numeric"
              onChange={(e) => set({ phone: e.target.value })}
              onBlur={() => blurCheck('phone')}
            />
          </FormField>
        </div>
        <FormField label="Tên đầy đủ" required error={errors.name} className="mt-12">
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => blurCheck('name')} />
        </FormField>
        <FormField label="Địa chỉ" required error={errors.address} className="mt-12">
          <input
            className="input"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            onBlur={() => blurCheck('address')}
          />
        </FormField>
        <div className="mt-16">
          <label className="checkbox">
            <input type="checkbox" checked={form.isMain} disabled={!!campus?.isMain} onChange={(e) => set({ isMain: e.target.checked })} />
            Điểm trường chính
          </label>
          <div className="field__hint">
            {campus?.isMain
              ? 'Trường luôn có đúng một điểm trường chính. Muốn đổi, hãy đánh dấu điểm trường khác là điểm trường chính.'
              : 'Đánh dấu điểm trường này là điểm trường chính sẽ bỏ dấu ở điểm trường chính hiện tại.'}
          </div>
          {errors.isMain && <span className="field__error">{errors.isMain}</span>}
        </div>
      </section>

      <div className="page-actions">
        <Link className="btn" to={campus ? `/school/campuses/${campus.id}` : '/school/campuses'}>
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <div className="row">
          {campus && !campus.isMain && (
            <button className="btn btn--outline-danger" onClick={() => setDeleting(true)} disabled={saving}>
              <Trash2 size={16} /> Xóa điểm trường
            </button>
          )}
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} {campus ? 'Lưu điểm trường' : 'Tạo điểm trường'}
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={deleting}
        title="Xóa điểm trường"
        message={
          <>
            Xóa điểm trường <b>{campus?.shortName}</b>? Điểm trường đã có lớp, nhân sự, phòng hoặc trẻ sẽ không xóa được.
          </>
        }
        confirmLabel="Xóa điểm trường"
        danger
        onConfirm={remove}
        error={deleteError}
        onClose={() => {
          setDeleting(false);
          setDeleteError('');
        }}
      />
    </>
  );
}

/** #21 Campus Form (UC 2.3 create / update / delete). Principal only. */
export default function CampusFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { schoolYear, yearReadOnly } = useSchoolYear();
  const md = useMasterData();
  const { detail, loading, error, reload } = useCampusDetail(id, schoolYear);
  const campus = detail?.campus;

  let body;
  if (!canManageCampus(user)) body = <ScNoAccess description="Chỉ Hiệu trưởng được tạo và sửa điểm trường." />;
  else if (yearReadOnly)
    body = <ScNoAccess description="Năm học đang chọn đã kết thúc, chỉ xem. Chọn năm đang hoạt động hoặc sắp diễn ra để sửa." />;
  else if (error || md.error) body = <ErrorState error={error || md.error} onRetry={id ? reload : md.reload} />;
  else if (md.loading || (id && loading)) body = <LoadingState />;
  else body = <CampusForm key={id || 'new'} campus={campus} others={md.campuses.filter((c) => c.id !== id)} user={user} />;

  return (
    <div className="page">
      <Breadcrumb items={campusCrumbs(id ? 'Sửa điểm trường' : 'Thêm điểm trường')} />
      <h1 className="page__title">{id ? `Sửa ${campus?.shortName || 'điểm trường'}` : 'Thêm điểm trường'}</h1>
      {body}
    </div>
  );
}
