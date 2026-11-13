import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { getSchoolYearById, saveSchoolYear } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { hasErrors, validateSchoolYear } from '@/utils/school-config/schoolConfigValidation';
import { canConfigureSchool } from '@/utils/school-config/schoolConfigPermissions';
import { formatDate, todayInput } from '@/utils/format';

/**
 * Cấu hình thời gian › Mở chuẩn bị (BE CFG-YR-05): Hiệu trưởng đặt ngày năm sắp diễn ra mở cho giáo viên chuẩn bị.
 * Năm đã bắt đầu / kết thúc chỉ xem. onDirtyChange / saveRef: trang cha hỏi lưu khi đổi tab hoặc rời màn.
 */
export function PrepDateSetting({ yearId, onDirtyChange, saveRef }) {
  const { user } = useAuth();
  const toast = useToast();
  const { years } = useSchoolYears({ live: false });
  const { data: year, loading, error, reload } = useAsync(() => getSchoolYearById(yearId, user), [yearId, user?.id], { enabled: !!yearId });
  const [prepDate, setPrepDate] = useState('');
  const [errorText, setErrorText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrepDate(year?.prepDate || '');
    setErrorText('');
  }, [year]);
  const editable = !!year && year.status === YEAR_STATUS.PLANNED && canConfigureSchool(user);
  const dirty = editable && prepDate !== (year.prepDate || '');
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !year) return <LoadingState />;

  const check = () =>
    validateSchoolYear(
      { name: year.name, startDate: year.startDate, endDate: year.endDate, prepDate },
      years.filter((y) => y.id !== year.id),
      { initialPrepDate: year.prepDate || null, today: todayInput() },
    ).prepDate || '';

  const save = async () => {
    const message = check();
    setErrorText(message);
    if (message) return false;
    setSaving(true);
    try {
      await saveSchoolYear(year.id, { name: year.name, startDate: year.startDate, endDate: year.endDate, prepDate }, user);
      toast.success('Đã lưu ngày mở chuẩn bị.');
      reload({ silent: true });
      return true;
    } catch (err) {
      const d = err.details;
      setErrorText(d?.prepDate || (hasErrors(d || {}) ? Object.values(d)[0] : err.message));
      return false;
    } finally {
      setSaving(false);
    }
  };
  if (saveRef) saveRef.current = save;

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          Mở chuẩn bị năm học {year.name} ({formatDate(year.startDate)} – {formatDate(year.endDate)})
        </h2>
      </div>
      <div className="card__body">
        <div className="grid-3">
          <FormField label="Ngày mở chuẩn bị" required={editable} error={errorText}>
            {editable ? (
              <DateInput
                value={prepDate}
                max={year.startDate}
                onChange={(v) => {
                  setPrepDate(v);
                  setErrorText('');
                }}
                onBlur={() => setErrorText(check())}
              />
            ) : (
              <span>{year.prepDate ? formatDate(year.prepDate) : '—'}</span>
            )}
          </FormField>
        </div>
      </div>
      {editable && (
        <div className="card__body row sc-end">
          <button className="btn btn--primary" onClick={save} disabled={saving || !dirty}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu ngày mở chuẩn bị
          </button>
        </div>
      )}
    </section>
  );
}
