import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { getSchoolYearById, getSemesterLocks, saveSemester } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { SEMESTER_FIELDS, hasErrors, semesterOf, validateSemester } from '@/utils/school-config/schoolConfigValidation';
import { formatDate } from '@/utils/format';
import { suggestSemesters } from '@/utils/school-config/yearSetup';
import { canManageSchoolCalendar } from '@/utils/school-config/schoolConfigPermissions';

const ROWS = [
  { label: 'Học kỳ I', start: 'semester1Start', end: 'semester1End' },
  { label: 'Học kỳ II', start: 'semester2Start', end: 'semester2End' },
];
const LABELS = Object.fromEntries(SEMESTER_FIELDS);

/** Cấu hình thời gian › Học kỳ: Hiệu trưởng chọn ngày bắt đầu và kết thúc của HK I, HK II, trong khoảng năm học. */
/** onDirtyChange / saveRef: trang cha hỏi lưu khi đổi tab hoặc rời màn còn học kỳ chưa lưu. */
export function SemesterSetting({ yearId, onDirtyChange, saveRef }) {
  const { user } = useAuth();
  const toast = useToast();
  const {
    data: year,
    loading,
    error,
    reload,
  } = useAsync(() => getSchoolYearById(yearId, user), [yearId, user?.id], {
    enabled: !!yearId,
  });
  const { data: locks, reload: reloadLocks } = useAsync(() => getSemesterLocks(yearId, user), [yearId, user?.id], {
    enabled: !!yearId,
  });
  const [form, setForm] = useState(() => semesterOf(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Chưa đặt học kỳ: điền sẵn theo ngày bắt đầu/kết thúc năm học, Hiệu trưởng sửa rồi lưu
    setForm(year?.semester1Start ? semesterOf(year) : suggestSemesters(year?.startDate, year?.endDate) || semesterOf(year));
    setErrors({});
  }, [year]);
  const editableYear = !!year && year.status !== YEAR_STATUS.CLOSED && canManageSchoolCalendar(user);
  const dirty = editableYear && !SEMESTER_FIELDS.every(([k]) => form[k] === (year[k] || ''));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !year) return <LoadingState />;

  // Không có quyền cấu hình thời gian hoặc năm đã kết thúc: chỉ xem
  const closed = year.status === YEAR_STATUS.CLOSED || !canManageSchoolCalendar(user);
  const unchanged = SEMESTER_FIELDS.every(([k]) => form[k] === (year[k] || ''));

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _k, semester: _s, ...rest }) => rest);
  };
  const blurCheck = (key) => {
    const e = validateSemester(form, year);
    if (e[key]) setErrors((prev) => ({ ...prev, [key]: e[key] }));
  };

  const save = async () => {
    const e = validateSemester(form, year);
    if (!hasErrors(e) && unchanged) e.semester = 'Thời gian học kỳ chưa thay đổi';
    setErrors(e);
    if (hasErrors(e)) return false;
    setSaving(true);
    try {
      await saveSemester(yearId, form, user);
      toast.success('Đã lưu thời gian học kỳ.');
      reload({ silent: true });
      reloadLocks({ silent: true });
      return true;
    } catch (err) {
      setErrors(err.details || { semester: err.message });
      return false;
    } finally {
      setSaving(false);
    }
  };
  if (saveRef) saveRef.current = save;

  // Học kỳ đã có đánh giá học kỳ: khóa ô ngày ngay (BE vẫn kiểm khi lưu)
  const lockedKey = (key) => (key.startsWith('semester1') ? locks?.semester1Locked : locks?.semester2Locked);
  const dateCell = (key) =>
    closed || lockedKey(key) ? (
      formatDate(year[key])
    ) : (
      <FormField error={errors[key]}>
        <DateInput
          aria-label={LABELS[key]}
          min={year.startDate}
          max={year.endDate}
          value={form[key]}
          onChange={(v) => set(key, v)}
          onBlur={() => blurCheck(key)}
        />
      </FormField>
    );

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          Học kỳ năm học {year.name} ({formatDate(year.startDate)} – {formatDate(year.endDate)})
        </h2>
        {!closed && <span className="muted text-sm">Học kỳ đã có đánh giá học kỳ thì không đổi được ngày.</span>}
      </div>
      {(errors.semester || errors._form) && (
        <div className="card__body">
          <div className="alert alert--danger" role="alert">
            {errors.semester || errors._form}
          </div>
        </div>
      )}
      <div className="table-wrap sc-table-flat">
        <table className="table table--grid sc-semester">
          <thead>
            <tr>
              <th>Học kỳ</th>
              <th>Từ ngày</th>
              <th>Đến ngày</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="fw-600">
                  {r.label}
                  {!closed && lockedKey(r.start) && <span className="chip chip--gray ml-8">Đã có đánh giá, khóa ngày</span>}
                </td>
                <td>{dateCell(r.start)}</td>
                <td>{dateCell(r.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!closed && (
        <div className="card__body row sc-end">
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu học kỳ
          </button>
        </div>
      )}
    </section>
  );
}
