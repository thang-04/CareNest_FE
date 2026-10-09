import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Info, Shapes, UserCog } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYearItem, useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { saveSchoolYear } from '@/services/school-config/schoolConfigService';
import { YEAR_ACTION_LABELS, YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureSchool, canEditYear } from '@/utils/school-config/schoolConfigPermissions';
import { validateSchoolYear, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { yearCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/school-config.css';

/** Suggest the year after the latest one so the Principal rarely has to type. */
const suggestNext = (years) => {
  const latest = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const from = latest ? Number(latest.name.slice(5)) : new Date().getFullYear();
  return { name: `${from}-${from + 1}`, startDate: `${from}-09-05`, endDate: `${from + 1}-05-31` };
};

function YearForm({ year, years, user }) {
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const others = years.filter((y) => y.id !== year?.id);
  const [form, setForm] = useState(() =>
    year ? { name: year.name, startDate: year.startDate, endDate: year.endDate } : suggestNext(years),
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const nameLocked = !!year && year.status !== YEAR_STATUS.PLANNED;

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const blurCheck = (field) => {
    const e = validateSchoolYear(form, others);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async () => {
    const e = validateSchoolYear(form, others);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const result = await saveSchoolYear(year?.id || null, form, user);
      toast.success('Đã lưu thay đổi.', `Năm học ${result.name}`);
      if (year) navigate('/school/years');
      else setSaved(result);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  };

  if (saved)
    return (
      <section className="card wizard-card">
        <h2 className="section-title">Đã tạo năm học {saved.name}</h2>
        <p className="text-2">Năm học ở trạng thái Sắp diễn ra. Bạn có thể cấu hình tiếp ngay hoặc quay lại sau:</p>
        <div className="row row--wrap mt-12">
          <Link className="btn" to={`/school/classes?year=${saved.id}`}>
            <Shapes size={16} /> Cấu hình nhóm tuổi & lớp
          </Link>
          <Link className="btn" to={`/school/vice-principals?year=${saved.id}`}>
            <UserCog size={16} /> Phân công Phó hiệu trưởng
          </Link>
          <Link className="btn btn--primary" to="/school/years">
            Về danh sách năm học
          </Link>
        </div>
      </section>
    );

  return (
    <>
      <section className="card wizard-card">
        <h2 className="section-title">Thông tin năm học</h2>
        <div className="grid-3">
          <FormField
            label="Tên năm học"
            required
            error={errors.name}
            hint={nameLocked ? 'Năm học đã bắt đầu nên không đổi tên được' : 'Dạng NNNN-NNNN, ví dụ 2027-2028'}
          >
            <input
              className="input"
              value={form.name}
              disabled={nameLocked}
              maxLength={9}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => blurCheck('name')}
            />
          </FormField>
          <FormField label="Ngày bắt đầu" required error={errors.startDate}>
            <input className="input" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </FormField>
          <FormField label="Ngày kết thúc" required error={errors.endDate}>
            <input
              className="input"
              type="date"
              min={form.startDate}
              value={form.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
              onBlur={() => blurCheck('endDate')}
            />
          </FormField>
        </div>
        {!year && (
          <div className="alert alert--info mt-16">
            <Info size={18} />
            <div>Năm học mới được lưu ở trạng thái Sắp diễn ra. Kích hoạt ở danh sách năm học khi bắt đầu năm học.</div>
          </div>
        )}
      </section>

      {year?.history?.length > 0 && (
        <section className="card wizard-card">
          <h2 className="section-title">Lịch sử thay đổi</h2>
          <ul className="sc-history">
            {[...year.history].reverse().map((h, i) => (
              <li key={i}>
                <span className="fw-600">{YEAR_ACTION_LABELS[h.action] || h.action}</span>
                <span className="muted text-sm">
                  {' '}
                  · {md.userById(h.userId)?.fullName || h.userId} · {formatDateTime(h.at)}
                </span>
                {h.note && <div className="text-sm text-2">{h.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="page-actions">
        <Link className="btn" to="/school/years">
          <ArrowLeft size={16} /> Quay lại
        </Link>
        <button className="btn btn--primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner small /> : <Save size={16} />} {year ? 'Lưu năm học' : 'Tạo năm học'}
        </button>
      </div>
    </>
  );
}

/** #17 School Year Form (UC 2.1 steps 3–7). */
export default function SchoolYearFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { years, loading: loadingYears, error: listError, reload } = useSchoolYears({ live: false });
  const { year, loading, error } = useSchoolYearItem(id, { live: false });
  const ready = !loadingYears && !loading;

  const title = id ? `Sửa năm học ${year?.name || ''}`.trim() : 'Thêm năm học';
  let body;
  if (!canConfigureSchool(user)) body = <ScNoAccess description="Chỉ Hiệu trưởng được tạo và sửa năm học." />;
  else if (error || listError) body = <ErrorState error={error || listError} onRetry={reload} />;
  else if (!ready) body = <LoadingState />;
  else if (id && !canEditYear(year, user)) body = <ScNoAccess description="Năm học đã kết thúc nên chỉ xem được, không sửa được." />;
  else body = <YearForm key={id || 'new'} year={year} years={years} user={user} />;

  return (
    <div className="page">
      <Breadcrumb items={yearCrumbs(id ? 'Sửa năm học' : 'Thêm năm học')} />
      <div className="row" style={{ gap: 12 }}>
        <h1 className="page__title">{title}</h1>
        {year && <YearStatusBadge status={year.status} size="lg" />}
      </div>
      {body}
    </div>
  );
}
