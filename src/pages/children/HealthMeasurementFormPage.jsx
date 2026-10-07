import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, Lock, CheckCircle2, Info, LineChart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { NutritionBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { publishMeasurement, saveMeasurement } from '@/services/children/childrenService';
import { NUTRITION_STATUS } from '@/models/children/childrenConstants';
import { ageLabel } from '@/models/School';
import { formatDate, todayInput } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { hasErrors, validateMeasurement } from '@/utils/children/childrenValidation';
import { canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

export default function HealthMeasurementFormPage() {
  const { id, measurementId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { record, loading, error, reload } = useHealthRecord(id, { live: false });
  const [form, setForm] = useState({ date: todayInput(), heightCm: '', weightKg: '', note: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  const existing = measurementId ? record?.measurements.find((m) => m.id === measurementId) : null;
  useEffect(() => {
    if (existing)
      setForm({
        date: existing.date,
        heightCm: String(existing.heightCm),
        weightKg: String(existing.weightKg),
        note: existing.note || '',
        reason: '',
      });
  }, [existing]);

  const child = record?.child;
  const title = measurementId ? 'Sửa số đo' : 'Nhập số đo';
  const crumbs = childrenCrumbs(childCrumb(child), child ? { label: 'Sổ sức khỏe', to: `/children/${child.id}/health` } : null, title);

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
            title="Bạn không nhập được số đo cho trẻ này"
            description="Chỉ giáo viên của lớp trẻ đang học được nhập hoặc sửa chiều cao, cân nặng."
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

  const requireReason = !!existing?.published;
  const rules = { dateOfBirth: child.dateOfBirth, requireReason };
  const set = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[field] && !validateMeasurement(next, rules)[field]) setErrors(({ [field]: _x, ...rest }) => rest);
  };
  const blur = (field) => {
    const e = validateMeasurement(form, rules)[field];
    if (e) setErrors((prev) => ({ ...prev, [field]: e }));
  };

  const save = async () => {
    const errs = validateMeasurement(form, rules);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const m = await saveMeasurement(child.id, measurementId || null, form, user);
      setSaved(m);
      toast.success('Đã lưu số đo.');
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được số đo');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      await publishMeasurement(child.id, saved.id, user);
      toast.success('Đã công bố kết quả cho phụ huynh.');
      navigate(`/children/${child.id}/health`);
    } catch (err) {
      toast.error(err.message, 'Không công bố được');
    } finally {
      setBusy(false);
    }
  };

  if (saved)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Kết quả đo: {child.fullName}</h1>
        <section className="card wizard-card">
          <div className="row mb-12" style={{ gap: 8 }}>
            <CheckCircle2 size={20} className="text-success" />
            <h2 className="card__title">Đã lưu số đo ngày {formatDate(saved.date)}</h2>
          </div>
          <div className="tr-metrics">
            <div>
              <div className="tr-metric__value">{formatNumber(saved.heightCm)}</div>
              <div className="muted text-sm">Chiều cao (cm)</div>
            </div>
            <div>
              <div className="tr-metric__value">{formatNumber(saved.weightKg)}</div>
              <div className="muted text-sm">Cân nặng (kg)</div>
            </div>
            <div>
              <div className="tr-metric__value">{formatNumber(saved.bmi)}</div>
              <div className="muted text-sm">BMI</div>
            </div>
          </div>
          <dl className="info-list mt-16">
            <dt>Tình trạng dinh dưỡng</dt>
            <dd>
              <NutritionBadge status={saved.nutritionStatus} />
              {saved.nutritionStatus === NUTRITION_STATUS.UNAVAILABLE && (
                <div className="muted text-sm mt-8">Chưa đủ dữ liệu tham chiếu để phân loại cho độ tuổi này. Số đo vẫn được lưu.</div>
              )}
            </dd>
          </dl>
          <div className="alert alert--info mt-16">
            <Info size={18} />
            <div>
              Kết quả tính theo quy tắc cố định, không phải chẩn đoán. Hãy xem lại số đo trước khi công bố. Nếu chưa công bố, phụ huynh chưa
              xem được kết quả này.
            </div>
          </div>
        </section>
        <div className="page-actions">
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setSaved(null)} disabled={busy}>
              <ArrowLeft size={16} /> Sửa lại số đo
            </button>
            <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
              <LineChart size={16} /> Xem xu hướng
            </Link>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn" to={`/children/${child.id}/health`}>
              Để sau, chưa công bố
            </Link>
            {!saved.published && (
              <button className="btn btn--primary" onClick={publish} disabled={busy}>
                {busy ? <Spinner small /> : <Send size={16} />} Công bố cho phụ huynh
              </button>
            )}
          </div>
        </div>
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
      {requireReason && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Kết quả này đã công bố cho phụ huynh. Sửa số đo cần ghi lý do, và kết quả mới cần được bạn công bố lại.</div>
        </div>
      )}
      <section className="card wizard-card">
        <div className="grid-3">
          <FormField label="Ngày đo" required error={errors.date}>
            <input
              type="date"
              className="input"
              value={form.date}
              min={child.dateOfBirth}
              max={todayInput()}
              onChange={(e) => set('date', e.target.value)}
              onBlur={() => blur('date')}
            />
          </FormField>
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
        <FormField
          label="Ghi chú khám"
          error={errors.note}
          hint="Thông tin khám có sẵn, ví dụ: răng miệng, mắt. Không ghi chẩn đoán."
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
        <Link className="btn wizard-actions__back" to={`/children/${child.id}/health`}>
          <ArrowLeft size={16} /> Hủy
        </Link>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <Spinner small /> : <Save size={16} />} Lưu số đo
        </button>
      </div>
    </div>
  );
}
