import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, CheckCircle2, Info, LineChart, FileCheck2, Stethoscope } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthRecord } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { FormField } from '@/components/form/FormField';
import { MeasurementSummary } from '@/components/children/MeasurementSummary';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { saveMeasurement } from '@/services/children/childrenService';
import { MEASUREMENT_SOURCE } from '@/models/children/childrenConstants';
import { EXAM_STATUS } from '@/models/children/healthExamForm';
import { ageLabel } from '@/models/School';
import { formatDate, todayInput } from '@/utils/format';
import { hasErrors, validateMeasurement } from '@/utils/children/childrenValidation';
import { canRecordMeasurement } from '@/utils/children/childrenPermissions';
import { childCrumb, childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const emptyForm = () => ({ date: todayInput(), heightCm: '', weightKg: '', headCircumferenceCm: '', note: '', reason: '' });

/**
 * Cân đo ngoài đợt khám (ví dụ tại lớp, không có bác sĩ): chỉ chiều cao, cân nặng, vòng đầu, ghi chú; không kết luận,
 * không mở phiếu theo dõi (user chốt 2026-10-17). Cũng dùng để sửa số đo của kết quả mẫu cũ. Kết quả trong đợt nhập ở phiếu khám.
 */
export default function HealthMeasurementFormPage() {
  const { id, measurementId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { record, loading, error, reload } = useHealthRecord(id, { live: false });
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  const existing = measurementId ? record?.measurements.find((m) => m.id === measurementId) : null;

  useEffect(() => {
    setForm(emptyForm());
    setErrors({});
    setSaved(null);
  }, [id, measurementId]);

  useEffect(() => {
    if (existing)
      setForm({
        date: existing.date,
        heightCm: String(existing.heightCm),
        weightKg: String(existing.weightKg),
        headCircumferenceCm: existing.headCircumferenceCm == null ? '' : String(existing.headCircumferenceCm),
        note: existing.note || '',
        reason: '',
      });
  }, [existing]);

  const child = record?.child;
  const title = measurementId ? 'Sửa số đo' : 'Nhập cân đo ngoài đợt';
  const crumbs = childrenCrumbs(childCrumb(child), child ? { label: 'Sổ sức khỏe', to: `/children/${child.id}/health` } : null, title);
  const backTo = `/children/${id}/health`;
  const backLink = (
    <Link className="btn" to={backTo}>
      <ArrowLeft size={16} /> Về sổ sức khỏe
    </Link>
  );

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
        <StatusPage
          kind="403"
          title="Bạn không nhập được số đo cho trẻ này"
          description="Chỉ giáo viên phụ trách lớp trẻ đang học được nhập hoặc sửa số đo."
          action={backLink}
        />
      </div>
    );
  if (measurementId && !existing)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={{ status: 404 }} />
      </div>
    );
  if (existing?.source === MEASUREMENT_SOURCE.EXAM)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <div className="card">
          <EmptyState
            icon={FileCheck2}
            title="Kết quả này là phiếu khám của đợt"
            description="Sửa phiếu khám ở trang phiếu khám; sửa phiếu đã có kết luận cần ghi lý do."
            action={
              <Link className="btn btn--primary" to={`/children/health-checks/${existing.campaignId}/exam/${child.id}`}>
                Mở phiếu khám
              </Link>
            }
          />
        </div>
      </div>
    );
  if (existing?.locked)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">{title}</h1>
        <StatusPage
          kind="403"
          title="Kết quả thuộc đợt khám đã đóng"
          description="Kết quả của đợt khám đã đóng bị khóa. Hiệu trưởng mở lại đợt nếu cần sửa."
          action={backLink}
        />
      </div>
    );

  const requireReason = !!existing?.published;
  const headUntil = record.rules?.headCircumferenceUntil;
  const rules = { dateOfBirth: child.dateOfBirth, requireReason, headCircumferenceUntil: headUntil };
  const headApplies = !headUntil || !form.date || form.date <= headUntil;
  const openCampaign = record.openCampaign;
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

  const save = async () => {
    const errs = validateMeasurement(form, rules);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      const m = await saveMeasurement(child.id, measurementId || null, form, user);
      setSaved(m);
      toast.success('Đã lưu số đo và công bố cho phụ huynh.');
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được số đo');
    } finally {
      setBusy(false);
    }
  };

  if (saved)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Số đo: {child.fullName}</h1>
        <section className="card wizard-card">
          <div className="row mb-12 gap-2">
            <CheckCircle2 size={20} className="text-success" />
            <h2 className="card__title">Đã lưu số đo ngày {formatDate(saved.date)}</h2>
          </div>
          <MeasurementSummary measurement={saved} />
          <div className="alert alert--success mt-16">
            <Send size={18} />
            <div>
              {requireReason
                ? 'Đã công bố lại bản mới cho phụ huynh; phụ huynh nhận thông báo kết quả đã cập nhật.'
                : 'Đã công bố cho phụ huynh khi lưu; phụ huynh nhận thông báo trên ứng dụng.'}{' '}
              {existing?.campaignId ? '' : 'Cân đo ngoài đợt khám không có kết luận của bác sĩ và không mở phiếu theo dõi.'}
            </div>
          </div>
        </section>
        <div className="page-actions">
          <div className="row gap-2">
            <button className="btn" onClick={() => setSaved(null)} disabled={busy}>
              <ArrowLeft size={16} /> Sửa lại
            </button>
            <Link className="btn" to={`/children/health-trends?childId=${child.id}`}>
              <LineChart size={16} /> Xem xu hướng
            </Link>
          </div>
          <Link className="btn btn--primary" to={backTo}>
            Về sổ sức khỏe
          </Link>
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
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {existing?.campaignId ? (
            <>Kết quả nhập theo mẫu cũ trong đợt khám: chỉ sửa được số đo và ghi chú.</>
          ) : (
            <>
              Cân đo <b>ngoài đợt khám</b> (ví dụ tại lớp, không có bác sĩ): không có kết luận, không mở phiếu theo dõi.
            </>
          )}{' '}
          Lưu là công bố cho phụ huynh ngay; phụ huynh xem được số đo và ghi chú trên ứng dụng.
        </div>
      </div>
      {!existing && openCampaign && openCampaign.resultStatus !== EXAM_STATUS.CONCLUDED && openCampaign.resultStatus !== 'LEGACY' && (
        <div className="alert alert--info mb-16">
          <Stethoscope size={18} />
          <div>
            Đợt <b>{openCampaign.name}</b> đang diễn ra. Khám cùng bác sĩ thì nhập{' '}
            <Link
              className="text-primary fw-600"
              to={`/children/health-checks/${openCampaign.id}/exam/${child.id}?classId=${child.classId}`}
            >
              phiếu khám của đợt
            </Link>
            .
          </div>
        </div>
      )}
      {requireReason && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>Số đo này đã công bố cho phụ huynh. Sửa cần ghi lý do; lưu là công bố lại và phụ huynh nhận thông báo cập nhật.</div>
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
              min={child.dateOfBirth}
              max={todayInput()}
              onChange={(e) => set('date', e.target.value)}
              onBlur={() => blur('date')}
            />
          </FormField>
          {headApplies ? (
            <FormField label="Vòng đầu (cm)" error={errors.headCircumferenceCm} hint="Không bắt buộc. Từ 30 đến 60 cm">
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
        <FormField label="Ghi chú" error={errors.note} hint="Ví dụ: cân đo tại lớp. Không ghi chẩn đoán." className="mt-12">
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
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <Spinner small /> : <Save size={16} />} Lưu số đo
        </button>
      </div>
    </div>
  );
}
