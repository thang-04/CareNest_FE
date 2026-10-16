import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, Lock, CheckCircle2, Info, LineChart, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { MeasurementSummary } from '@/components/children/MeasurementSummary';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { publishMeasurement, saveMeasurement } from '@/services/children/childrenService';
import {
  FOLLOW_UP_LEVEL,
  FOLLOW_UP_LEVEL_SHORT_LABELS,
  MOTOR_RESULT_LABELS,
  PARENT_VISIBLE_HEALTH_TEXT,
} from '@/models/children/childrenConstants';
import { CHILD_RESULT_STATUS } from '@/models/children/healthCheckConstants';
import { ageLabel } from '@/models/School';
import { formatDate, todayInput } from '@/utils/format';
import { hasErrors, validateMeasurement } from '@/utils/children/childrenValidation';
import { canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs, healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const emptyForm = () => ({
  date: todayInput(),
  heightCm: '',
  weightKg: '',
  headCircumferenceCm: '',
  grossMotor: '',
  fineMotor: '',
  note: '',
  reason: '',
});

const MOTOR_FIELDS = [
  { field: 'grossMotor', label: 'Vận động thô', hint: 'Ví dụ: đi, chạy, nhảy, giữ thăng bằng.' },
  { field: 'fineMotor', label: 'Vận động tinh', hint: 'Ví dụ: cầm bút, xếp hình, cài cúc.' },
];

function MotorField({ field, label, hint, value, error, onChange }) {
  return (
    <fieldset className="field tr-fieldset">
      <legend className="field__label">
        {label}
        <span className="req">*</span>
      </legend>
      <div className="tr-radio-row">
        {Object.entries(MOTOR_RESULT_LABELS).map(([k, text]) => (
          <label key={k} className="radio">
            <input type="radio" name={`tr-${field}`} value={k} checked={value === k} onChange={() => onChange(field, k)} />
            {text}
          </label>
        ))}
      </div>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        <span className="field__hint">{hint}</span>
      )}
    </fieldset>
  );
}

