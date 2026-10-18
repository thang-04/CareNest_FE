import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Info, Lock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useHealthCheck } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ChildAccessState, HEALTH_CHECK_ACCESS_TEXT } from '@/components/children/ChildAccessState';
import { createHealthCheck, updateHealthCheck } from '@/services/children/healthCheckService';
import { CAMPAIGN_STATUS } from '@/models/children/healthCheckConstants';
import { todayInput } from '@/utils/format';
import { hasErrors, validateHealthCheck } from '@/utils/children/childrenValidation';
import { canManageHealthCheck } from '@/utils/children/childrenPermissions';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

// Gợi ý tên theo tháng của ngày bắt đầu; Hiệu trưởng sửa được.
const suggestName = (startDate) =>
  startDate ? `Khám sức khỏe định kỳ tháng ${Number(startDate.slice(5, 7))}/${startDate.slice(0, 4)}` : '';

const emptyForm = () => {
  const start = todayInput();
  return { name: suggestName(start), campusId: '', startDate: start, endDate: start, examiner: '', note: '' };
};

export default function HealthCheckFormPage() {
  const { campaignId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const editing = !!campaignId;
  const { detail, loading, error, reload } = useHealthCheck(campaignId, { live: false });
  const [form, setForm] = useState(emptyForm);
  const [nameTouched, setNameTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const campaign = detail?.campaign;
  useEffect(() => {
    if (campaign)
      setForm({
        name: campaign.name,
        campusId: campaign.campusId,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        examiner: campaign.examiner || '',
        note: campaign.note || '',
      });
  }, [campaign]);

  const title = editing ? 'Sửa đợt khám' : 'Tạo đợt khám';
  const crumbs = healthCheckCrumbs(campaign ? { label: campaign.name, to: `/children/health-checks/${campaign.id}` } : null, title);

  if (!canManageHealthCheck(user))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Bạn không tạo hoặc sửa được đợt khám"
            description="Chỉ Hiệu trưởng tạo, sửa, đóng đợt khám sức khỏe."
            action={
              <Link className="btn" to="/children/health-checks">
                <ArrowLeft size={16} /> Về danh sách đợt khám
              </Link>
            }
          />
        </div>
      </div>
    );
  if (editing && loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (editing && (error || !campaign))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error || { status: 404 }} onRetry={reload} text={HEALTH_CHECK_ACCESS_TEXT} />
      </div>
    );
  const locked = editing && [CAMPAIGN_STATUS.CLOSED, CAMPAIGN_STATUS.CANCELLED].includes(campaign.status);

  const set = (field, value) => {
    const next = { ...form, [field]: value };
    // Tên chưa sửa tay thì đi theo ngày bắt đầu
    if (field === 'startDate' && !editing && !nameTouched) next.name = suggestName(value);
    if (field === 'startDate' && next.endDate < value) next.endDate = value;
    if (field === 'name') setNameTouched(true);
    setForm(next);
    const nextErrors = validateHealthCheck(next);
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => nextErrors[k])));
  };
  const blur = (field) => {
    const e = validateHealthCheck(form)[field];
    if (e) setErrors((prev) => ({ ...prev, [field]: e }));
  };

  const save = async () => {
    const errs = validateHealthCheck(form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const saved = editing ? await updateHealthCheck(campaign.id, form, user) : await createHealthCheck(form, user);
      toast.success(editing ? 'Đã lưu thông tin đợt khám.' : 'Đã tạo đợt khám. Giáo viên của điểm trường đã nhận thông báo.');
      navigate(`/children/health-checks/${saved.id}`);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, editing ? 'Không lưu được đợt khám' : 'Không tạo được đợt khám');
    } finally {
      setBusy(false);
    }
  };

  const back = editing ? `/children/health-checks/${campaign.id}` : '/children/health-checks';

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">{title}</h1>
      {locked ? (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Đợt khám đã đóng hoặc đã hủy nên không sửa được thông tin.</div>
        </div>
      ) : (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Mỗi điểm trường chỉ có một đợt khám chưa đóng. Giáo viên phụ trách lớp nhập kết quả của trẻ trong khoảng ngày khám.</div>
        </div>
      )}
      <section className="card wizard-card">
        <div className="grid-2">
          <FormField label="Tên đợt khám" required error={errors.name} className="tr-span-2">
            <input
              className="input"
              maxLength={150}
              value={form.name}
              disabled={locked}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => blur('name')}
            />
          </FormField>
          <FormField
            label="Điểm trường"
            required
            error={errors.campusId}
            hint={editing ? 'Không đổi được điểm trường của đợt đã tạo.' : undefined}
          >
            <select
              className="select"
              value={form.campusId}
              disabled={editing}
              onChange={(e) => set('campusId', e.target.value)}
              onBlur={() => blur('campusId')}
            >
              <option value="">Chọn điểm trường</option>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Đơn vị khám / bác sĩ" error={errors.examiner} hint="Ví dụ: Trạm Y tế phường, bác sĩ khám định kỳ.">
            <input
              className="input"
              maxLength={150}
              value={form.examiner}
              disabled={locked}
              onChange={(e) => set('examiner', e.target.value)}
            />
          </FormField>
          <FormField label="Ngày bắt đầu khám" required error={errors.startDate}>
            <input
              type="date"
              className="input"
              value={form.startDate}
              disabled={locked}
              onChange={(e) => set('startDate', e.target.value)}
              onBlur={() => blur('startDate')}
            />
          </FormField>
          <FormField label="Ngày kết thúc khám" required error={errors.endDate}>
            <input
              type="date"
              className="input"
              value={form.endDate}
              min={form.startDate || undefined}
              disabled={locked}
              onChange={(e) => set('endDate', e.target.value)}
              onBlur={() => blur('endDate')}
            />
          </FormField>
        </div>
        <FormField label="Ghi chú" error={errors.note} className="mt-12" hint="Ví dụ: giáo viên có mặt cùng bác sĩ để ghi kết quả.">
          <textarea
            className="textarea"
            rows={2}
            maxLength={500}
            value={form.note}
            disabled={locked}
            onChange={(e) => set('note', e.target.value)}
          />
        </FormField>
      </section>
      <div className="page-actions">
        <Link className="btn wizard-actions__back" to={back}>
          <ArrowLeft size={16} /> Hủy
        </Link>
        {!locked && (
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <Spinner small /> : editing ? <Save size={16} /> : <Plus size={16} />} {editing ? 'Lưu thay đổi' : 'Tạo đợt khám'}
          </button>
        )}
      </div>
    </div>
  );
}