export default function HealthMeasurementFormPage() {
  const { id, measurementId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { record, loading, error, reload } = useHealthRecord(id, { live: false });
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const existing = measurementId ? record?.measurements.find((m) => m.id === measurementId) : null;
  // Nhập trong đợt khám: đợt phải là đợt đang diễn ra BE trả về cho điểm trường của trẻ.
  const campaignId = existing ? existing.campaignId : params.get('campaignId');
  const openCampaign = record?.openCampaign || null;
  const campaign = campaignId && openCampaign?.id === campaignId ? openCampaign : null;
  const classIdParam = params.get('classId') || '';
  const { roster } = useHealthCheckClass(campaign && classIdParam ? campaign.id : null, classIdParam);

  // Chuyển sang trẻ khác (nút "Lưu và nhập trẻ tiếp theo") thì bắt đầu form mới.
  useEffect(() => {
    setForm(emptyForm());
    setErrors({});
    setSaved(null);
    setConfirmPublish(false);
  }, [id, measurementId]);

  useEffect(() => {
    if (existing || !campaign) return;
    const today = todayInput();
    const last = campaign.endDate < today ? campaign.endDate : today;
    setForm((f) => ({ ...f, date: today < campaign.startDate ? campaign.startDate : last }));
  }, [existing, campaign]);

  useEffect(() => {
    if (existing)
      setForm({
        date: existing.date,
        heightCm: String(existing.heightCm),
        weightKg: String(existing.weightKg),
        headCircumferenceCm: existing.headCircumferenceCm == null ? '' : String(existing.headCircumferenceCm),
        grossMotor: existing.grossMotor || '',
        fineMotor: existing.fineMotor || '',
        note: existing.note || '',
        reason: '',
      });
  }, [existing]);

  const child = record?.child;
  const title = measurementId ? 'Sửa kết quả khám' : 'Nhập kết quả khám';
  const campaignLink = campaign ? `/children/health-checks/${campaign.id}${classIdParam ? `?classId=${classIdParam}` : ''}` : '';
  const crumbs = campaign
    ? healthCheckCrumbs({ label: campaign.name, to: campaignLink }, child ? `${title}: ${child.fullName}` : title)
    : childrenCrumbs(childCrumb(child), child ? { label: 'Sổ sức khỏe', to: `/children/${child.id}/health` } : null, title);
  const backTo = campaign ? campaignLink : `/children/${id}/health`;

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
  if (!canRecordMeasurement(child, user, record.cls))
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Bạn không nhập được kết quả khám cho trẻ này"
            description="Chỉ giáo viên phụ trách lớp trẻ đang học được nhập hoặc sửa kết quả khám."
            action={
              <Link className="btn" to={`/children/${id}/health`}>
                <ArrowLeft size={16} /> Về sổ sức khỏe
              </Link>
            }
          />
        </div>
      </div>
    );
  if (measurementId && !existing)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={{ status: 404 }} />
      </div>
    );
  if (campaignId && !campaign)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <div className="card">
          <EmptyState
            icon={Lock}
            title={existing ? 'Kết quả thuộc đợt khám đã đóng' : 'Đợt khám không còn mở để nhập kết quả'}
            description="Kết quả của đợt khám đã đóng bị khóa. Hiệu trưởng mở lại đợt nếu cần nhập hoặc sửa."
            action={
              <Link className="btn" to={`/children/${id}/health`}>
                <ArrowLeft size={16} /> Về sổ sức khỏe
              </Link>
            }
          />
        </div>
      </div>
    );

  const requireReason = !!existing?.published;
  const headUntil = record.rules?.headCircumferenceUntil;
  const rules = {
    dateOfBirth: child.dateOfBirth,
    requireReason,
    headCircumferenceUntil: headUntil,
    legacy: !!existing && existing.grossMotor == null,
    campaign: campaign ? { startDate: campaign.startDate, endDate: campaign.endDate } : undefined,
  };
  const today = todayInput();
  const minDate = campaign ? campaign.startDate : child.dateOfBirth;
  const maxDate = campaign && campaign.endDate < today ? campaign.endDate : today;
  const headApplies = !headUntil || !form.date || form.date <= headUntil;
  const set = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    const nextErrors = validateMeasurement(next, rules);
    setErrors((prev) => {
      const kept = { ...prev };
      Object.keys(kept).forEach((k) => {
        if (!nextErrors[k]) delete kept[k];
      });
      return kept;
    });
  };
  const blur = (field) => {
    const e = validateMeasurement(form, rules)[field];
    if (e) setErrors((prev) => ({ ...prev, [field]: e }));
  };

  // Trẻ tiếp theo chưa có kết quả trong lớp (theo thứ tự danh sách BE trả), bỏ qua trẻ đang nhập.
  const nextChildId = () => {
    const rows = roster?.children || [];
    const idx = rows.findIndex((r) => r.childId === child.id);
    const order = [...rows.slice(idx + 1), ...rows.slice(0, Math.max(idx, 0))];
    return order.find((r) => r.result === CHILD_RESULT_STATUS.NOT_RECORDED)?.childId || null;
  };

  const save = async (andNext = false) => {
    const errs = validateMeasurement(form, rules);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const m = await saveMeasurement(child.id, measurementId || null, { ...form, campaignId: campaign?.id || null }, user);
      if (andNext) {
        const message = `Đã lưu kết quả của ${child.fullName}: ${FOLLOW_UP_LEVEL_SHORT_LABELS[m.followUpLevel]}.`;
        if (m.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH) toast.warning(message);
        else toast.success(message);
        const next = nextChildId();
        if (next) navigate(`/children/${next}/health/new?campaignId=${campaign.id}&classId=${classIdParam}`);
        else {
          toast.info('Đã nhập xong các trẻ của lớp trong đợt khám.');
          navigate(campaignLink);
        }
        return;
      }
      setSaved(m);
      toast.success('Đã lưu kết quả khám.');
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được kết quả khám');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    try {
      await publishMeasurement(child.id, saved.id, user);
      toast.success('Đã công bố kết quả cho phụ huynh.');
      navigate(campaign ? campaignLink : `/children/${child.id}/health`);
    } catch (err) {
      toast.error(err.message, 'Không công bố được');
      setConfirmPublish(false);
    }
  };

  if (saved)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Kết quả khám: {child.fullName}</h1>
        <section className="card wizard-card">
          <div className="row mb-12 gap-2">
            <CheckCircle2 size={20} className="text-success" />
            <h2 className="card__title">Đã lưu kết quả ngày {formatDate(saved.date)}</h2>
          </div>
          <MeasurementSummary measurement={saved} />
          {saved.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH && (
            <div className="alert alert--warning mt-16">
              <AlertTriangle size={18} />
              <div>
                Trẻ ở mức <b>Cần theo dõi sát</b>. Hãy trao đổi với phụ huynh và đề nghị cho trẻ khám chuyên khoa, rồi ghi lại trong phiếu
                theo dõi.{' '}
                {saved.followUpId && (
                  <Link className="text-primary fw-600" to={`/children/health-follow-ups/${saved.followUpId}`}>
                    Mở phiếu theo dõi
                  </Link>
                )}
              </div>
            </div>
          )}
          <div className="alert alert--info mt-16">
            <Info size={18} />
            <div>
              Kết quả sàng lọc theo {saved.reference?.label || 'quy tắc của hệ thống'}, không phải chẩn đoán. Hãy xem lại trước khi công bố.
              Nếu chưa công bố, phụ huynh chưa xem được kết quả này.
            </div>
          </div>
        </section>
        <div className="page-actions">
          <div className="row gap-2">
            <button className="btn" onClick={() => setSaved(null)} disabled={busy}>
              <ArrowLeft size={16} /> Sửa lại kết quả
            </button>
            <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
              <LineChart size={16} /> Xem xu hướng
            </Link>
          </div>
          <div className="row gap-2">
            <Link className="btn" to={campaign ? campaignLink : `/children/${child.id}/health`}>
              {campaign ? 'Về đợt khám, chưa công bố' : 'Để sau, chưa công bố'}
            </Link>
            {!saved.published && (
              <button className="btn btn--primary" onClick={() => setConfirmPublish(true)}>
                <Send size={16} /> Công bố cho phụ huynh
              </button>
            )}
          </div>
        </div>
        <ConfirmationModal
          open={confirmPublish}
          title="Công bố kết quả cho phụ huynh?"
          message={`Phụ huynh của ${child.fullName} sẽ xem được ${PARENT_VISIBLE_HEALTH_TEXT} của ngày ${formatDate(saved.date)} và nhận thông báo trên ứng dụng.`}
          confirmLabel="Công bố kết quả"
          onConfirm={publish}
          onClose={() => setConfirmPublish(false)}
        />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">
        {title}: {child.fullName}
      </h1>
      <p className="muted mb-16">
        {child.code} · {child.className} · sinh ngày {formatDate(child.dateOfBirth)} ({ageLabel(child.dateOfBirth)})
      </p>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {campaign ? (
            <>
              Đợt khám: <b>{campaign.name}</b> ({formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}).
            </>
          ) : (
            <>
              Kết quả <b>ngoài đợt khám</b> (ví dụ cân đo tại lớp). Vẫn được phân loại và mở phiếu theo dõi như kết quả trong đợt.
              {openCampaign && !openCampaign.resultMeasurementId && (
                <>
                  {' '}
                  Đợt <b>{openCampaign.name}</b> đang diễn ra:{' '}
                  <Link className="text-primary" to={`/children/${id}/health/new?campaignId=${openCampaign.id}&classId=${child.classId}`}>
                    nhập trong đợt
                  </Link>
                  .
                </>
              )}
            </>
          )}
        </div>
      </div>
      {requireReason && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Kết quả này đã công bố cho phụ huynh. Sửa kết quả cần ghi lý do, và kết quả mới cần được bạn công bố lại.</div>
        </div>
      )}
      <section className="card wizard-card">
        <h2 className="card__title mb-12">Số đo</h2>
        <div className="grid-2">
          <FormField label="Ngày đo" required error={errors.date}>
            <input
              type="date"
              className="input"
              value={form.date}
              min={minDate}
              max={maxDate}
              onChange={(e) => set('date', e.target.value)}
              onBlur={() => blur('date')}
            />
          </FormField>
          {headApplies ? (
            <FormField label="Vòng đầu (cm)" required={!rules.legacy} error={errors.headCircumferenceCm} hint="Từ 30 đến 60 cm">
              <input
                type="number"
                className="input"
                inputMode="decimal"
                step="0.1"
                min="30"
                max="60"
                value={form.headCircumferenceCm}
                onChange={(e) => set('headCircumferenceCm', e.target.value)}
                onBlur={() => blur('headCircumferenceCm')}
              />
            </FormField>
          ) : (
            <div className="field">
              <span className="field__label">Vòng đầu (cm)</span>
              <p className="muted text-sm m-0">Trẻ trên 60 tháng tuổi tại ngày đo: không đo vòng đầu.</p>
            </div>
          )}
          <FormField label="Chiều cao (cm)" required error={errors.heightCm} hint="Từ 40 đến 150 cm">
            <input
              type="number"
              className="input"
              inputMode="decimal"
              step="0.1"
              min="40"
              max="150"
              value={form.heightCm}
              onChange={(e) => set('heightCm', e.target.value)}
              onBlur={() => blur('heightCm')}
            />
          </FormField>
          <FormField label="Cân nặng (kg)" required error={errors.weightKg} hint="Từ 3 đến 60 kg">
            <input
              type="number"
              className="input"
              inputMode="decimal"
              step="0.1"
              min="3"
              max="60"
              value={form.weightKg}
              onChange={(e) => set('weightKg', e.target.value)}
              onBlur={() => blur('weightKg')}
            />
          </FormField>
        </div>
      </section>
      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">Đánh giá vận động</h2>
        <p className="muted text-sm mb-12">Ghi theo kết quả bác sĩ đánh giá trong buổi khám.</p>
        <div className="grid-2">
          {MOTOR_FIELDS.map((f) => (
            <MotorField key={f.field} {...f} value={form[f.field]} error={errors[f.field]} onChange={set} />
          ))}
        </div>
        <FormField
          label="Ghi chú khám"
          error={errors.note}
          hint="Thông tin bác sĩ đã ghi khi khám, ví dụ: răng miệng, mắt. Ghi đúng lời bác sĩ, không tự ghi chẩn đoán."
          className="mt-12"
        >
          <textarea className="textarea" rows={2} maxLength={500} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </FormField>
        {requireReason && (
          <FormField label="Lý do sửa" required error={errors.reason} className="mt-12">
            <textarea
              className="textarea"
              rows={2}
              maxLength={300}
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              onBlur={() => blur('reason')}
            />
          </FormField>
        )}
      </section>
      <div className="page-actions">
        <Link className="btn wizard-actions__back" to={backTo}>
          <ArrowLeft size={16} /> Hủy
        </Link>
        <div className="row gap-2">
          {campaign && classIdParam && !measurementId ? (
            <>
              <button className="btn" onClick={() => save(false)} disabled={busy}>
                <Save size={16} /> Lưu và xem kết quả
              </button>
              <button className="btn btn--primary" onClick={() => save(true)} disabled={busy}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu và nhập trẻ tiếp theo
              </button>
            </>
          ) : (
            <button className="btn btn--primary" onClick={() => save(false)} disabled={busy}>
              {busy ? <Spinner small /> : <Save size={16} />} Lưu kết quả
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
